#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_heldout.js - how many REAL English 32-letter phrases fit Z32?
 *
 * Takes every word-aligned 32-letter window inside one sentence of the held-out Project Gutenberg
 * documents (never used to train the n-gram tables; tools/textsample.js), and counts the windows that
 * satisfy Z32's homophonic equalities (p0=p25, p1=p31, p5=p13 in written order) and the equalities of
 * every read order in tools/z32search_lib.js readOrders(), plus the triangles_merged variant.  The same
 * count for uniformly random sets of 3 disjoint position pairs is the null: a reading order whose
 * pattern is unusually English-compatible would stand out.  Fitting phrases are rescored with the
 * reference metrics (5-gram joint sum, word-segmentation log10 P) for comparison with solver output.
 *
 *   node tools/z32search_heldout.js [--null 4000] [--seed 5] [--out results/z32search/heldout/heldout.json]
 */
const fs = require('fs');
const path = require('path');
const Z = require('./z32search_lib');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const NNULL = +opt('null', 4000);
const SEED = +opt('seed', 5);
const OUT = opt('out', path.join(Z.ROOT, 'results', 'z32search', 'heldout', 'heldout.json'));

const t0 = Date.now();
const all = Z.heldoutWindows(32, { stream: !args.includes('--sentences') });
// dedupe identical letter strings
const seen = new Set();
const W = [];
for (const w of all) { if (seen.has(w.letters)) continue; seen.add(w.letters); W.push(w); }
const N = W.length;
const words32 = Math.ceil(N / 32);
// equality bitsets for every pair (i<j)
const pairIdx = (i, j) => i * 32 + j;
const bits = new Map();
for (let i = 0; i < 32; i++) for (let j = i + 1; j < 32; j++) bits.set(pairIdx(i, j), new Uint32Array(words32));
for (let w = 0; w < N; w++) {
  const s = W[w].letters;
  const bw = w >>> 5, bm = (1 << (w & 31)) >>> 0;
  for (let i = 0; i < 32; i++) for (let j = i + 1; j < 32; j++) if (s.charCodeAt(i) === s.charCodeAt(j)) bits.get(pairIdx(i, j))[bw] |= bm;
}
function popcount(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }
function countFits(pairs, list = false) {
  const bs = pairs.map(([i, j]) => bits.get(pairIdx(Math.min(i, j), Math.max(i, j))));
  let c = 0;
  const idx = [];
  for (let k = 0; k < words32; k++) {
    let x = 0xffffffff;
    for (const b of bs) x &= b[k];
    x >>>= 0;
    if (x) { c += popcount(x); if (list) for (let t = 0; t < 32; t++) if (x & (1 << t)) idx.push(k * 32 + t); }
  }
  return list ? { count: c, idx } : c;
}
// single-pair equality rate (independent-letter baseline)
let pairRate = 0;
for (const b of bits.values()) { let c = 0; for (const x of b) c += popcount(x); pairRate += c / N; }
pairRate /= bits.size;

// null distribution: uniformly random 3 disjoint pairs
const rng = Z.makeRng(SEED, 77);
const nullCounts = [];
for (let t = 0; t < NNULL; t++) nullCounts.push(countFits(Z.randomPairs(rng)));
nullCounts.sort((a, b) => a - b);
const pctl = (c) => {
  let lo = 0; while (lo < nullCounts.length && nullCounts[lo] < c) lo++;
  let hi = lo; while (hi < nullCounts.length && nullCounts[hi] <= c) hi++;
  return { below: lo / nullCounts.length, atOrAbove: (nullCounts.length - lo) / nullCounts.length };
};

const z32 = Z.z32Text('canonical');
const res = {
  tool: 'tools/z32search_heldout.js', created: new Date().toISOString(),
  corpus: { windowsTotal: all.length, distinctWindows: N, note: args.includes('--sentences') ? 'word-aligned 32-letter windows inside one sentence of the held-out documents (manifest row % 50 == 25)' : 'word-aligned 32-letter windows over the kept sentences of each held-out document joined in order (windows may cross sentence ends; manifest row % 50 == 25)' },
  singlePairEqualityRate: pairRate,
  independentExpectation3Pairs: pairRate ** 3,
  null: { patterns: NNULL, kind: 'uniformly random 3 disjoint position pairs', quantiles: Z.quantiles(nullCounts), meanSd: Z.meanSd(nullCounts) },
  orders: [], variants: {},
};
for (const o of Z.readOrders()) {
  const pairs = Z.pairsOf(Z.applyOrder(z32, o.order));
  const c = countFits(pairs);
  res.orders.push({ id: o.id, family: o.family, pairs, fits: c, rate: c / N, oneIn: c ? N / c : null, nullPercentile: pctl(c) });
}
res.orders.sort((a, b) => b.fits - a.fits);
for (const v of ['canonical', 'triangles_merged']) {
  const pairs = Z.pairsOf(Z.z32Text(v));
  const r = countFits(pairs, true);
  const fits = r.idx.map((k) => { const w = W[k]; const sc = Z.rescore(w.letters); return { letters: w.letters, phrase: w.words, doc: w.doc, ng5: sc.ng5, wordLogp: sc.wordLogp, unknown: sc.unknown }; });
  fits.sort((a, b) => b.wordLogp - a.wordLogp);
  res.variants[v] = { pairs, fits: r.count, rate: r.count / N, oneIn: r.count ? N / r.count : null, nullPercentile: pctl(r.count), bestByWordLogp: fits.slice(0, 40), allFitScoreQuantiles: { wordLogp: Z.quantiles(fits.map((f) => f.wordLogp)), ng5: Z.quantiles(fits.map((f) => f.ng5)) } };
}
res.timeSeconds = (Date.now() - t0) / 1000;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(`held-out windows ${all.length} (distinct ${N}); single-pair equality rate ${pairRate.toFixed(4)}; independent 3-pair expectation 1 in ${(1 / pairRate ** 3).toFixed(0)}`);
console.log(`null (${NNULL} random 3-pair patterns): fits quantiles ${JSON.stringify(res.null.quantiles)}`);
for (const v of Object.keys(res.variants)) console.log(`Z32 ${v}: ${res.variants[v].fits} fits (1 in ${res.variants[v].oneIn && res.variants[v].oneIn.toFixed(0)}), null P(>=) = ${res.variants[v].nullPercentile.atOrAbove.toFixed(3)}`);
for (const o of res.orders) console.log(`${o.id.padEnd(22)} fits ${String(o.fits).padStart(5)}  1 in ${o.oneIn ? o.oneIn.toFixed(0).padStart(6) : '   inf'}  null P(>=) ${o.nullPercentile.atOrAbove.toFixed(3)}  ${JSON.stringify(o.pairs)}`);
console.log(`wrote ${path.relative(Z.ROOT, OUT)} in ${res.timeSeconds.toFixed(1)} s`);
