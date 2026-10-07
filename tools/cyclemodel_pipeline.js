'use strict';
/**
 * tools/cyclemodel_pipeline.js - run the heavy cyclemodel steps one after another
 * inside ONE machine slot (start it through tools/run_slot.js).  Each step's
 * stdout/stderr goes to results/cyclemodel/logs/<step>.log; a failed step is
 * logged and the pipeline continues.
 *
 *   node tools/run_slot.js --label cyclemodel -- node tools/cyclemodel_pipeline.js --steps fit,compat,win13,win32,enum,score
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LOG = path.join(ROOT, 'results', 'cyclemodel', 'logs');
fs.mkdirSync(LOG, { recursive: true });
const argv = process.argv.slice(2);
const steps = (argv.includes('--steps') ? argv[argv.indexOf('--steps') + 1] : 'fit,compat,win13,win32,enum,score').split(',');
// optional overrides read when the pipeline starts: results/cyclemodel/pipeline_extra.json
// {enumSeconds, namesSeconds, fitArgs: [...], extraSteps: [...], calibArgs: [...]}
const EXTRA_F = path.join(ROOT, 'results', 'cyclemodel', 'pipeline_extra.json');
const EXTRA = fs.existsSync(EXTRA_F) ? JSON.parse(fs.readFileSync(EXTRA_F, 'utf8')) : {};
if (EXTRA.extraSteps) for (const s of EXTRA.extraSteps) if (!steps.includes(s)) steps.push(s);
const ENUM_SEC = EXTRA.enumSeconds || (argv.includes('--enum-seconds') ? +argv[argv.indexOf('--enum-seconds') + 1] : 150);
const NAMES_SEC = EXTRA.namesSeconds || ENUM_SEC;
const node = process.execPath;
const R = 'results/cyclemodel';

function run(name, args) {
  const t0 = Date.now();
  const r = spawnSync(node, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const txt = `$ node ${args.join(' ')}\n${r.stdout || ''}\n${r.stderr || ''}\nexit ${r.status} after ${((Date.now() - t0) / 1000).toFixed(1)} s\n`;
  fs.writeFileSync(path.join(LOG, name + '.log'), txt);
  console.log(`[pipeline] ${name}: exit ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

const V = 'data/ciphers/variants/';
const Z13 = [
  { id: 'canonical', file: V + 'z13.canonical.txt', track: '4,9' },
  { id: 'circles_distinct', file: V + 'z13.circles_distinct.txt', track: '4,6,8' },
  { id: 'crosshair_null', file: V + 'z13.crosshair_null.txt', track: '3,8' },
  { id: 'reversed', file: V + 'z13.reversed.txt', track: '4,8' },
  { id: 'letters_literal', file: V + 'z13.canonical.txt', track: '4,9', pin: 'A=A,E=E,N=N,K=K,M=M' },
];

for (const st of steps) {
  if (st === 'fit') run('fit', ['tools/cyclemodel_fit.js'].concat(EXTRA.fitArgs || ['--boot', '40', '--sims', '400']));
  else if (st === 'calib') run('calib', ['tools/cyclemodel_calib.js'].concat(EXTRA.calibArgs || []));
  else if (st === 'compat') run('compat', ['tools/cyclemodel_compat.js']);
  else if (st === 'win13') run('windows_z13', ['tools/cyclemodel_windows.js', '--set', 'z13']);
  else if (st === 'win32') run('windows_z32', ['tools/cyclemodel_windows.js', '--set', 'z32']);
  else if (st === 'enum') {
    for (const v of Z13) for (const mode of ['simple', 'homophonic']) {
      const a = ['tools/enumerate.js', 'words', '--cipher', v.file, '--mode', mode, '--top-words', '20000', '--max-words', '4', '--threads', '4',
        '--max-seconds', String(ENUM_SEC), '--min-logp', '-28', '--top', '200', '--stream', `${R}/enum_z13_${v.id}_${mode}.tsv`, '--out', `${R}/enum_z13_${v.id}_${mode}.json`];
      if (v.pin) a.push('--pin', v.pin);
      run(`enum_z13_${v.id}_${mode}`, a);
    }
    for (const mode of ['simple', 'homophonic']) {
      run(`names_z13_canonical_${mode}`, ['tools/enumerate.js', 'names', '--cipher', V + 'z13.canonical.txt', '--mode', mode, '--patterns', 'FL,FIL,FML', '--threads', '4',
        '--max-seconds', String(NAMES_SEC), '--top', '200', '--stream', `${R}/names_z13_canonical_${mode}.tsv`, '--out', `${R}/names_z13_canonical_${mode}.json`]);
    }
  } else if (st === 'score') {
    for (const v of Z13) {
      const ins = [];
      for (const mode of ['simple', 'homophonic']) { const f = `${R}/enum_z13_${v.id}_${mode}.tsv`; if (fs.existsSync(path.join(ROOT, f))) ins.push('--in', f); }
      if (ins.length) run(`score_z13_${v.id}_words`, ['tools/cyclemodel_score.js', '--cipher', v.file, ...ins, '--track', v.track, '--top', '60', '--out', `${R}/score_z13_${v.id}_words.json`]);
    }
    const ni = [];
    for (const mode of ['simple', 'homophonic']) { const f = `${R}/names_z13_canonical_${mode}.tsv`; if (fs.existsSync(path.join(ROOT, f))) ni.push('--in', f); }
    if (ni.length) run('score_z13_canonical_names', ['tools/cyclemodel_score.js', '--cipher', V + 'z13.canonical.txt', ...ni, '--track', '4,9', '--top', '60', '--out', `${R}/score_z13_canonical_names.json`]);
  } else console.log('[pipeline] unknown step ' + st);
}
console.log('[pipeline] done');
