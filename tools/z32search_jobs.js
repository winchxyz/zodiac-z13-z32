#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_jobs.js - writes the job files for tools/z32search_solve.js.
 *
 *   node tools/z32search_jobs.js free      -> results/z32search/jobs/free.json      (config grid on Z32 + variants)
 *   node tools/z32search_jobs.js nullfree  -> results/z32search/jobs/nullfree.json  (main config on Z32-shaped null ciphers)
 *   node tools/z32search_jobs.js orders    -> results/z32search/jobs/orders.json    (main config on every read order)
 *   node tools/z32search_jobs.js ordernull -> results/z32search/jobs/ordernull.json (null ciphers under selected read orders)
 *
 * Main config: homophonic, n=5, wordweight 1 (fast unigram word term in the inner loop), entropy 0.5,
 * auto iterations (328,098 for Z32), keep 3 keys per restart.
 */
const fs = require('fs');
const path = require('path');
const Z = require('./z32search_lib');

const OUT = path.join(Z.ROOT, 'results', 'z32search', 'jobs');
fs.mkdirSync(OUT, { recursive: true });
const CANON = 'data/ciphers/variants/z32.canonical.txt';
const MAIN = { mode: 'homophonic', n: '5', wordweight: 1, entropy: 0.5, perRestart: 3 };

function write(name, obj) {
  const f = path.join(OUT, name + '.json');
  fs.writeFileSync(f, JSON.stringify(obj, null, 1));
  console.log(`wrote ${path.relative(Z.ROOT, f)}: ${obj.jobs.length} jobs, ${obj.jobs.reduce((a, j) => a + (j.restarts || obj.defaults.restarts || 0), 0)} restarts`);
}

/* ------------------------------------------------------------ cribs */
const CRIBS = {
  units: ['RADIAN', 'RADIANS', 'INCH', 'INCHES'],
  numbers: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN',
    'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY', 'HUNDRED',
    'HALF', 'QUARTER', 'POINT', 'EIGHTHS'],
  directions: ['DEGREES', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'MAGNETIC', 'CLOCKWISE', 'ALONG'],
  theme: ['BOMB', 'SCHOOL', 'BUS', 'BUSS', 'BURIED', 'DIG', 'PARK', 'ROAD', 'MILES', 'FEET', 'YARDS', 'MOUNT', 'DIABLO', 'LABOR', 'DAY', 'FALL',
    'SUMMIT', 'PEAK', 'CODE', 'MAP', 'ESTIMATE'],
  places: ['CONCORD', 'CLAYTON', 'DANVILLE', 'VALLEJO', 'BENICIA', 'MARTINEZ', 'OAKLAND', 'BERKELEY', 'LIVERMORE', 'PLEASANTON', 'ANTIOCH',
    'ORINDA', 'LAFAYETTE', 'ALAMO', 'SUNOL', 'NAPA', 'PRESIDIO', 'RICHMOND', 'HAYWARD', 'BERRYESSA', 'SANRAMON', 'WALNUTCREEK', 'SANFRANCISCO'],
};
const KEY_CRIBS = ['RADIAN', 'RADIANS', 'INCH', 'INCHES', 'DIABLO', 'MOUNT', 'BOMB', 'MAGNETIC', 'NORTH', 'DEGREES', 'THREE', 'FOUR', 'FIVE', 'BURIED'];
const A = require('./anneal');
function pinSetCount(cipher, cribs) {
  const { def } = A.makeProblem(Object.assign({}, A.DEFAULTS, { cipher, crib: cribs, mode: 'homophonic' }));
  return def.pinSets ? def.pinSets.length : 1;
}
const CRIB_OPTS = { mode: 'homophonic', n: '5', wordweight: 1, entropy: 0.5, perRestart: 1, iters: 120000 };

const what = process.argv[2];
if (what === 'cribs') {
  const jobs = [];
  for (const [cat, words] of Object.entries(CRIBS)) for (const w of words) {
    const np = pinSetCount(CANON, [`${w}@any`]);
    jobs.push({ id: `crib_${w}`, group: 'crib', meta: { word: w, category: cat, placements: np }, cipher: CANON, crib: [`${w}@any`], restarts: np, seed: 3 });
  }
  write('cribs', { defaults: Object.assign({}, CRIB_OPTS, { top: 40 }), jobs, categories: CRIBS });
} else if (what === 'cribnull') {
  const nulls = Z.nullSet(12, 2032).slice(0, +(process.argv[3] || 5));
  const jobs = [];
  for (const nl of nulls) for (const w of KEY_CRIBS) {
    const np = pinSetCount(nl.cipher, [`${w}@any`]);
    jobs.push({ id: `cribnull_${w}_${nl.id}`, group: 'cribnull', meta: { word: w, null: nl.id, placements: np }, cipher: nl.cipher, truth: nl.letters, crib: [`${w}@any`], restarts: np, seed: 3 });
  }
  write('cribnull', { defaults: Object.assign({}, CRIB_OPTS, { top: 10 }), jobs });
} else if (what === 'cribs2') {
  // second pass for the unit cribs: 2 restarts per placement, Z32 and 8 null ciphers, new seed
  const words = ['RADIANS', 'RADIAN', 'INCHES', 'INCH', 'MOUNT'];
  const nulls = Z.nullSet(12, 2032).slice(0, 8);
  const jobs = [];
  for (const w of words) {
    const np = pinSetCount(CANON, [`${w}@any`]);
    jobs.push({ id: `crib2_${w}_z32`, group: 'crib2', meta: { word: w, cipher: 'z32', placements: np }, cipher: CANON, crib: [`${w}@any`], restarts: 2 * np, seed: 13 });
    for (const nl of nulls) {
      const nn = pinSetCount(nl.cipher, [`${w}@any`]);
      jobs.push({ id: `crib2_${w}_${nl.id}`, group: 'crib2null', meta: { word: w, cipher: nl.id, placements: nn }, cipher: nl.cipher, truth: nl.letters, crib: [`${w}@any`], restarts: 2 * nn, seed: 13 });
    }
  }
  write('cribs2', { defaults: Object.assign({}, CRIB_OPTS, { top: 10 }), jobs });
} else if (what === 'pairs') {
  const nulls = Z.nullSet(12, 2032).slice(0, +(process.argv[3] || 3));
  const jobs = [];
  for (const [r, i] of [['RADIANS', 'INCHES'], ['RADIAN', 'INCHES'], ['RADIANS', 'INCH'], ['RADIAN', 'INCH']]) {
    const np = pinSetCount(CANON, [`${r}@any`, `${i}@any`]);
    jobs.push({ id: `pair_${r}_${i}`, group: 'pair', meta: { words: [r, i], placements: np }, cipher: CANON, crib: [`${r}@any`, `${i}@any`], restarts: np, seed: 5 });
  }
  for (const nl of nulls) {
    const np = pinSetCount(nl.cipher, ['RADIANS@any', 'INCHES@any']);
    jobs.push({ id: `pairnull_RADIANS_INCHES_${nl.id}`, group: 'pairnull', meta: { words: ['RADIANS', 'INCHES'], null: nl.id, placements: np }, cipher: nl.cipher, truth: nl.letters, crib: ['RADIANS@any', 'INCHES@any'], restarts: np, seed: 5 });
  }
  write('pairs', { defaults: Object.assign({}, CRIB_OPTS, { top: 40, iters: 80000 }), jobs });
} else if (what === 'free') {
  const jobs = [];
  for (const n of ['5', '5:0.5,6:0.5', '6']) {
    const ents = n === '5' ? [0, 0.5, 1] : [0.5];
    const wws = n === '6' ? [1] : [0, 0.5, 1];
    for (const ww of wws) for (const ent of ents) {
      const main = n === '5' && ww === 1 && ent === 0.5;
      jobs.push({ id: `free_n${n.replace(/[:,.]/g, '')}_ww${ww}_e${ent}`, group: 'free', cipher: CANON, n, wordweight: ww, entropy: ent, restarts: main ? 600 : 120, seed: 11 });
    }
  }
  jobs.push({ id: 'free_triangles_merged_main', group: 'variant', cipher: 'data/ciphers/variants/z32.triangles_merged.txt', n: '5', wordweight: 1, entropy: 0.5, restarts: 150, seed: 11 });
  write('free', { defaults: Object.assign({}, MAIN, { top: 200 }), jobs });
} else if (what === 'nullfree') {
  const nulls = Z.nullSet(12, 2032);
  const jobs = [];
  for (const s of [101, 102, 103]) jobs.push({ id: `z32_main100_seed${s}`, group: 'z32', cipher: CANON, restarts: 100, iters: 150000, seed: s });
  for (const nl of nulls) jobs.push({ id: `${nl.id}_main100`, group: 'null', cipher: nl.cipher, truth: nl.letters, meta: { words: nl.words, doc: nl.doc, pairs: nl.pairs }, restarts: 100, iters: 150000, seed: 101 });
  write('nullfree', { defaults: Object.assign({}, MAIN, { top: 50 }), jobs, nulls });
} else if (what === 'orders') {
  const jobs = [];
  for (const o of Z.readOrders()) jobs.push({ id: `order_${o.id}`, group: 'order', cipher: CANON, order: o.order, meta: { family: o.family, desc: o.desc, aliases: o.aliases }, restarts: 40, iters: 150000, seed: 7 });
  write('orders', { defaults: Object.assign({}, MAIN, { top: 50 }), jobs });
} else if (what === 'ordernull') {
  const sel = (process.argv[3] || 'written,skip19').split(',');
  const nulls = Z.nullSet(12, 2032).slice(0, +(process.argv[4] || 8));
  const O = new Map(Z.readOrders().map((o) => [o.id, o]));
  const jobs = [];
  for (const id of sel) {
    const o = O.get(id);
    if (!o) throw new Error(`unknown order ${id}`);
    for (const nl of nulls) jobs.push({ id: `ordernull_${id}_${nl.id}`, group: 'ordernull', cipher: nl.cipher, truth: nl.letters, order: o.order, meta: { order: id, words: nl.words }, restarts: 40, iters: 150000, seed: 7 });
  }
  write('ordernull', { defaults: Object.assign({}, MAIN, { top: 20 }), jobs });
} else {
  console.log('usage: node tools/z32search_jobs.js free|nullfree|orders|ordernull [orderIds] [nNulls]');
  process.exit(2);
}
