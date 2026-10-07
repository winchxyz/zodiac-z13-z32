'use strict';
/**
 * tools/wordfast.js - a fast UNIGRAM word-segmentation score for solver inner
 * loops (anneal.js --wordmodel fast, the default for the word term).
 *
 * Same vocabulary, unigram probabilities and unknown-word spelling model as
 * tools/lm.js wordSegment (formulas in data/lm/meta.json, words.model), but
 * without the word-bigram term, and searched with a letter trie instead of
 * substring Map lookups, so it allocates nothing per call:
 *   best[j] = max_i best[i] + log10 P(w = s[i..j))
 *   P(w) = (1 - p_oov) * count(w) / sum counts                (vocabulary word)
 *        = p_oov * P_len(|w|) * prod P_letter(w_k)            (any other string up to 20 letters)
 * Roughly 50-100x faster than lm.wordSegment on 13-32 letters.  Rankings
 * reported to the user should use lm.wordSegment (the bigram model).
 *
 *   const WF = require('./wordfast');
 *   const F = WF.build('common');           // ~0.3 s
 *   WF.logp(F, 'MYNAMEIS')                  // log10 P under the unigram segmentation model
 *   WF.logpCodes(F, codes, n)                // codes: Uint8Array 0..25
 *   WF.segment(F, 'MYNAMEIS')               // {logp, words}
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');

const MAXLEN = 24;      // as lm.js (vocab maxLen is capped at 24)
const MAXUNK = 20;      // lm.wordSegment default maxUnknownLen

const _cache = {};

function build(name = 'common') {
  if (_cache[name]) return _cache[name];
  const st = JSON.parse(fs.readFileSync(path.join(lm.LM_DIR, 'words_stats.json'), 'utf8'));
  const prm = st.params[name];
  if (!prm) throw new Error(`wordfast: unknown vocabulary '${name}'`);
  const file = name === 'full' ? 'words.tsv' : 'words_common.tsv';
  const lines = fs.readFileSync(path.join(lm.LM_DIR, file), 'latin1').split('\n');
  const words = [];
  const counts = [];
  let csum = 0;
  for (const ln of lines) {
    if (!ln) continue;
    const t = ln.indexOf('\t');
    const w = ln.slice(0, t);
    const c = +ln.slice(t + 1);
    words.push(w);
    counts.push(c);
    csum += c;
  }
  const pIn = 1 - prm.p_oov;
  // trie
  let cap = 1 << 16;
  let child = new Int32Array(cap * 26).fill(-1);
  let term = new Float64Array(cap).fill(NaN);
  let nodes = 1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length > MAXLEN) continue;
    let n = 0;
    for (let k = 0; k < w.length; k++) {
      const c = w.charCodeAt(k) - 65;
      if (c < 0 || c > 25) { n = -1; break; }
      let ch = child[n * 26 + c];
      if (ch < 0) {
        if (nodes >= cap) {
          const c2 = new Int32Array(cap * 2 * 26).fill(-1); c2.set(child); child = c2;
          const t2 = new Float64Array(cap * 2).fill(NaN); t2.set(term); term = t2;
          cap *= 2;
        }
        ch = nodes++;
        child[n * 26 + c] = ch;
      }
      n = ch;
    }
    if (n > 0 && Number.isNaN(term[n])) term[n] = Math.log10(pIn * counts[i] / csum);
  }
  const J1 = lm.table(1);
  const ll = prm.oov_len_log10;
  const unkLen = new Float64Array(MAXUNK + 1);
  for (let L = 1; L <= MAXUNK; L++) unkLen[L] = Math.log10(prm.p_oov) + (L <= ll.length ? ll[L - 1] : ll[ll.length - 1] + (L - ll.length) * Math.log10(0.8));
  const F = {
    name, nodes, child: child.subarray(0, nodes * 26), term: term.subarray(0, nodes), J1: Float64Array.from(J1), unkLen,
    best: new Float64Array(256), cum: new Float64Array(257), back: new Int32Array(257), codes: new Uint8Array(256),
    mark: new Int32Array(257), stamp: 0,
  };
  _cache[name] = F;
  return F;
}

/** log10 P of the best unigram segmentation of codes[0..n). */
function logpCodes(F, c, n = c.length) {
  if (n + 1 > F.best.length) {
    const m = 2 * (n + 1);
    F.best = new Float64Array(m); F.cum = new Float64Array(m + 1); F.mark = new Int32Array(m + 1); F.codes = new Uint8Array(m);
  }
  const best = F.best, cum = F.cum, child = F.child, term = F.term, J1 = F.J1, unkLen = F.unkLen;
  cum[0] = 0;
  for (let k = 0; k < n; k++) cum[k + 1] = cum[k] + J1[c[k]];
  best[0] = 0;
  for (let j = 1; j <= n; j++) best[j] = -Infinity;
  for (let i = 0; i < n; i++) {
    const b = best[i];
    if (b === -Infinity) continue;
    // known words
    if (F.stamp > 2000000000) { F.mark.fill(0); F.stamp = 0; }  // Int32 marks: never let the stamp overflow
    const stamp = ++F.stamp;
    const mark = F.mark;
    let node = 0;
    const top = Math.min(n, i + MAXLEN);
    for (let j = i; j < top; j++) {
      node = child[node * 26 + c[j]];
      if (node < 0) break;
      const t = term[node];
      if (t === t) { mark[j + 1] = stamp; const v = b + t; if (v > best[j + 1]) best[j + 1] = v; }
    }
    // other strings: spelling model (as in lm.js, never for a string that is a vocabulary word)
    const topU = Math.min(n, i + MAXUNK);
    for (let j = i + 1; j <= topU; j++) {
      if (mark[j] === stamp) continue;
      const v = b + unkLen[j - i] + (cum[j] - cum[i]);
      if (v > best[j]) best[j] = v;
    }
  }
  return best[n];
}

function logp(F, text) {
  const s = String(text).toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length + 1 > F.codes.length) F.codes = new Uint8Array(2 * (s.length + 1));
  const c = F.codes;
  for (let k = 0; k < s.length; k++) c[k] = s.charCodeAt(k) - 65;
  return logpCodes(F, c, s.length);
}

/** Best unigram segmentation with the words (slow path, for inspection). */
function segment(F, text) {
  const s = String(text).toUpperCase().replace(/[^A-Z]/g, '');
  const n = s.length;
  const best = new Float64Array(n + 1).fill(-Infinity);
  const back = new Int32Array(n + 1);
  const known = new Uint8Array(n + 1);
  best[0] = 0;
  const cum = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) cum[k + 1] = cum[k] + F.J1[s.charCodeAt(k) - 65];
  for (let i = 0; i < n; i++) {
    if (best[i] === -Infinity) continue;
    let node = 0;
    const isW = new Uint8Array(n + 1);
    for (let j = i; j < Math.min(n, i + MAXLEN); j++) {
      node = F.child[node * 26 + s.charCodeAt(j) - 65];
      if (node < 0) break;
      const t = F.term[node];
      if (t === t) isW[j + 1] = 1;
      if (t === t && best[i] + t > best[j + 1]) { best[j + 1] = best[i] + t; back[j + 1] = i; known[j + 1] = 1; }
    }
    for (let j = i + 1; j <= Math.min(n, i + MAXUNK); j++) {
      if (isW[j]) continue;
      const v = best[i] + F.unkLen[j - i] + (cum[j] - cum[i]);
      if (v > best[j]) { best[j] = v; back[j] = i; known[j] = 0; }
    }
  }
  const words = [];
  const unknown = [];
  for (let j = n; j > 0; j = back[j]) { const w = s.slice(back[j], j); words.push(w); if (!known[j]) unknown.push(w); }
  return { logp: best[n], words: words.reverse(), unknownWords: unknown.reverse() };
}

module.exports = { build, logp, logpCodes, segment, MAXLEN, MAXUNK };
