'use strict';
/**
 * tools/z32search_lib.js - helpers for the z32search task (results/z32search/).
 *
 *   const Z = require('./z32search_lib');
 *   Z.z32Text('canonical')            // 'C9J|#Ok[AMf8?ORTGX6FDVj%HCELzPW9' (read from data/ciphers/variants)
 *   Z.pairsOf(text)                   // equality pairs [[i,j],...] of repeated symbols (reading positions)
 *   Z.readOrders()                    // [{id, family, desc, order}] every simple read order we test (deduped)
 *   Z.applyOrder(text, order)         // order[k] = written index read k-th
 *   Z.nullPhrases(n, seed)            // held-out 32-letter English phrases with 3 disjoint equal-letter pairs
 *   Z.nullCipher(phrase, pairs)       // a Z32-shaped cipher text (29 symbols, 3 repeated pairs) for that phrase
 *   Z.rescore(pt)                     // reference metrics: 5-gram joint sum, wordSegment logp/unknown, words
 *   Z.hamming(a, b)
 *
 * Positions are 0-based.  Z32 is written as two rows: 17 symbols (0..16) and 15 symbols (17..31).
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const ROW0 = 17, ROW1 = 15, N = 32;

function z32Text(variant = 'canonical') {
  const f = path.join(ROOT, 'data', 'ciphers', 'variants', `z32.${variant}.txt`);
  return fs.readFileSync(f, 'utf8').replace(/\s+/g, '');
}

function isomorph(text) {
  const m = new Map();
  const A = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (const ch of text) { if (!m.has(ch)) m.set(ch, A[m.size]); s += m.get(ch); }
  return s;
}

/** Equality constraints implied by a homophonic reading: all pairs (i<j) with text[i]===text[j]. */
function pairsOf(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) for (let j = i + 1; j < text.length; j++) if (text[i] === text[j]) out.push([i, j]);
  return out;
}

function satisfies(pt, pairs) {
  for (const [i, j] of pairs) if (pt[i] !== pt[j]) return false;
  return true;
}

function applyOrder(text, order) {
  let s = '';
  for (const k of order) s += text[k];
  return s;
}

function invert(order) {
  const inv = new Array(order.length);
  order.forEach((w, k) => { inv[w] = k; });
  return inv;
}

function isPerm(order, n = N) {
  if (order.length !== n) return false;
  const seen = new Uint8Array(n);
  for (const x of order) { if (!(x >= 0 && x < n) || seen[x]) return false; seen[x] = 1; }
  return true;
}

/* ------------------------------------------------------------ read orders */

const range = (a, b) => { const r = []; if (a <= b) for (let i = a; i <= b; i++) r.push(i); else for (let i = a; i >= b; i--) r.push(i); return r; };

/** Cell (r, c) of the written 17 + 15 layout -> written index, or -1 if the cell is empty. shift: column offset of row 2. */
function cellIndex(r, c, shift = 0) {
  if (r === 0) return c >= 0 && c < ROW0 ? c : -1;
  const cc = c - shift;
  return cc >= 0 && cc < ROW1 ? ROW0 + cc : -1;
}

/** Grid of `rows` rows filled row by row with 0..31; read column by column (top to bottom, left to right). */
function gridColumns(rows) {
  const cols = N / rows;
  const o = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) o.push(r * cols + c);
  return o;
}

/** Rail-fence: plaintext indices in rail order for k rails (the ciphertext of a rail-fence encipherment). */
function railOrder(k) {
  const rail = [];
  let r = 0, d = 1;
  for (let i = 0; i < N; i++) { rail.push(r); if (k > 1) { if (r === 0) d = 1; else if (r === k - 1) d = -1; r += d; } }
  const o = [];
  for (let q = 0; q < k; q++) for (let i = 0; i < N; i++) if (rail[i] === q) o.push(i);
  return o;
}

/** Z340-style diagonal on the 17 + 15 layout: k-th letter at (k*dr mod 2, (c0 + k*dc) mod 17); empty cells skipped. */
function diagLayout(dr, dc, shift = 0) {
  const o = [];
  for (let k = 0; k < 2 * ROW0; k++) {
    const r = ((k * dr) % 2 + 2) % 2;
    const c = (((k * dc) % ROW0) + ROW0) % ROW0;
    const w = cellIndex(r, c, shift);
    if (w >= 0) o.push(w);
  }
  return o;
}

function readOrders() {
  const R0 = range(0, 16), R1 = range(17, 31);
  const list = [];
  const add = (id, family, desc, order) => list.push({ id, family, desc, order });
  add('written', 'rows', 'as written: row 1 left to right, then row 2 left to right (baseline)', [...R0, ...R1]);
  add('reversed', 'rows', 'whole cipher right to left from the last symbol (row 2 reversed, then row 1 reversed)', range(31, 0));
  add('rows_each_reversed', 'rows', 'each row right to left, row 1 first', [...range(16, 0), ...range(31, 17)]);
  add('row2_first', 'rows', 'row 2 left to right, then row 1 left to right', [...R1, ...R0]);
  add('boustro_r2_back', 'rows', 'boustrophedon: row 1 left to right, row 2 right to left', [...R0, ...range(31, 17)]);
  add('boustro_r1_back', 'rows', 'boustrophedon: row 1 right to left, row 2 left to right', [...range(16, 0), ...R1]);
  add('row2_first_boustro_a', 'rows', 'row 2 left to right, then row 1 right to left', [...R1, ...range(16, 0)]);
  add('row2_first_boustro_b', 'rows', 'row 2 right to left, then row 1 left to right', [...range(31, 17), ...R0]);
  // columns of the actual 17 + 15 layout (left aligned, as written), and with row 2 right aligned (shift 2)
  for (const shift of [0, 2]) {
    const tag = shift ? '_r2right' : '';
    const al = shift ? 'row 2 right-aligned (columns 2..16)' : 'rows left-aligned as written';
    const colsTB = [], colsBT = [], colsTBrl = [], colsBTrl = [], colsSnake = [];
    for (let c = 0; c < ROW0; c++) for (const r of [0, 1]) { const w = cellIndex(r, c, shift); if (w >= 0) colsTB.push(w); }
    for (let c = 0; c < ROW0; c++) for (const r of [1, 0]) { const w = cellIndex(r, c, shift); if (w >= 0) colsBT.push(w); }
    for (let c = ROW0 - 1; c >= 0; c--) for (const r of [0, 1]) { const w = cellIndex(r, c, shift); if (w >= 0) colsTBrl.push(w); }
    for (let c = ROW0 - 1; c >= 0; c--) for (const r of [1, 0]) { const w = cellIndex(r, c, shift); if (w >= 0) colsBTrl.push(w); }
    for (let c = 0; c < ROW0; c++) for (const r of (c % 2 ? [1, 0] : [0, 1])) { const w = cellIndex(r, c, shift); if (w >= 0) colsSnake.push(w); }
    add('cols_tb' + tag, 'columns', `17-column layout, ${al}: columns left to right, each top to bottom`, colsTB);
    add('cols_bt' + tag, 'columns', `17-column layout, ${al}: columns left to right, each bottom to top`, colsBT);
    add('cols_tb_rl' + tag, 'columns', `17-column layout, ${al}: columns right to left, each top to bottom`, colsTBrl);
    add('cols_bt_rl' + tag, 'columns', `17-column layout, ${al}: columns right to left, each bottom to top`, colsBTrl);
    add('cols_snake' + tag, 'columns', `17-column layout, ${al}: columns left to right, alternately down and up`, colsSnake);
    // Z340-style diagonals (+1 row, +dc columns, wrapping); the Z340 used +1 row, +2 columns
    for (const dc of [1, 2, -1, -2]) {
      add(`diag_dc${dc}${tag}`, 'diagonal', `Z340-style diagonal on the 17-column layout (${al}): step +1 row, ${dc > 0 ? '+' : ''}${dc} column(s), wrapping; empty cells skipped`, diagLayout(1, dc, shift));
    }
  }
  // regridded rectangles (32 = 2x16 = 4x8 = 8x4 = 16x2), filled by rows, read by columns
  for (const rows of [2, 4, 8, 16]) add(`grid${rows}x${N / rows}_cols`, 'regrid', `rewritten as ${rows} rows of ${N / rows} (row by row), read column by column`, gridColumns(rows));
  // rail fence: k rails; R = rail order (what a rail-fence encipherment outputs) and its inverse
  for (const k of [2, 3, 4, 5]) {
    const R = railOrder(k);
    add(`rail${k}_enc`, 'railfence', `rail fence with ${k} rails: plaintext written in zigzag, read rail by rail (order = rail order)`, R);
    add(`rail${k}_dec`, 'railfence', `rail fence with ${k} rails, inverse direction (order = inverse of the rail order)`, invert(R));
  }
  // decimation (period) reads: k-th letter at written index (k*p) mod 32, odd p
  for (let p = 3; p < N; p += 2) {
    const o = [];
    for (let k = 0; k < N; k++) o.push((k * p) % N);
    add(`skip${p}`, 'period', `period ${p}: letter k at written index (${p}k) mod 32 (the linear form of a skip/diagonal read)`, o);
  }
  // Z340 period-19 read in linear form (17 columns + 2) is skip19 above.
  // dedupe by order
  const seen = new Map();
  const out = [];
  for (const e of list) {
    if (!isPerm(e.order)) throw new Error(`read order ${e.id} is not a permutation of 0..31`);
    const k = e.order.join(',');
    if (seen.has(k)) { seen.get(k).aliases.push(e.id); continue; }
    const rec = Object.assign({}, e, { aliases: [] });
    seen.set(k, rec);
    out.push(rec);
  }
  return out;
}

/* ------------------------------------------------------- null phrases */

/** All held-out word-aligned 32-letter phrases (inside one sentence).  [{letters, words, doc}] */
function heldoutWindows(n = N, opts = {}) {
  const TS = require('./textsample');
  let S = TS.sentences();
  const out = [];
  if (opts.stream) {
    // consecutive kept sentences of one document joined into one word stream (windows may cross sentence ends)
    const docs = [];
    for (const s of S) {
      if (!docs.length || docs[docs.length - 1].doc !== s.doc) docs.push({ doc: s.doc, words: [] });
      for (const w of s.words) docs[docs.length - 1].words.push(w);
    }
    S = docs;
  }
  for (const s of S) {
    const W = s.words;
    for (let a = 0; a < W.length; a++) {
      if (opts.sentenceStartOnly && a > 0) break;
      let len = 0;
      for (let b = a; b < W.length; b++) {
        len += W[b].length;
        if (len === n) { const ws = W.slice(a, b + 1); out.push({ letters: ws.join('').toUpperCase(), words: ws.join(' '), doc: s.doc }); break; }
        if (len > n) break;
      }
    }
  }
  return out;
}

/** Choose 3 disjoint equal-letter pairs uniformly at random; null if impossible. */
function choosePairs(pt, rng, k = 3) {
  for (let t = 0; t < 200; t++) {
    const all = [];
    for (let i = 0; i < pt.length; i++) for (let j = i + 1; j < pt.length; j++) if (pt[i] === pt[j]) all.push([i, j]);
    const used = new Set();
    const pick = [];
    const pool = all.slice();
    while (pick.length < k && pool.length) {
      const x = pool.splice(rng.int(pool.length), 1)[0];
      if (used.has(x[0]) || used.has(x[1])) continue;
      used.add(x[0]); used.add(x[1]);
      pick.push(x);
    }
    if (pick.length === k) return pick.sort((a, b) => a[0] - b[0]);
  }
  return null;
}

const NULL_SYMS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Cipher text with one symbol per position except that each pair shares a symbol (29 symbols for 3 pairs). */
function nullCipher(len, pairs, rng) {
  const sym = new Array(len).fill(null);
  const alphabet = NULL_SYMS.split('');
  // shuffle alphabet so the symbol identities carry nothing
  for (let i = alphabet.length - 1; i > 0; i--) { const j = rng.int(i + 1); [alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]]; }
  let next = 0;
  for (const [i, j] of pairs) { const s = alphabet[next++]; sym[i] = s; sym[j] = s; }
  for (let i = 0; i < len; i++) if (!sym[i]) sym[i] = alphabet[next++];
  return sym.join('');
}

/** n held-out 32-letter phrases (deterministic for a seed), each with a Z32-shaped null cipher. */
function nullSet(n, seed = 2032) {
  const rng = makeRng(seed >>> 0, 0x6e756c6c);
  const W = heldoutWindows(N, { sentenceStartOnly: true });
  const out = [];
  const usedIdx = new Set();
  while (out.length < n) {
    const i = rng.int(W.length);
    if (usedIdx.has(i)) continue;
    usedIdx.add(i);
    const ph = W[i];
    const pairs = choosePairs(ph.letters, rng);
    if (!pairs) continue;
    out.push({ id: `null${String(out.length).padStart(2, '0')}`, letters: ph.letters, words: ph.words, doc: ph.doc, pairs, cipher: nullCipher(N, pairs, rng) });
  }
  return out;
}

/** Uniformly random 3 disjoint pairs among 32 positions (pattern-only null). */
function randomPairs(rng, len = N, k = 3) {
  for (;;) {
    const p = [];
    const used = new Set();
    while (p.length < k) {
      const i = rng.int(len), j = rng.int(len);
      if (i === j || used.has(i) || used.has(j)) continue;
      used.add(i); used.add(j);
      p.push(i < j ? [i, j] : [j, i]);
    }
    return p.sort((a, b) => a[0] - b[0]);
  }
}

/* ------------------------------------------------------------ scoring */

function rescore(pt) {
  const ng5 = lm.ngramScore(pt, 5);
  const ws = lm.wordSegment(pt, { vocab: 'common' });
  return { ng5: ng5.sum, wordLogp: ws.logp, unknown: ws.unknown, words: ws.words.join(' ') };
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

function quantiles(arr, qs = [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1]) {
  const v = arr.slice().sort((x, y) => x - y);
  const o = {};
  for (const q of qs) o[q] = v.length ? v[Math.min(v.length - 1, Math.max(0, Math.round(q * (v.length - 1))))] : null;
  return o;
}

function meanSd(arr) {
  const n = arr.length;
  if (!n) return { mean: null, sd: null, n };
  const m = arr.reduce((a, b) => a + b, 0) / n;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, n - 1);
  return { mean: m, sd: Math.sqrt(v), n };
}

module.exports = {
  ROOT, N, ROW0, ROW1, z32Text, isomorph, pairsOf, satisfies, applyOrder, invert, isPerm, readOrders,
  railOrder, gridColumns, diagLayout, heldoutWindows, choosePairs, nullCipher, nullSet, randomPairs,
  rescore, hamming, quantiles, meanSd, makeRng,
};
