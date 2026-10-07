'use strict';
/**
 * results/keyprior/review/review_family.js - adversarial review of the keyprior Z13 full-pin test.
 *
 * Recomputes, with ONE shared set of null keys per known key (same generator as
 * tools/keyprior_fullpin.js: seed 1970, stream 1000 + key index in [z408, z340]), the best
 * exhaustive completion score of Z13 for the real key and N permuted keys, for
 *   4 variants (canonical, bracket_is_perp, crosshair_null, reversed) x 2 statistics (objective, word).
 * Then:
 *   (1) per-test p (checks the attacker's numbers; objective ones should match exactly);
 *   (2) a proper family-wise (Westfall-Young min-p) p over the 8 tests of each key, using symmetric
 *       pooled ranks (the real key is one member of the pool of N + 1 keys);
 *   (3) a glyph-stratified null: key letters permuted only within glyph classes (normal upper-case
 *       letter glyphs vs everything else), which controls for any tendency of Zodiac to give letter
 *       glyphs particular plaintext letters (A E N K M are letter glyphs, z is not).
 *
 *   node results/keyprior/review/review_family.js --null 10000 --threads 4 --out results/keyprior/review/family.json
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const K = require(path.join(__dirname, '..', '..', '..', 'tools', 'keyprior_lib'));

if (!isMainThread) {
  const J = workerData.J;
  const scorers = new Map();
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    const out = [];
    for (const t of m.tasks) {
      const ck = t.text + '|' + t.stat;
      let sc = scorers.get(ck);
      if (!sc) { sc = K.makeScorer(t.text, Object.assign({ J }, K.statOpts(t.stat))); scorers.set(ck, sc); }
      const r = K.exhaustiveBest(sc, Int8Array.from(t.fixed), 1);
      out.push({ id: t.id, score: r.top[0].score, pt: r.top[0].plaintext });
    }
    parentPort.postMessage({ type: 'done', out });
  });
  parentPort.postMessage({ type: 'ready' });
  return;
}

function stratifiedKey(m, rng) {
  // permute letters within classes: normal upper-case letter glyphs [A-Z] vs all other symbols
  const up = [...m.keys()].filter((s) => /^[A-Z]$/.test(s));
  const ot = [...m.keys()].filter((s) => !/^[A-Z]$/.test(s));
  const out = new Map();
  for (const cls of [up, ot]) {
    const lets = K.shuffle(cls.map((s) => m.get(s)), rng);
    cls.forEach((s, i) => out.set(s, lets[i]));
  }
  return out;
}

async function pool(tasks, threads, J) {
  const Js = new Float32Array(new SharedArrayBuffer(J.byteLength));
  Js.set(J);
  const workers = [];
  for (let i = 0; i < threads; i++) workers.push(new Worker(__filename, { workerData: { J: Js } }));
  const res = new Map();
  let next = 0;
  const chunk = 64;
  await new Promise((resolve, reject) => {
    let active = 0;
    const send = (w) => { if (next >= tasks.length) return false; const part = tasks.slice(next, next + chunk); next += part.length; active++; w.postMessage({ type: 'tasks', tasks: part }); return true; };
    workers.forEach((w) => {
      w.on('error', reject);
      w.on('message', (m) => {
        if (m.type === 'ready') { send(w); return; }
        active--;
        for (const r of m.out) res.set(r.id, r);
        if (!send(w) && active === 0) resolve();
      });
    });
  });
  workers.forEach((w) => w.postMessage({ type: 'exit' }));
  return res;
}

/** symmetric pooled-rank p for every member of [real, ...nulls] (higher = more extreme). */
function pooledP(vals) {
  const sorted = Float64Array.from(vals).sort();
  const n = sorted.length;
  return vals.map((v) => {
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] >= v - 1e-9) hi = mid; else lo = mid + 1; }
    return (n - lo) / n;
  });
}

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const N = +(o.null || 10000);
  const threads = +(o.threads || 4);
  const seed = +(o.seed || 1970);
  const t0 = Date.now();
  const lm = require(path.join(__dirname, '..', '..', '..', 'tools', 'lm'));
  const J = lm.table(5);
  const ciphers = ['z13.canonical', 'z13.bracket_is_perp', 'z13.crosshair_null', 'z13.reversed'];
  const stats = ['objective', 'word'];
  const keyNames = ['z408', 'z340'];
  const nullSets = {};
  keyNames.forEach((kn, ki) => {
    const km = K.key(kn);
    const rng = K.makeRng(seed, 1000 + ki);          // identical to keyprior_fullpin.js with --keys z408,z340,...
    const rngS = K.makeRng(seed + 1, 5000 + ki);
    nullSets[kn] = { permute: [], strat: [] };
    for (let j = 0; j < N; j++) nullSets[kn].permute.push(K.permuteKey(km, rng));
    for (let j = 0; j < N; j++) nullSets[kn].strat.push(stratifiedKey(km, rngS));
  });
  const tasks = [];
  for (const cid of ciphers) {
    const text = K.cipherText(cid);
    const sc = K.makeScorer(text, { J });
    for (const st of stats) {
      for (const kn of keyNames) {
        tasks.push({ id: `${cid}|${st}|${kn}|real`, text, stat: st, fixed: Array.from(sc.fixedFrom(K.key(kn))) });
        for (let j = 0; j < N; j++) tasks.push({ id: `${cid}|${st}|${kn}|permute|${j}`, text, stat: st, fixed: Array.from(sc.fixedFrom(nullSets[kn].permute[j])) });
        if (cid === 'z13.canonical') for (let j = 0; j < N; j++) tasks.push({ id: `${cid}|${st}|${kn}|strat|${j}`, text, stat: st, fixed: Array.from(sc.fixedFrom(nullSets[kn].strat[j])) });
      }
    }
  }
  process.stderr.write(`review_family: ${tasks.length} exhaustive searches on ${threads} threads\n`);
  const res = await pool(tasks, threads, J);
  const out = { tool: 'results/keyprior/review/review_family.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '), N, seed, perTest: [], familywise: {}, stratified: [] };
  for (const kn of keyNames) {
    const pvecs = [];
    for (const cid of ciphers) for (const st of stats) {
      const real = res.get(`${cid}|${st}|${kn}|real`);
      const nul = [];
      for (let j = 0; j < N; j++) nul.push(res.get(`${cid}|${st}|${kn}|permute|${j}`).score);
      const pv = K.upperP(real.score, nul);
      const s = K.summary(nul);
      out.perTest.push({ cipher: cid, stat: st, key: kn, real: real.score, realPt: real.pt, nullMean: s.mean, nullSd: s.sd, nullMax: s.max, p: pv.p, ge: pv.ge });
      pvecs.push(pooledP([real.score].concat(nul)));
      console.log(`${cid.padEnd(20)} ${st.padEnd(9)} ${kn} real ${real.score.toFixed(3)} ${real.pt} null mean ${s.mean.toFixed(2)} sd ${s.sd.toFixed(2)} p=${pv.p.toFixed(4)}`);
    }
    // Westfall-Young min-p over the 8 tests, and over canonical-only (2 stats)
    const fam = (idxs) => {
      const minP = new Float64Array(N + 1).fill(1);
      for (const t of idxs) for (let i = 0; i <= N; i++) if (pvecs[t][i] < minP[i]) minP[i] = pvecs[t][i];
      let le = 0;
      for (let i = 1; i <= N; i++) if (minP[i] <= minP[0] + 1e-12) le++;
      return { realMinP: minP[0], familywiseP: (le + 1) / (N + 1), nullsAtLeastAsExtreme: le, nTests: idxs.length };
    };
    out.familywise[kn] = {
      all8: fam([0, 1, 2, 3, 4, 5, 6, 7]),
      objectiveOnly4: fam([0, 2, 4, 6]),
      wordOnly4: fam([1, 3, 5, 7]),
      canonicalBothStats: fam([0, 1]),
    };
    console.log(`${kn} family-wise: ` + Object.entries(out.familywise[kn]).map(([g, v]) => `${g} minP=${v.realMinP.toFixed(4)} fw=${v.familywiseP.toFixed(4)}`).join(' | '));
    for (const st of stats) {
      const real = res.get(`z13.canonical|${st}|${kn}|real`);
      const nul = [];
      for (let j = 0; j < N; j++) nul.push(res.get(`z13.canonical|${st}|${kn}|strat|${j}`).score);
      const pv = K.upperP(real.score, nul);
      const s = K.summary(nul);
      out.stratified.push({ cipher: 'z13.canonical', stat: st, key: kn, real: real.score, nullMean: s.mean, nullSd: s.sd, p: pv.p, ge: pv.ge });
      console.log(`stratified null (letter glyphs vs other) z13.canonical ${st} ${kn}: real ${real.score.toFixed(3)} null mean ${s.mean.toFixed(2)} sd ${s.sd.toFixed(2)} p=${pv.p.toFixed(4)}`);
    }
  }
  // both keys: Sidak over the two keys' family-wise p
  const fz = out.familywise.z408.all8.familywiseP, fy = out.familywise.z340.all8.familywiseP;
  out.bothKeysSidak = 1 - (1 - Math.min(fz, fy)) ** 2;
  console.log(`both keys (Sidak over min of the two family-wise p): ${out.bothKeysSidak.toFixed(4)}`);
  out.seconds = (Date.now() - t0) / 1000;
  if (o.out) K.writeJSON(o.out, out);
}

main().catch((e) => { console.error(e); process.exit(1); });
