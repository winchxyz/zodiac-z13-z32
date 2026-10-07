'use strict';
/**
 * tools/keyprior_lib.js - shared helpers for the `keyprior` task: does Z13 or Z32
 * reuse all or part of a known Zodiac key (Z408, Z340), and do Z13 and Z32 share a key?
 *
 *   const K = require('./keyprior_lib');
 *   K.key('z408')                     // Map symbol -> letter ('z340', 'union' = Z408 letter where it exists, else Z340)
 *   K.cipherText('z32.canonical')     // variant string from data/ciphers/variants/<id>.txt ('z32.reversed' is generated)
 *   K.permuteKey(map, rng)            // null key: the same symbols, the key's own letters shuffled among them
 *   K.iidKey(map, rng)                // null key: each symbol gets a letter drawn from the key's letter multiset
 *   const sc = K.makeScorer(text)     // the anneal.js objective (--wordweight 1, fast word model, 5-grams, entropy 0.5)
 *   sc.score(keyCodes)                // keyCodes[symbolId] = 0..25, symbol ids in first-occurrence order (cipher.js symbolTable)
 *   K.exhaustiveBest(sc, fixed, 3)    // best keys over every assignment of the free symbols (fixed[s] = -1)
 *
 * The objective equals tools/solvercore.js scoreKey() for a problem built by anneal.makeProblem with
 * {mode: homophonic, n: 5, score: joint, entropy: 0.5, wordweight: 1, wordmodel: fast, vocab: common};
 * tools/keyprior_selftest.js checks this on random keys.
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');
const A = require('./anneal');
const WF = require('./wordfast');
const lm = require('./lm');
const core = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function readJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

const _keys = {};
/** Known keys as Map symbol -> letter. */
function key(name) {
  if (_keys[name]) return _keys[name];
  const k408 = readJSON('data/ciphers/z408.json').key;
  const k340 = readJSON('data/ciphers/z340.json').key;
  let m;
  if (name === 'z408') m = new Map(Object.entries(k408));
  else if (name === 'z340') m = new Map(Object.entries(k340));
  else if (name === 'union') {
    m = new Map(Object.entries(k408));
    for (const [s, l] of Object.entries(k340)) if (!m.has(s)) m.set(s, l);
  } else throw new Error(`unknown key '${name}' (z408 | z340 | union)`);
  for (const [s, l] of m) if (!/^[A-Z]$/.test(l)) throw new Error(`key ${name}: bad letter for ${s}`);
  _keys[name] = m;
  return m;
}

/** Cipher string for a certified variant id (README "Open transcription questions"). */
function cipherText(id) {
  if (id === 'z13.letters_literal') return cipherText('z13.canonical');
  if (id === 'z32.reversed') return cipherText('z32.canonical').split('').reverse().join('');
  const f = path.join(ROOT, 'data', 'ciphers', 'variants', `${id}.txt`);
  if (!fs.existsSync(f)) throw new Error(`no variant file ${f}`);
  return fs.readFileSync(f, 'latin1').replace(/\s+/g, '');
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** Null key: same symbols, the key's letters permuted among them (keeps the letter distribution exactly). */
function permuteKey(m, rng) {
  const syms = [...m.keys()];
  const lets = shuffle([...m.values()], rng);
  return new Map(syms.map((s, i) => [s, lets[i]]));
}

/** Null key: every symbol gets an independent draw from the key's letter multiset. */
function iidKey(m, rng) {
  const syms = [...m.keys()];
  const lets = [...m.values()];
  return new Map(syms.map((s) => [s, lets[rng.int(lets.length)]]));
}

function nullKey(kind, m, rng) {
  if (kind === 'permute') return permuteKey(m, rng);
  if (kind === 'iid') return iidKey(m, rng);
  throw new Error(`unknown null kind ${kind}`);
}

/** Symbols of `text` that the key covers, in first-occurrence order. */
function overlap(text, m) {
  const { symbols } = C.symbolTable(text);
  return symbols.filter((s) => m.has(s));
}

/**
 * Scorer for one cipher text: the anneal.js objective with the word term.
 * opts: {n: 5, entropy: 0.5, wordweight: 1, ngramweight: 1, vocab: 'common', J: Float32Array (shared 5-gram table, optional)}
 * statOpts('word') = {ngramweight: 0, entropy: 0, wordweight: 1}: the fast word-segmentation log10 P alone.
 */
function makeScorer(text, opts = {}) {
  const { symbols, idOf, ids } = C.symbolTable(text);
  const L = text.length, S = symbols.length;
  const n = Math.min(opts.n || 5, L);
  const J = opts.J || lm.table(n);
  const entW = opts.entropy == null ? 0.5 : +opts.entropy;
  const entTarget = entW ? A.expectedEntropy(L) : 0;
  const wordW = opts.wordweight == null ? 1 : +opts.wordweight;
  const ngW = opts.ngramweight == null ? 1 : +opts.ngramweight;   // 0 = word term only (the 'word' statistic)
  const F = wordW ? WF.build(opts.vocab || 'common') : null;
  const pt = new Uint8Array(L);
  const cnt = new Int32Array(26);
  const nlogn = new Float64Array(L + 1);
  for (let k = 1; k <= L; k++) nlogn[k] = k * Math.log2(k);
  const log2L = Math.log2(L);
  const nWin = L - n + 1;
  let last = { ngram: 0, pen: 0, word: 0 };
  function score(keyCodes) {
    cnt.fill(0);
    for (let i = 0; i < L; i++) { const c = keyCodes[ids[i]]; pt[i] = c; cnt[c]++; }
    let ng = 0;
    if (ngW) {
      for (let w = 0; w < nWin; w++) {
        let idx = 0;
        for (let j = 0; j < n; j++) idx = idx * 26 + pt[w + j];
        ng += J[idx];
      }
      ng *= ngW;
    }
    let pen = 0;
    if (entW) {
      let s = 0;
      for (let l = 0; l < 26; l++) s += nlogn[cnt[l]];
      const H = log2L - s / L;
      if (H < entTarget) pen = -entW * L * (entTarget - H);
    }
    const word = wordW ? wordW * WF.logpCodes(F, pt, L) : 0;
    last = { ngram: ng, pen, word };
    return ng + pen + word;
  }
  function decode(keyCodes) {
    let s = '';
    for (let i = 0; i < L; i++) s += LETTERS[keyCodes[ids[i]]];
    return s;
  }
  /** fixed array (Int8Array, -1 = free) from a Map symbol -> letter */
  function fixedFrom(m) {
    const f = new Int8Array(S).fill(-1);
    for (let s = 0; s < S; s++) if (m.has(symbols[s])) f[s] = m.get(symbols[s]).charCodeAt(0) - 65;
    return f;
  }
  return { text, symbols, idOf, ids, L, S, n, score, decode, fixedFrom, components: () => last, entTarget };
}

/** Exhaustive search over the free symbols (fixed[s] < 0). Returns the topK {score, key (string), plaintext}. */
function exhaustiveBest(sc, fixed, topK = 3) {
  const S = sc.S;
  const free = [];
  for (let s = 0; s < S; s++) if (fixed[s] < 0) free.push(s);
  const key = new Int8Array(S);
  for (let s = 0; s < S; s++) key[s] = fixed[s] < 0 ? 0 : fixed[s];
  const f = free.length;
  if (f > 5) throw new Error(`exhaustiveBest: ${f} free symbols is too many`);
  const top = [];
  const consider = (v) => {
    if (top.length >= topK && v <= top[top.length - 1].score) return;
    top.push({ score: v, key: core.keyString(key) });
    top.sort((a, b) => b.score - a.score);
    if (top.length > topK) top.pop();
  };
  consider(sc.score(key));
  let evals = 1;
  if (f > 0) {
    // odometer over the free symbols
    for (;;) {
      let i = 0;
      while (i < f) {
        const s = free[i];
        if (key[s] < 25) { key[s]++; break; }
        key[s] = 0; i++;
      }
      if (i === f) break;
      consider(sc.score(key));
      evals++;
    }
  }
  for (const t of top) {
    const k = Int8Array.from(t.key, (ch) => ch.charCodeAt(0) - 65);
    t.plaintext = sc.decode(k);
  }
  return { top, evals, free: free.map((s) => sc.symbols[s]) };
}

/** Exact word segmentation and 5-gram score of a plaintext, for reporting. */
function describe(pt) {
  const ws = lm.wordSegment(pt);
  const ng = lm.ngramScore(pt, Math.min(5, pt.length));
  return { plaintext: pt, words: ws.words.join(' '), wordLogp: ws.logp, unknownWords: ws.unknownWords, ngram5: ng.sum };
}

/** Empirical upper-tail p-value: P(null >= real), with the +1 correction. */
function upperP(real, nullVals) {
  let ge = 0;
  for (const v of nullVals) if (v >= real - 1e-9) ge++;
  return { ge, n: nullVals.length, p: (ge + 1) / (nullVals.length + 1), percentile: 100 * (1 - ge / nullVals.length) };
}

function summary(vals) {
  const v = vals.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: vals.length, finite: 0 };
  const q = (p) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, v.length - 1));
  return { n: vals.length, finite: v.length, mean, sd, min: v[0], q05: q(0.05), q25: q(0.25), median: q(0.5), q75: q(0.75), q95: q(0.95), q99: q(0.99), max: v[v.length - 1] };
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const nx = argv[i + 1];
    if (nx == null || nx.startsWith('--')) o[k] = true;
    else { o[k] = nx; i++; }
  }
  return o;
}

function writeJSON(rel, obj) {
  const f = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(obj, null, 1));
}

/** Scorer options for a named statistic: 'objective' (anneal.js objective) or 'word' (word log10 P only). */
function statOpts(stat) {
  if (!stat || stat === 'objective') return {};
  if (stat === 'word') return { ngramweight: 0, entropy: 0, wordweight: 1 };
  throw new Error(`unknown statistic ${stat}`);
}

module.exports = {
  statOpts, ROOT, LETTERS, readJSON, key, cipherText, shuffle, permuteKey, iidKey, nullKey, overlap,
  makeScorer, exhaustiveBest, describe, upperP, summary, parseArgs, writeJSON, makeRng: core.makeRng,
};
