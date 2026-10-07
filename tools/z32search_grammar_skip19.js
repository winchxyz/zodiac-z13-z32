#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_grammar_skip19.js - why does the skip19 read order admit so many grammar strings?
 * Recounts the radian/inch grammar fits for a few read orders with the bare abbreviation IN / INS
 * removed (from the inch units and the leads), to test whether openings like "IN SIX ..." / "IN EIGHT ..."
 * (I N . I: p0 = p3) drive the excess.  Writes results/z32search/grammar/skip19_check.json.
 *   node tools/z32search_grammar_skip19.js
 */
const fs = require('fs');
const path = require('path');
const G = require('./z32search_grammar_lib');
const E = require('./z32search_grammar_count');
const Z = require('./z32search_lib');

const z32 = Z.z32Text('canonical');
const ids = ['skip19', 'written', 'cols_bt_r2right'];
const O = Z.readOrders().filter((o) => ids.includes(o.id));
const full = E.prepForms(G.forms());
const noIn = E.prepForms(G.forms().map((f) => Object.assign({}, f, { slots: f.slots.map((sl) => Object.assign({}, sl, { items: sl.items.filter((it) => !((sl.name === 'IUNIT' || sl.name === 'LEAD') && /^(IN|INS)$/.test(it.s)) && !(process.argv.includes('--no-bomb') && sl.name === 'LEAD' && /^(BOMB|SET|TRY|ITS)/.test(it.s))) })) })));
const rng = Z.makeRng(77, 1);
const nulls = [];
for (let i = 0; i < 6; i++) nulls.push(Z.randomPairs(rng));
const sum = (F, p) => F.reduce((a, f) => a + E.countForm(f, p), 0);
const res = { orders: [], nulls: [] };
for (const o of O) {
  const p = Z.pairsOf(Z.applyOrder(z32, o.order));
  res.orders.push({ id: o.id, pairs: p, fitsFull: sum(full, p), fitsWithoutIN: sum(noIn, p) });
}
for (const p of nulls) res.nulls.push({ pairs: p, fitsFull: sum(full, p), fitsWithoutIN: sum(noIn, p) });
const out = path.join(Z.ROOT, 'results', 'z32search', 'grammar', process.argv.includes('--no-bomb') ? 'skip19_check_nobomb.json' : 'skip19_check.json');
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
