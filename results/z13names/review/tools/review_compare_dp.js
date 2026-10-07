'use strict';
/**
 * Compare the independent DP counts (results/z13names/review/dp/*.json) with
 *  - the attacker's enumerated cells (results/z13names/runs/*.json, summed over leads), and
 *  - the attacker's Monte Carlo / reported fractions (results/z13names/stats.json) where the
 *    enumeration was not complete (circles_distinct, thresholded at weight 1e-10).
 * Writes results/z13names/review/dp_compare.json and dp_compare.tsv.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const DPD = path.join(ROOT, 'results/z13names/review/dp');
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/z13names/stats.json'), 'utf8'));
const rows = [];
let eq = 0, ne = 0, cmpd = 0;
for (const f of fs.readdirSync(DPD).filter((x) => x.endsWith('.json')).sort()) {
  const dp = JSON.parse(fs.readFileSync(path.join(DPD, f), 'utf8'));
  const tag = f.replace(/\.json$/, '');
  const runFile = path.join(ROOT, 'results/z13names/runs', f);
  const run = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, 'utf8')) : null;
  const agg = {};
  if (run) for (const [k, c] of Object.entries(run.counts.cells)) { const [p, fl] = k.split('|'); const kk = p + '|' + fl; const a = agg[kk] || (agg[kk] = { n: 0, sw: 0, nb: 0, swb: 0 }); a.n += c.n; a.sw += c.sw; a.nb += c.nb; a.swb += c.swb; }
  const st = stats.runs.find((r) => r.variant === dp.variant && r.mode === dp.mode && r.list === dp.list);
  for (const [k, c] of Object.entries(dp.cells)) {
    const [pat, fl] = k.split('|');
    const statRow = st && st.patterns[pat] ? st.patterns[pat].byFillers[fl] : null;
    const exhaustive = run && run.counts.complete && !(run.options.minWeight > 0) && +fl <= run.options.fillers;
    const a = agg[k] || { n: 0, sw: 0, nb: 0, swb: 0 };
    let match = null;
    if (exhaustive) {
      match = a.n === c.n && Math.abs(a.sw - c.sw) <= 1e-9 * Math.max(c.sw, 1e-300);
      if (c.nb != null) match = match && a.nb === c.nb && Math.abs(a.swb - c.swb) <= 1e-9 * Math.max(c.swb, 1e-300);
      cmpd++; if (match) eq++; else ne++;
    }
    const priorWeight = statRow ? statRow.priorWeight : null, nameStrings = statRow ? statRow.nameStrings : null;
    rows.push({
      variant: dp.variant, mode: dp.mode, list: dp.list, pattern: pat, fillers: +fl,
      dpFits: c.n, dpWeightSum: c.sw, dpFitsBoundary3: c.nb, attackerFits: exhaustive ? a.n : null, match,
      dpFraction: nameStrings ? c.n / nameStrings : null, dpWeightedFraction: priorWeight ? c.sw / priorWeight : null,
      attackerWeightedFraction: statRow ? statRow.weightedFraction : null, attackerMcWeightedFraction: statRow ? statRow.mcWeightedFraction : null,
      attackerMcCI: statRow ? statRow.mcWeightedCI : null, attackerMcFraction: statRow ? statRow.mcFraction : null,
    });
  }
}
fs.writeFileSync(path.join(ROOT, 'results/z13names/review/dp_compare.json'), JSON.stringify({ comparedCells: cmpd, equal: eq, different: ne, rows }, null, 1));
const H = ['variant', 'mode', 'list', 'pattern', 'fillers', 'dpFits', 'attackerFits', 'match', 'dpFraction', 'dpWeightedFraction', 'attackerWeightedFraction', 'attackerMcWeightedFraction', 'attackerMcFraction', 'dpFitsBoundary3'];
const fmt = (x) => (x == null ? '' : typeof x === 'number' && !Number.isInteger(x) ? x.toExponential(4) : Array.isArray(x) ? x.join('..') : String(x));
fs.writeFileSync(path.join(ROOT, 'results/z13names/review/dp_compare.tsv'), [H.join('\t'), ...rows.map((r) => H.map((h) => fmt(r[h])).join('\t'))].join('\n') + '\n');
console.log(`exhaustive cells compared: ${cmpd}; identical (count and weight sum${''}): ${eq}; different: ${ne}`);
for (const r of rows.filter((r) => r.match === false)) console.log('DIFF', JSON.stringify(r));
// circles_distinct: exact vs MC
for (const r of rows.filter((r) => r.variant === 'z13.circles_distinct' && (r.list === 'male' || r.list === 'female'))) {
  const ci = r.attackerMcCI;
  const inside = ci ? r.dpWeightedFraction >= ci[0] && r.dpWeightedFraction <= ci[1] : null;
  console.log('CD', r.mode, r.list, r.pattern, 'f' + r.fillers, 'exact fits', r.dpFits, 'exact wfrac', r.dpWeightedFraction && r.dpWeightedFraction.toExponential(3), 'MC', r.attackerMcWeightedFraction != null ? r.attackerMcWeightedFraction.toExponential(3) : '-', ci ? `[${ci[0].toExponential(2)}, ${ci[1].toExponential(2)}]` : '', inside === false ? 'OUTSIDE CI' : '');
}
