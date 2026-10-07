"""tools/mapgeometry_annotate.py - what is at each enumerated "k radians, n inches" point.

Reads results/mapgeometry/geometry.json; writes results/mapgeometry/annotations.json.

For every on-map grid point of the main conventions, every claimed radian/inch point, and a
null sample of random points on the mailed map it records:
  - water or land on the 1970 map itself (colour of the zkf scan around the point; offline),
  - Nominatim reverse geocode (road, neighbourhood, town) - 2026 OpenStreetMap,
  - OSM schools (amenity=school/college/university/kindergarten) within 0.25 and 0.5 mile - 2026 data,
  - Wikipedia articles within 1 km.
All lookups go through the cache in tools/mapgeometry_fetch.py. The school and article data are
present-day: schools built after 1970 count, schools closed since do not.

Run: python tools/mapgeometry_annotate.py [--max-seconds 1800] [--offline] [--null 150]
"""
import json
import math
import os
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapgeometry_fetch as F  # noqa: E402
import mapgeometry_geo as G  # noqa: E402
import mapgeometry_core as C  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'results', 'mapgeometry')
MAIN_CONVS = ['map_magN17_cw', 'map_magN17_ccw', 'map_trueN_magN_cw', 'geo_magN_cw_6p4']

_img = None


def map_water(x, y):
    """Water on the printed map? Blue-grey water tint vs the cream / yellow land tints."""
    global _img
    if _img is None:
        _img = np.asarray(Image.open(C.IMG_Z).convert('RGB')).astype(float)
    xi, yi = int(round(x)), int(round(y))
    h, w, _ = _img.shape
    if not (2 <= xi < w - 2 and 2 <= yi < h - 2):
        return None
    patch = _img[yi - 2:yi + 3, xi - 2:xi + 3].reshape(-1, 3)
    r, g, b = np.median(patch, axis=0)
    # map water: light steel blue (b > r by > 15); ink is much darker
    if b > r + 60:          # the Zodiac's blue ink, not map tint
        return None
    return bool(b > r + 15 and g > r + 8)


def summarise_reverse(d):
    if not d or 'error' in d:
        return dict(found=False)
    a = d.get('address', {})
    town = a.get('city') or a.get('town') or a.get('village') or a.get('hamlet') or a.get('municipality')
    return dict(found=True, category=d.get('category'), type=d.get('type'), name=d.get('name'),
                road=a.get('road'), neighbourhood=a.get('neighbourhood') or a.get('suburb') or a.get('quarter'),
                town=town, county=a.get('county'), display=d.get('display_name', '')[:160])


def annotate_point(lat, lon, offline, reverse=True):
    rec = {}
    if reverse:
        rv = F.nominatim_reverse(lat, lon, zoom=16, offline=offline)
        rec['place'] = summarise_reverse(rv) if rv is not None else None
    else:
        rec['place'] = None
    sc = F.schools_near(lat, lon, half_mi=0.6, offline=offline)
    if sc is None:
        rec['schools'] = None
    else:
        lst = []
        for s in sc:
            d, _, _ = G.inverse(lat, lon, float(s['lat']), float(s['lon']))
            lst.append(dict(name=s.get('name') or s.get('display_name', '')[:60], type=s.get('type'), dist_mi=round(d, 3)))
        lst.sort(key=lambda t: t['dist_mi'])
        rec['schools'] = lst
        rec['school_within_0.25mi'] = any(s['dist_mi'] <= 0.25 for s in lst)
        rec['school_within_0.5mi'] = any(s['dist_mi'] <= 0.5 for s in lst)
        rec['nearest_school'] = lst[0] if lst else None
    ws = F.wiki_geosearch(lat, lon, radius_m=1000, limit=10, offline=offline)
    rec['wiki_1km'] = None if ws is None else [dict(title=w['title'], dist_m=w['dist']) for w in ws]
    return rec


def main():
    max_s = 1800
    if '--max-seconds' in sys.argv:
        max_s = float(sys.argv[sys.argv.index('--max-seconds') + 1])
    offline = '--offline' in sys.argv
    n_null = 120
    if '--null' in sys.argv:
        n_null = int(sys.argv[sys.argv.index('--null') + 1])
    with open(os.path.join(OUTDIR, 'geometry.json'), encoding='utf-8') as f:
        geo = json.load(f)
    sites = geo['sites']
    xl, xr, yt, yb = geo['constants']['neat']['zkf']
    # rebuild the georeference for px -> ground on the null sample
    coords = C.load_coords()
    gz = C.georef(coords, 'zkf')

    jobs = []   # (key, lat, lon, x, y, tags)
    for cname in MAIN_CONVS:
        for p in geo['grid'][cname]:
            if p['on_mailed_map']:
                jobs.append(('grid|%s|%.2f|%.2f' % (cname, p['k_rad'], p['n_in']), p['lat'], p['lon'], p['map_px'][0], p['map_px'][1]))
    for c in geo['claims']:
        jobs.append(('claim|%s|%s' % (c['claim'], c['convention']), c['lat'], c['lon'], c['map_px'][0], c['map_px'][1]))
    rng = np.random.default_rng(7)
    for i in range(n_null):
        x = rng.uniform(xl, xr)
        y = rng.uniform(yt, yb)
        lat, lon = C.px_to_ground(gz, coords, x, y)
        jobs.append(('null|%03d' % i, lat, lon, x, y))

    t0 = time.time()
    # pass 1: collect uncached URLs (offline), pass 2: concurrent rate-limited prefetch, pass 3: offline build
    if not offline:
        F.MISSING.clear()
        # priority: null sample and claims first, then grid points (a time cap cuts the grid, not the null)
        order = sorted(jobs, key=lambda j: 0 if j[0].startswith('null') else (1 if j[0].startswith('claim') else 2))
        for key, lat, lon, x, y in order:
            annotate_point(lat, lon, True, reverse=not key.startswith('null'))
        n_todo, n_ok = F.prefetch(list(F.MISSING), max_seconds=max_s)
        print('prefetch: %d uncached URLs, %d fetched, %.0f s' % (n_todo, n_ok, time.time() - t0))
    out = {}
    done = 0
    for key, lat, lon, x, y in jobs:
        rec = dict(key=key, lat=lat, lon=lon, map_px=(x, y))
        rec['map_water'] = map_water(x, y)
        # nearest Zodiac-related site
        best = min(((G.inverse(lat, lon, s['lat'], s['lon'])[0], sid) for sid, s in sites.items() if s['kind'] == 'zodiac'),
                   key=lambda t: t[0])
        rec['nearest_zodiac_site'] = best[1]
        rec['nearest_zodiac_site_mi'] = best[0]
        rec.update(annotate_point(lat, lon, True, reverse=not key.startswith('null')))   # cache only
        done += 1
        out[key] = rec
        if done % 25 == 0:
            F.save()
    F.save()
    with open(os.path.join(OUTDIR, 'annotations.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    n_annot = sum(1 for r in out.values() if r.get('schools') is not None)
    print('points %d, annotated %d, %.0f s' % (len(out), n_annot, time.time() - t0))


if __name__ == '__main__':
    main()
