'use strict';
/**
 * tools/lead_cipherexpert_arrpower.js - positive control for the arrangement test.
 *
 * For real English 13-letter windows that fit Z13's pattern (the replication's positive-control
 * rows, results/lead/replicate/power_<variant>_rows.json), take the window's own letters on the six
 * shared slots (A,E,N,z,K,M), enumerate every distinct arrangement of those letters over the slots,
 * and record the rank of the true arrangement under t1/t2/t3 (tools/lead_replicate_lib.js).
 * Under H0 (key unrelated) the arrangement p of the real Z13 key is uniform; under H1 (true
 * letters) this gives its distribution.  Compare with the observed real-key arrangement p
 * (results/lead/cipherexpert/arrange.json).
 *
 * usage: node tools/lead_cipherexpert_arrpower.js --variant circles_distinct [--max 200]
 *          [--workers 4] [--seed 5] [--out file]
 *        (internal) --shard i/n --part file
 * Output: results/lead/cipherexpert/arrpower_<variant>.json
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const R = require('./lead_replicate_lib');

const args = process.argv.slice(2);
const opt = { variant: 'circles_distinct', max: 200, workers: 4, seed: 5, out: null, shard: null, part: null, src: 'heldout' };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--variant') opt.variant = args[++i];
  else if (a === '--max') opt.max = parseInt(args[++i], 10);
  else if (a === '--workers') opt.workers = parseInt(args[++i], 10);
  else if (a === '--seed') opt.seed = parseInt(args[++i], 10);
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--shard') opt.shard = args[++i];
  else if (a === '--part') opt.part = args[++i];
  else if (a === '--src') opt.src = args[++i];
}
opt.out = opt.out || path.join(R.ROOT, `results/lead/cipherexpert/arrpower_${opt.variant}.json`);

function distinctPerms(arr) {
  const out = [];
  const a = arr.slice().sort((x, y) => x - y);
  const used = new Array(a.length).fill(false);
  const cur = [];
  (function rec() {
    if (cur.length === a.length) { out.push(cur.slice()); return; }
    for (let i = 0; i < a.length; i++) {
      if (used[i] || (i > 0 && a[i] === a[i - 1] && !used[i - 1])) continue;
      used[i] = true; cur.push(a[i]); rec(); cur.pop(); used[i] = false;
    }
  })();
  return out;
}

function selectRows() {
  const rows = JSON.parse(fs.readFileSync(path.join(R.ROOT, `results/lead/replicate/power_${opt.variant}_rows.json`), 'utf8'));
  let sel = opt.src === 'all' ? rows : rows.filter((r) => r.src === opt.src);
  const rng = R.makeRng(opt.seed);
  sel = R.shuffle(sel.slice(), rng).slice(0, opt.max);
  return sel;
}

function runShard(rowsAll, i, n) {
  const lay = R.layout(opt.variant);
  const E = R.engine(lay);
  const out = [];
  for (let r = i; r < rowsAll.length; r += n) {
    const w = rowsAll[r].w;
    const truth = lay.slotPos.map((ps) => w.charCodeAt(ps[0]) - 65);
    const perms = distinctPerms(truth);
    const tk = truth.join(',');
    const vals = perms.map((p) => ({ k: p.join(','), s: E.stats(R.slotLetters(lay, p)) }));
    const tv = vals.find((x) => x.k === tk).s;
    const rec = { w, nArr: perms.length };
    for (const st of R.STATS) {
      const ge = vals.filter((x) => x.s[st] >= tv[st] - 1e-12).length; // includes the truth itself
      rec[st] = ge / perms.length;
    }
    out.push(rec);
  }
  return out;
}

function summarize(recs, observed) {
  const res = { n: recs.length, perStat: {} };
  for (const st of R.STATS) {
    const ps = recs.map((r) => r[st]).sort((a, b) => a - b);
    const q = (f) => ps[Math.min(ps.length - 1, Math.floor(f * ps.length))];
    const obs = observed ? observed[st] : null;
    const o = { median: q(0.5), q25: q(0.25), q75: q(0.75), q90: q(0.9),
      fracBest: recs.filter((r) => r[st] <= 1 / r.nArr + 1e-12).length / recs.length,
      fracLe01: ps.filter((x) => x <= 0.01).length / ps.length,
      fracLe05: ps.filter((x) => x <= 0.05).length / ps.length };
    if (obs != null) {
      o.observed = obs;
      o.h1TailAtObs = ps.filter((x) => x <= obs + 1e-12).length / ps.length;   // P(p <= obs | H1)
      o.h0TailAtObs = obs;                                                     // uniform under H0
      o.tailRatio = o.h1TailAtObs / obs;
      const lo = obs / 2, hi = Math.min(1, obs * 2);
      o.h1Band = ps.filter((x) => x > lo && x <= hi).length / ps.length;     // P(obs/2 < p <= 2 obs | H1)
      o.h0Band = hi - lo;
      o.bandRatio = o.h1Band / o.h0Band;                                       // local likelihood ratio
    }
    res.perStat[st] = o;
  }
  return res;
}

async function main() {
  const rowsAll = selectRows();
  if (opt.shard) {
    const [i, n] = opt.shard.split('/').map(Number);
    fs.writeFileSync(opt.part, JSON.stringify(runShard(rowsAll, i, n)));
    return;
  }
  const t0 = Date.now();
  const parts = [];
  const procs = [];
  for (let i = 0; i < opt.workers; i++) {
    const part = opt.out.replace(/\.json$/, `.part${i}.json`);
    parts.push(part);
    const cargs = [__filename, '--variant', opt.variant, '--max', String(opt.max), '--seed', String(opt.seed), '--src', opt.src,
      '--shard', `${i}/${opt.workers}`, '--part', part];
    procs.push(new Promise((res, rej) => {
      const c = spawn(process.execPath, cargs, { stdio: 'inherit' });
      c.on('exit', (code) => (code === 0 ? res() : rej(new Error('shard ' + i + ' exit ' + code))));
    }));
  }
  await Promise.all(procs);
  const recs = parts.flatMap((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
  for (const p of parts) fs.unlinkSync(p);
  let observed = null;
  const arrFile = path.join(R.ROOT, 'results/lead/cipherexpert/arrange.json');
  if (fs.existsSync(arrFile)) {
    const A = JSON.parse(fs.readFileSync(arrFile, 'utf8'));
    const v = A.variants[opt.variant];
    if (v) observed = Object.fromEntries(R.STATS.map((st) => [st, v.perStat[st].p_ge]));
  }
  const out = { tool: 'tools/lead_cipherexpert_arrpower.js', variant: opt.variant, src: opt.src, seed: opt.seed,
    seconds: (Date.now() - t0) / 1000, summary: summarize(recs, observed), rows: recs };
  fs.writeFileSync(opt.out, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.summary, null, 1));
  console.log('wrote', opt.out, out.seconds, 's');
}
main().catch((e) => { console.error(e); process.exit(1); });
