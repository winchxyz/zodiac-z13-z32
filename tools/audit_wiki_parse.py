"""tools/audit_wiki_parse.py - extract every listed Z13 candidate from the saved
Zodiac Killer Ciphers Wiki page "Z13 Solutions" (data/sources/wiki_z13_solutions.html)
into results/audit/wiki_z13_entries.tsv for the mechanical audit.

Columns: section (asis | anagram | relaxed | other), contributor, raw (as listed), letters (A-Z only,
parenthesised remarks removed).  Meta entries (links to lists, counts, "Male, Initial: M.T.")
are skipped and listed on stderr.

    python tools/audit_wiki_parse.py
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'sources' / 'wiki_z13_solutions.html'
OUT = ROOT / 'results' / 'audit' / 'wiki_z13_entries.tsv'

t = SRC.read_text(encoding='utf-8', errors='replace')
c = t[t.find('id="mw-content-text"'):t.find('printfooter')]
# drop the table of contents
first = c.find('<h1><span class="mw-headline"')
c = c[first:]

SKIP = re.compile(r'(phrases from Project Gutenberg|Project Gutenberg experiment|^List of|Full unprocessed|'
                  r'Small sampling|Original broken|Male, Initial|2-word solutions|Faycal Ziraoui|'
                  r'Weather symbols|A sampling of 69,607|contains 8 letters|Set addition|resemble "Tom")', re.I)

section = None
contributor = ''
rows = []
skipped = []
# tokenise headings, paragraphs and list items (innermost text only)
for m in re.finditer(r'<h[12][^>]*>(.*?)</h[12]>|<p>(.*?)</p>|<li>(.*?)(?=<ul>|</li>)', c, flags=re.S):
    h2, p, li = m.groups()
    if h2 is not None:
        s = html.unescape(re.sub('<[^>]+>', '', h2)).strip()
        if s.startswith('Solutions that fit the ciphertext as is'):
            section = 'asis'
        elif s.startswith('Solutions that fit if you first reverse'):
            section = 'reversed'
        elif s.startswith('Solutions that fit the ciphertext if you permit anagramming'):
            section = 'anagram'
        elif s.startswith('Solutions that fit if you relax'):
            section = 'relaxed'
        elif s.startswith('Other interpretations'):
            section = 'other'
        elif s.startswith('From') or s.startswith('Partial solution'):
            contributor = re.sub(r'\s*\(\d\).*$', '', s).replace('Partial solution  from', 'From').replace('From ', '').strip()
        continue
    if p is not None:
        continue
    s = re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', '', li or ''))).strip()
    if not s or section is None:
        continue
    if s.endswith(':'):
        # "From Tom Voigt:" style contributor line inside a list
        if s.lower().startswith('from ') and not re.match(r'from (article|another corpus)', s, re.I):
            contributor = s[5:-1].strip()
        continue
    if SKIP.search(s):
        skipped.append((section, contributor, s))
        continue
    items = [x.strip() for x in s.split(',')] if (section == 'anagram' and s.count(',') > 3) else [s]
    for it in items:
        raw = it
        letters = re.sub(r'\(.*?\)', '', it)
        letters = re.sub(r'[^A-Za-z]', '', letters).upper()
        if letters:
            rows.append((section, contributor, raw, letters))

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open('w', encoding='utf-8', newline='\n') as f:
    f.write('section\tcontributor\traw\tletters\n')
    for r in rows:
        f.write('\t'.join(x.replace('\t', ' ') for x in r) + '\n')
from collections import Counter
print('entries', len(rows), dict(Counter(r[0] for r in rows)), file=sys.stderr)
print('by length', dict(sorted(Counter(len(r[3]) for r in rows).items())), file=sys.stderr)
for s in skipped:
    print('skipped:', s, file=sys.stderr)
