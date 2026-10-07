'use strict';
/**
 * tools/lead_skeptic_stat_arrpowerw.js - power of the exact arrangement test for the word statistic
 * W (= replication T2; the word model is from Web 1T counts, so no training-text leakage).
 *
 * For each positive-control phrase of the replication (results/lead/replicate/power_<variant>_rows.json:
 * real English 13-letter windows that fit Z13's pattern), its own six slot letters are arranged in
 * every distinct way over the slots A E N z K M and W is computed for each arrangement; the phrase's
 * arrangement p = #{W_arr >= W_true} / N.  This is the distribution of the arrangement p under H1.
 * The observed Z340 arrangement p comes from results/lead/skeptic/stat/arrange.json.
 * Reported: H1 power at 0.05 / 0.01, H1 median, the share of H1 phrases with p >= observed, and a
 * band likelihood ratio f1/f0 over [p_obs/2, 2 p_obs] (f0 from the discrete uniform of each phrase).
 *
 *   node tools/lead_skeptic_stat_arrpowerw.js [--variants canonical,circles_distinct] [--out results/lead/skeptic/stat/arrpower_w.json]
 */
const fs = require('fs');
const path = require('path');
const S = require('./lead_skeptic_stat_lib');
const R = S.R;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const VARS = opt('--variants', 'canonical,circles_distinct').split(',');
const OUT = opt('--out', 'results/lead/skeptic/stat/arrpower_w.json');
const rd = (rel) => JSON.parse(fs.readFileSync(path.join(R.ROOT, rel), 'utf8'));
const arr = rd('results/lead/skeptic/stat/arrange.json');

const t0 = Date.now();
const out = { generated: new Date().toISOString(), variants: {} };
for (const v of VARS) {
  const lay = R.layout(v);
  const W = R.wordEngine(lay);
  const rows = rd(`results/lead/replicate/power_${v}_rows.json`);
  const obsP = arr.keys.z340.all6.specs.find((s) => s.id === `${v}:W`).p;
  const ps = [];
  const nArr = [];
  for (const r of rows) {
    const letters = lay.slotPos.map((pos) => r.w.charCodeAt(pos[0]) - 65);
    const arrs = S.arrangements(letters, []);
    const vals = arrs.map((a) => W.run(R.slotLetters(lay, a)));
    const ti = arrs.findIndex((a) => a.join(',') === letters.join(','));
    ps.push(S.pIncl(vals[ti], vals));
    nArr.push(arrs.length);
  }
  const sorted = ps.slice().sort((a, b) => a - b);
  const lo = obsP / 2, hi = obsP * 2;
  // f0 band mass: under H0 the arrangement p of a phrase with N arrangements is uniform on {1/N..1}
  const f0 = nArr.reduce((s, N) => { let c = 0; for (let k = 1; k <= N; k++) { const p = k / N; if (p >= lo && p <= hi) c++; } return s + c / N; }, 0) / nArr.length;
  const f1 = ps.filter((p) => p >= lo && p <= hi).length / ps.length;
  out.variants[v] = {
    phrases: ps.length, observedZ340ArrangementP: obsP,
    h1Median: sorted[Math.floor(sorted.length / 2)], h1Power05: ps.filter((p) => p <= 0.05).length / ps.length,
    h1Power01: ps.filter((p) => p <= 0.01).length / ps.length, h1ShareAtLeastObs: ps.filter((p) => p >= obsP - 1e-12).length / ps.length,
    bandH1: f1, bandH0: f0, bandLR: f0 > 0 ? f1 / f0 : null, meanArrangements: nArr.reduce((a, b) => a + b, 0) / nArr.length,
  };
  console.log(v, JSON.stringify(out.variants[v]), `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
fs.writeFileSync(path.join(R.ROOT, OUT), JSON.stringify(out, null, 1));
