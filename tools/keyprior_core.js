'use strict';
/**
 * tools/keyprior_core.js - verbatim copy of tools/solvercore.js (2026-10-07) with its internal
 * state functions (newState, propose, commit, revert, fullEval) exported, for tools/keyprior_joint.js.
 * Do not edit the copied part; change tools/solvercore.js and re-copy if the solver changes.
 */
/**
 * tools/solvercore.js - the homophonic / simple substitution annealer used by
 * tools/anneal.js (in the main thread or in worker_threads).
 *
 * A problem definition is a plain, structured-cloneable object built by
 * anneal.js (see makeProblemDef there).  runRestart() performs one simulated-
 * annealing restart followed by a greedy polish and returns the best key(s).
 *
 * Score (higher is better):
 *   sum_o w_o * S_o                       n-gram term, one per order o
 *     S_o = sum over windows of J_n(window)            (score 'joint', the classic fitness)
 *         = J_n(first window) + sum of log10 P(c|h)   (score 'markov', = log10 P(text))
 *   - iocW * L * max(0, IoC(pt) - iocTarget)           repetitiveness penalty
 *   - entW * L * max(0, entTarget - H(pt))             low-entropy penalty (H in bits)
 *   + wordW * wordSegment(pt).logp                     word term (inner loop only for short texts)
 */
const P26 = [1, 26, 676, 17576, 456976, 11881376, 308915776];

/* ---------------------------------------------------------------- PRNG */

function splitmix32(a) {
  return function () {
    a |= 0; a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15; t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

/** sfc32 generator seeded from (seed, stream); returns {next() -> [0,1), int(n)}. */
function makeRng(seed, stream = 0) {
  const sm = splitmix32((seed >>> 0) ^ Math.imul(stream + 1, 0x85ebca6b));
  let a = sm(), b = sm(), c = sm(), d = sm() | 1;
  const next32 = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next32();
  return {
    next: () => next32() / 4294967296,
    int: (n) => Math.floor((next32() / 4294967296) * n),
    u32: next32,
  };
}

/* ----------------------------------------------------- problem preparation */

/**
 * Prepare a definition for fast evaluation.  `T` is lmshare.attach() output.
 * `wordSeg` (optional) is a function(str) -> logp used for the word term.
 */
function prepare(def, T, wordSeg) {
  const L = def.L, S = def.S;
  const c = Uint16Array.from(def.c);
  const occ = new Int32Array(S);
  const posList = [];
  for (let s = 0; s < S; s++) posList.push([]);
  for (let i = 0; i < L; i++) { occ[c[i]]++; posList[c[i]].push(i); }
  const pos = posList.map((a) => Int32Array.from(a));
  const markov = def.score === 'markov';
  const orders = def.orders.filter((o) => o.n <= L).map((o) => {
    const n = o.n;
    const nWin = L - n + 1;
    const rec = { n, w: o.w, nWin, J: null, C: null, j6: null, J5: null, markov };
    if (n <= 5) {
      rec.J = T.J[n];
      if (markov) rec.C = n === 1 ? T.J[1] : T.C[n];
      if (!rec.J || (markov && !rec.C)) throw new Error(`table for n=${n} not shared`);
    } else {
      rec.j6 = T.j6;
      rec.J5 = T.J[5];
      if (!rec.j6) throw new Error('6-gram table not shared');
    }
    // windows touched by each symbol
    rec.win = [];
    const mark = new Int32Array(nWin).fill(-1);
    for (let s = 0; s < S; s++) {
      const ws = [];
      for (const p of pos[s]) {
        const a = Math.max(0, p - n + 1), b = Math.min(nWin - 1, p);
        for (let w = a; w <= b; w++) if (mark[w] !== s) { mark[w] = s; ws.push(w); }
      }
      ws.sort((x, y) => x - y);
      rec.win.push(Int32Array.from(ws));
    }
    rec.mark = new Int32Array(nWin);
    return rec;
  });
  if (orders.length === 0) {
    // text shorter than every order: fall back to order L
    const n = Math.min(L, 5);
    return prepare(Object.assign({}, def, { orders: [{ n, w: 1 }] }), T, wordSeg);
  }
  const allowed = [];
  for (let l = 0; l < 26; l++) if (!(def.forbidMask & (1 << l))) allowed.push(l);
  const nlogn = new Float64Array(L + 1);
  for (let k = 1; k <= L; k++) nlogn[k] = k * Math.log2(k);
  let maxBuf = 0;
  for (const o of orders) maxBuf += o.nWin;
  return {
    def, L, S, c, occ, pos, orders, markov,
    mode: def.mode || 'homophonic',
    allowed: Int32Array.from(allowed),
    maxPerLetter: def.maxPerLetter || 0,
    iocW: def.iocW || 0, iocTarget: def.iocTarget || 0,
    entW: def.entW || 0, entTarget: def.entTarget || 0,
    wordW: def.wordW || 0, wordInner: !!def.wordInner && !!wordSeg, wordSeg,
    wordCodes: def.wordModel !== 'exact', wordCache: new Map(),
    nlogn, log2L: Math.log2(L),
    bufO: new Int32Array(maxBuf * 2 + 8), bufW: new Int32Array(maxBuf * 2 + 8), bufV: new Float64Array(maxBuf * 2 + 8),
    stamp: 1,
  };
}

/* ------------------------------------------------------------------ state */

function windowValue(o, w, pt) {
  const n = o.n;
  let idx = 0;
  for (let j = 0; j < n; j++) idx = idx * 26 + pt[w + j];
  if (n <= 5) return (o.markov && w > 0) ? o.C[idx] : o.J[idx];
  const v = o.j6(idx);
  return (o.markov && w > 0) ? v - o.J5[(idx / 26) | 0] : v;
}

function newState(P, key) {
  const st = {
    key: Int8Array.from(key),
    pt: new Uint8Array(P.L),
    winVal: P.orders.map((o) => new Float64Array(o.nWin)),
    sums: new Float64Array(P.orders.length),
    cnt: new Int32Array(26),
    spl: new Int32Array(26),     // symbols per letter
    owner: new Int16Array(26).fill(-1),
    ngram: 0, pen: 0, word: 0, score: 0,
  };
  fullEval(P, st);
  return st;
}

function penalty(P, cnt) {
  let pen = 0;
  if (P.iocW) {
    let s = 0;
    for (let l = 0; l < 26; l++) s += cnt[l] * (cnt[l] - 1);
    const ioc = P.L > 1 ? s / (P.L * (P.L - 1)) : 0;
    if (ioc > P.iocTarget) pen -= P.iocW * P.L * (ioc - P.iocTarget);
  }
  if (P.entW) {
    let s = 0;
    for (let l = 0; l < 26; l++) s += P.nlogn[cnt[l]];
    const H = P.log2L - s / P.L;
    if (H < P.entTarget) pen -= P.entW * P.L * (P.entTarget - H);
  }
  return pen;
}

function ptString(pt) {
  let s = '';
  for (let i = 0; i < pt.length; i++) s += String.fromCharCode(65 + pt[i]);
  return s;
}

function wordTerm(P, pt) {
  if (P.wordCodes) return P.wordSeg(pt);
  const s = ptString(pt);
  let v = P.wordCache.get(s);
  if (v === undefined) {
    v = P.wordSeg(s);
    if (P.wordCache.size > 200000) P.wordCache.clear();
    P.wordCache.set(s, v);
  }
  return v;
}

function fullEval(P, st) {
  const { key, pt, cnt, spl, owner } = st;
  cnt.fill(0); spl.fill(0); owner.fill(-1);
  for (let i = 0; i < P.L; i++) { pt[i] = key[P.c[i]]; cnt[pt[i]]++; }
  for (let s = 0; s < P.S; s++) { spl[key[s]]++; owner[key[s]] = s; }
  let ng = 0;
  for (let oi = 0; oi < P.orders.length; oi++) {
    const o = P.orders[oi];
    let sum = 0;
    for (let w = 0; w < o.nWin; w++) { const v = windowValue(o, w, pt); st.winVal[oi][w] = v; sum += v; }
    st.sums[oi] = sum;
    ng += o.w * sum;
  }
  st.ngram = ng;
  st.pen = penalty(P, cnt);
  st.word = P.wordInner ? P.wordW * wordTerm(P, pt) : 0;
  st.score = st.ngram + st.pen + st.word;
  return st.score;
}

/**
 * Evaluate changing symbol s1 to letter l1 (and s2 to l2 when s2 >= 0).
 * Leaves pt modified and the window buffer filled; returns the new score.
 * Call commit() or revert() afterwards.
 */
function propose(P, st, s1, l1, s2, l2) {
  const pt = st.pt;
  if (P.stamp > 2000000000) { for (const o of P.orders) o.mark.fill(0); P.stamp = 0; }  // Int32 marks: avoid overflow
  const stamp = ++P.stamp;
  let nb = 0;
  let dN = 0;
  // gather windows (old values) per order
  for (let oi = 0; oi < P.orders.length; oi++) {
    const o = P.orders[oi];
    const mark = o.mark;
    const wv = st.winVal[oi];
    let ws = o.win[s1];
    for (let k = 0; k < ws.length; k++) {
      const w = ws[k];
      if (mark[w] !== stamp) { mark[w] = stamp; P.bufO[nb] = oi; P.bufW[nb] = w; nb++; dN -= o.w * wv[w]; }
    }
    if (s2 >= 0) {
      ws = o.win[s2];
      for (let k = 0; k < ws.length; k++) {
        const w = ws[k];
        if (mark[w] !== stamp) { mark[w] = stamp; P.bufO[nb] = oi; P.bufW[nb] = w; nb++; dN -= o.w * wv[w]; }
      }
    }
  }
  // apply
  let ps = P.pos[s1];
  for (let k = 0; k < ps.length; k++) pt[ps[k]] = l1;
  const cnt = st.cnt;
  const old1 = st.key[s1];
  cnt[old1] -= P.occ[s1]; cnt[l1] += P.occ[s1];
  let old2 = -1;
  if (s2 >= 0) {
    ps = P.pos[s2];
    for (let k = 0; k < ps.length; k++) pt[ps[k]] = l2;
    old2 = st.key[s2];
    cnt[old2] -= P.occ[s2]; cnt[l2] += P.occ[s2];
  }
  for (let k = 0; k < nb; k++) {
    const o = P.orders[P.bufO[k]];
    const v = windowValue(o, P.bufW[k], pt);
    P.bufV[k] = v;
    dN += o.w * v;
  }
  P.nb = nb;
  P.dN = dN;
  P.newPen = (P.iocW || P.entW) ? penalty(P, cnt) : 0;
  P.newWord = P.wordInner ? P.wordW * wordTerm(P, pt) : 0;
  P.ps1 = s1; P.pl1 = l1; P.po1 = old1; P.ps2 = s2; P.pl2 = l2; P.po2 = old2;
  return st.ngram + dN + P.newPen + P.newWord;
}

function commit(P, st) {
  for (let k = 0; k < P.nb; k++) {
    const oi = P.bufO[k];
    const v = P.bufV[k];
    const w = P.bufW[k];
    st.sums[oi] += v - st.winVal[oi][w];
    st.winVal[oi][w] = v;
  }
  st.ngram += P.dN;
  st.pen = P.newPen;
  st.word = P.newWord;
  st.score = st.ngram + st.pen + st.word;
  const s1 = P.ps1, s2 = P.ps2;
  st.spl[P.po1]--; st.spl[P.pl1]++;
  st.key[s1] = P.pl1;
  if (s2 >= 0) { st.spl[P.po2]--; st.spl[P.pl2]++; st.key[s2] = P.pl2; }
  // owner (meaningful in simple mode where letters are unique)
  if (st.owner[P.po1] === s1) st.owner[P.po1] = -1;
  if (s2 >= 0 && st.owner[P.po2] === s2) st.owner[P.po2] = -1;
  st.owner[P.pl1] = s1;
  if (s2 >= 0) st.owner[P.pl2] = s2;
}

function revert(P, st) {
  const pt = st.pt;
  let ps = P.pos[P.ps1];
  for (let k = 0; k < ps.length; k++) pt[ps[k]] = P.po1;
  st.cnt[P.pl1] -= P.occ[P.ps1]; st.cnt[P.po1] += P.occ[P.ps1];
  if (P.ps2 >= 0) {
    ps = P.pos[P.ps2];
    for (let k = 0; k < ps.length; k++) pt[ps[k]] = P.po2;
    st.cnt[P.pl2] -= P.occ[P.ps2]; st.cnt[P.po2] += P.occ[P.ps2];
  }
}

/* --------------------------------------------------------------- restarts */

/** Random initial key respecting pins, forbidden letters and the mode. */
function initialKey(P, fixed, rng) {
  const key = new Int8Array(P.S);
  const A = P.allowed;
  if (P.mode === 'simple') {
    const used = new Uint8Array(26);
    for (let s = 0; s < P.S; s++) if (fixed[s] >= 0) { key[s] = fixed[s]; used[fixed[s]] = 1; }
    const free = [];
    for (let k = 0; k < A.length; k++) if (!used[A[k]]) free.push(A[k]);
    for (let i = free.length - 1; i > 0; i--) { const j = rng.int(i + 1); const t = free[i]; free[i] = free[j]; free[j] = t; }
    let f = 0;
    for (let s = 0; s < P.S; s++) if (fixed[s] < 0) {
      if (f >= free.length) throw new Error('simple mode: more free symbols than available letters');
      key[s] = free[f++];
    }
  } else {
    const cap = P.maxPerLetter || 1e9;
    const spl = new Int32Array(26);
    for (let s = 0; s < P.S; s++) if (fixed[s] >= 0) { key[s] = fixed[s]; spl[fixed[s]]++; }
    for (let s = 0; s < P.S; s++) if (fixed[s] < 0) {
      let l, tries = 0;
      do { l = A[rng.int(A.length)]; tries++; } while (spl[l] >= cap && tries < 1000);
      key[s] = l; spl[l]++;
    }
  }
  return key;
}

/**
 * Propose a random move.  Returns false if the drawn move is not allowed.
 * Sets P.mv = [s1, l1, s2, l2].
 */
function drawMove(P, st, free, rng) {
  const s1 = free[rng.int(free.length)];
  const A = P.allowed;
  let l1 = A[rng.int(A.length)];
  if (l1 === st.key[s1]) {
    if (A.length < 2) return false;
    l1 = A[rng.int(A.length)];
    if (l1 === st.key[s1]) return false;
  }
  return moveFor(P, st, s1, l1);
}

function moveFor(P, st, s1, l1, fixedArr) {
  const mv = P.mv;
  if (P.mode === 'simple') {
    const t = st.owner[l1];
    if (t >= 0) {
      if (P.fixedNow[t] >= 0) return false;
      mv[0] = s1; mv[1] = l1; mv[2] = t; mv[3] = st.key[s1];
      return true;
    }
  } else if (P.maxPerLetter && st.spl[l1] >= P.maxPerLetter) return false;
  mv[0] = s1; mv[1] = l1; mv[2] = -1; mv[3] = 0;
  return true;
}

function keyString(key) {
  let s = '';
  for (let i = 0; i < key.length; i++) s += String.fromCharCode(65 + key[i]);
  return s;
}

/** Greedy first-improvement polish until no single change (or swap) helps. */
function polish(P, st, free, maxPasses = 50) {
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let fi = 0; fi < free.length; fi++) {
      const s = free[fi];
      for (let k = 0; k < P.allowed.length; k++) {
        const l = P.allowed[k];
        if (l === st.key[s]) continue;
        if (!moveFor(P, st, s, l)) continue;
        const ns = propose(P, st, P.mv[0], P.mv[1], P.mv[2], P.mv[3]);
        if (ns > st.score + 1e-9) { commit(P, st); improved = true; } else revert(P, st);
      }
    }
    if (!improved) break;
  }
}

/**
 * One restart.  opts: {restart, seed, iters, T0, perRestart, polish}
 * pinSet: array of [symbolId, letter] fixed for this restart (in addition to def.fixed).
 * Returns {restart, pinSetIndex, results: [{key: string of letters (one per symbol), score, ngram, sums, pen, word}]}
 */
function runRestart(P, r) {
  const tStart = Date.now();
  const def = P.def;
  const rng = makeRng(def.seed >>> 0, r);
  const fixed = Int8Array.from(def.fixed);
  let pinSetIndex = -1;
  if (def.pinSets && def.pinSets.length) {
    pinSetIndex = r % def.pinSets.length;
    for (const [s, l] of def.pinSets[pinSetIndex]) fixed[s] = l;
  }
  P.fixedNow = fixed;
  P.mv = new Int32Array(4);
  const free = [];
  for (let s = 0; s < P.S; s++) if (fixed[s] < 0) free.push(s);
  const st = newState(P, initialKey(P, fixed, rng));
  const K = Math.max(1, def.perRestart || 1);
  const top = []; // {score, key}
  const pushTop = (score, keyArr) => {
    if (top.length >= K && score <= top[top.length - 1].score) return;
    const ks = keyString(keyArr);
    for (const t of top) if (t.key === ks) return;
    top.push({ score, key: ks });
    top.sort((a, b) => b.score - a.score);
    if (top.length > K) top.pop();
  };
  let bestScore = st.score;
  let bestKey = Int8Array.from(st.key);
  if (free.length > 0) {
    const iters = def.iters;
    const T0 = def.T0;
    const T1 = def.T1 || 0;
    for (let it = 0; it < iters; it++) {
      const T = T0 + (T1 - T0) * (it / iters);
      if (!drawMove(P, st, free, rng)) continue;
      const ns = propose(P, st, P.mv[0], P.mv[1], P.mv[2], P.mv[3]);
      const d = ns - st.score;
      if (d >= 0 || (T > 0 && rng.next() < Math.exp(d / T))) {
        commit(P, st);
        if (st.score > bestScore) { bestScore = st.score; bestKey.set(st.key); }
        if (K > 1) pushTop(st.score, st.key);
      } else revert(P, st);
    }
  }
  // polish the best key (and, with perRestart > 1, every kept key)
  const finals = [];
  const doPolish = def.polish !== false;
  const finish = (keyArr) => {
    const s2 = newState(P, keyArr);
    if (doPolish && free.length) polish(P, s2, free);
    finals.push({ key: keyString(s2.key), score: s2.score, ngram: s2.ngram, sums: Array.from(s2.sums), pen: s2.pen, word: s2.word });
  };
  finish(bestKey);
  if (K > 1) for (const t of top) finish(Int8Array.from(t.key, (ch) => ch.charCodeAt(0) - 65));
  // dedupe
  const seen = new Set();
  const results = [];
  finals.sort((a, b) => b.score - a.score);
  for (const f of finals) if (!seen.has(f.key)) { seen.add(f.key); results.push(f); }
  return { restart: r, pinSetIndex, ms: Date.now() - tStart, results: results.slice(0, K) };
}

/**
 * The word-term scorer for a definition: the fast unigram trie segmenter
 * (tools/wordfast.js, takes the plaintext codes) unless def.wordModel === 'exact'
 * (lm.wordSegment with the bigram model, takes a string; cached).
 */
function wordScorer(def) {
  if (!(def.wordW > 0)) return null;
  const vocab = def.vocab || 'common';
  if (def.wordModel === 'exact') {
    const lm = require('./lm');
    return (s) => lm.wordSegment(s, { vocab }).logp;
  }
  const WF = require('./wordfast');
  const F = WF.build(vocab);
  return (pt) => WF.logpCodes(F, pt, pt.length);
}

/** Score a given key (array/string of letter codes per symbol) without searching. */
function scoreKey(P, key) {
  const k = typeof key === 'string' ? Int8Array.from(key, (ch) => ch.charCodeAt(0) - 65) : Int8Array.from(key);
  P.fixedNow = new Int8Array(P.S).fill(-1);
  P.mv = new Int32Array(4);
  const st = newState(P, k);
  return { score: st.score, ngram: st.ngram, sums: Array.from(st.sums), pen: st.pen, word: st.word };
}

/** Polish an arbitrary key with the greedy hill-climber (e.g. with the word term switched on). */
function polishKey(P, key, fixedArr) {
  const k = typeof key === 'string' ? Int8Array.from(key, (ch) => ch.charCodeAt(0) - 65) : Int8Array.from(key);
  const fixed = fixedArr ? Int8Array.from(fixedArr) : Int8Array.from(P.def.fixed);
  P.fixedNow = fixed;
  P.mv = new Int32Array(4);
  const free = [];
  for (let s = 0; s < P.S; s++) if (fixed[s] < 0) free.push(s);
  const st = newState(P, k);
  polish(P, st, free);
  return { key: keyString(st.key), score: st.score, ngram: st.ngram, sums: Array.from(st.sums), pen: st.pen, word: st.word };
}

module.exports = { prepare, runRestart, scoreKey, polishKey, wordScorer, makeRng, keyString, ptString, P26,
  // keyprior: internals exported for the joint (two-cipher, one-key) annealer in tools/keyprior_joint.js
  newState, propose, commit, revert, fullEval };
