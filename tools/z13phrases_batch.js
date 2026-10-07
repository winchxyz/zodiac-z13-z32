'use strict';
/**
 * tools/z13phrases_batch.js - run a named group of z13phrases_enum.js jobs one after
 * another inside ONE machine slot (start it through tools/run_slot.js).  Jobs whose
 * output JSON already exists with counts.complete = true are skipped, so a batch can
 * be re-run after a stop.
 *
 *   node tools/run_slot.js --label z13phrases -- node tools/z13phrases_batch.js --plan main_simple [--threads 4] [--budget 2400] [--dry]
 *
 * Plans (all on Z13; cipher files in data/ciphers/variants/, 60006 = the whole common list):
 *   main_simple / main_homophonic : 5 variants x top 60006 words, <= 5 words
 *   full3_simple / full3_homophonic : 5 variants x full 333k vocabulary, <= 3 words
 *   handle : full vocabulary, <= 1 and <= 2 words, both modes, canonical + letters_literal
 *   m6_simple : 60006 words, <= 6 words, simple, all variants
 *   ends_simple / ends_homophonic : canonical with null letters at the ends (ranges)
 *   slip_simple / slip_homophonic : canonical with one wildcard position (13 runs)
 * Outputs: results/z13phrases/runs/<job>.json, .tsv (fits >= stream-min), logs/<job>.log.
 * --budget S: do not START a job after S seconds; each job also gets --max-seconds
 * min(remaining budget, its own cap).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'results', 'z13phrases');
const NULLF = 'results/z13phrases/null_real_phrases.json';
const VAR = 'data/ciphers/variants';
const VARIANTS = [
  { id: 'canonical', cipher: `${VAR}/z13.canonical.txt` },
  { id: 'circles_distinct', cipher: `${VAR}/z13.circles_distinct.txt` },
  { id: 'crosshair_null', cipher: `${VAR}/z13.crosshair_null.txt` },
  { id: 'reversed', cipher: `${VAR}/z13.reversed.txt` },
  { id: 'letters_literal', cipher: `${VAR}/z13.canonical.txt`, pin: 'A=A,E=E,N=N,K=K,M=M' },
];
const RANGES = [['1:13', 'drop_first1'], ['0:12', 'drop_last1'], ['1:12', 'drop_both1'], ['2:13', 'drop_first2'], ['0:11', 'drop_last2']];

function opts(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    if (k === 'dry') o.dry = true; else o[k] = argv[++i];
  }
  return o;
}

function job(name, v, mode, extra, tlow, cap) {
  const args = ['--cipher', v.cipher, '--mode', mode, '--null', NULLF, '--tlow', String(tlow), ...extra];
  if (v.pin) args.push('--pin', v.pin);
  return { name, args, cap };
}

/* tlow / stream-min: a number, or a real-phrase percentile (p10, p25 ...) of the matching length.
 * Simple mode is cheap and scores nearly everything; homophonic scores from the real p25. */
function plan(name) {
  const J = [];
  const T = { simple: ['-16', 'p10'], homophonic: ['p25', 'p25'] };
  const T2 = { simple: ['p10', 'p25'], homophonic: ['p25', 'p50'] };
  const sm = (t) => ['--stream-min', t[1]];
  if (name === 'main_simple' || name === 'main_homophonic') {
    const mode = name.split('_')[1];
    const order = mode === 'homophonic' ? [4, 0, 3, 2, 1] : [0, 1, 2, 3, 4];
    for (const k of order) { const v = VARIANTS[k]; J.push(job(`w60k5_${v.id}_${mode}`, v, mode, ['--top-words', '60006', '--max-words', '5', ...sm(T[mode])], T[mode][0], 2400)); }
  } else if (name === 'main4_homophonic') {
    for (const v of VARIANTS) J.push(job(`w60k4_${v.id}_homophonic`, v, 'homophonic', ['--top-words', '60006', '--max-words', '4', ...sm(T.homophonic)], T.homophonic[0], 2400));
  } else if (name === 'full3_simple' || name === 'full3_homophonic') {
    const mode = name.split('_')[1];
    for (const v of VARIANTS) J.push(job(`full3_${v.id}_${mode}`, v, mode, ['--vocab', 'full', '--top-words', '333333', '--max-words', '3', ...sm(['', 'p25'])], 'p25', 2400));
  } else if (name === 'handle') {
    for (const mode of ['simple', 'homophonic']) for (const v of [VARIANTS[0], VARIANTS[4], VARIANTS[1], VARIANTS[2], VARIANTS[3]]) for (const M of [1, 2]) {
      J.push(job(`full${M}_${v.id}_${mode}`, v, mode, ['--vocab', 'full', '--top-words', '333333', '--max-words', String(M), '--stream-min', M === 1 ? '-1e9' : 'p10'], M === 1 ? -1e9 : 'p10', 300));
    }
  } else if (name === 'm6_simple') {
    for (const v of VARIANTS) J.push(job(`w60k6_${v.id}_simple`, v, 'simple', ['--top-words', '60006', '--max-words', '6', ...sm(T2.simple)], T2.simple[0], 2400));
  } else if (name === 'ends_simple' || name === 'ends_homophonic') {
    const mode = name.split('_')[1];
    for (const [r, id] of RANGES) J.push(job(`ends_${id}_${mode}`, VARIANTS[0], mode, ['--top-words', '60006', '--max-words', mode === 'simple' ? '5' : '4', '--range', r, ...sm(T2[mode])], T2[mode][0], 2400));
  } else if (name === 'slip_simple' || name === 'slip_homophonic') {
    const mode = name.split('_')[1];
    if (mode === 'homophonic') J.push(job('slipNA_homophonic', VARIANTS[0], mode, ['--top-words', '20000', '--max-words', '4', ...sm(T2[mode])], T2[mode][0], 600));
    // homophonic slips are much larger spaces: top 20000 words, <= 4 words (coverage in coverage.json), capped at 300 s each
    for (let p = 0; p < 13; p++) J.push(job(`slip${String(p).padStart(2, '0')}_${mode}`, VARIANTS[0], mode, ['--top-words', mode === 'simple' ? '60006' : '20000', '--max-words', mode === 'simple' ? '5' : '4', '--slip', String(p), ...sm(T2[mode])], T2[mode][0], mode === 'simple' ? 1200 : 300));
  } else if (name === 'ngramcheck') {
    J.push({ name, script: 'z13phrases_ngramcheck.js', args: [], cap: 600 });
  } else if (name === 'circles') {
    // 60006 words / 5 words did not finish its first task in 6 minutes (killed); smaller list instead
    // the simple 60006/5 run also did not finish one task in 21 minutes (killed)
    for (const mode of ['simple', 'homophonic']) J.push(job(`w20k4_circles_distinct_${mode}`, VARIANTS[1], mode, ['--top-words', '20000', '--max-words', '4', '--stream-min', 'p25'], 'p25', 900));
  } else if (name === 'calib_simple' || name === 'calib_homophonic') {
    J.push({ name, script: 'z13phrases_calib.js', args: ['enum', '--modes', name.split('_')[1], '--n', '16', '--max-words', name === 'calib_simple' ? '5' : '4', '--cap', '100'], cap: 2400, noOut: true });
  } else throw new Error(`unknown plan ${name}`);
  return J;
}

function done(file) {
  try { const c = JSON.parse(fs.readFileSync(file, 'utf8')).counts; return c.complete === true || c.taskSample != null; } catch (_) { return false; }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** Atomic claim so that two batches reading the same queue never run the same job. */
function claim(name) {
  const f = path.join(OUT, 'runs', `${name}.claim`);
  for (let t = 0; t < 2; t++) {
    try { const fd = fs.openSync(f, 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd); return f; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let pid = 0;
      try { pid = +fs.readFileSync(f, 'utf8'); } catch (_) {}
      if (pid && alive(pid)) return null;
      try { fs.rmSync(f, { force: true }); } catch (_) {}
    }
  }
  return null;
}

async function main() {
  const o = opts(process.argv.slice(2));
  // results/z13phrases/queue.txt (one plan per line, priority order) overrides --plan, so every
  // queued batch works through the same list; claims keep them from doubling up
  const qf = path.join(OUT, 'queue.txt');
  const plans = !o['ignore-queue'] && fs.existsSync(qf) ? fs.readFileSync(qf, 'utf8').split(/\s+/).filter(Boolean) : String(o.plan).split(',');
  console.log(`plans: ${plans.join(',')}`);
  const jobs = plans.flatMap(plan);
  const threads = o.threads || '4';
  const budget = +o.budget || 2400;
  const t0 = Date.now();
  fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'logs'), { recursive: true });
  for (const j of jobs) {
    const outJ = path.join(OUT, 'runs', `${j.name}.json`);
    if (done(outJ)) { console.log(`skip ${j.name} (complete)`); continue; }
    if (j.noOut && fs.existsSync(path.join(OUT, 'calib', `enum_${j.name.split('_')[1]}.json`))) { console.log(`skip ${j.name} (calib output exists)`); continue; }
    const left = budget - (Date.now() - t0) / 1000;
    if (left < 30) { console.log(`budget used up before ${j.name}`); break; }
    const cap = Math.floor(Math.min(left, j.cap));
    const args = j.script ? [path.join(__dirname, j.script), ...j.args, '--threads', threads]
      : [path.join(__dirname, 'z13phrases_enum.js'), ...j.args, '--threads', threads, '--max-seconds', String(cap),
        '--out', path.relative(ROOT, outJ), '--stream', path.relative(ROOT, path.join(OUT, 'runs', `${j.name}.tsv`)), '--label', j.name, '--top', '5000'];
    if (o.dry) { console.log(`run ${j.name}: node ${args.slice(1).join(' ')}`); continue; }
    const cl = claim(j.name);
    if (!cl) { console.log(`skip ${j.name} (claimed by another batch)`); continue; }
    if (done(outJ)) { fs.rmSync(cl, { force: true }); continue; }
    console.log(`run ${j.name}: node ${args.slice(1).join(' ')}`);
    const logf = fs.openSync(path.join(OUT, 'logs', `${j.name}.log`), 'w');
    fs.writeSync(logf, `node tools/${j.script || 'z13phrases_enum.js'} ${args.slice(1).join(' ')}\n`);
    const t1 = Date.now();
    const code = await new Promise((res) => {
      const ch = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', logf, logf] });
      ch.on('exit', (c) => res(c));
    });
    fs.closeSync(logf);
    fs.rmSync(cl, { force: true });
    let summary = '';
    try { const r = JSON.parse(fs.readFileSync(outJ, 'utf8')); summary = `complete=${r.counts.complete} strings=${r.counts.consistentStrings} >=median=${r.counts.atLeast.real_p50 && r.counts.atLeast.real_p50.count} best=${r.top[0] && r.top[0].words}`; } catch (_) { summary = 'no output'; }
    console.log(`  exit ${code}, ${((Date.now() - t1) / 1000).toFixed(0)} s, ${summary}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
