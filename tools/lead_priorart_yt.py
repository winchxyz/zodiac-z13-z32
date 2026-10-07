"""Fetch YouTube video metadata (title, publish date, description) and, when available,
the English caption track, for the prior-art search (task priorart).

Usage:
    python tools/lead_priorart_yt.py VIDEO_ID [VIDEO_ID ...]
    python tools/lead_priorart_yt.py --search QUERY WORDS     (list videoId | title from a results page)

Writes results/lead/priorart/yt/<id>.json (meta) and <id>.captions.txt (if captions fetched).
Prints title, date and the first 600 characters of the description for each id.
Read-only network access to youtube.com; nothing is executed from the fetched pages.
"""
import json
import os
import re
import sys
import urllib.request
import html as htmlmod

OUT = os.path.join(os.path.dirname(__file__), "..", "results", "lead", "priorart", "yt")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", errors="replace")


def extract_json_obj(s, marker):
    i = s.find(marker)
    if i < 0:
        return None
    j = s.find("{", i)
    depth = 0
    in_str = False
    esc = False
    for k in range(j, len(s)):
        c = s[k]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(s[j:k + 1])
                    except Exception:
                        return None
    return None


def captions(pr):
    try:
        tracks = pr["captions"]["playerCaptionsTracklistRenderer"]["captionTracks"]
    except Exception:
        return None, "no caption tracks"
    pick = None
    for t in tracks:
        if t.get("languageCode", "").startswith("en"):
            pick = t
            break
    if pick is None:
        pick = tracks[0]
    url = pick["baseUrl"]
    try:
        xml = get(url)
    except Exception as e:
        return None, "caption fetch failed: %s" % e
    if not xml.strip():
        return None, "caption fetch returned empty body"
    parts = re.findall(r"<text[^>]*>(.*?)</text>", xml, flags=re.S)
    if not parts:
        parts = re.findall(r"<s[^>]*>(.*?)</s>", xml, flags=re.S)
    txt = " ".join(htmlmod.unescape(htmlmod.unescape(p)) for p in parts)
    txt = re.sub(r"\s+", " ", txt)
    return txt, "ok (%s)" % pick.get("languageCode")


def search(query):
    """List (videoId, title) pairs from a YouTube results page."""
    s = get("https://www.youtube.com/results?search_query=" + urllib.parse.quote(query))
    seen = []
    for m in re.finditer(r'"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"', s):
        vid, title = m.group(1), json.loads('"' + m.group(2) + '"')
        if vid not in [v for v, _ in seen]:
            seen.append((vid, title))
    for vid, title in seen:
        print(vid, "|", title)


def main(ids):
    os.makedirs(OUT, exist_ok=True)
    for vid in ids:
        try:
            s = get("https://www.youtube.com/watch?v=" + vid)
        except Exception as e:
            print(vid, "FETCH FAILED", e)
            continue
        pr = extract_json_obj(s, "ytInitialPlayerResponse = ")
        meta = {"id": vid}
        if pr:
            vd = pr.get("videoDetails", {})
            mf = pr.get("microformat", {}).get("playerMicroformatRenderer", {})
            meta.update({
                "title": vd.get("title"),
                "author": vd.get("author"),
                "publishDate": mf.get("publishDate"),
                "description": vd.get("shortDescription"),
            })
            txt, status = captions(pr)
        else:
            t = re.search(r"<title>(.*?)</title>", s)
            meta["title"] = t.group(1) if t else None
            txt, status = None, "no player response"
        meta["captions_status"] = status
        with open(os.path.join(OUT, vid + ".json"), "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=1, ensure_ascii=False)
        if txt:
            with open(os.path.join(OUT, vid + ".captions.txt"), "w", encoding="utf-8") as f:
                f.write(txt)
        print("==", vid, "|", meta.get("title"), "|", meta.get("publishDate"), "|", status,
              "| captions chars:", len(txt) if txt else 0)
        print((meta.get("description") or "")[:600].replace("\n", " "))


if __name__ == "__main__":
    import urllib.parse  # noqa: F401  (used by search)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    if len(sys.argv) > 2 and sys.argv[1] == "--search":
        search(" ".join(sys.argv[2:]))
    else:
        main(sys.argv[1:])
