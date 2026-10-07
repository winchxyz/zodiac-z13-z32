'use strict';
/**
 * tools/lead_replicate_classes.js - the glyph-class confound in numbers: which letters the Z340
 * (and Z408) key gives to each visual class of glyph, and how English-frequent they are.
 *   node tools/lead_replicate_classes.js [--out results/lead/replicate/classes.json]
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');
const lm = require('./lm');

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args[oi + 1] : 'results/lead/replicate/classes.json';
const keys = R.loadKeys();
const J1 = lm.table(1);
const lp = (l) => J1[l.charCodeAt(0) - 65];
const out = {};
for (const name of ['z340', 'z408']) {
  const K = keys[name];
  const syms = Object.keys(K.key);
  const cls = {};
  for (const s of syms) { const c = R.glyphClass(s); (cls[c] = cls[c] || []).push(s); }
  cls.all = syms;
  const o = {};
  for (const [c, list] of Object.entries(cls)) {
    const letters = list.map((s) => K.key[s]);
    const meanLogP = letters.reduce((a, l) => a + lp(l), 0) / letters.length;
    const top9 = letters.filter((l) => 'ETAOINSHR'.includes(l)).length / letters.length;
    o[c] = { n: list.length, symbols: list.join(''), letters: letters.slice().sort().join(''), meanUnigramLog10P: meanLogP, shareETAOINSHR: top9 };
  }
  const pins = R.SLOTS.map((s) => K.key[s]);
  o.z13pins = { letters: pins.join(''), meanUnigramLog10P: pins.reduce((a, l) => a + lp(l), 0) / 6, shareETAOINSHR: pins.filter((l) => 'ETAOINSHR'.includes(l)).length / 6 };
  out[name] = o;
  console.log(name);
  for (const [c, v] of Object.entries(o)) console.log(`  ${c.padEnd(10)} n=${String(v.n || 6).padEnd(3)} letters ${v.letters} meanLog10P ${v.meanUnigramLog10P.toFixed(3)} shareETAOINSHR ${v.shareETAOINSHR.toFixed(2)}`);
}
fs.writeFileSync(path.join(R.ROOT, OUT), JSON.stringify(out, null, 1));
