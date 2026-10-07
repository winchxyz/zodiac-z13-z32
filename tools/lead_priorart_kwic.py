"""Keyword-in-context over saved web pages (prior-art search helper).

Usage:
    python tools/lead_priorart_kwic.py --width 250 --max 4 FILE [FILE ...] -- KEYWORD [KEYWORD ...]

HTML files are stripped to text (scripts/styles removed) and saved next to them as .txt.
Keywords are case-insensitive regular expressions. Prints up to --max hits per keyword per file.
"""
import argparse
import html
import re
import sys


def to_text(path):
    raw = open(path, "rb").read()
    try:
        s = raw.decode("utf-8")
    except UnicodeDecodeError:
        s = raw.decode("latin-1")
    if path.lower().endswith((".html", ".htm")):
        s = re.sub(r"<script.*?</script>|<style.*?</style>", " ", s, flags=re.S | re.I)
        s = re.sub(r"<br\s*/?>|</p>|</div>|</li>|</h\d>", "\n", s, flags=re.I)
        s = html.unescape(re.sub(r"<[^>]+>", " ", s))
        s = re.sub(r"[ \t\r\f\v]+", " ", s)
        s = re.sub(r"\n\s*\n+", "\n", s)
        with open(re.sub(r"\.html?$", ".txt", path, flags=re.I), "w", encoding="utf-8") as f:
            f.write(s)
    return s


def main():
    argv = sys.argv[1:]
    if "--" not in argv:
        print(__doc__)
        sys.exit(2)
    i = argv.index("--")
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=250)
    ap.add_argument("--max", type=int, default=4)
    ap.add_argument("files", nargs="+")
    a = ap.parse_args(argv[:i])
    kws = argv[i + 1:]
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    for f in a.files:
        t = to_text(f)
        print("=====", f, "chars", len(t))
        for kw in kws:
            hits = list(re.finditer(kw, t, flags=re.I))
            if not hits:
                continue
            print("  [%s] %d hits" % (kw, len(hits)))
            for m in hits[: a.max]:
                ctx = t[max(0, m.start() - a.width): m.end() + a.width].replace("\n", " | ")
                print("    ..." + ctx + "...")


if __name__ == "__main__":
    main()
