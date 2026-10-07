'use strict';
/**
 * tools/keyprior_joint.js - do Z13 and Z32 share one key?
 *
 * A joint annealer solves two ciphers under ONE homophonic key in which a list of symbol pairs
 * ("links", symA = symB) must decode to the same letter.  Objective = objA + objB, each the anneal.js
 * objective (5-gram joint + entropy 0.5 + 1.0 x fast word term).  Real links: the symbols the two
 * ciphers share by glyph identity (Z13/Z32: A E M z [).  Null: the same A-side symbols linked to
 * randomly chosen B symbols with the same occurrence counts as the real partners ("shuffle which
 * symbols count as shared").  With no links the problem separates (independent baseline).
 * Statistic: best joint objective; p = P(null >= real); penalty = independent - joint.
 *
 *   node tools/keyprior_joint.js --a z13.canonical --b z32.canonical --null 300 --restarts 6 --iters 150000
 *        --threads 4 --seed 1332 --out results/keyprior/joint_z13_z32.json
 *   node tools/keyprior_joint.js --synthetic 6 --null 40 ...   positive control: Zodiac-style pairs (13 + 32 letters,
 *        held-out text) encrypted with one 63-symbol cycling key; are the true links detected?
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const K = require('./keyprior_lib');
const A = require('./anneal');
const core = require('./keyprior_core');
const lmshare = require('./lmshare');

function defFor(text) {
  const o = Object.assign({}, A.DEFAULTS, { cipher: text, mode: 'homophonic', wordweight: 1, wordmodel: 'fast', n: '5', entropy: 0.5, quiet: true });
  const { def, view } = A.makeProblem(o);
  def.wordInner = true;
  return { def, view };
}

/** One joint restart.  PA, PB prepared problems; links: [[idA, idB]]. */
function jointRestart(PA, PB, links, iters, T0, seed, r) {
  const rng = core.makeRng(seed >>> 0, r);
  const SA = PA.S, SB = PB.S;
  // union symbols: A ids 0..SA-1, then unlinked B symbols
  const bToU = new Int32Array(SB).fill(-1);
  for (const [a, b] of links) bToU[b] = a;
  let U = SA;
  for (let b = 0; b < SB; b++) if (bToU[b] < 0) bToU[b] = U++;
  const uA = new Int32Array(U).fill(-1), uB = new Int32Array(U).fill(-1);
  for (let a = 0; a < SA; a++) uA[a] = a;
  for (let b = 0; b < SB; b++) uB[bToU[b]] = b;
  const key = new Int8Array(U);
  for (let u = 0; u < U; u++) key[u] = rng.int(26);
  const kA = new Int8Array(SA), kB = new Int8Array(SB);
  for (let a = 0; a < SA; a++) kA[a] = key[a];
  for (let b = 0; b < SB; b++) kB[b] = key[bToU[b]];
  PA.fixedNow = new Int8Array(SA).fill(-1); PA.mv = new Int32Array(4);
  PB.fixedNow = new Int8Array(SB).fill(-1); PB.mv = new Int32Array(4);
  const stA = core.newState(PA, kA), stB = core.newState(PB, kB);
  let cur = stA.score + stB.score;
  let best = cur;
  const bestKey = Int8Array.from(key);
  const tryMove = (u, l) => {
    const a = uA[u], b = uB[u];
    let ns = 0;
    if (a >= 0) ns += core.propose(PA, stA, a, l, -1, 0); else ns += stA.score;
    if (b >= 0) ns += core.propose(PB, stB, b, l, -1, 0); else ns += stB.score;
    return ns;
  };
  const accept = (u, l) => {
    if (uA[u] >= 0) core.commit(PA, stA);
    if (uB[u] >= 0) core.commit(PB, stB);
    key[u] = l;
  };
  const reject = (u) => {
    if (uA[u] >= 0) core.revert(PA, stA);
    if (uB[u] >= 0) core.revert(PB, stB);
  };
  for (let it = 0; it < iters; it++) {
    const T = T0 * (1 - it / iters);
    const u = rng.int(U);
    const l = rng.int(26);
    if (l === key[u]) continue;
    const ns = tryMove(u, l);
    const d = ns - cur;
    if (d >= 0 || (T > 0 && rng.next() < Math.exp(d / T))) {
      accept(u, l); cur = stA.score + stB.score;
      if (cur > best) { best = cur; bestKey.set(key); }
    } else reject(u);
  }
  // polish from the best key
  for (let a = 0; a < SA; a++) kA[a] = bestKey[a];
  for (let b = 0; b < SB; b++) kB[b] = bestKey[bToU[b]];
  const pA = core.newState(PA, kA), pB = core.newState(PB, kB);
  key.set(bestKey);
  cur = pA.score + pB.score;
  for (let pass = 0; pass < 50; pass++) {
    let improved = false;
    for (let u = 0; u < U; u++) for (let l = 0; l < 26; l++) {
      if (l === key[u]) continue;
      const a = uA[u], b = uB[u];
      let ns = 0;
      if (a >= 0) ns += core.propose(PA, pA, a, l, -1, 0); else ns += pA.score;
      if (b >= 0) ns += core.propose(PB, pB, b, l, -1, 0); else ns += pB.score;
      if (ns > cur + 1e-9) {
        if (a >= 0) core.commit(PA, pA);
        if (b >= 0) core.commit(PB, pB);
        key[u] = l; cur = pA.score + pB.score; improved = true;
      } else {
        if (a >= 0) core.revert(PA, pA);
        if (b >= 0) core.revert(PB, pB);
      }
    }
    if (!improved) break;
  }
  return { score: cur, scoreA: pA.score, scoreB: pB.score, ptA: core.ptString(pA.pt), ptB: core.ptString(pB.pt) };
}

if (!isMainThread) {
  const T = lmshare.attach(workerData.lm);
  const cache = new Map();
  const prep = (text) => {
    let P = cache.get(text);
    if (!P) { const { def } = defFor(text); P = core.prepare(def, T, core.wordScorer(def)); cache.set(text, P); }
    return P;
  };
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    const out = [];
    for (const t of m.tasks) {
      const PA = prep(t.a), PB = prep(t.b);
      let best = null;
      const scores = [];
      for (let r = 0; r < t.restarts; r++) {
        const x = jointRestart(PA, PB, t.links, t.iters, t.T0, t.seed, r);
        scores.push(x.score);
        if (!best || x.score > best.score) best = x;
      }
      out.push(Object.assign({ id: t.id, scores }, best));
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
  return new Promise((resolve, reject) => {
    let active = 0;
    const send = (w) => { if (next >= tasks.length) return false; const part = tasks.slice(next, next + 1); next += 1; active++; w.postMessage({ type: 'tasks', tasks: part }); return true; };
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

/** Real links (shared glyphs) and N null link maps matched on the partner's occurrence count. */
function linkSets(textA, textB, N, rng) {
  const tA = require('./cipher').symbolTable(textA), tB = require('./cipher').symbolTable(textB);
  const count = (text, s) => [...text].filter((c) => c === s).length;
  const shared = tA.symbols.filter((s) => tB.idOf.has(s));
  const real = shared.map((s) => [tA.idOf.get(s), tB.idOf.get(s)]);
  const nulls = [];
  for (let j = 0; j < N; j++) {
    const used = new Set();
    const L = [];
    for (const s of shared) {
      const c = count(textB, s);
      const cands = tB.symbols.filter((x) => !used.has(x) && count(textB, x) === c);
      const pick = cands.length ? cands[rng.int(cands.length)] : tB.symbols.filter((x) => !used.has(x))[0];
      used.add(pick);
      L.push([tA.idOf.get(s), tB.idOf.get(pick)]);
    }
    nulls.push(L);
  }
  return { shared, real, nulls, symbolsB: tB.symbols };
}

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const threads = +(o.threads || 4);
  const seed = +(o.seed || 1332);
  const restarts = +(o.restarts || 6);
  const iters = +(o.iters || 150000);
  const T0 = +(o.T0 || 8);
  const N = +(o.null || 300);
  const t0 = Date.now();
  const rng = K.makeRng(seed, 5);
  const problems = [];
  if (o.synthetic) {
    const TS = require('./textsample');
    const E = require('./encrypt');
    const s = TS.sampler(seed);
    for (let i = 0; i < +o.synthetic; i++) {
      const p13 = s.phrase(13), p32 = s.phrase(32);
      const pt = p13.letters + p32.letters;
      const key = E.makeKey({ symbols: 63, alloc: 'proportional', allLetters: true, rng });
      const enc = E.encrypt(pt, key, { select: 'cycle', rng });
      const a = enc.cipher.slice(0, 13), b = enc.cipher.slice(13);
      const ls = linkSets(a, b, N, rng);
      if (ls.shared.length < 2) { i--; continue; }
      problems.push({ name: `syn${i}`, a, b, truthA: p13.letters, truthB: p32.letters, ls });
    }
  } else {
    const a = K.cipherText(o.a || 'z13.canonical'), b = K.cipherText(o.b || 'z32.canonical');
    problems.push({ name: `${o.a || 'z13.canonical'}+${o.b || 'z32.canonical'}`, a, b, ls: linkSets(a, b, N, rng) });
  }
  const tasks = [];
  problems.forEach((p, pi) => {
    tasks.push({ id: `${pi}:indep`, a: p.a, b: p.b, links: [], restarts, iters, T0, seed: seed + pi * 1000003 });
    tasks.push({ id: `${pi}:real`, a: p.a, b: p.b, links: p.ls.real, restarts, iters, T0, seed: seed + pi * 1000003 + 1 });
    p.ls.nulls.forEach((L, j) => tasks.push({ id: `${pi}:null:${j}`, a: p.a, b: p.b, links: L, restarts, iters, T0, seed: seed + pi * 1000003 + 2 + j }));
  });
  process.stderr.write(`keyprior_joint: ${problems.length} problem(s), ${tasks.length} joint solves x ${restarts} restarts x ${iters} iters\n`);
  let lastP = 0;
  const res = await runPool(threads, tasks, (d, n) => { const now = Date.now(); if (now - lastP > 10000) { lastP = now; process.stderr.write(`\r${d}/${n} ${((now - t0) / 1000).toFixed(0)} s`); } });
  process.stderr.write('\n');
  const out = problems.map((p, pi) => {
    const ind = res.get(`${pi}:indep`), real = res.get(`${pi}:real`);
    const nullScores = p.ls.nulls.map((_, j) => res.get(`${pi}:null:${j}`).score);
    const pv = K.upperP(real.score, nullScores);
    const r = {
      name: p.name, a: p.a, b: p.b, sharedSymbols: p.ls.shared.join(''), nLinks: p.ls.real.length,
      independent: { score: ind.score, ptA: ind.ptA, ptB: ind.ptB, restartScores: ind.scores },
      joint: { score: real.score, scoreA: real.scoreA, scoreB: real.scoreB, ptA: real.ptA, ptB: real.ptB, wordsA: K.describe(real.ptA).words, wordsB: K.describe(real.ptB).words, restartScores: real.scores },
      penaltyReal: ind.score - real.score,
      null: { n: nullScores.length, summary: K.summary(nullScores), penaltySummary: K.summary(nullScores.map((x) => ind.score - x)) },
      test: pv,
    };
    if (p.truthA) {
      const scA = K.makeScorer(p.a), scB = K.makeScorer(p.b);
      const keyOf = (text, pt, sc) => { const k = new Int8Array(sc.S); for (let i = 0; i < text.length; i++) k[sc.ids[i]] = pt.charCodeAt(i) - 65; return k; };
      r.truth = { a: p.truthA, b: p.truthB, score: scA.score(keyOf(p.a, p.truthA, scA)) + scB.score(keyOf(p.b, p.truthB, scB)) };
      r.truthRecovered = real.ptA === p.truthA && real.ptB === p.truthB;
    }
    console.log(`${r.name}: shared ${r.sharedSymbols} | indep ${ind.score.toFixed(2)} joint(real) ${real.score.toFixed(2)} penalty ${r.penaltyReal.toFixed(2)} | null joint mean ${r.null.summary.mean.toFixed(2)} sd ${r.null.summary.sd.toFixed(2)} max ${r.null.summary.max.toFixed(2)} | p=${pv.p.toFixed(4)}${r.truth ? ` | truth ${r.truth.score.toFixed(2)} recovered ${r.truthRecovered}` : ''}`);
    console.log(`   joint best: ${real.ptA} [${r.joint.wordsA}] / ${real.ptB} [${r.joint.wordsB}]`);
    return r;
  });
  const result = {
    tool: 'tools/keyprior_joint.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '),
    solver: { restarts, iters, T0, objective: 'sum of the anneal.js objectives of both ciphers under one key (links tie symbols)' },
    null: { n: N, kind: 'A-side shared symbols linked to random B symbols with the same occurrence count as the real partner' },
    seconds: (Date.now() - t0) / 1000, problems: out,
  };
  if (o.synthetic) {
    const ps = out.map((r) => r.test.p);
    result.power = { n: out.length, pValues: ps, detectedAt05: ps.filter((p) => p <= 0.05).length, truthBeatsJoint: out.filter((r) => r.truth.score >= r.joint.score - 1e-9).length };
    console.log(`synthetic: detected at p<=0.05 in ${result.power.detectedAt05}/${out.length}; truth scores >= joint best in ${result.power.truthBeatsJoint}/${out.length}`);
  }
  if (o.out) K.writeJSON(o.out, result);
}

main().catch((e) => { console.error(e); process.exit(1); });
