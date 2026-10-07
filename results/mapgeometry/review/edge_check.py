"""results/mapgeometry/review/edge_check.py - is Blue Rock Springs (and Lake Herman Road) on the mailed inset?

Re-projects the sites into both scans with every leave-one-out and subset georeference
(the attacker's picks and fit code, tools/mapgeometry_core / _geo), and reports the distance of
each site beyond (+) or inside (-) the top neat line, in ground miles.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import mapgeometry_core as C  # noqa: E402
import mapgeometry_geo as G  # noqa: E402

coords = C.load_coords()
mtd = coords['MTD']
out = {}
for scan in ('zkf', 'exemplar'):
    names = list(C.PICKS[scan])
    src = [(C.PICKS[scan][k][0], -C.PICKS[scan][k][1]) for k in names]
    dst = [G.enu(mtd['lat'], mtd['lon'], coords[k]['lat'], coords[k]['lon']) for k in names]
    fits = {'all': G.fit_similarity(src, dst)}
    for i, nm in enumerate(names):
        fits['loo-' + nm] = G.fit_similarity([p for j, p in enumerate(src) if j != i], [p for j, p in enumerate(dst) if j != i])
    subsets = {'prior7': ['MTD', 'L_CLAYTON', 'L_DANVILLE', 'L_SUNOL', 'L_HMB', 'L_GGB', 'L_TAM'],
               'peaks5': ['MTD', 'L_TAM', 'L_SCARPER', 'L_MORENA', 'L_MAGUIRE'],
               'noSW': ['MTD', 'L_TAM', 'L_MAGUIRE', 'L_CLAYTON', 'L_DANVILLE', 'L_ALAMO', 'L_SUNOL', 'L_GGB']}
    for sn, ks in subsets.items():
        fits[sn] = G.fit_similarity([src[names.index(k)] for k in ks], [dst[names.index(k)] for k in ks])
    yt = C.NEAT[scan][2]
    res = {}
    for sid in ('LHR', 'BRS', 'VALLEJO_PHONE'):
        vals = {}
        for fn, f in fits.items():
            e, n = G.enu(mtd['lat'], mtd['lon'], coords[sid]['lat'], coords[sid]['lon'])
            x, yup = G.invert_similarity(f, e, n)
            y = -yup
            vals[fn] = (yt - y) * f['scale']     # ground miles beyond the top neat line (+ = off the map)
        res[sid] = dict(all=vals['all'], min=min(vals.values()), max=max(vals.values()))
        print('%-9s %-14s beyond top edge: all-landmark fit %+.2f mi; range over LOO/subsets %+.2f .. %+.2f mi' % (
            scan, sid, vals['all'], min(vals.values()), max(vals.values())))
    out[scan] = res
with open(os.path.join(HERE, 'edge_check.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=1)
