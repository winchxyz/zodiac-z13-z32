#!/usr/bin/env node
'use strict';
/**
 * results/z32search/review/review_heldout_check.js - independent recount of held-out English windows
 * that satisfy Z32's homophonic equalities, written without tools/z32search_lib.js window code.
 * Uses tools/textsample.js sentences() (held-out documents only).  Single thread, a few seconds.
 *   node results/z32search/review/review_heldout_check.js
 */
const fs = require('fs');
const path = require('path');
const TS = require('../../../tools/textsample');
const { makeRng } = require('../../../tools/solvercore');

const z32 = fs.readFileSync(path.join(__dirname, '../../../data/ciphers/variants/z32.canonical.txt'), 'utf8').trim();
const pairs = [];
for (let i = 0; i < z32.length; i++) for (let j = i + 1; j < z32.length; j++) if (z32[i] === z32[j]) pairs.push([i, j]);

function windows(stream) {
  const S = TS.sentences();
  const groups = [];
  if (stream) {
    for (const s of S) {
      if (!groups.length || groups[groups.length - 1].doc !== s.doc) groups.push({ doc: s.doc, words: [] });
      groups[groups.length - 1].words.push(...s.words);
    }
  } else for (const s of S) groups.push({ doc: s.doc, words: s.words });
  const set = new Set();
  let total = 0;
  for (const g of groups) {
    const W = g.words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''));
    for (let a = 0; a < W.length; a++) {
      let s = '';
      for (let b = a; b < W.length && s.length < 32; b++) s += W[b];
      if (s.length === 32) { total++; set.add(s); }
    }
  }
  return { total, list: [...set] };
}
const fits = (s, P) => P.every(([i, j]) => s[i] === s[j]);
const out = { z32: z32, pairs };
for (const stream of [true, false]) {
  const { total, list } = windows(stream);
  const hit = list.filter((s) => fits(s, P0()));
  function P0() { return pairs; }
  // null: uniformly random 3 disjoint pairs
  const rng = makeRng(123, 9);
  const nullC = [];
  for (let t = 0; t < 1000; t++) {
    const used = new Set(); const P = [];
    while (P.length < 3) { const i = rng.int(32), j = rng.int(32); if (i === j || used.has(i) || used.has(j)) continue; used.add(i); used.add(j); P.push([i, j]); }
    nullC.push(list.filter((s) => fits(s, P)).length);
  }
  nullC.sort((a, b) => a - b);
  const ge = nullC.filter((c) => c >= hit.length).length / nullC.length;
  const key = stream ? 'stream' : 'sentence';
  out[key] = { windowsTotal: total, distinct: list.length, fitsZ32: hit.length, oneIn: list.length / hit.length, nullMedian: nullC[500], null5: nullC[50], null95: nullC[950], PnullGe: ge, examples: hit.slice(0, 25) };
  console.log(key, JSON.stringify(Object.assign({}, out[key], { examples: undefined })));
}
fs.writeFileSync(path.join(__dirname, 'heldout_check.json'), JSON.stringify(out, null, 1));
