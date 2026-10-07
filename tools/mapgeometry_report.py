"""tools/mapgeometry_report.py - combine geometry, radian tests and annotations into the task outputs.

Reads results/mapgeometry/{geometry,radian_tests,annotations}.json.
Writes results/mapgeometry/mapgeometry.json (key numbers + tables).
--tables also prints the tables as markdown to stdout.

Run: python tools/mapgeometry_report.py
"""
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'results', 'mapgeometry')
RAD = 180 / math.pi


def load(name):
    with open(os.path.join(OUTDIR, name), encoding='utf-8') as f:
        return json.load(f)


def binom_tail_ge(k, n, p):
    """P(X >= k), X ~ Bin(n, p)"""
    if n == 0:
        return 1.0
    tot = 0.0
    for i in range(k, n + 1):
        tot += math.comb(n, i) * p ** i * (1 - p) ** (n - i)
    return min(1.0, tot)


def is_land(r):
    # land/water from the 1970 map colour, the same rule for grid, claim and null points
    return r.get('map_water') is False


def place_str(r):
    pl = r.get('place') or {}
    if not pl.get('found'):
        return 'water / no address' if r.get('map_water') else 'no address (OSM)'
    bits = [b for b in (pl.get('name') if pl.get('name') and pl.get('name') != pl.get('road') else None,
                        pl.get('road'), pl.get('neighbourhood'), pl.get('town')) if b]
    s = ', '.join(dict.fromkeys(bits))
    if r.get('map_water'):
        s += ' [water on 1970 map]'
    return s


def main():
    geo = load('geometry.json')
    rad = load('radian_tests.json')
    ann = load('annotations.json')
    sites = geo['sites']
    out = {}

    # ------------------------------------------------ school and site coincidence rates
    groups = {}
    for key, r in ann.items():
        typ = key.split('|')[0]
        grp = 'null' if typ == 'null' else ('claim' if typ == 'claim' else 'grid:' + key.split('|')[1])
        groups.setdefault(grp, []).append(r)
    rates = {}
    null_land = [r for r in groups.get('null', []) if is_land(r) and r.get('schools') is not None]
    for grp, rs in sorted(groups.items()):
        annotated = [r for r in rs if r.get('schools') is not None]
        land = [r for r in annotated if is_land(r)]
        row = dict(points=len(rs), annotated=len(annotated), land=len(land))
        for rr in (0.25, 0.5):
            hits = sum(1 for r in land if any(s['dist_mi'] <= rr for s in r['schools']))
            row['school_within_%.2fmi' % rr] = hits
            row['frac_school_within_%.2fmi' % rr] = hits / len(land) if land else None
        for rr in (0.5, 1.0):
            row['site_within_%.1fmi' % rr] = sum(1 for r in rs if r['nearest_zodiac_site_mi'] <= rr)
            row['frac_site_within_%.1fmi' % rr] = row['site_within_%.1fmi' % rr] / len(rs) if rs else None
        rates[grp] = row
    base = rates.get('null', {})
    for grp, row in rates.items():
        if grp == 'null' or not base.get('land'):
            continue
        for rr in (0.25, 0.5):
            p0 = base['frac_school_within_%.2fmi' % rr]
            row['p_value_school_%.2f_vs_null' % rr] = binom_tail_ge(row['school_within_%.2fmi' % rr], row['land'], p0) if p0 is not None else None
        for rr in (0.5, 1.0):
            p0 = max(base['frac_site_within_%.1fmi' % rr], 1.0 / (2 * base['points']))
            row['p_value_site_%.1f_vs_null' % rr] = binom_tail_ge(row['site_within_%.1fmi' % rr], row['points'], p0)
    out['coincidence_rates'] = rates

    # ------------------------------------------------ tables
    lines = []
    lines.append('# Generated tables (tools/mapgeometry_report.py)\n')
    lines.append('All schools, roads and place names are 2026 OpenStreetMap data (Nominatim) and Wikipedia; '
                 '"water" is read from the colour of the 1970 map scan itself.\n')
    lines.append('## Sites: bearings and distances from the summit\n')
    lines.append('| site | ground mi | true brg | mag brg 1970 | clock (mag) | rad cw magN | rad ccw magN | paper brg from map-up | in @6.4 (solver) | paper in (bar 6.4) | paper in (ruler) | on mailed map |')
    lines.append('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for sid, s in sites.items():
        lines.append('| %s | %.2f | %.2f | %.2f | %.2f | %.3f | %.3f | %.2f | %.2f | %.2f | %.2f | %s |' % (
            sid, s['ground_mi'], s['true_bearing'], s['mag_bearing_1970'], s['clock_hours_cw_from_magN'], s['rad_cw_from_magN'],
            s['rad_ccw_from_magN'], s['paper_bearing_cw_from_map_up'], s['inches_at_label_6p4'],
            s['paper_inches_bar_label_6.4'], s['paper_inches_ruler_photo'], 'yes' if s['on_mailed_map'] else 'no'))
    lines.append('')
    lines.append('## Claimed radian/inch pairs\n')
    lines.append('| claim | convention | lat | lon | ground mi | true brg | on map | nearest Zodiac site (mi) | what is there | nearest school (mi) |')
    lines.append('|---|---|---|---|---|---|---|---|---|---|')
    claim_rows = []
    for c in geo['claims']:
        a = ann.get('claim|%s|%s' % (c['claim'], c['convention']), {})
        ns = a.get('nearest_school')
        row = dict(claim=c['claim'], text=c['text'], convention=c['convention'], lat=c['lat'], lon=c['lon'],
                   ground_mi=c['ground_mi'], true_bearing=c['true_bearing'], on_map=c['on_mailed_map'],
                   nearest_zodiac_site=a.get('nearest_zodiac_site'), nearest_zodiac_site_mi=a.get('nearest_zodiac_site_mi'),
                   place=place_str(a) if a else None, nearest_school=ns)
        claim_rows.append(row)
        lines.append('| %s | %s | %.5f | %.5f | %.1f | %.1f | %s | %s (%.2f) | %s | %s |' % (
            c['claim'], c['convention'], c['lat'], c['lon'], c['ground_mi'], c['true_bearing'], 'yes' if c['on_mailed_map'] else 'no',
            a.get('nearest_zodiac_site'), a.get('nearest_zodiac_site_mi', float('nan')), place_str(a) if a else '-',
            ('%s (%.2f)' % (ns['name'], ns['dist_mi'])) if ns else '-'))
    out['claims'] = claim_rows
    lines.append('')
    for cname in ('map_magN17_cw', 'map_magN17_ccw', 'map_trueN_magN_cw', 'geo_magN_cw_6p4'):
        lines.append('## Grid points on the mailed map: %s\n' % cname)
        lines.append(geo['conventions'][cname]['desc'] + '\n')
        lines.append('| k rad | n in | lat | lon | ground mi | what is there | school <=0.25 mi | nearest school (mi) | nearest Zodiac site (mi) |')
        lines.append('|---|---|---|---|---|---|---|---|---|')
        rows = []
        for p in geo['grid'][cname]:
            if not p['on_mailed_map']:
                continue
            a = ann.get('grid|%s|%.2f|%.2f' % (cname, p['k_rad'], p['n_in']), {})
            ns = a.get('nearest_school')
            flag_s = a.get('school_within_0.25mi')
            row = dict(k=p['k_rad'], n=p['n_in'], lat=p['lat'], lon=p['lon'], ground_mi=p['ground_mi'],
                       place=place_str(a) if a else None, school_025=flag_s, nearest_school=ns,
                       nearest_zodiac_site=a.get('nearest_zodiac_site'), nearest_zodiac_site_mi=a.get('nearest_zodiac_site_mi'))
            rows.append(row)
            lines.append('| %.1f | %.1f | %.5f | %.5f | %.1f | %s | %s | %s | %s (%.2f) |' % (
                p['k_rad'], p['n_in'], p['lat'], p['lon'], p['ground_mi'], place_str(a) if a else '-',
                'YES' if flag_s else ('no' if flag_s is not None else '-'),
                ('%s (%.2f)' % (ns['name'], ns['dist_mi'])) if ns else '-',
                a.get('nearest_zodiac_site', '-'), a.get('nearest_zodiac_site_mi', float('nan'))))
        out['grid_' + cname] = rows
        lines.append('')
    lines.append('## Coincidence rates vs the null sample (random points on the mailed map)\n')
    lines.append('| group | points | land | school <=0.25 mi | frac | p vs null | school <=0.5 mi | frac | p vs null | site <=0.5 mi | site <=1 mi | p(site<=1) vs null |')
    lines.append('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for grp, r in rates.items():
        def f(x):
            return '-' if x is None else ('%.3f' % x)
        lines.append('| %s | %d | %d | %d | %s | %s | %d | %s | %s | %d | %d | %s |' % (
            grp, r['points'], r['land'], r['school_within_0.25mi'], f(r['frac_school_within_0.25mi']),
            f(r.get('p_value_school_0.25_vs_null')), r['school_within_0.50mi'], f(r['frac_school_within_0.50mi']),
            f(r.get('p_value_school_0.50_vs_null')), r['site_within_0.5mi'], r['site_within_1.0mi'], f(r.get('p_value_site_1.0_vs_null'))))
    lines.append('')
    lines.append('## Look-elsewhere Monte Carlo (radian_tests.json)\n')
    lines.append('| sites | null | references | family | tests | best observed error (deg) | P(at least as good) | P(<=0.25 deg) | P(<=1 deg) | P(<=2.98 deg) |')
    lines.append('|---|---|---|---|---|---|---|---|---|---|')
    for r in rad['monte_carlo']:
        lines.append('| %s | %s | %s | %s | %d | %.3f | %.4f | %.4f | %.4f | %.4f |' % (
            r['sites'], r['null'], r['refs'], r['family'], r['n_tests'], r['observed_min_error_deg'],
            r['p_at_least_as_good_as_observed'], r['p_within']['0.25'], r['p_within']['1.0'], r['p_within']['2.98']))
    if '--tables' in sys.argv:          # optional human-readable dump to stdout
        print('\n'.join(lines))

    # ------------------------------------------------ key numbers
    gz = geo['georeference']['zkf']
    ge = geo['georeference']['exemplar']
    ps = geo['paper_scale']
    out['key'] = dict(
        true_north_cw_of_map_up_deg=dict(zkf=gz['true_north_cw_of_map_up_deg'], exemplar=ge['true_north_cw_of_map_up_deg'],
                                         loo_zkf=[gz['leave_one_out']['theta_min'], gz['leave_one_out']['theta_max']],
                                         subsets_zkf={k: v['theta_deg'] for k, v in gz['subset_fits'].items()}),
        px_per_ground_mile_zkf=gz['px_per_ground_mile'], georef_rms_mi=dict(zkf=gz['rms_mi'], exemplar=ge['rms_mi']),
        drawn_zero_arm_cw_of_map_up_deg=geo['drawn_axes']['zero_arm_cw_of_image_up_deg'],
        drawn_zero_arm_true_bearing_deg=gz['map_up_true_bearing_deg'] + geo['drawn_axes']['zero_arm_cw_of_image_up_deg'],
        drawn_three_arm_cw_of_map_right_deg=geo['drawn_axes']['three_arm_cw_of_image_right_deg'],
        bar_over_ground=ps['scans']['zkf']['bar_over_ground'],
        neat_width_in_ruler=ps['ruler_photo']['neat_width_in'],
        neat_size_in_bar_label=[ps['calibrations']['bar_label_6.4']['neat_w_in'], ps['calibrations']['bar_label_6.4']['neat_h_in']],
        bar_mi_per_in_from_ruler=ps['calibrations']['ruler_photo']['bar_mi_per_inch'],
        ground_mi_per_paper_inch=dict(bar_label=ps['calibrations']['bar_label_6.4']['ground_mi_per_paper_inch'],
                                      ruler=ps['calibrations']['ruler_photo']['ground_mi_per_paper_inch']),
        radian_observed=rad['observed'])
    with open(os.path.join(OUTDIR, 'mapgeometry.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps(rates, indent=1))
    print('wrote mapgeometry.json')


if __name__ == '__main__':
    main()
