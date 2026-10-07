'use strict';
/**
 * tools/cyclemodel_lib.js - a generative model of how the Zodiac chose
 * homophones, fitted on Z408 / Z340 (written order), and the likelihood of a
 * cipher's ISOMORPH (its pattern of repeated symbols) given a candidate
 * plaintext, marginalised over keys.
 *
 * Model (per letter X with k homophones, arranged in a latent cyclic order):
 *   first use of X in the message: any of the k symbols (uniform)
 *   later uses, previous symbol index j:
 *     base(j)   += b                 stay on the same symbol
 *     base(j+1) += a                 step forward in the cycle
 *     base(j-1) += c                 step back
 *     base(i)   += d/(k-1), i != j   jump to any other symbol
 *     (a + b + c + d = 1; for k = 2, j+1 = j-1)
 *   row reset: on the first use of X in a new written row, with prob. tau the
 *     index returns to the cycle start (the symbol X was first written with);
 *   repeat avoidance: every symbol of X already used earlier in the CURRENT
 *     written row has its weight multiplied by g (0 < g <= 1); then renormalise.
 *   k = 1: always the same symbol.
 * Key allocation: k_X = max(1, round(t_X + e)), t_X = S * f_X^alpha / sum_Y f_Y^alpha
 *   (f = English letter frequency, S = number of cipher symbols in the key,
 *   sum over the 26 letters), e ~ N(0, s^2) with prob 1-eta, and with prob eta
 *   k is uniform on 1..KMAX.  The simple-substitution key is the special case
 *   k_X = 1 for every letter (hypothesis 'simple').
 *
 * Likelihood of a cipher isomorph C given plaintext P (same length, written order):
 *   0 if two positions share a symbol but not a letter (weak consistency fails);
 *   otherwise prod over letters X of sum_k P(k | X, S) * P(pattern_X | k, theta),
 *   where pattern_X is the sequence of symbol classes (and row ids) at X's
 *   positions.  P(pattern | k, theta) sums over all injective labellings of the
 *   classes with homophone indices (exact; rotational symmetry fixes the first).
 *   A mixture over (S, theta) grid points with prior weights gives L(P).
 *
 *   const M = require('./cyclemodel_lib');
 *   const model = M.loadModel();                     // results/cyclemodel/fit.json
 *   const sc = M.makeScorer(model, {iso, rows, hyp}); // iso: class id per position
 *   sc.logL('MYNAMEISXXXXX')                         // log10 L(P) (-Infinity if inconsistent)
 */
const fs = require('fs');
const path = require('path');

const KMAX = 14;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LN10 = Math.log(10);

let _freq = null;
function englishFreq() {
  if (_freq) return _freq;
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'lm', 'meta.json'), 'utf8'));
  const f = meta.ngrams.letter_frequencies;
  _freq = LETTERS.split('').map((c) => f[c]);
  return _freq;
}

/* ------------------------------------------------------------ selection */

/** theta: {a, b, c, d, tau, g}.  Transition distribution over k indices from j. */
function transition(theta, k, j, usedMask, out) {
  if (k === 1) { out[0] = 1; return out; }
  for (let i = 0; i < k; i++) out[i] = 0;
  const { a, b, c, d } = theta;
  out[j] += b;
  out[(j + 1) % k] += a;
  out[(j - 1 + k) % k] += c;
  const dj = d / (k - 1);
  for (let i = 0; i < k; i++) if (i !== j) out[i] += dj;
  if (theta.g < 1 && usedMask) {
    let s = 0;
    for (let i = 0; i < k; i++) { if (usedMask & (1 << i)) out[i] *= theta.g; s += out[i]; }
    if (s > 0) for (let i = 0; i < k; i++) out[i] /= s;
    else for (let i = 0; i < k; i++) out[i] = 1 / k;
  }
  return out;
}

/**
 * Probability of one step: from prev index j to index i at a use that is
 * (newRow ? the first use of the letter in a new row : a use in the same row),
 * with `usedMask` the indices already used in the current row.
 */
function stepProb(theta, k, j, i, newRow, usedMask, buf) {
  if (k === 1) return 1;
  if (newRow) {
    // reset to index 0 with prob tau, else normal transition (no row-used symbols yet)
    transition(theta, k, j, 0, buf);
    return (1 - theta.tau) * buf[i] + (i === 0 ? theta.tau : 0);
  }
  transition(theta, k, j, usedMask, buf);
  return buf[i];
}

/**
 * P(observed index sequence | k, theta, cycle order) for KNOWN indices
 * (used in fitting).  idx[t]: homophone index (in a given cyclic order, with the
 * letter's first-used symbol = whatever index); rows[t]: row id.  The cycle start
 * for resets is idx[0].  Returns natural log.  Excludes the first-use 1/k.
 */
function seqLogProbKnown(theta, k, idx, rows, buf) {
  let lp = 0;
  let used = 1 << idx[0];
  const start = idx[0];
  for (let t = 1; t < idx.length; t++) {
    const newRow = rows[t] !== rows[t - 1];
    if (newRow) used = 0;
    // rotate so that start = 0 for the reset term
    const j = (idx[t - 1] - start + k) % k, i = (idx[t] - start + k) % k;
    const um = rotMask(used, start, k);
    const p = stepProb(theta, k, j, i, newRow, um, buf);
    lp += Math.log(Math.max(p, 1e-300));
    used |= 1 << idx[t];
  }
  return lp;
}

function rotMask(mask, start, k) {
  if (!start) return mask;
  let m = 0;
  for (let i = 0; i < k; i++) if (mask & (1 << i)) m |= 1 << ((i - start + k) % k);
  return m;
}

/**
 * P(pattern | k, theta): pattern = {cls: [class per use, 0-based by first appearance],
 * rows: [row id per use]}.  Sum over injective maps class -> index with class 0 -> 0.
 * Returns a probability (not log).
 */
/** Always exact (used for fitting on the long Z408/Z340 sequences, k <= 7). */
function patternProbExact(theta, k, cls, rows) {
  if (!(theta.tau > 1e-12)) return patternProbFast(theta, k, cls, rows);
  return patternProbDFS(theta, k, cls, rows);
}

function patternProb(theta, k, cls, rows) {
  if (!(theta.tau > 1e-12)) return cls.length > MEXACT ? approxPatternProb(theta, k, cls) : patternProbFast(theta, k, cls, rows);
  return patternProbDFS(theta, k, cls, rows);
}

/**
 * Exact P(pattern | k, theta) for tau = 0 by dynamic programming over states
 * relative to the current homophone index (rotation invariance): occupied indices
 * (every class assigned so far, including classes that never reappear, whose
 * identity is then forgotten), indices used in the current row (only when g < 1),
 * and the positions of the classes that still reappear later.  Same value as the
 * labelling DFS (tools/cyclemodel_test.js checks this), but polynomial in practice.
 */
function patternProbDP(theta, k, cls, rows) {
  const m = cls.length;
  let nc = 0;
  for (const x of cls) if (x + 1 > nc) nc = x + 1;
  if (nc > k) return 0;
  if (k === 1 || m === 1) return 1;
  const full = (1 << k) - 1;
  const rot = (mask, p) => (p === 0 ? mask : (((mask >>> p) | (mask << (k - p))) & full));
  const lastUse = new Int32Array(nc).fill(-1);
  const firstUse = new Int32Array(nc).fill(-1);
  for (let t = 0; t < m; t++) { lastUse[cls[t]] = t; if (firstUse[cls[t]] < 0) firstUse[cls[t]] = t; }
  const useG = theta.g < 1;
  const { a, b, c, d } = theta;
  const dj = d / (k - 1);
  // base weight by relative position
  const w = new Float64Array(k);
  for (let i = 0; i < k; i++) w[i] = i === 0 ? b : dj;
  w[1 % k] += a;
  w[(k - 1) % k] += c;
  // live class list after step t: classes with firstUse <= t < lastUse, in class order
  const liveAfter = [];
  for (let t = 0; t < m; t++) {
    const l = [];
    for (let x = 0; x < nc; x++) if (firstUse[x] <= t && lastUse[x] > t) l.push(x);
    liveAfter.push(l);
  }
  // state: {occ, used, pos: Int8Array over liveAfter[t]}
  let states = new Map();
  const key = (occ, used, pos) => {
    let s = occ * 16384 + used;
    if (!pos.length) return s;
    let str = String(s);
    for (const p of pos) str += ',' + p;
    return str;
  };
  {
    const pos = liveAfter[0].map(() => 0);
    states.set(key(1, useG ? 1 : 0, pos), { occ: 1, used: useG ? 1 : 0, pos, pr: 1 });
  }
  for (let t = 1; t < m; t++) {
    const next = new Map();
    const y = cls[t];
    const newRow = rows[t] !== rows[t - 1];
    const prevLive = liveAfter[t - 1], nowLive = liveAfter[t];
    const yIdxPrev = prevLive.indexOf(y);
    for (const st of states.values()) {
      const U = newRow ? 0 : st.used;
      let Z = 1;
      if (useG && U) {
        let pen = 0;
        for (let i = 0; i < k; i++) if (U & (1 << i)) pen += w[i];
        Z = 1 - (1 - theta.g) * pen;
      }
      const go = (p, pr) => {
        const occ2 = rot(st.occ | (1 << p), p);
        const used2 = useG ? rot(U | (1 << p), p) : 0;
        const pos2 = nowLive.map((x) => {
          if (x === y) return 0;
          const i = prevLive.indexOf(x);
          return (st.pos[i] - p + k) % k;
        });
        const kk = key(occ2, used2, pos2);
        const e = next.get(kk);
        if (e) e.pr += pr; else next.set(kk, { occ: occ2, used: used2, pos: pos2, pr });
      };
      if (yIdxPrev >= 0) {
        const p = st.pos[yIdxPrev];
        const wp = w[p] * (useG && (U & (1 << p)) ? theta.g : 1) / Z;
        if (wp > 0) go(p, st.pr * wp);
      } else {
        for (let p = 1; p < k; p++) {
          if (st.occ & (1 << p)) continue;
          const wp = w[p] / Z;
          if (wp > 0) go(p, st.pr * wp);
        }
      }
    }
    states = next;
  }
  let total = 0;
  for (const st of states.values()) total += st.pr;
  return total;
}

/**
 * Same DP as patternProbDP with numeric state keys and flat arrays (about an order of
 * magnitude faster).  Letters used more than MEXACT times get approxPatternProb (see
 * there); such plaintexts are never competitive under the language model, and
 * makeScorer counts how often it happens (stats.approx).
 */
const MEXACT = 8;
const P16 = [1, 16, 256, 4096, 65536, 1048576, 16777216];
function patternProbFast(theta, k, cls, rows) {
  const m = cls.length;
  let nc = 0;
  for (let t = 0; t < m; t++) if (cls[t] + 1 > nc) nc = cls[t] + 1;
  if (nc > k) return 0;
  if (k === 1 || m === 1) return 1;
  const full = (1 << k) - 1;
  const lastUse = new Int32Array(nc).fill(-1), firstUse = new Int32Array(nc).fill(-1);
  for (let t = 0; t < m; t++) { lastUse[cls[t]] = t; if (firstUse[cls[t]] < 0) firstUse[cls[t]] = t; }
  const live = [];
  let maxLive = 0;
  for (let t = 0; t < m; t++) {
    const l = [];
    for (let x = 0; x < nc; x++) if (firstUse[x] <= t && lastUse[x] > t) l.push(x);
    live.push(l);
    if (l.length > maxLive) maxLive = l.length;
  }
  if (maxLive > 6) return patternProbDP(theta, k, cls, rows);
  const useG = theta.g < 1;
  const dj = theta.d / (k - 1);
  const w = new Float64Array(k);
  for (let i = 0; i < k; i++) w[i] = i === 0 ? theta.b : dj;
  w[1 % k] += theta.a;
  w[(k - 1) % k] += theta.c;
  // current states
  let occA = [1], useA = [useG ? 1 : 0], posA = [0], prA = [1];
  const P = new Int32Array(8);
  for (let t = 1; t < m; t++) {
    const y = cls[t];
    const newRow = rows[t] !== rows[t - 1];
    const prevLive = live[t - 1], nowLive = live[t];
    const nl = nowLive.length;
    const src = new Int32Array(nl); // index into prevLive, or -1 for y (position 0)
    for (let j = 0; j < nl; j++) src[j] = nowLive[j] === y ? -1 : prevLive.indexOf(nowLive[j]);
    const yPrev = prevLive.indexOf(y);
    const map = new Map();
    const oA = [], uA = [], pA = [], rA = [];
    const nS = occA.length;
    for (let s = 0; s < nS; s++) {
      const occ = occA[s], pr = prA[s];
      const U = newRow ? 0 : useA[s];
      let code = posA[s];
      for (let j = 0; j < prevLive.length; j++) { P[j] = code % 16; code = (code - P[j]) / 16; }
      let Z = 1;
      if (useG && U) {
        let pen = 0;
        for (let i = 0; i < k; i++) if (U & (1 << i)) pen += w[i];
        Z = 1 - (1 - theta.g) * pen;
      }
      let pLo, pHi;
      if (yPrev >= 0) { pLo = P[yPrev]; pHi = pLo; } else { pLo = 1; pHi = k - 1; }
      for (let p = pLo; p <= pHi; p++) {
        if (yPrev < 0 && (occ & (1 << p))) continue;
        let wp = w[p] / Z;
        if (yPrev >= 0 && useG && (U & (1 << p))) wp *= theta.g;
        if (!(wp > 0)) continue;
        const o1 = occ | (1 << p);
        const occ2 = p === 0 ? o1 : (((o1 >>> p) | (o1 << (k - p))) & full);
        let used2 = 0;
        if (useG) { const u1 = U | (1 << p); used2 = p === 0 ? u1 : (((u1 >>> p) | (u1 << (k - p))) & full); }
        let code2 = 0;
        for (let j = 0; j < nl; j++) code2 += (src[j] < 0 ? 0 : (P[src[j]] - p + k) % k) * P16[j];
        const key = (occ2 * 16384 + used2) * 16777216 + code2;
        const e = map.get(key);
        if (e !== undefined) rA[e] += pr * wp;
        else { map.set(key, oA.length); oA.push(occ2); uA.push(used2); pA.push(code2); rA.push(pr * wp); }
      }
    }
    occA = oA; useA = uA; posA = pA; prA = rA;
  }
  let total = 0;
  for (let s = 0; s < prA.length; s++) total += prA[s];
  return total;
}

/**
 * Cheap approximation for letters with more than MEXACT uses: the cycle structure is
 * ignored (stay with prob b, otherwise a uniformly random other homophone), so
 * P = prod over steps of b (same class), (1-b)/(k-1) (earlier class),
 * (1-b)(k - assigned)/(k-1) (new class).
 */
function approxPatternProb(theta, k, cls) {
  let nc = 0;
  for (const x of cls) if (x + 1 > nc) nc = x + 1;
  if (nc > k) return 0;
  if (k === 1) return 1;
  let p = 1, assigned = 1;
  for (let t = 1; t < cls.length; t++) {
    if (cls[t] === cls[t - 1]) p *= theta.b;
    else if (cls[t] < assigned) p *= (1 - theta.b) / (k - 1);
    else { p *= (1 - theta.b) * (k - assigned) / (k - 1); assigned++; }
  }
  return p;
}

function patternProbDFS(theta, k, cls, rows) {
  const m = cls.length;
  let nc = 0;
  for (const x of cls) if (x + 1 > nc) nc = x + 1;
  if (nc > k) return 0;
  if (k === 1) return 1;
  const f = new Int32Array(nc).fill(-1);
  f[0] = 0;
  let takenMask = 1;
  const buf = new Float64Array(k);
  let total = 0;
  // DFS over uses
  function rec(t, prob, used) {
    if (prob === 0) return;
    if (t === m) { total += prob; return; }
    const newRow = rows[t] !== rows[t - 1];
    const u = newRow ? 0 : used;
    const j = f[cls[t - 1]];
    const c = cls[t];
    if (newRow) transition(theta, k, j, 0, buf); else transition(theta, k, j, u, buf);
    if (f[c] >= 0) {
      const i = f[c];
      const p = newRow ? (1 - theta.tau) * buf[i] + (i === 0 ? theta.tau : 0) : buf[i];
      rec(t + 1, prob * p, u | (1 << i));
      return;
    }
    // new class: any free index
    const probs = [];
    for (let i = 0; i < k; i++) {
      if (takenMask & (1 << i)) continue;
      const p = newRow ? (1 - theta.tau) * buf[i] + (i === 0 ? theta.tau : 0) : buf[i];
      probs.push([i, p]);
    }
    for (const [i, p] of probs) {
      if (p === 0) continue;
      f[c] = i; takenMask |= 1 << i;
      rec(t + 1, prob * p, u | (1 << i));
      f[c] = -1; takenMask &= ~(1 << i);
    }
  }
  if (m === 1) return 1;
  rec(1, 1, 1);
  return total;
}

/* ----------------------------------------------------------- allocation */

function normCdf(x) {
  // Abramowitz-Stegun 7.1.26 via erf
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** targets t_X for key size S over the letters in `letterSet` (array of codes; default all 26) */
function targets(alloc, S, letterSet) {
  const f = englishFreq();
  const set = letterSet || [...Array(26).keys()];
  let z = 0;
  for (const l of set) z += Math.pow(f[l], alloc.alpha);
  const t = new Float64Array(26);
  for (const l of set) t[l] = S * Math.pow(f[l], alloc.alpha) / z;
  return t;
}

/** P(k | target t) for k = 1..KMAX (index k). */
function kDist(alloc, t) {
  const p = new Float64Array(KMAX + 1);
  const s = alloc.s;
  let tot = 0;
  for (let k = 1; k <= KMAX; k++) {
    const hi = k === KMAX ? Infinity : (k + 0.5 - t) / s;
    const lo = k === 1 ? -Infinity : (k - 0.5 - t) / s;
    const g = (hi === Infinity ? 1 : normCdf(hi)) - (lo === -Infinity ? 0 : normCdf(lo));
    p[k] = (1 - alloc.eta) * g + alloc.eta / KMAX;
    tot += p[k];
  }
  for (let k = 1; k <= KMAX; k++) p[k] /= tot;
  return p;
}

/* ------------------------------------------------------------- isomorph */

/** class id per position (0-based by first appearance) of a symbol string */
function isoOf(text) {
  const m = new Map();
  const out = new Int32Array(text.length);
  for (let i = 0; i < text.length; i++) {
    if (!m.has(text[i])) m.set(text[i], m.size);
    out[i] = m.get(text[i]);
  }
  return out;
}

function rowsFor(lengths) {
  const r = [];
  lengths.forEach((n, k) => { for (let i = 0; i < n; i++) r.push(k); });
  return r;
}

/**
 * Build the grid of (S, theta) components with prior weights for a hypothesis.
 * hyp: {kind: 'homophonic', S: [..] or number, regimes: [names], weights?} | {kind: 'simple'}
 */
function components(model, hyp) {
  if (hyp.kind === 'simple') return [{ simple: true, w: 1, label: 'simple' }];
  const Ss = Array.isArray(hyp.S) ? hyp.S : [hyp.S];
  const regs = hyp.regimes || Object.keys(model.regimes);
  const comps = [];
  for (const S of Ss) for (const r of regs) comps.push({ S, regime: r, theta: model.regimes[r].theta, w: 1 / (Ss.length * regs.length), label: `S${S}/${r}` });
  return comps;
}

/**
 * Scorer for a fixed cipher isomorph.
 * opts: {iso: Int32Array|array (class per position), rows: array (row id per position), hyp, letterSet}
 * Returns {logL(pt) -> log10 L, perComp(pt) -> [log10 per component], comps}
 */
function makeScorer(model, opts) {
  const iso = Array.from(opts.iso);
  const rows = Array.from(opts.rows || iso.map(() => 0));
  const n = iso.length;
  const comps = components(model, opts.hyp || model.defaultHyp);
  const nC = comps.length;
  const logw = comps.map((c) => Math.log10(c.w));
  // per component: k-distribution per letter
  const kd = comps.map((c) => {
    if (c.simple) return null;
    const t = targets(model.alloc, c.S, opts.letterSet);
    return [...Array(26).keys()].map((l) => kDist(model.alloc, t[l]));
  });
  // theta list (distinct)
  const thetas = [];
  const thetaIdx = comps.map((c) => {
    if (c.simple) return -1;
    let i = thetas.indexOf(c.theta);
    if (i < 0) { thetas.push(c.theta); i = thetas.length - 1; }
    return i;
  });
  const stats = { approxPatterns: 0 };
  const patMemo = new Map();   // patternKey -> Float64Array[(thetaIdx)*(KMAX+1)+k]
  const letMemo = new Map();   // letter+patternKey -> Float64Array(nC) log10
  function patVec(key, cls, rws) {
    let v = patMemo.get(key);
    if (v) return v;
    v = new Float64Array(thetas.length * (KMAX + 1));
    if (cls.length > MEXACT) stats.approxPatterns++;
    let nc = 0;
    for (const x of cls) if (x + 1 > nc) nc = x + 1;
    for (let ti = 0; ti < thetas.length; ti++) {
      for (let k = 1; k <= KMAX; k++) v[ti * (KMAX + 1) + k] = k < nc ? 0 : patternProb(thetas[ti], k, cls, rws);
    }
    patMemo.set(key, v);
    return v;
  }
  function letterVec(l, key, cls, rws) {
    const mk = l + '|' + key;
    let v = letMemo.get(mk);
    if (v) return v;
    v = new Float64Array(nC);
    let nc = 0;
    for (const x of cls) if (x + 1 > nc) nc = x + 1;
    const pv = thetas.length ? patVec(key, cls, rws) : null;
    for (let ci = 0; ci < nC; ci++) {
      if (comps[ci].simple) { v[ci] = nc === 1 ? 0 : -Infinity; continue; }
      const kdl = kd[ci][l];
      const ti = thetaIdx[ci];
      let p = 0;
      for (let k = 1; k <= KMAX; k++) p += kdl[k] * pv[ti * (KMAX + 1) + k];
      v[ci] = p > 0 ? Math.log10(p) : -Infinity;
    }
    letMemo.set(mk, v);
    return v;
  }
  const posBy = Array.from({ length: 26 }, () => []);
  const acc = new Float64Array(nC);
  const symLetter = new Int32Array(n).fill(-1);
  /** pt: string or Uint8Array codes */
  function perComp(pt) {
    const codes = typeof pt === 'string' ? Array.from(pt, (ch) => ch.charCodeAt(0) - 65) : pt;
    for (let l = 0; l < 26; l++) posBy[l].length = 0;
    symLetter.fill(-1);
    for (let i = 0; i < n; i++) {
      const l = codes[i];
      const s = iso[i];
      if (symLetter[s] === -1) symLetter[s] = l;
      else if (symLetter[s] !== l) return null; // inconsistent
      posBy[l].push(i);
    }
    acc.fill(0);
    for (let l = 0; l < 26; l++) {
      const ps = posBy[l];
      if (!ps.length) continue;
      // canonical pattern
      const map = new Map();
      const cls = [], rws = [];
      let key = '';
      let r0 = rows[ps[0]], rid = 0, lastRow = r0;
      for (const p of ps) {
        if (!map.has(iso[p])) map.set(iso[p], map.size);
        const c = map.get(iso[p]);
        if (rows[p] !== lastRow) { rid++; lastRow = rows[p]; }
        cls.push(c); rws.push(rid);
        key += c + (rid ? ':' + rid : '') + ',';
      }
      const v = letterVec(l, key, cls, rws);
      for (let ci = 0; ci < nC; ci++) acc[ci] += v[ci];
    }
    return acc;
  }
  function logL(pt) {
    const a = perComp(pt);
    if (!a) return -Infinity;
    let mx = -Infinity;
    for (let ci = 0; ci < nC; ci++) { const v = a[ci] + logw[ci]; if (v > mx) mx = v; }
    if (mx === -Infinity) return -Infinity;
    let s = 0;
    for (let ci = 0; ci < nC; ci++) s += Math.pow(10, a[ci] + logw[ci] - mx);
    return mx + Math.log10(s);
  }
  /** true if some letter of pt has more than MEXACT uses (its pattern probability is approximate) */
  function approx(pt) {
    const codes = typeof pt === 'string' ? Array.from(pt, (ch) => ch.charCodeAt(0) - 65) : pt;
    const cnt = new Int32Array(26);
    for (let i = 0; i < n; i++) if (++cnt[codes[i]] > MEXACT) return true;
    return false;
  }
  return { logL, perComp: (pt) => { const a = perComp(pt); return a ? Array.from(a) : null; }, comps, n, stats, approx };
}

/* ------------------------------------------------------------ simulate */

function sampleIdx(p, k, u) {
  let acc = 0;
  for (let i = 0; i < k; i++) { acc += p[i]; if (u < acc) return i; }
  return k - 1;
}

/** Draw key sizes for all 26 letters (k = 1 for all under 'simple'). */
function drawKeySizes(model, S, rng, simple) {
  const ks = new Int32Array(26).fill(1);
  if (simple) return ks;
  const t = targets(model.alloc, S);
  for (let l = 0; l < 26; l++) {
    const p = kDist(model.alloc, t[l]);
    const u = rng();
    let acc = 0;
    for (let k = 1; k <= KMAX; k++) { acc += p[k]; if (u < acc) { ks[l] = k; break; } if (k === KMAX) ks[l] = KMAX; }
  }
  return ks;
}

/**
 * Encrypt letters (string or codes) Zodiac-style with key sizes ks and theta.
 * rows: row id per position.  Returns Int32Array of symbol ids (letter*32 + index).
 * opts.startIdx: per-letter starting index (default random).
 */
function encrypt(letters, rows, ks, theta, rng) {
  const codes = typeof letters === 'string' ? Array.from(letters, (ch) => ch.charCodeAt(0) - 65) : letters;
  const n = codes.length;
  const last = new Int32Array(26).fill(-1), start = new Int32Array(26), lastRow = new Int32Array(26).fill(-1), used = new Int32Array(26);
  const buf = new Float64Array(KMAX + 1);
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const l = codes[i], k = ks[l];
    let idx;
    if (k === 1) idx = 0;
    else if (last[l] < 0) { idx = Math.floor(rng() * k); start[l] = idx; }
    else {
      const newRow = rows[i] !== lastRow[l];
      if (newRow) used[l] = 0;
      // work in rotated frame (start = 0)
      const j = (last[l] - start[l] + k) % k;
      const um = rotMask(used[l], start[l], k);
      if (newRow) {
        if (rng() < theta.tau) idx = start[l];
        else { transition(theta, k, j, 0, buf); idx = (sampleIdx(buf, k, rng()) + start[l]) % k; }
      } else {
        transition(theta, k, j, um, buf);
        idx = (sampleIdx(buf, k, rng()) + start[l]) % k;
      }
    }
    if (rows[i] !== lastRow[l]) used[l] = 0;
    used[l] |= 1 << idx;
    last[l] = idx; lastRow[l] = rows[i];
    out[i] = l * 32 + idx;
  }
  return out;
}

/* ---------------------------------------------------------------- misc */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadModel(file) {
  const f = file || path.join(__dirname, '..', 'results', 'cyclemodel', 'fit.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return j.model;
}

module.exports = {
  KMAX, LETTERS, LN10, englishFreq, transition, stepProb, seqLogProbKnown, patternProb, patternProbExact, patternProbDP, patternProbDFS, patternProbFast, approxPatternProb, MEXACT, rotMask,
  targets, kDist, isoOf, rowsFor, components, makeScorer, drawKeySizes, encrypt, mulberry32, loadModel, normCdf,
};
