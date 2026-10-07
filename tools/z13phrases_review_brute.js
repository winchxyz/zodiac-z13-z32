'use strict';
/**
 * tools/z13phrases_review_brute.js - REVIEWER: independent, naive re-implementation of the
 * "consistent strings" count (no trie, no state machine): recursive word-by-word concatenation of
 * the top-N common words (<= cipher length), checking the substitution constraint after every word,
 * distinct letter strings collected in a Set.  Used to cross-check tools/z13phrases_enum.js counts.
 *
 *   node tools/z13phrases_review_brute.js --cipher data/ciphers/variants/z13.canonical.txt --mode simple --top-words 20000 --max-words 4
 *        [--slip 6] [--range 1:13] [--pin A=A,...] [--dump file]
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');
const EN = require('./enumerate');

const o = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) o[process.argv[i].slice(2)] = process.argv[++i];
let text = C.loadCipher(o.cipher).text;
if (o.range) { const [a, b] = o.range.split(':').map(Number); text = text.slice(a, b); }
const L = text.length;
const mode = o.mode || 'simple';
const M = +o['max-words'] || 4;
const N = +o['top-words'] || 20000;
const slip = o.slip != null ? +o.slip : -1;
const words = EN.readTsv(path.join(__dirname, '..', 'data', 'lm', 'words_common.tsv'), N, L, 1).map((e) => e.w);
const byLen = new Map();
for (const w of words) { if (!byLen.has(w.length)) byLen.set(w.length, []); byLen.get(w.length).push(w); }
const byLenFirst = new Map(); // `${len}${firstLetter}` -> words
for (const w of words) { const k = w.length + w[0]; if (!byLenFirst.has(k)) byLenFirst.set(k, []); byLenFirst.get(k).push(w); }
const key = new Map(); // symbol -> letter
const owner = new Map(); // letter -> symbol (simple only)
if (o.pin) for (const pr of o.pin.split(',')) { const [s, l] = pr.split('='); key.set(s, l); owner.set(l, s); }
const seen = new Set();
const buf = [];
function place(w, p) {
  // returns list of newly assigned symbols, or null if inconsistent (and undoes partial work)
  const added = [];
  for (let i = 0; i < w.length; i++) {
    const pos = p + i;
    if (pos === slip) continue;
    const s = text[pos], l = w[i];
    const cur = key.get(s);
    if (cur !== undefined) { if (cur !== l) { undo(added); return null; } continue; }
    if (mode === 'simple') { const ow = owner.get(l); if (ow !== undefined && ow !== s) { undo(added); return null; } owner.set(l, s); }
    key.set(s, l); added.push(s);
  }
  return added;
}
function undo(added) { for (const s of added) { if (mode === 'simple') owner.delete(key.get(s)); key.delete(s); } }
function rec(p, k) {
  if (p === L) { seen.add(buf.join('')); return; }
  if (k === M) return;
  const rem = L - p;
  const first = p !== slip ? key.get(text[p]) : undefined;
  for (const [len, list0] of byLen) {
    if (len > rem) continue;
    if (len < rem && k + 1 === M) continue;
    const list = first !== undefined ? (byLenFirst.get(len + first) || []) : list0;
    for (const w of list) {
      const added = place(w, p);
      if (!added) continue;
      buf.push(w);
      rec(p + len, k + 1);
      buf.pop();
      undo(added);
    }
  }
}
const t0 = Date.now();
rec(0, 0);
console.log(JSON.stringify({ cipher: text, mode, topWords: N, wordsUsed: words.length, maxWords: M, slip, range: o.range || null, pin: o.pin || '', consistentStrings: seen.size, seconds: (Date.now() - t0) / 1000 }));
if (o.dump) fs.writeFileSync(o.dump, [...seen].sort().join('\n') + '\n');
