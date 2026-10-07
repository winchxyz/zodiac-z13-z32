'use strict';
/**
 * results/cyclemodel/review/review_compat.js - P(Z13 circle triple | letter) and
 * P(pair repeat | letter) for a Zodiac-size key (S 54/63), per regime and for the
 * equal-weight regime mixture the posteriors actually use, under the original and the
 * k = 1-outlier allocations (same formula as tools/cyclemodel_compat.js, j = 0).
 *   node results/cyclemodel/review/review_compat.js
 */
const fs = require('fs');
const path = require('path');
const M = require('./review_lib');

const models = { orig: 'results/cyclemodel/review/model_orig.json', k1fit: 'results/cyclemodel/review/model_k1fit.json' };
const ROOT = path.join(__dirname, '..', '..', '..');
const pats = { triple: { cls: [0, 0, 0], rows: [0, 0, 0] }, pair: { cls: [0, 0], rows: [0, 0] } };
const out = {};
for (const [name, f] of Object.entries(models)) {
  const model = M.loadModel(path.join(ROOT, f));
  const regs = Object.keys(model.regimes);
  out[name] = {};
  for (const [pn, pat] of Object.entries(pats)) {
    out[name][pn] = {};
    for (const L of 'ETAOINSHRDLUCMWFGYPBVKXJQZ') {
      const l = L.charCodeAt(0) - 65;
      const row = {};
      let mix = 0;
      for (const reg of regs) {
        let p = 0;
        for (const S of [54, 63]) {
          const kd = M.kDist(model.alloc, M.targets(model.alloc, S)[l]);
          for (let k = 1; k <= M.KMAX; k++) p += 0.5 * kd[k] * M.patternProb(model.regimes[reg].theta, k, pat.cls, pat.rows);
        }
        row[reg] = +p.toPrecision(3);
        mix += p / regs.length;
      }
      row.mixture = +mix.toPrecision(3);
      out[name][pn][L] = row;
    }
  }
  const t = out[name].triple, p = out[name].pair;
  console.log(`${name}: triple  E ${JSON.stringify(t.E)}  R ${JSON.stringify(t.R)}  U ${JSON.stringify(t.U)}`);
  console.log(`${name}: pair    E ${JSON.stringify(p.E)}`);
}
fs.writeFileSync(path.join(__dirname, 'compat_review.json'), JSON.stringify(out, null, 1));
console.log('wrote results/cyclemodel/review/compat_review.json');
