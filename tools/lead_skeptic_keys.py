"""tools/lead_skeptic_keys.py - recompute Z408/Z340 key agreement and the capital-glyph letter bias.
Reads only the `key` fields of data/ciphers/z408.json and z340.json (no plaintext).
python tools/lead_skeptic_keys.py > results/lead/skeptic/keys.json
"""
import json, re, random
from collections import Counter
k408 = json.load(open('data/ciphers/z408.json'))['key']
k340 = json.load(open('data/ciphers/z340.json'))['key']
k408 = {s: l.upper() for s, l in k408.items()}; k340 = {s: l.upper() for s, l in k340.items()}
shared = sorted(set(k408) & set(k340))
agree = [s for s in shared if k408[s] == k340[s]]
# expected agreements under independent letter assignment (product of marginal frequencies)
c408 = Counter(k408.values()); c340 = Counter(k340.values())
exp = sum(c408[L] / len(k408) * c340[L] / len(k340) for L in set(c408) | set(c340)) * len(shared)
# permutation p: shuffle Z340 letters among Z340 symbols
rng = random.Random(4242); ge = 0; N = 20000
syms = list(k340); lets = list(k340.values())
for _ in range(N):
    rng.shuffle(lets); m = dict(zip(syms, lets))
    if sum(k408[s] == m[s] for s in shared) >= len(agree): ge += 1
TOP = set('ETAOINSHR')
cap = [s for s in k340 if re.fullmatch('[A-Z]', s)]
out = {
  'shared': len(shared), 'agree': len(agree), 'agreeSymbols': agree, 'expectedAgree': round(exp, 3),
  'permP_agree_ge_observed': (ge + 1) / (N + 1),
  'z13pins_z340': {s: k340[s] for s in 'AENzKM'}, 'z13pins_z408': {s: k408[s] for s in 'AENzKM'},
  'z340_capitals': len(cap), 'z340_capitals_topletters_share': round(sum(k340[s] in TOP for s in cap) / len(cap), 3),
  'z340_all_topletters_share': round(sum(l in TOP for l in k340.values()) / len(k340), 3),
  'z408_capitals_topletters_share': round(sum(k408[s] in TOP for s in k408 if re.fullmatch('[A-Z]', s)) / sum(1 for s in k408 if re.fullmatch('[A-Z]', s)), 3),
  'z408_all_topletters_share': round(sum(l in TOP for l in k408.values()) / len(k408), 3),
}
print(json.dumps(out, indent=1))
