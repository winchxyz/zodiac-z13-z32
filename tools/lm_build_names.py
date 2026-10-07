"""Build data/names/{first_male,first_female,first_all,surnames}.tsv from

  data/names/raw/dist.male.first, dist.female.first, dist.all.last
      1990 US Census name files (www2.census.gov/topics/genealogy/1990surnames/)
  data/names/raw/names2010.zip -> Names_2010Census.csv
      2010 US Census surnames (www2.census.gov/topics/genealogy/2010surnames/names.zip)
  data/names/raw/ssa_name-counts_jsvine.csv
      SSA national baby-name counts (year,name,sex,count), a verbatim CSV
      concatenation of SSA's names.zip by github.com/jsvine/babynames
      (ssa.gov itself returned HTTP 403 to scripted downloads).

The weighting formula is documented in data/names/README.md (written by this
script too, so code and documentation cannot drift apart).

Usage: python tools/lm_build_names.py
"""
import csv, io, os, re, zipfile, collections, json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
NDIR = os.path.join(ROOT, 'data', 'names')
RAW = os.path.join(NDIR, 'raw')
SSA_Y0, SSA_Y1 = 1900, 1955
W_SSA, W_C90_FIRST = 0.75, 0.25
W_C90_LAST, W_C10_LAST = 2 / 3, 1 / 3
SMOOTH_BELOW = 0.010   # percent; below this the 3-decimal rounding is too coarse
WINDOW = 200           # ranks on each side used for the cumulative-slope estimate

def read_census_1990(path):
    """Return list of (NAME, freq_percent, cum_percent, rank) in rank order and
    a dict NAME -> estimated percent.  Frequencies are printed with 3 decimals,
    so for names under SMOOTH_BELOW percent we estimate the frequency from the
    slope of the cumulative column over +-WINDOW ranks (the cumulative column
    is also rounded to 0.001, but over a 400-rank window the rounding error is
    a few percent instead of up to 100 percent)."""
    rows = []
    for ln in open(path, encoding='ascii'):
        p = ln.split()
        if len(p) != 4:
            continue
        rows.append((p[0], float(p[1]), float(p[2]), int(p[3])))
    n = len(rows)
    est = {}
    for i, (name, f, cum, rank) in enumerate(rows):
        if f >= SMOOTH_BELOW:
            est[name] = f
            continue
        lo = max(0, i - WINDOW)
        hi = min(n - 1, i + WINDOW)
        if hi - lo < 10:
            est[name] = max(f, 0.0005)
            continue
        slope = (rows[hi][2] - rows[lo][2]) / (hi - lo)
        # keep the estimate consistent with the printed rounded value
        est[name] = min(max(slope, f - 0.0005, 1e-6), f + 0.0005)
    return rows, est

def ssa_first(sex):
    counts = collections.Counter()
    total = 0
    with open(os.path.join(RAW, 'ssa_name-counts_jsvine.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            y = int(r['year'])
            if y < SSA_Y0 or y > SSA_Y1 or r['sex'] != sex:
                continue
            c = int(r['count'])
            counts[r['name'].upper()] += c
            total += c
    return counts, total

def write_tsv(path, weights):
    items = sorted(weights.items(), key=lambda kv: (-kv[1], kv[0]))
    with open(path, 'w', encoding='ascii', newline='\n') as f:
        for name, w in items:
            if not re.fullmatch(r'[A-Z]+', name):
                continue
            f.write(f'{name}\t{w:.6e}\n')
    return len(items)

def main():
    stats = {}
    for sex, fname, out in (('M', 'dist.male.first', 'first_male.tsv'),
                            ('F', 'dist.female.first', 'first_female.tsv')):
        ssa, tot = ssa_first(sex)
        _, c90 = read_census_1990(os.path.join(RAW, fname))
        names = set(ssa) | set(c90)
        w = {}
        for n in names:
            p_ssa = ssa.get(n, 0) / tot
            p_c90 = c90.get(n, 0.0) / 100.0
            w[n] = W_SSA * p_ssa + W_C90_FIRST * p_c90
        k = write_tsv(os.path.join(NDIR, out), w)
        stats[out] = dict(names=k, ssa_names=len(ssa), ssa_births=tot, census1990_names=len(c90),
                          weight_sum=sum(w.values()))
        stats[out + '_w'] = w
    # first_all: both sexes, population assumed half male, half female
    wm, wf = stats.pop('first_male.tsv_w'), stats.pop('first_female.tsv_w')
    wa = collections.Counter()
    for n, v in wm.items():
        wa[n] += 0.5 * v
    for n, v in wf.items():
        wa[n] += 0.5 * v
    stats['first_all.tsv'] = dict(names=write_tsv(os.path.join(NDIR, 'first_all.tsv'), wa),
                                  weight_sum=sum(wa.values()))
    # surnames
    _, c90 = read_census_1990(os.path.join(RAW, 'dist.all.last'))
    z = zipfile.ZipFile(os.path.join(RAW, 'names2010.zip'))
    rows = list(csv.DictReader(io.StringIO(z.read('Names_2010Census.csv').decode('latin-1'))))
    t10 = sum(int(r['count']) for r in rows)
    c10 = {r['name'].upper(): int(r['count']) / t10 for r in rows if r['name'] != 'ALL OTHER NAMES'}
    names = set(c90) | set(c10)
    w = {n: W_C90_LAST * c90.get(n, 0.0) / 100.0 + W_C10_LAST * c10.get(n, 0.0) for n in names}
    stats['surnames.tsv'] = dict(names=write_tsv(os.path.join(NDIR, 'surnames.tsv'), w),
                                 census1990_names=len(c90), census2010_names=len(c10),
                                 census2010_total_count=t10, weight_sum=sum(w.values()))
    with open(os.path.join(NDIR, 'names_stats.json'), 'w') as f:
        json.dump(stats, f, indent=2)
    print(json.dumps(stats, indent=2))

if __name__ == '__main__':
    import sys
    if any(a in ('-h', '--help') for a in sys.argv[1:]):
        print(__doc__)
        sys.exit(0)
    main()
