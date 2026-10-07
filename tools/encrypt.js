'use strict';
/**
 * tools/encrypt.js - Zodiac-style homophonic encryption for null-model and
 * solver experiments.
 *
 * Key construction (makeKey):
 *   alloc 'proportional' (default): every letter that occurs in the plaintext (or all
 *     26 with allLetters) gets one symbol; the remaining symbols go to letters in
 *     proportion to English letter frequency (data/lm/meta.json), by largest remainder.
 *   alloc 'uniform': symbols spread evenly over the letters.
 *   alloc 'simple': exactly one symbol per letter (a simple substitution).
 *   Symbols are drawn at random from SYMBOLS (86 printable ASCII characters).
 * Homophone selection (encrypt):
 *   'cycle' (default): each letter steps through its homophones in order, like the
 *     Zodiac mostly did in Z408 and Z340; the starting homophone of each letter is
 *     random unless startZero.
 *   'random': a homophone drawn at random for every occurrence.
 *
 * CLI:
 *   node tools/encrypt.js --plaintext "I LIKE KILLING PEOPLE" [--symbols 63] [--alloc proportional|uniform|simple]
 *        [--select cycle|random] [--all-letters] [--start-zero] [--seed 1] [--key KEYFILE|"E=abc,T=de"] [--out file.json]
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const { makeRng } = require('./solvercore');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+-./:;<=>?@[]^_|~';

function englishFreq() {
  const f = lm.meta().ngrams.letter_frequencies;
  return LETTERS.split('').map((c) => f[c]);
}

/** Largest-remainder allocation of `total` symbols to `letters` with weights, minimum 1 each. */
function allocate(letters, weights, total) {
  const n = letters.length;
  if (total < n) throw new Error(`need at least ${n} symbols for ${n} letters, got ${total}`);
  const alloc = new Array(n).fill(1);
  const extra = total - n;
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const quota = weights.map((w) => (w / wsum) * extra);
  let given = 0;
  for (let i = 0; i < n; i++) { const k = Math.floor(quota[i]); alloc[i] += k; given += k; }
  const order = quota.map((q, i) => [q - Math.floor(q), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; given < extra; k++, given++) alloc[order[k % n][1]]++;
  return alloc;
}

/**
 * Make a key: {letter: [symbols...]}.
 * opts: {symbols (count, default 63), alloc, allLetters, plaintext, rng, seed, alphabet}
 */
function makeKey(opts = {}) {
  const rng = opts.rng || makeRng(opts.seed == null ? 1 : opts.seed, 0x6b6579);
  const alphabet = (opts.alphabet || SYMBOLS).split('');
  const pt = String(opts.plaintext || '').toUpperCase().replace(/[^A-Z]/g, '');
  const present = new Set(pt);
  const letters = LETTERS.split('').filter((c) => opts.allLetters || !pt || present.has(c));
  const alloc = opts.alloc || 'proportional';
  let counts;
  if (alloc === 'simple') counts = letters.map(() => 1);
  else {
    const total = Math.min(+opts.symbols || 63, alphabet.length);
    if (alloc === 'uniform') counts = allocate(letters, letters.map(() => 1), total);
    else if (alloc === 'proportional') {
      const f = englishFreq();
      counts = allocate(letters, letters.map((c) => f[c.charCodeAt(0) - 65]), total);
    } else throw new Error(`unknown alloc '${alloc}'`);
  }
  const need = counts.reduce((a, b) => a + b, 0);
  if (need > alphabet.length) throw new Error(`alphabet has only ${alphabet.length} symbols`);
  for (let i = alphabet.length - 1; i > 0; i--) { const j = rng.int(i + 1); const t = alphabet[i]; alphabet[i] = alphabet[j]; alphabet[j] = t; }
  const key = {};
  let k = 0;
  letters.forEach((c, i) => { key[c] = alphabet.slice(k, k + counts[i]); k += counts[i]; });
  return key;
}

/** Parse a key given as JSON ({"E":["a","b"]} or {"E":"ab"}), a file, or "E=ab,T=c". */
function parseLetterKey(spec) {
  if (spec && typeof spec === 'object') {
    const o = {};
    for (const [l, v] of Object.entries(spec)) o[l.toUpperCase()] = Array.isArray(v) ? v.slice() : String(v).split('');
    return o;
  }
  let s = String(spec);
  if (fs.existsSync(s) && fs.statSync(s).isFile()) s = fs.readFileSync(s, 'latin1');
  if (s.trim().startsWith('{')) {
    const j = JSON.parse(s);
    return parseLetterKey(j.key && typeof j.key === 'object' ? j.key : j);
  }
  const o = {};
  for (const part of s.split(/\s+|,(?=[A-Za-z]=)/).filter(Boolean)) {
    const m = /^([A-Za-z])=(.+)$/.exec(part);
    if (!m) throw new Error(`key entry '${part}': expected LETTER=symbols`);
    o[m[1].toUpperCase()] = m[2].split('');
  }
  return o;
}

/**
 * Encrypt.  opts: {select: 'cycle'|'random', startZero, rng, seed}
 * Returns {cipher, plaintext, used: {letter: [symbols used]}}.
 */
function encrypt(plaintext, key, opts = {}) {
  const rng = opts.rng || makeRng(opts.seed == null ? 1 : opts.seed, 0x656e63);
  const pt = String(plaintext).toUpperCase().replace(/[^A-Z]/g, '');
  const select = opts.select || 'cycle';
  const ptr = {};
  for (const l of Object.keys(key)) ptr[l] = opts.startZero ? 0 : rng.int(key[l].length);
  let out = '';
  for (const ch of pt) {
    const hs = key[ch];
    if (!hs || !hs.length) throw new Error(`key has no symbol for letter ${ch}`);
    let sym;
    if (select === 'random') sym = hs[rng.int(hs.length)];
    else { sym = hs[ptr[ch] % hs.length]; ptr[ch]++; }
    out += sym;
  }
  // sanity: the symbol sets of different letters must be disjoint
  const owner = new Map();
  for (const [l, hs] of Object.entries(key)) for (const s of hs) {
    if (owner.has(s) && owner.get(s) !== l) throw new Error(`symbol '${s}' assigned to ${owner.get(s)} and ${l}`);
    owner.set(s, l);
  }
  return { cipher: out, plaintext: pt };
}

/** Convenience: make a key for this plaintext and encrypt it. */
function encryptText(plaintext, opts = {}) {
  const rng = opts.rng || makeRng(opts.seed == null ? 1 : opts.seed, 0x7a6f64);
  const key = opts.key ? parseLetterKey(opts.key) : makeKey(Object.assign({}, opts, { plaintext, rng }));
  const r = encrypt(plaintext, key, Object.assign({}, opts, { rng }));
  const distinct = new Set(r.cipher).size;
  return { cipher: r.cipher, plaintext: r.plaintext, key, distinctSymbols: distinct, length: r.cipher.length };
}

function main() {
  const argv = process.argv.slice(2);
  const o = {};
  const flags = new Set(['all-letters', 'start-zero', 'help']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (flags.has(k)) o[k] = true; else o[k] = argv[++i];
  }
  if (o.help || !(o.plaintext || o['plaintext-file'])) {
    console.log('node tools/encrypt.js --plaintext TEXT | --plaintext-file F [--symbols 63] [--alloc proportional|uniform|simple] [--select cycle|random] [--all-letters] [--start-zero] [--seed N] [--key KEY] [--out file.json]');
    return;
  }
  const text = o.plaintext || fs.readFileSync(o['plaintext-file'], 'utf8');
  const r = encryptText(text, {
    symbols: o.symbols ? +o.symbols : 63, alloc: o.alloc || 'proportional', select: o.select || 'cycle',
    allLetters: !!o['all-letters'], startZero: !!o['start-zero'], seed: o.seed != null ? +o.seed : 1, key: o.key,
  });
  const out = {
    id: o.id || 'synthetic', ascii: r.cipher, plaintext_aligned: r.plaintext, length: r.length, distinctSymbols: r.distinctSymbols,
    key: Object.fromEntries(Object.entries(r.key).map(([l, hs]) => [l, hs.join('')])),
    options: { symbols: o.symbols ? +o.symbols : 63, alloc: o.alloc || 'proportional', select: o.select || 'cycle', seed: o.seed != null ? +o.seed : 1 },
  };
  if (o.out) {
    fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
    fs.writeFileSync(o.out, JSON.stringify(out, null, 1));
    console.log(`wrote ${o.out}`);
  }
  console.log(r.cipher);
}

module.exports = { SYMBOLS, makeKey, encrypt, encryptText, parseLetterKey, allocate, englishFreq };

if (require.main === module) main();
