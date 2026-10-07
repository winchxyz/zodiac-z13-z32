"""
tools/lead_cipherexpert_summary.py - collect the cipherexpert checks into
results/lead/cipherexpert/summary.json (numbers copied from the task's own output files).
"""
import json
import os

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'results', 'lead', 'cipherexpert')


def load(f):
    with open(os.path.join(D, f), encoding='utf8') as h:
        return json.load(h)


arr = load('arrange.json')
hom = load('homophones.json')
jk = load('jackknife_canonical.json')
cn = load('condn_canonical.json')
pw = {v: load('arrpower_%s.json' % v)['summary'] for v in ['canonical', 'circles_distinct']}
out = {
    'arrangement_real_rank_of_360': {v: {st: [x['rank'], round(x['p_ge'], 4)] for st, x in arr['variants'][v]['perStat'].items()}
                                     for v in arr['variants']},
    'arrangement_positive_control': {v: {st: {k: round(o[k], 4) for k in ['median', 'fracBest', 'h1TailAtObs', 'tailRatio', 'bandRatio']}
                                         for st, o in s['perStat'].items()} | {'n': s['n']} for v, s in pw.items()},
    'strict_reuse_new_glyphs_JKQXZ': {v: arr['variants'][v]['strictReuse'] for v in arr['variants']},
    'jackknife_canonical_p': {r['freed']: [round(r['pT1'], 4), round(r['pT2'], 4)] for r in jk['rows']},
    'n_equals_e_conditional_null_canonical': {k: v['p'] for k, v in cn['keys'].items()},
    'homophone_pattern_log10p': {k: [hom[k]['log10_p_pattern_empirical'], hom[k]['log10_p_pattern_uniform']] for k in ['z340', 'z408']},
    'thirteen_window_distinct_symbols': {k: hom[k] for k in hom if k.endswith('distinct_symbols') or 'distinct_symbols' in k},
}
with open(os.path.join(D, 'summary.json'), 'w', encoding='utf8') as h:
    json.dump(out, h, indent=1)
print(json.dumps(out, indent=1))
