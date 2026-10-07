"""tools/mapgeometry_gridhit.py - how often does a "k radians, n inches" grid point fall on a crime site by chance?

Observed: in the solver frame (true bearing = 16.88 deg - 1 rad, i.e. counter-clockwise, and
3 in x 6.4 mi/in = 19.2 mi) the point lands 0.13 mi from the Lake Herman Road site.

Null: each site is placed uniformly at random (by area) in the annulus 10-35 miles from the summit
(where the Bay Area sites are: LHR 19.3, BRS 22.6, Stine 30.4, Radetich 29.5 mi). The statistic is
the distance from the nearest site to the nearest grid point, minimised over the family of grids a
searcher could use. P = fraction of trials with a hit at least as close as d.

Families (cumulative): directions cw and ccw; k integer or half-integer; n integer or half-inch;
scale 6.4 mi/in (label) or also 7.0 (paper-true); declination 16.88 only or also 15 and 17.

Writes results/mapgeometry/gridhit.json. Run: python tools/mapgeometry_gridhit.py [--trials 20000]
"""
import json
import math
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'results', 'mapgeometry')
RAD = 180 / math.pi


def grid(ks, ns, decls, scales):
    pts = []
    for d in decls:
        for k in ks:
            for sgn in (+1, -1):
                b = math.radians(d + sgn * k * RAD)
                for s in scales:
                    for n in ns:
                        r = n * s
                        pts.append((r * math.sin(b), r * math.cos(b)))
    return np.unique(np.round(np.array(pts), 6), axis=0)


def main():
    trials = 20000
    if '--trials' in sys.argv:
        trials = int(sys.argv[sys.argv.index('--trials') + 1])
    with open(os.path.join(OUTDIR, 'geometry.json'), encoding='utf-8') as f:
        g = json.load(f)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mapgeometry_geo as G
    m = g['constants']['summit']
    site_ids = ['LHR', 'BRS', 'STINE', 'RADETICH']
    real = np.array([G.enu(m['lat'], m['lon'], g['sites'][s]['lat'], g['sites'][s]['lon']) for s in site_ids])
    fams = {
        'integer k, integer n, 6.4, decl 16.88': ([1, 2, 3, 4, 5, 6], range(1, 13), [16.88], [6.4]),
        'integer k, half-inch n, 6.4, decl 16.88': ([1, 2, 3, 4, 5, 6], [0.5 * i for i in range(1, 25)], [16.88], [6.4]),
        'half k, half-inch n, 6.4, decl 16.88': ([0.5 * i for i in range(1, 13)], [0.5 * i for i in range(1, 25)], [16.88], [6.4]),
        'integer k, half-inch n, 6.4 or 7.0, decl 15/16.88/17': ([1, 2, 3, 4, 5, 6], [0.5 * i for i in range(1, 25)], [15, 16.88, 17], [6.4, 7.0]),
        'half k, half-inch n, 6.4 or 7.0, decl 15/16.88/17': ([0.5 * i for i in range(1, 13)], [0.5 * i for i in range(1, 25)], [15, 16.88, 17], [6.4, 7.0]),
    }
    rng = np.random.default_rng(1970)
    r = np.sqrt(rng.uniform(10 ** 2, 35 ** 2, size=(trials, len(site_ids))))
    th = rng.uniform(0, 2 * math.pi, size=(trials, len(site_ids)))
    rand = np.stack([r * np.sin(th), r * np.cos(th)], axis=-1)     # trials x sites x 2
    out = dict(trials=trials, sites=site_ids, null='uniform by area in the 10-35 mi annulus', families=[])
    for name, (ks, ns, decls, scales) in fams.items():
        P = grid(ks, ns, decls, scales)
        # observed
        dobs = np.sqrt(((real[:, None, :] - P[None, :, :]) ** 2).sum(-1)).min()
        best = np.full(trials, 1e9)
        for s in range(len(site_ids)):
            for chunk in range(0, trials, 2000):
                X = rand[chunk:chunk + 2000, s, :]
                d = np.sqrt(((X[:, None, :] - P[None, :, :]) ** 2).sum(-1)).min(axis=1)
                best[chunk:chunk + 2000] = np.minimum(best[chunk:chunk + 2000], d)
        row = dict(family=name, grid_points=int(len(P)), observed_min_mi=float(dobs),
                   p_at_least_as_close=float((best <= dobs).mean()),
                   p_within={str(t): float((best <= t).mean()) for t in (0.13, 0.25, 0.5, 1.0)})
        out['families'].append(row)
        print('%-55s pts %5d  obs %.3f mi  P(<=obs) %.4f  P(<=.25) %.4f  P(<=.5) %.4f  P(<=1) %.4f' % (
            name, len(P), dobs, row['p_at_least_as_close'], row['p_within']['0.25'], row['p_within']['0.5'], row['p_within']['1.0']))
    with open(os.path.join(OUTDIR, 'gridhit.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)


if __name__ == '__main__':
    main()
