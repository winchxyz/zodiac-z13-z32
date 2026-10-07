"""Step 1 of the language-model build: select and download a mid-20th-century
American English corpus from Project Gutenberg, clean it, and write

  data/lm/raw/gutenberg/<id>.txt      raw downloads (UTF-8)
  data/lm/raw/corpus_letters.txt      the whole corpus as one A-Z stream
  data/lm/raw/corpus_words.tsv        WORD<TAB>count (A-Z, apostrophes removed)
  data/lm/corpus_manifest.tsv         one row per text used

Selection (from the official catalog pg_catalog.csv):
  * Language == en, Type == Text, Library of Congress class contains PS
    (American literature), not shelved as Poetry or Plays.
  * Tier A: first author born 1880-1945 (i.e. writing roughly 1905-1970),
    at most CAP_A texts per author, letter budget TARGET_A.
  * Tier B: first author born 1850-1879 (writing roughly 1875-1930),
    at most CAP_B texts per author, letter budget TARGET_B.
Downloads use the robot-sanctioned mirror http://aleph.gutenberg.org (the host
that https://www.gutenberg.org/robot/harvest links to), 4 parallel requests.

Usage: python tools/lm_build_corpus.py [--download] [--build]
"""
import csv, os, re, sys, random, time, unicodedata, collections, threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW = os.path.join(ROOT, 'data', 'lm', 'raw')
GDIR = os.path.join(RAW, 'gutenberg')
CATALOG = os.path.join(RAW, 'pg_catalog.csv')
MANIFEST = os.path.join(ROOT, 'data', 'lm', 'corpus_manifest.tsv')
TARGET_A = 80_000_000
TARGET_B = 25_000_000
CAP_A = 6
CAP_B = 5
UA = 'zodiac-lm-build/1.0 (research; one-off corpus download)'

def birth(authors):
    m = re.search(r', (\d{4})\??-', authors)
    return int(m.group(1)) if m else None

def first_author(authors):
    return authors.split(';')[0].strip()

def select():
    rows = list(csv.DictReader(open(CATALOG, encoding='utf-8')))
    A, B = [], []
    for r in rows:
        if r['Language'] != 'en' or r['Type'] != 'Text':
            continue
        if not re.search(r'\bPS\b', r['LoCC'] or ''):
            continue
        shelves = r['Bookshelves']
        if 'Category: Poetry' in shelves or 'Plays/Films/Dramas' in shelves:
            continue
        b = birth(first_author(r['Authors'])) or birth(r['Authors'])
        if b is None:
            continue
        if 1880 <= b <= 1945:
            A.append(r)
        elif 1850 <= b <= 1879:
            B.append(r)
    rnd = random.Random(19700420)  # fixed seed (date of the Z13 letter)
    rnd.shuffle(A)
    rnd.shuffle(B)
    def cap(lst, k):
        seen = collections.Counter()
        out = []
        for r in lst:
            a = first_author(r['Authors'])
            if seen[a] < k:
                seen[a] += 1
                out.append(r)
        return out
    return cap(A, CAP_A), cap(B, CAP_B)

def mirror_path(n):
    s = str(n)
    if len(s) == 1:
        return '0/' + s
    return '/'.join(s[:-1]) + '/' + s

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as f:
        return f.read()

def download_one(n):
    out = os.path.join(GDIR, f'{n}.txt')
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return open(out, encoding='utf-8').read(), 'cached'
    base = 'http://aleph.gutenberg.org/' + mirror_path(n) + '/'
    tries = [(base + f'{n}-0.txt', 'utf-8'), (base + f'{n}.txt', 'latin-1'),
             (base + f'{n}-8.txt', 'latin-1'),
             (f'https://www.gutenberg.org/cache/epub/{n}/pg{n}.txt', 'utf-8')]
    for url, enc in tries:
        try:
            data = fetch(url)
        except Exception:
            continue
        try:
            text = data.decode('utf-8')
        except UnicodeDecodeError:
            text = data.decode(enc, errors='replace')
        with open(out, 'w', encoding='utf-8') as f:
            f.write(text)
        time.sleep(0.25)
        return text, url
    return None, 'fail'

START_RE = re.compile(r'^\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG.*$', re.M | re.I)
END_RE = re.compile(r'^\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG.*$', re.M | re.I)
NOTE_RE = re.compile(r'(transcriber|project gutenberg|copyright|produced by|e-?text|distributed proofread|'
                     r'proofreading team|pgdp|https?:|www\.|extensive research|publication was renewed)', re.I)

def body(text):
    s = START_RE.search(text)
    e = END_RE.search(text)
    if s:
        text = text[s.end():(e.start() if e and e.start() > s.end() else len(text))]
    # drop short boilerplate lines (transcriber notes, copyright notices)
    lines = [ln for ln in text.splitlines() if not (len(ln) < 200 and NOTE_RE.search(ln))]
    return '\n'.join(lines)

def to_ascii_upper(text):
    t = unicodedata.normalize('NFKD', text)
    t = ''.join(ch for ch in t if not unicodedata.combining(ch))
    return t.upper()

LETTERS_RE = re.compile(r'[^A-Z]+')
WORD_RE = re.compile(r"[A-Z]+(?:['’][A-Z]+)*")

def letters_only(t):
    return LETTERS_RE.sub('', t)

def download():
    os.makedirs(GDIR, exist_ok=True)
    A, B = select()
    print(f'candidates: tierA={len(A)} tierB={len(B)}', flush=True)
    lock = threading.Lock()
    manifest = []
    for tier, lst, target in (('A', A, TARGET_A), ('B', B, TARGET_B)):
        total = 0
        idx = 0
        while total < target and idx < len(lst):
            batch = lst[idx: idx + 40]
            idx += 40
            with ThreadPoolExecutor(4) as ex:
                res = list(ex.map(lambda r: (r, download_one(int(r['Text#']))), batch))
            for r, (text, src) in res:
                if text is None:
                    print('FAIL', r['Text#'], flush=True)
                    continue
                L = len(letters_only(to_ascii_upper(body(text))))
                if L < 5000:
                    continue
                total += L
                manifest.append((tier, r['Text#'], birth(first_author(r['Authors'])) or birth(r['Authors']),
                                 L, first_author(r['Authors']), r['Title'].replace('\n', ' ').replace('\t', ' '),
                                 r['Bookshelves'].replace('\t', ' ')))
            print(f'tier {tier}: {idx} tried, {total:,} letters', flush=True)
    with open(MANIFEST, 'w', encoding='utf-8', newline='\n') as f:
        f.write('tier\tpg_id\tauthor_birth\tletters\tauthor\ttitle\tbookshelves\n')
        for m in manifest:
            f.write('\t'.join(str(x) for x in m) + '\n')
    print('manifest rows', len(manifest))

def build():
    rows = list(csv.DictReader(open(MANIFEST, encoding='utf-8'), delimiter='\t'))
    words = collections.Counter()
    total = 0
    with open(os.path.join(RAW, 'corpus_letters.txt'), 'w', encoding='ascii', newline='\n') as out:
        for r in rows:
            text = open(os.path.join(GDIR, r['pg_id'] + '.txt'), encoding='utf-8').read()
            t = to_ascii_upper(body(text))
            for w in WORD_RE.findall(t):
                words[re.sub(r"['’]", '', w)] += 1
            L = letters_only(t)
            total += len(L)
            r['letters'] = str(len(L))  # final count after the last cleaning rules
            out.write(L)
            out.write('\n')  # document separator (ignored by the n-gram counter)
    cols = ['tier', 'pg_id', 'author_birth', 'letters', 'author', 'title', 'bookshelves']
    with open(MANIFEST, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\t'.join(cols) + '\n')
        for r in rows:
            f.write('\t'.join(r[c] for c in cols) + '\n')
    with open(os.path.join(RAW, 'corpus_words.tsv'), 'w', encoding='ascii', newline='\n') as f:
        for w, c in words.most_common():
            f.write(f'{w}\t{c}\n')
    print(f'letters {total:,}; word types {len(words):,}; word tokens {sum(words.values()):,}')

if __name__ == '__main__':
    if any(a in ('-h', '--help') for a in sys.argv[1:]) or not {'--download', '--build'} & set(sys.argv[1:]):
        print(__doc__)
        sys.exit(0)
    if '--download' in sys.argv:
        download()
    if '--build' in sys.argv:
        build()
