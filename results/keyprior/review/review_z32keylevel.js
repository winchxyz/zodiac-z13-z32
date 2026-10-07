'use strict';
/**
 * results/keyprior/review/review_z32keylevel.js - key-level partial-pin test for Z32.
 *
 * tools/keyprior_z32subsets.js compared R = 30 subsets of ONE real key with 500 single-subset draws
 * from 500 DIFFERENT null keys and ran a permutation test of the means (pMean).  The 30 real values
 * share one key, so they are not exchangeable with the null values (pseudo-replication): pMean is
 * driven to 0 or 1 by where that one key happens to sit.  Here the unit of replication is the key:
 * R fixed subsets per k (the same subsets for every key, paired design), the real key and M permuted
 * null keys are each solved on all R subsets, and the statistic is the key's mean (and max) over R.
 * p = (#null keys with statistic >= real + 1) / (M + 1).
 *
 *   node results/keyprior/review/review_z32keylevel.js --key z408 --ks 8,16 --subsets 10 --null 60
 *        --restarts 2 --iters-per-k 8:50000,16:25000 --threads 4 --seed 77 --out results/keyprior/review/z32keylevel_z408.json
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const T = (f) => path.join(__dirname, '..', '..', '..', 'tools', f);
const K = require(T('keyprior_lib'));
const A = require(T('anneal'));
const core = require(T('solvercore'));
const lmshare = require(T('lmshare'));

function baseDef(text, iters) {
  const o = Object.assign({}, A.DEFAULTS, { cipher: text, mode: 'homophonic', wordweight: 1, wordmodel: 'fast', n: '5', entropy: 0.5, quiet: true });
  const { def } = A.makeProblem(o);
  def.wordInner = true;
  if (iters) def.iters = iters;
  return def;
}

if (!isMainThread) {
  const TT = lmshare.attach(workerData.lm);
  const Ps = new Map();
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    const out = [];
    for (const t of m.tasks) {
      let P = Ps.get(t.text);
      if (!P) { const def = baseDef(t.text, t.iters); P = core.prepare(def, TT, core.wordScorer(def)); P.def0 = def; Ps.set(t.text, P); }
      P.def = Object.assign({}, P.def0, { fixed: t.fixed, iters: t.iters, seed: t.seed >>> 0, perRestart: 1 });
      let best = -Infinity;
      for (let r = 0; r < t.restarts; r++) { const s = core.runRestart(P, r).results[0].score; if (s > best) best = s; }
      out.push({ id: t.id, score: best });
    }
    parentPort.postMessage({ type: 'done', out });
  });
  parentPort.postMessage({ type: 'ready' });
  return;
}

async function runPool(threads, tasks) {
  const shared = lmshare.build({ orders: [5], markov: false, six: 'exact' });
  const workers = [];
  for (let i = 0; i < threads; i++) workers.push(new Worker(__filename, { workerData: { lm: shared } }));
  const results = new Map();
  let next = 0;
  const t0 = Date.now();
  let lastP = 0;
  return new Promise((resolve, reject) => {
    let active = 0;
    const send = (w) => { if (next >= tasks.length) return false; const part = tasks.slice(next, next + 2); next += part.length; active++; w.postMessage({ type: 'tasks', tasks: part }); return true; };
    workers.forEach((w) => {
      w.on('error', reject);
      w.on('message', (m) => {
        if (m.type === 'ready') { send(w); return; }
        active--;
        for (const r of m.out) results.set(r.id, r);
        const now = Date.now();
        if (now - lastP > 15000) { lastP = now; process.stderr.write(`\r${results.size}/${tasks.length} ${((now - t0) / 1000).toFixed(0)} s`); }
        if (!send(w) && active === 0) { workers.forEach((x) => x.postMessage({ type: 'exit' })); resolve(results); }
      });
    });
  });
}

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const cid = o.cipher || 'z32.canonical';
  const kn = o.key || 'z408';
  const text = K.cipherText(cid);
  const km = K.key(kn);
  const ov = K.overlap(text, km);
  const ks = String(o.ks || '8,16').split(',').map(Number);
  const R = +(o.subsets || 10);
  const M = +(o.null || 60);
  const restarts = +(o.restarts || 2);
  const seed = +(o.seed || 77);
  const threads = +(o.threads || 4);
  const itersPerK = {};
  for (const t of String(o['iters-per-k'] || '8:50000,16:25000').split(',')) { const [k, it] = t.split(':').map(Number); itersPerK[k] = it; }
  const t0 = Date.now();
  const sc = K.makeScorer(text);
  const rngS = K.makeRng(seed, 7), rngN = K.makeRng(seed, 3000);
  const keys = [km];
  for (let j = 0; j < M; j++) keys.push(K.permuteKey(km, rngN));
  const subs = {};
  const tasks = [];
  for (const k of ks) {
    subs[k] = [];
    for (let r = 0; r < R; r++) { const a = ov.slice(); K.shuffle(a, rngS); subs[k].push(a.slice(0, k)); }
    keys.forEach((key, ki) => subs[k].forEach((sub, r) => {
      tasks.push({ id: `${k}:${ki}:${r}`, text, fixed: Array.from(sc.fixedFrom(new Map(sub.map((x) => [x, key.get(x)])))), iters: itersPerK[k] || 30000, restarts, seed: seed * 7919 + k * 1009 + r * 31 + ki * 100003 });
    }));
  }
  process.stderr.write(`review_z32keylevel: ${cid} ${kn} overlap ${ov.length}, ks ${ks}, ${R} subsets x ${M + 1} keys -> ${tasks.length} solves\n`);
  const res = await runPool(threads, tasks);
  process.stderr.write('\n');
  const perK = {};
  for (const k of ks) {
    const meanOf = (ki) => { let s = 0; for (let r = 0; r < R; r++) s += res.get(`${k}:${ki}:${r}`).score; return s / R; };
    const maxOf = (ki) => { let m = -Infinity; for (let r = 0; r < R; r++) m = Math.max(m, res.get(`${k}:${ki}:${r}`).score); return m; };
    const means = keys.map((_, ki) => meanOf(ki)), maxes = keys.map((_, ki) => maxOf(ki));
    const pMean = K.upperP(means[0], means.slice(1)), pMax = K.upperP(maxes[0], maxes.slice(1));
    // lower-tail too: is the real key unusually BAD?
    const lowMean = (means.slice(1).filter((v) => v <= means[0] + 1e-9).length + 1) / (M + 1);
    perK[k] = { k, R, M, realMean: means[0], realMax: maxes[0], nullMeanSummary: K.summary(means.slice(1)), nullMaxSummary: K.summary(maxes.slice(1)), pMeanUpper: pMean.p, pMeanLower: lowMean, pMaxUpper: pMax.p, subsets: subs[k].map((s) => s.join('')) };
    console.log(`${kn} k=${k}: real mean ${means[0].toFixed(2)} (null key means: mean ${perK[k].nullMeanSummary.mean.toFixed(2)} sd ${perK[k].nullMeanSummary.sd.toFixed(2)}) upper p=${pMean.p.toFixed(3)} lower p=${lowMean.toFixed(3)} | real max ${maxes[0].toFixed(2)} upper p=${pMax.p.toFixed(3)}`);
  }
  const out = { tool: 'results/keyprior/review/review_z32keylevel.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '), cipher: cid, key: kn, overlap: ov.join(''), restarts, itersPerK, seconds: (Date.now() - t0) / 1000, perK };
  if (o.out) K.writeJSON(o.out, out);
}

main().catch((e) => { console.error(e); process.exit(1); });
