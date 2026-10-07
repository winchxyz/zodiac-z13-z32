'use strict';
/**
 * tools/keyprior_z32subsets.js - partial key carry-over test for Z32 (and any short cipher).
 *
 * For a known key (z408, z340, union) and subset sizes k, draw M random k-subsets of the cipher
 * symbols the key covers (the same subsets for the real key and every null key), pin those symbols
 * to the key's letters and solve the rest with the project annealer (tools/solvercore.js runRestart,
 * objective: 5-gram joint + entropy 0.5 + 1.0 x fast word term in the inner loop, i.e. anneal.js
 * --wordweight 1).  Statistic per k: the best objective over the M subsets (max) and the mean over
 * subsets.  The same procedure is run for N null keys (key letters permuted among the key symbols);
 * p = P(null >= real).
 *
 *   node tools/keyprior_z32subsets.js --cipher z32.canonical --key z408 --ks 6,12,18 --subsets 8
 *        --null 300 --restarts 4 --iters 40000 --threads 4 --seed 32 --out results/keyprior/z32subsets_z408.json
 *   node tools/keyprior_z32subsets.js --bench --cipher z32.canonical --key z408   (convergence check)
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const K = require('./keyprior_lib');
const A = require('./anneal');
const core = require('./solvercore');
const lmshare = require('./lmshare');

function baseDef(text, iters) {
  const o = Object.assign({}, A.DEFAULTS, { cipher: text, mode: 'homophonic', wordweight: 1, wordmodel: 'fast', n: '5', entropy: 0.5, quiet: true });
  const { def } = A.makeProblem(o);
  def.wordInner = true;
  if (iters) def.iters = iters;
  return def;
}

if (!isMainThread) {
  const T = lmshare.attach(workerData.lm);
  const Ps = new Map();
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    const out = [];
    for (const t of m.tasks) {
      let P = Ps.get(t.text);
      if (!P) {
        const def = baseDef(t.text, t.iters);
        P = core.prepare(def, T, core.wordScorer(def));
        P.def0 = def;
        Ps.set(t.text, P);
      }
      P.def = Object.assign({}, P.def0, { fixed: t.fixed, iters: t.iters, seed: t.seed >>> 0, perRestart: 1 });
      let best = null;
      const scores = [];
      for (let r = 0; r < t.restarts; r++) {
        const ro = core.runRestart(P, r);
        const res = ro.results[0];
        scores.push(res.score);
        if (!best || res.score > best.score) best = res;
      }
      out.push({ id: t.id, score: best.score, key: best.key, scores });
    }
    parentPort.postMessage({ type: 'done', out });
  });
  parentPort.postMessage({ type: 'ready' });
  return;
}

function runPool(threads, tasks, onProgress) {
  const shared = lmshare.build({ orders: [5], markov: false, six: 'exact' });
  const workers = [];
  for (let i = 0; i < threads; i++) workers.push(new Worker(__filename, { workerData: { lm: shared } }));
  const results = new Map();
  let next = 0;
  const chunk = 2;
  return new Promise((resolve, reject) => {
    let active = 0;
    const send = (w) => { if (next >= tasks.length) return false; const part = tasks.slice(next, next + chunk); next += part.length; active++; w.postMessage({ type: 'tasks', tasks: part }); return true; };
    workers.forEach((w) => {
      w.on('error', reject);
      w.on('message', (m) => {
        if (m.type === 'ready') { send(w); return; }
        active--;
        for (const r of m.out) results.set(r.id, r);
        if (onProgress) onProgress(results.size, tasks.length);
        if (!send(w) && active === 0) { workers.forEach((x) => x.postMessage({ type: 'exit' })); resolve(results); }
      });
    });
  });
}

function sample(arr, k, rng) {
  const a = arr.slice();
  K.shuffle(a, rng);
  return a.slice(0, k);
}

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const cid = o.cipher || 'z32.canonical';
  const kn = o.key || 'z408';
  const text = K.cipherText(cid);
  const km = K.key(kn);
  const ov = K.overlap(text, km);
  const threads = +(o.threads || 4);
  const seed = +(o.seed || 32);
  const restarts = +(o.restarts || 4);
  const iters = +(o.iters || 40000);
  const t0 = Date.now();
  const sc = K.makeScorer(text);
  const decodeKeyStr = (ks) => { let s = ''; for (let i = 0; i < sc.L; i++) s += ks[sc.ids[i]]; return s; };
  const fixedFor = (pinMap) => Array.from(sc.fixedFrom(pinMap));

  if (o.bench) {
    // convergence: one subset per k, many restarts at several iteration budgets
    const rng = K.makeRng(seed, 1);
    const tasks = [];
    const ks = String(o.ks || '6,12,18').split(',').map(Number);
    const itList = String(o['bench-iters'] || '10000,30000,100000').split(',').map(Number);
    for (const k of ks) {
      const sub = sample(ov, k, rng);
      const pins = new Map(sub.map((s) => [s, km.get(s)]));
      for (const it of itList) tasks.push({ id: `${k}:${it}`, text, fixed: fixedFor(pins), restarts: +(o['bench-restarts'] || 16), iters: it, seed });
    }
    const t1 = Date.now();
    const res = await runPool(threads, tasks);
    for (const t of tasks) {
      const r = res.get(t.id);
      const sorted = r.scores.slice().sort((a, b) => b - a);
      const hits = r.scores.filter((x) => x >= sorted[0] - 1e-6).length;
      console.log(`k=${t.id.split(':')[0]} iters=${t.iters} best ${r.score.toFixed(2)} hits ${hits}/${r.scores.length} median ${sorted[sorted.length >> 1].toFixed(2)} ${decodeKeyStr(r.key)}`);
    }
    console.log(`bench ${((Date.now() - t1) / 1000).toFixed(1)} s for ${tasks.length} tasks x ${tasks[0].restarts} restarts`);
    return;
  }

  const ks = String(o.ks || '8,16,22').split(',').map(Number).filter((k) => k <= ov.length);
  const itersPerK = {};
  for (const t of String(o['iters-per-k'] || '').split(',').filter(Boolean)) { const [k, it] = t.split(':').map(Number); itersPerK[k] = it; }
  const R = +(o['real-subsets'] || 50);
  const N = +(o.null || 1000);
  const kind = o['null-kind'] || 'permute';
  // real key: R random subsets per k; null keys: one fresh random subset per k each
  const rngS = K.makeRng(seed, 7);
  const rngN = K.makeRng(seed, 3000);
  const nullKeys = [];
  for (let j = 0; j < N; j++) nullKeys.push(K.nullKey(kind, km, rngN));
  const tasks = [];
  const realSubs = {}, nullSubs = {};
  for (const k of ks) {
    const it = itersPerK[k] || iters;
    realSubs[k] = [];
    for (let r = 0; r < R; r++) {
      const sub = sample(ov, k, rngS);
      realSubs[k].push(sub);
      tasks.push({ id: `R:${k}:${r}`, text, fixed: fixedFor(new Map(sub.map((x) => [x, km.get(x)]))), restarts, iters: it, seed: seed * 7919 + k * 1009 + r });
    }
    nullSubs[k] = [];
    for (let j = 0; j < N; j++) {
      const sub = sample(ov, k, rngS);
      nullSubs[k].push(sub);
      tasks.push({ id: `N:${k}:${j}`, text, fixed: fixedFor(new Map(sub.map((x) => [x, nullKeys[j].get(x)]))), restarts, iters: it, seed: seed * 7919 + k * 1009 + 100000 + j });
    }
  }
  process.stderr.write(`keyprior_z32subsets: ${cid} ${kn} overlap ${ov.length}, ks ${ks}, real ${R} subsets/k, ${N} null keys x 1 subset/k -> ${tasks.length} solves x ${restarts} restarts\n`);
  let lastP = 0;
  const res = await runPool(threads, tasks, (d, n) => { const now = Date.now(); if (now - lastP > 10000) { lastP = now; process.stderr.write(`\r${d}/${n} ${((now - t0) / 1000).toFixed(0)} s`); } });
  process.stderr.write('\n');
  const perK = {};
  const rngB = K.makeRng(seed, 99);
  for (const k of ks) {
    const real = realSubs[k].map((_, r) => res.get(`R:${k}:${r}`).score);
    const nul = nullSubs[k].map((_, j) => res.get(`N:${k}:${j}`).score);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const mxR = Math.max(...real);
    const ri = real.indexOf(mxR);
    const rb = res.get(`R:${k}:${ri}`);
    // mean test: permutation of the pooled values (real R vs null N)
    const pooled = real.concat(nul);
    const obs = mean(real) - mean(nul);
    let ge = 0;
    const B = 10000;
    for (let b = 0; b < B; b++) {
      const a = pooled.slice();
      for (let i = 0; i < R; i++) { const j = i + rngB.int(a.length - i); const t = a[i]; a[i] = a[j]; a[j] = t; }
      const mR = mean(a.slice(0, R));
      const mN = (pooled.reduce((x, y) => x + y, 0) - mR * R) / (a.length - R);
      if (mR - mN >= obs - 1e-12) ge++;
    }
    // max test: max of R real values vs max of R values drawn from the null pool (bootstrap)
    let geMax = 0;
    for (let b = 0; b < B; b++) { let m = -Infinity; for (let i = 0; i < R; i++) m = Math.max(m, nul[rngB.int(nul.length)]); if (m >= mxR - 1e-9) geMax++; }
    // single-value percentile of the real best in the null distribution
    perK[k] = {
      k, iters: itersPerK[k] || iters,
      real: { n: R, mean: mean(real), max: mxR, summary: K.summary(real), best: K.describe(decodeKeyStr(rb.key)), bestSubset: realSubs[k][ri].join(''), values: real },
      null: { n: N, summary: K.summary(nul) },
      test: {
        meanDiff: obs, pMean: (ge + 1) / (B + 1),
        pMaxOfR: (geMax + 1) / (B + 1),
        realMaxVsSingleNull: K.upperP(mxR, nul),
      },
    };
    const nb = nul.indexOf(Math.max(...nul));
    perK[k].null.best = { score: nul[nb], plaintext: decodeKeyStr(res.get(`N:${k}:${nb}`).key) };
    console.log(`k=${k}: real mean ${mean(real).toFixed(2)} max ${mxR.toFixed(2)} (${decodeKeyStr(rb.key)}) | null mean ${mean(nul).toFixed(2)} sd ${perK[k].null.summary.sd.toFixed(2)} max ${nul[nb].toFixed(2)} | p(mean)=${perK[k].test.pMean.toFixed(4)} p(max of ${R})=${perK[k].test.pMaxOfR.toFixed(4)}`);
  }
  const out = {
    tool: 'tools/keyprior_z32subsets.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '),
    cipher: cid, text, key: kn, overlap: ov.join(''), nOverlap: ov.length,
    solver: { restarts, iters, itersPerK, objective: 'solvercore runRestart: 5-gram joint + entropy 0.5 + 1.0 x wordfast (inner loop), greedy polish' },
    design: `real key: ${R} random k-subsets per k; null: ${N} ${kind} keys, one random k-subset each; pMean = permutation test of mean(real) - mean(null); pMaxOfR = P(max of ${R} null draws >= real max) by bootstrap`,
    null: { kind, n: N, seed }, seconds: (Date.now() - t0) / 1000, perK,
  };
  if (o.out) K.writeJSON(o.out, out);
}

main().catch((e) => { console.error(e); process.exit(1); });
