"""Download the third-party source files that this repository does not redistribute.

Fetches into
  data/sources/        the files tools/build_calibration.py, tools/certify_ciphers.py and
                       tools/audit_wiki_parse.py read (Oranchak / AZdecrypt transcriptions,
                       Oranchak's 408 key page, Cipher Explorer's zodiac.js, the Z340 paper,
                       two zodiackillerciphers.com wiki pages, two Wikipedia wikitexts)
  tools/selftest_data/ the raw transcriptions listed in tools/selftest_data/sources.json
                       (only needed to rebuild the two *_selftest.json files with
                       tools/selftest_data/selftest_make_json.js)

and compares each file's SHA-256 with the value recorded in data/ciphers/z408.json and
z340.json when one exists. Web pages change, so a mismatch is reported, not fatal.
Files that already exist are skipped unless --force is given.

Usage: python tools/fetch_sources.py [--force] [--selftest-only | --sources-only]
"""
import hashlib
import json
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.dont_write_bytecode = True
UA = 'zodiac-z13-z32-fetch/1.0 (research; one-off download of cited sources)'

EXTRA = {
    'wiki_z13_solutions.html': 'https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions',
    'wp_unicity_distance.wiki': 'https://en.wikipedia.org/w/index.php?title=Unicity_distance&action=raw',
    'wp_zodiac_killer.wiki': 'https://en.wikipedia.org/w/index.php?title=Zodiac_Killer&action=raw',
}


def recorded_hashes():
    out = {}
    for name in ('z408', 'z340'):
        p = os.path.join(ROOT, 'data', 'ciphers', name + '.json')
        try:
            with open(p, encoding='utf-8') as f:
                d = json.load(f)
        except (OSError, ValueError):
            continue
        for s in d.get('sources', []):
            if isinstance(s, dict) and s.get('local_file') and s.get('sha256'):
                out[s['local_file']] = s['sha256']
    return out


def fetch(url, dest, force):
    rel = os.path.relpath(dest, ROOT).replace('\\', '/')
    if os.path.exists(dest) and not force:
        print('skip (exists)', rel)
        return True
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as f:
                f.write(body)
            print('got ', rel, len(body), 'bytes')
            return True
        except Exception as e:  # network errors are reported, never fatal for the rest
            if attempt == 2:
                print('FAIL', rel, url, e)
                return False
            time.sleep(3 * (attempt + 1))
    return False


def main():
    if any(a in ('-h', '--help') for a in sys.argv[1:]):
        print(__doc__)
        return 0
    force = '--force' in sys.argv
    jobs = []
    if '--selftest-only' not in sys.argv:
        from build_calibration import URLS
        for fn, url in list(URLS.items()) + list(EXTRA.items()):
            jobs.append((url, os.path.join(ROOT, 'data', 'sources', fn)))
    if '--sources-only' not in sys.argv:
        with open(os.path.join(ROOT, 'tools', 'selftest_data', 'sources.json'), encoding='utf-8') as f:
            st = json.load(f)
        for fn, url in st['files'].items():
            jobs.append((url.split()[0], os.path.join(ROOT, 'tools', 'selftest_data', fn)))
    hashes = recorded_hashes()
    ok = True
    for url, dest in jobs:
        ok = fetch(url, dest, force) and ok
        rel = os.path.relpath(dest, ROOT).replace('\\', '/')
        if rel in hashes and os.path.exists(dest):
            with open(dest, 'rb') as f:
                h = hashlib.sha256(f.read()).hexdigest()
            print('     sha256', 'matches the recorded value' if h == hashes[rel] else
                  'DIFFERS from the recorded value (the page changed since 2026-10-07)')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
