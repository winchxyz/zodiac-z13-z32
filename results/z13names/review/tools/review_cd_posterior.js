'use strict';
/**
 * 1. Re-check the 16 cells where review_dp and the attacker differ only in the weight sum (relative
 *    tolerance 1e-5) and check the boundary-3 counts for z13.crosshair_null.
 * 2. Exact posterior denominators for z13.circles_distinct (0 fillers): the attacker divided the top
 *    fit's weight by a Monte Carlo estimate of the total fitting weight; here the exact DP total is used.
 * Writes results/z13names/review/cd_posterior.json.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const cmp = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/z13names/review/dp_compare.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/z13names/stats.json'), 'utf8'));
let loose = 0, looseFail = 0, bnd = 0, bndFail = 0;
for (const r of cmp.rows) {
  if (r.match == null) continue;
  const run = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/z13names/runs', `${r.variant}.${r.mode}.${r.list}.json`), 'utf8'));
  let n = 0, sw = 0, nb = 0;
  for (const [k, c] of Object.entries(run.counts.cells)) { const [p, f] = k.split('|'); if (p === r.pattern && +f === r.fillers) { n += c.n; sw += c.sw; nb += c.nb; } }
  loose++;
  if (n !== r.dpFits || Math.abs(sw - r.dpWeightSum) > 1e-5 * Math.max(r.dpWeightSum, 1e-300)) { looseFail++; console.log('LOOSE FAIL', r.variant, r.mode, r.list, r.pattern, r.fillers); }
  if (r.dpFitsBoundary3 != null) { bnd++; if (nb !== r.dpFitsBoundary3) { bndFail++; console.log('BOUNDARY FAIL', r.variant, r.mode, r.list, r.pattern, r.fillers, nb, r.dpFitsBoundary3); } }
}
console.log(`cells: ${loose}, failing at relative tolerance 1e-5: ${looseFail}; crosshair boundary-3 cells: ${bnd}, failing: ${bndFail}`);
const out = [];
for (const r of stats.runs) {
  if (r.variant !== 'z13.circles_distinct') continue;
  for (const [pat, p] of Object.entries(r.patterns)) {
    const z = p.zeroFiller;
    if (!z || !z.topFlat || !z.topFlat.length) continue;
    const row = cmp.rows.find((x) => x.variant === r.variant && x.mode === r.mode && x.list === r.list && x.pattern === pat && x.fillers === 0);
    if (!row) continue;
    const top = z.topFlat[0];
    const o = { mode: r.mode, list: r.list, pattern: pat, top: top.parts, topWeight: top.weight, enumeratedAboveMinWeight: z.enumeratedWeight, mcTotal: z.mcTotalFittingWeight, exactTotal: row.dpWeightSum, exactFits: row.dpFits, attackerTop1: z.posteriorFlatTop1, exactTop1: top.weight / row.dpWeightSum, mcBelowEnumeratedPart: z.mcTotalFittingWeight != null && z.mcTotalFittingWeight < z.enumeratedWeight };
    out.push(o);
    console.log(r.mode, r.list, pat, top.parts, 'attacker top1', o.attackerTop1 != null ? o.attackerTop1.toFixed(3) : '-', 'exact top1', o.exactTop1.toFixed(3), o.mcBelowEnumeratedPart ? '(MC total < enumerated partial sum)' : '');
  }
}
fs.writeFileSync(path.join(ROOT, 'results/z13names/review/cd_posterior.json'), JSON.stringify({ tool: 'results/z13names/review/tools/review_cd_posterior.js', rows: out }, null, 1));
