'use strict';
// Reviewer check: does the real-phrase reference depend on duplicate draws and on the 17 source documents?
// Reads results/z13phrases/null_real_phrases.tsv; writes nothing.
const fs = require('fs');
const path = require('path');
const rows = fs.readFileSync(path.join(__dirname, '..', 'results', 'z13phrases', 'null_real_phrases.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
function pct(a, q) { const s = a.slice().sort((x, y) => x - y); const x = (s.length - 1) * q, lo = Math.floor(x), hi = Math.ceil(x); return s[lo] + (s[hi] - s[lo]) * (x - lo); }
for (const L of ['11', '12', '13']) {
  const r = rows.filter((x) => x[0] === L);
  const all = r.map((x) => +x[4]);
  const seen = new Map();
  for (const x of r) if (!seen.has(x[1])) seen.set(x[1], x);
  const uniq = [...seen.values()].map((x) => +x[4]);
  const docs = new Map();
  for (const x of seen.values()) { if (!docs.has(x[3])) docs.set(x[3], []); docs.get(x[3]).push(+x[4]); }
  const docMed = [...docs.entries()].map(([d, v]) => [d, v.length, +pct(v, 0.5).toFixed(2)]).sort((a, b) => b[1] - a[1]);
  console.log(`L=${L} draws=${all.length} unique=${uniq.length} docs=${docs.size}`);
  console.log(`  all:    p50 ${pct(all, 0.5).toFixed(3)} p75 ${pct(all, 0.75).toFixed(3)} p90 ${pct(all, 0.9).toFixed(3)} p99 ${pct(all, 0.99).toFixed(3)}`);
  console.log(`  unique: p50 ${pct(uniq, 0.5).toFixed(3)} p75 ${pct(uniq, 0.75).toFixed(3)} p90 ${pct(uniq, 0.9).toFixed(3)} p99 ${pct(uniq, 0.99).toFixed(3)}`);
  // leave-one-document-out range of the median (unique phrases)
  const meds = [];
  for (const d of docs.keys()) meds.push(pct([...seen.values()].filter((x) => x[3] !== d).map((x) => +x[4]), 0.5));
  console.log(`  leave-one-doc-out median range ${Math.min(...meds).toFixed(3)} .. ${Math.max(...meds).toFixed(3)}`);
  console.log(`  per-doc (n unique, median): ${docMed.map((x) => `${x[1]}:${x[2]}`).join(' ')}`);
}
