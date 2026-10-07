"""tools/keyprior_summary.py - collect the keyprior results into results/keyprior/summary.json and print a digest.

  python tools/keyprior_summary.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
R = os.path.join(ROOT, 'results', 'keyprior')


def load(name):
    p = os.path.join(R, name)
    if not os.path.exists(p):
        return None
    with open(p, encoding='utf8') as f:
        return json.load(f)


def fullpin_rows(d):
    out = []
    for r in d['results']:
        if r.get('skipped'):
            out.append({'cipher': r.get('cid'), 'key': r.get('kn'), 'skipped': r['skipped']})
            continue
        t = r.get('test') or {}
        out.append({
            'cipher': r['cipher'], 'key': r['key'], 'nPinned': r['nPinned'], 'nFree': r['nFree'],
            'carriedOver': r['carriedOver'], 'realScore': round(r['real']['score'], 3),
            'realBest': r['real']['best']['plaintext'], 'realBestWords': r['real']['best']['words'],
            'nullN': r['null']['n'], 'nullMean': round(r['null']['summary'].get('mean', float('nan')), 3) if r['null']['n'] else None,
            'nullSd': round(r['null']['summary'].get('sd', float('nan')), 3) if r['null']['n'] else None,
            'nullMax': round(r['null']['summary'].get('max', float('nan')), 3) if r['null']['n'] else None,
            'p': t.get('p'), 'percentile': t.get('percentile'), 'z': t.get('z'),
        })
    return out


def main():
    S = {'task': 'keyprior', 'files': sorted(os.listdir(R))}
    for nm in ['fullpin_z13_permute', 'fullpin_z13_iid', 'fullpin_z13_circles_permute', 'fullpin_z13_permute_word', 'fullpin_z32_permute']:
        d = load(nm + '.json')
        if d:
            S[nm] = {'statistic': d.get('statistic', 'objective'), 'null': d['null'], 'rows': fullpin_rows(d)}
    for nm in ['calib_z340w13_z408key', 'calib_z408w13_z340key', 'calib_z408w13_ownkey', 'calib_z340w13_ownkey', 'calib_z408w32_z340key', 'calib_z408w32_ownkey']:
        d = load(nm + '.json')
        if d:
            S[nm] = {'windows': d['windows'], 'eligible': d['eligibleWindows'], 'null': d['null'], 'pSummary': d['pSummary'], 'minP': min(r['p'] for r in d['rows'])}
    for nm in ['h1_z13', 'h1_z13_word']:
        d = load(nm + '.json')
        if d:
            S[nm] = {k: {'summary': v['summary'], 'observedPlacement': v['observedPlacement']} for k, v in d['sets'].items()}
    for nm in ['condnull_objective', 'condnull_word']:
        d = load(nm + '.json')
        if d:
            S[nm] = {k: {'realLetters': v['realLetters'], 'real': v['real'], 'arrangementP': v['arrangement']['p'], 'arrangementN': v['arrangement']['n'],
                         'condNisE_P': v['conditionalNisE']['p'], 'englishFreqP': v['englishFreq']['p']} for k, v in d['results'].items()}
    enum = {}
    for nm in ['z408', 'z340', 'z408_t2', 'z340_t2']:
        d = load(f'enum_z13_words_pin_{nm}.json')
        if d:
            enum['words_' + nm] = {'consistent': d['counts']['consistentStrings'], 'allVocab': d['counts'].get('noUnknownWords'), 'top': [(t['plaintext'], round(t['wordLogp'], 2), t['words']) for t in d['top'][:5]]}
    for nm in ['z408', 'z340']:
        d = load(f'enum_z13_names_pin_{nm}.json')
        if d:
            enum['names_' + nm] = {'fits': d['counts']['fits'], 'top': [(t.get('plaintext'), t.get('weight')) for t in d['top'][:5]]}
    S['enumerate_full_pins'] = enum
    for nm in ['z13subsets_words_top500k_z340', 'z13subsets_words_top500k_z408', 'z13subsets_words_v1_asymmetricFW']:
        d = load(nm + '.json')
        if d:
            S[nm] = {'fits': d['fits'], 'null': d['null'], 'note': ('v1: per-subset p valid; family-wise p used asymmetric tie handling, superseded' if 'v1' in nm else 'symmetric pooled ranks'),
                     'perKey': {r['key']: {'realLetters': r['realLetters'], 'familywiseAll': {st: v['all'] for st, v in r['familywise'].items()},
                                           'smallestP': [{k2: s2[k2] for k2 in ('subset', 'k', 'realBest', 'realBestFit', 'p')} for s2 in sorted(r['subsets'], key=lambda s: s['p'])[:5]]} for r in d['results']}}
    d = load('z13subsets_words.json')
    if d:
        S['z13subsets_words'] = {'fits': d['fits'], 'thresholds': d['thresholds'], 'null': d['null'],
                                 'perKey': {r['key']: {'realLetters': r['realLetters'], 'familywise': r['familywise'],
                                                       'smallestP': sorted(r['subsets'], key=lambda s: s['p'])[:5]} for r in d['results']}}
    for nm in ['z32subsets_z408', 'z32subsets_z340']:
        d = load(nm + '.json')
        if d:
            S[nm] = {'design': d['design'], 'solver': d['solver'], 'perK': {k: {'realMean': v['real']['mean'], 'realMax': v['real']['max'], 'realBest': v['real']['best']['plaintext'],
                                                                             'nullMean': v['null']['summary']['mean'], 'nullSd': v['null']['summary']['sd'], 'nullMax': v['null']['summary']['max'],
                                                                             'pMean': v['test']['pMean'], 'pMaxOfR': v['test']['pMaxOfR']} for k, v in d['perK'].items()}}
    for nm in ['joint_z13_z32', 'joint_synthetic']:
        d = load(nm + '.json')
        if d:
            S[nm] = {'solver': d['solver'], 'null': d['null'], 'power': d.get('power'),
                     'problems': [{'name': p['name'], 'shared': p['sharedSymbols'], 'indep': p['independent']['score'], 'joint': p['joint']['score'],
                                   'penaltyReal': p['penaltyReal'], 'nullJointMean': p['null']['summary'].get('mean'), 'nullJointSd': p['null']['summary'].get('sd'),
                                   'nullJointMax': p['null']['summary'].get('max'), 'p': p['test']['p'], 'jointA': p['joint']['ptA'], 'jointB': p['joint']['ptB'],
                                   'truthScore': (p.get('truth') or {}).get('score'), 'truthRecovered': p.get('truthRecovered')} for p in d['problems']]}
    d = load('construction.json')
    if d:
        def pk(t):
            return {'observed': t['observed'], 'nullMean': round(t['nullMean'], 3), 'p': t['p']}
        S['construction'] = {
            'perKey': {k: {kk: pk(vv) for kk, vv in v.items() if isinstance(vv, dict) and 'p' in vv} for k, v in d['perKey'].items()},
            'crossKey': {kk: (pk(vv) if isinstance(vv, dict) and 'p' in vv else vv) for kk, vv in d['crossKey'].items()},
            'predictions': d['predictions'],
        }
    with open(os.path.join(R, 'summary.json'), 'w', encoding='utf8') as f:
        json.dump(S, f, indent=1)
    print(json.dumps({k: (v if k in ('enumerate_full_pins',) else '...') for k, v in S.items() if k != 'files'}, indent=1)[:3000])


if __name__ == '__main__':
    main()
