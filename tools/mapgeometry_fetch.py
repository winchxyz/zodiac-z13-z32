"""tools/mapgeometry_fetch.py - cached, rate-limited lookups for the mapgeometry task.

Nominatim (OpenStreetMap) search / reverse / nearby schools, and Wikipedia
coordinates / geosearch. Every response is cached in
results/mapgeometry/cache/http_cache.json keyed by URL, so reruns are offline
and reproducible. Nominatim is called at most once per 1.1 s (usage policy).

These are 2026 data sources: schools, roads and place names are today's, not
1970's. Callers must say so when they report them.
"""
import json
import os
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_PATH = os.path.join(ROOT, 'results', 'mapgeometry', 'cache', 'http_cache.json')
UA = 'zodiac-mapgeometry-research/1.0 (offline research script; cached, 1 req/s)'
_cache = None
_last_nominatim = [0.0]


def _load():
    global _cache
    if _cache is None:
        try:
            with open(CACHE_PATH, encoding='utf-8') as f:
                _cache = json.load(f)
        except (OSError, ValueError):
            _cache = {}
    return _cache


def save():
    if _cache is None:
        return
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    tmp = CACHE_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(_cache, f, ensure_ascii=False, indent=0, sort_keys=True)
    os.replace(tmp, CACHE_PATH)


MISSING = []   # URLs asked for in offline mode and not cached (for prefetch)


def _fetch_one(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            if attempt == 2:
                print('fetch failed', url[:120], e)
                return None
            time.sleep(10 + 10 * attempt)


def prefetch(urls, max_seconds=1800):
    """Fetch many URLs concurrently while issuing at most 1 Nominatim request per 1.05 s and
    one Wikipedia request per 0.35 s (requests may overlap in flight; the issue rate is capped)."""
    import threading
    from concurrent.futures import ThreadPoolExecutor
    c = _load()
    todo = [u for u in dict.fromkeys(urls) if u not in c]
    nom = [u for u in todo if 'nominatim' in u]
    wik = [u for u in todo if 'nominatim' not in u]
    lock = threading.Lock()
    t0 = time.time()

    class Limiter:
        def __init__(self, gap):
            self.gap, self.next_t, self.lk = gap, 0.0, threading.Lock()

        def wait(self):
            with self.lk:
                now = time.time()
                t = max(now, self.next_t)
                self.next_t = t + self.gap
            if t > now:
                time.sleep(t - now)

    def run(lst, gap):
        lim = Limiter(gap)

        def job(u):
            if time.time() - t0 > max_seconds:
                return None
            lim.wait()            # the issue time of every request is spaced by >= gap
            return _fetch_one(u)
        with ThreadPoolExecutor(max_workers=4) as ex:
            futs = [(u, ex.submit(job, u)) for u in lst]
            for i, (u, f) in enumerate(futs):
                d = f.result()
                if d is not None:
                    with lock:
                        c[u] = d
                if i % 50 == 49:
                    with lock:
                        save()
    th = [threading.Thread(target=run, args=(nom, 1.05)), threading.Thread(target=run, args=(wik, 0.35))]
    for t in th:
        t.start()
    for t in th:
        t.join()
    save()
    return len(todo), sum(1 for u in todo if u in c)


def get_json(url, nominatim=False, offline=False):
    c = _load()
    if url in c:
        return c[url]
    if offline:
        MISSING.append(url)
        return None
    gap = 1.1 if nominatim else 0.6
    wait = gap - (time.time() - _last_nominatim[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.loads(r.read().decode('utf-8'))
            break
        except Exception as e:  # network hiccup: back off and retry
            if attempt == 2:
                print('fetch failed', url, e)
                return None
            time.sleep(10 + 10 * attempt)
        finally:
            _last_nominatim[0] = time.time()
    c[url] = data
    if len(c) % 20 == 0:
        save()
    return data


def nominatim_search(q, viewbox=None, limit=5, offline=False):
    p = {'q': q, 'format': 'jsonv2', 'limit': str(limit)}
    if viewbox:
        p['viewbox'] = ','.join('%.5f' % v for v in viewbox)
        p['bounded'] = '1'
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(p)
    return get_json(url, nominatim=True, offline=offline)


def nominatim_reverse(lat, lon, zoom=17, offline=False):
    p = {'lat': '%.5f' % lat, 'lon': '%.5f' % lon, 'format': 'jsonv2', 'zoom': str(zoom), 'addressdetails': '1'}
    url = 'https://nominatim.openstreetmap.org/reverse?' + urllib.parse.urlencode(p)
    return get_json(url, nominatim=True, offline=offline)


def schools_near(lat, lon, half_mi=0.6, offline=False):
    """OSM amenity=school objects in a box of +-half_mi around the point (Nominatim, max 50)."""
    import math
    dlat = half_mi / 69.05
    dlon = half_mi / (69.17 * math.cos(math.radians(lat)))
    res = nominatim_search('school', viewbox=(lon - dlon, lat + dlat, lon + dlon, lat - dlat), limit=50, offline=offline)
    if res is None:
        return None
    return [r for r in res if r.get('category') == 'amenity' and r.get('type') in ('school', 'college', 'university', 'kindergarten')]


def wiki_coords(title, offline=False):
    p = {'action': 'query', 'titles': title, 'prop': 'coordinates', 'format': 'json', 'redirects': '1', 'coprimary': 'primary'}
    url = 'https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(p)
    d = get_json(url, offline=offline)
    if not d:
        return None
    for page in d.get('query', {}).get('pages', {}).values():
        co = page.get('coordinates')
        if co:
            return co[0]['lat'], co[0]['lon'], page.get('title')
    return None


def wiki_geosearch(lat, lon, radius_m=3000, limit=20, offline=False):
    p = {'action': 'query', 'list': 'geosearch', 'gscoord': '%.5f|%.5f' % (lat, lon),
         'gsradius': str(int(radius_m)), 'gslimit': str(limit), 'format': 'json'}
    url = 'https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(p)
    d = get_json(url, offline=offline)
    if not d:
        return None
    return d.get('query', {}).get('geosearch', [])


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'search':
        print(json.dumps(nominatim_search(' '.join(sys.argv[2:])), indent=1)[:3000])
    elif len(sys.argv) > 1 and sys.argv[1] == 'wiki':
        print(wiki_coords(' '.join(sys.argv[2:])))
    save()
