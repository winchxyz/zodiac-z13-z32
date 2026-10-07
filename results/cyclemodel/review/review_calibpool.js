'use strict';
/**
 * results/cyclemodel/review/review_calibpool.js - pool the attacker's 13-letter
 * calibration (results/cyclemodel/calib_c13.json, seed 1970, 10,000 words, 30 s) with
 * the reviewer's rerun (results/cyclemodel/review/calib_c13.json, seed 2718, 5,000 words,
 * 90 s): mean log10 rank change, SE, exact sign tests (one- and two-sided), hit counts.
 *   node results/cyclemodel/review/review_calibpool.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const sets = {
  attacker_seed1970: path.join(ROOT, 'results', 'cyclemodel', 'calib_c13.json'),
  reviewer_seed2718: path.join(__dirname, 'calib_c13.json'),
};
function binomTail(n, k) { // P(X >= k), X ~ Bin(n, 1/2)
  let s = 0, c = 1;
  for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i >= k) s += c; }
  return s / Math.pow(2, n);
}
function stats(rows) {
  const d = rows.map((r) => Math.log10(r.rankPost) - Math.log10(r.rankLM));
  const n = d.length, mean = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const imp = d.filter((x) => x < 0).length, worse = d.filter((x) => x > 0).length;
  const m = imp + worse;
  const one = binomTail(m, imp);
  const hits = (k, key) => rows.filter((r) => r[key] <= k).length;
  return {
    n, meanLog10RankChange: +mean.toFixed(3), se: +(sd / Math.sqrt(n)).toFixed(3), t: +(mean / (sd / Math.sqrt(n))).toFixed(2),
    improved: imp, worse, signTestOneSided: +one.toFixed(4), signTestTwoSided: +Math.min(1, 2 * one).toFixed(4),
    top1: [hits(1, 'rankLM'), hits(1, 'rankPost')], top10: [hits(10, 'rankLM'), hits(10, 'rankPost')], top100: [hits(100, 'rankLM'), hits(100, 'rankPost')],
    completeEnumerations: rows.filter((r) => r.enumerateComplete).length, truthListed: rows.filter((r) => r.truthListed).length,
    S: rows.map((r) => r.S),
  };
}
const out = { tool: 'results/cyclemodel/review/review_calibpool.js', sets: {} };
let all = [];
for (const [k, f] of Object.entries(sets)) {
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')).rows;
  all = all.concat(rows);
  out.sets[k] = stats(rows);
  console.log(k, JSON.stringify(out.sets[k]));
}
out.pooled = stats(all);
console.log('pooled', JSON.stringify(out.pooled));
fs.writeFileSync(path.join(__dirname, 'calib_pooled.json'), JSON.stringify(out, null, 1));
