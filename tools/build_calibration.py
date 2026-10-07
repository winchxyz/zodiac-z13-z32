"""
tools/build_calibration.py - build data/ciphers/z408.json and data/ciphers/z340.json
from the downloaded source files in data/sources/ (URLs and SHA-256 recorded in the
JSON).  No plaintext is typed anywhere in this script: every plaintext comes from a
downloaded file, and the console output shows only lengths, hashes, positions and
single letters.

Run:  python tools/build_calibration.py
Then: node tools/verify_calibration.js

Sources used (all saved in data/sources/):
  viz_*.txt     github.com/doranchak/zodiac-cipher-key-visualizer (Oranchak)
  az_*.txt      github.com/doranchak/azdecrypt, AZdecrypt/Ciphers/Zodiac ciphers
  oranchak_408_key.html          zodiackillerciphers.com/408/key.html (annotated Harden solution)
  cipherexplorer_zodiac.js       zodiackillerciphers.com/cipher-explorer/zodiac.js (glyph names)
  arxiv_2403.17350.html          arxiv.org/html/2403.17350 (Oranchak, Blake, Van Eycke)
  wiki_solution_to_the_340.html  zodiackillerciphers.com/wiki "Solution to the 340"
"""
import collections
import hashlib
import html as htmlmod
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'sources')
OUT = os.path.join(ROOT, 'data', 'ciphers')
COLS = 17
ISO_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+-./:;<=>?@[]^_{|}~'
BS = chr(92)  # backslash symbol

AZ = 'https://raw.githubusercontent.com/doranchak/azdecrypt/main/AZdecrypt/Ciphers/Zodiac%20ciphers/'
VZ = 'https://raw.githubusercontent.com/doranchak/zodiac-cipher-key-visualizer/HEAD/'
URLS = {
    'az_z408.txt': AZ + 'Zodiac%20408.txt',
    'az_z408_solved.txt': AZ + 'Zodiac%20408%20solved.txt',
    'az_z340.txt': AZ + 'Zodiac%20340.txt',
    'az_z340_solved.txt': AZ + 'Zodiac%20340%20solved.txt',
    'az_z340_solved_transposed.txt': AZ + 'Zodiac%20340%20solved%20transposed.txt',
    'viz_z408.txt': VZ + 'z408.txt',
    'viz_z408-pt.txt': VZ + 'z408-pt.txt',
    'viz_z340.txt': VZ + 'z340.txt',
    'viz_z340-pt.txt': VZ + 'z340-pt.txt',
    'viz_z340-untransposed.txt': VZ + 'z340-untransposed.txt',
    'viz_z340-untransposed-pt.txt': VZ + 'z340-untransposed-pt.txt',
    'oranchak_408_key.html': 'http://zodiackillerciphers.com/408/key.html',
    'cipherexplorer_zodiac.js': 'https://zodiackillerciphers.com/cipher-explorer/zodiac.js?v=3',
    'arxiv_2403.17350.html': 'https://arxiv.org/html/2403.17350',
    'wiki_solution_to_the_340.html': 'http://zodiackillerciphers.com/wiki/index.php?title=Solution_to_the_340',
}


# ----------------------------------------------------------------- helpers

def path(f):
    return os.path.join(SRC, f)


def sha256(f):
    with open(path(f), 'rb') as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def rows_of(f):
    with open(path(f), encoding='latin-1') as fh:
        return [l.strip() for l in fh.read().replace('\r', '').split('\n') if l.strip()]


def flat(f):
    return ''.join(rows_of(f))


def source(name, f, note=None):
    d = {'name': name, 'url': URLS[f], 'local_file': 'data/sources/' + f, 'sha256': sha256(f)}
    if note:
        d['note'] = note
    return d


def isomorph(text):
    m = {}
    out = []
    for ch in text:
        if ch not in m:
            m[ch] = ISO_CHARS[len(m)] if len(m) < len(ISO_CHARS) else '~'
        out.append(m[ch])
    return ''.join(out)


def html_to_text(raw, keep_imgs=False):
    t = re.sub(r'(?is)<script.*?</script>|<style.*?</style>|<math.*?</math>', '', raw)
    if keep_imgs:
        t = re.sub(r'(?is)<img[^>]*src="([^"]+)"[^>]*>',
                   lambda m: ' [img:' + m.group(1).split('/')[-1].rsplit('.', 1)[0] + '] ', t)
    t = re.sub(r'(?s)<[^>]+>', ' ', t)
    t = htmlmod.unescape(t)
    t = re.sub(r'[ \t]+', ' ', t)
    return re.sub(r'\n\s*\n+', '\n', t)


def letters_only(s):
    return re.sub(r'[^A-Z]', '', s.upper())


def majority_key(ct, pt):
    m = collections.defaultdict(collections.Counter)
    for c, p in zip(ct, pt):
        m[c][p] += 1
    key = {c: v.most_common(1)[0][0] for c, v in m.items()}
    poly = {c: dict(v) for c, v in m.items() if len(v) > 1}
    return key, poly


def decode(ct, key):
    return ''.join(key.get(c, '?') for c in ct)


def diffs(a, b):
    return [i for i in range(min(len(a), len(b))) if a[i] != b[i]]


def homophones(key, ct):
    cnt = collections.Counter(ct)
    out = collections.defaultdict(list)
    for s, l in key.items():
        out[l].append(s)
    return {l: sorted(v, key=lambda s: (-cnt[s], s)) for l, v in sorted(out.items())}


def ce_name_map():
    """Cipher Explorer getName(): ascii symbol -> glyph image name, and the inverse."""
    js = open(path('cipherexplorer_zodiac.js'), encoding='latin-1').read()
    fwd, inv = {}, {}
    for ch, name in re.findall(r'case "(.{1,2})" : return\("([a-z0-9]+)"\)', js):
        if ch == BS + BS:
            ch = BS
        if name == 'blank' or len(ch) != 1:
            continue
        fwd.setdefault(ch, name)
        inv.setdefault(name, ch)
    return fwd, inv


# ----------------------------------------------------------- symbol glyphs

GLYPHS = {
    '!': "'funny I': a serifed I-like glyph whose stem is broken/offset, distinct from the plain serifed I ('I')",
    '#': 'solid (filled) square',
    '%': 'square filled except for an open notch at the upper left (half-filled square)',
    '*': 'square filled except for an open triangular notch at the top right (the counterpart of %)',
    '&': 'capital P with a solid (filled) bowl',
    '(': 'small circle crossed by a vertical stroke that extends above and below it',
    ')': 'small ellipse crossed by a horizontal stroke that extends left and right of it',
    '+': 'plus sign (upright cross)',
    '-': 'short horizontal dash',
    '.': 'small solid dot',
    '/': 'forward slash (single stroke rising to the right)',
    BS: 'backslash (single stroke falling to the right)',
    '1': 'circle filled except for an open segment at the top',
    '2': 'circle filled except for an open segment at the bottom',
    '3': 'circle filled except for an open area on the left',
    '4': 'circle filled except for an open area on the right',
    '5': 'solid (filled) circle',
    '6': 'circle with a dot in the center',
    '7': 'outlined triangle with a small inner triangle/mark (partly filled triangle)',
    '8': 'solid (filled) triangle, apex up',
    '9': 'open (outline) triangle, apex up',
    ':': 'serifed capital I with a dot at its right side',
    ';': 'serifed capital I with a dot at its left side',
    '<': 'left-pointing angle (less-than sign)',
    '>': 'right-pointing angle (greater-than sign)',
    '=': "'sideways K': capital K turned a quarter turn (stem as a bar on top, arms pointing down)",
    '@': 'open square with a dot in the center',
    '^': 'caret / inverted V',
    '_': 'open (outline) square',
    '|': 'plain vertical bar without serifs (not the serifed I)',
    't': 'upside-down capital T (perpendicular sign)',
    'z': 'Zodiac crosshair: circle with a cross whose arms extend beyond the circle',
    'y': 'mirror-reversed capital Y (asymmetric handwritten Y)',
}


def describe(ch, ce):
    if ch in GLYPHS:
        d = GLYPHS[ch]
    elif 'A' <= ch <= 'Z':
        d = 'capital letter %s in normal orientation' % ch
        if ch == 'I':
            d = 'serifed capital I in normal orientation (not the funny I "!" or the bar "|")'
    elif 'a' <= ch <= 'z':
        d = 'mirror-reversed (backwards) capital %s' % ch.upper()
    else:
        d = 'symbol'
    return '%s; Cipher Explorer glyph "%s"' % (d, ce.get(ch, '?'))


def symbol_table(ct, key, ce, others):
    pos = collections.defaultdict(list)
    for i, c in enumerate(ct):
        pos[c].append(i)
    out = []
    for c in sorted(pos, key=lambda s: (pos[s][0])):
        e = {'ascii': c, 'description': describe(c, ce), 'count': len(pos[c]), 'positions': pos[c]}
        e['letter'] = key[c]
        for name, txt in others:
            e['in_' + name] = c in txt
        out.append(e)
    return out


def load_json(f):
    with open(os.path.join(OUT, f), encoding='utf-8') as fh:
        return json.load(fh)


# ===================================================================== Z408

def parse_harden_page(inv):
    """Rows of the annotated Harden solution: glyph names -> ascii, letters, note markers,
    plus the 'Harden Key (cipher to plaintext)' table."""
    raw = open(path('oranchak_408_key.html'), encoding='utf-8', errors='replace').read()
    t = html_to_text(raw, keep_imgs=True)
    body = t[:t.find('Notes:')]
    parts = re.split(r'row (\d+):', body)
    syms, letters, notes = [], [], []
    for i in range(1, len(parts), 2):
        chunk = parts[i + 1]
        imgs = re.findall(r'\[img:([^\]]+)\]', chunk)
        rest = re.sub(r'\[img:[^\]]+\]', ' ', chunk).split('Part')[0]
        rl = []
        for tok in rest.split():
            if re.fullmatch(r'[A-Z]', tok):
                rl.append(tok)
            elif re.fullmatch(r'\d{1,2}', tok):
                notes.append((len(letters) + len(rl) - 1, int(tok)))
        assert len(imgs) >= 17 and len(rl) == 17, ('row parse', parts[i], len(imgs), len(rl))
        syms += [inv[n] for n in imgs[:17]]
        letters += rl
    i = t.find('Harden Key (cipher to plaintext)')
    j = t.find('Harden Key (plaintext to cipher)')
    table = re.findall(r'\[img:([a-z0-9]+)\]\s+([A-Z])\s+(\d+)', re.sub(r'\s+', ' ', t[i:j]))
    tab = collections.defaultdict(dict)
    for name, letter, n in table:
        tab[inv[name]][letter] = int(n)
    nt = t[t.find('Notes:'):t.find('Harden Key', t.find('Notes:'))]
    nt = re.sub(r'\s+', ' ', nt)
    return ''.join(syms), ''.join(letters), notes, dict(tab), nt


def build_z408(ce, inv, z13, z32, z340_ascii):
    ct = flat('viz_z408.txt')
    rows = rows_of('viz_z408.txt')
    ct_az = flat('az_z408.txt')
    pt_viz = flat('viz_z408-pt.txt')
    pt_az = flat('az_z408_solved.txt')
    page_ct, page_pt, notes, harden_table, _ = parse_harden_page(inv)
    assert len(ct) == 408 and len(rows) == 24 and all(len(r) == COLS for r in rows)
    assert len(page_pt) == 408 and len(page_ct) == 408

    print('[Z408] ascii len', len(ct), 'distinct', len(set(ct)), 'sha256(ascii)', hashlib.sha256(ct.encode()).hexdigest()[:16])
    print('[Z408] transcription diffs viz vs AZdecrypt:', [(k, ct[k], ct_az[k]) for k in diffs(ct, ct_az)])
    print('[Z408] transcription diffs viz vs annotated page:', [(k, ct[k], page_ct[k]) for k in diffs(ct, page_ct)])

    # Independent key: the Harden key table on Oranchak's page (majority letter per symbol).
    tab = {s: dict(v) for s, v in harden_table.items()}
    # Position 105: the page/table counts it under 'I' (read as plain I, letter O); our
    # transcription has '!' there (page note 20), so move that one O from 'I' to '!'.
    if ct[105] == '!' and page_ct[105] == 'I':
        tab['I']['O'] -= 1
        if tab['I']['O'] == 0:
            del tab['I']['O']
        tab['!']['O'] = tab['!'].get('O', 0) + 1
    key_table = {s: max(v.items(), key=lambda kv: kv[1])[0] for s, v in tab.items()}
    key, poly = majority_key(ct, page_pt)
    assert key == key_table, 'Harden table key != majority key of the annotated plaintext'
    assert set(key) == set(ct)
    # Counts in the table must match our counts of (symbol, letter) pairs.
    pairs = collections.Counter(zip(ct, page_pt))
    for s, v in tab.items():
        for l, n in v.items():
            assert pairs[(s, l)] == n, ('table count mismatch', s, l, n, pairs[(s, l)])
    dec = decode(ct, key)
    print('[Z408] key from Harden table == majority key of annotated plaintext: True; symbols', len(key))
    print('[Z408] key-decoded == visualizer z408-pt.txt:', dec == pt_viz, '| diffs vs AZdecrypt solved:',
          [(k, ct_az[k], dec[k], pt_az[k]) for k in diffs(dec, pt_az)])

    note_at = collections.defaultdict(list)
    for p, n in notes:
        note_at[p].append(n)
    explain = {
        7: "Oranchak note 7: the solid triangle '8' stands for A 4x, S 3x and I 1x; S is otherwise '7' or another S homophone and I is otherwise the open triangle '9', so Zodiac apparently confused his own triangle symbols.",
        8: "Oranchak notes 8 and 20: the word should end in S but the symbol is 'E' (key E); the S homophone 'F' looks similar. With '!' at 105 (note 20) only this last symbol is wrong.",
        13: "Oranchak note 13: 'N' stands for E 5x and T 1x; Zodiac probably wrote 'N' where he meant the T homophone 'H'.",
        15: "Oranchak note 15: the dotted triangle '7' stands for S 2x and A 1x; A is otherwise the solid triangle '8' (triangle confusion again).",
        18: "Oranchak note 18: the open triangle '9' stands for I 13x and W 1x; W is otherwise 'A' (triangle-shaped symbols again).",
    }
    slips = []
    for k in diffs(dec, page_pt):
        s = ct[k]
        n = note_at.get(k, [])
        why = None
        if s == '8':
            why = explain[7]
        elif k == 107:
            why = explain[8]
        elif s == 'N':
            why = explain[13]
        elif s == '7':
            why = explain[15]
        elif s == '9':
            why = explain[18]
        slips.append({'position': k, 'row': k // COLS, 'col': k % COLS, 'symbol': s,
                      'key_letter': dec[k], 'plaintext_letter': page_pt[k],
                      'oranchak_notes_at_position': n, 'explanation': why})
    print('[Z408] key(ascii) vs plaintext mismatches:', [(d['position'], d['symbol'], d['key_letter'], d['plaintext_letter']) for d in slips])
    print('[Z408] sha256(plaintext)', hashlib.sha256(page_pt.encode()).hexdigest()[:16], 'len', len(page_pt))

    others = [('z13', z13), ('z32', z32), ('z340', z340_ascii)]
    j = {
        'id': 'Z408',
        'date_sent': '1969-07-31',
        'date_note': 'Mailed July 31, 1969 in three parts of 8 rows each: part 1 (rows 0-7) to the Vallejo Times-Herald, part 2 (rows 8-15) to the San Francisco Examiner, part 3 (rows 16-23) to the San Francisco Chronicle. Solved by Donald and Bettye Harden; their solution reached the Chronicle on August 8, 1969.',
        'ascii': ct,
        'rows': rows,
        'length': len(ct),
        'parts': [
            {'part': 1, 'rows': [0, 7], 'positions': [0, 135], 'newspaper': 'Vallejo Times-Herald'},
            {'part': 2, 'rows': [8, 15], 'positions': [136, 271], 'newspaper': 'San Francisco Examiner'},
            {'part': 3, 'rows': [16, 23], 'positions': [272, 407], 'newspaper': 'San Francisco Chronicle'},
        ],
        'symbols': symbol_table(ct, key, ce, others),
        'isomorph': isomorph(ct),
        'sources': [
            source("Oranchak, zodiac-cipher-key-visualizer z408.txt (ASCII transcription used here)", 'viz_z408.txt'),
            source("Oranchak, zodiac-cipher-key-visualizer z408-pt.txt (strict key decoding, aligned)", 'viz_z408-pt.txt',
                   'Identical to plaintext_key_decoded.'),
            source("AZdecrypt bundled 'Zodiac 408.txt'", 'az_z408.txt', "Differs only at position 105: 'I' instead of '!'."),
            source("AZdecrypt bundled 'Zodiac 408 solved.txt'", 'az_z408_solved.txt',
                   "Strict decoding with '7'=A and plain 'I' at 105 (T); differs from plaintext_key_decoded at 41, 105, 264, 352."),
            source("Oranchak, 'Annotated solution to the 408 cipher, based on the Harden worksheets' (plaintext, Harden key table, notes 1-20)", 'oranchak_408_key.html',
                   'Source of the plaintext field and of the independent key check.'),
            source("Oranchak, Cipher Explorer zodiac.js (glyph names per ASCII symbol)", 'cipherexplorer_zodiac.js'),
            {'name': "Oranchak, Blake, Van Eycke, 'The Solution of the Zodiac Killer's 340-Character Cipher' (arXiv:2403.17350), section 1.3 and 8.2.2",
             'url': 'https://arxiv.org/abs/2403.17350'},
            {'name': "Wikipedia, 'Zodiac Killer' (common rendering of the Z408 solution)", 'url': 'https://en.wikipedia.org/wiki/Zodiac_Killer'},
        ],
        'plaintext': page_pt,
        'plaintext_note': "Letters only, 1:1 with ascii, as the Hardens' worksheet reads it (Oranchak's annotated solution): Zodiac's own misspellings are kept (Oranchak notes 6, 10, 14) and the last 18 letters (positions 390-407) are the Hardens'/community reading of the unexplained tail. At the 8 positions in encoding_slips the letter is the intended one, not the key's. Popular renderings (e.g. Wikipedia) keep the key letter at 107 and 110 instead, which produces two well-known 'misspellings'. plaintext_key_decoded is the strict one-letter-per-symbol reading.",
        'plaintext_key_decoded': dec,
        'key': {s: key[s] for s in sorted(key)},
        'key_homophones': homophones(key, ct),
        'key_polyphones_in_plaintext': {s: v for s, v in sorted(poly.items())},
        'encoding_slips': slips,
        'transcription_variants': [
            {'position': 105, 'chosen': '!', 'alternative': 'I',
             'note': "Oranchak's annotated key note 20: long read as a plain I (as the Hardens did, and as AZdecrypt's file still has it), but on closer inspection it is the 'funny I' (key O). With 'I' the key reads T there."},
        ],
        'key_variants': [
            {'symbol': '7', 'chosen': 'S', 'alternative': 'A', 'note': "'7' stands for S at 41 and 352 and for A at 264 in the Hardens' plaintext. The majority letter S is used here (as in Oranchak's visualizer); AZdecrypt's solved file uses A."},
        ],
        'unsolved_tail': {'positions': [390, 407], 'note': "The last 18 symbols decode under the key to a string with no accepted reading (Oranchak note 19; arXiv:2403.17350 section 8.2.2, where they are called Z18). The 18 positions use 15 distinct symbols (12 of them once), all of which also occur in the first 390. Hypotheses: filler to square off part 3, possibly copied from symbols above (Brax Sisco 2009), or a second hidden message."},
        'notes': [
            'ASCII convention: Oranchak / AZdecrypt / Cipher Explorer. Upper-case letters are normal letters, lower-case letters are mirror-reversed letters, except z (Zodiac crosshair) and t (upside-down T); digits and punctuation are shapes (see symbols[].description). Same convention as z13.json, z32.json and z340.json.',
            '54 distinct symbols; multiplicity 54/408 = 0.13.',
            "Verification (tools/verify_calibration.js): applying key to ascii reproduces plaintext except at the 8 encoding_slips positions (97, 107, 110, 146, 228, 232, 264, 345); it reproduces plaintext_key_decoded and Oranchak's z408-pt.txt exactly; the key equals the majority reading of the Harden key table on Oranchak's page.",
            "A word appears to be missing at the part 2 / part 3 boundary (position 272; Oranchak note 16). This is not a position mismatch and is not represented in the plaintext.",
            "Harden worksheet slips that are not Zodiac's (Oranchak notes 1, 2, 4, 9, 11, 17) are already corrected in the plaintext.",
        ],
    }
    return j


# ===================================================================== Z340

def diag(start_row, nrows):
    return [(start_row + (k % nrows)) * COLS + (2 * k) % COLS for k in range(nrows * COLS)]


def build_z340(ce, z13, z32, z408_ascii):
    ct = flat('viz_z340.txt')
    rows = rows_of('viz_z340.txt')
    assert ct == flat('az_z340.txt'), 'visualizer and AZdecrypt Z340 transcriptions differ'
    assert len(ct) == 340 and len(rows) == 20 and all(len(r) == COLS for r in rows)
    pt_aligned = flat('az_z340_solved_transposed.txt')
    assert pt_aligned == flat('viz_z340-pt.txt')
    pt_read = flat('az_z340_solved.txt')
    assert pt_read == flat('viz_z340-untransposed-pt.txt')
    unt = flat('viz_z340-untransposed.txt')
    key, poly = majority_key(ct, pt_aligned)
    assert not poly, 'Z340 aligned plaintext is not single-valued'
    print('[Z340] ascii len', len(ct), 'distinct', len(set(ct)), 'sha256(ascii)', hashlib.sha256(ct.encode()).hexdigest()[:16])

    # ---- paper: reversed words in the last two rows (Figure 41) and the bracketed list
    paper = html_to_text(open(path('arxiv_2403.17350.html'), encoding='utf-8', errors='replace').read())
    k41 = paper.find('Figure 41: Last two lines')
    lines41 = [l.strip() for l in paper[:k41].split('\n') if l.strip()][-4:]
    as_written = lines41[0].split() + lines41[1].split()
    fixed = lines41[2].split() + lines41[3].split()
    assert len(as_written) == len(fixed)
    rows1920 = decode(ct[306:], key)
    assert ''.join(as_written) == rows1920, 'Figure 41 does not match the key decoding of rows 19-20'
    tail = []
    p = 306
    spans = []
    for w_, f_ in zip(as_written, fixed):
        n = len(w_)
        if w_ != f_:
            assert w_[::-1] == f_
            tail += list(range(p + n - 1, p - 1, -1))
            spans.append([p, p + n - 1])
        else:
            tail += list(range(p, p + n))
        p += n
    last_word_len = len(fixed[-1])

    # ---- section 2: line-15 skip and the untransposed 'LIFE IS' cells
    life_cells = None
    life_len = len(fixed[0])  # first fixed word of Figure 41 is the 4-letter word; LIFE IS = 6 letters
    # locate the 6 untransposed cells: a run of 6 consecutive written cells in row 10 (0-based 9)
    # whose key decoding equals the first fixed word followed by a 2-letter word ('IS').
    # We find it from the published reading-order plaintext instead of typing it: Oranchak's
    # untransposed file places these 6 cells at reading positions 300-305.
    seg = pt_read[300:306]
    row9 = decode(ct[9 * COLS:10 * COLS], key)
    hits = [c for c in range(COLS - 5) if row9[c:c + 6] == seg]
    assert len(hits) == 1, hits
    life_cells = list(range(9 * COLS + hits[0], 9 * COLS + hits[0] + 6))
    assert seg[:life_len] == fixed[0], 'reading positions 300-303 are not the first word of Figure 41'

    def corrected(idx):
        r, c = divmod(idx, COLS)
        if r == 14 and c >= 3:   # 15th line: cols 3..16 circularly shifted right by one
            return 14 * COLS + (16 if c == 3 else c - 1)
        return idx

    sec1 = diag(0, 9)
    sec2 = [corrected(i) for i in diag(9, 9) if i not in life_cells] + life_cells
    order = sec1 + sec2 + tail
    assert sorted(order) == list(range(340)), 'read order is not a permutation'

    pure = diag(0, 9) + diag(9, 9) + list(range(306, 340))
    m_pure = sum(1 for k in range(340) if ct[pure[k]] != unt[k])
    m_ord = [k for k in range(340) if ct[order[k]] != unt[k]]
    print('[Z340] pure (1,2)-decimation + straight rows 19-20 vs Oranchak untransposed: %d symbol mismatches' % m_pure)
    print('[Z340] read_order vs Oranchak untransposed ciphertext: mismatches', m_ord)
    dec_read = decode(''.join(ct[i] for i in order), key)
    print('[Z340] key(ascii[read_order]) vs published reading-order plaintext: mismatches', diffs(dec_read, pt_read))
    assert not m_ord and dec_read == pt_read

    # ---- variant: paper's final text places the untransposed 6 letters before the last word
    rest = order[:300] + order[306:]
    order_paper = rest[:len(rest) - last_word_len] + order[300:306] + rest[len(rest) - last_word_len:]
    assert sorted(order_paper) == list(range(340))
    i0 = paper.find('The full plaintext, including remaining misspellings')
    i1 = paper.find('The final substitution key is given in Figure 44')
    par = paper[i0:i1]
    par = par[par.find('is as follows:') + len('is as follows:'):]
    brackets = re.findall(r'\[([A-Z]+): ([A-Z]+)\]', par)
    paper_written = letters_only(re.sub(r'\[([A-Z]+): ([A-Z]+)\]', r'\1', par))
    paper_corrected = letters_only(re.sub(r'\[([A-Z]+): ([A-Z]+)\]', r'\2', par))
    dec_paper = decode(''.join(ct[i] for i in order_paper), key)
    pw = diffs(dec_paper, paper_written)
    print('[Z340] paper as-written text (len %d) vs key decoding in paper order: mismatches %s' % (len(paper_written), [(k, dec_paper[k], paper_written[k]) for k in pw]))

    # ---- documented encoding errors: wiki 'Solution to the 340' (bold = presumed errors)
    wiki = open(path('wiki_solution_to_the_340.html'), encoding='utf-8', errors='replace').read()
    a = wiki.find('Presumed errors')
    dl1 = wiki[wiki.find('<dl>', a):wiki.find('</dl>', a)]
    b = wiki.find('With errors corrected')
    dl2 = wiki[wiki.find('<dl>', b):wiki.find('</dl>', b)]
    raw_letters, bold = [], []
    for m in re.finditer(r'<b>(.*?)</b>|<[^>]+>|([^<]+)', dl1, re.S):
        if m.group(1) is not None:
            for ch in letters_only(htmlmod.unescape(m.group(1))):
                bold.append(len(raw_letters))
                raw_letters.append(ch)
        elif m.group(2) is not None:
            raw_letters += list(letters_only(htmlmod.unescape(m.group(2))))
    wiki_raw = ''.join(raw_letters)
    wiki_corr = letters_only(htmlmod.unescape(re.sub(r'<[^>]+>', ' ', dl2)))
    print('[Z340] wiki raw text (len %d) vs published plaintext: mismatches %s' % (len(wiki_raw), diffs(wiki_raw, pt_read)))
    dcorr = diffs(dec_read, wiki_corr)
    print('[Z340] key decoding vs wiki corrected text (len %d): mismatches %s; bold positions %s' % (len(wiki_corr), dcorr, bold))
    assert wiki_raw == pt_read and len(wiki_corr) == 340 and dcorr == bold
    homo = homophones(key, ct)
    errors = []
    for k in dcorr:
        w = order[k]
        errors.append({'read_position': k, 'written_position': w, 'row': w // COLS, 'col': w % COLS,
                       'symbol': ct[w], 'key_letter': dec_read[k], 'intended_letter': wiki_corr[k],
                       'homophones_of_intended_letter': homo.get(wiki_corr[k], [])})
    print('[Z340] encoding errors (read pos, written pos, symbol, key letter, intended):',
          [(e['read_position'], e['written_position'], e['symbol'], e['key_letter'], e['intended_letter']) for e in errors])
    # Positions where the paper's bracketed corrections differ from the as-written letters,
    # mapped to reading order (the paper text is in paper order).
    inv_paper = {order_paper[k]: k for k in range(340)}
    pc = [(order.index(order_paper[k]), dec_paper[k], paper_corrected[k]) for k in diffs(paper_written, paper_corrected)]
    pc.sort()
    spelling = [x for x in pc if x[0] not in dcorr]
    print('[Z340] paper bracket corrections (read pos, as written, corrected):', pc)
    print('[Z340] of these, not encoding errors in the wiki (= spelling, kept):', spelling)

    others = [('z13', z13), ('z32', z32), ('z408', z408_ascii)]
    j = {
        'id': 'Z340',
        'date_sent': '1969-11-08',
        'date_note': 'Mailed November 8, 1969 to the San Francisco Chronicle with a greeting card; published November 12-13, 1969. Solved December 2020 by David Oranchak, Sam Blake and Jarl Van Eycke (report to the FBI December 5, public December 11, 2020).',
        'ascii': ct,
        'rows': rows,
        'length': len(ct),
        'symbols': symbol_table(ct, key, ce, others),
        'isomorph': isomorph(ct),
        'sources': [
            source("Oranchak, zodiac-cipher-key-visualizer z340.txt (ASCII transcription, written order)", 'viz_z340.txt'),
            source("AZdecrypt bundled 'Zodiac 340.txt'", 'az_z340.txt', 'Identical to the visualizer transcription.'),
            source("AZdecrypt bundled 'Zodiac 340 solved transposed.txt' (plaintext aligned with written order)", 'az_z340_solved_transposed.txt',
                   'Identical to the visualizer z340-pt.txt; used for the key.'),
            source("Oranchak, zodiac-cipher-key-visualizer z340-pt.txt", 'viz_z340-pt.txt'),
            source("AZdecrypt bundled 'Zodiac 340 solved.txt' (plaintext in reading order)", 'az_z340_solved.txt',
                   'Identical to the visualizer z340-untransposed-pt.txt; this is the plaintext field.'),
            source("Oranchak, zodiac-cipher-key-visualizer z340-untransposed.txt (ciphertext put in reading order by the solvers)", 'viz_z340-untransposed.txt',
                   'read_order reproduces it exactly.'),
            source("Oranchak, zodiac-cipher-key-visualizer z340-untransposed-pt.txt", 'viz_z340-untransposed-pt.txt'),
            source("Oranchak, Blake, Van Eycke, 'The Solution of the Zodiac Killer's 340-Character Cipher', arXiv:2403.17350 (sections 5.3-5.5, Figure 41, full plaintext with bracketed corrections)", 'arxiv_2403.17350.html'),
            source("Zodiac Killer Ciphers Wiki, 'Solution to the 340' (raw text with presumed errors in bold; corrected text)", 'wiki_solution_to_the_340.html'),
            source("Oranchak, Cipher Explorer zodiac.js (glyph names per ASCII symbol)", 'cipherexplorer_zodiac.js'),
            {'name': "Kopal, Zodiac-340-Transposition-Reverser (GitHub)", 'url': 'https://github.com/n1k0m0/Zodiac-340-Transposition-Reverser'},
        ],
        'plaintext': pt_read,
        'plaintext_note': "Published plaintext as enciphered, in reading order (plaintext[k] decrypts ascii[read_order[k]]), letters only. It is the key decoding, so Zodiac's 8 encoding errors (encoding_errors) and his spelling are left as they are. The 6 letters that Zodiac left untransposed in row 10 are at reading positions 300-305 (end of section 2), as in the solvers' untransposed files; the paper's final text places them before the last word instead (read_order_paper_final). The reversed words of rows 19-20 are un-reversed.",
        'plaintext_aligned': pt_aligned,
        'plaintext_corrected': wiki_corr,
        'plaintext_corrected_note': "Reading order, with the 8 presumed encoding errors corrected as on the wiki page 'Solution to the 340' (Oranchak). Zodiac's own spelling of one recurring word is kept.",
        'key': {s: key[s] for s in sorted(key)},
        'key_homophones': homo,
        'read_order': order,
        'read_order_note': "0-based: plaintext[k] corresponds to ascii[read_order[k]]. Section 1 (rows 0-8, reading positions 0-152): (1,2)-decimation, i.e. k-th symbol at row k mod 9, column 2k mod 17. Section 2 (rows 9-17, positions 153-305): the same decimation over a corrected grid in which row 14 (the 15th line) has columns 3-16 circularly shifted right by one (Zodiac skipped a symbol and appended it at the line end), skipping the 6 cells of row 9, columns 11-16 (written positions 164-169), which Zodiac left untransposed; those 6 cells are read last, in order (positions 300-305). Section 3 (rows 18-19, positions 306-339): straight left to right, with the words that Zodiac wrote backwards read backwards (reversed_spans).",
        'read_order_paper_final': order_paper,
        'read_order_paper_final_note': "Same as read_order except that the 6 untransposed letters are placed just before the last word, as in the paper's final plaintext (arXiv:2403.17350 section 5.5, footnote 9; the placement is called subjective there).",
        'transposition': {
            'sections': [
                {'section': 1, 'rows': [0, 8], 'written_positions': [0, 152], 'reading_positions': [0, 152], 'rule': '(1,2)-decimation with wrap-around in a 9x17 block: down 1 row, right 2 columns'},
                {'section': 2, 'rows': [9, 17], 'written_positions': [153, 305], 'reading_positions': [153, 305], 'rule': 'same decimation, with the two exceptions below'},
                {'section': 3, 'rows': [18, 19], 'written_positions': [306, 339], 'reading_positions': [306, 339], 'rule': 'not transposed; read left to right; some words written backwards'},
            ],
            'line15_shift': {'row': 14, 'cols': [3, 16], 'written_positions': [14 * COLS + 3, 14 * COLS + 16],
                             'rule': 'corrected[14][3] = written[14][16]; corrected[14][c] = written[14][c-1] for c = 4..16 (Van Eycke; paper section 5.5 and footnote 8)'},
            'untransposed_cells': {'written_positions': life_cells, 'reading_positions': [300, 305],
                                   'rule': 'skipped by the decimation of section 2 and read as a block (Van Eycke; paper section 5.5)'},
            'reversed_spans': spans,
            'reversed_spans_note': 'Written-position spans [first, last] in rows 18-19 whose letters were written backwards (paper Figure 41); read_order reads each span right to left.',
            'pure_decimation_mismatches_vs_untransposed': m_pure,
        },
        'encoding_errors': errors,
        'encoding_errors_note': "Positions where key decoding differs from the corrected text (bold letters on the wiki 'Solution to the 340'; the same 8 are bracketed in arXiv:2403.17350 section 5.5). Each is a wrong homophone choice by Zodiac. read_position indexes plaintext; written_position indexes ascii.",
        'spelling_kept': [{'read_position': x[0], 'as_written': x[1], 'paper_correction': x[2]} for x in spelling],
        'spelling_kept_note': "Letters that the paper brackets as misspellings (one recurring word, spelled the way Zodiac also spelled it in Z408) but that are correctly enciphered; they are not encoding errors and are kept in plaintext_corrected.",
        'notes': [
            'ASCII convention: Oranchak / AZdecrypt / Cipher Explorer, as in z408.json, z13.json, z32.json.',
            '63 distinct symbols; every symbol appears in section 1 (paper section 5.5). Multiplicity 63/340 = 0.19; section 1 alone 63/153 = 0.41.',
            'No plaintext letter is J, K (except as an encoding-error intent), Q, X or Z: the key has no homophones for them (paper Figure 44).',
            "Verification (tools/verify_calibration.js): read_order is a permutation; ascii[read_order] equals Oranchak's z340-untransposed.txt; key(ascii[read_order]) equals the published plaintext exactly; against plaintext_corrected it differs only at the 8 encoding_errors.",
        ],
    }
    return j


def main():
    ce, inv = ce_name_map()
    z13 = load_json('z13.json')['ascii']
    z32 = load_json('z32.json')['ascii']
    z408_ascii = flat('viz_z408.txt')
    z340_ascii = flat('viz_z340.txt')
    j408 = build_z408(ce, inv, z13, z32, z340_ascii)
    j340 = build_z340(ce, z13, z32, z408_ascii)
    for name, j in (('z408.json', j408), ('z340.json', j340)):
        with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(j, fh, indent=1, ensure_ascii=False)
            fh.write('\n')
        print('wrote data/ciphers/' + name)


if __name__ == '__main__':
    main()
