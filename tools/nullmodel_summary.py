"""tools/nullmodel_summary.py - collect the nullmodel task's outputs into
results/nullmodel/summary.json and print the key tables.

Reads (whatever exists):
  results/nullmodel/windows/window_counts.json      corpus window counts (tools/nullmodel_windows.py)
  results/nullmodel/information.json                bits and expected solutions (tools/nullmodel_info.js)
  results/nullmodel/isomorph_likelihood.json        key-model likelihoods (tools/nullmodel_isolik.js)
  results/nullmodel/solvernull.json                 solver null (tools/nullmodel_solvernull.js)
  results/nullmodel/scrambled_enum.json             dictionary fits of scrambled isomorphs
  results/nullmodel/lengthscan*.json                length scan (tools/nullmodel_lengthscan.js) -> lengthscan_merged.csv
  results/nullmodel/oranchak/*.json                 name / word-tuple reproduction
and the name streams results/nullmodel/oranchak/names_{homophonic,simple}.tsv(.gz) for the
name-posterior calculation (FIRST LAST pattern, SSA/Census weights).

Usage: python tools/nullmodel_summary.py
"""
import collections, glob, gzip, json, math, os, statistics

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
R = os.path.join(ROOT, 'results', 'nullmodel')


def load(p):
    p = os.path.join(R, p)
    return json.load(open(p)) if os.path.exists(p) else None


def name_weights(fn):
    h = collections.Counter()
    for ln in open(os.path.join(ROOT, 'data', 'names', fn), encoding='utf-8'):
        t = ln.rstrip('\n').split('\t')
        if len(t) == 2 and t[0].isalpha():
            h[len(t[0])] += float(t[1])
    return h


def name_posterior(mode, patterns=('FL',)):
    """posterior over fitting FIRST LAST names under the SSA/Census weights"""
    fn = os.path.join(R, 'oranchak', f'names_{mode}.tsv')
    op = gzip.open if not os.path.exists(fn) and os.path.exists(fn + '.gz') else open
    if not os.path.exists(fn) and os.path.exists(fn + '.gz'):
        fn = fn + '.gz'
    if not os.path.exists(fn):
        return None
    WF, WL = name_weights('first_all.tsv'), name_weights('surnames.tsv')
    norm = sum(WF[l] * WL[13 - l] for l in WF if 13 - l in WL)  # P(F L has 13 letters)
    rows = []
    with op(fn, 'rt', encoding='ascii') as f:
        next(f)
        for ln in f:
            t = ln.rstrip('\n').split('\t')
            if t[2] in patterns:
                rows.append((t[0], float(t[1]), t[3]))
    # the same letter string can come from different splits: merge by string
    agg = collections.defaultdict(float)
    label = {}
    for s, w, parts in rows:
        agg[s] += w
        if s not in label or w > 0:
            label.setdefault(s, parts)
    tot = sum(agg.values())
    post = sorted(((w / tot, s) for s, w in agg.items()), reverse=True)
    H = -sum(p * math.log2(p) for p, _ in post if p > 0)
    return {'pattern': list(patterns), 'mode': mode, 'fits': len(rows), 'distinctStrings': len(agg),
            'P_fit_given_13letter_FL_name': tot / norm, 'bitsOfConstraint': -math.log2(tot / norm),
            'posteriorEntropyBits': H, 'effectiveNumberOfNames': 2 ** H,
            'top': [{'name': label[s], 'posterior': p} for p, s in post[:10]]}


def main():
    out = {'created': None}
    import time
    out['created'] = time.strftime('%Y-%m-%dT%H:%M:%S')
    wc = load('windows/window_counts.json')
    info = load('information.json')
    iso = load('isomorph_likelihood.json')
    sn = load('solvernull.json')
    se = load('scrambled_enum.json')

    # ---- 1. corpus windows
    if wc:
        t = {}
        for vid, v in wc['variants'].items():
            tr, ho = v['splits']['train'], v['splits']['heldout']
            t[vid] = {
                'text': v['text'], 'isomorph': v['isomorph'],
                'train_windows': tr['windows'], 'heldout_windows': ho['windows'],
                'hom_clean_train': tr['homophonic']['clean_fits'], 'hom_clean_heldout': ho['homophonic']['clean_fits'],
                'hom_raw_train': tr['homophonic']['fits'],
                'hom_fraction_train': tr['homophonic']['clean_fraction'], 'hom_fraction_heldout': ho['homophonic']['clean_fraction'],
                'hom_one_in': (1 / tr['homophonic']['clean_fraction']) if tr['homophonic']['clean_fraction'] else None,
                'hom_distinct_train': tr['homophonic']['clean_distinct'], 'hom_singletons_train': tr['homophonic']['clean_singletons'],
                'simple_train': tr['simple']['fits'], 'simple_heldout': ho['simple']['fits'],
                'simple_fraction_train': tr['simple']['fraction'],
                'simple_one_in': (1 / tr['simple']['fraction']) if tr['simple']['fraction'] else None,
                'aligned_hom_clean_train': tr['homophonic']['clean_aligned_fits'], 'aligned_windows_train': tr['aligned_windows'],
                'aligned_simple_train': tr['simple']['aligned_fits'],
                'goodTuringUnseenMass_hom': (tr['homophonic']['clean_singletons'] / tr['homophonic']['clean_fits']) if tr['homophonic']['clean_fits'] else None,
                'mean_distinct_letters_over_symbol_classes': tr['homophonic'].get('distinct_letters_over_classes', {}).get('mean'),
            }
        out['corpusWindows'] = t
        out['scrambledIsomorphFitRates'] = wc.get('scrambled_isomorphs')
        print('\n== corpus windows (training, clean = no triple letters)')
        for vid, r in t.items():
            print(f"{vid:22s} hom {r['hom_clean_train']:>6} / {r['train_windows']:.4g} (1 in {r['hom_one_in'] or float('nan'):,.0f}); heldout {r['hom_clean_heldout']}/{r['heldout_windows']}; "
                  f"simple {r['simple_train']} (1 in {r['simple_one_in'] or float('nan'):,.0f}); distinct {r['hom_distinct_train']}, singletons {r['hom_singletons_train']}")

    # ---- 2. information
    if info:
        out['information'] = {}
        for vid, v in info['variants'].items():
            c = v['constraintBits']
            out['information'][vid] = {
                'C_uniform_hom': c['uniform']['homophonic'], 'C_uniform_simple': c['uniform']['simple'],
                'C_iid_hom': c['iid']['homophonic'] if c['iid'] else None, 'C_iid_simple': c['iid']['simple'] if c['iid'] else None,
                'C_corpus_hom': c['corpus']['homophonic'], 'C_corpus_hom_CI95': c['corpus']['homophonicCI95'],
                'C_corpus_simple': c['corpus']['simple'], 'C_corpus_simple_CI95': c['corpus']['simpleCI95'],
                'H_K_hom': v['keyEntropyBits']['homophonic'], 'H_K_simple': v['keyEntropyBits']['simple'],
                'H_L_6gram_any': v['windowEntropyBits']['ngram6_any'], 'H_L_6gram_aligned': v['windowEntropyBits']['ngram6_aligned'],
                'N_hom': {k: (x['value'] if x else None) for k, x in v['expectedSolutions']['homophonic'].items()},
                'N_simple': {k: (x['value'] if x else None) for k, x in v['expectedSolutions']['simple'].items()},
                'conditional': v.get('conditionalEntropy'),
            }
        out['entropy'] = info['entropy']
        out['posterior6gram'] = info.get('posterior')
        print('\n== information (bits)')
        for vid, r in out['information'].items():
            f = lambda x: '-' if x is None else ('inf' if x == float('inf') else f'{x:.1f}')
            nh = r['N_hom']
            print(f"{vid:22s} C hom uni/iid/corpus {f(r['C_uniform_hom'])}/{f(r['C_iid_hom'])}/{f(r['C_corpus_hom'])}  simple {f(r['C_uniform_simple'])}/{f(r['C_iid_simple'])}/{f(r['C_corpus_simple'])}  "
                  f"H6 {r['H_L_6gram_any']:.1f}  N_hom 6g {nh['ngram6_any'] or 0:.3g} 2.2 {nh['rate2_2'] or 0:.3g} 1.3 {nh['rate1_3'] or 0:.3g} 1.0 {nh['rate1_0'] or 0:.3g}")

    # ---- isomorph likelihood
    if iso:
        out['isomorphLikelihood'] = {k: {'profile': v['profileLikelihood'], 'exact': v['exactLikelihood']} for k, v in iso['ciphers'].items()}

    # ---- 3. solver null
    if sn:
        rows = sn['rows']
        S = {}
        for cname in ('z13', 'z32'):
            for mode in ('homophonic', 'simple'):
                rr = [r for r in rows if r['cipherName'] == cname and r['mode'] == mode]
                if not rr:
                    continue
                d = {}
                for st in ('real', 'exact', 'scrambled'):
                    g = [r for r in rr if r['set'] == st]
                    if not g:
                        continue
                    sc = [r['bestScore'] for r in g]
                    e = {'n': len(g), 'bestScore': {'median': statistics.median(sc), 'min': min(sc), 'max': max(sc)},
                         'bestLogp6': {'median': statistics.median([r['bestLogp6'] for r in g])},
                         'bestWordLogp': {'median': statistics.median([r['bestWordLogp'] for r in g])},
                         'englishLike': sum(1 for r in g if r['bestEnglishLike']) / len(g)}
                    if st == 'exact':
                        e['recovered'] = sum(1 for r in g if r['recovered'])
                        e['truthInTop20'] = sum(1 for r in g if r['truthRank'])
                        e['bestBeatsTruth'] = sum(1 for r in g if r['bestBeatsTruth'])
                        e['truthScore'] = {'median': statistics.median([r['truthScore'] for r in g])}
                        e['distinctBestReadings'] = len(set(r['best'] for r in g))
                    if st == 'real':
                        e['rows'] = [{'variant': r['variant'], 'best': r['bestWords'], 'bestScore': r['bestScore'], 'bestLogp6': r['bestLogp6'], 'bestWordLogp': r['bestWordLogp']} for r in g]
                    d[st] = e
                # where the real ciphers fall in the scrambled distribution
                if 'scrambled' in d and 'real' in d:
                    scr = sorted(r['bestScore'] for r in rr if r['set'] == 'scrambled')
                    for x in d['real']['rows']:
                        x['fractionScrambledBestAtLeast'] = sum(1 for v in scr if v >= x['bestScore']) / len(scr)
                S[f'{cname}_{mode}'] = d
        out['solverNull'] = S
        print('\n== solver null')
        for k, d in S.items():
            for st, e in d.items():
                extra = ''
                if st == 'exact':
                    extra = f" recovered {e['recovered']}/{e['n']} truthInTop20 {e['truthInTop20']} bestBeatsTruth {e['bestBeatsTruth']} truth median {e['truthScore']['median']:.2f} distinct best readings {e['distinctBestReadings']}"
                print(f"{k:16s} {st:9s} n={e['n']:2d} best score median {e['bestScore']['median']:.2f} [{e['bestScore']['min']:.2f}, {e['bestScore']['max']:.2f}] english-like {e['englishLike']:.2f}{extra}")
                if st == 'real':
                    for x in e['rows']:
                        print(f"      {x['variant']:22s} {x['best']:40s} {x['bestScore']:.2f} scrambled>=real {x.get('fractionScrambledBestAtLeast')}")
    if se:
        out['scrambledEnumerate'] = se.get('summary')

    # ---- 4. length scan (merge every lengthscan*.json)
    rows = []
    for fn in sorted(glob.glob(os.path.join(R, 'lengthscan*.json'))):
        rows += json.load(open(fn))['rows']
    if rows:
        seen = {}
        for r in rows:
            seen[(r['type'], r['L'], r['i'])] = r
        g = collections.defaultdict(list)
        for r in seen.values():
            g[(r['type'], r['L'])].append(r)
        lines = ['key_type,mode,length,n,recovered,recovery_rate,acc_ge_90,mean_accuracy,median_accuracy,truth_in_top20,other_higher_than_truth,mean_distinct_symbols,mean_multiplicity,restarts,mean_seconds']
        table = []
        for (typ, L), v in sorted(g.items()):
            n = len(v)
            acc = sorted(r['accuracy'] for r in v)
            e = {'type': typ, 'mode': v[0]['mode'], 'L': L, 'n': n, 'recovered': sum(r['recovered'] for r in v),
                 'accGe90': sum(r['accuracy'] >= 0.9 for r in v), 'meanAccuracy': sum(acc) / n, 'medianAccuracy': statistics.median(acc),
                 'truthInTop20': sum(1 for r in v if r['truthRank']), 'otherHigher': sum(1 for r in v if r['otherHigher']),
                 'meanDistinct': sum(r['distinctSymbols'] for r in v) / n, 'meanMultiplicity': sum(r['multiplicity'] for r in v) / n,
                 'restarts': sorted(set(r['restarts'] for r in v)), 'meanSeconds': sum(r['seconds'] for r in v) / n}
            table.append(e)
            lines.append(','.join(str(x) for x in [typ, e['mode'], L, n, e['recovered'], f"{e['recovered'] / n:.3f}", e['accGe90'], f"{e['meanAccuracy']:.3f}",
                                                   f"{e['medianAccuracy']:.3f}", e['truthInTop20'], e['otherHigher'], f"{e['meanDistinct']:.1f}", f"{e['meanMultiplicity']:.3f}",
                                                   '/'.join(map(str, e['restarts'])), f"{e['meanSeconds']:.1f}"]))
        lines.append('# Z13: length 13, 8 distinct symbols (multiplicity 0.615); Z32: length 32, 29 distinct symbols (multiplicity 0.906)')
        open(os.path.join(R, 'lengthscan_merged.csv'), 'w', newline='\n').write('\n'.join(lines) + '\n')
        out['lengthScan'] = table
        print('\n== length scan')
        print('\n'.join(lines))

    # ---- 5. Oranchak reproduction
    orr = {}
    for fn in sorted(glob.glob(os.path.join(R, 'oranchak', 'tuples_*.json'))):
        d = json.load(open(fn))
        orr[os.path.basename(fn)[7:-5]] = {'words': d['wordList']['wordsUpToL'], 'wordsRead': d['wordList']['wordsRead'],
                                            'results': [{k: r[k] for k in ('mode', 'k', 'tuples', 'distinctStrings', 'candidateTuplesOfLengthL', 'fitRate')} for r in d['results']]}
    nr = load('oranchak/name_rates.json')
    out['oranchak'] = {'tuples': orr, 'nameRates': nr,
                       'namePosterior': [x for x in (name_posterior('homophonic'), name_posterior('simple')) if x]}
    print('\n== Oranchak reproduction: word tuples')
    for k, d in orr.items():
        for r in d['results']:
            print(f"{k:14s} ({d['words']:>6} words) {r['mode']:10s} k={r['k']}: {r['tuples']:>10} tuples, {r['distinctStrings']:>10} strings, rate {r['fitRate']:.3e}")
    for p in out['oranchak']['namePosterior']:
        print(f"names FL {p['mode']}: {p['fits']} fits, P(fit | 13-letter FL name) = {p['P_fit_given_13letter_FL_name']:.3e} ({p['bitsOfConstraint']:.1f} bits), "
              f"posterior entropy {p['posteriorEntropyBits']:.1f} bits (effective {p['effectiveNumberOfNames']:.0f} names); top {p['top'][0]}")
    json.dump(out, open(os.path.join(R, 'summary.json'), 'w'), indent=1)
    print('\nwrote results/nullmodel/summary.json')


if __name__ == '__main__':
    main()
