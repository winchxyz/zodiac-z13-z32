"""Check MARVIN MERRILL against Z13 under the 2-row "box permutation" family that the public
Colab notebook (described at 0xfab1.net/tech/hack/ciphers/zodiac-z13.html) attributes to the
Baber/Henry method, and compare with the columnar family used in results/audit.

Box permutation (as the notebook describes it): insert one null '_' into the 13-letter text at
position p (0..13), write the 14 characters in 2 rows of 7, permute the 7 columns by pi, read
the rows left to right, drop the null. Both directions are enumerated:
  enc: plaintext -> (null, permute) -> text that must match the cipher's repeat pattern
  dec: cipher positions -> (null, inverse permute) -> plaintext order
Fit is tested as simple substitution (pattern identical) and homophonic (equal cipher symbols ->
equal letters).

Also reports the share of random profile-matching FIRST+LAST names (R3 M2 I2 L2-type profile,
same letter-count profile as Z13) that fit under at least one order of this family (null rate).

Usage: python tools/lead_priorart_boxperm.py [--names 300] [--seed 2026]
Output: results/lead/priorart/boxperm.json
"""
import argparse
import itertools
import json
import os
import random
from collections import Counter

import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "results", "lead", "priorart", "boxperm.json")


def load_z13():
    with open(os.path.join(ROOT, "data", "ciphers", "z13.json"), encoding="utf-8") as f:
        return json.load(f)["ascii"]


def box_orders(n=13, w=7):
    """Return dict order(tuple of source plaintext indices, in cipher order) -> description."""
    orders = {}
    for p in range(n + 1):
        ins = list(range(p)) + [-1] + list(range(p, n))  # -1 = null
        rows = [ins[0:w], ins[w:2 * w]]
        for pi in itertools.permutations(range(w)):
            out = [rows[r][pi[j]] for r in range(2) for j in range(w)]
            out = tuple(x for x in out if x >= 0)
            if out not in orders:
                orders[out] = "enc p=%d pi=%s" % (p, "".join(str(x + 1) for x in pi))
    # decryption direction: null inserted into the cipher text at q, inverse permutation
    for q in range(n + 1):
        ins = list(range(q)) + [-1] + list(range(q, n))  # cipher positions
        rows = [ins[0:w], ins[w:2 * w]]
        for pi in itertools.permutations(range(w)):
            # cipher row'[j] = plain row[pi[j]]  =>  plain row[pi[j]] = cipher row'[j]
            plain_rows = [[None] * w for _ in range(2)]
            for r in range(2):
                for j in range(w):
                    plain_rows[r][pi[j]] = rows[r][j]
            plain = [x for r in range(2) for x in plain_rows[r] if x >= 0]
            # plain[k] = cipher position holding plaintext letter k -> invert to cipher order
            order = [None] * n
            for k, cpos in enumerate(plain):
                order[cpos] = k
            order = tuple(order)
            if order not in orders:
                orders[order] = "dec q=%d pi=%s" % (q, "".join(str(x + 1) for x in pi))
    return orders


def general_box_orders(n=13, R=2, W=7):
    """Wider 2x7 family: one null at any of the 14 text positions; fill the grid row-major or
    column-major; permute the columns (any of 7!) and optionally swap the two rows; read the grid
    row-major or column-major. Both directions (null in plaintext / null in ciphertext).
    Returns a set of orders (tuple: plaintext index at each cipher position)."""
    cells = R * W
    fills = {
        "row": [(r, c) for r in range(R) for c in range(W)],
        "col": [(r, c) for c in range(W) for r in range(R)],
    }
    out = set()
    for p in range(n + 1):
        seq = list(range(p)) + [-1] + list(range(p, n))
        for fname, fill in fills.items():
            grid = {}
            for k, rc in enumerate(fill):
                grid[rc] = seq[k]
            for pi in itertools.permutations(range(W)):
                for swap in (False, True):
                    def at(r, c):
                        rr = (1 - r) if swap else r
                        return grid[(rr, pi[c])]
                    for rname, rd in fills.items():
                        o = tuple(x for x in (at(r, c) for (r, c) in rd) if x >= 0)
                        out.add(o)  # enc: plaintext index at each cipher position
                        inv = [None] * n
                        for k, src in enumerate(o):
                            inv[src] = k
                        out.add(tuple(inv))  # dec direction (inverse map)
    return out


def general_box_orders_described(n=13, R=2, W=7):
    """Same family as general_box_orders, but returns dict order -> list of descriptions
    'p=<null pos> fill=<row|col> pi=<1-based column order> swap=<0|1> read=<row|col> dir=<enc|dec>'."""
    fills = {
        "row": [(r, c) for r in range(R) for c in range(W)],
        "col": [(r, c) for c in range(W) for r in range(R)],
    }
    out = {}
    for p in range(n + 1):
        seq = list(range(p)) + [-1] + list(range(p, n))
        for fname, fill in fills.items():
            grid = {rc: seq[k] for k, rc in enumerate(fill)}
            for pi in itertools.permutations(range(W)):
                for swap in (0, 1):
                    for rname, rd in fills.items():
                        o = tuple(x for x in (grid[((1 - r) if swap else r, pi[c])] for (r, c) in rd) if x >= 0)
                        inv = [None] * n
                        for k, src in enumerate(o):
                            inv[src] = k
                        tag = "p=%d fill=%s pi=%s swap=%d read=%s" % (p, fname, "".join(str(x + 1) for x in pi), swap, rname)
                        out.setdefault(o, []).append(tag + " dir=enc")
                        out.setdefault(tuple(inv), []).append(tag + " dir=dec")
    return out


def columnar_orders(n=13, wmax=8):
    """Same family as tools/audit_review_checks.js columnarOrders (plus inverses)."""
    res = set()
    for w in range(2, wmax + 1):
        for p in itertools.permutations(range(w)):
            o = [r * w + c for c in p for r in range(n) if r * w + c < n]
            res.add(tuple(o))
            inv = [None] * n
            for k, src in enumerate(o):
                inv[src] = k
            res.add(tuple(inv))
    return res


def eq_matrix(seq):
    a = np.array([ord(c) for c in seq])
    return a[:, None] == a[None, :]


def fits(cipher_eq, O, name):
    x = np.array([ord(c) for c in name])
    S, H = [], []
    for i in range(0, len(O), 100_000):
        T = x[O[i:i + 100_000]]  # K x 13: letter at cipher position i
        Teq = T[:, :, None] == T[:, None, :]
        S.append(np.all(Teq == cipher_eq[None], axis=(1, 2)))
        H.append(np.all(~cipher_eq[None] | Teq, axis=(1, 2)))
    return np.concatenate(S), np.concatenate(H)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--names", type=int, default=300)
    ap.add_argument("--seed", type=int, default=2026)
    a = ap.parse_args()
    z13 = load_z13()
    ceq = eq_matrix(z13)
    box = box_orders()
    col = columnar_orders()
    gen = general_box_orders()
    Ob = np.array(list(box.keys()))
    Oc = np.array(sorted(col))
    Og = np.array(sorted(gen))
    keys_b = list(box.values())
    res = {"z13": z13, "box_orders_distinct": len(box), "columnar_orders_distinct": len(col),
           "box_and_columnar_overlap": len(set(box.keys()) & col),
           "general_2x7_orders_distinct": len(gen),
           "general_contains_all_box": set(box.keys()) <= gen}
    for nm in ["MARVINMERRILL"]:
        s, h = fits(ceq, Ob, nm)
        sc, hc = fits(ceq, Oc, nm)
        sg, hg = fits(ceq, Og, nm)
        ex = [(keys_b[i], "".join(nm[j] for j in Ob[i])) for i in np.nonzero(s)[0][:20]]
        res[nm] = {"box_simple_fits": int(s.sum()), "box_homophonic_fits": int(h.sum()),
                   "columnar_simple_fits": int(sc.sum()), "columnar_homophonic_fits": int(hc.sum()),
                   "general_2x7_simple_fits": int(sg.sum()), "general_2x7_homophonic_fits": int(hg.sum()),
                   "box_simple_examples": ex}
    # which Z13 transcription variants would let MARVINMERRILL fit under the plain box family?
    var_dir = os.path.join(ROOT, "data", "ciphers", "variants")
    vres = {}
    if os.path.isdir(var_dir):
        for fn in sorted(os.listdir(var_dir)):
            if fn.startswith("z13.") and fn.endswith(".txt"):
                v = open(os.path.join(var_dir, fn), encoding="utf-8").read().strip()
                if len(v) != 13:
                    vres[fn] = "length %d, skipped" % len(v)
                    continue
                ve = eq_matrix(v)
                s2, h2 = fits(ve, Og, "MARVINMERRILL")
                vres[fn] = {"general_2x7_simple": int(s2.sum()), "general_2x7_homophonic": int(h2.sum())}
    res["MARVINMERRILL_by_variant"] = vres
    # Which 2x7 orders fit under circles_distinct, and does the reported LIZABETH key appear?
    # Reported key (secondary sources): L I Z A B E T H with Z unused -> L I A B E T H numbered
    # alphabetically = 6 5 1 2 3 7 4 (A1 B2 E3 H4 I5 L6 T7).
    cd_path = os.path.join(var_dir, "z13.circles_distinct.txt")
    if os.path.exists(cd_path):
        cd = open(cd_path, encoding="utf-8").read().strip()
        desc = general_box_orders_described()
        keys = list(desc.keys())
        Od = np.array(keys)
        s3, h3 = fits(eq_matrix(cd), Od, "MARVINMERRILL")
        hits = [i for i in np.nonzero(h3)[0]]
        key_digits = "6512374"  # numbers written above the columns, left to right
        # column read/write order implied by that key: column with number 1 first, etc.
        read_order = "".join(str(key_digits.index(str(d)) + 1) for d in range(1, 8))
        lz = []
        for i in hits:
            for t in desc[keys[i]]:
                if ("pi=" + key_digits) in t or ("pi=" + read_order) in t:
                    lz.append(t + " -> " + "".join("MARVINMERRILL"[j] for j in keys[i]))
        res["circles_distinct_detail"] = {
            "cipher": cd, "orders": len(keys), "homophonic_fits": len(hits),
            "simple_fits": int(s3.sum()),
            "key_numbers": key_digits, "key_read_order": read_order,
            "fits_using_LIZABETH_key": lz[:40],
            "n_fits_using_LIZABETH_key": len(lz),
            "example_fits": [desc[keys[i]][0] + " -> " + "".join("MARVINMERRILL"[j] for j in keys[i]) for i in hits[:12]],
        }
    # ELIZABETH keyword permutation as quoted in search snippets: "6 5 _ 1 2 3 7 4"
    # (one column label unused). Report which box orders fit for each reading of that key.
    # null rate with random profile-matching names
    rd = lambda f, top: [l.split("\t")[0].strip() for l in open(os.path.join(ROOT, "data", "names", f), encoding="latin-1").read().split("\n") if l.strip()][:top]
    F = rd("first_all.tsv", 3000)
    L = rd("surnames.tsv", 30000)
    prof = lambda s: tuple(sorted(Counter(s).values(), reverse=True))
    zp = prof(z13)
    rng = random.Random(a.seed)
    sample = []
    tries = 0
    while len(sample) < a.names and tries < 10_000_000:
        tries += 1
        f = rng.choice(F)
        cand = [s for s in (rng.choice(L) for _ in range(1))]
        x = f + cand[0]
        if len(x) == 13 and x.isalpha() and prof(x) == zp:
            sample.append(x)
    nb_s = nb_h = nc_s = 0
    for x in sample:
        s, h = fits(ceq, Ob, x)
        sc, _ = fits(ceq, Oc, x)
        nb_s += bool(s.any())
        nb_h += bool(h.any())
        nc_s += bool(sc.any())
    res["null"] = {"names": len(sample), "draws": tries, "seed": a.seed,
                   "share_fit_box_simple": nb_s / max(1, len(sample)),
                   "share_fit_box_homophonic": nb_h / max(1, len(sample)),
                   "share_fit_columnar_simple": nc_s / max(1, len(sample))}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
