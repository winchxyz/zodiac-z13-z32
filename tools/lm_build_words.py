"""Step 3 of the language-model build: word tables.

Inputs : data/lm/raw/count_1w.txt, count_2w.txt  (Peter Norvig, from the Google
         Web 1T corpus; copied verbatim from github.com/norvig/pytudes/data/text
         because norvig.com sits behind a JavaScript bot check)
         data/lm/raw/corpus_words.tsv             (Gutenberg corpus word counts)
         data/lm/raw/gutenberg/*.txt + data/lm/corpus_manifest.tsv (held-out docs)
Outputs: data/lm/words.tsv         WORD<TAB>count     (all A-Z entries of count_1w)
         data/lm/bigrams.tsv       W1<TAB>W2<TAB>count (A-Z or <S>, case-merged)
         data/lm/words_common.tsv  WORD<TAB>count     (curated vocabulary)
         data/lm/words_stats.json  parameters used by tools/lm.js

Usage: python tools/lm_build_words.py
"""
import os, re, json, math, collections, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LM = os.path.join(ROOT, 'data', 'lm')
RAW = os.path.join(LM, 'raw')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.dont_write_bytecode = True  # keep tools/ free of __pycache__
import lm_build_corpus as corp  # noqa: E402

N_TOKENS = 1_024_908_267_229   # Web 1T token count, catalog.ldc.upenn.edu/LDC2006T13
N_SENTENCES = 95_119_665_584   # Web 1T sentence count, same source
TOP_K = 60_000
MIN_GUT = 2                    # min. occurrences in the Gutenberg corpus (len >= 3)
HOLDOUT_MOD, HOLDOUT_OFF = 50, 25
MAXLEN_HIST = 30

ONE = {'A', 'I'}
TWO = set('''AD AH AM AN AS AT AW AX BE BY DO EH GO HA HE HI HM HO IF IN IS IT LO MA ME MR MY
NO OF OH OK ON OR OW OX PA SO TO UH UM UP US WE YE DR ST JR SR TV PM IM ID'''.split())
NO_VOWEL_OK = set('MRS HMM SHH PST TSK BRR NTH CWT'.split())
ROMAN_WORDS = {'I', 'MIX'}
ROMAN_RE = re.compile(r'^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$')

FORCED = '''
ZERO ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE THIRTEEN FOURTEEN FIFTEEN
SIXTEEN SEVENTEEN EIGHTEEN NINETEEN TWENTY THIRTY FORTY FIFTY SIXTY SEVENTY EIGHTY NINETY
HUNDRED HUNDREDS THOUSAND THOUSANDS MILLION BILLION DOZEN HALF QUARTER ONCE TWICE
FIRST SECOND THIRD FOURTH FIFTH SIXTH SEVENTH EIGHTH NINTH TENTH ELEVENTH TWELFTH THIRTEENTH
TWENTIETH THIRTIETH HUNDREDTH THOUSANDTH
NORTH SOUTH EAST WEST NORTHEAST NORTHWEST SOUTHEAST SOUTHWEST NORTHERN SOUTHERN EASTERN WESTERN
NORTHWARD SOUTHWARD EASTWARD WESTWARD LEFT RIGHT UP DOWN ABOVE BELOW UNDER OVER NEAR FAR
MOUNT MOUNTAIN MOUNTAINS PEAK SUMMIT HILL HILLS RIDGE VALLEY CANYON CREEK RIVER LAKE BAY OCEAN
ROAD ROADS STREET AVENUE HIGHWAY FREEWAY ROUTE TRAIL BRIDGE CITY TOWN COUNTY STATE PARK
RADIAN RADIANS DEGREE DEGREES ANGLE ANGLES INCH INCHES FOOT FEET YARD YARDS MILE MILES METER
METERS DISTANCE RADIUS CIRCLE CENTER CENTRE POINT POINTS LINE LINES MAP MAPS COMPASS DIAL
CLOCK BEARING SET ALONG FROM TOWARD TOWARDS
BOMB BOMBS SCHOOL SCHOOLS BUS BUSES CHILDREN CHILD KIDS KILL KILLED KILLING KILLER MURDER
DIABLO DIG DIGGING DUG BURIED BURY BURIAL BUTTON BUTTONS BASEMENT BLAST BLOW BATTERY BATTERIES
WIRE WIRES TRIGGER GAS POLICE COPS PIG PIGS SLAVE SLAVES PARADISE AFTERLIFE CIPHER CODE CODES
NAME NAMES ZODIAC CALIFORNIA FRANCISCO SAN VALLEJO BENICIA NAPA BERKELEY OAKLAND CONCORD MARIN
SACRAMENTO RIVERSIDE HERMAN BERRYESSA PRESIDIO HEIGHTS PHILLIPS CHRONICLE EXAMINER LETTER
IVE YOURE YOUVE YOULL YOUD HES SHES ITS THATS THERES WHATS WHOS LETS DONT DOESNT DIDNT CANT
COULDNT WOULDNT SHOULDNT WONT ISNT ARENT WASNT WERENT HASNT HAVENT HADNT AINT THEYRE THEYVE
THEYLL WEVE OCLOCK
'''.split()

def read_counts(path):
    out = collections.Counter()
    for ln in open(path, encoding='utf-8', errors='replace'):
        p = ln.rstrip('\n').split('\t')
        if len(p) == 2:
            out[p[0]] += int(p[1])
    return out

def is_roman(w):
    return len(w) >= 1 and ROMAN_RE.match(w) is not None

def plausible(w, gut):
    L = len(w)
    if L == 1:
        return w in ONE
    if L == 2:
        return w in TWO
    if is_roman(w) and w not in ROMAN_WORDS:
        return False
    if not re.search('[AEIOUY]', w) and w not in NO_VOWEL_OK:
        return False
    return gut.get(w, 0) >= MIN_GUT

def heldout_tokens():
    import csv
    rows = list(csv.DictReader(open(os.path.join(LM, 'corpus_manifest.tsv'), encoding='utf-8'),
                               delimiter='\t'))
    for i, r in enumerate(rows):
        if i % HOLDOUT_MOD != HOLDOUT_OFF:
            continue
        t = corp.to_ascii_upper(corp.body(open(os.path.join(corp.GDIR, r['pg_id'] + '.txt'),
                                               encoding='utf-8').read()))
        yield [re.sub(r"['’]", '', w) for w in corp.WORD_RE.findall(t)]

def main():
    # ---- words.tsv ------------------------------------------------------------------------
    c1 = collections.Counter()
    for w, c in read_counts(os.path.join(RAW, 'count_1w.txt')).items():
        W = w.upper()
        if re.fullmatch('[A-Z]+', W):
            c1[W] += c
    with open(os.path.join(LM, 'words.tsv'), 'w', encoding='ascii', newline='\n') as f:
        for w, c in sorted(c1.items(), key=lambda kv: (-kv[1], kv[0])):
            f.write(f'{w}\t{c}\n')
    # ---- bigrams.tsv ----------------------------------------------------------------------
    c2 = collections.Counter()
    for ln in open(os.path.join(RAW, 'count_2w.txt'), encoding='utf-8', errors='replace'):
        p = ln.rstrip('\n').split('\t')
        if len(p) != 2:
            continue
        ws = p[0].split(' ')
        if len(ws) != 2:
            continue
        a, b = (x if x == '<S>' else x.upper() for x in ws)
        if not all(x == '<S>' or re.fullmatch('[A-Z]+', x) for x in (a, b)) or b == '<S>':
            continue
        c2[(a, b)] += int(p[1])
    with open(os.path.join(LM, 'bigrams.tsv'), 'w', encoding='ascii', newline='\n') as f:
        for (a, b), c in sorted(c2.items(), key=lambda kv: (-kv[1], kv[0])):
            f.write(f'{a}\t{b}\t{c}\n')
    # ---- words_common.tsv -----------------------------------------------------------------
    gut = read_counts(os.path.join(RAW, 'corpus_words.tsv'))
    ranked = [w for w, _ in sorted(c1.items(), key=lambda kv: (-kv[1], kv[0])) if plausible(w, gut)]
    common = dict((w, c1[w]) for w in ranked[:TOP_K])
    forced_added, forced_missing = [], []
    must = set(FORCED) | ONE | TWO
    # the 400 most frequent Gutenberg words that pass the filter must be present too
    must |= {w for w, _ in gut.most_common(400) if plausible(w, gut)}
    for w in sorted(must):
        if w in common:
            continue
        if w in c1:
            common[w] = c1[w]
            forced_added.append(w)
        else:
            forced_missing.append(w)
    with open(os.path.join(LM, 'words_common.tsv'), 'w', encoding='ascii', newline='\n') as f:
        for w, c in sorted(common.items(), key=lambda kv: (-kv[1], kv[0])):
            f.write(f'{w}\t{c}\n')
    # ---- parameters for the segmentation model --------------------------------------------
    gtot = sum(gut.values())
    params = {}
    for name, V in (('common', common), ('full', c1)):
        oov = collections.Counter()
        moov = 0
        for w, c in gut.items():
            if w not in V:
                moov += c
                oov[min(len(w), MAXLEN_HIST)] += c
        p_oov = moov / gtot
        # length distribution of out-of-vocabulary tokens, add-0.5 smoothed over 1..MAXLEN_HIST
        tot = sum(oov.values()) + 0.5 * MAXLEN_HIST
        plen = [(oov.get(L, 0) + 0.5) / tot for L in range(1, MAXLEN_HIST + 1)]
        params[name] = dict(vocab_size=len(V), vocab_count_sum=sum(V.values()),
                            p_oov=p_oov, oov_len_log10=[math.log10(x) for x in plen])
    # ---- tune the bigram interpolation weight on held-out Gutenberg text -------------------
    # P(w2|w1) = lam*c2(w1,w2)/c1(w1) + (1 - lam*s(w1)) * P1(w2),  s(w1) = sum_w2 c2(w1,w2)/c1(w1)
    # lam = 1 is excluded: it would give zero probability to every unlisted continuation
    # of a word whose listed bigrams already cover its whole count
    lams = [0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.97, 0.98, 0.99]
    for name, V in (('common', common), ('full', c1)):
        csum = params[name]['vocab_count_sum']
        p_oov = params[name]['p_oov']
        s = collections.Counter()
        big = {}
        for (a, b), c in c2.items():
            if b in V and (a == '<S>' or a in V):
                base = N_SENTENCES if a == '<S>' else c1[a]
                big[(a, b)] = c / base
                s[a] += c / base
        # same rescaling as tools/lm.js: listed continuations may not exceed c1(w1)
        for (a, b), r in list(big.items()):
            if s[a] > 1:
                big[(a, b)] = r / s[a]
        for a in list(s):
            if s[a] > 1:
                s[a] = 1.0
        params[name]['histories_rescaled'] = sum(1 for a in s if s[a] >= 1.0)
        tot = {l: 0.0 for l in lams}
        uni = 0.0
        npairs = 0
        for toks in heldout_tokens():
            for a, b in zip(toks, toks[1:]):
                if a not in V or b not in V:
                    continue
                p1 = (1 - p_oov) * V[b] / csum
                pb = big.get((a, b), 0.0)
                for l in lams:
                    tot[l] += math.log10(l * pb + (1 - l * s[a]) * p1)
                uni += math.log10(p1)
                npairs += 1
        best = max(lams, key=lambda l: tot[l])
        params[name].update(bigram_lambda=best, heldout_pairs=npairs,
                            heldout_log10_per_word={str(l): tot[l] / npairs for l in lams},
                            heldout_unigram_log10_per_word=uni / npairs,
                            bigrams_used=len(big))
        print(name, 'lambda', best, {l: round(tot[l] / npairs, 4) for l in lams}, 'unigram',
              round(uni / npairs, 4), flush=True)
    stats = dict(n_tokens=N_TOKENS, n_sentences=N_SENTENCES, words_tsv=len(c1), bigrams_tsv=len(c2),
                 words_common=len(common), top_k=TOP_K, min_gutenberg_count=MIN_GUT,
                 forced_added=forced_added, forced_missing=forced_missing,
                 gutenberg_word_tokens=gtot, params=params)
    with open(os.path.join(LM, 'words_stats.json'), 'w') as f:
        json.dump(stats, f, indent=2)
    print(json.dumps({k: v for k, v in stats.items() if k != 'params'}, indent=1))

if __name__ == '__main__':
    if any(a in ('-h', '--help') for a in sys.argv[1:]):
        print(__doc__)
        sys.exit(0)
    main()
