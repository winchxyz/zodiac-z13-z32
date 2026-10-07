'use strict';
// Compare a re-run of tools/z13names_enumerate.js (results/z13names/review/repro/<tag>.json) with the
// attacker's results/z13names/runs/<tag>.json, cell by cell (pattern|fillers|lead: n, sw, nb, swb).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
for (const tag of process.argv.slice(2)) {
  const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/z13names/runs', tag + '.json'), 'utf8')).counts;
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/z13names/review/repro', tag + '.json'), 'utf8')).counts;
  let same = 0, diff = 0;
  const keys = new Set([...Object.keys(a.cells), ...Object.keys(b.cells)]);
  for (const k of keys) {
    const x = a.cells[k] || { n: 0, sw: 0 }, y = b.cells[k] || { n: 0, sw: 0 };
    const ok = x.n === y.n && Math.abs(x.sw - y.sw) <= 1e-9 * Math.max(Math.abs(x.sw), 1e-300);
    if (ok) same++; else { diff++; console.log('DIFF', tag, k, x.n, y.n, x.sw, y.sw); }
  }
  console.log(tag, 'total fits attacker', a.fits, 'rerun', b.fits, 'complete', b.complete, `cells equal ${same}/${same + diff}`);
}
