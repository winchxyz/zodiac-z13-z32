'use strict';
/**
 * tools/lead_replicate_windowbest.js - best completions (brute force through lm.js) of the
 * Z408/Z32 windows that the Z340 key makes most English-like under the canonical layout
 * (from results/lead/replicate/nulls_z340.json, null "windows"), to show what unrelated Zodiac
 * text looks like after the same treatment as Z13.
 *   node tools/lead_replicate_windowbest.js [--top 5]
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');
const lm = require('./lm');

const args = process.argv.slice(2);
const ti = args.indexOf('--top');
const TOP = ti >= 0 ? +args[ti + 1] : 5;
const J = JSON.parse(fs.readFileSync(path.join(R.ROOT, 'results/lead/replicate/nulls_z340.json'), 'utf8'));
const lay = R.layout('canonical');
const out = [];
for (const w of J.nulls.windows.topCanonicalT2.slice(0, TOP)) {
  const pl = Int8Array.from([...w.pinned].map((c) => (c === '?' ? -1 : c.charCodeAt(0) - 65)));
  const b = R.bruteStats(lay, pl, { word: true });
  const rec = { label: w.label, pinned: w.pinned, t1: b.t1, best1: b.best1, t2: b.t2, best2: lm.wordSegment(b.best2).words.join(' ') };
  out.push(rec);
  console.log(`${rec.label} ${rec.pinned} t1 ${rec.t1.toFixed(3)} ${rec.best1} | t2 ${rec.t2.toFixed(3)} ${rec.best2}`);
}
fs.writeFileSync(path.join(R.ROOT, 'results/lead/replicate/windows_best.json'), JSON.stringify(out, null, 1));
