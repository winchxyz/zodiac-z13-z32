'use strict';
/**
 * tools/cyclemodel_test.js - unit tests for tools/cyclemodel_lib.js
 *   node tools/cyclemodel_test.js
 * 1. patternProb sums to 1 over all set partitions (restricted growth strings) of m uses,
 *    for several k, theta and row layouts.
 * 2. patternProb agrees with the empirical pattern frequencies of encrypt() (Monte Carlo).
 * 3. kDist sums to 1.
 * 4. makeScorer: inconsistent plaintext -> -Infinity; simple hypothesis = 1:1 check.
 */
const M = require('./cyclemodel_lib');

function rgs(m) {
  const out = [];
  const a = new Array(m).fill(0);
  (function rec(i, mx) {
    if (i === m) { out.push(a.slice()); return; }
    for (let v = 0; v <= mx + 1; v++) { a[i] = v; rec(i + 1, Math.max(mx, v)); }
  })(1, 0);
  return out;
}

let fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log('FAIL', msg); } }

const thetas = [
  { a: 0.9, b: 0.02, c: 0.03, d: 0.05, tau: 0, g: 1 },
  { a: 0.5, b: 0.1, c: 0.15, d: 0.25, tau: 0.2, g: 0.3 },
  { a: 0.2, b: 0.3, c: 0.2, d: 0.3, tau: 0.5, g: 0.05 },
];
const layouts = [
  (m) => new Array(m).fill(0),
  (m) => Array.from({ length: m }, (_, i) => (i < m / 2 ? 0 : 1)),
  (m) => Array.from({ length: m }, (_, i) => i),
];
for (const th of thetas) for (const k of [1, 2, 3, 4, 6]) for (const m of [1, 2, 3, 5, 6]) for (const lay of layouts) {
  const rows = lay(m);
  let s = 0;
  for (const p of rgs(m)) s += M.patternProb(th, k, p, rows);
  check(Math.abs(s - 1) < 1e-9, `sum k=${k} m=${m} th=${JSON.stringify(th)} rows=${rows} -> ${s}`);
}
console.log('normalisation tests done');

// Monte Carlo agreement
const rng = M.mulberry32(12345);
for (const th of thetas) for (const k of [2, 3, 5]) {
  const m = 5;
  const rows = [0, 0, 0, 1, 1];
  const ks = new Int32Array(26).fill(1); ks[4] = k;
  const counts = new Map();
  const N = 200000;
  for (let t = 0; t < N; t++) {
    const sym = M.encrypt('EEEEE', rows, ks, th, rng);
    const iso = Array.from(M.isoOf(Array.from(sym, (x) => String.fromCharCode(48 + (x & 31))).join(''))).join('');
    counts.set(iso, (counts.get(iso) || 0) + 1);
  }
  let maxZ = 0;
  for (const p of rgs(m)) {
    const pr = M.patternProb(th, k, p, rows);
    const emp = (counts.get(p.join('')) || 0) / N;
    const sd = Math.sqrt(pr * (1 - pr) / N) + 1e-12;
    const z = Math.abs(emp - pr) / sd;
    if (pr > 1e-4 && z > maxZ) maxZ = z;
  }
  check(maxZ < 5, `MC disagreement k=${k} th=${JSON.stringify(th)} maxZ=${maxZ}`);
  console.log(`MC k=${k} a=${th.a}: max |z| = ${maxZ.toFixed(2)}`);
}

// DP (tau = 0) vs labelling DFS on random patterns
{
  const r2 = M.mulberry32(99);
  let maxRel = 0, nT = 0;
  for (let trial = 0; trial < 400; trial++) {
    const th = { a: r2(), b: r2() * 0.3, c: r2() * 0.3, d: r2(), tau: 0, g: r2() < 0.5 ? 1 : 0.02 + r2() };
    const z = th.a + th.b + th.c + th.d; th.a /= z; th.b /= z; th.c /= z; th.d /= z;
    const m = 2 + Math.floor(r2() * 6);
    const cls = [0]; let mx = 0;
    for (let t = 1; t < m; t++) { const v = Math.floor(r2() * (mx + 2)); cls.push(v); if (v > mx) mx = v; }
    const rows = []; let rr = 0;
    for (let t = 0; t < m; t++) { if (t && r2() < 0.25) rr++; rows.push(rr); }
    for (const k of [2, 3, 4, 5, 7, 9]) {
      const a = M.patternProbDP(th, k, cls, rows), b = M.patternProbDFS(th, k, cls, rows);
      const a2 = M.patternProbFast(th, k, cls, rows);
      if (b > 1e-15) check(Math.abs(a2 - b) / b < 1e-9, `Fast vs DFS ${cls} k=${k}: ${a2} vs ${b}`);
      const rel = Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
      if (b > 1e-15 && rel > maxRel) maxRel = rel;
      if (b <= 1e-15) check(Math.abs(a - b) < 1e-14, `DP vs DFS zero case ${cls} k=${k}`);
      nT++;
    }
  }
  check(maxRel < 1e-9, `DP vs DFS max relative difference ${maxRel}`);
  console.log(`DP vs DFS: ${nT} comparisons, max relative difference ${maxRel.toExponential(2)}`);
  const th = { a: 0.3, b: 0.14, c: 0.03, d: 0.53, tau: 0, g: 0.12 };
  const t0 = Date.now();
  let s = 0;
  for (let k = 1; k <= 14; k++) s += M.patternProb(th, k, [0, 1, 2, 3, 4, 5, 6, 7], [0, 0, 0, 0, 1, 1, 1, 1]);
  console.log(`timing: 8 distinct classes, k = 1..14: ${Date.now() - t0} ms`);
}

// kDist
const alloc = { alpha: 1, s: 0.8, eta: 0.02 };
for (const t of [0.1, 1, 3.3, 7.9, 13]) {
  const p = M.kDist(alloc, t);
  let s = 0; for (let k = 1; k <= M.KMAX; k++) s += p[k];
  check(Math.abs(s - 1) < 1e-9, `kDist sum t=${t} ${s}`);
}

// scorer
const model = { alloc, regimes: { r1: { theta: thetas[0] } }, defaultHyp: { kind: 'homophonic', S: 54 } };
const iso = M.isoOf('AENz0K0M0[NAM');
const sc = M.makeScorer(model, { iso, rows: new Array(13).fill(0), hyp: { kind: 'homophonic', S: [54] } });
check(sc.logL('ABCDEFGHIJKLM') === -Infinity, 'inconsistent should be -Inf');
const v = sc.logL('WEEDTSTHTREWH');
check(Number.isFinite(v), 'consistent should be finite');
const ss = M.makeScorer(model, { iso, rows: new Array(13).fill(0), hyp: { kind: 'simple' } });
check(ss.logL('WEEDTSTHTREWH') === -Infinity, 'simple: E twice with different symbols -> -Inf');
check(ss.logL('ABCDEFEGEHCAG') === 0, 'simple: exact pattern -> 0');
console.log(fails ? `${fails} FAILURES` : 'all tests passed');
process.exit(fails ? 1 : 0);
