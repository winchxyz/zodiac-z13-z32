"""tools/lead_torpedo_derived.py - derived ratios for the `torpedo` task (reads summary.json, twocircle.json,
null.jsonl); prints them and writes results/lead/torpedo/derived.json.

    python tools/lead_torpedo_derived.py
"""
import json, os
D = os.path.join(os.path.dirname(__file__), '..', 'results', 'lead', 'torpedo')
s = json.load(open(os.path.join(D, 'summary.json')))
two = json.load(open(os.path.join(D, 'twocircle.json')))
rows = [json.loads(l) for l in open(os.path.join(D, 'null.jsonl'))]
S = -12.1784
ANY7 = ['bomb', 'letter', 'zodiac', 'insult', 'place', 'case', 'firstname', 'fullname']
out = {}
for kind in ('permute', 'stratified'):
    K = s['byKind'][kind]
    R = [r for r in rows if r['kind'] == kind]
    fl = [r for r in R if r['c']['nS'] >= 1]
    any7 = sum(1 for r in fl if any(r['c']['cat'][c]['7'][0] and r['c']['cat'][c]['7'][1] >= S - 1e-4 for c in ANY7))
    f = K['fluency']['circles_any_ge_DREAM_A_TORPEDO']['rate']
    j_b7 = K['circles']['bomb7']['score>=DREAM_A_TORPEDO']['rate']
    j_any7 = K['circles']['any7']['score>=DREAM_A_TORPEDO']['rate']
    j_nar = K['circles']['narrow']['score>=DREAM_A_TORPEDO']['rate']
    b7r3 = K['circles']['bomb7']['rank<=3']['rate']
    union_b7 = 1 - (1 - K['canonical']['bomb7']['rank<=3']['rate']) * (1 - b7r3) * (1 - two['stats'][kind]['P46']['bomb7_rank3']['rate']) * (1 - two['stats'][kind]['P48']['bomb7_rank3']['rate']) * (1 - two['stats'][kind]['P68']['bomb7_rank3']['rate'])
    mult_read = union_b7 / b7r3 if b7r3 else None
    out[kind] = {
        'fluentKeys': len(fl), 'any7GivenFluent': f'{any7}/{len(fl)}', 'any7GivenFluentRate': round(any7 / len(fl), 4),
        'P_fluent': f, 'P_fluent_any7': j_any7, 'P_fluent_bomb7': j_b7, 'P_fluent_narrow': j_nar,
        'LR_content_any7': round(f / j_any7, 1) if j_any7 else None,
        'LR_content_narrow': round(f / j_nar, 1) if j_nar else None,
        'readingsMultiplier_bomb7rank3': round(mult_read, 2) if mult_read else None,
        'LR_content_any7_after_readings_and_keys': round(f / j_any7 / ((mult_read or 1) * 2), 1) if j_any7 else None,
        'LR_content_narrow_after_readings_and_keys': round(f / j_nar / ((mult_read or 1) * 2), 1) if j_nar else None,
        'corrected_joint_any7_x_readings_x_2keys': round(min(1, j_any7 * (mult_read or 1) * 2), 4),
        'corrected_joint_narrow_x_readings_x_2keys': round(min(1, j_nar * (mult_read or 1) * 2), 4),
        'garlickLevel_narrow_circles': K['circles']['narrow']['score>=DR_EAT_A_TORPEDO']['rate'],
        'garlickLevel_narrow_P46': two['stats'][kind]['P46']['narrow_atScoreGeTarget']['rate'],
        'garlickLevel_bomb7_P46': two['stats'][kind]['P46']['bomb7_atScoreGeTarget']['rate'],
        'garlickLevel_anyCompletionAsFluent_P46': two['stats'][kind]['P46']['anyCompletionGeTargetScore']['rate'],
    }
pf = sum(out[k]['fluentKeys'] for k in out)
pb = sum(int(s['byKind'][k]['conditional']['givenAnyCompletion_ge_DREAM_A_TORPEDO']['bomb7']['count']) for k in out)
out['pooled_bomb7GivenFluent'] = f'{pb}/{pf}'
out['pooled_bomb7GivenFluentRate'] = round(pb / pf, 4)
json.dump(out, open(os.path.join(D, 'derived.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))
