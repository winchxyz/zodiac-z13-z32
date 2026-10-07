'use strict';
/**
 * tools/keyprior_calibrate.js - calibration of the full-pin carry-over test on the SOLVED ciphers.
 *
 * Take windows of a solved cipher (Z408 written order, or Z340 in reading order), pin every window
 * symbol that a key covers, search the uncovered symbols exhaustively (keyprior_lib.exhaustiveBest,
 * the anneal.js objective), and compute the same permutation-null p-value as tools/keyprior_fullpin.js.
 *   --key other : the OTHER cipher's key (Z408 key on Z340 windows, Z340 key on Z408 windows).  No key
 *                 reuse is true here, so a calibrated test gives uniform p-values over windows.
 *   --key own   : the cipher's own key (positive control: reuse is true, p should be tiny).
 * Windows are chosen at random among those with exactly --free uncovered distinct symbols
 * (default: 2, as Z13 under either key) and at least --min-pinned covered distinct symbols.
 *
 *   node tools/keyprior_calibrate.js --cipher z340 --key other --len 13 --free 2 --windows 60 --null 1000
 *        --null-kind permute --threads 4 --seed 77 --out results/keyprior/calib_z340w13_z408key.json
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const K = require('./keyprior_lib');
const C = require('./cipher');

if (!isMainThread) {
  const scorers = new Map();
  const J = workerData.J;
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    const out = [];
    for (const t of m.tasks) {
      let sc = scorers.get(t.text);
      if (!sc) { sc = K.makeScorer(t.text, { J }); scorers.set(t.text, sc); if (scorers.size > 200) scorers.clear(); }
      const r = K.exhaustiveBest(sc, Int8Array.from(t.fixed), 1);
      out.push({ id: t.id, score: r.top[0].score, plaintext: r.top[0].plaintext });
    }
    parentPort.postMessage({ type: 'done', out });
  });
  parentPort.postMessage({ type: 'ready' });
  return;
}

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const cname = o.cipher || 'z340';
  const keyMode = o.key || 'other';
  const len = +(o.len || 13);
  const nFreeWanted = +(o.free || 2);
  const minPinned = +(o['min-pinned'] || 4);
  const W = +(o.windows || 60);
  const N = +(o.null || 1000);
  const kind = o['null-kind'] || 'permute';
  const threads = +(o.threads || 4);
  const seed = +(o.seed || 77);
  const t0 = Date.now();
  const ci = C.loadCipher(`data/ciphers/${cname}.json`);
  const text = ci.readOrder ? C.applyReadOrder(ci.text, ci.readOrder) : ci.text;
  const keyName = keyMode === 'own' ? cname : (cname === 'z340' ? 'z408' : 'z340');
  const km = K.key(keyName);
  const lm = require('./lm');
  const J = lm.table(5);
  const Js = new Float32Array(new SharedArrayBuffer(J.byteLength));
  Js.set(J);
  // eligible windows
  const elig = [];
  for (let s = 0; s + len <= text.length; s++) {
    const w = text.slice(s, s + len);
    const syms = [...new Set(w)];
    const free = syms.filter((x) => !km.has(x)).length;
    if (free === nFreeWanted && syms.length - free >= minPinned) elig.push(s);
  }
  const rng = K.makeRng(seed, 11);
  K.shuffle(elig, rng);
  const starts = elig.slice(0, W).sort((a, b) => a - b);
  // the null keys are the same for every window
  const rngN = K.makeRng(seed, 12);
  const nullKeys = [];
  for (let j = 0; j < N; j++) nullKeys.push(K.nullKey(kind, km, rngN));
  const tasks = [];
  const unpin = +(o.unpin || 0);
  const rngU = K.makeRng(seed, 13);
  const unpinned = {};
  for (const s of starts) {
    const w = text.slice(s, s + len);
    const sc = K.makeScorer(w, { J });
    // --unpin k: leave k random covered symbols of the window free (for the own-key positive control)
    const cov = sc.symbols.filter((x) => km.has(x));
    const drop = new Set(K.shuffle(cov.slice(), rngU).slice(0, unpin));
    unpinned[s] = [...drop].join('');
    const filt = (m) => new Map([...m].filter(([x]) => !drop.has(x)));
    tasks.push({ id: `${s}:-1`, text: w, fixed: Array.from(sc.fixedFrom(filt(km))) });
    for (let j = 0; j < N; j++) tasks.push({ id: `${s}:${j}`, text: w, fixed: Array.from(sc.fixedFrom(filt(nullKeys[j]))) });
  }
  process.stderr.write(`keyprior_calibrate: ${cname} windows len ${len} (${elig.length} eligible, using ${starts.length}), key ${keyName}, ${tasks.length} searches\n`);
  const workers = [];
  for (let i = 0; i < threads; i++) workers.push(new Worker(__filename, { workerData: { J: Js } }));
  const res = new Map();
  let next = 0;
  const chunk = 32;
  let lastP = 0;
  await new Promise((resolve, reject) => {
    let active = 0;
    const send = (w) => { if (next >= tasks.length) return false; const part = tasks.slice(next, next + chunk); next += part.length; active++; w.postMessage({ type: 'tasks', tasks: part }); return true; };
    workers.forEach((w) => {
      w.on('error', reject);
      w.on('message', (m) => {
        if (m.type === 'ready') { send(w); return; }
        active--;
        for (const r of m.out) res.set(r.id, r);
        const now = Date.now();
        if (now - lastP > 10000) { lastP = now; process.stderr.write(`\r${res.size}/${tasks.length} ${((now - t0) / 1000).toFixed(0)} s`); }
        if (!send(w) && active === 0) resolve();
      });
    });
  });
  workers.forEach((w) => w.postMessage({ type: 'exit' }));
  process.stderr.write('\n');
  const rows = starts.map((s) => {
    const real = res.get(`${s}:-1`);
    const nul = [];
    for (let j = 0; j < N; j++) nul.push(res.get(`${s}:${j}`).score);
    const pv = K.upperP(real.score, nul);
    return { start: s, cipherWindow: text.slice(s, s + len), unpinned: unpinned[s], best: real.plaintext, score: real.score, p: pv.p, ge: pv.ge };
  });
  const ps = rows.map((r) => r.p).sort((a, b) => a - b);
  // KS distance to Uniform(0,1)
  let D = 0;
  ps.forEach((p, i) => { D = Math.max(D, (i + 1) / ps.length - p, p - i / ps.length); });
  const frac = (t) => ps.filter((p) => p <= t).length / ps.length;
  const out = {
    tool: 'tools/keyprior_calibrate.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '),
    cipher: cname, order: ci.readOrder ? 'reading' : 'written', key: keyName, keyMode, windowLength: len, freeSymbols: nFreeWanted, unpin,
    eligibleWindows: elig.length, windows: rows.length, null: { kind, n: N, seed },
    pSummary: { fracLE01: frac(0.01), fracLE05: frac(0.05), fracLE10: frac(0.10), fracLE50: frac(0.5), median: ps[ps.length >> 1], ksD: D, ksCritical05: 1.36 / Math.sqrt(ps.length) },
    seconds: (Date.now() - t0) / 1000,
    rows,
  };
  if (o.out) K.writeJSON(o.out, out);
  console.log(`${cname} len ${len} free ${nFreeWanted} key ${keyName} (${keyMode}): ${rows.length} windows; P(p<=.01)=${frac(0.01).toFixed(3)} P(p<=.05)=${frac(0.05).toFixed(3)} P(p<=.10)=${frac(0.1).toFixed(3)} median p=${ps[ps.length >> 1].toFixed(3)} KS D=${D.toFixed(3)} (crit ${(1.36 / Math.sqrt(ps.length)).toFixed(3)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
