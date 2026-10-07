'use strict';
/**
 * tools/lead_skeptic_stat_summary.js - collect the headline numbers of the statistician's skeptic
 * checks (results/lead/skeptic/stat/*) into one JSON.
 *   node tools/lead_skeptic_stat_summary.js [--out results/lead/skeptic/stat/summary.json]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = 'results/lead/skeptic/stat/';
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, D, f), 'utf8'));
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args[oi + 1] : D + 'summary.json';

const mv = {};
for (const f of fs.readdirSync(path.join(ROOT, D)).filter((x) => /^multiverse_.*\.json$/.test(x))) {
  const j = rd(f);
  const sp = (id) => j.specs.find((s) => s.id === id).p;
  mv[`${j.key}/${j.null}`] = {
    wy36: j.families.all36.pFW, wyCanonical11: j.families.canonicalOnly.pFW, wyReplication12: j.families.replicationTwelve.pFW,
    minP36: j.families.all36.minP, specsP05: j.countTest.realSpecsP05, pCount05: j.countTest.pCount05,
    canonical: { M2: sp('canonical:M2'), M4: sp('canonical:M4'), M6: sp('canonical:M6'), S4: sp('canonical:S4'), W: sp('canonical:W') },
  };
}
const ar = rd('arrange.json');
const arr = {};
for (const k of Object.keys(ar.keys)) for (const mode of ['all6', 'capitalsOnly']) {
  const a = ar.keys[k][mode];
  const sp = (id) => { const s = a.specs.find((x) => x.id === id); return { p: s.p, rank: s.rank }; };
  arr[`${k}/${mode}`] = { N: a.N, wy12: a.pFWreplication12, wy36: a.pFWall36, specsP05: a.specsP05,
    canonical: { M2: sp('canonical:M2'), M6: sp('canonical:M6'), K6: sp('canonical:K6'), S3: sp('canonical:S3'), S4: sp('canonical:S4'), W: sp('canonical:W') },
    circles: { M6: sp('circles_distinct:M6'), W: sp('circles_distinct:W'), K6: sp('circles_distinct:K6') } };
}
const infl = {};
for (const k of ['z340', 'z408']) {
  infl[k] = {};
  for (const s of ['a', 'b']) { const j = rd(`influence_${k}_${s}.json`); Object.assign(infl[k], j.nulls); infl[k].draws = j.draws; }
}
const out = {
  generated: new Date().toISOString(),
  multiverse: mv,
  arrangement: arr,
  influence: infl,
  core: rd('core.json').keys,
  arrangementPowerW: rd('arrpower_w.json').variants,
  bayes: (() => { const b = rd('bayes.json'); return { densityLR: b.densityLR, sellke: b.sellke, posterior: b.posterior }; })(),
  families: (() => { const f = rd('families.json'); return { analyses: f.analyses, analysesByTask: f.analysesByTask, distinctValues: f.distinctValues, keypriorShareOfDistinct: f.keypriorShareOfDistinct, analysesWithMinAtOrBelow: f.analysesWithMinAtOrBelow, bh: f.bh, sidakAtAnalyses: f.sidakAtAnalyses }; })(),
};
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ arrangement: arr, influence: infl }, null, 1));
