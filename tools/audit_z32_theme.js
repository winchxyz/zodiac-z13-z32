'use strict';
/**
 * tools/audit_z32_theme.js - on-theme null for the "radians and inches" Z32 claims.
 *
 * A small grammar of map-reading sentences, the kind the published Z32 claims use
 * (DMW / Stampher, Grinell, InStepWithTheStars, Cragle, Foxon):
 *
 *   G1 X G2 Y G3      {X, Y} = {ANGLE, DISTANCE} in either order
 *   ANGLE    = QTY AUNIT | AUNIT QTY        AUNIT in RADIAN RADIANS RAD RADS
 *   DISTANCE = QTY DUNIT | DUNIT QTY        DUNIT in INCH INCHES IN INS
 *   QTY      = NUM | NUM AND FRAC | NUM AND A HALF | NUM POINT NUM | FRAC
 *   NUM      = ZERO .. TWELVE;  FRAC = ONE HALF, ONE QUARTER, THREE QUARTERS, ONE THIRD, TWO THIRDS,
 *              ONE EIGHTH, THREE EIGHTHS, FIVE EIGHTHS, SEVEN EIGHTHS
 *   G1..G3   = glue words (list GLUE below), at most 3 in total, at most 2 per slot
 *
 * The number of token sequences with exactly 32 letters is computed exactly by
 * counting; the share consistent with each Z32 variant is estimated by uniform
 * Monte Carlo sampling over those sequences (binomial 95% interval).  Distinct
 * consistent strings found are scored with lm.wordSegment.  Every published claim is
 * also parsed against the grammar to show whether it belongs to the family.
 *
 *   node tools/audit_z32_theme.js [--samples 3000000] [--seed 32] [--out results/audit/z32_theme.json]
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');
const lm = require('./lm');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SAMPLES = +opt('samples', 3000000);
const SEED = +opt('seed', 32);
const OUT = opt('out', path.join(ROOT, 'results/audit/z32_theme.json'));
const LEN = 32;

const NUM = 'ZERO ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE'.split(' ');
const FRAC = ['ONE HALF', 'ONE QUARTER', 'THREE QUARTERS', 'ONE THIRD', 'TWO THIRDS', 'ONE EIGHTH', 'THREE EIGHTHS', 'FIVE EIGHTHS', 'SEVEN EIGHTHS'];
const AUNIT = ['RADIAN', 'RADIANS', 'RAD', 'RADS'];
const DUNIT = ['INCH', 'INCHES', 'IN', 'INS'];
const GLUE = ('AND ALONG THE FROM AT IN OF ON BY GO DIG IS ESTIMATE MOUNT MT DIABLO NORTH SOUTH EAST WEST MAG MAGNETIC ' +
  'TRUE PEAK BOMB HERE THEN TO SET FIND RADIAL LINE CLOCKWISE OUT I A AREA SITE SPOT').split(' ');

const qty = [];
for (const n of NUM) qty.push(n);
for (const n of NUM) for (const f of FRAC) qty.push(`${n} AND ${f}`);
for (const n of NUM) qty.push(`${n} AND A HALF`);
for (const n of NUM) for (const m of NUM) qty.push(`${n} POINT ${m}`);
for (const f of FRAC) qty.push(f);
const phr = (units) => { const o = []; for (const q of qty) for (const u of units) { o.push(`${q} ${u}`); o.push(`${u} ${q}`); } return o; };
const ANG = phr(AUNIT), DIS = phr(DUNIT);
const L = (s) => s.replace(/ /g, '').length;

// glue configurations: [g1, g2, g3] word arrays, total <= 3 words, <= 2 per slot
const glueByLen = new Map();
function addGlue(cfg) { const n = cfg.flat().join('').length; if (!glueByLen.has(n)) glueByLen.set(n, []); glueByLen.get(n).push(cfg); }
const S = [[[]], GLUE.map((a) => [a]), []];
for (const a of GLUE) for (const b of GLUE) S[2].push([a, b]);
for (let n1 = 0; n1 <= 2; n1++) for (let n2 = 0; n2 <= 2; n2++) for (let n3 = 0; n3 <= 2; n3++) {
  if (n1 + n2 + n3 > 3) continue;
  for (const s1 of S[n1]) for (const s2 of S[n2]) for (const s3 of S[n3]) addGlue([s1, s2, s3]);
}
const byLen = (arr) => { const m = new Map(); for (const s of arr) { const n = L(s); if (!m.has(n)) m.set(n, []); m.get(n).push(s); } return m; };
const ANGL = byLen(ANG), DISL = byLen(DIS);

// exact count of token sequences of LEN letters, and a table for proportional sampling
const cells = [];
let total = 0;
for (const [la, A] of ANGL) for (const [ld, D] of DISL) {
  const lg = LEN - la - ld;
  const G = glueByLen.get(lg);
  if (!G) continue;
  const w = 2 * A.length * D.length * G.length;
  total += w;
  cells.push({ la, ld, lg, w, cum: total });
}

const variants = {
  'z32.canonical': C.loadCipher(path.join(ROOT, 'data/ciphers/variants/z32.canonical.txt')).text,
  'z32.triangles_merged': C.loadCipher(path.join(ROOT, 'data/ciphers/variants/z32.triangles_merged.txt')).text,
};
const rng = makeRng(SEED, 0x7468656d);
const hits = {}; const found = {};
for (const k of Object.keys(variants)) { hits[k] = 0; found[k] = new Map(); }
const t0 = Date.now();
for (let s = 0; s < SAMPLES; s++) {
  const r = rng.next() * total;
  let lo = 0, hi = cells.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cells[mid].cum > r) hi = mid; else lo = mid + 1; }
  const c = cells[lo];
  const A = ANGL.get(c.la), D = DISL.get(c.ld), G = glueByLen.get(c.lg);
  const a = A[rng.int(A.length)], d = D[rng.int(D.length)], g = G[rng.int(G.length)];
  const [x, y] = rng.int(2) ? [a, d] : [d, a];
  const words = [...g[0], x, ...g[1], y, ...g[2]].join(' ');
  const letters = words.replace(/ /g, '');
  for (const [k, ct] of Object.entries(variants)) {
    if (C.consistent(ct, letters, 'homophonic')) { hits[k]++; if (!found[k].has(letters)) found[k].set(letters, words); }
  }
}

function wilson(k, n) { const z = 1.96, p = k / n, d = 1 + z * z / n; const c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [c - h, c + h]; }
const out = {
  tool: 'tools/audit_z32_theme.js', created: new Date().toISOString(), seed: SEED, samples: SAMPLES,
  grammar: { NUM, FRAC, AUNIT, DUNIT, GLUE, qtyForms: qty.length, anglePhrases: ANG.length, distancePhrases: DIS.length },
  tokenSequencesOfLength32: total,
  note: 'counts are token sequences; a few map to the same letter string, so distinct strings are slightly fewer',
  variants: {},
};
for (const [k, ct] of Object.entries(variants)) {
  const n = hits[k], rate = n / SAMPLES, ci = wilson(n, SAMPLES);
  const rows = [...found[k]].map(([t, w]) => ({ t, w, lp: lm.wordSegment(t).logp })).sort((p, q) => q.lp - p.lp);
  out.variants[k] = {
    cipher: ct, hits: n, rate, rate95: ci,
    estimatedConsistentSequences: Math.round(rate * total),
    estimatedConsistent95: [Math.round(ci[0] * total), Math.round(ci[1] * total)],
    distinctConsistentSampled: rows.length,
    logpSortedDesc: rows.map((r) => +r.lp.toFixed(3)),
    best: rows.slice(0, 25).map((r) => ({ words: r.w, logp: +r.lp.toFixed(2) })),
    randomExamples: rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / 15)) === 0).slice(0, 15).map((r) => ({ words: r.w, logp: +r.lp.toFixed(2) })),
  };
}
// which published claims are inside the grammar (exact token sequence check)
const claims = {
  DMW_Stampher: 'IN THREE AND THREE EIGHTHS RADIANS TEN',
  Grinell2020_InStep: 'ESTIMATE FOUR RADIANS AND FIVE INCHES',
  Cragle: 'THREE RADIANS FROM MOUNT AREA TWO INCH',
  Foxon_a: 'TWELVE INCHES ALONG THE THREE RADIANS',
  Foxon_b: 'THREE RADIANS AND TWELVE INCHES ALONG',
};
const angSet = new Set(ANG), disSet = new Set(DIS), glueSet = new Set(GLUE);
function inGrammar(sent) {
  const w = sent.split(' ');
  // try every split into g1 X g2 Y g3
  for (let i = 0; i <= w.length; i++) for (let j = i + 1; j <= w.length; j++) for (let k = j; k <= w.length; k++) for (let l = k + 1; l <= w.length; l++) {
    const g1 = w.slice(0, i), X = w.slice(i, j).join(' '), g2 = w.slice(j, k), Y = w.slice(k, l).join(' '), g3 = w.slice(l);
    if (g1.length > 2 || g2.length > 2 || g3.length > 2 || g1.length + g2.length + g3.length > 3) continue;
    if (![...g1, ...g2, ...g3].every((x) => glueSet.has(x))) continue;
    if ((angSet.has(X) && disSet.has(Y)) || (disSet.has(X) && angSet.has(Y))) return { g1, X, g2, Y, g3 };
  }
  return null;
}
out.claims = {};
for (const [k, s] of Object.entries(claims)) {
  const letters = s.replace(/ /g, '');
  out.claims[k] = { sentence: s, letters: letters.length, inGrammar: inGrammar(s), consistentCanonical: C.consistent(variants['z32.canonical'], letters, 'homophonic'), logp: +lm.wordSegment(letters).logp.toFixed(3) };
}
out.seconds = (Date.now() - t0) / 1000;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('token sequences of 32 letters:', total.toExponential(4));
for (const [k, v] of Object.entries(out.variants)) console.log(k, 'hits', v.hits, '/', SAMPLES, 'rate', v.rate.toExponential(3), 'est consistent', v.estimatedConsistentSequences.toExponential(3), v.estimatedConsistent95.map((x) => x.toExponential(2)).join('..'), 'distinct sampled', v.distinctConsistentSampled);
for (const [k, v] of Object.entries(out.claims)) console.log(k, v.inGrammar ? 'in grammar' : 'NOT in grammar', 'consistent', v.consistentCanonical, 'logp', v.logp);
console.log('best:', out.variants['z32.canonical'].best.slice(0, 8).map((b) => `${b.words} (${b.logp})`).join(' | '));
console.log('seconds', out.seconds);
