'use strict';
/**
 * tools/cyclemodel_fit.js - fit the homophone-selection model of
 * tools/cyclemodel_lib.js on Z408 and Z340 (written order), validate it, and
 * write results/cyclemodel/fit.json (the model used by the other cyclemodel tools).
 *
 *   node tools/cyclemodel_fit.js [--boot 40] [--sims 400] [--seed 7]
 *
 * Fits (maximum likelihood of each letter's symbol-repeat pattern, cycle order
 * marginalised exactly):
 *   regimes  z408p12 (Z408 parts 1-2), z408p3 (part 3 without the 18-symbol tail),
 *            z340 (all of Z340 in written order), pooled (all)
 *   nested models: random (uniform homophone), cycle-only (tau = 0, g = 1), full
 * Held-out: train on one regime / half, test on another, log10-likelihood per transition.
 * Allocation: k_X = max(1, round(S f_X^alpha / sum f^alpha + e)), fitted on both keys.
 * Simulation check: re-encipher the Z408 (parts 1-2) and Z340 letter sequences with the
 * fitted model and compare repeat statistics with the real ciphers.
 * Prints and stores only counts and parameters (no plaintext).
 */
const fs = require('fs');
const path = require('path');
const M = require('./cyclemodel_lib');
const D = require('./cyclemodel_data');

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const BOOT = +opt('boot', 40), SIMS = +opt('sims', 400), SEED = +opt('seed', 7);
const OUT = opt('out', 'results/cyclemodel/fit.json');

/* ---------------------------------------------------------------- data */
const segs = D.segments();
const keys = D.keys();
const L2 = (l) => l.charCodeAt(0) - 65;

/** per-letter pattern data for a set of segment ids: [{L, k, cls, rows, n}] */
function letterData(ids, key) {
  const ev = [];
  for (const s of segs) if (ids.includes(s.id)) ev.push(...s.events);
  ev.sort((x, y) => x.i - y.i);
  const by = {};
  for (const e of ev) (by[e.letter] = by[e.letter] || []).push(e);
  const out = [];
  for (const [L, es] of Object.entries(by)) {
    const k = key[L].length;
    const m = new Map();
    const cls = es.map((e) => { if (!m.has(e.sym)) m.set(e.sym, m.size); return m.get(e.sym); });
    out.push({ L, k, cls, rows: es.map((e) => e.row), n: es.length });
  }
  return out;
}

const REG = {
  z408p12: letterData(['z408.p1', 'z408.p2'], keys.z408),
  z408p3: letterData(['z408.p3'], keys.z408),
  z340: letterData(['z340.s1', 'z340.s2', 'z340.s3'], keys.z340),
  z408p1: letterData(['z408.p1'], keys.z408),
  z408p2: letterData(['z408.p2'], keys.z408),
  z340s1: letterData(['z340.s1'], keys.z340),
  z340s23: letterData(['z340.s2', 'z340.s3'], keys.z340),
};
REG.pooled = REG.z408p12.concat(REG.z408p3, REG.z340);

function transitions(data) { let t = 0; for (const x of data) if (x.k > 1) t += x.n - 1; return t; }

/* ---------------------------------------------------------- likelihood */
function logLik(theta, data) {
  let s = 0;
  for (const x of data) {
    if (x.k < 2 || x.n < 2) continue;
    const p = M.patternProbExact(theta, x.k, x.cls, x.rows);
    s += Math.log10(Math.max(p, 1e-300));
  }
  return s;
}

/** uniform random homophone: P(pattern) = prod over uses of (1/k if seen class else (k-c)/k) */
function logLikRandom(data) {
  let s = 0;
  for (const x of data) {
    if (x.k < 2 || x.n < 2) continue;
    let seen = 1;
    for (let t = 1; t < x.n; t++) {
      if (x.cls[t] < seen) s += Math.log10(1 / x.k);
      else { s += Math.log10((x.k - seen) / x.k); seen++; }
    }
  }
  return s;
}

/* ------------------------------------------------------- parametrisation */
const sig = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));
/** v = [la, lb, lc, ltau, lg] (ld = 0 fixed); variant fixes some */
// floors keep every pattern possible (a boundary fit such as g = 0 would make a
// within-row repeat impossible and give -Infinity on Z13/Z32 candidates)
const EPS_MOVE = 0.002, G_MIN = 0.02;
function toTheta(v, variant) {
  const ea = Math.exp(v[0]), eb = Math.exp(v[1]), ec = Math.exp(v[2]), ed = 1;
  const z = ea + eb + ec + ed;
  const w = (x) => EPS_MOVE + (1 - 4 * EPS_MOVE) * x / z;
  let a = w(ea), c = w(ec);
  // the likelihood is symmetric in (a, c) (the cycle order is marginalised in both
  // directions), so report the dominant direction as "forward"
  if (c > a) { const t = a; a = c; c = t; }
  return {
    a, b: w(eb), c, d: w(ed),
    tau: variant.tau0 ? 0 : 0.98 * sig(v[3]),
    g: variant.g1 ? 1 : G_MIN + (1 - G_MIN) * sig(v[4]),
  };
}

function nelderMead(f, x0, { iters = 600, step = 0.8, tol = 1e-7 } = {}) {
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
    } else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
    else {
      const xc = c.map((ci, j) => ci + 0.5 * (simplex[n][j] - ci));
      const fc = f(xc);
      if (fc < vals[n]) { simplex[n] = xc; vals[n] = fc; }
      else {
        for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((x, j) => simplex[0][j] + 0.5 * (x - simplex[0][j])); vals[i] = f(simplex[i]); }
      }
    }
  }
  const best = vals.indexOf(Math.min(...vals));
  return { x: simplex[best], f: vals[best] };
}

function fit(data, variant = {}) {
  const f = (v) => -logLik(toTheta(v, variant), data);
  let best = null;
  for (const x0 of [[1.5, -1, -1, -2, 0], [0, 0, 0, -1, 1], [2.5, -2, -1, -3, -1]]) {
    const r = nelderMead(f, x0);
    const r2 = nelderMead(f, r.x, { step: 0.3 });
    if (!best || r2.f < best.f) best = r2;
  }
  const theta = toTheta(best.x, variant);
  return { theta, logLik10: -best.f, v: best.x };
}

const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const rt = (th) => Object.fromEntries(Object.entries(th).map(([k, v]) => [k, round(v)]));

/* ------------------------------------------------------------ bootstrap */
function bootstrap(data, nb, seed) {
  const rng = M.mulberry32(seed);
  const out = [];
  for (let b = 0; b < nb; b++) {
    const d = [];
    for (let i = 0; i < data.length; i++) d.push(data[Math.floor(rng() * data.length)]);
    out.push(fit(d).theta);
  }
  const summ = {};
  for (const key of ['a', 'b', 'c', 'd', 'tau', 'g']) {
    const v = out.map((t) => t[key]).sort((x, y) => x - y);
    summ[key] = { lo: round(v[Math.floor(0.05 * (v.length - 1))]), med: round(v[Math.floor(0.5 * (v.length - 1))]), hi: round(v[Math.ceil(0.95 * (v.length - 1))]) };
  }
  return summ;
}

/* ----------------------------------------------------------- allocation */
function allocData() {
  const rows = [];
  for (const [cid, S] of [['z408', 54], ['z340', 63]]) {
    const key = keys[cid];
    const letters = Object.keys(key).map(L2);
    for (const L of Object.keys(key)) rows.push({ cipher: cid, S, letter: L, k: key[L].length, set: letters });
  }
  return rows;
}

function allocLogLik(alloc, rows) {
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

function fitAlloc(rows) {
  const toA = (v) => ({ alpha: Math.exp(v[0]), s: Math.exp(v[1]), eta: sig(v[2]) });
  const f = (v) => -allocLogLik(toA(v), rows);
  let best = null;
  for (const x0 of [[0, 0, -3], [-0.3, -0.5, -4], [0.2, 0.3, -2]]) {
    const r = nelderMead(f, nelderMead(f, x0).x, { step: 0.2 });
    if (!best || r.f < best.f) best = r;
  }
  return { alloc: toA(best.x), logLik10: -best.f };
}

/* ---------------------------------------------------- simulation checks */
function repeatStats(sym, rows, letters) {
  // sym: array of symbol ids; rows: row id per position; letters: letter code per position
  const n = sym.length;
  const st = {};
  // rows without repeat, same-symbol pairs within rows
  const byRow = new Map();
  for (let i = 0; i < n; i++) { if (!byRow.has(rows[i])) byRow.set(rows[i], []); byRow.get(rows[i]).push(sym[i]); }
  let noRep = 0, pairs = 0;
  for (const r of byRow.values()) {
    const c = new Map();
    for (const s of r) c.set(s, (c.get(s) || 0) + 1);
    let rep = false;
    for (const v of c.values()) { if (v > 1) rep = true; pairs += v * (v - 1) / 2; }
    if (!rep) noRep++;
  }
  st.rowsNoRepeat = noRep; st.pairsWithinRow = pairs;
  for (let d = 1; d <= 3; d++) { let k = 0; for (let i = 0; i + d < n; i++) if (sym[i] === sym[i + d]) k++; st['near_d' + d] = k; }
  st.distinct = new Set(sym).size;
  // repeated bigrams: sum over bigram types of (count - 1)
  const bg = new Map();
  for (let i = 0; i + 1 < n; i++) { const k = sym[i] + ',' + sym[i + 1]; bg.set(k, (bg.get(k) || 0) + 1); }
  let rb = 0; for (const v of bg.values()) if (v > 1) rb += v - 1;
  st.repeatBigrams = rb;
  // cycle-follow rate (cycle = order of first use, letters with >= 2 symbols used)
  const seqs = new Map();
  for (let i = 0; i < n; i++) { if (!seqs.has(letters[i])) seqs.set(letters[i], []); seqs.get(letters[i]).push(sym[i]); }
  let fol = 0, tr = 0;
  for (const s of seqs.values()) {
    const order = [];
    for (const x of s) if (!order.includes(x)) order.push(x);
    if (order.length < 2) continue;
    const idx = new Map(order.map((x, i) => [x, i]));
    for (let t = 1; t < s.length; t++) { tr++; if ((idx.get(s[t - 1]) + 1) % order.length === idx.get(s[t])) fol++; }
  }
  st.cycleRate = tr ? fol / tr : 0;
  return st;
}

function simCheck(name, ids, cipherKey, theta, model, S, nSims, seed) {
  const ev = [];
  for (const s of segs) if (ids.includes(s.id)) ev.push(...s.events);
  ev.sort((x, y) => x.i - y.i);
  const letters = ev.map((e) => L2(e.letter));
  const rows = ev.map((e) => e.row);
  const symIds = new Map();
  const realSym = ev.map((e) => { if (!symIds.has(e.sym)) symIds.set(e.sym, symIds.size); return symIds.get(e.sym); });
  const real = repeatStats(realSym, rows, letters);
  const ksReal = new Int32Array(26).fill(1);
  for (const [L, sy] of Object.entries(cipherKey)) ksReal[L2(L)] = sy.length;
  const rng = M.mulberry32(seed);
  const out = { real, simRealKey: {}, simModelKey: {} };
  for (const [label, keyFn] of [['simRealKey', () => ksReal], ['simModelKey', () => M.drawKeySizes(model, S, rng, false)]]) {
    const acc = {};
    for (let t = 0; t < nSims; t++) {
      const sym = M.encrypt(letters, rows, keyFn(), theta, rng);
      const st = repeatStats(Array.from(sym), rows, letters);
      for (const [k, v] of Object.entries(st)) (acc[k] = acc[k] || []).push(v);
    }
    for (const [k, vs] of Object.entries(acc)) {
      vs.sort((x, y) => x - y);
      const mean = vs.reduce((x, y) => x + y, 0) / vs.length;
      const sd = Math.sqrt(vs.reduce((x, y) => x + (y - mean) ** 2, 0) / vs.length);
      const below = vs.filter((v) => v < real[k]).length, eq = vs.filter((v) => v === real[k]).length;
      out[label][k] = { mean: round(mean, 3), sd: round(sd, 3), p5: vs[Math.floor(0.05 * vs.length)], p95: vs[Math.floor(0.95 * vs.length)], realPercentile: round((below + eq / 2) / vs.length, 3) };
    }
  }
  console.log(`\nsimulation check ${name} (${nSims} sims): real vs sim mean [p5, p95] (percentile of real)`);
  for (const k of Object.keys(real)) {
    const a = out.simRealKey[k], b = out.simModelKey[k];
    console.log(`  ${k.padEnd(15)} real ${round(real[k], 3)}  realKey ${a.mean} [${a.p5}, ${a.p95}] (${a.realPercentile})  modelKey(S=${S}) ${b.mean} [${b.p5}, ${b.p95}] (${b.realPercentile})`);
  }
  return out;
}

/* ----------------------------------------------------------------- main */
function main() {
  const t0 = Date.now();
  const res = { tool: 'tools/cyclemodel_fit.js', created: new Date().toISOString(), command: 'node tools/cyclemodel_fit.js ' + args.join(' ') };
  res.data = {};
  for (const [k, d] of Object.entries(REG)) res.data[k] = { letters: d.length, lettersMultiHomophone: d.filter((x) => x.k > 1).length, transitions: transitions(d) };
  console.log('transitions per regime', JSON.stringify(res.data));

  // fits
  res.fits = {};
  const fitted = {};
  for (const reg of ['z408p12', 'z408p3', 'z340', 'pooled', 'z408p1', 'z340s1']) {
    const d = REG[reg];
    const full = fit(d);
    const cyc = fit(d, { tau0: true, g1: true });
    const noG = fit(d, { g1: true });
    const noTau = fit(d, { tau0: true });
    const rnd = logLikRandom(d);
    const tr = transitions(d);
    fitted[reg] = noTau.theta; // tau is ~0 in every regime (LRT below); the exported model uses tau = 0 (fast exact DP)
    res.fits[reg] = {
      transitions: tr,
      full: { theta: rt(full.theta), logLik10: round(full.logLik10, 3), perTransition: round(full.logLik10 / tr, 4), params: 5 },
      noTauNoG: { theta: rt(cyc.theta), logLik10: round(cyc.logLik10, 3), params: 3 },
      noG: { theta: rt(noG.theta), logLik10: round(noG.logLik10, 3), params: 4 },
      noTau: { theta: rt(noTau.theta), logLik10: round(noTau.logLik10, 3), params: 4 },
      random: { logLik10: round(rnd, 3), perTransition: round(rnd / tr, 4), params: 0 },
      // likelihood-ratio statistics (2 ln LR, chi2 with 1 df each) for tau and g
      lrt_g: round(2 * Math.log(10) * (full.logLik10 - noG.logLik10), 2),
      lrt_tau: round(2 * Math.log(10) * (full.logLik10 - noTau.logLik10), 2),
      lrt_vs_random: round(2 * Math.log(10) * (full.logLik10 - rnd), 2),
    };
    console.log(`\nfit ${reg} (${tr} transitions): theta ${JSON.stringify(rt(full.theta))}`);
    console.log(`  log10L full ${full.logLik10.toFixed(2)} | no tau,g ${cyc.logLik10.toFixed(2)} | no g ${noG.logLik10.toFixed(2)} | no tau ${noTau.logLik10.toFixed(2)} | random ${rnd.toFixed(2)}`);
    console.log(`  LRT g ${res.fits[reg].lrt_g}  tau ${res.fits[reg].lrt_tau}  vs random ${res.fits[reg].lrt_vs_random}`);
  }

  // held-out
  res.heldout = [];
  const pairs = [['z408p1', 'z408p2'], ['z340s1', 'z340s23'], ['z408p12', 'z340'], ['z340', 'z408p12'], ['z408p12', 'z408p3'], ['z340', 'z408p3'], ['z408p3', 'z340'], ['pooled', 'z340'], ['pooled', 'z408p12']];
  console.log('\nheld-out log10 L per transition (train -> test): model vs random');
  for (const [tr, te] of pairs) {
    const th = fitted[tr] || fit(REG[tr]).theta;
    const ll = logLik(th, REG[te]), rnd = logLikRandom(REG[te]), n = transitions(REG[te]);
    const own = fitted[te] ? logLik(fitted[te], REG[te]) : null;
    const row = { train: tr, test: te, transitions: n, perTransModel: round(ll / n, 4), perTransRandom: round(rnd / n, 4), perTransOwnFit: own == null ? null : round(own / n, 4), gainOverRandom10: round(ll - rnd, 2) };
    res.heldout.push(row);
    console.log(`  ${tr} -> ${te}: model ${row.perTransModel}  random ${row.perTransRandom}  own-fit ${row.perTransOwnFit}  total gain ${row.gainOverRandom10} log10 units`);
  }

  // bootstrap
  res.bootstrap = {};
  for (const reg of ['z408p12', 'z408p3', 'z340']) {
    res.bootstrap[reg] = bootstrap(REG[reg], BOOT, SEED + reg.length);
    console.log(`bootstrap 90% intervals ${reg} (${BOOT} resamples of letters): ${JSON.stringify(res.bootstrap[reg])}`);
  }

  // allocation
  const arows = allocData();
  const af = fitAlloc(arows);
  const a1 = { alpha: 1, s: af.alloc.s, eta: af.alloc.eta };
  res.alloc = { fit: { alpha: round(af.alloc.alpha), s: round(af.alloc.s), eta: round(af.alloc.eta) }, logLik10: round(af.logLik10, 3), n: arows.length, logLik10_alpha1: round(allocLogLik(a1, arows), 3) };
  res.alloc.residuals = arows.map((r) => {
    const t = M.targets(af.alloc, r.S, r.set)[L2(r.letter)];
    return { cipher: r.cipher, letter: r.letter, k: r.k, target: round(t, 2) };
  });
  console.log(`\nallocation fit: ${JSON.stringify(res.alloc.fit)} log10L ${res.alloc.logLik10} (alpha=1: ${res.alloc.logLik10_alpha1}) on ${arows.length} letters`);
  console.log('  residuals |k - target| > 1.5: ' + res.alloc.residuals.filter((r) => Math.abs(r.k - r.target) > 1.5).map((r) => `${r.cipher}:${r.letter} k=${r.k} t=${r.target}`).join(', '));

  // model object
  const model = {
    description: 'homophone-selection model fitted by tools/cyclemodel_fit.js; see tools/cyclemodel_lib.js',
    alloc: af.alloc,
    regimes: {
      z408p12: { theta: fitted.z408p12, source: 'Z408 parts 1-2 (disciplined cycling)' },
      z340: { theta: fitted.z340, source: 'Z340 written order (all sections)' },
      z408p3: { theta: fitted.z408p3, source: 'Z408 part 3 (cycling abandoned)' },
    },
    defaultHyp: { kind: 'homophonic', S: [20, 26, 30, 35, 40, 45, 50, 54, 58, 63, 68], regimes: ['z408p12', 'z340', 'z408p3'] },
  };
  res.model = model;

  // simulation checks
  res.simulation = {
    z408p12: simCheck('Z408 parts 1-2, theta z408p12', ['z408.p1', 'z408.p2'], keys.z408, fitted.z408p12, model, 54, SIMS, SEED + 1),
    z340: simCheck('Z340 written, theta z340', ['z340.s1', 'z340.s2', 'z340.s3'], keys.z340, fitted.z340, model, 63, SIMS, SEED + 2),
    z408p3: simCheck('Z408 part 3, theta z408p3', ['z408.p3'], keys.z408, fitted.z408p3, model, 54, SIMS, SEED + 3),
    z340_with_z408theta: simCheck('Z340 written, theta z408p12 (cross)', ['z340.s1', 'z340.s2', 'z340.s3'], keys.z340, fitted.z408p12, model, 63, SIMS, SEED + 4),
  };
  res.seconds = (Date.now() - t0) / 1000;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log(`\nwrote ${OUT} in ${res.seconds.toFixed(1)} s`);
}

main();
