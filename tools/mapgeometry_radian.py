"""tools/mapgeometry_radian.py - numerical test of the published radian theories, with a look-elsewhere null.

Reads results/mapgeometry/geometry.json (run mapgeometry_core.py first).
Writes results/mapgeometry/radian_tests.json.

Observed coincidences tested:
  O1  Penn: angle at the summit between Blue Rock Springs and the Stine site vs 1 radian.
  O2  Lake Herman Road bearing = 1 radian counter-clockwise of 1970 magnetic north.
  O3  Stine site at 8 o'clock, Blue Rock Springs at 10 o'clock on a magnetic-north clock face.
  O4  Penn's 1981 "watch face" construction (Foxon's account): circle through Mt. Diablo (7:04) and
      Lake Berryessa (12:00); Blue Rock Springs on the 9:00 radius.
  O5  Grinell: 4 radians clockwise from magnetic north vs the Stine bearing.

Null model: the bearing of each site from the summit is random. N1: uniform on the circle.
N2: uniform within the sector the real sites occupy (+-10 deg), i.e. "somewhere in the Bay Area west
of the mountain". The look-elsewhere family is every (site or site pair) x (reference direction) x
(rotation sense) x (target angle) that a searcher could have tried; P = probability that at least one
test in the family comes within the tolerance.

Run: python tools/mapgeometry_radian.py [--trials 200000]
"""
import json
import math
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'results', 'mapgeometry')
RAD = 180 / math.pi


def angdist(a, b):
    """absolute circular difference in degrees, elementwise"""
    d = np.abs((a - b) % 360.0)
    return np.minimum(d, 360.0 - d)


def pair_angles(B):
    """B: (trials, nsites) bearings -> (trials, npairs) angles in [0, 180]"""
    n = B.shape[1]
    out = []
    for i in range(n):
        for j in range(i + 1, n):
            out.append(angdist(B[:, i], B[:, j]))
    return np.stack(out, axis=1)


def family_min_error(B, refs, pair_targets, bearing_targets, clock=False):
    """min error over the family for each trial (degrees). refs: list of reference true bearings."""
    best = np.full(B.shape[0], 1e9)
    if pair_targets:
        P = pair_angles(B)
        for t in pair_targets:
            best = np.minimum(best, np.abs(P - t).min(axis=1))
    if bearing_targets:
        for r in refs:
            rel = (B - r) % 360.0           # cw angle from the reference
            for t in bearing_targets:
                # cw by t, or ccw by t (= cw by 360 - t)
                e = np.minimum(angdist(rel, t), angdist(rel, 360.0 - t))
                best = np.minimum(best, e.min(axis=1))
    return best


def main():
    trials = 200000
    if '--trials' in sys.argv:
        trials = int(sys.argv[sys.argv.index('--trials') + 1])
    with open(os.path.join(OUTDIR, 'geometry.json'), encoding='utf-8') as f:
        g = json.load(f)
    S = g['sites']
    decl = g['constants']['decl_1970_deg']
    map_up = g['georeference']['zkf']['map_up_true_bearing_deg']
    zero_arm = map_up + g['drawn_axes']['zero_arm_cw_of_image_up_deg']
    out = {}

    # ------------------------------------------------ observed values
    def brg(k):
        return S[k]['true_bearing']

    def pair(a, b):
        d = abs(brg(a) - brg(b)) % 360
        return min(d, 360 - d)

    obs = {}
    obs['O1_penn_BRS_STINE_deg'] = pair('BRS', 'STINE')
    obs['O1_penn_LHR_STINE_deg'] = pair('LHR', 'STINE')
    obs['O1_error_vs_1rad_deg'] = obs['O1_penn_BRS_STINE_deg'] - RAD
    obs['O1_error_pct'] = 100 * (obs['O1_penn_BRS_STINE_deg'] / RAD - 1)
    obs['pairs_S4'] = {a + '-' + b: pair(a, b) for i, a in enumerate(['LHR', 'BRS', 'LB', 'STINE'])
                       for b in ['LHR', 'BRS', 'LB', 'STINE'][i + 1:]}
    lhr_ccw = (decl - brg('LHR')) % 360
    obs['O2_LHR_ccw_from_magN_deg'] = lhr_ccw
    obs['O2_error_deg'] = lhr_ccw - RAD
    obs['O2_with_decl'] = {str(d): ((d - brg('LHR')) % 360) / RAD for d in (15.0, 16.0, 16.88, 17.0, 17.5)}
    obs['O2_on_map_frame_rad'] = {
        'magN = map-up + 17 deg (what the Zodiac could draw on this sheet)': ((map_up + 17.0 - brg('LHR')) % 360) / RAD,
        'magN = drawn 0-arm (no rotation)': ((zero_arm - brg('LHR')) % 360) / RAD,
    }
    obs['O2_BRS_ccw_rad'] = ((decl - brg('BRS')) % 360) / RAD
    obs['O3_STINE_clock'] = ((brg('STINE') - decl) % 360) / 30
    obs['O3_BRS_clock'] = ((brg('BRS') - decl) % 360) / 30
    obs['O3_LHR_clock'] = ((brg('LHR') - decl) % 360) / 30
    obs['O5_grinell_4rad_true_bearing'] = (decl + 4 * RAD) % 360
    obs['O5_STINE_minus_4rad_deg'] = brg('STINE') - obs['O5_grinell_4rad_true_bearing']
    obs['O5_RADETICH_minus_4rad_deg'] = brg('RADETICH') - obs['O5_grinell_4rad_true_bearing']

    # O4: watch-face construction
    import mapgeometry_geo as G
    m = g['constants']['summit']

    def enu(k):
        return np.array(G.enu(m['lat'], m['lon'], S[k]['lat'], S[k]['lon']))
    LB, BRS, LHR = enu('LB'), enu('BRS'), enu('LHR')
    MTD = np.array([0.0, 0.0])

    def rot_cw(v, deg):
        t = math.radians(deg)
        # (E, N) vector rotated clockwise (as seen on a north-up map) by deg
        return np.array([v[0] * math.cos(t) + v[1] * math.sin(t), -v[0] * math.sin(t) + v[1] * math.cos(t)])
    th_mtd = (7 + 4 / 60) * 30.0             # 7:04 -> 212 deg cw of 12:00
    D = LB - MTD
    # find unit u (12:00 direction) with r*(u - rot_cw(u, th)) = D
    best = None
    for a in np.arange(0, 360, 0.01):
        u = np.array([math.sin(math.radians(a)), math.cos(math.radians(a))])
        w = u - rot_cw(u, th_mtd)
        r = np.dot(D, w) / np.dot(w, w)
        err = np.linalg.norm(r * w - D)
        if r > 0 and (best is None or err < best[0]):
            best = (err, a, r)
    err, a12, r = best
    u = np.array([math.sin(math.radians(a12)), math.cos(math.radians(a12))])
    Cc = LB - r * u
    def clock_of(P):
        v = P - Cc
        ang = (math.degrees(math.atan2(v[0], v[1])) - a12) % 360
        return ang / 30, np.linalg.norm(v)
    brs_clock, brs_r = clock_of(BRS)
    lhr_clock, lhr_r = clock_of(LHR)
    mtd_clock, _ = clock_of(MTD)
    obs['O4_watchface'] = dict(radius_mi=r, twelve_oclock_true_bearing=a12, centre_enu_mi=Cc.tolist(), solve_err_mi=err,
                               mtd_clock=mtd_clock, BRS_clock=brs_clock, BRS_dist_from_centre_mi=brs_r,
                               LHR_clock=lhr_clock,
                               BRS_angle_from_MTD_radius_deg=((brs_clock - mtd_clock) * 30) % 360,
                               note='12:00 on Lake Berryessa and 7:04 on Mt. Diablo fix the circle; 9:00 - 7:04 = 58 deg '
                                    'by construction, so the test is only whether Blue Rock Springs lies on the 9:00 radius')
    out['observed'] = obs

    # ------------------------------------------------ look-elsewhere Monte Carlo
    rng = np.random.default_rng(20260626)
    site_sets = {
        'S4 (LHR, BRS, LB, STINE)': ['LHR', 'BRS', 'LB', 'STINE'],
        'S7 (+ RADETICH, JOHNS_VERNALIS, BATES)': ['LHR', 'BRS', 'LB', 'STINE', 'RADETICH', 'JOHNS_VERNALIS', 'BATES'],
        'S9 (+ VALLEJO_PHONE, NAPA_PHONE)': ['LHR', 'BRS', 'LB', 'STINE', 'RADETICH', 'JOHNS_VERNALIS', 'BATES', 'VALLEJO_PHONE', 'NAPA_PHONE'],
    }
    refs_sets = {
        'magN only': [decl],
        '4 refs (true N, magN 16.9, map-up, drawn 0-arm)': [0.0, decl, map_up, zero_arm],
        '6 refs (+ magN 15, magN 17.5)': [0.0, decl, map_up, zero_arm, 15.0, 17.5],
    }
    one_rad = [RAD]
    k_rad = [k * RAD for k in range(1, 7)]
    clock = [h * 30.0 for h in range(1, 12)]
    tests = []
    # which families
    fams = [
        ('pairs vs 1 rad', dict(pair_targets=one_rad, bearing_targets=None)),
        ('pairs vs 1, 2, 3 rad', dict(pair_targets=[RAD, 2 * RAD, 3 * RAD], bearing_targets=None)),
        ('single bearings vs k rad (k=1..6), cw or ccw', dict(pair_targets=None, bearing_targets=k_rad)),
        ('pairs vs 1-3 rad + bearings vs k rad', dict(pair_targets=[RAD, 2 * RAD, 3 * RAD], bearing_targets=k_rad)),
        ('bearings vs clock hours', dict(pair_targets=None, bearing_targets=clock)),
        ('everything (pairs 1-3 rad, bearings k rad, clock hours)', dict(pair_targets=[RAD, 2 * RAD, 3 * RAD], bearing_targets=k_rad + clock)),
    ]
    tolerances = [0.05, 0.25, 0.5, 1.0, 2.98]
    mc = []
    for sname, sites in site_sets.items():
        real = np.array([S[k]['true_bearing'] for k in sites])
        lo, hi = None, None
        # sector of the real bearings that are within the Bay Area wedge (all except far sites) +-10 deg
        rb = np.sort(real % 360)
        # smallest arc containing all real bearings
        gaps = np.diff(np.r_[rb, rb[0] + 360])
        gi = int(np.argmax(gaps))
        start = rb[(gi + 1) % len(rb)] - 10
        width = 360 - gaps[gi] + 20
        for null in ('N1 uniform', 'N2 sector'):
            if null == 'N1 uniform':
                B = rng.uniform(0, 360, size=(trials, len(sites)))
            else:
                B = (start + rng.uniform(0, width, size=(trials, len(sites)))) % 360
            for rname, refs in refs_sets.items():
                for fname, fam in fams:
                    if fam['bearing_targets'] is None and rname != 'magN only':
                        continue        # pair families do not depend on the reference
                    e = family_min_error(B, refs, fam['pair_targets'], fam['bearing_targets'])
                    e_obs = family_min_error(real[None, :], refs, fam['pair_targets'], fam['bearing_targets'])[0]
                    n_tests = 0
                    npairs = len(sites) * (len(sites) - 1) // 2
                    if fam['pair_targets']:
                        n_tests += npairs * len(fam['pair_targets'])
                    if fam['bearing_targets']:
                        dirs = set()
                        for t in fam['bearing_targets']:
                            dirs.add(round(t % 360, 6)); dirs.add(round((360 - t) % 360, 6))
                        n_tests += len(sites) * len(refs) * len(dirs)
                    row = dict(sites=sname, null=null, refs=rname if fam['bearing_targets'] else '-', family=fname,
                               n_tests=n_tests, observed_min_error_deg=float(e_obs),
                               p_at_least_as_good_as_observed=float((e <= e_obs).mean()),
                               p_within=dict((str(t), float((e <= t).mean())) for t in tolerances),
                               sector=(float(start), float(width)) if null == 'N2 sector' else None)
                    mc.append(row)
    out['monte_carlo'] = mc
    out['trials'] = trials
    # analytic sanity check: one pair vs 1 rad within 2.98 deg under N1 = 2*2.98/180
    out['analytic_one_pair_within_2.98'] = 2 * 2.98 / 180
    with open(os.path.join(OUTDIR, 'radian_tests.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps(obs, indent=1))
    print('%-40s %-9s %-46s %-55s %6s %8s %8s %8s %8s %8s' % ('sites', 'null', 'refs', 'family', 'ntest', 'obs_err', 'P<=obs', 'P<=0.25', 'P<=1', 'P<=2.98'))
    for r in mc:
        print('%-40s %-9s %-46s %-55s %6d %8.3f %8.4f %8.4f %8.4f %8.4f' % (
            r['sites'][:40], r['null'][:9], r['refs'][:46], r['family'][:55], r['n_tests'], r['observed_min_error_deg'],
            r['p_at_least_as_good_as_observed'], r['p_within']['0.25'], r['p_within']['1.0'], r['p_within']['2.98']))


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
