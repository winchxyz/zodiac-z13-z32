"""Step 2 of the language-model build: letter n-gram tables (orders 1..6).

Input : data/lm/raw/corpus_letters.txt  (one document per line, A-Z only)
Output: data/lm/ngram{1,2,3,4,5}.bin   dense little-endian Float32, 26^n entries
        data/lm/ngram6.keys.bin         sorted little-endian Uint32 6-gram indices
        data/lm/ngram6.vals.bin         little-endian Float32, value for each key
        data/lm/ngram6.gamma.bin        dense Float32, 26^5 entries: log10 backoff
                                        weight of each 5-letter history
        data/lm/ngram_stats.json        counts, discounts, held-out evaluation

Index of an n-gram c_0..c_{n-1} (A=0..Z=25) is sum c_i * 26^(n-1-i).

Every stored value is a JOINT log10 probability log10 P(c_0..c_{n-1}), built
by the chain rule from interpolated modified absolute discounting
(Ney, Essen & Kneser 1994; three discounts D1, D2, D3+ as in Chen & Goodman
1998), recursively interpolated down to the uniform distribution:

  P_1(c)   = (C(c) + 1) / (N + 26)
  P_k(c|h) = (C(hc) - D_k(C(hc))) / C(h.) + gamma_k(h) * P_{k-1}(c | h[1:])
  gamma_k(h) = (D1*N1(h.) + D2*N2(h.) + D3*N3+(h.)) / C(h.)
  P_k(c|h) = P_{k-1}(c | h[1:])            if C(h.) == 0
  J_k(h c) = J_{k-1}(h) + log10 P_k(c|h)

Hence the tables are chain-consistent: the conditional log10 P_k(c|h) equals
J_k(hc) - J_{k-1}(h) exactly, and the 26^k values of every dense table sum
to 1.  For order 6 the n-grams seen at least KEEP6 times are stored
(default KEEP6 = 1, i.e. every 6-gram seen in training; with KEEP6 = 2 or 3
the mass of the pruned ones is folded into gamma_6 so every 6-gram history
still sums to exactly 1).  Any 6-gram g = h c (h = first five letters) that is not
stored has

  J_6(g) = J_5(h) + G6(h) + J_5(g[1:6]) - J_4(g[1:5])

with G6 = ngram6.gamma.bin (log10 gamma_6, or 0 when h was never seen).

A held-out set (every 50th document, offset 25) is excluded from training and
used for the evaluation numbers in ngram_stats.json.

Usage: python tools/lm_build_ngrams.py
"""
import os, json, time
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LM = os.environ.get('LM_OUT', os.path.join(ROOT, 'data', 'lm'))
RAW = os.path.join(ROOT, 'data', 'lm', 'raw')
CORPUS = os.environ.get('LM_CORPUS', os.path.join(RAW, 'corpus_letters.txt'))
KEEP6 = int(os.environ.get('KEEP6', '1'))
HOLDOUT_MOD, HOLDOUT_OFF = 50, 25
SEP = 26

def load_docs():
    train, held = [], []
    with open(CORPUS, 'rb') as f:
        for i, line in enumerate(f):
            a = np.frombuffer(line.rstrip(b'\r\n'), dtype=np.uint8)
            if a.size == 0:
                continue
            (held if i % HOLDOUT_MOD == HOLDOUT_OFF else train).append(a)
    return train, held

def stream(docs):
    parts = []
    sep = np.array([SEP + 65], dtype=np.uint8)
    for d in docs:
        parts.append(d)
        parts.append(sep)
    s = np.concatenate(parts).astype(np.int64) - 65
    assert s.min() >= 0 and s.max() <= SEP
    return s

def window_codes(s, n):
    """Return (codes, valid) for all windows of length n of stream s."""
    m = s.size - n + 1
    code = np.zeros(m, dtype=np.int64)
    valid = np.ones(m, dtype=bool)
    for k in range(n):
        ch = s[k:k + m]
        valid &= ch < SEP
        code = code * 26 + np.minimum(ch, 25)
    return code, valid

def discounts(counts):
    n1 = int((counts == 1).sum()); n2 = int((counts == 2).sum())
    n3 = int((counts == 3).sum()); n4 = int((counts == 4).sum())
    if min(n1, n2, n3, n4) < 50:
        # too few rare n-grams to estimate discounts (orders 1-2 on a big corpus);
        # any small discount is harmless there because almost every count is huge
        return dict(n1=n1, n2=n2, n3=n3, n4=n4, D1=0.5, D2=0.5, D3=0.5, discount_rule='fixed 0.5 (too few rare n-grams)')
    Y = n1 / (n1 + 2 * n2)
    D1 = min(max(1 - 2 * Y * n2 / n1, 0.05), 0.95)
    D2 = min(max(2 - 3 * Y * n3 / n2, 0.1), 1.9)
    D3 = min(max(3 - 4 * Y * n4 / n3, 0.1), 2.9)
    return dict(n1=n1, n2=n2, n3=n3, n4=n4, D1=D1, D2=D2, D3=D3, discount_rule='Chen-Goodman count-of-counts, clamped')

def main():
    t0 = time.time()
    train, held = load_docs()
    s = stream(train)
    N = int((s < SEP).sum())
    stats = dict(train_docs=len(train), heldout_docs=len(held), train_letters=N,
                 heldout_letters=int(sum(d.size for d in held)), keep6=KEEP6, orders={})
    print(f'train letters {N:,} in {len(train)} docs; held-out {stats["heldout_letters"]:,}', flush=True)

    # order 1
    c1 = np.bincount(s[s < SEP], minlength=26).astype(np.float64)
    J = {1: np.log10((c1 + 1) / (N + 26))}
    J[1].astype('<f4').tofile(os.path.join(LM, 'ngram1.bin'))
    cond = {1: J[1].copy()}  # cond[k]: dense log10 P_k(c|h), shape 26^k
    stats['orders'][1] = dict(distinct=int((c1 > 0).sum()), smoothing='add-one')
    stats['letter_freq'] = {chr(65 + i): float(c1[i] / N) for i in range(26)}

    for n in range(2, 7):
        code, valid = window_codes(s, n)
        code = code[valid]
        size = 26 ** n
        C = np.bincount(code, minlength=size)
        del code, valid
        total = int(C.sum())
        nz = int(np.count_nonzero(C))
        d = discounts(C)
        D1, D2, D3 = d['D1'], d['D2'], d['D3']
        C2 = C.reshape(26 ** (n - 1), 26)
        Ch = C2.sum(axis=1).astype(np.float64)
        N1 = (C2 == 1).sum(axis=1).astype(np.float64)
        N2 = (C2 == 2).sum(axis=1).astype(np.float64)
        N3 = (C2 >= 3).sum(axis=1).astype(np.float64)
        seen_h = Ch > 0
        safeCh = np.where(seen_h, Ch, 1.0)
        info = dict(windows=total, distinct=nz, possible=size, **d)
        if n < 6:
            gamma = np.where(seen_h, (D1 * N1 + D2 * N2 + D3 * N3) / safeCh, 1.0)
            Dm = np.where(C2 == 0, 0.0, np.where(C2 == 1, D1, np.where(C2 == 2, D2, D3)))
            low = np.tile(10.0 ** cond[n - 1].reshape(26 ** (n - 2) if n > 2 else 1, 26), (26, 1))
            P = (C2 - Dm) / safeCh[:, None] + gamma[:, None] * low
            P = np.where(seen_h[:, None], P, low)
            rowsum = P.sum(axis=1)
            info['max_row_sum_error'] = float(np.abs(rowsum - 1).max())
            cond[n] = np.log10(P).reshape(-1)
            J[n] = np.repeat(J[n - 1], 26) + cond[n]
            info['table_sum'] = float((10.0 ** J[n].astype(np.float64)).sum())
            J[n].astype('<f4').tofile(os.path.join(LM, f'ngram{n}.bin'))
            del C, C2, Dm, low, P
        else:
            # order 6: sparse.  Pruned counts (< KEEP6) move their mass to gamma.
            Cflat = C
            keep = np.flatnonzero(Cflat >= KEEP6)
            # mass removed from the explicit part of each history by pruning
            pruned_mass = np.zeros(26 ** 5)
            for c_val, D in ((1, D1), (2, D2)):
                if KEEP6 > c_val:
                    pruned_mass += (C2 == c_val).sum(axis=1) * (c_val - D)
            if KEEP6 > 3:
                raise SystemExit('KEEP6 > 3 not supported')
            gamma = np.where(seen_h, (D1 * N1 + D2 * N2 + D3 * N3 + pruned_mass) / safeCh, 1.0)
            G6 = np.log10(gamma)
            c = Cflat[keep].astype(np.float64)
            h = keep // 26
            Dk = np.where(c == 1, D1, np.where(c == 2, D2, D3))
            low = 10.0 ** (cond[5][keep % 26 ** 5].astype(np.float64))  # P_5(c | h[1:])
            P = (c - Dk) / Ch[h] + gamma[h] * low
            vals = J[5][h] + np.log10(P)
            keys = keep.astype('<u4')
            keys.tofile(os.path.join(LM, 'ngram6.keys.bin'))
            vals.astype('<f4').tofile(os.path.join(LM, 'ngram6.vals.bin'))
            G6.astype('<f4').tofile(os.path.join(LM, 'ngram6.gamma.bin'))
            info.update(stored=int(keep.size), floor_constant=float(np.log10(0.01 / total)),
                        min_stored=float(vals.min()), max_stored=float(vals.max()))
            # exact normalisation check on a sample of histories (vectorised lookup)
            rng = np.random.default_rng(1)
            hs = rng.choice(np.flatnonzero(seen_h), 5000, replace=False)
            g = (hs[:, None] * 26 + np.arange(26)[None, :]).reshape(-1)
            pos = np.minimum(np.searchsorted(keys, g), keys.size - 1)
            hit = keys[pos] == g
            v = np.where(hit, vals[pos],
                         J[5][g // 26] + G6[g // 26] + J[5][g % 26 ** 5] - J[4][(g // 26) % 26 ** 4])
            rs = (10.0 ** (v.reshape(-1, 26) - J[5][hs][:, None])).sum(axis=1)
            info['max_row_sum_error_sample5000'] = float(np.abs(rs - 1).max())
            stats['J6_lookup'] = dict(keys=keys, vals=vals, G6=G6)
            del C, C2
        stats['orders'][n] = info
        print(f'order {n}: {info.get("distinct"):,} distinct, D=({D1:.3f},{D2:.3f},{D3:.3f}) '
              f'[{time.time() - t0:.0f}s]', flush=True)

    # ---- evaluation on held-out documents -------------------------------------------------
    lk = stats.pop('J6_lookup')
    keys, vals, G6 = lk['keys'], lk['vals'], lk['G6']

    def j6(codes):
        pos = np.searchsorted(keys, codes)
        pos = np.minimum(pos, keys.size - 1)
        hit = keys[pos] == codes
        out = J[5][codes // 26] + G6[codes // 26] + J[5][codes % 26 ** 5] - J[4][(codes // 26) % 26 ** 4]
        out = np.where(hit, vals[pos], out)
        return out

    def jn(n, codes):
        return j6(codes) if n == 6 else J[n][codes]

    def eval_docs(docs, n):
        """Chain-rule log10 P(text) per char and the window-sum per window."""
        lp = 0.0; L = 0; wsum = 0.0; W = 0
        for d in docs:
            a = d.astype(np.int64) - 65
            if a.size < n:
                continue
            code, _ = window_codes(a, n)
            jv = jn(n, code).astype(np.float64)
            pre = J[n - 1][code[1:] // 26].astype(np.float64)
            lp += jv[0] + (jv[1:] - pre).sum()
            L += a.size
            wsum += jv.sum(); W += jv.size
        return lp / L, wsum / W

    rng = np.random.default_rng(7)
    shuffled = [rng.permutation(d) for d in held]
    uniform = [rng.integers(65, 91, d.size).astype(np.uint8) for d in held]
    ev = {}
    for n in range(2, 7):
        e_pc, e_pw = eval_docs(held, n)
        s_pc, s_pw = eval_docs(shuffled, n)
        u_pc, u_pw = eval_docs(uniform, n)
        ev[n] = dict(heldout_perChar_log10=e_pc, heldout_bits_per_char=-e_pc / np.log10(2),
                     heldout_perWindow=e_pw, shuffled_perChar_log10=s_pc, shuffled_perWindow=s_pw,
                     uniform_random_perChar_log10=u_pc, uniform_random_perWindow=u_pw,
                     english_minus_shuffled_perChar=e_pc - s_pc)
        print(f'n={n}: held-out {e_pc:.4f}/char ({-e_pc / np.log10(2):.3f} bits), shuffled {s_pc:.4f}, '
              f'uniform {u_pc:.4f}', flush=True)
    stats['heldout_eval'] = ev
    stats['build_seconds'] = time.time() - t0
    with open(os.path.join(LM, 'ngram_stats.json'), 'w') as f:
        json.dump(stats, f, indent=2, default=float)

if __name__ == '__main__':
    import sys
    if any(a in ('-h', '--help') for a in sys.argv[1:]):
        print(__doc__)
        sys.exit(0)
    main()
