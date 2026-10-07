'use strict';
/**
 * tools/lead_torpedo_core.js - shared code for the `torpedo` look-elsewhere task (results/lead/torpedo/).
 *
 * Z13 = AENz0K0M0[NAM. Six symbols are pinned from a key (Z340 real: A=D E=R N=E z=A K=A M=O); the
 * free positions are 4, 6, 8 (the circled glyphs) and 9 (the hooked inverted T '[').
 *   variant 'circles'   (z13.circles_distinct, AENz0K{M}[NAM): positions 4, 6, 8, 9 are four different
 *                       symbols, each free over A-Z (homophonic: they may repeat each other or a pinned
 *                       letter) -> 26^4 = 456,976 completions per key.
 *   variant 'canonical' (one circle symbol): 4 = 6 = 8 is one free letter, 9 another -> 676 completions.
 *
 *   const T = require('./lead_torpedo_core');
 *   T.pinsFromKey(map)                 // Uint8Array(13) of letter codes, 255 at free positions
 *   T.enumerateCircles(pins, F, K)     // top-K completions by the fast unigram word score (tools/wordfast.js)
 *   T.exact(str)                       // {word: lm.wordSegment logp, words, unknown, ng6: 6-gram Markov logp}
 *   T.themes()                         // theme lists (results/lead/torpedo/theme_lists.json)
 *   T.hitsOf(words, themes)            // [{cat, word, len}] theme hits in a segmentation
 *   T.analyseKey(pins, opts)           // per-key summary used by the null runs (see below)
 *
 * analyseKey summary: completions ranked by exact lm.wordSegment logp (ties: 6-gram); for every theme
 * category c and minimum word length L in MINLENS the best (lowest) rank and the score of the best
 * completion whose segmentation contains a c-word of length >= L. For the 'circles' variant the
 * ranking covers the top-K completions by the fast unigram score (K = 4000 by default); the
 * calibration on the real key (lead_torpedo_real.js) checks that this prefilter loses nothing in the
 * ranges we report.
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const WF = require('./wordfast');

const ROOT = path.join(__dirname, '..');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CIPHER = 'AENz0K0M0[NAM';
const PIN_SYMS = ['A', 'E', 'N', 'z', 'K', 'M'];
const FREE_CIRCLES = [4, 6, 8, 9];
const MINLENS = [3, 4, 5, 6, 7];
const CATS = ['bomb', 'letter', 'zodiac', 'insult', 'place', 'case', 'firstname', 'surname', 'fullname'];

function pinsFromKey(m) {
  const p = new Uint8Array(13).fill(255);
  for (let i = 0; i < 13; i++) {
    const s = CIPHER[i];
    if (PIN_SYMS.includes(s)) p[i] = m.get(s).charCodeAt(0) - 65;
  }
  return p;
}

function pinString(p) {
  let s = '';
  for (let i = 0; i < 13; i++) s += p[i] === 255 ? '?' : LETTERS[p[i]];
  return s;
}

function codesToString(c) {
  let s = '';
  for (let i = 0; i < c.length; i++) s += LETTERS[c[i]];
  return s;
}

/** Index 0..26^4-1 of a circles completion (letters at 4, 6, 8, 9) and back. */
function circlesIndex(a, b, c, d) { return ((a * 26 + b) * 26 + c) * 26 + d; }

/**
 * Enumerate all 26^4 circles completions with the fast unigram score; keep the top K.
 * Returns {idx: Int32Array, wf: Float64Array} sorted by wf descending, plus the K-th score.
 */
function enumerateCircles(pins, F, K = 4000) {
  const codes = new Uint8Array(13);
  for (let i = 0; i < 13; i++) codes[i] = pins[i] === 255 ? 0 : pins[i];
  // min-heap of size K on wf
  const hs = new Float64Array(K);
  const hi = new Int32Array(K);
  let n = 0;
  const up = (k) => { while (k > 0) { const p = (k - 1) >> 1; if (hs[p] <= hs[k]) break; let t = hs[p]; hs[p] = hs[k]; hs[k] = t; t = hi[p]; hi[p] = hi[k]; hi[k] = t; k = p; } };
  const down = (k) => { for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < n && hs[l] < hs[m]) m = l; if (r < n && hs[r] < hs[m]) m = r; if (m === k) break; let t = hs[m]; hs[m] = hs[k]; hs[k] = t; t = hi[m]; hi[m] = hi[k]; hi[k] = t; k = m; } };
  for (let a = 0; a < 26; a++) {
    codes[4] = a;
    for (let b = 0; b < 26; b++) {
      codes[6] = b;
      for (let c = 0; c < 26; c++) {
        codes[8] = c;
        for (let d = 0; d < 26; d++) {
          codes[9] = d;
          const v = WF.logpCodes(F, codes, 13);
          if (n < K) { hs[n] = v; hi[n] = circlesIndex(a, b, c, d); up(n); n++; }
          else if (v > hs[0]) { hs[0] = v; hi[0] = circlesIndex(a, b, c, d); down(0); }
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => hs[y] - hs[x]);
  return { idx: Int32Array.from(order.map((i) => hi[i])), wf: Float64Array.from(order.map((i) => hs[i])), kth: n ? hs[0] : -Infinity };
}

function circlesString(pins, idx) {
  const d = idx % 26, c = ((idx / 26) | 0) % 26, b = ((idx / 676) | 0) % 26, a = (idx / 17576) | 0;
  const codes = new Uint8Array(13);
  for (let i = 0; i < 13; i++) codes[i] = pins[i];
  codes[4] = a; codes[6] = b; codes[8] = c; codes[9] = d;
  return codesToString(codes);
}

function canonicalString(pins, x, y) {
  const codes = new Uint8Array(13);
  for (let i = 0; i < 13; i++) codes[i] = pins[i];
  codes[4] = x; codes[6] = x; codes[8] = x; codes[9] = y;
  return codesToString(codes);
}

function exact(str, withNg6 = true) {
  const ws = lm.wordSegment(str);
  return { word: ws.logp, words: ws.words, unknown: ws.unknownWords || [], ng6: withNg6 ? lm.ngram6Score(str).logp : NaN };
}

let _themes = null;
function themes() {
  if (_themes) return _themes;
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'results', 'lead', 'torpedo', 'theme_lists.json'), 'utf8'));
  const byWord = new Map();
  for (const [cat, list] of Object.entries(d.lists)) for (const w of list) {
    if (!byWord.has(w)) byWord.set(w, []);
    byWord.get(w).push(cat);
  }
  _themes = { byWord, first: new Set(d.fullname.first), sur: new Set(d.fullname.surname), lists: d.lists };
  return _themes;
}

/** Theme hits in a segmentation: [{cat, word, len}]; 'fullname' = first-name word directly followed by a surname word. */
function hitsOf(words, th = themes()) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const cats = th.byWord.get(w);
    if (cats) for (const c of cats) out.push({ cat: c, word: w, len: w.length });
    if (i + 1 < words.length && w.length >= 3 && words[i + 1].length >= 3 && th.first.has(w) && th.sur.has(words[i + 1])) {
      out.push({ cat: 'fullname', word: w + ' ' + words[i + 1], len: Math.min(w.length, words[i + 1].length) + 3 });
    }
  }
  return out;
}

/**
 * Per-key summary.
 * opts: {variant: 'circles'|'canonical', F (wordfast trie), K (prefilter size, circles only), ng6 (bool)}
 * Returns {pins, best:{str, word, words}, n, kth, cat: {c: {L: [rank, score, str]}}} with rank 0 = no hit.
 */
function analyseKey(pins, opts = {}) {
  const th = themes();
  const variant = opts.variant || 'circles';
  let cands = [];
  let kth = null;
  if (variant === 'circles') {
    const e = enumerateCircles(pins, opts.F, opts.K || 4000);
    kth = e.kth;
    for (let i = 0; i < e.idx.length; i++) cands.push({ str: circlesString(pins, e.idx[i]), wf: e.wf[i] });
  } else {
    for (let x = 0; x < 26; x++) for (let y = 0; y < 26; y++) cands.push({ str: canonicalString(pins, x, y), wf: NaN });
  }
  for (const c of cands) {
    const ex = exact(c.str, !!opts.ng6);
    c.word = ex.word; c.words = ex.words; c.ng6 = ex.ng6; c.unknown = ex.unknown.length;
  }
  cands.sort((a, b) => (b.word - a.word) || ((b.ng6 || 0) - (a.ng6 || 0)));
  const cat = {};
  for (const c of CATS) { cat[c] = {}; for (const L of MINLENS) cat[c][L] = [0, null, null]; }
  for (let r = 0; r < cands.length; r++) {
    const c = cands[r];
    const hits = hitsOf(c.words, th);
    for (const h of hits) for (const L of MINLENS) {
      if (h.len >= L && cat[h.cat][L][0] === 0) cat[h.cat][L] = [r + 1, +c.word.toFixed(4), c.str + ':' + c.words.join(' ')];
    }
  }
  return {
    pins: pinString(pins), n: cands.length, kth,
    best: { str: cands[0].str, word: +cands[0].word.toFixed(4), words: cands[0].words.join(' '), wf: cands[0].wf },
    second: cands[1] ? +cands[1].word.toFixed(4) : null,
    cat,
    cands: opts.keepCands ? cands : undefined,
  };
}

module.exports = {
  ROOT, LETTERS, CIPHER, PIN_SYMS, FREE_CIRCLES, MINLENS, CATS,
  pinsFromKey, pinString, codesToString, circlesIndex, enumerateCircles, circlesString, canonicalString,
  exact, themes, hitsOf, analyseKey,
};
