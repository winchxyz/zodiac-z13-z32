"""tools/nullmodel_windows.py - how many English corpus windows fit Z13 / Z32.

Slides a window of the cipher's length over the letters-only language-model
corpus (data/lm/raw/corpus_letters.txt, one Project Gutenberg document per
line, same cleaning as tools/lm_build_corpus.py) and counts the windows whose
letters are consistent with each transcription variant:

  homophonic ("weak")  positions that carry the same cipher symbol carry the same letter
  simple ("strict")    and positions with different symbols carry different letters
  pinned               (z13.letters_literal) the letter glyphs A E N K M decode to themselves

Windows never cross a document boundary.  Training documents (manifest row
index % 50 != 25) and held-out documents (== 25, excluded from the n-gram
tables) are counted separately.  A window is "word-aligned" when it starts at
the first letter of a word and ends on the last letter of a word (word
boundaries re-derived from the raw text with the corpus build's own regex;
the script checks that the letters agree exactly with corpus_letters.txt).

Also measures how the fit rate depends on the exact positions of the repeats:
fit fractions on the held-out windows for random isomorphs with the same
length and repeat profile as Z13 / Z32 ("scrambled isomorphs").

Usage:
  python tools/nullmodel_windows.py [--out results/nullmodel/windows] [--scrambled 300] [--cache DIR]
Outputs:
  <out>/window_counts.json          all counts and fractions
  <out>/fits_<variant>_<split>.tsv  every fitting string: letters, windows, word-aligned windows, simple-fit flag
  <out>/scrambled_isomorphs.tsv     fit fractions of random same-profile isomorphs (held-out windows)
"""
import argparse, collections, json, os, re, sys, time
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import lm_build_corpus as LBC  # body(), to_ascii_upper(), WORD_RE  (no side effects on import)

MANIFEST = os.path.join(ROOT, 'data', 'lm', 'corpus_manifest.tsv')
LETTERS_TXT = os.path.join(ROOT, 'data', 'lm', 'raw', 'corpus_letters.txt')
GDIR = os.path.join(ROOT, 'data', 'lm', 'raw', 'gutenberg')
VDIR = os.path.join(ROOT, 'data', 'ciphers', 'variants')
SEP = 26


def load_variants():
    v = {}
    for fn in sorted(os.listdir(VDIR)):
        if fn.endswith('.txt'):
            v[fn[:-4]] = open(os.path.join(VDIR, fn), encoding='latin-1').read().strip()
    # derived variants
    v['z32.reversed'] = v['z32.canonical'][::-1]
    return v


def classes_of(text):
    """list of position lists, in order of first appearance; and symbol per class"""
    pos = collections.OrderedDict()
    for i, ch in enumerate(text):
        pos.setdefault(ch, []).append(i)
    return list(pos.values()), list(pos.keys())


def build_cache(cache):
    """Per split: letters uint8 (SEP between documents), word-start and word-end flags."""
    rows = open(MANIFEST, encoding='utf-8').read().split('\n')[1:]
    rows = [r for r in rows if r.strip()]
    ids = [r.split('\t')[1] for r in rows]
    lines = open(LETTERS_TXT, encoding='ascii').read().split('\n')
    lines = [l for l in lines if l]
    assert len(lines) == len(ids), (len(lines), len(ids))
    out = {'train': ([], [], []), 'heldout': ([], [], [])}
    mismatches = 0
    t0 = time.time()
    for k, (pid, letters) in enumerate(zip(ids, lines)):
        split = 'heldout' if k % 50 == 25 else 'train'
        text = open(os.path.join(GDIR, pid + '.txt'), encoding='utf-8').read()
        t = LBC.to_ascii_upper(LBC.body(text))
        words = [re.sub(r"['’]", '', w) for w in LBC.WORD_RE.findall(t)]
        joined = ''.join(words)
        if joined != letters:
            mismatches += 1
            # fall back to no word boundaries for this document (should not happen)
            words = [letters]
            joined = letters
        a = np.frombuffer(joined.encode('ascii'), dtype=np.uint8) - 65
        ws = np.zeros(len(a), dtype=bool)
        we = np.zeros(len(a), dtype=bool)
        lens = np.array([len(w) for w in words], dtype=np.int64)
        starts = np.concatenate([[0], np.cumsum(lens)[:-1]])
        ws[starts] = True
        we[starts + lens - 1] = True
        L, S, E = out[split]
        L.append(a); S.append(ws); E.append(we)
        L.append(np.array([SEP], dtype=np.uint8)); S.append(np.zeros(1, bool)); E.append(np.zeros(1, bool))
        if k % 100 == 0:
            print(f'  cache: {k}/{len(ids)} docs, {time.time() - t0:.0f} s', flush=True)
    os.makedirs(cache, exist_ok=True)
    for split, (L, S, E) in out.items():
        np.save(os.path.join(cache, f'{split}_letters.npy'), np.concatenate(L))
        np.save(os.path.join(cache, f'{split}_wstart.npy'), np.concatenate(S))
        np.save(os.path.join(cache, f'{split}_wend.npy'), np.concatenate(E))
    json.dump({'mismatches': mismatches, 'docs': len(ids)}, open(os.path.join(cache, 'cache_meta.json'), 'w'))
    print(f'  cache built: {mismatches} documents with letter mismatches', flush=True)


def load_split(cache, split):
    a = np.load(os.path.join(cache, f'{split}_letters.npy'))
    s = np.load(os.path.join(cache, f'{split}_wstart.npy'))
    e = np.load(os.path.join(cache, f'{split}_wend.npy'))
    return a, s, e


def fit_candidates(a, L, classes, pins=None):
    """indices i of windows a[i:i+L] that satisfy the equalities (and pins), no separator inside"""
    n = len(a) - L + 1
    mask = None
    for cl in classes:
        for p, q in zip(cl[:-1], cl[1:]):
            m = a[p:p + n] == a[q:q + n]
            mask = m if mask is None else (mask & m)
    if pins:
        for p, letter in pins:
            m = a[p:p + n] == letter
            mask = m if mask is None else (mask & m)
    if mask is None:
        mask = np.ones(n, dtype=bool)
    idx = np.nonzero(mask)[0]
    # drop windows containing a separator
    W = a[idx[:, None] + np.arange(L)[None, :]]
    ok = (W != SEP).all(axis=1)
    return idx[ok], W[ok]


def valid_window_counts(a, s, e, L):
    sep = (a == SEP).astype(np.int64)
    cs = np.concatenate([[0], np.cumsum(sep)])
    n = len(a) - L + 1
    valid = (cs[L:L + n] - cs[:n]) == 0
    aligned = valid & s[:n] & e[L - 1:L - 1 + n]
    return int(valid.sum()), int(aligned.sum())


def simple_ok(W, classes, extra_forbidden=None):
    """rows whose class representatives are pairwise distinct (and avoid forbidden letters)"""
    reps = np.array([cl[0] for cl in classes])
    R = np.sort(W[:, reps], axis=1)
    ok = (np.diff(R, axis=1) != 0).all(axis=1) if R.shape[1] > 1 else np.ones(len(W), bool)
    if extra_forbidden is not None:
        for c in extra_forbidden:
            ok &= ~(W[:, reps] == c).any(axis=1)
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'results', 'nullmodel', 'windows'))
    ap.add_argument('--cache', default=os.path.join(os.environ.get('TEMP', '/tmp'), 'zodiac_nullmodel_cache'))
    ap.add_argument('--scrambled', type=int, default=300, help='random Z32-profile isomorphs (held-out windows)')
    ap.add_argument('--scrambled13', type=int, default=100, help='random Z13-profile isomorphs (training windows)')
    ap.add_argument('--seed', type=int, default=1970)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    if not os.path.exists(os.path.join(a.cache, 'heldout_wend.npy')):
        build_cache(a.cache)
    cmeta = json.load(open(os.path.join(a.cache, 'cache_meta.json')))
    variants = load_variants()
    # pinned variant: canonical string with A E N K M decoding to themselves
    jobs = []
    for vid, text in variants.items():
        classes, syms = classes_of(text)
        jobs.append({'id': vid, 'text': text, 'classes': classes, 'syms': syms, 'pins': None})
    t13 = variants['z13.canonical']
    cl13, sy13 = classes_of(t13)
    pins = []
    for sym in 'AENKM':
        for p in cl13[sy13.index(sym)]:
            pins.append((p, ord(sym) - 65))
    jobs.append({'id': 'z13.letters_literal', 'text': t13, 'classes': cl13, 'syms': sy13, 'pins': pins})
    # isomorph-equivalent variants give identical counts; group them
    def iso(t):
        m = {}
        return ''.join(m.setdefault(c, chr(97 + len(m)) if len(m) < 26 else chr(65 + len(m) - 26)) for c in t)
    report = {'tool': 'tools/nullmodel_windows.py', 'created': time.strftime('%Y-%m-%dT%H:%M:%S'), 'cache_meta': cmeta,
              'definitions': {
                  'windows': 'all windows of the cipher length inside one document (letters only)',
                  'aligned': 'windows that start at a word start and end at a word end',
                  'homophonic': 'equal symbols -> equal letters (weak fit)',
                  'simple': 'homophonic AND different symbols -> different letters (strict fit)',
                  'distinct': 'number of distinct fitting letter strings',
                  'singletons': 'distinct fitting strings seen exactly once (Good-Turing: unseen fitting mass ~ singletons/fits)'},
              'variants': {}}
    splits = {}
    for split in ('train', 'heldout'):
        splits[split] = load_split(a.cache, split)
    for job in jobs:
        L = len(job['text'])
        rec = {'text': job['text'], 'length': L, 'distinct_symbols': len(job['classes']), 'isomorph': iso(job['text']),
               'pinned': bool(job['pins']), 'splits': {}}
        t0 = time.time()
        for split, (arr, ws, we) in splits.items():
            nwin, nal = valid_window_counts(arr, ws, we, L)
            idx, W = fit_candidates(arr, L, job['classes'], job['pins'])
            al = ws[idx] & we[idx + L - 1]
            forb = None
            if job['pins']:
                forb = sorted(set(l for _, l in job['pins']))
                # free classes must avoid the pinned letters in the strict reading
                free = [cl for cl, s in zip(job['classes'], job['syms']) if s not in 'AENKM']
                simp = simple_ok(W, free, forb) if len(W) else np.zeros(0, bool)
            else:
                simp = simple_ok(W, job['classes']) if len(W) else np.zeros(0, bool)
            # 'clean' windows: no run of three identical letters (drops OCR/typesetting junk such as EEEEEEEEEEEEE)
            clean = ~((W[:, :-2] == W[:, 1:-1]) & (W[:, 1:-1] == W[:, 2:])).any(axis=1) if len(W) else np.zeros(0, bool)
            strs = [bytes((W[k] + 65).astype(np.uint8)).decode('ascii') for k in range(len(W))]
            cnt = collections.Counter(strs)
            cnt_al = collections.Counter(s for s, f in zip(strs, al) if f)
            simp_set = set(s for s, f in zip(strs, simp) if f)
            clean_set = set(s for s, f in zip(strs, clean) if f)
            r = {
                'windows': nwin, 'aligned_windows': nal,
                'homophonic': {'fits': int(len(idx)), 'fraction': len(idx) / nwin, 'distinct': len(cnt),
                               'singletons': sum(1 for v in cnt.values() if v == 1),
                               'aligned_fits': int(al.sum()), 'aligned_fraction': float(al.sum()) / nal if nal else None,
                               'aligned_distinct': len(cnt_al),
                               'clean_fits': int(clean.sum()), 'clean_fraction': float(clean.sum()) / nwin,
                               'clean_distinct': len(clean_set),
                               'clean_singletons': sum(1 for s_ in clean_set if cnt[s_] == 1),
                               'clean_aligned_fits': int((clean & al).sum()), 'clean_aligned_fraction': float((clean & al).sum()) / nal if nal else None},
                'simple': {'fits': int(simp.sum()), 'fraction': float(simp.sum()) / nwin,
                           'distinct': len(simp_set),
                           'singletons': sum(1 for s in simp_set if cnt[s] == 1),
                           'aligned_fits': int((simp & al).sum()), 'aligned_fraction': float((simp & al).sum()) / nal if nal else None,
                           'aligned_distinct': len(set(s for s in simp_set if s in cnt_al))},
            }
            # distinct letters among fitting windows (for Z32: how far from a 1:1 key)
            if len(W):
                reps = np.array([cl[0] for cl in job['classes']])
                nd = np.array([len(np.unique(W[k, reps])) for k in range(min(len(W), 50000))])
                r['homophonic']['distinct_letters_over_classes'] = {'mean': float(nd.mean()), 'min': int(nd.min()), 'max': int(nd.max())}
            rec['splits'][split] = r
            fn = os.path.join(a.out, f"fits_{job['id']}_{split}.tsv")
            with open(fn, 'w', encoding='ascii', newline='\n') as f:
                f.write('letters\twindows\taligned_windows\tsimple_fit\tclean\n')
                for s_, c in sorted(cnt.items(), key=lambda x: (-x[1], x[0])):
                    f.write(f'{s_}\t{c}\t{cnt_al.get(s_, 0)}\t{1 if s_ in simp_set else 0}\t{1 if s_ in clean_set else 0}\n')
        rec['seconds'] = round(time.time() - t0, 1)
        report['variants'][job['id']] = rec
        tr, ho = rec['splits']['train'], rec['splits']['heldout']
        print(f"{job['id']:24s} hom train {tr['homophonic']['fits']:>8d}/{tr['windows']} = {tr['homophonic']['fraction']:.3e}"
              f" heldout {ho['homophonic']['fraction']:.3e} | simple train {tr['simple']['fraction']:.3e} heldout {ho['simple']['fraction']:.3e}"
              f" | aligned hom {tr['homophonic']['aligned_fraction']:.3e} simple {tr['simple']['aligned_fraction']:.3e} ({rec['seconds']} s)", flush=True)
        json.dump(report, open(os.path.join(a.out, 'window_counts.json'), 'w'), indent=1)

    # scrambled isomorphs: same length and repeat profile, random positions (held-out windows)
    rng = np.random.default_rng(a.seed)
    rows = []
    # Z13 fits are rare (~1e-6): use the training windows; Z32 fits are common: held-out windows suffice
    for name, base, split, ntr in (('z13', variants['z13.canonical'], 'train', a.scrambled13), ('z32', variants['z32.canonical'], 'heldout', a.scrambled)):
        arr, ws, we = splits[split]
        L = len(base)
        cl, _ = classes_of(base)
        sizes = sorted([len(c) for c in cl], reverse=True)
        nwin, _ = valid_window_counts(arr, ws, we, L)
        for t in range(ntr + 1):
            if t == 0:
                classes = cl  # the real isomorph first
            else:
                perm = rng.permutation(L)
                classes, k = [], 0
                for sz in sizes:
                    classes.append(sorted(perm[k:k + sz].tolist())); k += sz
            idx, W = fit_candidates(arr, L, classes)
            simp = simple_ok(W, classes) if len(W) else np.zeros(0, bool)
            clean = ~((W[:, :-2] == W[:, 1:-1]) & (W[:, 1:-1] == W[:, 2:])).any(axis=1) if len(W) else np.zeros(0, bool)
            rows.append({'cipher': name, 'split': split, 'trial': t, 'real': t == 0, 'classes': [c for c in classes if len(c) > 1],
                         'hom_fraction': float(clean.sum()) / nwin, 'simple_fraction': float(simp.sum()) / nwin})
            if t % 20 == 0:
                print(f'  scrambled {name}: {t}/{ntr}', flush=True)
    with open(os.path.join(a.out, 'scrambled_isomorphs.tsv'), 'w', newline='\n') as f:
        f.write('cipher\tsplit\ttrial\treal\trepeat_classes\thom_clean_fraction\tsimple_fraction\n')
        for r in rows:
            f.write(f"{r['cipher']}\t{r['split']}\t{r['trial']}\t{int(r['real'])}\t{json.dumps(r['classes'])}\t{r['hom_fraction']:.6e}\t{r['simple_fraction']:.6e}\n")
    summ = {}
    for name in ('z13', 'z32'):
        rr = [r for r in rows if r['cipher'] == name]
        real = rr[0]
        sc = rr[1:]
        for key in ('hom_fraction', 'simple_fraction'):
            vals = np.array([r[key] for r in sc])
            summ[f'{name}_{key}'] = {'real': real[key], 'scrambled_median': float(np.median(vals)),
                                     'scrambled_p05': float(np.quantile(vals, 0.05)), 'scrambled_p95': float(np.quantile(vals, 0.95)),
                                     'fraction_scrambled_ge_real': float((vals >= real[key]).mean()), 'n': len(vals)}
    report['scrambled_isomorphs'] = summ
    json.dump(report, open(os.path.join(a.out, 'window_counts.json'), 'w'), indent=1)
    print(json.dumps(summ, indent=1))


if __name__ == '__main__':
    main()
