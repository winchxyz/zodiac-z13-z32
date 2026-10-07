'use strict';
/**
 * tools/lead_skeptic_stat_bayes.js - how much evidence do the lead's p-values carry?
 *
 * 1. Likelihood ratio of an observed p-value: under H0 a calibrated p is uniform (density 1); under
 *    H1 its density is estimated from the replication's positive-control phrases
 *    (results/lead/replicate/power_<variant>_rows.json, p_perm_t1/t2/t3) as the share of phrases with
 *    p in [p_obs/2, 2 p_obs] divided by the interval width.  LR = f1(p_obs) / 1.
 * 2. Sellke-Bayarri-Berger upper bound on the Bayes factor, 1 / (-e p ln p) for p < 1/e.
 * 3. Posterior P(H1) for priors 0.01 / 0.05 / 0.10 / 0.25 under each LR and bound.
 *
 *   node tools/lead_skeptic_stat_bayes.js [--out results/lead/skeptic/stat/bayes.json]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args[oi + 1] : 'results/lead/skeptic/stat/bayes.json';
const rd = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const nulls = rd('results/lead/replicate/nulls_z340.json');
const obs = {};
for (const v of ['canonical', 'circles_distinct']) {
  obs[v] = {};
  const tests = nulls.nulls.perm.tests;
  for (const t of ['t1', 't2', 't3']) {
    const k = Object.keys(tests).find((x) => x.includes(v) && x.includes(t));
    obs[v][t] = k ? (tests[k].p !== undefined ? tests[k].p : tests[k].pRaw) : null;
  }
}
const sellke = (p) => (p < 1 / Math.E ? 1 / (-Math.E * p * Math.log(p)) : 1);
const post = (bf, prior) => (prior * bf) / (prior * bf + (1 - prior));
const PRIORS = [0.01, 0.05, 0.1, 0.25];

const res = { generated: new Date().toISOString(), observedPermP: obs, densityLR: {}, sellke: {}, posterior: {} };
for (const v of ['canonical', 'circles_distinct']) {
  const rows = rd(`results/lead/replicate/power_${v}_rows.json`);
  const sel = v === 'circles_distinct' ? rows.filter((r) => r.src === 'heldout') : rows;
  res.densityLR[v] = { phrases: sel.length, src: v === 'circles_distinct' ? 'heldout' : 'all (47 of 48 from 6-gram training text)' };
  for (const t of ['t1', 't2', 't3']) {
    const p = obs[v][t];
    if (p == null) continue;
    const key = 'p_perm_' + t;
    const ps = sel.map((r) => r[key]).filter((x) => typeof x === 'number');
    const lo = p / 2, hi = p * 2;
    const inBand = ps.filter((x) => x >= lo && x <= hi).length;
    const share = inBand / ps.length;
    const f1 = share / (hi - lo);
    const atLeast = ps.filter((x) => x >= p).length / ps.length;
    res.densityLR[v][t] = { pObs: p, h1PhrasesInBand: inBand, of: ps.length, densityLR: f1, h1ShareWithPAtLeastObs: atLeast, sellkeBound: sellke(p) };
  }
}
const named = {
  'old lead family-wise (keyprior review)': 0.0051,
  'old lead over both keys': 0.0102,
  'replication WY, 12 tests, perm': nulls.nulls.perm.wyMin,
};
const tryRead = (rel, f) => { try { return f(rd(rel)); } catch (e) { return null; } };
const mv = tryRead('results/lead/skeptic/stat/multiverse_z340_perm.json', (j) => j.families.all36.pFW);
const mv408 = tryRead('results/lead/skeptic/stat/multiverse_z408_perm.json', (j) => j.families.all36.pFW);
const ar = tryRead('results/lead/skeptic/stat/arrange.json', (j) => j.keys.z340.all6);
if (mv != null) named['multiverse WY, 36 specs, perm (Z340)'] = mv;
if (mv408 != null) named['multiverse WY, 36 specs, perm (Z408 negative control)'] = mv408;
if (ar) { named['arrangement WY, 12 tests (Z340)'] = ar.pFWreplication12; named['arrangement WY, 36 specs (Z340)'] = ar.pFWall36; }
for (const [n, p] of Object.entries(named)) {
  res.sellke[n] = { p, bfUpperBound: sellke(p) };
  res.posterior[n] = Object.fromEntries(PRIORS.map((pr) => [pr, post(sellke(p), pr)]));
}
for (const v of Object.keys(res.densityLR)) for (const t of ['t1', 't2', 't3']) {
  const d = res.densityLR[v][t];
  if (!d) continue;
  res.posterior[`density LR ${v} ${t}`] = Object.fromEntries(PRIORS.map((pr) => [pr, post(d.densityLR, pr)]));
}
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
