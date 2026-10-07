"""tools/mapgeometry_core.py - geometry of the Mt. Diablo map (Z32), independent of any decryption.

What it does (no network; reads results/mapgeometry/coords_raw.json):
  1. Georeferences two scans of the Phillips 66 "San Francisco and Vicinity" inset
     (the Zodiac's marked piece and an unmarked exemplar) from hand-read landmark pixels:
     similarity and affine least-squares fits, leave-one-out.
  2. Measures the Zodiac's drawn crosshair arms from the blue ink (line fits, bootstrap).
  3. Paper-scale calibration: printed bar (pixels), neat line (pixels), ruler photo of the
     exemplar sheet (inches) -> pixels per paper inch, ground miles per paper inch.
  4. Bearings / distances from the summit to every site (WGS84 Vincenty), in true and 1970
     magnetic terms, radians cw/ccw, clock hours, map inches, position on the paper.
  5. Ground points for "k radians from 0 = magnetic north, n inches along it" under several
     conventions, and for the radian/inch pairs that published proposals claim.

Writes results/mapgeometry/geometry.json. Every hand-read pixel value is listed below with
the image it comes from; the crops used to read them are reproducible with
tools/mapgeometry_sheet.py.

Run: python tools/mapgeometry_core.py
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapgeometry_geo as G  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'results', 'mapgeometry')
IMG_Z = os.path.join(ROOT, 'data', 'images', 'z32_map_1970-06-26_large_zkf.jpg')        # Zodiac's piece, 936x1050
IMG_E = os.path.join(ROOT, 'data', 'images', 'z32_map_phillips66_inset_unmarked_zkf.jpg')  # exemplar, 1080x1208

RAD = 180 / math.pi            # 57.29578 degrees
DECL_1970 = 16.88              # NOAA DGRF1970 at the summit, 1970-06-26 (research/z32_map.md section 3)
DECL_ALT = (15.0, 17.0)        # Cipher Mysteries / Sundberg-Thelin value; rounded quad-sheet value

# ---------------------------------------------------------------- hand-read pixels
# (x, y) image pixels, y down. Read from 5-10x gridded crops (tools/mapgeometry_sheet.py);
# reading precision about +-1.5 px for the small printed crosses / town circles.
PICKS = {
    'zkf': {
        'MTD': (716.5, 322.5),        # printed summit cross under "3849" (also the drawn-axes crossing)
        'L_TAM': (80.0, 210.0),       # "x" of East Peak 2571
        'L_SCARPER': (197.0, 709.0),  # "x" of Scarper Peak 1953
        'L_MORENA': (271.0, 864.0),   # "x" of Sierra Morena 2417
        'L_MAGUIRE': (760.5, 738.5),  # "x" of Maguire Peak 1646
        'L_CLAYTON': (702.0, 248.5),  # town circle
        'L_DANVILLE': (628.5, 388.5),
        'L_ALAMO': (603.5, 351.0),
        'L_SUNOL': (713.5, 675.5),
        'L_HMB': (177.0, 806.0),
        'L_GGB': (162.5, 352.0),      # bridge mid-span, +-4 px
    },
    'exemplar': {
        'MTD': (839.5, 367.0),
        'L_TAM': (93.0, 239.5),
        'L_SCARPER': (213.5, 810.5),
        'L_MORENA': (320.5, 993.0),
        'L_MAGUIRE': (900.5, 851.0),
        'L_CLAYTON': (818.0, 286.0),
        'L_DANVILLE': (727.0, 444.0),
        'L_ALAMO': (702.0, 401.0),
        'L_SUNOL': (831.0, 775.0),
        'L_HMB': (203.5, 922.0),
        'L_GGB': (187.0, 402.0),
    },
}
# Neat line (inner border of the inset), read at the four corners: x_left, x_right, y_top, y_bottom
NEAT = {'zkf': (7.0, 860.5, 12.5, 1042.0), 'exemplar': (11.0, 1002.5, 12.0, 1200.0)}
# Printed scale bar "0 ... 8" miles (left end, right end x pixels)
BAR = {'zkf': (44.5, 200.0), 'exemplar': (50.5, 231.0)}
BAR_MILES = 8.0
BAR_LABEL_MI_PER_IN = 6.4
# Ruler photo of the whole exemplar sheet (z32_map_phillips66_front_zkf.jpg, 2535x1498, photo by Ed Neil):
# inch lines 15..24 detected at x = 1113,1189,1266,1341,1418,1493,1569,1644,1720,1794 (row 1462-1472);
# the inset neat line runs from x = 1155 to x = 1663 at y ~ 1340 (just above the ruler).
RULER_INCH_X = {15: 1113, 16: 1189, 17: 1266, 18: 1341, 19: 1418, 20: 1493, 21: 1569, 22: 1644, 23: 1720, 24: 1794}
PHOTO_NEAT_X = (1155.0, 1663.0)
PHOTO_NEAT_Y = (721.0, 1340.0)


def ruler_reading(x):
    ks = sorted(RULER_INCH_X)
    for a, b in zip(ks, ks[1:]):
        xa, xb = RULER_INCH_X[a], RULER_INCH_X[b]
        if xa <= x <= xb:
            return a + (x - xa) / (xb - xa)
    raise ValueError(x)


def load_coords():
    with open(os.path.join(OUTDIR, 'coords_raw.json'), encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------- georeference
def georef(coords, scan):
    mtd = coords['MTD']
    names = list(PICKS[scan])
    src = [(PICKS[scan][k][0], -PICKS[scan][k][1]) for k in names]   # x right, y up
    dst = [G.enu(mtd['lat'], mtd['lon'], coords[k]['lat'], coords[k]['lon']) for k in names]
    sim = G.fit_similarity(src, dst)
    aff = G.fit_affine(src, dst)
    loo = []
    for i in range(len(names)):
        s2 = [p for j, p in enumerate(src) if j != i]
        d2 = [p for j, p in enumerate(dst) if j != i]
        f = G.fit_similarity(s2, d2)
        pu, pv = G.apply_similarity(f, *src[i])
        loo.append(dict(left_out=names[i], theta_deg=f['theta_deg'], px_per_mi=1 / f['scale'],
                        pred_err_mi=math.hypot(pu - dst[i][0], pv - dst[i][1])))
    subsets = {'prior7 (research/z32_map.md set)': ['MTD', 'L_CLAYTON', 'L_DANVILLE', 'L_SUNOL', 'L_HMB', 'L_GGB', 'L_TAM'],
               'peaks5': ['MTD', 'L_TAM', 'L_SCARPER', 'L_MORENA', 'L_MAGUIRE'],
               'without SW (Scarper, Morena, HMB)': ['MTD', 'L_TAM', 'L_MAGUIRE', 'L_CLAYTON', 'L_DANVILLE', 'L_ALAMO', 'L_SUNOL', 'L_GGB']}
    sub = {}
    for sname, ks in subsets.items():
        f = G.fit_similarity([src[names.index(k)] for k in ks], [dst[names.index(k)] for k in ks])
        sub[sname] = dict(theta_deg=f['theta_deg'], px_per_mi=1 / f['scale'], rms_mi=f['rms'])
    res = {names[i]: dict(de_mi=sim['residuals'][i][0], dn_mi=sim['residuals'][i][1],
                          err_mi=math.hypot(*sim['residuals'][i])) for i in range(len(names))}
    return dict(
        n_landmarks=len(names),
        px_per_ground_mile=1 / sim['scale'],
        map_up_true_bearing_deg=-sim['theta_deg'],   # bearing of the map's "up" direction
        true_north_cw_of_map_up_deg=sim['theta_deg'],
        rms_mi=sim['rms'],
        residuals=res,
        leave_one_out=dict(theta_min=min(l['theta_deg'] for l in loo), theta_max=max(l['theta_deg'] for l in loo),
                           px_per_mi_min=min(l['px_per_mi'] for l in loo), px_per_mi_max=max(l['px_per_mi'] for l in loo),
                           max_pred_err_mi=max(l['pred_err_mi'] for l in loo), rows=loo),
        subset_fits=sub,
        affine=dict(rms_mi=aff['rms'], sx_px_per_mi=1 / aff['sx'], sy_px_per_mi=1 / aff['sy'] if aff['sy'] else None,
                    theta_deg=aff['theta_deg'], anisotropy=aff['sx'] / aff['sy']),
        _sim=sim,
    )


def ground_to_px(geo, coords, lat, lon):
    mtd = coords['MTD']
    e, n = G.enu(mtd['lat'], mtd['lon'], lat, lon)
    x, yup = G.invert_similarity(geo['_sim'], e, n)
    return x, -yup


def px_to_ground(geo, coords, x, y):
    mtd = coords['MTD']
    e, n = G.apply_similarity(geo['_sim'], x, -y)
    return G.enu_inv(mtd['lat'], mtd['lon'], e, n)


# ---------------------------------------------------------------- drawn crosshair
def drawn_axes():
    im = np.asarray(Image.open(IMG_Z).convert('RGB')).astype(float)
    R, Gc, B = im[..., 0], im[..., 1], im[..., 2]
    blue = (B > R + 45) & (B > Gc + 25) & (R < 140)
    # clean stroke segments (exclude numerals, arrowhead, circle crossings, the centre gap)
    V = []
    for y0, y1 in [(278, 288), (299, 315), (329, 354), (371, 399)]:
        for y in range(y0, y1):
            row = np.nonzero(blue[y, 705:730])[0]
            if 2 <= len(row) <= 11:
                V.append((y, row.mean() + 705))
    H = []
    for x0, x1 in [(640, 673), (692, 709), (724, 741), (756, 781)]:
        for x in range(x0, x1):
            col = np.nonzero(blue[312:334, x])[0]
            if 2 <= len(col) <= 10:
                H.append((x, col.mean() + 312))
    V, H = np.array(V), np.array(H)
    a, b = np.polyfit(V[:, 0], V[:, 1], 1)
    c, d = np.polyfit(H[:, 0], H[:, 1], 1)
    rng = np.random.default_rng(1)
    A, C = [], []
    for _ in range(2000):
        i = rng.integers(0, len(V), len(V))
        j = rng.integers(0, len(H), len(H))
        A.append(math.degrees(math.atan(-np.polyfit(V[i, 0], V[i, 1], 1)[0])))
        C.append(math.degrees(math.atan(np.polyfit(H[j, 0], H[j, 1], 1)[0])))
    inner = (V[:, 0] >= 299) & (V[:, 0] < 354)
    a_in = np.polyfit(V[inner, 0], V[inner, 1], 1)[0]
    a_out = np.polyfit(V[~inner, 0], V[~inner, 1], 1)[0]
    yi = (c * b + d) / (1 - c * a)
    xi = a * yi + b
    # neat-line verticality on this scan: right border x at top and bottom rows
    return dict(
        zero_arm_cw_of_image_up_deg=math.degrees(math.atan(-a)),
        zero_arm_inner_segments_deg=math.degrees(math.atan(-a_in)),
        zero_arm_outer_segments_deg=math.degrees(math.atan(-a_out)),
        zero_arm_bootstrap_sd_deg=float(np.std(A)),
        three_arm_cw_of_image_right_deg=math.degrees(math.atan(c)),
        three_arm_bootstrap_sd_deg=float(np.std(C)),
        rms_px=dict(zero_arm=float((V[:, 1] - (a * V[:, 0] + b)).std()), three_arm=float((H[:, 1] - (c * H[:, 0] + d)).std())),
        n_samples=dict(zero_arm=int(len(V)), three_arm=int(len(H))),
        intersection_px=(float(xi), float(yi)),
        note='blue-ink mask B>R+45, B>G+25, R<140 on the zkf colour scan; stroke centre per row/column; '
             'segments exclude the numerals, arrowhead, circle crossings and the centre gap',
    )


# ---------------------------------------------------------------- paper scale
def paper_scale(geo):
    out = {}
    for scan in ('zkf', 'exemplar'):
        xl, xr, yt, yb = NEAT[scan]
        bl, br = BAR[scan]
        bar_px_per_mi = (br - bl) / BAR_MILES
        out[scan] = dict(neat_w_px=xr - xl, neat_h_px=yb - yt, aspect_w_over_h=(xr - xl) / (yb - yt),
                         bar_px=br - bl, bar_px_per_bar_mile=bar_px_per_mi,
                         neat_w_bar_miles=(xr - xl) / bar_px_per_mi, neat_h_bar_miles=(yb - yt) / bar_px_per_mi,
                         ground_px_per_mile=geo[scan]['px_per_ground_mile'],
                         bar_over_ground=bar_px_per_mi / geo[scan]['px_per_ground_mile'])
    r0, r1 = ruler_reading(PHOTO_NEAT_X[0]), ruler_reading(PHOTO_NEAT_X[1])
    width_in = r1 - r0
    local_ppi = (RULER_INCH_X[23] - RULER_INCH_X[15]) / 8
    height_in_photo = (PHOTO_NEAT_Y[1] - PHOTO_NEAT_Y[0]) / local_ppi
    z = out['zkf']
    # two calibrations of pixels per paper inch on the Zodiac scan
    ppi_label = z['bar_px_per_bar_mile'] * BAR_LABEL_MI_PER_IN       # bar is exactly 6.4 mi per inch
    ppi_ruler = z['neat_w_px'] / width_in                            # ruler photo of the exemplar
    cal = {}
    for name, ppi in (('bar_label_6.4', ppi_label), ('ruler_photo', ppi_ruler)):
        cal[name] = dict(px_per_paper_inch=ppi,
                         neat_w_in=z['neat_w_px'] / ppi, neat_h_in=z['neat_h_px'] / ppi,
                         bar_mi_per_inch=ppi / z['bar_px_per_bar_mile'],
                         ground_mi_per_paper_inch=ppi / z['ground_px_per_mile'])
    return dict(scans=out,
                ruler_photo=dict(neat_left_reading_in=r0, neat_right_reading_in=r1, neat_width_in=width_in,
                                 neat_height_in_from_photo=height_in_photo,
                                 neat_height_in_from_scan_aspect=width_in / z['aspect_w_over_h'],
                                 ruler_px_per_inch_mean=local_ppi,
                                 note='ruler lies on the carpet just below the sheet; the 15-24 in stretch spans the inset; '
                                      'per-inch spacing drifts 77 -> 74 px across it (perspective), so allow about +-2%'),
                calibrations=cal)


# ---------------------------------------------------------------- per-site table
def site_table(coords, geo, axes, scale):
    mtd = coords['MTD']
    zero_arm_true = geo['zkf']['map_up_true_bearing_deg'] + axes['zero_arm_cw_of_image_up_deg']
    rows = {}
    for k, v in coords.items():
        if k == 'MTD' or v.get('kind') == 'landmark' or 'lat' not in v:
            continue
        d, brg, _ = G.inverse(mtd['lat'], mtd['lon'], v['lat'], v['lon'])
        mag = (brg - DECL_1970) % 360
        x, y = ground_to_px(geo['zkf'], coords, v['lat'], v['lon'])
        xl, xr, yt, yb = NEAT['zkf']
        on = xl <= x <= xr and yt <= y <= yb
        r_px = math.hypot(x - PICKS['zkf']['MTD'][0], y - PICKS['zkf']['MTD'][1])
        paper_brg_from_up = math.degrees(math.atan2(x - PICKS['zkf']['MTD'][0], -(y - PICKS['zkf']['MTD'][1]))) % 360
        row = dict(label=v['label'], kind=v['kind'], lat=v['lat'], lon=v['lon'], source=v.get('source'),
                   ground_mi=d, true_bearing=brg, mag_bearing_1970=mag,
                   clock_hours_cw_from_magN=mag / 30,
                   rad_cw_from_magN=math.radians(mag), rad_ccw_from_magN=math.radians((360 - mag) % 360),
                   rad_cw_from_trueN=math.radians(brg), rad_ccw_from_trueN=math.radians((360 - brg) % 360),
                   paper_bearing_cw_from_map_up=paper_brg_from_up,
                   paper_bearing_cw_from_drawn_zero=(brg - zero_arm_true) % 360,
                   inches_at_label_6p4=d / 6.4,
                   map_px=(x, y), on_mailed_map=on)
        for cname, c in scale['calibrations'].items():
            row['paper_inches_' + cname] = r_px / c['px_per_paper_inch']
        rows[k] = row
    return rows


# ---------------------------------------------------------------- conventions for "k radians, n inches"
def make_conventions(geo, axes, scale):
    """Each convention maps (k radians, n inches) -> ground point. Map conventions work on the paper
    (direction measured on the sheet, inches on the sheet, then paper -> ground via the georeference).
    Geodesic conventions are what most solvers compute: a true bearing and n * (miles per inch)."""
    map_up_true = geo['zkf']['map_up_true_bearing_deg']
    zero_arm_cw = axes['zero_arm_cw_of_image_up_deg']
    ppi = scale['calibrations']['bar_label_6.4']['px_per_paper_inch']
    ppi_r = scale['calibrations']['ruler_photo']['px_per_paper_inch']
    gmi = scale['calibrations']['bar_label_6.4']['ground_mi_per_paper_inch']
    C = {}
    # paper conventions: paper direction (deg cw from map-up) for the zero
    C['map_magN17_cw'] = dict(kind='paper', zero_paper_deg=17.0, sign=+1, ppi=ppi,
                              desc='On the sheet: 0 = printed N arrow (map-up) turned 17 deg clockwise (1970 declination); '
                                   'k rad clockwise; n paper inches (bar-label calibration); paper -> ground by the georeference')
    C['map_magN17_ccw'] = dict(kind='paper', zero_paper_deg=17.0, sign=-1, ppi=ppi,
                               desc='as map_magN17_cw but counter-clockwise (mathematical sense)')
    C['map_drawn0_cw'] = dict(kind='paper', zero_paper_deg=zero_arm_cw, sign=+1, ppi=ppi,
                              desc="On the sheet: 0 = the Zodiac's drawn 0-arm as drawn (%.1f deg cw of map-up), clockwise" % zero_arm_cw)
    C['map_trueN_magN_cw'] = dict(kind='paper', zero_paper_deg=-map_up_true + DECL_1970, sign=+1, ppi=ppi,
                                  desc='On the sheet: 0 = real 1970 magnetic north drawn correctly on this map '
                                       '(true north is %.1f deg cw of map-up), clockwise' % (-map_up_true))
    C['map_magN17_cw_ruler'] = dict(kind='paper', zero_paper_deg=17.0, sign=+1, ppi=ppi_r,
                                    desc='as map_magN17_cw with the ruler-photo inch (%.1f px/in instead of %.1f)' % (ppi_r, ppi))
    C['geo_magN_cw_6p4'] = dict(kind='geodesic', zero_true_deg=DECL_1970, sign=+1, mi_per_in=6.4,
                                desc='Solver convention: true bearing = 16.88 + k rad (clockwise); ground distance = n * 6.4 mi')
    C['geo_magN_ccw_6p4'] = dict(kind='geodesic', zero_true_deg=DECL_1970, sign=-1, mi_per_in=6.4,
                                 desc='Solver convention, counter-clockwise')
    C['geo_magN_cw_true_scale'] = dict(kind='geodesic', zero_true_deg=DECL_1970, sign=+1, mi_per_in=gmi,
                                       desc='true bearing = 16.88 + k rad; ground distance = n * %.2f mi (what a paper inch '
                                            'covers on this map)' % gmi)
    return C


def point_for(conv, k_rad, n_in, geo, coords):
    mtd = coords['MTD']
    if conv['kind'] == 'paper':
        ang = conv['zero_paper_deg'] + conv['sign'] * k_rad * RAD
        r = n_in * conv['ppi']
        x = PICKS['zkf']['MTD'][0] + r * math.sin(math.radians(ang))
        y = PICKS['zkf']['MTD'][1] - r * math.cos(math.radians(ang))
        lat, lon = px_to_ground(geo['zkf'], coords, x, y)
        d, brg, _ = G.inverse(mtd['lat'], mtd['lon'], lat, lon)
    else:
        brg = (conv['zero_true_deg'] + conv['sign'] * k_rad * RAD) % 360
        d = n_in * conv['mi_per_in']
        lat, lon = G.direct(mtd['lat'], mtd['lon'], brg, d)
        x, y = ground_to_px(geo['zkf'], coords, lat, lon)
    xl, xr, yt, yb = NEAT['zkf']
    return dict(lat=lat, lon=lon, ground_mi=d, true_bearing=brg, map_px=(x, y),
                on_mailed_map=bool(xl <= x <= xr and yt <= y <= yb))


K_VALUES = [round(0.5 * i, 2) for i in range(1, 13)]        # 0.5 .. 6.0 rad
N_VALUES = [round(0.5 * i, 2) for i in range(1, 25)]        # 0.5 .. 12 in

# radian / inch pairs read from published proposals (research/z32_literature.md section 4, z32_map.md section 6)
CLAIMS = [
    dict(id='grinell_instep', who='Grinell 2018/2020; InStepWithTheStars', k=4.0, n=5.0, dir='cw',
         text='4 rad clockwise from magnetic N, 5 in'),
    dict(id='dmw_stampher', who='DMW 2019; Stampher 2026', k=300 / RAD, n=3.375, dir='cw',
         text='ten o\'clock = 300 deg magnetic (5.236 rad), 3 3/8 in'),
    dict(id='cragle', who='"Cragle" 2022', k=3.0, n=2.0, dir='cw', text='3 rad, 2 in (direction unstated; cw assumed)'),
    dict(id='cragle_ccw', who='"Cragle" 2022', k=3.0, n=2.0, dir='ccw', text='3 rad, 2 in, counter-clockwise'),
    dict(id='foxon_12_3', who='Foxon 2023', k=3.0, n=12.0, dir='cw', text='r = 12 in, theta = 3 rad (cw from magnetic N variant)'),
    dict(id='foxon_12_3_ccw', who='Foxon 2023', k=3.0, n=12.0, dir='ccw', text='r = 12 in, theta = 3 rad (ccw variant)'),
    dict(id='foxon_3_0', who='Foxon 2023', k=0.0, n=3.0, dir='cw', text='r = 3 in, theta = 0 rad'),
    dict(id='burke_7_south', who='Burke 2019', k=math.pi, n=7.0, dir='cw', text='"seven ins south": 7 in at 6 o\'clock (pi rad) from magnetic N'),
    dict(id='penn_4in_1rad', who='Penn 1987 (misquote of the letter)', k=1.0, n=4.0, dir='cw', text='"four inches along the radian": 1 rad, 4 in'),
    dict(id='penn_4in_1rad_ccw', who='Penn 1987 (misquote of the letter)', k=1.0, n=4.0, dir='ccw', text='1 rad ccw, 4 in'),
    dict(id='pelling_8oclock', who='Pelling (Cipher Mysteries)', k=240 / RAD, n=4.75, dir='cw', text='8 o\'clock (4.19 rad), at the Stine distance'),
]


def main():
    coords = load_coords()
    geo = {s: georef(coords, s) for s in ('zkf', 'exemplar')}
    axes = drawn_axes()
    scale = paper_scale(geo)
    sites = site_table(coords, geo, axes, scale)
    convs = make_conventions(geo, axes, scale)
    grid = {}
    for cname, conv in convs.items():
        pts = []
        for k in K_VALUES:
            for n in N_VALUES:
                p = point_for(conv, k, n, geo, coords)
                p.update(k_rad=k, n_in=n)
                pts.append(p)
        grid[cname] = pts
    claims = []
    for c in CLAIMS:
        for cname in ('map_magN17_cw', 'map_trueN_magN_cw', 'geo_magN_cw_6p4', 'geo_magN_cw_true_scale'):
            conv = dict(convs[cname])
            conv['sign'] = +1 if c['dir'] == 'cw' else -1
            p = point_for(conv, c['k'], c['n'], geo, coords)
            # nearest Zodiac site
            best = min(((G.inverse(p['lat'], p['lon'], s['lat'], s['lon'])[0], sid) for sid, s in sites.items()), key=lambda t: t[0])
            claims.append(dict(claim=c['id'], who=c['who'], text=c['text'], k_rad=c['k'], n_in=c['n'], dir=c['dir'],
                               convention=cname, nearest_site=best[1], nearest_site_mi=best[0], **p))
    # strip private fit objects
    for s in geo.values():
        s.pop('_sim', None)
    out = dict(constants=dict(decl_1970_deg=DECL_1970, decl_alternatives=DECL_ALT, one_radian_deg=RAD,
                              summit=dict(lat=coords['MTD']['lat'], lon=coords['MTD']['lon']),
                              picks=PICKS, neat=NEAT, bar=BAR, ruler_inch_x=RULER_INCH_X,
                              photo_neat_x=PHOTO_NEAT_X, photo_neat_y=PHOTO_NEAT_Y),
               georeference=geo, drawn_axes=axes, paper_scale=scale, sites=sites,
               conventions={k: {kk: vv for kk, vv in v.items()} for k, v in convs.items()},
               grid=grid, claims=claims, k_values=K_VALUES, n_values=N_VALUES)
    os.makedirs(OUTDIR, exist_ok=True)
    with open(os.path.join(OUTDIR, 'geometry.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    # console summary
    for s in ('zkf', 'exemplar'):
        g = geo[s]
        print('[%s] %d landmarks: %.2f px/mi, true N %.2f deg cw of map-up (LOO %.2f..%.2f), rms %.3f mi; affine sx/sy %.3f, rms %.3f' % (
            s, g['n_landmarks'], g['px_per_ground_mile'], g['true_north_cw_of_map_up_deg'], g['leave_one_out']['theta_min'],
            g['leave_one_out']['theta_max'], g['rms_mi'], g['affine']['anisotropy'], g['affine']['rms_mi']))
        for k, r in g['residuals'].items():
            print('    %-11s %.2f mi' % (k, r['err_mi']))
    print('drawn 0-arm %.2f deg cw of image-up (sd %.2f; inner %.2f, outer %.2f); 3-arm %.2f deg cw of image-right' % (
        axes['zero_arm_cw_of_image_up_deg'], axes['zero_arm_bootstrap_sd_deg'], axes['zero_arm_inner_segments_deg'],
        axes['zero_arm_outer_segments_deg'], axes['three_arm_cw_of_image_right_deg']))
    print('drawn 0-arm true bearing: %.2f deg' % (geo['zkf']['map_up_true_bearing_deg'] + axes['zero_arm_cw_of_image_up_deg']))
    print(json.dumps(scale, indent=1))
    print('%-15s %7s %8s %8s %6s %7s %7s %7s %6s %6s %6s %s' % ('site', 'mi', 'true', 'mag', 'clock', 'radCW', 'radCCW', 'paper', 'in6.4', 'inLbl', 'inRul', 'onmap'))
    for k, r in sites.items():
        print('%-15s %7.2f %8.2f %8.2f %6.2f %7.3f %7.3f %7.2f %6.2f %6.2f %6.2f %s' % (
            k, r['ground_mi'], r['true_bearing'], r['mag_bearing_1970'], r['clock_hours_cw_from_magN'], r['rad_cw_from_magN'],
            r['rad_ccw_from_magN'], r['paper_bearing_cw_from_map_up'], r['inches_at_label_6p4'],
            r['paper_inches_bar_label_6.4'], r['paper_inches_ruler_photo'], r['on_mailed_map']))
    for c in claims:
        print('%-18s %-24s %9.5f %10.5f  %5.1f mi  brg %6.2f  on-map %-5s near %s %.2f mi' % (
            c['claim'], c['convention'], c['lat'], c['lon'], c['ground_mi'], c['true_bearing'], c['on_mailed_map'],
            c['nearest_site'], c['nearest_site_mi']))
    for cname, pts in grid.items():
        print('%s: %d of %d grid points on the mailed map' % (cname, sum(p['on_mailed_map'] for p in pts), len(pts)))


if __name__ == '__main__':
    main()
