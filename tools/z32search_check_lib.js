'use strict';
// tools/z32search_check_lib.js - self-check for tools/z32search_lib.js: variant isomorphs, read orders
// (each a permutation, deduped), and where Z32's three repeat pairs land under each order.
// Writes results/z32search/orders/orders.json.  Usage: node tools/z32search_check_lib.js
const fs = require('fs');
const path = require('path');
const Z = require('./z32search_lib');

const t = Z.z32Text('canonical');
const out = { created: new Date().toISOString(), canonical: t, variants: {}, orders: [] };
for (const v of ['canonical', 'bar_is_serif_I', 't2_is_perp', 'bar_I_and_t2_perp', 'tau_distinct', 'triangles_merged']) {
  const x = Z.z32Text(v);
  out.variants[v] = { text: x, isomorph: Z.isomorph(x), pairs: Z.pairsOf(x), sameIsomorphAsCanonical: Z.isomorph(x) === Z.isomorph(t) };
  console.log(v.padEnd(18), Z.isomorph(x), JSON.stringify(Z.pairsOf(x)), out.variants[v].sameIsomorphAsCanonical);
}
const O = Z.readOrders();
console.log('read orders after dedupe:', O.length);
for (const o of O) {
  const rt = Z.applyOrder(t, o.order);
  const pairs = Z.pairsOf(rt);
  out.orders.push({ id: o.id, family: o.family, desc: o.desc, aliases: o.aliases, order: o.order, text: rt, isomorph: Z.isomorph(rt), pairs });
  console.log(o.id.padEnd(24), (o.aliases.join(',') || '-').padEnd(24), JSON.stringify(pairs));
}
// tests
const assert = require('assert');
assert.deepStrictEqual(Z.pairsOf(t), [[0, 25], [1, 31], [5, 13]]);
assert.strictEqual(Z.railOrder(2).join(','), Z.gridColumns(16).join(','));
assert.ok(O.every((o) => Z.isPerm(o.order)));
assert.strictEqual(Z.applyOrder(t, O.find((o) => o.id === 'reversed').order), t.split('').reverse().join(''));
const ph = Z.nullSet(3, 7);
for (const p of ph) {
  assert.strictEqual(new Set(p.cipher).size, 29);
  assert.ok(Z.satisfies(p.letters, Z.pairsOf(p.cipher)));
  console.log('null sample', p.id, p.letters, JSON.stringify(p.pairs), p.cipher);
}
const dir = path.join(Z.ROOT, 'results', 'z32search', 'orders');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'orders.json'), JSON.stringify(out, null, 1));
console.log('ok; wrote results/z32search/orders/orders.json');
