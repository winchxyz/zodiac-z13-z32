"""results/mapgeometry/review/independent.py - reviewer's independent checks of the mapgeometry result.

Does NOT import the attacker's geodesy (tools/mapgeometry_geo.py). Uses:
  - ECEF -> local ENU on the WGS84 ellipsoid for azimuths, and Andoyer-Lambert for distances;
  - its own Monte Carlo for the "k radians, n inches" grid hit with a wider (fairer) family:
    four zero references (magnetic N, true N, magnetic E = 3-arm on mag E, true E), cw and ccw,
    integer k = 0..6 or half-steps, integer or half-inch n, scale 6.4 or 7.0 mi/in;
  - a rotation null (the real site constellation rotated rigidly about the summit) besides the
    attacker's uniform-annulus null;
  - Foxon's own convention (polar axis east, counter-clockwise);
  - Penn's watch face re-solved with Lake Berryessa at 12:00 and Blue Rock Springs exactly at 9:00;
  - sensitivity of the Lake Herman Road "1 radian" coincidence to declination and site position.
Reads results/mapgeometry/geometry.json (attacker output) only for site coordinates and
georeference numbers. Writes results/mapgeometry/review/independent.json.

Run: python results/mapgeometry/review/independent.py [--trials 20000]
"""
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
GEO = os.path.join(ROOT, 'results', 'mapgeometry', 'geometry.json')
RAD = 180 / math.pi
A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)
MI = 1609.344


def ecef(lat, lon, h=0.0):
    la, lo = math.radians(lat), math.radians(lon)
    N = A / math.sqrt(1 - E2 * math.sin(la) ** 2)
    return np.array([(N + h) * math.cos(la) * math.cos(lo), (N + h) * math.cos(la) * math.sin(lo), (N * (1 - E2) + h) * math.sin(la)])


def enu_az(lat0, lon0, lat, lon):
    """azimuth (deg cw from true N) of the target in the local horizontal plane at (lat0, lon0)"""
    la, lo = math.radians(lat0), math.radians(lon0)
    d = ecef(lat, lon) - ecef(lat0, lon0)
    e = -math.sin(lo) * d[0] + math.cos(lo) * d[1]
    n = -math.sin(la) * math.cos(lo) * d[0] - math.sin(la) * math.sin(lo) * d[1] + math.cos(la) * d[2]
    return math.degrees(math.atan2(e, n)) % 360


def andoyer(lat1, lon1, lat2, lon2):
    """Andoyer-Lambert ellipsoidal distance, miles (accurate to ~10 m here)"""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    b1 = math.atan((1 - F) * math.tan(p1))
    b2 = math.atan((1 - F) * math.tan(p2))
    dl = math.radians(lon2 - lon1)
    sig = math.acos(min(1, math.sin(b1) * math.sin(b2) + math.cos(b1) * math.cos(b2) * math.cos(dl)))
    P = (b1 + b2) / 2
    Q = (b2 - b1) / 2
    X = (sig - math.sin(sig)) * (math.sin(P) ** 2 * math.cos(Q) ** 2) / (math.cos(sig / 2) ** 2)
    Y = (sig + math.sin(sig)) * (math.cos(P) ** 2 * math.sin(Q) ** 2) / (math.sin(sig / 2) ** 2)
    return A * (sig - F / 2 * (X + Y)) / MI


def destination_flat(e0, n0, brg, d):
    r = math.radians(brg)
    return e0 + d * math.sin(r), n0 + d * math.cos(r)


def main():
    trials = 20000
    if '--trials' in sys.argv:
        trials = int(sys.argv[sys.argv.index('--trials') + 1])
    g = json.load(open(GEO, encoding='utf-8'))
    S = g['sites']
    m = g['constants']['summit']
    out = {}

    # ---------------------------------------------------- 1. independent bearings / distances
    rows = {}
    print('1. independent geodesy (ECEF-ENU azimuth, Andoyer-Lambert distance) vs attacker (Vincenty)')
    for sid, s in S.items():
        az = enu_az(m['lat'], m['lon'], s['lat'], s['lon'])
        d = andoyer(m['lat'], m['lon'], s['lat'], s['lon'])
        rows[sid] = dict(az=az, d=d, d_att=s['ground_mi'], az_att=s['true_bearing'])
        print('  %-15s az %8.3f (att %8.3f, diff %+.3f)  d %8.3f mi (att %8.3f, diff %+.3f)' % (
            sid, az, s['true_bearing'], ((az - s['true_bearing'] + 180) % 360) - 180, d, s['ground_mi'], d - s['ground_mi']))
    out['geodesy'] = rows

    # ---------------------------------------------------- 2. LHR sensitivity
    lhr = S['LHR']
    sens = {}
    for decl in (15.0, 16.5, 16.88, 17.0, 17.5):
        sens['decl_%.2f' % decl] = dict(ccw_rad=((decl - lhr['true_bearing']) % 360) / RAD,
                                        err_deg=((decl - lhr['true_bearing']) % 360) - RAD)
    lateral_per_deg = lhr['ground_mi'] * math.radians(1)
    sens['lateral_mi_per_deg_at_LHR'] = lateral_per_deg
    sens['bearing_change_deg_per_0.1mi_lateral'] = 0.1 / lateral_per_deg
    # bearing of the LHR road segment: how much does the bearing change moving 0.25 mi along the road either way?
    print('2. LHR sensitivity:', json.dumps(sens, indent=1))
    out['lhr_sensitivity'] = sens

    # ---------------------------------------------------- 3. grid-hit Monte Carlo with a wider family
    def enu_flat(s):
        az = math.radians(s['true_bearing'])
        return s['ground_mi'] * math.sin(az), s['ground_mi'] * math.cos(az)

    site_ids = ['LHR', 'BRS', 'STINE', 'RADETICH']
    site_ids_wide = site_ids + ['VALLEJO_PHONE', 'CHRONICLE']
    decl = 16.88

    def grid(zeros, ks, ns, scales):
        pts = []
        for z in zeros:
            for k in ks:
                for sgn in (+1, -1):
                    b = math.radians(z + sgn * k * RAD)
                    for sc in scales:
                        for n in ns:
                            pts.append((n * sc * math.sin(b), n * sc * math.cos(b)))
        return np.unique(np.round(np.array(pts), 6), axis=0)

    ints = list(range(0, 7))
    halfk = [0.5 * i for i in range(0, 13)]
    nint = list(range(1, 13))
    nhalf = [0.5 * i for i in range(1, 25)]
    fams = {
        'A attacker-narrowest: zero magN, k 1..6, n int, 6.4': ([decl], list(range(1, 7)), nint, [6.4]),
        'B zero magN, k 0..6, n int, 6.4': ([decl], ints, nint, [6.4]),
        'C zeros magN/trueN, k 0..6, n int, 6.4': ([decl, 0.0], ints, nint, [6.4]),
        'D zeros magN/trueN/magE/trueE, k 0..6, n int, 6.4': ([decl, 0.0, decl + 90, 90.0], ints, nint, [6.4]),
        'E as D + half-inch n + scale 7.0': ([decl, 0.0, decl + 90, 90.0], ints, nhalf, [6.4, 7.0]),
        'F as E + half-step k': ([decl, 0.0, decl + 90, 90.0], halfk, nhalf, [6.4, 7.0]),
    }
    rng = np.random.default_rng(326)
    res = []
    for sset_name, sids in (('4 sites', site_ids), ('6 sites (+Vallejo phone, Chronicle)', site_ids_wide)):
        real = np.array([enu_flat(S[s]) for s in sids])
        radii = np.hypot(real[:, 0], real[:, 1])
        ang = np.arctan2(real[:, 0], real[:, 1])
        # null U: uniform by area in 10-35 mi (attacker's null), independent sites
        r_u = np.sqrt(rng.uniform(10 ** 2, 35 ** 2, size=(trials, len(sids))))
        t_u = rng.uniform(0, 2 * math.pi, size=(trials, len(sids)))
        null_u = np.stack([r_u * np.sin(t_u), r_u * np.cos(t_u)], -1)
        # null R: rigid rotation of the real constellation + common radial factor in [0.8, 1.25]
        rot = rng.uniform(0, 2 * math.pi, size=(trials, 1))
        fac = np.exp(rng.uniform(math.log(0.8), math.log(1.25), size=(trials, 1)))
        null_r = np.stack([fac * radii[None, :] * np.sin(ang[None, :] + rot), fac * radii[None, :] * np.cos(ang[None, :] + rot)], -1)
        for fname, (zeros, ks, ns, scs) in fams.items():
            P = grid(zeros, ks, ns, scs)
            dobs_all = np.sqrt(((real[:, None, :] - P[None, :, :]) ** 2).sum(-1))
            dobs = dobs_all.min()
            which = np.unravel_index(np.argmin(dobs_all), dobs_all.shape)
            row = dict(sites=sset_name, family=fname, grid_points=int(len(P)), observed_min_mi=float(dobs),
                       observed_site=sids[which[0]])
            for nname, X in (('uniform annulus', null_u), ('rotated real constellation', null_r)):
                best = np.full(trials, 1e9)
                for s in range(len(sids)):
                    for c0 in range(0, trials, 2000):
                        Y = X[c0:c0 + 2000, s, :]
                        d = np.sqrt(((Y[:, None, :] - P[None, :, :]) ** 2).sum(-1)).min(axis=1)
                        best[c0:c0 + 2000] = np.minimum(best[c0:c0 + 2000], d)
                row[nname] = {'p_le_obs': float((best <= dobs).mean()),
                              'p_le_0.25': float((best <= 0.25).mean()),
                              'p_le_0.5': float((best <= 0.5).mean())}
            res.append(row)
            print('3. %-38s %-55s pts %5d obs %.3f mi (%s) | U: p<=obs %.4f p<=.25 %.4f p<=.5 %.4f | R: p<=obs %.4f p<=.25 %.4f p<=.5 %.4f' % (
                sset_name, fname, len(P), dobs, row['observed_site'],
                row['uniform annulus']['p_le_obs'], row['uniform annulus']['p_le_0.25'], row['uniform annulus']['p_le_0.5'],
                row['rotated real constellation']['p_le_obs'], row['rotated real constellation']['p_le_0.25'],
                row['rotated real constellation']['p_le_0.5']))
    out['gridhit_wide'] = res

    # ---------------------------------------------------- 4. Foxon's own convention
    geo = g['georeference']['zkf']
    ps = g['paper_scale']['calibrations']
    reach = {}
    x0, y0 = g['constants']['picks']['zkf']['MTD']
    xl, xr, yt, yb = g['constants']['neat']['zkf']
    for cname, c in ps.items():
        ppi = c['px_per_paper_inch']
        reach[cname] = dict(west=(x0 - xl) / ppi, east=(xr - x0) / ppi, north=(y0 - yt) / ppi, south=(yb - y0) / ppi)
    out['paper_reach_in'] = reach
    print('4. paper reach from the summit (in):', json.dumps(reach))
    fox = []
    map_up_true = geo['map_up_true_bearing_deg']
    for (r_in, th) in ((12.0, 3.0), (3.0, 0.0)):
        for axis_name, axis_true in (('true E', 90.0), ('mag E', 90.0 + decl), ('map-right (printed sheet)', 90.0 + map_up_true)):
            # counter-clockwise from the polar axis = bearing decreases
            brg = (axis_true - th * RAD) % 360
            for sc_name, sc in (('6.4', 6.4), ('paper %.2f' % ps['bar_label_6.4']['ground_mi_per_paper_inch'], ps['bar_label_6.4']['ground_mi_per_paper_inch'])):
                d = r_in * sc
                # on-map test in paper coordinates: paper direction cw from map-up = brg - map_up_true
                pd = math.radians(brg - map_up_true)
                ppi = ps['bar_label_6.4']['px_per_paper_inch']
                paper_in = d / ps['bar_label_6.4']['ground_mi_per_paper_inch']
                x = x0 + paper_in * ppi * math.sin(pd)
                y = y0 - paper_in * ppi * math.cos(pd)
                on = xl <= x <= xr and yt <= y <= yb
                fox.append(dict(r_in=r_in, theta_rad=th, axis=axis_name, scale=sc_name, true_bearing=brg, ground_mi=d, on_map=on))
                print('   Foxon (%g in, %g rad) polar axis %-26s ccw, scale %-10s -> bearing %6.1f, %5.1f mi, on mailed map: %s' % (
                    r_in, th, axis_name, sc_name, brg, d, on))
    out['foxon_own_convention'] = fox

    # ---------------------------------------------------- 5. Penn watch face, re-solved
    def enu_s(sid):
        return np.array(enu_flat(S[sid]))
    LB, BRS = enu_s('LB'), enu_s('BRS')
    MTD = np.zeros(2)
    # circle through LB and MTD with LB at 12:00 and BRS on the 9:00 radius (90 deg ccw of 12 seen as a clock)
    best = None
    for a12 in np.arange(0, 360, 0.005):
        u12 = np.array([math.sin(math.radians(a12)), math.cos(math.radians(a12))])
        # centre C = LB - r*u12; MTD on circle: |MTD - C| = r -> |LB - r u12|^2 = r^2 -> r = |LB|^2 / (2 LB.u12)
        den = 2 * LB.dot(u12)
        if den <= 0:
            continue
        r = LB.dot(LB) / den
        Cc = LB - r * u12
        v = BRS - Cc
        brs_clock = ((math.degrees(math.atan2(v[0], v[1])) - a12) % 360) / 30
        err = abs(brs_clock - 9.0)
        if best is None or err < best[0]:
            w = MTD - Cc
            mtd_clock = ((math.degrees(math.atan2(w[0], w[1])) - a12) % 360) / 30
            best = (err, a12, r, mtd_clock)
    err, a12, r, mtd_clock = best
    penn = dict(twelve_true_bearing=a12, radius_mi=r, mtd_clock=mtd_clock,
                mtd_clock_hm='%d:%02d' % (int(mtd_clock), round((mtd_clock % 1) * 60)),
                angle_mtd_to_9oclock_deg=(9.0 - mtd_clock) * 30, vs_one_radian_deg=(9.0 - mtd_clock) * 30 - RAD)
    out['penn_watchface_resolved'] = penn
    print('5. Penn watch face with LB at 12:00 and BRS exactly at 9:00:', json.dumps(penn))

    with open(os.path.join(HERE, 'independent.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('wrote independent.json')


if __name__ == '__main__':
    main()
