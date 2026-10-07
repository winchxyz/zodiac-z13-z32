"""results/mapgeometry/review/rerun.py - reviewer's reproduction of the mapgeometry pipeline.

Runs the attacker's own modules (tools/mapgeometry_core, _radian, _gridhit) unchanged, but with
OUTDIR redirected to results/mapgeometry/review/ so the attacker's outputs are not overwritten.
Then diffs the key numbers against the attacker's files.

Run: python results/mapgeometry/review/rerun.py [core|radian|gridhit|all] [--trials N]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
ORIG = os.path.join(ROOT, 'results', 'mapgeometry')


def run(which, trials):
    if which in ('core', 'all'):
        import mapgeometry_core as C
        C.OUTDIR = HERE
        C.main()
    if which in ('radian', 'all'):
        import mapgeometry_radian as R
        R.OUTDIR = HERE
        sys.argv = [sys.argv[0], '--trials', str(trials)]
        R.main()
    if which in ('gridhit', 'all'):
        import mapgeometry_gridhit as H
        H.OUTDIR = HERE
        sys.argv = [sys.argv[0], '--trials', str(trials)]
        H.main()


def load(d, name):
    with open(os.path.join(d, name), encoding='utf-8') as f:
        return json.load(f)


def compare():
    out = []
    a, b = load(ORIG, 'geometry.json'), load(HERE, 'geometry.json')
    for s in ('zkf', 'exemplar'):
        for k in ('px_per_ground_mile', 'true_north_cw_of_map_up_deg', 'rms_mi'):
            out.append(('georef.%s.%s' % (s, k), a['georeference'][s][k], b['georeference'][s][k]))
    for k in ('zero_arm_cw_of_image_up_deg', 'three_arm_cw_of_image_right_deg', 'zero_arm_bootstrap_sd_deg'):
        out.append(('axes.' + k, a['drawn_axes'][k], b['drawn_axes'][k]))
    for sid in a['sites']:
        for k in ('ground_mi', 'true_bearing', 'rad_ccw_from_magN', 'paper_inches_bar_label_6.4'):
            out.append(('site.%s.%s' % (sid, k), a['sites'][sid][k], b['sites'][sid][k]))
    for i, (ca, cb) in enumerate(zip(a['claims'], b['claims'])):
        out.append(('claim.%s.%s.lat' % (ca['claim'], ca['convention']), ca['lat'], cb['lat']))
    if os.path.exists(os.path.join(HERE, 'radian_tests.json')):
        ra, rb = load(ORIG, 'radian_tests.json'), load(HERE, 'radian_tests.json')
        for x, y in zip(ra['monte_carlo'], rb['monte_carlo']):
            out.append(('mc.%s|%s|%s|%s' % (x['sites'][:3], x['null'][:2], x['refs'][:8], x['family'][:30]),
                        x['p_at_least_as_good_as_observed'], y['p_at_least_as_good_as_observed']))
    if os.path.exists(os.path.join(HERE, 'gridhit.json')):
        ga, gb = load(ORIG, 'gridhit.json'), load(HERE, 'gridhit.json')
        for x, y in zip(ga['families'], gb['families']):
            out.append(('grid.' + x['family'], x['p_at_least_as_close'], y['p_at_least_as_close']))
    worst = 0.0
    for name, x, y in out:
        d = abs(x - y)
        worst = max(worst, d)
        flag = '' if d < 1e-9 else '  <-- differs'
        print('%-70s %14.6f %14.6f%s' % (name[:70], x, y, flag))
    print('max abs difference: %.3g over %d numbers' % (worst, len(out)))


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    trials = 20000
    if '--trials' in sys.argv:
        trials = int(sys.argv[sys.argv.index('--trials') + 1])
    if which != 'compare':
        run(which, trials)
    compare()
