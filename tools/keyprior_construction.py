"""tools/keyprior_construction.py - did Zodiac build his keys by a rule that predicts letters for new symbols?

Tests on the two solved keys (data/ciphers/z408.json, z340.json `key`), each against a permutation null
(the key's letters shuffled among its symbols, which keeps every letter's homophone count):

  1. glyph families: do symbols of one visual family (defined a priori from the README glyph table)
     share a letter more often than chance?  pairs within a family with the same letter;
  2. letter glyph and its mirror image (B/b, C/c, ...): same letter more often than chance?
  3. letter-shaped glyphs decoding to their own letter, or to a letter at a fixed alphabet offset
     (a shifted-alphabet construction): the count of the most common offset;
  4. glyph class and letter frequency: do normal capital-letter glyphs carry more frequent letters?
  5. cross-key consistency for the 47 shared symbols: same letter (exact), same family-level letter,
     correlated English frequency of the assigned letters, vowel/consonant agreement;
  6. first-appearance order: is the order in which symbols first appear in the cipher (written order, and
     reading order for Z340) related to the alphabet position of their letter (key written out A..Z)?
     Null: the same plaintext re-enciphered with the key's letters permuted among symbols is not
     available without the encipherment rule, so we use the permutation null on the key itself
     (symbols keep their first-appearance ranks, letters are shuffled) - this tests the key, given the text.
  7. rules found in BOTH keys are applied to Z13 / Z32 as predictions.

  python tools/keyprior_construction.py --perms 100000 --seed 408340 --out results/keyprior/construction.json
"""
import argparse
import json
import math
import os
import random
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# English letter frequencies (%), from data/lm/meta.json when available
def english_freq():
    try:
        m = json.load(open(os.path.join(ROOT, 'data', 'lm', 'meta.json'), encoding='utf8'))
        f = m['ngrams']['letter_frequencies']
        return {k: float(v) for k, v in f.items()}
    except Exception:
        return None

# Glyph families, fixed in advance from the glyph descriptions in data/ciphers/README.md
FAMILIES = {
    'filled_circle': list('12345'),          # filled circle, open top/bottom/left/right, solid
    'open_circle': list('6()z0'),             # circle with dot, theta, phi, crosshairs, taurus
    'triangle': list('789'),                  # dotted, filled, open triangle
    'square': list('#%*_@'),                  # filled, half-filled (two orientations), open, open with dot
    'serif_I': list('I!:;|'),                 # serifed I, funny I, I with dots, bar
    'strokes': list('/\\-.+^<>='),            # slash, backslash, dash, dot, plus, caret, lt, gt, sideways K
    'perp': list('t['),                       # upside-down T, hooked upside-down T
    'omega': ['?'],
    'P_filled': ['&'],
}
MIRROR_PAIRS = [(u, u.lower()) for u in 'BCDEFJKLPQRY']  # lower case = mirrored letter in this convention ('z','t' excluded)
VOWELS = set('AEIOU')


def family_of(s):
    for f, members in FAMILIES.items():
        if s in members:
            return f
    if s.isupper():
        return 'upper'
    if s.islower():
        return 'mirror'
    return 'other'


def load_key(name):
    return json.load(open(os.path.join(ROOT, 'data', 'ciphers', f'{name}.json'), encoding='utf8'))['key']


def perm_test(stat, key, rng, perms, sym_order=None):
    syms = sym_order or sorted(key)
    lets = [key[s] for s in syms]
    obs = stat(dict(zip(syms, lets)))
    ge = 0
    vals = []
    for _ in range(perms):
        sh = lets[:]
        rng.shuffle(sh)
        v = stat(dict(zip(syms, sh)))
        vals.append(v)
        if v >= obs - 1e-12:
            ge += 1
    mean = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / max(1, len(vals) - 1))
    return {'observed': obs, 'nullMean': mean, 'nullSd': sd, 'p': (ge + 1) / (perms + 1)}


def same_letter_pairs_in_families(key):
    n = 0
    for f, members in FAMILIES.items():
        ms = [m for m in members if m in key]
        for i in range(len(ms)):
            for j in range(i + 1, len(ms)):
                if key[ms[i]] == key[ms[j]]:
                    n += 1
    return n


def family_pairs_list(key):
    out = []
    for f, members in FAMILIES.items():
        ms = [m for m in members if m in key]
        for i in range(len(ms)):
            for j in range(i + 1, len(ms)):
                out.append({'family': f, 'pair': ms[i] + ms[j], 'letters': key[ms[i]] + key[ms[j]], 'same': key[ms[i]] == key[ms[j]]})
    return out


def mirror_same(key):
    return sum(1 for a, b in MIRROR_PAIRS if a in key and b in key and key[a] == key[b])


def own_letter(key):
    return sum(1 for s, l in key.items() if s.isupper() and s == l)


def max_offset(key):
    c = Counter((ord(l) - ord(s)) % 26 for s, l in key.items() if s.isupper())
    return max(c.values()) if c else 0


def upper_freq_minus_rest(key, ef):
    up = [ef[l] for s, l in key.items() if s.isupper()]
    rest = [ef[l] for s, l in key.items() if not s.isupper()]
    return sum(up) / len(up) - sum(rest) / len(rest)


def first_appearance(text):
    seen = []
    for ch in text:
        if ch not in seen:
            seen.append(ch)
    return seen


def spearman(x, y):
    def ranks(v):
        idx = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[idx[j + 1]] == v[idx[i]]:
                j += 1
            for k in range(i, j + 1):
                r[idx[k]] = (i + j) / 2.0
            i = j + 1
        return r
    rx, ry = ranks(x), ranks(y)
    mx, my = sum(rx) / len(rx), sum(ry) / len(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--perms', type=int, default=100000)
    ap.add_argument('--seed', type=int, default=408340)
    ap.add_argument('--out', default='results/keyprior/construction.json')
    a = ap.parse_args()
    rng = random.Random(a.seed)
    ef = english_freq()
    keys = {'z408': load_key('z408'), 'z340': load_key('z340')}
    c408 = json.load(open(os.path.join(ROOT, 'data', 'ciphers', 'z408.json'), encoding='utf8'))
    c340 = json.load(open(os.path.join(ROOT, 'data', 'ciphers', 'z340.json'), encoding='utf8'))
    out = {'tool': 'tools/keyprior_construction.py', 'perms': a.perms, 'seed': a.seed, 'families': FAMILIES, 'perKey': {}, 'crossKey': {}, 'predictions': {}}
    for name, key in keys.items():
        r = {}
        r['familySameLetterPairs'] = perm_test(same_letter_pairs_in_families, key, rng, a.perms)
        r['familyPairs'] = [p for p in family_pairs_list(key) if p['same']]
        r['familyPairsTotal'] = len(family_pairs_list(key))
        r['mirrorPairsSameLetter'] = perm_test(mirror_same, key, rng, a.perms)
        r['mirrorPairsPresent'] = [a_ + b_ + ':' + key[a_] + key[b_] for a_, b_ in MIRROR_PAIRS if a_ in key and b_ in key]
        r['letterGlyphOwnLetter'] = perm_test(own_letter, key, rng, a.perms)
        r['letterGlyphMaxOffsetCount'] = perm_test(max_offset, key, rng, a.perms)
        r['offsetHistogram'] = dict(Counter((ord(l) - ord(s)) % 26 for s, l in key.items() if s.isupper()).most_common(5))
        r['upperGlyphLetterFreqMinusRest'] = perm_test(lambda k: upper_freq_minus_rest(k, ef), key, rng, a.perms)
        # first-appearance order vs alphabet index of the letter
        texts = {'written': c408['ascii'] if name == 'z408' else c340['ascii']}
        if name == 'z340':
            ro = c340['read_order']
            texts['reading'] = ''.join(c340['ascii'][i] for i in ro)
        for tn, tx in texts.items():
            order = first_appearance(tx)
            rank = {s: i for i, s in enumerate(order)}
            syms = [s for s in order if s in key]
            stat = lambda k, syms=syms, rank=rank: spearman([rank[s] for s in syms], [ord(k[s]) for s in syms])
            r[f'firstAppearanceVsAlphabet_{tn}'] = perm_test(stat, key, rng, a.perms // 10, sym_order=syms)
            # absolute version (two-sided): |rho|
            stat_abs = lambda k, syms=syms, rank=rank: abs(spearman([rank[s] for s in syms], [ord(k[s]) for s in syms]))
            r[f'firstAppearanceVsAlphabetAbs_{tn}'] = perm_test(stat_abs, key, rng, a.perms // 10, sym_order=syms)
        out['perKey'][name] = r
    # cross-key, shared symbols
    k1, k2 = keys['z408'], keys['z340']
    shared = sorted(set(k1) & set(k2))
    syms = shared
    l1 = [k1[s] for s in syms]
    l2 = [k2[s] for s in syms]

    def cross_perm(stat, perms):
        obs = stat(l1, l2)
        ge = 0
        vals = []
        for _ in range(perms):
            sh = l2[:]
            rng.shuffle(sh)
            v = stat(l1, sh)
            vals.append(v)
            if v >= obs - 1e-12:
                ge += 1
        mean = sum(vals) / len(vals)
        sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / max(1, len(vals) - 1))
        return {'observed': obs, 'nullMean': mean, 'nullSd': sd, 'p': (ge + 1) / (perms + 1)}

    ck = {'nShared': len(shared)}
    ck['sameLetter'] = cross_perm(lambda x, y: sum(1 for p, q in zip(x, y) if p == q), a.perms)
    ck['sameVowelClass'] = cross_perm(lambda x, y: sum(1 for p, q in zip(x, y) if (p in VOWELS) == (q in VOWELS)), a.perms)
    ck['englishFreqSpearman'] = cross_perm(lambda x, y: spearman([ef[p] for p in x], [ef[q] for q in y]), a.perms // 10)
    ck['alphabetIndexSpearman'] = cross_perm(lambda x, y: spearman([ord(p) for p in x], [ord(q) for q in y]), a.perms // 10)
    ck['shiftMaxCount'] = cross_perm(lambda x, y: max(Counter((ord(q) - ord(p)) % 26 for p, q in zip(x, y)).values()), a.perms)
    ck['shiftHistogramTop'] = dict(Counter((ord(q) - ord(p)) % 26 for p, q in zip(l1, l2)).most_common(5))
    # family-level: within-family same-letter pairs present in BOTH keys
    fam_both = []
    for f, members in FAMILIES.items():
        ms = [m for m in members if m in k1 and m in k2]
        for i in range(len(ms)):
            for j in range(i + 1, len(ms)):
                if k1[ms[i]] == k1[ms[j]] and k2[ms[i]] == k2[ms[j]]:
                    fam_both.append({'family': f, 'pair': ms[i] + ms[j], 'z408': k1[ms[i]], 'z340': k2[ms[i]]})
    ck['familyPairsSameLetterInBothKeys'] = fam_both

    # pairs of symbols (any) that share a letter in BOTH keys: more than chance?
    def both_same_pairs(x, y):
        n = 0
        for i in range(len(x)):
            for j in range(i + 1, len(x)):
                if x[i] == x[j] and y[i] == y[j]:
                    n += 1
        return n
    ck['pairsSameLetterInBothKeys'] = cross_perm(both_same_pairs, a.perms // 10)
    ck['pairsSameLetterInBothKeysList'] = [syms[i] + syms[j] for i in range(len(syms)) for j in range(i + 1, len(syms)) if l1[i] == l1[j] and l2[i] == l2[j]]
    out['crossKey'] = ck

    # predictions for Z13 / Z32 from rules that hold in both keys
    z13 = json.load(open(os.path.join(ROOT, 'data', 'ciphers', 'z13.json'), encoding='utf8'))['ascii']
    z32 = json.load(open(os.path.join(ROOT, 'data', 'ciphers', 'z32.json'), encoding='utf8'))['ascii']
    pred = {}
    for nm, tx in [('z13', z13), ('z32', z32)]:
        syms = sorted(set(tx))
        pred[nm] = {
            'pairsSameLetterInBothKeysPresent': [p for p in ck['pairsSameLetterInBothKeysList'] if p[0] in syms and p[1] in syms],
            'familyMembersPresent': {f: [m for m in ms if m in syms] for f, ms in FAMILIES.items() if sum(1 for m in ms if m in syms) >= 2},
            'mirrorPairsPresent': [x + y for x, y in MIRROR_PAIRS if x in syms and y in syms],
        }
    out['predictions'] = pred
    os.makedirs(os.path.dirname(os.path.join(ROOT, a.out)), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, a.out), 'w', encoding='utf8'), indent=1)

    def fmt(t):
        return f"obs {t['observed']:.3f} null {t['nullMean']:.3f}+-{t['nullSd']:.3f} p={t['p']:.4f}"
    for name, r in out['perKey'].items():
        print(f'== {name}')
        for k, v in r.items():
            if isinstance(v, dict) and 'p' in v:
                print(f'  {k}: {fmt(v)}')
        print('  family pairs with same letter:', [(p['pair'], p['letters']) for p in r['familyPairs']], 'of', r['familyPairsTotal'])
        print('  mirror pairs:', r['mirrorPairsPresent'])
        print('  offset histogram (top):', r['offsetHistogram'])
    print('== cross-key (shared symbols: %d)' % ck['nShared'])
    for k, v in ck.items():
        if isinstance(v, dict) and 'p' in v:
            print(f'  {k}: {fmt(v)}')
    print('  family pairs same letter in both keys:', fam_both)
    print('  any pairs same letter in both keys:', ck['pairsSameLetterInBothKeysList'])
    print('  shift histogram:', ck['shiftHistogramTop'])
    print('== predictions', json.dumps(pred))


if __name__ == '__main__':
    main()
