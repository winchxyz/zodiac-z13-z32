#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_pairfeas.js - how many placements of a crib pair (e.g. RADIANS + INCHES) are
 * consistent with Z32 under homophonic substitution, versus random 3-pair patterns (the null).
 * Uses tools/anneal.js makeProblem (the same feasibility rule the solver uses for WORD@any cribs).
 *   node tools/z32search_pairfeas.js [--null 300] -> results/z32search/pairs/feasibility.json
 */
const fs = require('fs');
const path = require('path');
const A = require('./anneal');
const Z = require('./z32search_lib');

const args = process.argv.slice(2);
const k = args.indexOf('--null');
const NN = k >= 0 ? +args[k + 1] : 300;
const PAIRS = [['RADIANS', 'INCHES'], ['RADIAN', 'INCH'], ['MOUNT', 'DIABLO'], ['HOUSE', 'GARDEN'], ['WATER', 'STREET'], ['PEOPLE', 'TOWN']];
const count = (cipherText, words) => {
  try {
    const { def } = A.makeProblem(Object.assign({}, A.DEFAULTS, { cipher: { id: 'x', text: cipherText, rows: [cipherText], readOrder: null, plaintext: null }, crib: words.map((w) => `${w}@any`), mode: 'homophonic' }));
    return def.pinSets ? def.pinSets.length : 0;
  } catch (e) { return 0; }
};
const z32 = Z.z32Text('canonical');
const rng = Z.makeRng(31, 7);
const nullTexts = [];
for (let t = 0; t < NN; t++) nullTexts.push(Z.nullCipher(32, Z.randomPairs(rng), rng));
const res = { tool: 'tools/z32search_pairfeas.js', created: new Date().toISOString(), nullPatterns: NN, pairs: [] };
for (const p of PAIRS) {
  const z = count(z32, p);
  const nulls = nullTexts.map((t) => count(t, p));
  const row = { words: p, z32: z, nullQuantiles: Z.quantiles(nulls), PnullGe: nulls.filter((x) => x >= z).length / NN };
  res.pairs.push(row);
  console.log(`${p.join('+').padEnd(16)} Z32 ${z}  null ${JSON.stringify(row.nullQuantiles)}  P(null>=Z32) ${row.PnullGe.toFixed(3)}`);
}
const out = path.join(Z.ROOT, 'results', 'z32search', 'pairs', 'feasibility.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1));
