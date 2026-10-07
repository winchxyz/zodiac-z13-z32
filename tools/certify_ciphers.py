#!/usr/bin/env python3
"""Certify the four canonical cipher files (Z13, Z32, Z408, Z340).

What it does
  1. Checks that each file's `ascii` equals the concatenation of its `rows` and has `length` symbols.
  2. Recomputes, from the final `ascii`, every derived field: `isomorph`, `length`, and for each
     entry of `symbols` its `count`, `positions` and the cross-cipher flags `in_z13`, `in_z32`,
     `in_z408`, `in_z340` (a file has no flag for itself). It also checks that `symbols` lists
     every distinct character exactly once.
  3. Cross-file check of the shared ASCII alphabet: prints every character that occurs in more than
     one file with the description each file gives, so a human can confirm that one character
     always means one glyph (step done by eye; see data/ciphers/README.md).
  4. Recomputes the Z13 and Z32 key carry-over strings from the `key` fields of z408.json and
     z340.json and compares them with the strings stored in z13.json / z32.json.
  5. Checks the Z408/Z340 transcriptions against the downloaded source files in data/sources/.

Usage
  python tools/certify_ciphers.py            # report only, exit code 1 if anything is stale
  python tools/certify_ciphers.py --write    # also rewrite the derived fields in place
  python tools/certify_ciphers.py --table    # print the shared-alphabet table as Markdown
  python tools/certify_ciphers.py --export-variants   # write data/ciphers/variants/<id>.txt

Isomorph letters are assigned in order of first appearance from "a-z A-Z 0-9 !" (the scheme the
existing files use; Z340 needs 63 letters, the 63rd is '!').
"""
import json
import os
import sys
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIPH = os.path.join(ROOT, 'data', 'ciphers')
NAMES = ['z13', 'z32', 'z408', 'z340']
ISO_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!'


def load(name):
    with open(os.path.join(CIPH, name + '.json'), encoding='utf-8') as f:
        return json.load(f, object_pairs_hook=OrderedDict)


def save(name, d):
    path = os.path.join(CIPH, name + '.json')
    tmp = path + '.certify_tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, path)


def isomorph(text):
    m = {}
    out = []
    for ch in text:
        if ch not in m:
            m[ch] = ISO_ALPHABET[len(m)]
        out.append(m[ch])
    return ''.join(out)


def positions(text, ch):
    return [i for i, c in enumerate(text) if c == ch]


def main():
    write = '--write' in sys.argv
    table = '--table' in sys.argv
    data = {n: load(n) for n in NAMES}
    problems = []
    changes = []

    # ---- 1. rows / ascii / length ----
    for n, d in data.items():
        a = d['ascii']
        if ''.join(d.get('rows', [a])) != a:
            problems.append('%s: rows do not concatenate to ascii' % n)
        if d.get('length') != len(a):
            changes.append('%s: length %r -> %d' % (n, d.get('length'), len(a)))
            d['length'] = len(a)
        iso = isomorph(a)
        if d.get('isomorph') != iso:
            changes.append('%s: isomorph %r -> %r' % (n, d.get('isomorph'), iso))
            d['isomorph'] = iso

    alph = {n: set(d['ascii']) for n, d in data.items()}

    # ---- 2. per-symbol derived fields ----
    for n, d in data.items():
        a = d['ascii']
        listed = [s['ascii'] for s in d['symbols']]
        dup = sorted(set(c for c in listed if listed.count(c) > 1))
        missing = sorted(alph[n] - set(listed))
        extra = sorted(set(listed) - alph[n])
        if dup:
            problems.append('%s: symbols listed twice: %r' % (n, dup))
        if missing:
            problems.append('%s: symbols in ascii but not in symbols[]: %r' % (n, missing))
        if extra:
            problems.append('%s: symbols[] entries not in ascii: %r' % (n, extra))
        for s in d['symbols']:
            ch = s['ascii']
            pos = positions(a, ch)
            if s.get('count') != len(pos):
                changes.append('%s %r: count %r -> %d' % (n, ch, s.get('count'), len(pos)))
                s['count'] = len(pos)
            if s.get('positions') != pos:
                changes.append('%s %r: positions %r -> %r' % (n, ch, s.get('positions'), pos))
                s['positions'] = pos
            for other in NAMES:
                if other == n:
                    if ('in_' + other) in s:
                        changes.append('%s %r: removed self flag in_%s' % (n, ch, other))
                        del s['in_' + other]
                    continue
                flag = ch in alph[other]
                if s.get('in_' + other) != flag:
                    changes.append('%s %r: in_%s %r -> %r' % (n, ch, other, s.get('in_' + other), flag))
                    s['in_' + other] = flag
            # keep the in_* flags in a fixed order at the end of each entry
            flags = [(k, s.pop(k)) for k in ['in_z13', 'in_z32', 'in_z408', 'in_z340'] if k in s]
            for k, v in flags:
                s[k] = v

    # ---- 3. shared characters across files ----
    desc = {}
    for n, d in data.items():
        for s in d['symbols']:
            desc.setdefault(s['ascii'], OrderedDict())[n] = s.get('description', '')
    shared = sorted(c for c in desc if len(desc[c]) > 1)

    # ---- 4. key carry-over ----
    k408 = data['z408']['key']
    k340 = data['z340']['key']

    def dec(text, key):
        return ''.join(key.get(c, '?') for c in text)

    carry = {}
    for n in ['z13', 'z32']:
        a = data[n]['ascii']
        carry[n] = {'z408': dec(a, k408), 'z340': dec(a, k340)}
    stored13 = data['z13'].get('key_carryover', {})
    if stored13:
        if stored13.get('z13_under_z408_key') != carry['z13']['z408']:
            problems.append('z13 key_carryover z408 stale: %r vs %r' % (stored13.get('z13_under_z408_key'), carry['z13']['z408']))
        if stored13.get('z13_under_z340_key') != carry['z13']['z340']:
            problems.append('z13 key_carryover z340 stale: %r vs %r' % (stored13.get('z13_under_z340_key'), carry['z13']['z340']))

    # ---- 4b. transcription variants (z13/z32): derived fields must match their ascii ----
    used_all = set().union(*alph.values())
    for n in ['z13', 'z32']:
        for v in data[n].get('transcription_variants', []):
            a = v.get('ascii', '')
            for fld, val in (('length', len(a)), ('distinct', len(set(a))), ('isomorph', isomorph(a))):
                if v.get(fld) != val:
                    problems.append('%s variant %s: %s %r should be %r' % (n, v.get('id'), fld, v.get(fld), val))
            invented = sorted(set(a) - used_all)
            if invented:
                print('note: %s variant %s uses variant-only codes %s' % (n, v.get('id'), ''.join(invented)))

    # ---- 5. Z408 / Z340 against downloaded sources ----
    src = os.path.join(ROOT, 'data', 'sources')

    def readflat(fn):
        p = os.path.join(src, fn)
        if not os.path.exists(p):
            return None
        with open(p, encoding='utf-8') as f:
            return ''.join(line.rstrip('\r\n') for line in f)

    srcchecks = []
    for fn, n in [('viz_z408.txt', 'z408'), ('az_z408.txt', 'z408'), ('viz_z340.txt', 'z340'), ('az_z340.txt', 'z340')]:
        t = readflat(fn)
        if t is None:
            srcchecks.append('%s: missing' % fn)
            continue
        a = data[n]['ascii']
        diffs = [i for i in range(min(len(t), len(a))) if t[i] != a[i]]
        srcchecks.append('%s vs %s.json: len %d/%d, differing positions %s' % (
            fn, n, len(t), len(a), ['%d:%s->%s' % (i, t[i], a[i]) for i in diffs] or 'none'))

    # ---- report ----
    print('== certify_ciphers ==')
    for n, d in data.items():
        print('%-5s len %3d  distinct %2d  isomorph %s' % (n, len(d['ascii']), len(alph[n]),
              d['isomorph'] if len(d['ascii']) <= 40 else d['isomorph'][:40] + '...'))
    print('\nSource-file checks:')
    for s in srcchecks:
        print('  ' + s)
    print('\nKey carry-over (recomputed from z408.json / z340.json keys):')
    for n in carry:
        print('  %s: Z408 key %s | Z340 key %s' % (n, carry[n]['z408'], carry[n]['z340']))
    print('\nCharacters shared by more than one file: %d' % len(shared))
    if '--verbose' in sys.argv:
        for c in shared:
            print('  %r' % c)
            for n, t in desc[c].items():
                print('     %-5s %s' % (n, t[:150]))
    print('\nZ13 symbols in other files: ' + ' '.join('%s[%s]' % (c, ','.join(n for n in NAMES[1:] if c in alph[n]) or '-') for c in sorted(alph['z13'])))
    print('Z32 symbols in other files: ' + ' '.join('%s[%s]' % (c, ','.join(n for n in ['z13', 'z408', 'z340'] if c in alph[n]) or '-') for c in sorted(alph['z32'])))
    print('\nDerived-field changes: %d' % len(changes))
    for c in changes:
        print('  ' + c)
    print('Problems: %d' % len(problems))
    for p in problems:
        print('  ' + p)

    if table:
        print_table(data, alph, desc)

    if '--export-variants' in sys.argv:
        export_variants(data)

    if write and changes:
        # only rewrite files that changed, so the other files keep their own layout
        touched = [n for n in NAMES if any(c.startswith(n + ' ') or c.startswith(n + ':') for c in changes)]
        for n in touched:
            save(n, data[n])
        print('\nWrote derived fields to: ' + ', '.join('data/ciphers/%s.json' % n for n in touched))
    elif write:
        print('\nNothing to write: all derived fields are current.')
    return 1 if (problems or (changes and not write)) else 0


def export_variants(data):
    """Write each distinct transcription variant of Z13/Z32 as a one-line text file,
    data/ciphers/variants/<id>.txt, so solvers can take it as --cipher FILE. (Raw strings on the
    command line are unsafe here: node is a Volta shim that passes arguments through cmd.exe,
    which mangles | % ^ & and similar characters.)"""
    out = os.path.join(CIPH, 'variants')
    os.makedirs(out, exist_ok=True)
    for n in ['z13', 'z32']:
        seen = set()
        for v in data[n].get('transcription_variants', []):
            a = v['ascii']
            if a in seen:
                continue
            seen.add(a)
            p = os.path.join(out, v['id'] + '.txt')
            with open(p, 'w', encoding='ascii', newline='\n') as f:
                f.write(a + '\n')
            print('exported %s' % os.path.relpath(p, ROOT).replace(os.sep, '/'))


def letters_408(data, c):
    d = data['z408']
    if c not in d['key']:
        return ''
    k = d['key'][c]
    poly = d.get('key_polyphones_in_plaintext', {}).get(c)
    if poly:
        return '%s (plaintext: %s)' % (k, ', '.join('%s %dx' % (l, n) for l, n in poly.items()))
    return k


def letters_340(data, c):
    d = data['z340']
    return d['key'].get(c, '')


def print_table(data, alph, desc):
    allc = sorted(set().union(*alph.values()), key=lambda c: (not c.isupper(), not c.islower(), c))
    print('\n| ASCII | glyph | Z13 | Z32 | Z408 | Z340 | Z408 letter | Z340 letter |')
    print('|---|---|---|---|---|---|---|---|')
    for c in allc:
        d0 = next(iter(desc[c].values()))
        cnt = {n: data[n]['ascii'].count(c) for n in NAMES}
        cell = lambda n: str(cnt[n]) if cnt[n] else ''
        print('| `%s` | %s | %s | %s | %s | %s | %s | %s |' % (
            c, d0.split(';')[0].replace('|', '/'), cell('z13'), cell('z32'), cell('z408'), cell('z340'),
            letters_408(data, c), letters_340(data, c)))


if __name__ == '__main__':
    sys.exit(main())
