'use strict';
// Scan results/z13names/fit_counts.tsv + stats.json: weighted fraction (0 fillers) vs the iid-letter
// baseline for every variant / mode / list / pattern. Prints ratios baseline / name.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/z13names/stats.json'), 'utf8'));
const rows = fs.readFileSync(path.join(ROOT, 'results/z13names/fit_counts.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const H = rows[0];
const col = (n) => H.indexOf(n);
const out = [];
for (const r of rows.slice(1)) {
  if (r[col('fillers')] !== '0') continue;
  const v = r[col('variant')], mode = r[col('mode')], list = r[col('list')], pat = r[col('pattern')];
  let wf = r[col('weighted_fraction')] === '' ? null : +r[col('weighted_fraction')];
  if (wf == null && r[col('mc_weighted_fraction')] !== '') wf = +r[col('mc_weighted_fraction')];
  const base = stats.variants[v].letterBaseline[mode].english;
  out.push({ v, mode, list, pat, wf, base, ratio: wf ? base / wf : Infinity });
}
const above = out.filter((x) => x.wf != null && x.wf > x.base);
console.log('cells', out.length, 'cells with name weighted fraction ABOVE iid-letter baseline:', above.length);
for (const x of above) console.log(' ', x.v, x.mode, x.list, x.pat, x.wf.toExponential(3), 'baseline', x.base.toExponential(3), 'ratio', x.ratio.toFixed(2));
for (const v of Object.keys(stats.variants)) for (const mode of ['simple', 'homophonic']) {
  const xs = out.filter((x) => x.v === v && x.mode === mode && (x.list === 'male' || x.list === 'female') && x.wf > 0);
  if (!xs.length) continue;
  const rs = xs.map((x) => x.ratio);
  console.log(v, mode, 'baseline/name ratio range (male+female, patterns with >0 fits):', Math.min(...rs).toFixed(2), '-', Math.max(...rs).toFixed(0));
}
