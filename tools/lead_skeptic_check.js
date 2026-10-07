'use strict';
/**
 * tools/lead_skeptic_check.js - hostile audit of the Z13 / Z340-key lead (task lead/skeptic).
 *
 * Canonical Z13 only (AENz0K0M0[NAM, 676 completions per pin tuple). For a tuple of letters for the
 * six shared symbols (A E N z K M) it computes, over all 676 completions:
 *   t1   max 6-gram Markov log10 P (lm.ngramScore(text, 6).logp)          [replicate T1]
 *   t2   max lm.wordSegment(text).logp                                     [replicate T2]
 *   t3   mean of the 10 best t1 values                                     [replicate T3]
 *   obj  max keyprior objective (keyprior_lib.makeScorer default)          [keyprior "objective"]
 *   wf   max keyprior fast word statistic (statOpts('word'))               [keyprior "word"]
 *
 * Checks (all with seeds different from the earlier runs):
 *   1. real Z340 and Z408 pins;
 *   2. the 360 distinct arrangements of each key's own six letters over the six symbols (rank of real);
 *   3. permuted-key nulls for both keys (--null N draws each);
 *   4. an H1 check: pins taken from word-aligned dictionary fits of Z13's canonical pattern
 *      (enumerate.js words TSV, --fits): the top --h1top fits and a uniform sample of --h1sample from
 *      the whole file; reports where the observed values sit and a KDE likelihood ratio f(H1)/f(H0).
 *
 * Never decodes Z340 or Z408 with their own keys: only the `key` fields are read.
 *
 *   node tools/lead_skeptic_check.js --null 3000 --h1top 1000 --h1sample 1000 --seed 777
 *        --fits <tsv> --out results/lead/skeptic/check.json
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const K = require('./keyprior_lib');

const ROOT = path.join(__dirname, '..');
const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SLOTS = ['A', 'E', 'N', 'z', 'K', 'M'];

function args() {
  const o = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1]; if (v == null || v.startsWith('--')) o[k] = true; else { o[k] = v; i++; } }
  return o;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function loadKey(name) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ciphers', `${name}.json`), 'utf8'));
  const m = {};
  for (const [s, l] of Object.entries(j.key)) m[s] = String(l).toUpperCase();
  return m;
}

const TEXT = fs.readFileSync(path.join(ROOT, 'data', 'ciphers', 'variants', 'z13.canonical.txt'), 'utf8').replace(/\s+/g, '');
if (TEXT !== 'AENz0K0M0[NAM') throw new Error('unexpected canonical text');
const scObj = K.makeScorer(TEXT);
const scWf = K.makeScorer(TEXT, K.statOpts('word'));
const symIdx = {};
scObj.symbols.forEach((s, i) => { symIdx[s] = i; });
if (scWf.symbols.join('') !== scObj.symbols.join('')) throw new Error('symbol order mismatch');

const cache = new Map();
/** pins: string of 6 letters for SLOTS. */
function stats(pins) {
  if (cache.has(pins)) return cache.get(pins);
  const key = new Int8Array(scObj.S);
  for (let k = 0; k < 6; k++) key[symIdx[SLOTS[k]]] = pins.charCodeAt(k) - 65;
  let t1 = -Infinity, t2 = -Infinity, obj = -Infinity, wf = -Infinity;
  let a1 = '', a2 = '', aObj = '';
  const t1s = [];
  for (let c1 = 0; c1 < 26; c1++) {
    for (let c2 = 0; c2 < 26; c2++) {
      key[symIdx['0']] = c1; key[symIdx['[']] = c2;
      let s = '';
      for (let i = 0; i < 13; i++) s += LET[key[symIdx[TEXT[i]]]];
      const v1 = lm.ngramScore(s, 6).logp;
      const v2 = lm.wordSegment(s).logp;
      const vo = scObj.score(key);
      const vw = scWf.score(key);
      t1s.push(v1);
      if (v1 > t1) { t1 = v1; a1 = s; }
      if (v2 > t2) { t2 = v2; a2 = s; }
      if (vo > obj) { obj = vo; aObj = s; }
      if (vw > wf) wf = vw;
    }
  }
  t1s.sort((x, y) => y - x);
  let t3 = 0;
  for (let i = 0; i < 10; i++) t3 += t1s[i];
  t3 /= 10;
  const r = { pins, t1, t2, t3, obj, wf, a1, a2, aObj };
  cache.set(pins, r);
  return r;
}

const STATS = ['t1', 't2', 't3', 'obj', 'wf'];

function pinsOf(keyMap) { return SLOTS.map((s) => keyMap[s]).join(''); }

function arrangements(letters) {
  const out = new Set();
  const rec = (pre, rest) => {
    if (!rest.length) { out.add(pre); return; }
    for (let i = 0; i < rest.length; i++) rec(pre + rest[i], rest.slice(0, i) + rest.slice(i + 1));
  };
  rec('', letters);
  return [...out];
}

function upperP(real, vals) {
  let ge = 0;
  for (const v of vals) if (v >= real - 1e-9) ge++;
  return { ge, n: vals.length, p: (ge + 1) / (vals.length + 1) };
}

function permNull(keyMap, n, rng) {
  const letters = Object.values(keyMap);
  const out = [];
  for (let d = 0; d < n; d++) {
    // six distinct positions of the key's letter multiset (equivalent to reading six symbols of a permuted key)
    const idx = letters.map((_, i) => i);
    for (let k = 0; k < 6; k++) { const j = k + Math.floor(rng() * (idx.length - k)); const t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
    out.push(idx.slice(0, 6).map((i) => letters[i]).join(''));
  }
  return out;
}

function kde(vals, x) {
  const v = vals.filter(Number.isFinite);
  const n = v.length;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const sorted = [...v].sort((a, b) => a - b);
  const iqr = sorted[Math.floor(0.75 * (n - 1))] - sorted[Math.floor(0.25 * (n - 1))];
  const h = 0.9 * Math.min(sd, iqr / 1.34) * Math.pow(n, -0.2);
  let s = 0;
  for (const y of v) { const z = (x - y) / h; s += Math.exp(-0.5 * z * z); }
  return { density: s / (n * h * Math.sqrt(2 * Math.PI)), h, mean, sd };
}

function main() {
  const o = args();
  const nNull = +(o.null || 3000);
  const seed = +(o.seed || 777);
  const t0 = Date.now();
  const k340 = loadKey('z340');
  const k408 = loadKey('z408');
  const real340 = pinsOf(k340);
  const real408 = pinsOf(k408);
  const out = { tool: 'tools/lead_skeptic_check.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '), text: TEXT };

  // 1. real
  out.real = { z340: stats(real340), z408: stats(real408) };
  console.log('real z340', JSON.stringify(out.real.z340));
  console.log('real z408', JSON.stringify(out.real.z408));

  // 2. arrangements
  out.arrangements = {};
  for (const [name, real] of [['z340', real340], ['z408', real408]]) {
    const arr = arrangements(real);
    const rows = arr.map(stats);
    const res = { n: arr.length };
    for (const st of STATS) {
      const better = rows.filter((r) => r[st] > out.real[name][st] + 1e-9).length;
      const ties = rows.filter((r) => Math.abs(r[st] - out.real[name][st]) <= 1e-9).length;
      res[st] = { rank: better + 1, ties, top3: [...rows].sort((a, b) => b[st] - a[st]).slice(0, 3).map((r) => [r.pins, +r[st].toFixed(3)]) };
    }
    out.arrangements[name] = res;
    console.log('arrangements', name, JSON.stringify(res));
  }
  console.log('time', (Date.now() - t0) / 1000);

  // 3. nulls
  out.nulls = {};
  const nullVals = {};
  for (const [name, km, real, sd] of [['z340', k340, real340, seed], ['z408', k408, real408, seed + 1]]) {
    const rng = mulberry32(sd);
    const draws = permNull(km, nNull, rng);
    const rows = draws.map(stats);
    const res = { n: nNull, seed: sd };
    nullVals[name] = {};
    for (const st of STATS) {
      const vals = rows.map((r) => r[st]);
      nullVals[name][st] = vals;
      res[st] = upperP(out.real[name][st], vals);
    }
    out.nulls[name] = res;
    console.log('null', name, JSON.stringify(res), 'time', (Date.now() - t0) / 1000);
  }

  // 4. H1 check from word-aligned dictionary fits
  if (o.fits) {
    const lines = fs.readFileSync(o.fits, 'utf8').split(/\r?\n/).slice(1).filter((l) => l);
    const fits = lines.map((l) => { const f = l.split('\t'); return { pt: f[0], wl: +f[1], words: f[2], unk: f[3] }; }).filter((f) => f.unk === '0' && f.pt.length === 13);
    fits.sort((a, b) => b.wl - a.wl);
    const multiset = Object.values(k340).join('');
    const realizable = (pins) => { const pool = multiset.split(''); for (const ch of pins) { const i = pool.indexOf(ch); if (i < 0) return false; pool.splice(i, 1); } return true; };
    const pos = { A: 0, E: 1, N: 2, z: 3, K: 5, M: 7 };
    const pinFromPt = (pt) => SLOTS.map((s) => pt[pos[s]]).join('');
    const rng = mulberry32(seed + 2);
    const nTop = +(o.h1top || 1000), nS = +(o.h1sample || 1000);
    const sets = { top: fits.slice(0, nTop) };
    const samp = [];
    for (let i = 0; i < nS; i++) samp.push(fits[Math.floor(rng() * fits.length)]);
    sets.sample = samp;
    out.h1 = { fitsFile: o.fits, nFits: fits.length };
    for (const [nm, set] of Object.entries(sets)) {
      const rows = set.map((f) => {
        const pins = pinFromPt(f.pt);
        const r = stats(pins);
        return { pt: f.pt, words: f.words, pins, realizable: realizable(pins), ownWord: lm.wordSegment(f.pt).logp, own6: lm.ngramScore(f.pt, 6).logp, t1: r.t1, t2: r.t2, a2: r.a2 };
      });
      const res = { n: rows.length, realizableShare: rows.filter((r) => r.realizable).length / rows.length };
      for (const st of ['t1', 't2']) {
        const vals = rows.map((r) => r[st]);
        const obs = out.real.z340[st];
        const below = vals.filter((v) => v <= obs + 1e-9).length / vals.length;
        const f1 = kde(vals, obs), f0 = kde(nullVals.z340[st], obs);
        res[st] = { observed: obs, h1Mean: f1.mean, h1Sd: f1.sd, h1ShareAtOrBelowObserved: below, nullMean: f0.mean, nullSd: f0.sd, f1: f1.density, f0: f0.density, lr: f1.density / f0.density };
      }
      // how often the H1 argmax (T2) is the true phrase itself
      res.t2ArgmaxIsTruth = rows.filter((r) => r.a2 === r.pt).length / rows.length;
      res.examples = rows.slice(0, 5).map((r) => [r.words, +r.t2.toFixed(2)]);
      out.h1[nm] = res;
      console.log('h1', nm, JSON.stringify(res), 'time', (Date.now() - t0) / 1000);
    }
  }

  out.seconds = (Date.now() - t0) / 1000;
  const f = path.isAbsolute(o.out) ? o.out : path.join(ROOT, o.out);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  if (o.dump) {
    const d = {};
    for (const nm of Object.keys(nullVals)) for (const st of STATS) d[`${nm}_${st}`] = nullVals[nm][st];
    fs.writeFileSync(f.replace(/\.json$/, '_nulls.json'), JSON.stringify(d));
  }
  console.log('done', out.seconds);
}

main();
