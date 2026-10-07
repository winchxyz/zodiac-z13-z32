'use strict';
/**
 * tools/nullmodel_tuplejoin.js - fast exact count of ORDERED k-word tuples
 * (exactly k words, repetition allowed) whose concatenation fits a cipher in
 * homophonic ("weak") or simple ("strict") mode.  Same definition as
 * tools/nullmodel_wordtuples.js (trie DFS, used to cross-check this one) but
 * computed as a hash join per length split, so 100k+ word lists finish in
 * seconds to minutes.
 *
 * For a split l1+..+lk = L, the positions of word j that share a cipher symbol
 * with an earlier word are fixed by the split, so word j is indexed by its
 * letters at those positions; every prefix (words 1..j-1) looks up the bucket
 * of words that agree with it.  Intra-word constraints are pre-filtered.  In
 * simple mode a candidate is also rejected when a symbol first seen in word j
 * would take a letter already used by a different symbol.
 *
 * Usage:
 *   node tools/nullmodel_tuplejoin.js --cipher F --words-file F [--top N] [--k 1,2,3]
 *        [--mode homophonic|simple|both] [--single-letters AI|ALL] [--max-distinct 15000000]
 *        [--sample 40] [--no-triples] [--label X] [--out F]
 * --no-triples drops list entries with three identical letters in a row (OCR / scream junk).
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');

function parse() {
  const a = process.argv.slice(2);
  const o = { k: '1,2,3', mode: 'both', singleLetters: 'AI', top: 0, maxDistinct: 15000000, sample: 40 };
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    const v = () => a[++i];
    if (t === '--cipher') o.cipher = v();
    else if (t === '--words-file') o.wordsFile = v();
    else if (t === '--top') o.top = +v();
    else if (t === '--k') o.k = v();
    else if (t === '--mode') o.mode = v();
    else if (t === '--single-letters') o.singleLetters = v();
    else if (t === '--max-distinct') o.maxDistinct = +v();
    else if (t === '--no-triples') o.noTriples = true;
    else if (t === '--sample') o.sample = +v();
    else if (t === '--label') o.label = v();
    else if (t === '--out') o.out = v();
    else { console.error('unknown option ' + t); process.exit(2); }
  }
  return o;
}

function readWords(o, maxLen) {
  const singles = o.singleLetters === 'ALL' ? null : new Set(o.singleLetters.split(''));
  const out = [];
  const seen = new Set();
  for (const ln of fs.readFileSync(o.wordsFile, 'utf8').split('\n')) {
    if (!ln.trim()) continue;
    const w = ln.split('\t')[0].trim().toUpperCase();
    if (!/^[A-Z]+$/.test(w) || seen.has(w)) continue;
    if (w.length === 1 && singles && !singles.has(w)) continue;
    if (o.noTriples && /(.)\1\1/.test(w)) continue; // junk such as EEEEEEEEEEE or MMMMMMMMMMMMM
    seen.add(w);
    if (o.top && seen.size > o.top) break;
    out.push(w);
  }
  return { all: out.length, words: out.filter((w) => w.length <= maxLen) };
}

function compositions(L, k, lens) {
  const out = [];
  const cur = [];
  (function rec(rem, j) {
    if (j === k) { if (rem === 0) out.push(cur.slice()); return; }
    for (const l of lens) {
      if (l > rem - (k - j - 1)) continue;
      cur.push(l); rec(rem - l, j + 1); cur.pop();
    }
  })(L, 0);
  return out;
}

function main() {
  const o = parse();
  const ci = C.loadCipher(o.cipher);
  const text = ci.text;
  const L = text.length;
  const m = new Map();
  const ids = Array.from(text, (s) => { if (!m.has(s)) m.set(s, m.size); return m.get(s); });
  const first = []; // first position of each symbol
  ids.forEach((s, p) => { if (first[s] == null) first[s] = p; });
  const t0 = Date.now();
  const { all, words } = readWords(o, L);
  const byLen = new Map();
  for (const w of words) { if (!byLen.has(w.length)) byLen.set(w.length, []); byLen.get(w.length).push(w); }
  const lens = [...byLen.keys()].sort((x, y) => x - y);
  const modes = o.mode === 'both' ? ['homophonic', 'simple'] : [o.mode];
  const ks = o.k.split(',').map(Number);
  const results = [];
  for (const mode of modes) {
    const simple = mode === 'simple';
    for (const k of ks) {
      let tuples = 0, candidates = 0;
      const distinct = new Set();
      let distinctCapped = false;
      const sample = [];
      const comps = compositions(L, k, lens);
      for (const comp of comps) {
        const starts = [];
        let s = 0;
        for (const l of comp) { starts.push(s); s += l; }
        let cand = 1;
        for (const l of comp) cand *= byLen.get(l).length;
        candidates += cand;
        // per word: filtered list and index
        const idx = [];
        let dead = false;
        for (let j = 0; j < k; j++) {
          const st = starts[j], l = comp[j];
          const cross = []; // positions p in word j whose symbol first appears before st
          for (let p = st; p < st + l; p++) if (first[ids[p]] < st) cross.push(p);
          const map = new Map();
          for (const w of byLen.get(l)) {
            let ok = true;
            // intra-word: same symbol -> same letter; simple: different symbol -> different letter
            for (let p = st; p < st + l && ok; p++) {
              for (let q = st; q < p; q++) {
                const same = ids[p] === ids[q];
                const eq = w.charCodeAt(p - st) === w.charCodeAt(q - st);
                if (same && !eq) { ok = false; break; }
                if (simple && !same && eq) { ok = false; break; }
              }
            }
            if (!ok) continue;
            let key = '';
            for (const p of cross) key += w[p - st];
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(w);
          }
          if (!map.size) { dead = true; break; }
          idx.push({ cross: cross.map((p) => first[ids[p]]), map, st, l });
        }
        if (dead) continue;
        // join, depth-first over the word slots (memory stays flat)
        const parts = [];
        const rec = (j, pre) => {
          const { cross, map, st, l } = idx[j];
          const last = j === k - 1;
          let key = '';
          for (const q of cross) key += pre[q];
          const bucket = map.get(key);
          if (!bucket) return;
          let used = null;
          if (simple) {
            // letters already taken by symbols seen in the prefix
            used = new Map();
            for (let q = 0; q < st; q++) used.set(pre.charCodeAt(q), ids[q]);
          }
          for (const w of bucket) {
            if (simple) {
              let ok = true;
              for (let p = st; p < st + l; p++) {
                if (first[ids[p]] < st) continue; // constrained equal to the prefix already
                const owner = used.get(w.charCodeAt(p - st));
                if (owner != null && owner !== ids[p]) { ok = false; break; }
              }
              if (!ok) continue;
            }
            if (last) {
              tuples++;
              if (!distinctCapped) { distinct.add(pre + w); if (distinct.size >= o.maxDistinct) distinctCapped = true; }
              if (sample.length < o.sample) sample.push(parts.concat([w]).join(' '));
            } else {
              parts.push(w);
              rec(j + 1, pre + w);
              parts.pop();
            }
          }
        };
        rec(0, '');
      }
      const r = { mode, k, tuples, distinctStrings: distinct.size, distinctCapped, candidateTuplesOfLengthL: candidates, fitRate: candidates ? tuples / candidates : null, splits: comps.length, sample };
      results.push(r);
      console.log(`${o.label || ''} ${mode} k=${k}: ${tuples} tuples, ${distinct.size}${distinctCapped ? '+' : ''} distinct strings, ${candidates.toExponential(3)} candidate tuples (rate ${(tuples / candidates).toExponential(3)}) [${((Date.now() - t0) / 1000).toFixed(1)} s]`);
    }
  }
  const lenHist = {};
  for (const [l, v] of byLen) lenHist[l] = v.length;
  const rep = {
    tool: 'tools/nullmodel_tuplejoin.js', created: new Date().toISOString(), command: 'node ' + process.argv.slice(1).join(' '),
    cipher: { source: o.cipher, text, length: L, symbols: m.size },
    wordList: { file: o.wordsFile, top: o.top || null, singleLetters: o.singleLetters, noTriples: !!o.noTriples, wordsRead: all, wordsUpToL: words.length, lengthHistogram: lenHist },
    definitions: { tuples: 'ordered sequences of exactly k list words (repetition allowed) whose concatenation fits', distinctStrings: 'distinct letter strings among those tuples', candidateTuplesOfLengthL: 'all ordered k-tuples of list words with total length L (before the fit test)' },
    results, seconds: (Date.now() - t0) / 1000,
  };
  if (o.out) {
    fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
    fs.writeFileSync(o.out, JSON.stringify(rep, null, 1));
  }
}

main();
