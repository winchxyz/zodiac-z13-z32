'use strict';
/**
 * tools/lm.js - shared English language model for the Zodiac solvers.
 *
 * Letter n-grams (orders 1..6) built by tools/lm_build_ngrams.py from a
 * 112M-letter (training part) mid-20th-century American English corpus, and a word model
 * built by tools/lm_build_words.py from Peter Norvig's Web 1T counts.
 * Formats and formulas: data/lm/meta.json.
 *
 *   const lm = require('./tools/lm');
 *   lm.ngramScore('IHOPEYOUAREHAVINGLOTSOFFUN', 4)  // {sum, perWindow, logp, perChar, ...}
 *   lm.ngram6Score(text)                           // same with n = 6
 *   lm.wordSegment('IHOPEYOUAREHAVINGLOTSOFFUN')   // {words, logp, perChar, unknown}
 *   lm.wordLogp('RADIANS'); lm.isWord('DIABLO');
 *
 * Everything is loaded lazily on first use, so a solver that only needs the
 * 4-gram table pays only for that file.  All log values are base 10.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const LM_DIR = process.env.ZODIAC_LM_DIR || path.join(__dirname, '..', 'data', 'lm');
const P26 = [1, 26, 676, 17576, 456976, 11881376, 308915776];
const NEG = -Infinity;

if (os.endianness() !== 'LE') throw new Error('lm.js: data files are little-endian; big-endian host not supported');

function readTyped(file, Ctor) {
  const b = fs.readFileSync(path.join(LM_DIR, file));
  if (b.byteOffset % Ctor.BYTES_PER_ELEMENT === 0) {
    return new Ctor(b.buffer, b.byteOffset, b.byteLength / Ctor.BYTES_PER_ELEMENT);
  }
  return new Ctor(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/* ------------------------------------------------------------------ encoding */

/** Upper-case A-Z string with every other character removed. */
function cleanText(text) {
  return String(text).toUpperCase().replace(/[^A-Z]/g, '');
}

/** Letters -> Uint8Array of codes 0..25 (A=0).  Arrays of codes pass through. */
function encode(text) {
  if (typeof text !== 'string') {
    if (text instanceof Uint8Array) return text;
    return Uint8Array.from(text);
  }
  const s = cleanText(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) - 65;
  return out;
}

function decode(codes) {
  let s = '';
  for (let i = 0; i < codes.length; i++) s += String.fromCharCode(65 + codes[i]);
  return s;
}

/* ------------------------------------------------------------ n-gram tables */

const _tab = {};
/** Dense Float32Array of joint log10 P(n-gram), n = 1..5, index sum c_i*26^(n-1-i). */
function table(n) {
  if (n < 1 || n > 5) throw new RangeError('table(n): dense tables exist for n = 1..5; use j6() for n = 6');
  if (!_tab[n]) _tab[n] = readTyped(`ngram${n}.bin`, Float32Array);
  return _tab[n];
}

const _cond = {};
/** Dense Float32Array of conditional log10 P(c_{n-1} | c_0..c_{n-2}) = J_n - J_{n-1}. */
function condTable(n) {
  if (_cond[n]) return _cond[n];
  const J = table(n);
  if (n === 1) return (_cond[1] = J);
  const Jp = table(n - 1);
  const out = new Float32Array(J.length);
  for (let i = 0; i < J.length; i++) out[i] = J[i] - Jp[(i / 26) | 0];
  return (_cond[n] = out);
}

let _six = null;
function six() {
  if (_six) return _six;
  const keys = readTyped('ngram6.keys.bin', Uint32Array);
  const vals = readTyped('ngram6.vals.bin', Float32Array);
  const gamma = readTyped('ngram6.gamma.bin', Float32Array);
  // Bucket index on the first four letters; within a bucket keys are sorted by
  // their last two letters (0..675), stored as Uint16 for a cache-friendly search.
  const NB = P26[4];
  const off = new Uint32Array(NB + 1);
  const lo = new Uint16Array(keys.length);
  let b = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const kb = (k / 676) | 0;
    while (b <= kb) off[b++] = i;
    lo[i] = k - kb * 676;
  }
  while (b <= NB) off[b++] = keys.length;
  _six = { keys, vals, gamma, off, lo, J5: table(5), J4: table(4) };
  return _six;
}

/**
 * Joint log10 P of a 6-gram given its index (sum c_i*26^(5-i)).  Stored
 * 6-grams return their table value; any other 6-gram gets the exact backoff
 * J5(h) + G6(h) + J5(g[1:6]) - J4(g[1:5]) (see meta.json), so the result is
 * a proper smoothed probability, never an arbitrary floor.
 */
function j6(idx) {
  const S = _six || six();
  const kb = (idx / 676) | 0;
  const l = idx - kb * 676;
  let a = S.off[kb], z = S.off[kb + 1];
  const lo = S.lo;
  while (a < z) {
    const m = (a + z) >>> 1;
    const v = lo[m];
    if (v < l) a = m + 1;
    else if (v > l) z = m;
    else return S.vals[m];
  }
  const h = (idx / 26) | 0;
  return S.J5[h] + S.gamma[h] + S.J5[idx % 11881376] - S.J4[h % 456976];
}

/** Stored-only lookup: the table value, or NaN when the 6-gram is not stored. */
function j6Stored(idx) {
  const S = _six || six();
  const kb = (idx / 676) | 0;
  const l = idx - kb * 676;
  let a = S.off[kb], z = S.off[kb + 1];
  while (a < z) {
    const m = (a + z) >>> 1;
    const v = S.lo[m];
    if (v < l) a = m + 1; else if (v > l) z = m; else return S.vals[m];
  }
  return NaN;
}

let _d6 = null;
/**
 * Optional dense, byte-quantised 6-gram table for hot solver loops (built on
 * first call in a few seconds, 309 MB; see meta.json load_ms.dense6).  q[idx] = round((J6 - min) / step), clamped to
 * 0..255, with min = -24 and step = 21/255 (about 0.082 log10 units); values
 * below -24 (only never-seen, very un-English 6-grams) are clipped to -24.
 * Decode: J6 ~= min + q * step, so a window sum is min*windows + step*sum(q).
 * opts.shared = true allocates a SharedArrayBuffer that can be posted to
 * worker_threads without copying (the first call decides).
 */
function dense6(opts = {}) {
  if (_d6) return _d6;
  const S = six();
  const J5 = S.J5, J4 = S.J4, G = S.gamma;
  const min = -24, max = -3, step = (max - min) / 255, inv = 1 / step;
  const buf = opts.shared ? new SharedArrayBuffer(P26[6]) : new ArrayBuffer(P26[6]);
  const q = new Uint8Array(buf);
  const quant = (v) => {
    const k = Math.round((v - min) * inv);
    return k < 0 ? 0 : k > 255 ? 255 : k;
  };
  for (let h = 0; h < P26[5]; h++) {
    const mid = h % P26[4];
    const base = J5[h] + G[h] - J4[mid];
    const sb = mid * 26;
    const off = h * 26;
    for (let c = 0; c < 26; c++) q[off + c] = quant(base + J5[sb + c]);
  }
  for (let i = 0; i < S.keys.length; i++) q[S.keys[i]] = quant(S.vals[i]);
  _d6 = { q, min, step, buffer: buf };
  return _d6;
}

/** Joint log10 P of an n-gram index (n = 1..6). */
function jointLogp(idx, n) {
  return n === 6 ? j6(idx) : table(n)[idx];
}

/**
 * Score a text with the order-n letter model.
 *   sum       = sum over the len-n+1 overlapping windows of joint log10 P(window)
 *               (the classic cipher-solver fitness; comparable between texts
 *               of the same length only)
 *   perWindow = sum / windows
 *   logp      = log10 P(text) under the order-n Markov chain
 *               = J_n(first window) + sum_i log10 P(c_i | previous n-1 letters)
 *   perChar   = logp / len   (length-normalised; comparable across lengths)
 * Texts shorter than n are scored with order len.  `text` may be a string
 * (non-letters ignored) or an array of codes 0..25.
 */
function ngramScore(text, n = 4) {
  const c = encode(text);
  const L = c.length;
  if (L === 0) return { n, len: 0, windows: 0, sum: 0, perWindow: 0, logp: 0, perChar: 0 };
  const m = Math.min(n, L);
  if (m < 1 || m > 6) throw new RangeError('ngramScore: n must be 1..6');
  const Jm = m === 6 ? null : table(m);
  const Jp = m > 1 ? table(m - 1) : null;
  const mod = P26[m - 1];
  let idx = 0;
  for (let i = 0; i < m - 1; i++) idx = idx * 26 + c[i];
  let sum = 0, logp = 0;
  for (let i = m - 1; i < L; i++) {
    idx = (idx % mod) * 26 + c[i];      // window c[i-m+1..i]
    const v = Jm ? Jm[idx] : j6(idx);
    sum += v;
    if (i === m - 1) logp += v;                  // joint probability of the first window
    else logp += Jp ? v - Jp[(idx / 26) | 0] : v; // + conditional of each later letter
  }
  const windows = L - m + 1;
  return { n: m, len: L, windows, sum, perWindow: sum / windows, logp, perChar: logp / L };
}

function ngram6Score(text) {
  return ngramScore(text, 6);
}

/** Fast path for solvers: window sum of joint log10 P over codes[start..end). */
function ngramSumCodes(codes, n, start = 0, end = codes.length) {
  if (end - start < n) return 0;
  const J = n === 6 ? null : table(n);
  const mod = P26[n - 1];
  let idx = 0;
  for (let i = start; i < start + n - 1; i++) idx = idx * 26 + codes[i];
  let sum = 0;
  if (J) {
    for (let i = start + n - 1; i < end; i++) { idx = (idx % mod) * 26 + codes[i]; sum += J[idx]; }
  } else {
    for (let i = start + n - 1; i < end; i++) { idx = (idx % mod) * 26 + codes[i]; sum += j6(idx); }
  }
  return sum;
}

/* ---------------------------------------------------------------- word model */

let _wstats = null;
function wordStats() {
  if (!_wstats) _wstats = JSON.parse(fs.readFileSync(path.join(LM_DIR, 'words_stats.json'), 'utf8'));
  return _wstats;
}

let _bigramLines = null;
function bigramLines() {
  if (!_bigramLines) _bigramLines = fs.readFileSync(path.join(LM_DIR, 'bigrams.tsv'), 'latin1').split('\n');
  return _bigramLines;
}

const _vocab = {};
const KEYMUL = 1048576; // 2^20 > number of vocabulary ids

/**
 * Load a vocabulary: 'common' (data/lm/words_common.tsv, default) or 'full'
 * (data/lm/words.tsv, all of Norvig's count_1w).  Probabilities:
 *   P1(w)      = (1 - p_oov) * count(w) / sum of vocabulary counts
 *   P_unk(w)   = p_oov * P_len(|w|) * prod_i P_letter(w_i)
 *   P(w2|w1)   = lam * c2(w1 w2)/c1(w1) + (1 - lam*s(w1)) * P(w2)
 *                with s(w1) = sum over listed bigrams of c2(w1 .)/c1(w1),
 * which is a normalised distribution over all strings for every w1.
 */
function vocab(name = 'common') {
  if (_vocab[name]) return _vocab[name];
  const st = wordStats();
  const prm = st.params[name];
  if (!prm) throw new Error(`unknown vocabulary '${name}' (use 'common' or 'full')`);
  const file = name === 'full' ? 'words.tsv' : 'words_common.tsv';
  const lines = fs.readFileSync(path.join(LM_DIR, file), 'latin1').split('\n');
  const map = new Map();
  const words = [];
  const counts = [];
  let csum = 0, maxLen = 0;
  for (const ln of lines) {
    if (!ln) continue;
    const t = ln.indexOf('\t');
    const w = ln.slice(0, t);
    const c = +ln.slice(t + 1);
    map.set(w, words.length);
    words.push(w);
    counts.push(c);
    csum += c;
    if (w.length > maxLen) maxLen = w.length;
  }
  const size = words.length;
  const START = size; // id of <S>
  const pIn = 1 - prm.p_oov;
  const logp1 = new Float64Array(size);
  const p1 = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    p1[i] = pIn * counts[i] / csum;
    logp1[i] = Math.log10(p1[i]);
  }
  const lam = prm.bigram_lambda;
  const big = new Map();
  const s = new Float64Array(size + 1);
  for (const ln of bigramLines()) {
    if (!ln) continue;
    const p = ln.split('\t');
    const b = map.get(p[1]);
    if (b === undefined) continue;
    let a, base;
    if (p[0] === '<S>') { a = START; base = st.n_sentences; } else {
      a = map.get(p[0]);
      if (a === undefined) continue;
      base = counts[a];
    }
    const r = +p[2] / base;
    big.set(a * KEYMUL + b, r);
    s[a] += r;
  }
  // Web 1T bigram and unigram counts come from separately thresholded lists; where the
  // listed continuations of w1 add up to more than c1(w1), rescale them to sum to 1.
  let rescaled = 0;
  for (const [k, r] of big) {
    const a = Math.floor(k / KEYMUL);
    if (s[a] > 1) big.set(k, r / s[a]);
  }
  for (let i = 0; i <= size; i++) if (s[i] > 1) { s[i] = 1; rescaled++; }
  const logBack = new Float64Array(size + 1);
  for (let i = 0; i <= size; i++) logBack[i] = Math.log10(Math.max(1e-12, 1 - lam * s[i]));
  const J1 = table(1);
  _vocab[name] = {
    name, map, words, counts, csum, size, START, logp1, p1, lam, big, s, logBack, J1, rescaled,
    maxLen: Math.min(maxLen, 24),
    logPoov: Math.log10(prm.p_oov),
    lenLog: prm.oov_len_log10,
  };
  return _vocab[name];
}

function unkLogp(V, w) {
  const L = w.length;
  const ll = V.lenLog;
  let lp = V.logPoov + (L <= ll.length ? ll[L - 1] : ll[ll.length - 1] + (L - ll.length) * Math.log10(0.8));
  for (let i = 0; i < L; i++) lp += V.J1[w.charCodeAt(i) - 65];
  return lp;
}

/** log10 unigram probability of a word (unknown words use the spelling model). */
function wordLogp(word, opts = {}) {
  const V = vocab(opts.vocab || 'common');
  const w = cleanText(word);
  if (!w) return NEG;
  const id = V.map.get(w);
  return id === undefined ? unkLogp(V, w) : V.logp1[id];
}

/** True when the word is in the vocabulary ('common' by default, or 'full'). */
function isWord(word, opts = {}) {
  return vocab(opts.vocab || 'common').map.has(cleanText(word));
}

/** log10 P(word id | previous id) ; ids: >=0 known, -1 unknown (prev) ; V.START for <S>. */
function trans(V, pid, id, unk) {
  if (id < 0) return pid >= 0 ? unk + V.logBack[pid] : unk;
  if (pid < 0) return V.logp1[id];
  const r = V.big.get(pid * KEYMUL + id);
  if (r === undefined) return V.logBack[pid] + V.logp1[id];
  return Math.log10(V.lam * r + (1 - V.lam * V.s[pid]) * V.p1[id]);
}

/**
 * Viterbi segmentation into words under the interpolated bigram model above.
 * opts.vocab: 'common' (default) | 'full'; opts.sentenceStart: treat the text
 * as the start of a sentence (uses <S> bigrams); opts.maxUnknownLen (20).
 * Returns {words, logp, perChar, unknown, unknownWords}.
 */
function wordSegment(text, opts = {}) {
  const V = vocab(opts.vocab || 'common');
  const s = cleanText(text);
  const n = s.length;
  if (n === 0) return { words: [], logp: 0, perChar: 0, unknown: 0, unknownWords: [] };
  const maxU = opts.maxUnknownLen || 20;
  const LL = Math.max(V.maxLen, maxU);
  const W = LL + 1;
  const best = new Float64Array((n + 1) * W).fill(NEG);
  const back = new Int16Array((n + 1) * W);
  const ids = new Int32Array((n + 1) * W);
  // bestBack[i]: best path ending at i followed by a word that has no listed bigram with
  // the previous word (the only case for unknown words), and the length of its last word
  const bestBack = new Float64Array(n + 1).fill(NEG);
  const bestBackL = new Int16Array(n + 1);
  // prefix sums of the unigram letter log-probabilities, for the unknown-word model
  const cum = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) cum[k + 1] = cum[k] + V.J1[s.charCodeAt(k) - 65];
  const ll = V.lenLog;
  for (let j = 1; j <= n; j++) {
    const top = Math.min(j, LL);
    for (let L = 1; L <= top; L++) {
      const i = j - L;
      let id = V.map.get(s.substring(i, j));
      let unk = 0;
      if (id === undefined) {
        if (L > maxU) continue;
        id = -1;
        unk = V.logPoov + (L <= ll.length ? ll[L - 1] : ll[ll.length - 1] + (L - ll.length) * Math.log10(0.8)) +
          (cum[j] - cum[i]);
      }
      let bv = NEG, bp = 0;
      if (i === 0) {
        bv = opts.sentenceStart ? trans(V, V.START, id, unk) : (id >= 0 ? V.logp1[id] : unk);
      } else if (id < 0) {
        bv = unk + bestBack[i];
        bp = bestBackL[i];
      } else {
        const t2 = Math.min(i, LL);
        for (let L2 = 1; L2 <= t2; L2++) {
          const pv = best[i * W + L2];
          if (pv === NEG) continue;
          const v = pv + trans(V, ids[i * W + L2], id, unk);
          if (v > bv) { bv = v; bp = L2; }
        }
      }
      best[j * W + L] = bv;
      back[j * W + L] = bp;
      ids[j * W + L] = id;
      const bb = bv + (id >= 0 ? V.logBack[id] : 0);
      if (bb > bestBack[j]) { bestBack[j] = bb; bestBackL[j] = L; }
    }
  }
  let bL = 0, bv = NEG;
  for (let L = 1; L <= Math.min(n, LL); L++) if (best[n * W + L] > bv) { bv = best[n * W + L]; bL = L; }
  const words = [];
  const unknownWords = [];
  let j = n, L = bL;
  while (j > 0) {
    const w = s.substring(j - L, j);
    words.push(w);
    if (ids[j * W + L] < 0) unknownWords.push(w);
    const pL = back[j * W + L];
    j -= L;
    L = pL;
  }
  words.reverse();
  unknownWords.reverse();
  return { words, logp: bv, perChar: bv / n, unknown: unknownWords.length, unknownWords };
}

/* ------------------------------------------------------------------- exports */

let _meta = null;
function meta() {
  if (!_meta) _meta = JSON.parse(fs.readFileSync(path.join(LM_DIR, 'meta.json'), 'utf8'));
  return _meta;
}

module.exports = {
  LM_DIR, P26,
  cleanText, encode, decode,
  table, condTable, j6, j6Stored, dense6, jointLogp,
  ngramScore, ngram6Score, ngramSumCodes,
  vocab, wordLogp, isWord, wordSegment,
  meta,
  /** Preload components: lm.load({ngrams:[2,3,4,5], six:true, words:'common'}) */
  load(opts = {}) {
    for (const n of opts.ngrams || [1, 2, 3, 4, 5]) table(n);
    if (opts.six !== false) six();
    if (opts.words !== false) vocab(typeof opts.words === 'string' ? opts.words : 'common');
  },
};
