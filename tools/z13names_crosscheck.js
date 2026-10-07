'use strict';
/**
 * tools/z13names_crosscheck.js - consistency checks over the finished z13names grid.
 *  1. simple-mode 0-filler fit counts (direct enumeration) == strict subset of the homophonic
 *     0-filler fits (derived), per variant / list / pattern;
 *  2. z13.bracket_is_perp == z13.canonical at 0 fillers (same isomorph);
 *  3. simple fits <= homophonic fits in every enumerated cell;
 *  4. enumerated weighted fractions vs Monte Carlo (z-score of the difference).
 * Writes results/z13names/crosscheck.json and prints a summary.
 */
const fs = require('fs');
const path = require('path');
const D = path.join(__dirname, '..', 'results', 'z13names');
const stats = JSON.parse(fs.readFileSync(path.join(D, 'stats.json'), 'utf8'));
const runOf = (v, m, l) => stats.runs.find((r) => r.variant === v && r.mode === m && r.list === l);
const out = { strictVsSimple: [], bracketVsCanonical: [], simpleLeHomophonic: { cells: 0, violations: [] }, mcVsEnum: [] };
for (const r of stats.runs) {
  if (r.mode !== 'homophonic' || r.minWeight) continue;
  const s = runOf(r.variant, 'simple', r.list);
  if (!s || s.minWeight) continue;
  for (const pat of Object.keys(r.patterns)) {
    const z = r.patterns[pat].zeroFiller;
    const derived = z && z.strictSubset ? z.strictSubset.parses : 0;
    const direct = s.patterns[pat].byFillers[0].fits;
    out.strictVsSimple.push({ variant: r.variant, list: r.list, pattern: pat, direct, derived, equal: direct === derived });
    for (let f = 0; f <= 2; f++) {
      const a = s.patterns[pat].byFillers[f], b = r.patterns[pat].byFillers[f];
      if (a.enumerated !== 'complete' || b.enumerated !== 'complete') continue;
      out.simpleLeHomophonic.cells++;
      if (a.fits > b.fits) out.simpleLeHomophonic.violations.push({ variant: r.variant, list: r.list, pattern: pat, fillers: f, simple: a.fits, homophonic: b.fits });
    }
  }
}
for (const m of ['simple', 'homophonic']) for (const l of ['male', 'female', 'nick_male', 'nick_female']) {
  const a = runOf('z13.canonical', m, l), b = runOf('z13.bracket_is_perp', m, l);
  if (!a || !b) continue;
  for (const pat of Object.keys(a.patterns)) out.bracketVsCanonical.push({ mode: m, list: l, pattern: pat, canonical: a.patterns[pat].byFillers[0].fits, bracket: b.patterns[pat].byFillers[0].fits, equal: a.patterns[pat].byFillers[0].fits === b.patterns[pat].byFillers[0].fits });
}
for (const r of stats.runs) for (const [pat, pr] of Object.entries(r.patterns)) for (const f of [0, 1, 2]) {
  const x = pr.byFillers[f];
  if (x.weightedFraction == null || x.mcWeightedFraction == null || !x.mcN) continue;
  const p = x.weightedFraction, n = x.mcN;
  const se = Math.sqrt(Math.max(p * (1 - p), 1e-300) / n);
  out.mcVsEnum.push({ variant: r.variant, mode: r.mode, list: r.list, pattern: pat, fillers: f, enumerated: p, mc: x.mcWeightedFraction, hits: x.mcHits, z: (x.mcWeightedFraction - p) / se });
}
const zs = out.mcVsEnum.filter((c) => c.hits >= 20 || c.enumerated * c.hits > 0).map((c) => c.z);
out.summary = {
  strictVsSimple: `${out.strictVsSimple.filter((c) => c.equal).length} of ${out.strictVsSimple.length} cells equal`,
  bracketVsCanonical: `${out.bracketVsCanonical.filter((c) => c.equal).length} of ${out.bracketVsCanonical.length} cells equal`,
  simpleLeHomophonic: `${out.simpleLeHomophonic.violations.length} violations in ${out.simpleLeHomophonic.cells} cells`,
  mcVsEnum: `${out.mcVsEnum.length} cells compared; |z| > 3 in ${out.mcVsEnum.filter((c) => Math.abs(c.z) > 3).length}; mean z ${(zs.reduce((a, b) => a + b, 0) / Math.max(1, zs.length)).toFixed(2)}, sd ${Math.sqrt(zs.reduce((a, b) => a + b * b, 0) / Math.max(1, zs.length)).toFixed(2)} (cells with >= 20 MC hits)`,
};
fs.writeFileSync(path.join(D, 'crosscheck.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.summary, null, 1));
for (const c of out.strictVsSimple.filter((c) => !c.equal)) console.log('MISMATCH', JSON.stringify(c));
for (const c of out.mcVsEnum.filter((c) => Math.abs(c.z) > 3)) console.log('MC |z|>3', JSON.stringify(c));
