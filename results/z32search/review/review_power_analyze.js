#!/usr/bin/env node
'use strict';
/**
 * results/z32search/review/review_power_analyze.js - positive-control result: THREE@any crib cost on
 * ciphers whose plaintext really contains THREE (review/power) vs the attacker's nulls (review/cribvar,
 * seeds 3 and 31, equal-effort mean baselines from review_summary.json).  Also: does the best THREE
 * placement land on the true position?
 *   node results/z32search/review/review_power_analyze.js  -> review/power_summary.json
 */
const fs = require('fs');
const path = require('path');
const rd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : []);
const r2 = (x) => Math.round(x * 100) / 100;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const P = rd(path.join(__dirname, 'power', 'runs.jsonl')).filter((r) => !r.error);
const S = JSON.parse(fs.readFileSync(path.join(__dirname, 'review_summary.json'), 'utf8'));
const free = new Map(P.filter((r) => r.group === 'posfree').map((r) => [r.id.replace(/_main100$/, ''), r]));
const rows = [];
for (const r of P.filter((x) => x.group === 'poscrib')) {
  const f = free.get(r.meta.cipher);
  if (!f) continue;
  const b = r.solutions[0];
  rows.push({ cipher: r.meta.cipher, seed: r.meta.seed, truePos: r.meta.truePos, bestPos: b.cribPositions ? b.cribPositions[0][0] : null, freeBest: r2(f.solutions[0].score), truthScore: r.truth && r.truth.score != null ? r2(r.truth.score) : null, cribBest: r2(b.score), cost: r2(f.solutions[0].score - b.score), bestWords: b.words, truth: r.truth ? r.truth.words : null });
}
// nulls: same seeds (3, 31) from cribvar, cost against the seed-101 baseline (same effort as the positives)
const nullRows = S.cribvar.THREE.rows.filter((x) => x.cipher !== 'z32');
const nullCosts = [];
for (const x of nullRows) {
  const b101 = S.baselines[x.cipher].seeds[0];
  x.perSeedBest.slice(0, 2).forEach((v) => nullCosts.push(r2(b101 - v)));
}
const z = S.cribvar.THREE.rows.find((x) => x.cipher === 'z32');
const zc = z.perSeedBest.slice(0, 2).map((v) => r2(S.baselines.z32.seeds[0] - v));
const posCosts = rows.map((x) => x.cost);
const res = {
  word: 'THREE', note: 'cost = free best (80 restarts x 150k, seed 101) - THREE@any crib best (one restart per placement, 120k iterations); seeds 3 and 31',
  positives: rows, positiveCostMean: posCosts.length ? r2(mean(posCosts)) : null,
  nullCosts, nullCostMean: nullCosts.length ? r2(mean(nullCosts)) : null,
  z32Costs: zc,
  positivesBelowNullMedian: (() => { const s = nullCosts.slice().sort((a, b) => a - b); const med = s[Math.floor(s.length / 2)]; return `${posCosts.filter((c) => c < med).length}/${posCosts.length} (null median ${med})`; })(),
  truePositionFound: `${rows.filter((x) => x.bestPos === x.truePos).length}/${rows.length}`,
  solverAboveTruth: `${rows.filter((x) => x.truthScore != null && x.freeBest > x.truthScore).length}/${rows.length}`,
};
fs.writeFileSync(path.join(__dirname, 'power_summary.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
