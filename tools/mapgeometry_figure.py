"""tools/mapgeometry_figure.py - figure for the mapgeometry task (PNG + SVG via matplotlib).

Left: the Zodiac's mailed map (zkf scan) with the neat line, the summit, the fitted drawn axes,
map-up / true north / 1970 magnetic north, radian rays (k = 1..6) clockwise and counter-clockwise
from "map-up + 17 deg", paper-inch rings and the Zodiac-related sites placed by the georeference.
Right: ground view (miles, true north up) with every site, the mailed map's footprint, and the
solver-convention rays (true bearing 16.88 + k rad) with 6.4-mile rings.

Run: python tools/mapgeometry_figure.py  (needs results/mapgeometry/geometry.json)
"""
import json
import math
import os
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapgeometry_core as C  # noqa: E402
import mapgeometry_geo as G  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'results', 'mapgeometry')
RAD = 180 / math.pi

SHORT = {'LHR': 'Lake Herman Rd', 'BRS': 'Blue Rock Spr.', 'LB': 'L. Berryessa', 'STINE': 'Washington & Cherry',
         'RADETICH': 'Radetich (Waller St)', 'JOHNS_VERNALIS': 'Johns (Hwy 132)', 'JOHNS_PATTERSON': 'Patterson',
         'BATES': 'Riverside (Bates)', 'NAPA_PHONE': 'Napa phone', 'VALLEJO_PHONE': 'Vallejo phone',
         'CHRONICLE': 'Chronicle', 'PUC': 'Pacific Union Coll.', 'LASS': 'Stateline (Lass)', 'INGLESIDE': 'Ingleside Stn',
         'DMW_PT': 'DMW/Stampher pt', 'PRAETORIAN_PT': 'Praetorian pt', 'SOUTH_TAHOE_MS': 'S. Tahoe MS',
         'LAKE_SPAULDING': 'L. Spaulding'}
COL = dict(zodiac='#c0392b', claim='#7d3c98', ray_cw='#1f6feb', ray_ccw='#e67e22', true='#111111', mag='#0a8f3c', up='#555555')


def main():
    with open(os.path.join(OUTDIR, 'geometry.json'), encoding='utf-8') as f:
        g = json.load(f)
    sites = g['sites']
    mx, my = C.PICKS['zkf']['MTD']
    map_up_true = g['georeference']['zkf']['map_up_true_bearing_deg']
    true_cw_of_up = -map_up_true
    decl = g['constants']['decl_1970_deg']
    ppi = g['paper_scale']['calibrations']['bar_label_6.4']['px_per_paper_inch']
    axes = g['drawn_axes']
    xl, xr, yt, yb = g['constants']['neat']['zkf']

    fig = plt.figure(figsize=(17, 9.6))
    ax = fig.add_axes([0.02, 0.05, 0.47, 0.88])
    im = Image.open(C.IMG_Z).convert('L')
    ax.imshow(np.asarray(im), cmap='gray', alpha=0.45, extent=(0, im.size[0], im.size[1], 0))
    ax.plot([xl, xr, xr, xl, xl], [yt, yt, yb, yb, yt], color='k', lw=1.0)

    def ray(ang_paper_deg, length_px, **kw):
        a = math.radians(ang_paper_deg)
        ax.plot([mx, mx + length_px * math.sin(a)], [my, my - length_px * math.cos(a)], **kw)

    L = 1400
    # radian rays from "map-up + 17 deg" (what the Zodiac could set on this sheet)
    for k in range(1, 7):
        ray(17 + k * RAD, L, color=COL['ray_cw'], lw=1.2, alpha=0.85)
        a = math.radians(17 + k * RAD)
        for n_lab in (2.0, 4.5):
            tx, ty = mx + n_lab * ppi * math.sin(a), my - n_lab * ppi * math.cos(a)
            if xl < tx < xr and yt < ty < yb:
                ax.text(tx, ty, '%d rad cw' % k, color=COL['ray_cw'], fontsize=7, ha='center', va='center',
                        bbox=dict(fc='white', ec='none', alpha=0.7, pad=0.5))
                break
        ray(17 - k * RAD, L, color=COL['ray_ccw'], lw=0.8, ls='--', alpha=0.8)
    # references
    ray(0, 330, color=COL['up'], lw=1.0, ls=':')
    ray(true_cw_of_up, 330, color=COL['true'], lw=1.6)
    ray(true_cw_of_up + decl, 330, color=COL['mag'], lw=1.6)
    ray(17.0, 330, color=COL['ray_cw'], lw=2.4)
    # fitted drawn axes
    za = axes['zero_arm_cw_of_image_up_deg']
    ta = axes['three_arm_cw_of_image_right_deg']
    for ang, ln in ((za, 100), (za + 180, 100)):
        ray(ang, ln, color='#0b3d91', lw=2.6, alpha=0.9)
    for ang, ln in ((90 + ta, 75), (270 + ta, 75)):
        ray(ang, ln, color='#0b3d91', lw=2.6, alpha=0.9)
    # rings in paper inches
    for n in range(1, 9):
        circ = plt.Circle((mx, my), n * ppi, fill=False, color='#888888', lw=0.6, ls='-', alpha=0.7)
        ax.add_patch(circ)
        ax.text(mx - n * ppi * math.sin(math.radians(200)), my + n * ppi * math.cos(math.radians(200)) - 4,
                '%d in' % n, fontsize=6.5, color='#555555', ha='center')
    # sites
    offmap = []
    for sid, s in sites.items():
        x, y = s['map_px']
        col = COL['zodiac'] if s['kind'] == 'zodiac' else COL['claim']
        if xl <= x <= xr and yt <= y <= yb:
            ax.plot(x, y, 'o', ms=5 if s['kind'] == 'zodiac' else 4, color=col, mec='white', mew=0.6)
            dx = 6
            ax.text(x + dx, y - 6, SHORT.get(sid, sid), fontsize=7, color=col, bbox=dict(fc='white', ec='none', alpha=0.6, pad=0.3))
        elif s['ground_mi'] < 80:
            # arrow at the map edge in the site's direction
            a = math.atan2(x - mx, -(y - my))
            # intersect ray with neat rectangle
            ts = []
            for t in np.linspace(0, 1500, 3000):
                px, py = mx + t * math.sin(a), my - t * math.cos(a)
                if not (xl <= px <= xr and yt <= py <= yb):
                    ts.append(t)
                    break
            t = ts[0] - 8 if ts else 300
            px, py = mx + t * math.sin(a), my - t * math.cos(a)
            ax.annotate('', xy=(px, py), xytext=(mx + (t - 40) * math.sin(a), my - (t - 40) * math.cos(a)),
                        arrowprops=dict(arrowstyle='->', color=col, lw=1.0))
            offmap.append('%s: %.1f in at %.0f deg from map-up' % (SHORT.get(sid, sid), s['paper_inches_bar_label_6.4'],
                                                                    s['paper_bearing_cw_from_map_up']))
    if offmap:
        ax.text(20, 560, 'Off the mailed map (arrows):\n' + '\n'.join(offmap), fontsize=6.5, color=COL['zodiac'],
                va='top', bbox=dict(fc='white', ec='#cccccc', alpha=0.85, pad=2))
    ax.plot(mx, my, '*', ms=12, color='gold', mec='k', mew=0.8)
    ax.set_xlim(-10, im.size[0] + 10)
    ax.set_ylim(im.size[1] + 10, -10)
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_title('Mailed map (paper): rays k rad from map-up + 17 deg; rings in paper inches (bar = 6.4 mi/in)', fontsize=9.5)
    from matplotlib.lines import Line2D
    h = [Line2D([], [], color=COL['up'], ls=':', label='map-up (printed N arrow)'),
         Line2D([], [], color=COL['true'], lw=1.6, label='true north (%.1f deg cw of map-up)' % true_cw_of_up),
         Line2D([], [], color=COL['mag'], lw=1.6, label='1970 magnetic north (true + %.1f)' % decl),
         Line2D([], [], color=COL['ray_cw'], lw=2.4, label='"0 set to Mag. N" = map-up + 17 deg'),
         Line2D([], [], color='#0b3d91', lw=2.6, label='drawn axes (fit to the ink): 0-arm %.1f deg cw of up' % za),
         Line2D([], [], color=COL['ray_cw'], lw=1.2, label='k = 1..6 rad clockwise'),
         Line2D([], [], color=COL['ray_ccw'], lw=0.8, ls='--', label='k = 1..6 rad counter-clockwise'),
         Line2D([], [], marker='o', ls='', color=COL['zodiac'], label='Zodiac-related site'),
         Line2D([], [], marker='o', ls='', color=COL['claim'], label='point named by a proposal')]
    ax.legend(handles=h, loc='lower right', fontsize=7, framealpha=0.85)

    # ---------------- ground panel
    bx = fig.add_axes([0.53, 0.05, 0.45, 0.88])
    lat0, lon0 = g['constants']['summit']['lat'], g['constants']['summit']['lon']
    # mailed map footprint
    coords = C.load_coords()
    gz = C.georef(coords, 'zkf')
    fp = []
    for (x, y) in [(xl, yt), (xr, yt), (xr, yb), (xl, yb), (xl, yt)]:
        la, lo = C.px_to_ground(gz, coords, x, y)
        fp.append(G.enu(lat0, lon0, la, lo))
    fp = np.array(fp)
    bx.fill(fp[:, 0], fp[:, 1], color='#e8eef7', ec='k', lw=1.0, label='mailed map footprint')
    for k in range(1, 7):
        a = math.radians(decl + k * RAD)
        bx.plot([0, 80 * math.sin(a)], [0, 80 * math.cos(a)], color=COL['ray_cw'], lw=1.0)
        bx.text(58 * math.sin(a), 58 * math.cos(a), '%d' % k, color=COL['ray_cw'], fontsize=8)
        a2 = math.radians(decl - k * RAD)
        bx.plot([0, 80 * math.sin(a2)], [0, 80 * math.cos(a2)], color=COL['ray_ccw'], lw=0.7, ls='--')
    a = math.radians(decl)
    bx.plot([0, 30 * math.sin(a)], [0, 30 * math.cos(a)], color=COL['mag'], lw=2)
    bx.plot([0, 0], [0, 30], color=COL['true'], lw=1.5)
    for n in range(1, 13):
        bx.add_patch(plt.Circle((0, 0), n * 6.4, fill=False, color='#999999', lw=0.5))
    for sid, s in sites.items():
        e, n = G.enu(lat0, lon0, s['lat'], s['lon'])
        if math.hypot(e, n) > 75:
            continue
        col = COL['zodiac'] if s['kind'] == 'zodiac' else COL['claim']
        bx.plot(e, n, 'o', ms=5, color=col, mec='white', mew=0.6)
        bx.text(e + 0.8, n + 0.8, SHORT.get(sid, sid), fontsize=7, color=col)
    bx.plot(0, 0, '*', ms=12, color='gold', mec='k')
    bx.set_aspect('equal')
    bx.set_xlim(-60, 45); bx.set_ylim(-55, 65)
    bx.set_xlabel('miles east of the summit'); bx.set_ylabel('miles north of the summit (true north up)')
    bx.set_title('Ground (WGS84): solver rays, true bearing 16.88 + k rad; rings every 6.4 mi', fontsize=9.5)
    bx.grid(alpha=0.25)
    fig.suptitle('Mt. Diablo map (Z32, 1970-06-26): radians and inches from the summit', fontsize=12)
    for ext in ('png', 'svg'):
        fig.savefig(os.path.join(OUTDIR, 'mapgeometry_figure.' + ext), dpi=150)
    print('wrote', os.path.join(OUTDIR, 'mapgeometry_figure.png'), 'and .svg')


if __name__ == '__main__':
    main()
