#!/usr/bin/env node
// lead_decision_numbers.js
// Collects, from the lead and main-attack result files, every number cited in
// results/lead/DECISION.md, and adds a few derived multiplicity figures.
// Reads only result JSON files (no cipher plaintexts). Writes
// results/lead/decision/numbers.json and prints a compact summary.
//
// Usage: node tools/lead_decision_numbers.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const r4 = (x) => (typeof x === 'number' ? +x.toPrecision(4) : x);

const out = {};

// ---- 1. keyprior and its review (the original lead) ----
const fam = R('results/keyprior/review/family.json');
out.keyprior = {
  familywiseZ340_all8: r4(fam.familywise.z340.all8.familywiseP),
  familywiseZ408_all8: r4(fam.familywise.z408.all8.familywiseP),
  bothKeysSidak: r4(fam.bothKeysSidak),
};

// ---- 2. replication ----
const rep = R('results/lead/replicate/summary.json');
const repZ340 = rep.keys.z340.nulls.perm;
const repZ408 = rep.keys.z408.nulls.perm;
const pick = (tests, ks) => Object.fromEntries(ks.map((k) => [k, { p: r4(tests[k].p), pWY: r4(tests[k].pWY) }]));
out.replicate = {
  z340_perm: pick(repZ340.tests, ['canonical.t1', 'canonical.t2', 'canonical.t3', 'circles_distinct.t1', 'circles_distinct.t2', 'circles_distinct.t3']),
  z340_perm_wyMin12: r4(repZ340.wyMin),
  z408_perm: pick(repZ408.tests, ['canonical.t1', 'canonical.t2', 'canonical.t3']),
  z408_perm_wyMin12: r4(repZ408.wyMin),
  bestCanonical: rep.keys.z340.real.canonical.bestWords,
  bestCirclesDistinct: rep.keys.z340.real.circles_distinct.bestWords,
  validationPass: rep.validation.pass,
};
const z340nulls = R('results/lead/replicate/nulls_z340.json');
out.replicate.nullRangeCanonical = {};
for (const st of ['t1', 't2']) {
  const ps = [];
  for (const [name, nl] of Object.entries(z340nulls.nulls || {})) {
    const t = nl.tests && nl.tests['canonical.' + st];
    if (t && typeof t.p === 'number') ps.push([name, r4(t.p)]);
  }
  out.replicate.nullRangeCanonical[st] = ps;
}
const mult = R('results/lead/replicate/multiplicity.json');
const lead0 = (mult.leads || []).find((l) => Math.abs(l.p - 0.0051) < 1e-9) || {};
out.replicate.multiplicity = {
  distinctAll: mult.distinctAll,
  keypriorDistinct: mult.byTask && mult.byTask.keyprior && mult.byTask.keyprior.distinct,
  lead0051: { all: lead0.all, summaryFiles: lead0.summaryFiles, breakEvenM: r4(lead0.breakEvenM) },
};
const wb = R('results/lead/replicate/windows_best.json');
out.replicate.windowsBestT2 = wb.slice(0, 2).map((w) => ({ label: w.label, t2: r4(w.t2), best2: w.best2 }));
out.replicate.z13t2 = r4(rep.keys.z340.real.canonical.t2);

// ---- 3. skeptic: statistician ----
const st = R('results/lead/skeptic/stat/summary.json');
out.skepticStat = {
  multiverseZ340perm_wy36: r4(st.multiverse['z340/perm'].wy36),
  multiverseZ408perm_wy36: r4(st.multiverse['z408/perm'].wy36),
  multiverseZ340_wy36_range: [
    r4(Math.min(...Object.entries(st.multiverse).filter(([k]) => k.startsWith('z340')).map(([, v]) => v.wy36))),
    r4(Math.max(...Object.entries(st.multiverse).filter(([k]) => k.startsWith('z340')).map(([, v]) => v.wy36))),
  ],
  arrangementZ340_wy12: r4(st.arrangement['z340/all6'].wy12),
  arrangementZ340_canonical: st.arrangement['z340/all6'].canonical,
  arrangementZ408_canonicalM6: st.arrangement['z408/all6'].canonical.M6,
  arrangementZ408_wy12: r4(st.arrangement['z408/all6'].wy12),
  unigramOnlyP_Z340: r4(st.influence.z340.perm.U),
  arrangementWordLR: {
    canonical: r4(st.arrangementPowerW.canonical.bandLR),
    circles: r4(st.arrangementPowerW.circles_distinct.bandLR),
  },
  densityLR: {
    canonicalT2: r4(st.bayes.densityLR.canonical.t2.densityLR),
    circlesT1: r4(st.bayes.densityLR.circles_distinct.t1.densityLR),
    circlesT2: r4(st.bayes.densityLR.circles_distinct.t2.densityLR),
    circlesT3: r4(st.bayes.densityLR.circles_distinct.t3.densityLR),
  },
  sellke: Object.fromEntries(Object.entries(st.bayes.sellke).map(([k, v]) => [k, r4(v.bfUpperBound)])),
  posteriorAt5pct: Object.fromEntries(Object.entries(st.bayes.posterior).map(([k, v]) => [k, r4(v['0.05'])])),
  families: {
    analyses: st.families.analyses,
    analysesWithMinLe0051: st.families.analysesWithMinAtOrBelow['0.0051'],
    bhQ: Object.fromEntries(Object.entries(st.families.bh).map(([k, v]) => [k, r4(v.distinctValues.q)])),
    sidak51: Object.fromEntries(Object.entries(st.families.sidakAtAnalyses).map(([k, v]) => [k, r4(v.pAny)])),
  },
};

// ---- 4. skeptic: cipher expert ----
const ce = R('results/lead/cipherexpert/summary.json');
out.cipherExpert = {
  arrangementRanks: ce.arrangement_real_rank_of_360,
  arrangementPositiveControlCirclesMedian: {
    t1: ce.arrangement_positive_control.circles_distinct.t1.median,
    t2: ce.arrangement_positive_control.circles_distinct.t2.median,
    t3: ce.arrangement_positive_control.circles_distinct.t3.median,
  },
  jackknifeCanonical: ce.jackknife_canonical_p,
  nEqualsEConditional: Object.fromEntries(Object.entries(ce.n_equals_e_conditional_null_canonical).map(([k, v]) => [k, { t1: r4(v.t1), t2: r4(v.t2), t3: r4(v.t3) }])),
  strictReuseBest: ce.strict_reuse_new_glyphs_JKQXZ.canonical.bestT2,
  homophonePatternLog10p: ce.homophone_pattern_log10p,
  min13WindowDistinct: {
    z340reading: Math.min(...Object.keys(ce.thirteen_window_distinct_symbols.z340_13window_distinct_symbols_reading_order).map(Number)),
    z340written: Math.min(...Object.keys(ce.thirteen_window_distinct_symbols.z340_13window_distinct_symbols_written_order).map(Number)),
    z408: Math.min(...Object.keys(ce.thirteen_window_distinct_symbols.z408_13window_distinct_symbols).map(Number)),
  },
};

// ---- 5. skeptic: evidence auditor ----
const ck = R('results/lead/skeptic/check.json');
const hom = R('results/lead/skeptic/homophones.json');
const sfam = R('results/lead/skeptic/family.json');
out.auditor = {
  freshSeedZ340: Object.fromEntries(Object.entries(ck.nulls.z340).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => [k, r4(v.p)])),
  freshSeedZ408: Object.fromEntries(Object.entries(ck.nulls.z408).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => [k, r4(v.p)])),
  objectivePooledP: r4(sfam.objective_pooled_p),
  arrangementRanks: Object.fromEntries(Object.entries(ck.arrangements.z340).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => [k, v.rank])),
  arrangementRanksZ408: Object.fromEntries(Object.entries(ck.arrangements.z408).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => [k, v.rank])),
  h1Top2000_t2: { h1Mean: r4(ck.h1.top.t2.h1Mean), shareAtOrBelowObserved: ck.h1.top.t2.h1ShareAtOrBelowObserved, argmaxIsTruth: ck.h1.top.t2ArgmaxIsTruth },
  h1Sample_t2_shareAtOrBelow: ck.h1.sample.t2.h1ShareAtOrBelowObserved,
  homophones: {
    windows: hom.windowsUsed,
    simpleRate: r4(hom.counts.simple.profRate),
    randomRate: r4(hom.counts.random.profRate),
    cycleRate: r4(hom.counts.cycle.profRate),
    ratioRandom: r4(hom.ratioSimpleOverRandom.prof),
    ratioCycle: r4(hom.ratioSimpleOverCycle.prof),
  },
  pAnyLe: sfam.P_any_le,
};

// ---- 6. torpedo ----
const th = R('results/lead/torpedo/headline.json');
const td = R('results/lead/torpedo/derived.json');
const tk = R('results/lead/torpedo/keys.json');
out.torpedo = {
  ranks: Object.fromEntries(Object.entries(th.step2_real_circles.targets).map(([k, v]) => [v.words, { rankWord: v.rankWord, rankNg6: v.rankNg6, of: th.step2_real_circles.completions }])),
  top3: th.step2_real_circles.top10.slice(0, 3),
  canonicalTop1: th.step4_real_canonical.top5[0],
  garlickCanonicalRank: th.step4_real_canonical.garlickTOTPEDO.rankWord,
  permute: {
    P_fluent: td.permute.P_fluent,
    LR_narrow: td.permute.LR_content_narrow,
    LR_any7: td.permute.LR_content_any7,
    LR_narrow_after: td.permute.LR_content_narrow_after_readings_and_keys,
    LR_any7_after: td.permute.LR_content_any7_after_readings_and_keys,
    joint_narrow_after: td.permute.corrected_joint_narrow_x_readings_x_2keys,
    joint_any7_after: td.permute.corrected_joint_any7_x_readings_x_2keys,
    garlickLevel_narrow: td.permute.garlickLevel_narrow_circles,
  },
  stratified: {
    P_fluent: td.stratified.P_fluent,
    LR_narrow: td.stratified.LR_content_narrow,
    LR_any7: td.stratified.LR_content_any7,
    LR_narrow_after: td.stratified.LR_content_narrow_after_readings_and_keys,
    LR_any7_after: td.stratified.LR_content_any7_after_readings_and_keys,
    joint_narrow_after: td.stratified.corrected_joint_narrow_x_readings_x_2keys,
    joint_any7_after: td.stratified.corrected_joint_any7_x_readings_x_2keys,
    garlickLevel_narrow: td.stratified.garlickLevel_narrow_circles,
  },
  torpedoMostCommonBomb7: th.step3.permute.torpedoAmongBomb7Fits[0],
  keyAgreement: { shared: tk.z408_vs_z340.shared, agree: tk.z408_vs_z340.agree, expected: tk.z408_vs_z340.nullMeanAgree, p: tk.z408_vs_z340.p_ge },
};

// ---- 7. prior-art computations ----
const bp = R('results/lead/priorart/boxperm.json');
const win = R('results/lead/priorart/windows.json');
out.priorart = {
  general2x7Orders: bp.general_2x7_orders_distinct,
  marvinByVariant: bp.MARVINMERRILL_by_variant,
  marvinCirclesLIZABETH: bp.circles_distinct_detail.n_fits_using_LIZABETH_key,
  nullNames: { box: bp.null.share_fit_box_homophonic, columnar: bp.null.share_fit_columnar_simple },
  windows: Object.fromEntries(['z408', 'z340_written', 'z340_reading'].map((k) => [k, {
    profile3222: win[k].smallest_window_with_profile_3_2_2_2,
    fiveWindowTriples: win[k].five_windows_with_a_triple,
  }])),
};

// ---- 8. main-attack numbers used in the novelty table ----
const cyc = R('results/cyclemodel/summary.json');
const cycK1 = R('results/cyclemodel/review/hyp_k1fit.json');
out.cyclemodel = {
  log10BF_simple_vs_zodiacSize_original: r4(cyc.z13_keyModel.log10Evidence.simple - cyc.z13_keyModel.log10Evidence.zodiacSize),
  log10BF_simple_vs_zodiacSize_k1fit: r4(cycK1.z13_keyModel.log10Evidence.simple - cycK1.z13_keyModel.log10Evidence.zodiacSize),
  log10BF_distinct: {
    simple: cyc.z13_circles.simple.log10BF_distinct_vs_same_beforeVisualFactor,
    small: cyc.z13_circles.small.log10BF_distinct_vs_same_beforeVisualFactor,
    zodiacSize: cyc.z13_circles.zodiacSize.log10BF_distinct_vs_same_beforeVisualFactor,
  },
};
const iso = R('results/nullmodel/isomorph_likelihood.json');
const pl = (iso.ciphers['z13.canonical'] || iso.ciphers.z13.canonical).profileLikelihood;
out.nullmodel = { profileHitsPer100k: { simple: pl.simple.hits, z63random: pl.z63random.hits, z63cycle: pl.z63cycle.hits } };
const zs = R('results/z32search/summary.json');
out.z32search = { grammarOneIn: zs.sections.grammar.oneIn, grammarNullP: zs.sections.grammar.nullPgeZ32 };

// ---- 9. derived: project-level look-elsewhere for the lead's p-values ----
const sidak = (p, m) => 1 - Math.pow(1 - p, m);
const ps = { 'original family-wise 0.0051': 0.0051, 'both keys 0.0102': 0.0102, 'replication word 0.0096': 0.0096, 'replication primary 0.0147': 0.0147, 'replication WY12 0.039': 0.039, 'frequency-free arrangement WY12 0.144': 0.144 };
const ms = [24, 51, 100];
out.derived = { sidak: {} };
for (const [k, p] of Object.entries(ps)) out.derived.sidak[k] = Object.fromEntries(ms.map((m) => [m, r4(sidak(p, m))]));
// Torpedo joint figure at the 51-analysis scale
out.derived.sidakTorpedoJoint = {
  narrowPermute51: r4(sidak(td.permute.corrected_joint_narrow_x_readings_x_2keys, 51)),
  narrowStratified51: r4(sidak(td.stratified.corrected_joint_narrow_x_readings_x_2keys, 51)),
};

const outDir = path.join(ROOT, 'results/lead/decision');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'numbers.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
