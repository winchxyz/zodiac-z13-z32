'use strict';
/**
 * Runs review_dp.js logic over the whole grid (6 variants x 2 modes x 4 lists, fillers 0-2) and
 * writes results/z13names/review/dp_grid.json. Single thread.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'results', 'z13names', 'review', 'dp');
fs.mkdirSync(OUT, { recursive: true });
const variants = (process.argv[2] || 'z13.canonical,z13.reversed,z13.crosshair_null,z13.letters_literal,z13.bracket_is_perp,z13.circles_distinct').split(',');
const t0 = Date.now();
for (const v of variants) for (const mode of ['simple', 'homophonic']) for (const list of ['male', 'female', 'nick_male', 'nick_female']) {
  const out = path.join(OUT, `${v}.${mode}.${list}.json`);
  if (fs.existsSync(out)) { console.log('skip', out); continue; }
  const r = spawnSync(process.execPath, [path.join(__dirname, 'review_dp.js'), '--variant', v, '--mode', mode, '--list', list, '--out', out], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.error('FAILED', v, mode, list, r.stderr.slice(-2000)); continue; }
  console.log(`${v} ${mode} ${list} done, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
