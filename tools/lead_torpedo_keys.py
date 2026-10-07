"""tools/lead_torpedo_keys.py - step 5 of the `torpedo` task: is reuse of the Z340 key for Z13 a priori
plausible, given how Zodiac built and changed his keys?

Reads data/ciphers/{z408,z340,z13,z32}.json (keys and ascii only; no plaintext is read or printed) and
writes results/lead/torpedo/keys.json with:
  * glyph classes of each key: normal capital-letter glyphs (A-Z in the ASCII convention), how many decode
    to their own letter, the crosshair's letter;
  * Z408 vs Z340: shared symbols, agreements, permutation null (100,000 shuffles, seed 1970);
  * Z13 and Z32 glyph composition (capital-letter glyphs vs other) against Z340's;
  * for the reading DREAM A TORPEDO: which letters the new glyphs would carry and how many homophones the
    Z340 key already has for them; the letters with no Z340 symbol (the "key extension" alphabet);
  * the homophone choice the reuse hypothesis implies for the six pinned symbols, with the chance that a
    uniformly random homophone of the same letter is a capital-letter glyph;
  * multiplicity arithmetic: 1-(1-p)^m for the project's family-wise p values, and the Sellke-Bayarri-Berger
    bound 1/(-e p ln p) on the Bayes factor.

    python tools/lead_torpedo_keys.py
"""
import json, math, os, random

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'results', 'lead', 'torpedo', 'keys.json')


def load(name):
    with open(os.path.join(ROOT, 'data', 'ciphers', name + '.json'), encoding='utf8') as f:
        return json.load(f)


def is_cap(s):
    return len(s) == 1 and 'A' <= s <= 'Z'


def main():
    z408, z340, z13, z32 = load('z408'), load('z340'), load('z13'), load('z32')
    k408, k340 = z408['key'], z340['key']
    out = {'tool': 'tools/lead_torpedo_keys.py'}

    # glyph classes and self-decoding
    cls = {}
    for name, k, ascii_ in (('z408', k408, z408['ascii']), ('z340', k340, z340['ascii'])):
        caps = [s for s in k if is_cap(s)]
        selfdec = [s for s in caps if k[s] == s]
        occ_caps = sum(1 for ch in ascii_ if is_cap(ch))
        cls[name] = {
            'symbols': len(k), 'capitalGlyphs': len(caps), 'capitalSelfDecoding': selfdec,
            'expectedSelfDecodingIfRandom': round(sum(sum(1 for v in k.values() if v == s) / len(k) for s in caps), 3),
            'crosshair_z': k.get('z'), 'occurrences': len(ascii_), 'capitalOccurrences': occ_caps,
            'capitalOccurrenceShare': round(occ_caps / len(ascii_), 3),
        }
    out['glyphClasses'] = cls

    # Z408 vs Z340 agreement on shared symbols
    shared = sorted(set(k408) & set(k340))
    agree = [s for s in shared if k408[s] == k340[s]]
    rng = random.Random(1970)
    letters340 = [k340[s] for s in shared]
    ge = 0
    tot = 0
    N = 100000
    for _ in range(N):
        rng.shuffle(letters340)
        a = sum(1 for s, l in zip(shared, letters340) if k408[s] == l)
        tot += a
        if a >= len(agree):
            ge += 1
    out['z408_vs_z340'] = {'shared': len(shared), 'agree': len(agree), 'agreeSymbols': agree,
                           'nullMeanAgree': round(tot / N, 3), 'p_ge': round((ge + 1) / (N + 1), 4), 'nPerm': N}

    # Z13 / Z32 composition
    def comp(ascii_):
        syms = sorted(set(ascii_))
        return {'distinct': len(syms), 'capitalGlyphSymbols': sum(1 for s in syms if is_cap(s)),
                'capitalOccurrences': sum(1 for ch in ascii_ if is_cap(ch)), 'length': len(ascii_),
                'inZ340': sum(1 for s in syms if s in k340), 'inZ408': sum(1 for s in syms if s in k408)}
    out['composition'] = {'z13': comp(z13['ascii']), 'z32': comp(z32['ascii']),
                          'z340': comp(z340['ascii']), 'z408': comp(z408['ascii'])}

    # homophones of the Z340 key per letter
    hom = {}
    for s, l in k340.items():
        hom.setdefault(l, []).append(s)
    out['z340LettersWithoutSymbol'] = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' if c not in hom]
    need = {'M': 'circle at 4', 'T': 'circle at 6', 'R': 'circle at 8', 'P': "hook '[' at 9"}
    out['dreamATorpedoNewGlyphLetters'] = {l: {'carriedBy': where, 'z340Homophones': hom.get(l, []),
                                               'z340HomophoneCount': len(hom.get(l, []))} for l, where in need.items()}
    # the reuse hypothesis: pinned symbols and the alternatives Zodiac had for the same letter
    pinned = {}
    pcap = []
    for s in ['A', 'E', 'N', 'z', 'K', 'M']:
        l = k340[s]
        alts = hom[l]
        frac_cap = sum(1 for a in alts if is_cap(a)) / len(alts)
        pinned[s] = {'letter': l, 'homophones': alts, 'capitalShareAmongHomophones': round(frac_cap, 3), 'chosenIsCapital': is_cap(s)}
        pcap.append(frac_cap if is_cap(s) else 1 - frac_cap)
    out['reuseHomophoneChoice'] = {'pinned': pinned,
                                   'probabilityOfObservedGlyphClassPattern_uniformHomophone': round(math.prod(pcap), 4)}
    # Z340 circle-family glyphs (filled / open circles) and their letters
    fam = ['1', '2', '3', '4', '5', '6', '(']
    out['z340CircleFamily'] = {s: k340.get(s) for s in fam}

    # multiplicity arithmetic
    mult = {}
    for p in (0.0051, 0.0102, 0.012):
        mult[str(p)] = {
            'P_at_least_one_of_m_tests_at_or_below_p': {str(m): round(1 - (1 - p) ** m, 3) for m in (12, 24, 48, 96)},
            'maxBayesFactor_SellkeBayarriBerger': round(1 / (-math.e * p * math.log(p)), 2),
        }
    out['multiplicity'] = mult
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
