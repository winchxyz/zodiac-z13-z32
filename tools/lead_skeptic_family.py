"""tools/lead_skeptic_family.py - chance of at least one p <= x among m independent tests, and pooled objective p.
python tools/lead_skeptic_family.py > results/lead/skeptic/family.json
"""
import json
out = {'P_any_le': {}}
for p in (0.0051, 0.0102, 0.008, 0.0154):
    out['P_any_le'][str(p)] = {str(m): round(1 - (1 - p) ** m, 3) for m in (8, 24, 48, 96, 156)}
# pooled objective p: original 7/10000 (seed 1970) + this audit 13/10000 (seed 777)
out['objective_pooled_p'] = (7 + 13 + 1) / (20000 + 1)
# arrangement ranks -> p (rank / 360) for the Z340 and Z408 real pins, from results/lead/skeptic/check.json
c = json.load(open('results/lead/skeptic/check.json'))
out['arrangement_p'] = {k: {st: round(v[st]['rank'] / v['n'], 4) for st in ('t1', 't2', 't3', 'obj', 'wf')} for k, v in c['arrangements'].items()}
out['null_p'] = {k: {st: round(v[st]['p'], 4) for st in ('t1', 't2', 't3', 'obj', 'wf')} for k, v in c['nulls'].items()}
print(json.dumps(out, indent=1))
