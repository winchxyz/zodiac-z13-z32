'use strict';
/**
 * tools/keyprior_fullpin.js - full key carry-over test.  For each cipher variant and known key
 * (z408, z340, union), pin every cipher symbol the key covers to its letter and search the
 * remaining symbols EXHAUSTIVELY (26^free keys) for the best value of the anneal.js objective
 * (5-gram joint + entropy penalty 0.5 + 1.0 x fast word-segmentation log10 P).  The same is done
 * for N null keys (the key's letters permuted among its symbols, or i.i.d. draws from them), and the
 * real key's upper-tail p-value P(null >= real) is reported.
 *
 *   node tools/keyprior_fullpin.js --ciphers z13.canonical,z32.canonical --keys z408,z340,union
 *        --null 2000 --null-kind permute --threads 4 --seed 1970 --max-free 4 --out results/keyprior/fullpin.json
 *
 * The null keys for a given key name are the same for every cipher variant (stream = key index).
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const K = require('./keyprior_lib');

if (!isMainThread) {
  const scorers = new Map();
  const lm = require('./lm');
  const J = workerData.J;
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    const out = [];
    for (const t of m.tasks) {
      let sc = scorers.get(t.text + '|' + (t.stat || ''));
      if (!sc) { sc = K.makeScorer(t.text, Object.assign({ J }, K.statOpts(t.stat))); scorers.set(t.text + '|' + (t.stat || ''), sc); }
      const fixed = Int8Array.from(t.fixed);
      const r = K.exhaustiveBest(sc, fixed, t.topK || 1);
      out.push({ id: t.id, score: r.top[0].score, plaintext: r.top[0].plaintext, top: t.topK > 1 ? r.top : undefined, evals: r.evals });
    }
    parentPort.postMessage({ type: 'done', out });
  });
  parentPort.postMessage({ type: 'ready' });
  return;
}

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const ciphers = String(o.ciphers || 'z13.canonical,z32.canonical').split(',');
  const keys = String(o.keys || 'z408,z340,union').split(',');
  const N = +(o.null || 1000);
  const kind = o['null-kind'] || 'permute';
  const threads = +(o.threads || 4);
  const seed = +(o.seed || 1970);
  const maxFree = +(o['max-free'] || 4);
  const stat = o.stat || 'objective';
  const nullCap = o['null-cap-5free'] ? +o['null-cap-5free'] : 0;
  const t0 = Date.now();
  const lm = require('./lm');
  const J = lm.table(5);
  // shared copy of the 5-gram table for the workers
  const sab = new SharedArrayBuffer(J.byteLength);
  const Js = new Float32Array(sab);
  Js.set(J);
  const workers = [];
  for (let i = 0; i < threads; i++) workers.push(new Worker(__filename, { workerData: { J: Js } }));

  // null keys per key name (same for all ciphers)
  const nullKeys = {};
  keys.forEach((kn, ki) => {
    const rng = K.makeRng(seed, 1000 + ki);
    nullKeys[kn] = [];
    for (let j = 0; j < N; j++) nullKeys[kn].push(K.nullKey(kind, K.key(kn), rng));
  });

  const tasks = [];
  const jobs = [];
  for (const cid of ciphers) {
    const text = K.cipherText(cid);
    const sc = K.makeScorer(text, { J });
    for (const kn of keys) {
      const km = K.key(kn);
      const fixedReal = sc.fixedFrom(km);
      const nFree = [...fixedReal].filter((x) => x < 0).length;
      const ov = K.overlap(text, km);
      if (nFree > maxFree + 1) { jobs.push({ cid, kn, skipped: `${nFree} free symbols` }); continue; }
      let nNull = N;
      if (nFree > maxFree) nNull = nullCap;
      const job = { cid, kn, text, nFree, overlap: ov, nNull, real: null, nulls: new Array(nNull) };
      jobs.push(job);
      const ji = jobs.length - 1;
      tasks.push({ id: `${ji}:-1`, text, fixed: Array.from(fixedReal), topK: 5, stat });
      for (let j = 0; j < nNull; j++) tasks.push({ id: `${ji}:${j}`, text, fixed: Array.from(sc.fixedFrom(nullKeys[kn][j])), topK: j < 3 ? 3 : 1, stat });
    }
  }
  process.stderr.write(`keyprior_fullpin: ${tasks.length} exhaustive searches on ${threads} threads\n`);
  // dispatch in chunks
  const chunk = 8;
  let next = 0, done = 0;
  await new Promise((resolve, reject) => {
    let active = 0;
    const send = (w) => {
      if (next >= tasks.length) return false;
      const part = tasks.slice(next, next + chunk);
      next += part.length;
      active++;
      w.postMessage({ type: 'tasks', tasks: part });
      return true;
    };
    let lastP = 0;
    workers.forEach((w) => {
      w.on('error', reject);
      w.on('message', (m) => {
        if (m.type === 'ready') { send(w); return; }
        if (m.type !== 'done') return;
        active--;
        for (const r of m.out) {
          const [ji, j] = r.id.split(':').map(Number);
          if (j < 0) jobs[ji].real = r; else jobs[ji].nulls[j] = r;
          done++;
        }
        const now = Date.now();
        if (now - lastP > 5000) { lastP = now; process.stderr.write(`\r${done}/${tasks.length} ${((now - t0) / 1000).toFixed(0)} s`); }
        if (!send(w) && active === 0) resolve();
      });
    });
  });
  workers.forEach((w) => w.postMessage({ type: 'exit' }));
  process.stderr.write('\n');

  const results = jobs.map((jb) => {
    if (jb.skipped) return jb;
    const nullScores = jb.nulls.map((r) => r.score);
    const pv = K.upperP(jb.real.score, nullScores);
    const order = jb.nulls.map((r, j) => [r.score, j]).sort((a, b) => b[0] - a[0]);
    const km = K.key(jb.kn);
    return {
      cipher: jb.cid, key: jb.kn, text: jb.text,
      pinnedSymbols: jb.overlap.join(''), nPinned: jb.overlap.length, nFree: jb.nFree,
      carriedOver: [...jb.text].map((ch) => (km.has(ch) ? km.get(ch) : '?')).join(''),
      real: { best: K.describe(jb.real.plaintext), score: jb.real.score, top5: jb.real.top.map((t) => ({ plaintext: t.plaintext, score: t.score })) },
      null: { n: nullScores.length, kind, summary: K.summary(nullScores), topNull: order.slice(0, 5).map(([s, j]) => ({ index: j, score: s, plaintext: jb.nulls[j].plaintext })) },
      test: nullScores.length ? { ...pv, z: (jb.real.score - K.summary(nullScores).mean) / K.summary(nullScores).sd } : null,
    };
  });
  const out = {
    tool: 'tools/keyprior_fullpin.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '),
    statistic: stat,
    objective: stat === 'word' ? 'word statistic: wordfast (unigram) word-segmentation log10 P only (common vocab, unknown-word spelling model); exhaustive over free symbols' : 'anneal.js objective: 5-gram joint log10 + entropy penalty 0.5 + 1.0 x wordfast log10 P (common vocab); exhaustive over free symbols',
    null: { kind, n: N, seed, note: 'null keys for a key name are shared by all ciphers; permute = key letters shuffled among the key symbols' },
    seconds: (Date.now() - t0) / 1000,
    results,
  };
  if (o.out) K.writeJSON(o.out, out);
  for (const r of results) {
    if (r.skipped) { console.log(`${r.cid} ${r.kn}: skipped (${r.skipped})`); continue; }
    if (!r.null.n) { console.log(`${r.cipher.padEnd(24)} ${r.key.padEnd(6)} pinned ${String(r.nPinned).padStart(2)} free ${r.nFree}  real ${r.real.score.toFixed(2)} ${r.real.best.plaintext} [${r.real.best.words}]  (no null run)`); continue; }
    console.log(`${r.cipher.padEnd(24)} ${r.key.padEnd(6)} pinned ${String(r.nPinned).padStart(2)} free ${r.nFree}  real ${r.real.score.toFixed(2)} ${r.real.best.plaintext} [${r.real.best.words}]  null mean ${r.null.summary.mean.toFixed(2)} sd ${r.null.summary.sd.toFixed(2)} max ${r.null.summary.max.toFixed(2)}  p=${r.test.p.toFixed(4)} pct=${r.test.percentile.toFixed(1)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
