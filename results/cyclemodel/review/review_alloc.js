'use strict';
/**
 * results/cyclemodel/review/review_alloc.js - reviewer's sensitivity check on the
 * key-size allocation of tools/cyclemodel_fit.js.
 *
 * The attacker's allocation model puts its outlier mass eta UNIFORMLY on k = 1..14, so
 * P(k = 1 | a frequent letter) = eta / 14 ~ 0.002.  The only large outlier in the two
 * solved keys is a frequent letter with ONE symbol (Z340 H, target ~4), which is exactly
 * the case that decides Z13's '0' at 4, 6, 8.  This script:
 *   1. refits the original model (alpha, s, eta) to check the numbers;
 *   2. fits a model with an extra outlier mass eta1 on k = 1 only;
 *   3. writes model files (fit.json's model with the allocation replaced) for
 *      results/cyclemodel/review/review_windows.js:
 *        review/model_orig.json   original allocation (control; must reproduce windows_z13.json)
 *        review/model_k1fit.json  ML fit with eta1
 *        review/model_k1_05.json  original fit + eta1 = 0.05 (P(k=1 | frequent) ~ empirical 1/19)
 *   node results/cyclemodel/review/review_alloc.js
 */
const fs = require('fs');
const path = require('path');
const M = require('./review_lib');
const D = require('../../../tools/cyclemodel_data');

const ROOT = path.join(__dirname, '..', '..', '..');
const OUTDIR = __dirname;
const keys = D.keys();
const L2 = (l) => l.charCodeAt(0) - 65;
const sig = (x) => 1 / (1 + Math.exp(-x));

const rows = [];
for (const [cid, S] of [['z408', 54], ['z340', 63]]) {
  const key = keys[cid];
  const set = Object.keys(key).map(L2);
  for (const L of Object.keys(key)) rows.push({ cipher: cid, S, letter: L, k: key[L].length, set });
}

function ll(alloc) {
  let s = 0;
  const cache = new Map();
  for (const r of rows) {
    let t = cache.get(r.cipher);
    if (!t) { t = M.targets(alloc, r.S, r.set); cache.set(r.cipher, t); }
    const p = M.kDist(alloc, t[L2(r.letter)]);
    s += Math.log10(Math.max(p[r.k], 1e-300));
  }
  return s;
}

function nelderMead(f, x0, { iters = 2000, step = 0.5, tol = 1e-10 } = {}) {
  const n = x0.length;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += step; simplex.push(x); }
  let vals = simplex.map(f);
  for (let it = 0; it < iters; it++) {
    const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = idx.map((i) => simplex[i]); vals = idx.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < tol) break;
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const xr = c.map((ci, j) => ci + (ci - simplex[n][j]));
    const fr = f(xr);
    if (fr < vals[0]) {
      const xe = c.map((ci, j) => ci + 2 * (ci - simplex[n][j]));
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; } else {
      const xc = c.map((ci, j) => ci + 0.5 * (simplex[n][j] - ci));
      const fc = f(xc);
      if (fc < vals[n]) { simplex[n] = xc; vals[n] = fc; } else {
        for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((x, j) => simplex[0][j] + 0.5 * (x - simplex[0][j])); vals[i] = f(simplex[i]); }
      }
    }
  }
  const b = vals.indexOf(Math.min(...vals));
  return { x: simplex[b], f: vals[b] };
}

function fitWith(toA, starts) {
  let best = null;
  for (const x0 of starts) {
    const f = (v) => -ll(toA(v));
    const r = nelderMead(f, nelderMead(f, x0).x, { step: 0.2 });
    if (!best || r.f < best.f) best = r;
  }
  return { alloc: toA(best.x), logLik10: -best.f };
}

const orig = fitWith((v) => ({ alpha: Math.exp(v[0]), s: Math.exp(v[1]), eta: sig(v[2]) }), [[0, 0, -3], [-0.3, -0.5, -4], [0.2, 0.3, -2]]);
const k1 = fitWith((v) => ({ alpha: Math.exp(v[0]), s: Math.exp(v[1]), eta: 0.5 * sig(v[2]), eta1: 0.5 * sig(v[3]) }),
  [[0, 0, -3, -3], [-0.2, -0.5, -5, -2], [0.1, 0.3, -2, -4], [-0.1, -0.3, -8, -3]]);
const fitJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'results', 'cyclemodel', 'fit.json'), 'utf8'));
const stored = fitJ.model.alloc;
const sens = Object.assign({}, stored, { eta1: 0.05 });

// empirical: letters with target >= 3 that got a single symbol
const emp = { frequentLetters: 0, k1: 0, cases: [] };
for (const r of rows) {
  const t = M.targets(stored, r.S, r.set)[L2(r.letter)];
  if (t >= 3) { emp.frequentLetters++; if (r.k === 1) { emp.k1++; emp.cases.push(`${r.cipher}:${r.letter} target ${t.toFixed(2)}`); } }
}

const pk1 = (alloc) => {
  const o = {};
  for (const S of [54, 63]) {
    const t = M.targets(alloc, S);
    o['S' + S] = Object.fromEntries(['E', 'T', 'A', 'O', 'H', 'R', 'D', 'L', 'U'].map((L) => [L, +M.kDist(alloc, t[L2(L)])[1].toFixed(4)]));
  }
  return o;
};

const res = {
  tool: 'results/cyclemodel/review/review_alloc.js', created: new Date().toISOString(), letters: rows.length,
  storedAlloc: stored, storedLogLik10: ll(stored),
  refitOriginal: orig,
  fitWithK1Outlier: k1,
  lrt_eta1: 2 * Math.log(10) * (k1.logLik10 - orig.logLik10),
  sensitivityAlloc: sens, sensitivityLogLik10: ll(sens),
  empiricalFrequentK1: emp,
  pK1: { stored: pk1(stored), k1fit: pk1(k1.alloc), sens05: pk1(sens) },
};
const write = (name, alloc) => {
  const m = JSON.parse(JSON.stringify(fitJ.model));
  m.alloc = alloc;
  m.description = 'REVIEW: ' + m.description + ' | allocation replaced by results/cyclemodel/review/review_alloc.js (' + name + ')';
  fs.writeFileSync(path.join(OUTDIR, `model_${name}.json`), JSON.stringify({ model: m }, null, 1));
};
write('orig', stored);
write('k1fit', k1.alloc);
write('k1_05', sens);
fs.writeFileSync(path.join(OUTDIR, 'alloc_review.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
