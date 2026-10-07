"""
tools/key_analysis.py - statistics on the Z408 and Z340 keys for research/keys_methods.md.

  python tools/key_analysis.py [--perms N] [--seed S]

Reads data/ciphers/{z408,z340,z13,z32}.json.  Prints only symbols, letters, counts and
statistics (no plaintext runs).

Sections:
  1. homophones per letter in each key, against English letter frequency
  2. sequential (cyclic) use of homophones, observed vs shuffled baseline
  3. symbols shared by Z408 and Z340: letters, agreements, permutation test
  4. Z13 and Z32 decoded symbol by symbol with each key
  5. unicity-distance arithmetic for Z13, Z32, Z408, Z340
  6. encoding-error rates and what they imply for 13 and 32 symbols
"""
import argparse
import collections
import json
import math
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLS = 17
# English letter frequencies (%), the commonly cited table (e.g. Wikipedia "Letter frequency").
EN = {'E': 12.70, 'T': 9.06, 'A': 8.17, 'O': 7.51, 'I': 6.97, 'N': 6.75, 'S': 6.33, 'H': 6.09, 'R': 5.99,
      'D': 4.25, 'L': 4.03, 'C': 2.78, 'U': 2.76, 'M': 2.41, 'W': 2.36, 'F': 2.23, 'G': 2.02, 'Y': 1.97,
      'P': 1.93, 'B': 1.49, 'V': 0.98, 'K': 0.77, 'J': 0.15, 'X': 0.15, 'Q': 0.10, 'Z': 0.07}


def load(name):
    with open(os.path.join(ROOT, 'data', 'ciphers', name), encoding='utf-8') as fh:
        return json.load(fh)


def rank(a):
    a = np.asarray(a, dtype=float)
    order = a.argsort()
    r = np.empty(len(a))
    r[order] = np.arange(len(a))
    # average ties
    for v in np.unique(a):
        idx = np.where(a == v)[0]
        r[idx] = r[idx].mean()
    return r


def spearman(x, y):
    rx, ry = rank(x), rank(y)
    return float(np.corrcoef(rx, ry)[0, 1])


# ------------------------------------------------------------ 1. homophones

def homophone_table(name, ct_order, key):
    letters = [key[c] for c in ct_order]
    lc = collections.Counter(letters)
    syms = collections.defaultdict(set)
    for c in ct_order:
        syms[key[c]].add(c)
    print('\n[%s] homophones per letter (letter: n_symbols / occurrences / occurrences per symbol)' % name)
    row = []
    for L in sorted(syms, key=lambda l: (-len(syms[l]), -lc[l])):
        row.append('%s:%d/%d/%.1f' % (L, len(syms[L]), lc[L], lc[L] / len(syms[L])))
    print('  ' + ' '.join(row))
    ls = sorted(syms)
    print('  Spearman(n_symbols, English frequency) = %.2f over %d letters' % (spearman([len(syms[l]) for l in ls], [EN[l] for l in ls]), len(ls)))
    print('  Spearman(n_symbols, letter count in this plaintext) = %.2f' % spearman([len(syms[l]) for l in ls], [lc[l] for l in ls]))
    per = [lc[l] / len(syms[l]) for l in ls]
    print('  occurrences per symbol: mean %.2f, sd %.2f, min %.1f, max %.1f (flatness: lower sd = flatter)' % (np.mean(per), np.std(per), min(per), max(per)))
    missing = [l for l in EN if l not in syms]
    print('  letters with no symbol: %s' % ''.join(sorted(missing)))
    return syms


# --------------------------------------------------------------- 2. cycles

def cycle_stats(seqs):
    """seqs: {letter: [symbols in plaintext order]} for letters with >= 2 homophones.
    Returns (follow, transitions) where follow counts s[i+1] == next-in-cycle(s[i]),
    the cycle being the order of first appearance."""
    follow = trans = 0
    for seq in seqs.values():
        order = []
        for s in seq:
            if s not in order:
                order.append(s)
        if len(order) < 2:
            continue
        nxt = {order[i]: order[(i + 1) % len(order)] for i in range(len(order))}
        for a, b in zip(seq, seq[1:]):
            trans += 1
            follow += (b == nxt[a])
    return follow, trans


def cycles(name, text_in_plain_order, key, rng, perms, label):
    seqs = collections.defaultdict(list)
    for c in text_in_plain_order:
        seqs[key[c]].append(c)
    seqs = {l: s for l, s in seqs.items() if len(set(s)) >= 2}
    f, t = cycle_stats(seqs)
    base = np.empty(perms)
    arrs = {l: np.array(s) for l, s in seqs.items()}
    for i in range(perms):
        sh = {l: list(rng.permutation(a)) for l, a in arrs.items()}
        base[i] = cycle_stats(sh)[0]
    p = (np.sum(base >= f) + 1) / (perms + 1)
    print('  [%s, %s] cycle-following transitions %d/%d = %.3f; shuffled mean %.1f (%.3f), sd %.1f; z = %.1f; p = %.2g'
          % (name, label, f, t, f / t, base.mean(), base.mean() / t, base.std(), (f - base.mean()) / base.std(), p))
    return seqs


def per_letter_cycles(name, seqs):
    out = []
    for l in sorted(seqs, key=lambda x: -len(seqs[x])):
        f, t = cycle_stats({l: seqs[l]})
        order = []
        for s in seqs[l]:
            if s not in order:
                order.append(s)
        out.append('%s[%s] %d/%d' % (l, ''.join(order), f, t))
    print('  [%s] per letter (cycle in first-use order, following/transitions): %s' % (name, '  '.join(out)))


def row_repeats(name, ct):
    zero = 0
    for r in range(len(ct) // COLS):
        row = ct[r * COLS:(r + 1) * COLS]
        if len(set(row)) == COLS:
            zero += 1
    print('  [%s] rows with no repeated symbol: %d of %d' % (name, zero, len(ct) // COLS))
    return zero


# --------------------------------------------------------------- 3. overlap

def overlap(k408, k340, c408, c340, rng, perms):
    shared = sorted(set(k408) & set(k340), key=lambda s: (k408[s], s))
    print('\n[overlap] symbols in both Z408 and Z340 (strict ASCII identity): %d (Z408 has %d, Z340 has %d)' % (len(shared), len(k408), len(k340)))
    rows = []
    for s in shared:
        rows.append('%s %s/%s%s (%d/%d)' % (s, k408[s], k340[s], ' =' if k408[s] == k340[s] else '', c408[s], c340[s]))
    for i in range(0, len(rows), 6):
        print('  ' + ' | '.join(rows[i:i + 6]))
    a = np.array([k408[s] for s in shared])
    b = np.array([k340[s] for s in shared])
    obs = int(np.sum(a == b))
    agree = [s for s in shared if k408[s] == k340[s]]
    print('  agreements: %d of %d: %s' % (obs, len(shared), ' '.join('%s=%s' % (s, k408[s]) for s in agree)))
    ca, cb = collections.Counter(a), collections.Counter(b)
    expected = sum(ca[l] * cb[l] for l in ca) / len(shared)
    # Null 1: shuffle the Z340 letters among the shared symbols (keeps both letter multisets).
    sims = np.empty(perms, dtype=int)
    for i in range(perms):
        sims[i] = np.sum(a == rng.permutation(b))
    p1 = (np.sum(sims >= obs) + 1) / (perms + 1)
    # Null 2: each shared symbol gets the letter of a random Z340 symbol (Z340 key distribution).
    allb = np.array(list(k340.values()))
    sims2 = np.empty(perms, dtype=int)
    for i in range(perms):
        sims2[i] = np.sum(a == rng.choice(allb, size=len(shared), replace=True))
    p2 = (np.sum(sims2 >= obs) + 1) / (perms + 1)
    print('  expected agreements under shuffle: %.2f (simulated mean %.2f, sd %.2f); one-sided p = %.3f (%d permutations)' % (expected, sims.mean(), sims.std(), p1, perms))
    print('  null 2 (random Z340-key letters): mean %.2f, sd %.2f; one-sided p = %.3f' % (sims2.mean(), sims2.std(), p2))
    # Occurrence-weighted agreement: fraction of Z408 text positions (shared symbols) whose Z340 letter agrees.
    w = sum(c408[s] for s in agree) / sum(c408[s] for s in shared)
    print('  occurrence-weighted: %.1f%% of Z408 occurrences of shared symbols carry the same letter in Z340' % (100 * w))
    # Letter-shaped glyphs decoding to their own letter.
    for name, k in (('Z408', k408), ('Z340', k340)):
        caps = [s for s in k if 'A' <= s <= 'Z']
        same = [s for s in caps if k[s] == s]
        print('  [%s] capital-letter glyphs that decode to their own letter: %d of %d (%s); chance about %.1f' % (name, len(same), len(caps), ''.join(same), len(caps) / 26))
    return shared, obs, expected, p1, p2


# ---------------------------------------------------------- 4. Z13 and Z32

def decode_short(name, ct, k408, k340, rows):
    d408 = ''.join(k408.get(c, '?') for c in ct)
    d340 = ''.join(k340.get(c, '?') for c in ct)
    print('\n[%s] %s  (%d symbols, %d distinct)' % (name, ct, len(ct), len(set(ct))))
    print('  Z408 key: %s   (%d of %d positions covered)' % (d408, sum(c in k408 for c in ct), len(ct)))
    print('  Z340 key: %s   (%d of %d positions covered)' % (d340, sum(c in k340 for c in ct), len(ct)))
    seen = []
    for i, c in enumerate(ct):
        if c in seen:
            continue
        seen.append(c)
        pos = [j for j, x in enumerate(ct) if x == c]
        rows.append((name, c, pos, k408.get(c, '-'), k340.get(c, '-')))
    both = [c for c in set(ct) if c in k408 and c in k340]
    agree = [c for c in both if k408[c] == k340[c]]
    print('  distinct symbols in both keys: %d; same letter in both keys: %d (%s)' % (len(both), len(agree), ' '.join('%s=%s' % (c, k408[c]) for c in sorted(agree))))
    return d408, d340


# -------------------------------------------------------------- 5. unicity

def unicity():
    print('\n[unicity] U = H(K) / D, D = log2(26) - H_L (bits per letter)')
    lg26 = math.log2(26)
    cases = [('Z13', 13, 8), ('Z32', 32, 29), ('Z408', 408, 54), ('Z340', 340, 63)]
    # 1.0-1.5: long running English (Shannon 1951; HAC); 2.0-3.0: short texts, where the first
    # letters carry more information (Shannon's F1=4.14, F2=3.56, F3=3.3 bits).
    for HL in (1.0, 1.5, 2.0, 2.5, 3.0):
        D = lg26 - HL
        parts = []
        for name, n, s in cases:
            hom = s * lg26
            simple = math.log2(math.factorial(26) / math.factorial(26 - s)) if s <= 26 else float('nan')
            parts.append('%s: homophonic %.0f bits -> U=%.0f; simple %s' % (
                name, hom, hom / D, ('%.0f bits -> U=%.0f' % (simple, simple / D)) if s <= 26 else 'n/a (>26 symbols)'))
        print('  H_L=%.1f (D=%.2f): %s' % (HL, D, ' | '.join(parts)))
    print('  simple substitution, full 26-letter key: H(K)=log2(26!)=%.1f bits -> U=%.0f/%.0f/%.0f letters for D=3.7/3.2/2.7' % (
        math.log2(math.factorial(26)), math.log2(math.factorial(26)) / 3.7, math.log2(math.factorial(26)) / 3.2, math.log2(math.factorial(26)) / 2.7))


def near_repeats(name, s, key, maxd=4):
    """Same symbol at distance 1..maxd, and 5-symbol windows holding one symbol 3 times
    (the Z13 pattern 0K0M0)."""
    dist = collections.Counter()
    lets = collections.Counter()
    for d in range(1, maxd + 1):
        for i in range(len(s) - d):
            if s[i] == s[i + d]:
                dist[d] += 1
                lets[key[s[i]]] += 1
    tri = sum(1 for i in range(len(s) - 4) for k in collections.Counter(s[i:i + 5]).values() if k >= 3)
    hom = collections.Counter(key.values())
    print('  [%s] same symbol at distance 1..%d: %s; letters (n homophones): %s; 5-windows with one symbol 3x: %d' % (
        name, maxd, dict(sorted(dist.items())), ' '.join('%s%d(%d)' % (l, n, hom[l]) for l, n in lets.most_common()), tri))


def error_rates(z408, z340):
    """Encoding-error rates of the solved ciphers and what they imply for Z13 and Z32."""
    e408 = len(z408['encoding_slips'])
    e340 = len(z340['encoding_errors'])
    n408, n340 = 390, 340  # Z408 without the unexplained 18-symbol tail
    pooled = (e408 + e340) / (n408 + n340)
    print('\n[errors] wrong-symbol rate: Z408 %d/%d = %.2f%%, Z340 %d/%d = %.2f%%, pooled %.2f%%' % (
        e408, n408, 100 * e408 / n408, e340, n340, 100 * e340 / n340, 100 * pooled))
    for name, n in (('Z13', 13), ('Z32', 32)):
        p0 = (1 - pooled) ** n
        print('  %s: expected wrong symbols %.2f; P(at least one) = %.0f%%' % (name, n * pooled, 100 * (1 - p0)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--perms', type=int, default=20000)
    ap.add_argument('--seed', type=int, default=1969)
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)
    z408, z340, z13, z32 = load('z408.json'), load('z340.json'), load('z13.json'), load('z32.json')
    k408, k340 = z408['key'], z340['key']
    c408 = collections.Counter(z408['ascii'])
    c340 = collections.Counter(z340['ascii'])
    read340 = ''.join(z340['ascii'][i] for i in z340['read_order'])

    homophone_table('Z408', z408['ascii'], k408)
    homophone_table('Z340', read340, k340)

    print('\n[cycles] fraction of consecutive uses of a letter that follow its homophone cycle (letters with >= 2 symbols)')
    s408 = cycles('Z408', z408['ascii'], k408, rng, a.perms, 'all 408, written = plaintext order')
    cycles('Z408', z408['ascii'][:390], k408, rng, a.perms, 'first 390 (without the 18-symbol tail)')
    for part, (lo, hi) in enumerate(((0, 136), (136, 272), (272, 408)), 1):
        cycles('Z408', z408['ascii'][lo:hi], k408, rng, a.perms // 4, 'part %d only' % part)
    s340 = cycles('Z340', read340, k340, rng, a.perms, 'reading (plaintext) order')
    cycles('Z340', z340['ascii'], k340, rng, a.perms, 'written (transposed) order')
    cycles('Z340', read340[:153], k340, rng, a.perms // 4, 'section 1 reading order')
    cycles('Z340', read340[153:306], k340, rng, a.perms // 4, 'section 2 reading order')
    per_letter_cycles('Z408', s408)
    per_letter_cycles('Z340 reading order', s340)
    row_repeats('Z408 written', z408['ascii'])
    row_repeats('Z340 written', z340['ascii'])
    row_repeats('Z340 reading order', read340)
    near_repeats('Z408 written', z408['ascii'], k408)
    near_repeats('Z340 written', z340['ascii'], k340)
    near_repeats('Z340 reading order', read340, k340)

    overlap(k408, k340, c408, c340, rng, a.perms * 5)

    rows = []
    decode_short('Z13', z13['ascii'], k408, k340, rows)
    decode_short('Z32', z32['ascii'], k408, k340, rows)
    print('\n[short-cipher symbol table] cipher symbol positions Z408-letter Z340-letter')
    for name, c, pos, l1, l2 in rows:
        print('  %s %s %s %s %s' % (name, c, ','.join(map(str, pos)), l1, l2))

    unicity()
    error_rates(z408, z340)


if __name__ == '__main__':
    main()
