"""tools/nullmodel_namecombos.py - how many name combinations of exactly 13 letters
the names search tests, per pattern, so fit counts can be turned into fit RATES
comparable with Oranchak's 2013 figure (213 fits in about half a billion tests).

Tokens: F = first name (data/names/first_all.tsv), M = middle name (same list),
L = surname (data/names/surnames.tsv), I = initial (26 letters).

Usage: python tools/nullmodel_namecombos.py [--length 13] [--names-json results/nullmodel/oranchak/names_homophonic.json ...]
Prints one row per pattern: combinations of total length 13, fits (if a names JSON is given), rate.
"""
import argparse, collections, json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def hist(fn):
    h = collections.Counter()
    for ln in open(os.path.join(ROOT, 'data', 'names', fn), encoding='utf-8'):
        w = ln.split('\t')[0].strip()
        if w.isalpha():
            h[len(w)] += 1
    return h


def combos(pattern, H, L):
    dp = collections.Counter({0: 1})
    for t in pattern:
        nd = collections.Counter()
        for s, c in dp.items():
            for l, n in H[t].items():
                if s + l <= L:
                    nd[s + l] += c * n
        dp = nd
    return dp[L]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--length', type=int, default=13)
    ap.add_argument('--names-json', nargs='*', default=[])
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    F = hist('first_all.tsv')
    S = hist('surnames.tsv')
    H = {'F': F, 'M': F, 'L': S, 'I': collections.Counter({1: 26})}
    out = {'lists': {'first_all': sum(F.values()), 'surnames': sum(S.values())}, 'runs': {}}
    for fn in a.names_json:
        d = json.load(open(fn))
        per = d['counts']['perPattern']
        mode = d.get('options', {}).get('mode') or d.get('mode') or os.path.basename(fn)
        rows = {}
        tot_c = tot_f = 0
        for p, fits in per.items():
            c = combos(p, H, a.length)
            rows[p] = {'combinations': c, 'fits': fits, 'rate': fits / c if c else None}
            tot_c += c; tot_f += fits
        out['runs'][os.path.basename(fn)] = {'complete': d['counts'].get('complete'), 'patterns': rows,
                                             'total': {'combinations': tot_c, 'fits': tot_f, 'rate': tot_f / tot_c if tot_c else None}}
        print(f'{os.path.basename(fn)}: {tot_f} fits in {tot_c:.3e} combinations of {a.length} letters, rate {tot_f / tot_c:.3e} (1 in {tot_c / max(tot_f, 1):,.0f})')
        for p, r in sorted(rows.items(), key=lambda x: -x[1]['fits']):
            print(f"  {p:4s} {r['fits']:>9d} / {r['combinations']:.3e} = {r['rate']:.3e}")
    if a.out:
        json.dump(out, open(a.out, 'w'), indent=1)


if __name__ == '__main__':
    main()
