'use strict';
/**
 * tools/lead_skeptic_stat_lib.js - statistic "multiverse" for the hostile-statistician check of the
 * Z13 / Z340-key lead.  Builds on tools/lead_replicate_lib.js (layouts, engines) and tools/lm.js.
 *
 *   const S = require('./lead_skeptic_stat_lib');
 *   S.SPECS                       // [{id, variant, kind, n}] the 36 statistic choices
 *   S.smallSpecs(lay, pl)         // {M2..M6, S3..S6, K6} for a 676-completion layout, by brute force
 *   S.arrangements([3,17,4,0,0,14], fixed)  // distinct permutations of six slot letters (fixed: slot indices kept)
 *   S.pvec(nullVals, real)        // add-one upper p
 *
 * Statistics for a variant with two free symbols (676 completions):
 *   Mn = max over completions of the order-n Markov log10 P (lm.ngramScore(t, n).logp), n = 2..6
 *   Sn = max over completions of the order-n window sum (lm.ngramScore(t, n).sum), n = 3..6
 *   K6 = mean of the 10 largest M6 values (= replication t3)
 *   W  = max over completions of lm.wordSegment logp (= replication t2)
 * circles_distinct contributes the replication's t1, t2, t3 only.
 */
const lm = require('./lm');
const R = require('./lead_replicate_lib');

const SMALL = ['canonical', 'crosshair_null', 'reversed'];
const SMALL_KINDS = ['M2', 'M3', 'M4', 'M5', 'M6', 'S3', 'S4', 'S5', 'S6', 'K6', 'W'];
const SPECS = [];
for (const v of SMALL) for (const k of SMALL_KINDS) SPECS.push({ id: `${v}:${k}`, variant: v, kind: k });
for (const k of ['M6', 'W', 'K6']) SPECS.push({ id: `circles_distinct:${k}`, variant: 'circles_distinct', kind: k });

const P26 = [1, 26, 676, 17576, 456976, 11881376];
let T = null;
function tables() {
  if (T) return T;
  T = [null, lm.table(1), lm.table(2), lm.table(3), lm.table(4), lm.table(5)];
  return T;
}

/** Brute-force small-layout statistics for one pinned-letter vector (Int8Array, -1 = free). */
function smallSpecs(lay, pl) {
  const J = tables();
  const G = lay.groups.length;
  const total = 26 ** G;
  const n = lay.n;
  const best = { M2: -Infinity, M3: -Infinity, M4: -Infinity, M5: -Infinity, M6: -Infinity, S3: -Infinity, S4: -Infinity, S5: -Infinity, S6: -Infinity };
  const top = new Float64Array(10).fill(-Infinity);
  const c = new Uint8Array(n);
  const gl = new Array(G).fill(0);
  for (let a = 0; a < total; a++) {
    let r = a;
    for (let g = G - 1; g >= 0; g--) { gl[g] = r % 26; r = (r / 26) | 0; }
    for (let p = 0; p < n; p++) c[p] = pl[p] < 0 ? 0 : pl[p];
    lay.groups.forEach((g, gi) => { for (const p of g.pos) c[p] = gl[gi]; });
    for (let m = 2; m <= 6; m++) {
      const Jp = J[m - 1];
      const Jm = m === 6 ? null : J[m];
      const mod = P26[m - 1];
      let idx = 0;
      for (let i = 0; i < m - 1; i++) idx = idx * 26 + c[i];
      let sum = 0, logp = 0;
      for (let i = m - 1; i < n; i++) {
        idx = (idx % mod) * 26 + c[i];
        const v = Jm ? Jm[idx] : lm.j6(idx);
        sum += v;
        if (i === m - 1) logp += v; else logp += v - Jp[(idx / 26) | 0];
      }
      const kM = 'M' + m;
      if (logp > best[kM]) best[kM] = logp;
      if (m >= 3) { const kS = 'S' + m; if (sum > best[kS]) best[kS] = sum; }
      if (m === 6 && logp > top[0]) {
        let k = 0;
        while (k + 1 < 10 && top[k + 1] < logp) { top[k] = top[k + 1]; k++; }
        top[k] = logp;
      }
    }
  }
  let s = 0;
  for (const v of top) s += v;
  best.K6 = s / 10;
  return best;
}

/** Distinct arrangements of six slot letters; slots listed in `fixed` keep their letter. */
function arrangements(letters, fixed = []) {
  const free = [0, 1, 2, 3, 4, 5].filter((i) => !fixed.includes(i));
  const pool = free.map((i) => letters[i]);
  const out = new Map();
  const used = new Array(pool.length).fill(false);
  const cur = [];
  (function rec() {
    if (cur.length === pool.length) {
      const a = letters.slice();
      free.forEach((slot, k) => { a[slot] = cur[k]; });
      out.set(a.join(','), a);
      return;
    }
    for (let i = 0; i < pool.length; i++) {
      if (used[i]) continue;
      used[i] = true; cur.push(pool[i]); rec(); cur.pop(); used[i] = false;
    }
  })();
  return [...out.values()];
}

/** Add-one upper p-value. */
function pUpper(real, vals) {
  let ge = 0;
  for (const v of vals) if (v >= real) ge++;
  return (1 + ge) / (1 + vals.length);
}

/** Exact permutation p when the real assignment is one of `vals` (real included): #{v >= real} / N. */
function pIncl(real, vals) {
  let ge = 0;
  for (const v of vals) if (v >= real - 1e-12) ge++;
  return ge / vals.length;
}

/**
 * Westfall-Young single-step min-p over columns.  mat[d][t] = null value of draw d for test t;
 * real[t] = observed.  Each draw's p-vector is computed against all draws (rank, add-one).
 * Returns {pRaw[t], minPReal, pFW, nullMinP (Float64Array)}.
 */
function westfallYoung(mat, real, includeReal = false) {
  const D = mat.length, Tn = real.length;
  const pRaw = new Array(Tn);
  const nullP = Array.from({ length: D }, () => new Float64Array(Tn));
  for (let t = 0; t < Tn; t++) {
    const col = mat.map((r) => r[t]);
    pRaw[t] = includeReal ? pIncl(real[t], col) : pUpper(real[t], col);
    // p of each draw against the null column: (#{col >= v}) / D  (rank-based)
    const order = col.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);
    let k = 0;
    while (k < D) {
      let j = k;
      while (j + 1 < D && order[j + 1][0] >= order[k][0] - 1e-12) j++;
      const p = (j + 1) / D;  // number of values >= this value
      for (let q = k; q <= j; q++) nullP[order[q][1]][t] = p;
      k = j + 1;
    }
  }
  const minPReal = Math.min(...pRaw);
  const nullMinP = new Float64Array(D);
  for (let d = 0; d < D; d++) { let m = 1; for (let t = 0; t < Tn; t++) if (nullP[d][t] < m) m = nullP[d][t]; nullMinP[d] = m; }
  let le = 0;
  for (const m of nullMinP) if (m <= minPReal + 1e-12) le++;
  const pFW = includeReal ? le / D : (1 + le) / (1 + D);
  return { pRaw, minPReal, pFW, nullMinP, nullP };
}

module.exports = { SMALL, SMALL_KINDS, SPECS, smallSpecs, arrangements, pUpper, pIncl, westfallYoung, R, lm };
