"""
tools/lead_cipherexpert_homophones.py - hostile-expert check of the Z13 / Z340-key reuse lead:
is the way Z13 would have been enciphered under the Z340 key consistent with how Zodiac actually
used that key (and the Z408 key)?

Under the reuse reading (A=D, E=R, N=E, z=A, K=A, M=O) Z13's plaintext has
  D at 0 and 11 (same symbol 'A', distance 11)
  E at 2 and 10 (same symbol 'N', distance 8)
  O at 7 and 12 (same symbol 'M', distance 5)
  A at 3 and 5  (two DIFFERENT symbols 'z' and 'K', distance 2)
plus one new glyph '0' used three times (4, 6, 8) and one new glyph '['.

This script measures, from the solved ciphers in enciphering order (Z340 via read_order,
Z408 written order), P(same symbol | same plaintext letter, distance d) per letter and pooled,
and the probability of the four observed same/different choices under that behaviour and
under uniform homophone choice from the Z340 key.  It also lists the letters the Z340 key lacks
(strict one-symbol-per-letter reuse would need the new glyphs to be those letters).

Only key letters and symbol strings are read; no plaintext is printed (counts only).
Output: results/lead/cipherexpert/homophones.json
"""
import json
import os
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'results', 'lead', 'cipherexpert', 'homophones.json')
LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def load(name):
    with open(os.path.join(ROOT, 'data', 'ciphers', name + '.json'), encoding='utf8') as f:
        return json.load(f)


def seq(name):
    j = load(name)
    s = j['ascii'].replace(' ', '').replace('\n', '')
    key = {k: str(v).upper() for k, v in j['key'].items()}
    ro = j.get('read_order')
    order = ro if ro else list(range(len(s)))
    syms = [s[p] for p in order]
    lets = [key.get(c, '?') for c in syms]
    return syms, lets, key


def homophone_counts(key):
    h = defaultdict(set)
    for s, l in key.items():
        if len(l) == 1 and l in LET:
            h[l].add(s)
    return {l: len(h[l]) for l in LET}


def same_rates(syms, lets, dmax=12):
    by_letter_d = defaultdict(lambda: [0, 0])   # (letter, d) -> [same, total]
    pooled_d = defaultdict(lambda: [0, 0])
    n = len(syms)
    for i in range(n):
        for d in range(1, dmax + 1):
            j = i + d
            if j >= n:
                break
            if lets[i] == '?' or lets[i] != lets[j]:
                continue
            same = 1 if syms[i] == syms[j] else 0
            by_letter_d[(lets[i], d)][0] += same
            by_letter_d[(lets[i], d)][1] += 1
            pooled_d[d][0] += same
            pooled_d[d][1] += 1
    return by_letter_d, pooled_d


def rate(table, keys):
    s = sum(table[k][0] for k in keys)
    t = sum(table[k][1] for k in keys)
    return s, t, (s + 0.5) / (t + 1.0)   # Jeffreys-style smoothing


def main():
    out = {'tool': 'tools/lead_cipherexpert_homophones.py'}
    obs = [  # (letter, distance, observed same?)
        ('D', 11, True), ('E', 8, True), ('O', 5, True), ('A', 2, False)]
    for name in ['z340', 'z408']:
        syms, lets, key = seq(name)
        hc = homophone_counts(key)
        bl, pd = same_rates(syms, lets)
        res = {'homophones': {l: hc[l] for l in 'DEOA'},
               'letters_without_symbol': [l for l in LET if hc[l] == 0],
               'pooled_same_rate_by_distance': {}, 'observed_choices': []}
        for d in range(1, 13):
            s, t, _ = rate(pd, [d])
            res['pooled_same_rate_by_distance'][d] = [s, t, round(s / t, 4) if t else None]
        s_all, t_all, _ = rate(pd, list(range(1, 13)))
        res['pooled_same_rate_d1_12'] = [s_all, t_all, round(s_all / t_all, 4)]
        logp_emp = 0.0
        logp_unif = 0.0
        import math
        for (L, d, same) in obs:
            # letter-specific over a +-3 distance band, to have counts
            band = [x for x in range(max(1, d - 3), min(12, d + 3) + 1)]
            s, t, r = rate(bl, [(L, x) for x in band])
            p_emp = r if same else 1 - r
            h = hc[L] if name == 'z340' else hc[L]
            r_unif = 1.0 / h if h else float('nan')
            p_unif = r_unif if same else 1 - r_unif
            logp_emp += math.log10(p_emp)
            logp_unif += math.log10(p_unif) if p_unif > 0 else float('-inf')
            res['observed_choices'].append({
                'letter': L, 'distance': d, 'observed': 'same symbol' if same else 'different symbols',
                'empirical_same': [s, t], 'empirical_same_rate_smoothed': round(r, 4),
                'p_observed_empirical': round(p_emp, 4), 'homophones_in_key': h,
                'p_observed_uniform_choice': round(p_unif, 4)})
        res['log10_p_pattern_empirical'] = round(logp_emp, 3)
        res['log10_p_pattern_uniform'] = round(logp_unif, 3)
        # monoalphabetic reading (one symbol per letter) cannot produce A twice with two symbols
        res['note'] = ('empirical = Zodiac\'s own same-symbol rate for that letter within +-3 of the distance, '
                       'in enciphering order; a simple-substitution reading has P(same)=1, P(different)=0')
        out[name] = res
    # Z13 under the reuse reading: what a 13-window of Z340 typically looks like
    syms, lets, key = seq('z340')
    dist = Counter()
    for i in range(len(syms) - 12):
        dist[len(set(syms[i:i + 13]))] += 1
    out['z340_13window_distinct_symbols_reading_order'] = dict(sorted(dist.items()))
    j = load('z340')
    w = j['ascii'].replace(' ', '').replace('\n', '')
    dist2 = Counter(len(set(w[i:i + 13])) for i in range(len(w) - 12))
    out['z340_13window_distinct_symbols_written_order'] = dict(sorted(dist2.items()))
    s8, l8, _ = seq('z408')
    dist3 = Counter(len(set(s8[i:i + 13])) for i in range(len(s8) - 12))
    out['z408_13window_distinct_symbols'] = dict(sorted(dist3.items()))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
