#!/usr/bin/env node
'use strict';
/**
 * results/z32search/review/review_power_jobs.js - positive control for the z32search crib test.
 * The attacker never checked that the crib test can see a crib that IS in the plaintext.  Here:
 * held-out 32-letter English phrases (sentence starts, tools/z32search_lib.js heldoutWindows) that contain
 * THREE as a whole word are turned into Z32-shaped ciphers exactly as the attacker's nulls were
 * (choosePairs + nullCipher: 29 symbols, 3 repeated pairs).  Jobs: the main-config free search (80 restarts x
 * 150k, seed 101, as nullfree) and THREE@any at pass-1 effort (one restart per placement, seeds 3 and 31).
 * If the crib cost on these "true crib" ciphers is not clearly below the cost on the attacker's nulls
 * (cribvar), the crib-vs-null test has no power.
 *   node results/z32search/review/review_power_jobs.js -> review/jobs/power.json
 */
const fs = require('fs');
const path = require('path');
const Z = require('../../../tools/z32search_lib');
const A = require('../../../tools/anneal');

const W = 'THREE';
const rng = Z.makeRng(4711, 99);
const wins = Z.heldoutWindows(32, { sentenceStartOnly: true }).filter((w) => w.words.toUpperCase().split(/\s+/).includes(W));
const picks = [];
const used = new Set();
while (picks.length < 6 && used.size < wins.length) {
  const i = rng.int(wins.length);
  if (used.has(i)) continue;
  used.add(i);
  const ph = wins[i];
  const pairs = Z.choosePairs(ph.letters, rng);
  if (!pairs) continue;
  picks.push({ id: `pos${String(picks.length).padStart(2, '0')}`, letters: ph.letters, words: ph.words, pairs, truePos: ph.letters.indexOf(W), cipher: Z.nullCipher(32, pairs, rng) });
}
const pinSetCount = (cipher) => { const { def } = A.makeProblem(Object.assign({}, A.DEFAULTS, { cipher, crib: [`${W}@any`], mode: 'homophonic' })); return def.pinSets.length; };
const jobs = [];
for (const p of picks) jobs.push({ id: `${p.id}_main100`, group: 'posfree', cipher: p.cipher, truth: p.letters, meta: { words: p.words, pairs: p.pairs }, mode: 'homophonic', n: '5', wordweight: 1, entropy: 0.5, perRestart: 3, restarts: 80, iters: 150000, seed: 101, top: 20 });
for (const seed of [3, 31]) for (const p of picks) jobs.push({ id: `pos_${W}_${p.id}_s${seed}`, group: 'poscrib', cipher: p.cipher, truth: p.letters, meta: { word: W, cipher: p.id, truePos: p.truePos, placements: pinSetCount(p.cipher), seed }, crib: [`${W}@any`], restarts: pinSetCount(p.cipher), seed, mode: 'homophonic', n: '5', wordweight: 1, entropy: 0.5, perRestart: 1, iters: 120000, top: 5 });
fs.mkdirSync(path.join(__dirname, 'jobs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'jobs', 'power.json'), JSON.stringify({ defaults: {}, picks, jobs }, null, 1));
console.log(`${wins.length} held-out sentence-start windows contain ${W}; picked ${picks.length}; ${jobs.length} jobs`);
for (const p of picks) console.log(p.id, p.truePos, p.words);
