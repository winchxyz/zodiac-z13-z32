"""Confirm repeat-window facts used in the prior-art table (task priorart, finding F3).

1. Smallest window of Z408 / Z340 (written order, and Z340 reading order) holding as many
   repeats as Z13. 'Repeats' = window length - distinct symbols (Z13: 13 - 8 = 5). This is
   Oranchak's 2012 comparison (22 symbols for Z408, 15 for Z340).
2. Whether any window of 5 consecutive symbols in the solved ciphers holds one symbol 3 times.

Reads only the `ascii` (and `read_order`) fields of data/ciphers/z408.json and z340.json.
Usage: python tools/lead_priorart_windows.py
Output: results/lead/priorart/windows.json
"""
import json
import os
from collections import Counter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def load(name):
    with open(os.path.join(ROOT, "data", "ciphers", name), encoding="utf-8") as f:
        return json.load(f)


def smallest_window(s, need):
    best = None
    for L in range(1, len(s) + 1):
        hits = [i for i in range(len(s) - L + 1) if L - len(set(s[i:i + L])) >= need]
        if hits:
            best = (L, hits[:5], len(hits))
            break
    return best


def dominates(window, target=(3, 2, 2, 2)):
    """True if the window's repeat profile covers Z13's: sorted counts >= 3,2,2,2."""
    c = sorted(Counter(window).values(), reverse=True)
    c = c + [0] * (len(target) - len(c))
    return all(a >= b for a, b in zip(c, target))


def smallest_window_profile(s, target=(3, 2, 2, 2)):
    for L in range(1, len(s) + 1):
        hits = [i for i in range(len(s) - L + 1) if dominates(s[i:i + L], target)]
        if hits:
            return (L, hits[:5], len(hits))
    return None


def triple_in_window(s, w=5):
    out = []
    for i in range(len(s) - w + 1):
        c = Counter(s[i:i + w])
        if max(c.values()) >= 3:
            out.append((i, s[i:i + w]))
    return out


def main():
    z13 = load("z13.json")["ascii"]
    z408 = load("z408.json")["ascii"]
    z340j = load("z340.json")
    z340 = z340j["ascii"]
    ro = z340j.get("read_order")
    z340r = "".join(z340[i] for i in ro) if ro else None
    need = len(z13) - len(set(z13))
    res = {"z13_repeats": need, "lengths": {"z408": len(z408), "z340": len(z340)}}
    for name, s in [("z408", z408), ("z408_first390", z408[:390]), ("z340_written", z340),
                    ("z340_reading", z340r)]:
        if s is None:
            continue
        L, starts, n = smallest_window(s, need)
        Lp, startsp, nP = smallest_window_profile(s)
        res[name] = {"smallest_window_with_%d_repeats" % need: L, "first_starts": starts,
                     "n_windows_of_that_length": n,
                     "smallest_window_with_profile_3_2_2_2": Lp, "profile_first_starts": startsp,
                     "five_windows_with_a_triple": len(triple_in_window(s, 5)),
                     "z13_window_check": "Z13 itself has a triple in a 5-window: %s" % bool(triple_in_window(z13, 5))}
    with open(os.path.join(ROOT, "results", "lead", "priorart", "windows.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
