#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_typical.js - rough size of the space of English 32-letter texts that fit Z32.
 *
 * For a sample of held-out 32-letter word-aligned windows, the mean log10 P(text) under the 5-gram
 * letter model (Markov form, lm.ngramScore(..., 5).logp) and under the word model (lm.wordSegment)
 * estimates the entropy H of 32-letter English; 10^H is the size of the "typical set".  Times the
 * measured fraction of held-out windows that satisfy Z32's equalities (results/z32search/heldout) this
 * gives an order-of-magnitude count of English texts consistent with Z32.  A rough estimate, not a bound.
 *   node tools/z32search_typical.js [--sample 20000]
 */
const fs = require('fs');
const path = require('path');
const Z = require('./z32search_lib');
const lm = require('./lm');

const args = process.argv.slice(2);
const i = args.indexOf('--sample');
const NS = i >= 0 ? +args[i + 1] : 20000;
const W = Z.heldoutWindows(32, { stream: true });
const rng = Z.makeRng(11, 5);
let s5 = 0, sw = 0, n = 0;
for (let k = 0; k < NS; k++) {
  const w = W[rng.int(W.length)];
  s5 += lm.ngramScore(w.letters, 5).logp;
  sw += lm.wordSegment(w.letters).logp;
  n++;
}
const held = JSON.parse(fs.readFileSync(path.join(Z.ROOT, 'results', 'z32search', 'heldout', 'heldout.json'), 'utf8'));
const frac = held.variants.canonical.fits / held.corpus.distinctWindows;
const H5 = -s5 / n, HW = -sw / n;
const res = {
  tool: 'tools/z32search_typical.js', created: new Date().toISOString(), sample: n,
  meanLog10P_5gram: -H5, bitsPerLetter_5gram: H5 * Math.log2(10) / 32,
  meanLog10P_words: -HW, bitsPerLetter_words: HW * Math.log2(10) / 32,
  fractionFittingZ32: frac,
  log10TypicalSet_5gram: H5, log10TypicalSet_words: HW,
  log10EnglishTextsFittingZ32_5gram: H5 + Math.log10(frac), log10EnglishTextsFittingZ32_words: HW + Math.log10(frac),
  note: 'order of magnitude only: 10^H is the size of the typical set of 32-letter texts under each model; real English is more constrained than either model, so treat these as rough upper-range figures',
};
const out = path.join(Z.ROOT, 'results', 'z32search', 'heldout', 'typical.json');
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
