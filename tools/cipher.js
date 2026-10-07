'use strict';
/**
 * tools/cipher.js - cipher utilities for the Zodiac solvers (CommonJS, Node 24).
 *
 * A cipher is a string of one-character ASCII symbols in the transcription
 * convention of Oranchak's webtoy / CipherExplorer / AZdecrypt (see
 * data/ciphers/*.json).  Whitespace is never a symbol and is stripped.
 *
 * Library:
 *   const C = require('./cipher');
 *   const ci = C.loadCipher('data/ciphers/z13.json');   // or a .txt file, or a raw string
 *   C.isomorph(ci.text)                  // 'abcdefegehcag'
 *   C.symbolCounts(ci.text)              // [{symbol, count, positions}], most frequent first
 *   C.applyKey(ci.text, C.parseKey('A=M,E=Y'))
 *   C.applyReadOrder(ci.text, order)     // order[k] = written index read k-th
 *   C.checkCandidate(ci.text, 'MYNAMEISXXXXX', {mode: 'simple'})
 *
 * CLI (run with no arguments for help):
 *   node tools/cipher.js info  <cipher>
 *   node tools/cipher.js check <cipher> <PLAINTEXT> [--mode homophonic|simple] [--readorder <file>]
 *   node tools/cipher.js apply <cipher> --key "A=M,E=Y,..." [--readorder <file>]
 *   node tools/cipher.js reorder <cipher> --readorder <file>
 */
const fs = require('fs');
const path = require('path');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ISO_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+-./:;<=>?@[]^_{|}~';

/* ------------------------------------------------------------------ loading */

function stripWs(s) {
  return String(s).replace(/\s+/g, '');
}

/** Find the first value under any of the given keys, searching nested objects breadth-first. */
function findKey(obj, keys) {
  const q = [obj];
  while (q.length) {
    const o = q.shift();
    if (!o || typeof o !== 'object') continue;
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] != null) return o[k];
    for (const v of Object.values(o)) if (v && typeof v === 'object' && !Array.isArray(v)) q.push(v);
  }
  return undefined;
}

function textOf(v) {
  if (v == null) return undefined;
  if (Array.isArray(v)) return stripWs(v.join(''));
  if (typeof v === 'string') return stripWs(v);
  return undefined;
}

/**
 * Load a cipher.  `spec` is a path to a .json file (fields: ascii | ciphertext |
 * cipher | rows; optional read_order, plaintext), a path to a text file (rows of
 * symbols), or a raw cipher string.  Returns
 *   {id, text, rows, readOrder, plaintext, plaintextReadOrder, source, json}
 * `text` is in written order.  `plaintext` (if present) is aligned with `text`;
 * `plaintextReadOrder` (if present) is the plaintext in reading order.
 */
function loadCipher(spec, opts = {}) {
  if (spec && typeof spec === 'object' && spec.text) return spec;
  const s = String(spec);
  let isFile = false;
  try { isFile = s.length < 4096 && fs.existsSync(s) && fs.statSync(s).isFile(); } catch (e) { isFile = false; }
  if (!isFile) {
    const text = stripWs(s);
    if (!text) throw new Error('loadCipher: empty cipher');
    return { id: opts.id || 'raw', text, rows: [text], readOrder: null, plaintext: null, plaintextReadOrder: null, source: 'raw string', json: null };
  }
  const raw = fs.readFileSync(s, 'latin1');
  if (/\.json$/i.test(s)) {
    const j = JSON.parse(raw);
    const rows = findKey(j, ['rows']);
    let text = textOf(findKey(j, ['ascii', 'ciphertext', 'cipher', 'text']));
    if (!text && Array.isArray(rows)) text = stripWs(rows.join(''));
    if (!text) throw new Error(`loadCipher: no ascii/ciphertext/rows field in ${s}`);
    let ro = findKey(j, ['read_order', 'readOrder', 'readorder', 'reading_order']);
    if (ro && !Array.isArray(ro)) ro = Array.isArray(ro.order) ? ro.order : null;
    if (Array.isArray(ro)) ro = normaliseOrder(ro, text.length);
    // Plaintext aligned with the written text, and/or in reading order.
    let pt = textOf(findKey(j, ['plaintext_aligned', 'plaintext_written_order', 'plaintext_ascii_aligned']));
    let ptRead = textOf(findKey(j, ['plaintext_read_order', 'plaintext_reading_order']));
    const ptAny = textOf(findKey(j, ['plaintext', 'solution', 'plaintext_ascii']));
    if (!pt && !ptRead && ptAny) {
      if (ro) ptRead = ptAny; else pt = ptAny;
    }
    if (pt) pt = pt.toUpperCase();
    if (ptRead) ptRead = ptRead.toUpperCase();
    if (!pt && ptRead && ro && ptRead.length === ro.length) {
      const a = new Array(text.length).fill('?');
      for (let k = 0; k < ro.length; k++) a[ro[k]] = ptRead[k];
      pt = a.join('');
    }
    if (pt && ro && !ptRead) ptRead = ro.map((i) => pt[i]).join('');
    return {
      id: j.id || path.basename(s, '.json'), text,
      rows: Array.isArray(rows) ? rows : [text], readOrder: ro || null,
      plaintext: pt || null, plaintextReadOrder: ptRead || null, source: s, json: j,
    };
  }
  const rows = raw.replace(/\r/g, '').split('\n').map(stripWs).filter(Boolean);
  const text = rows.join('');
  return { id: opts.id || path.basename(s).replace(/\.[^.]+$/, ''), text, rows, readOrder: null, plaintext: null, plaintextReadOrder: null, source: s, json: null };
}

/** 1-based orders (min 1, max len) become 0-based; everything is coerced to integers. */
function normaliseOrder(order, len) {
  const o = order.map((x) => Math.round(Number(x)));
  if (o.some((x) => !Number.isFinite(x))) throw new Error('read order: non-numeric entry');
  const mn = Math.min(...o), mx = Math.max(...o);
  if (mn === 1 && mx === len && !o.includes(0)) return o.map((x) => x - 1);
  if (mn < 0 || mx >= len) throw new Error(`read order: index out of range 0..${len - 1}`);
  return o;
}

/**
 * Parse a read order: a file (.json array, {read_order:[...]}, or whitespace /
 * comma separated integers) or an inline "3,1,2" / "[3,1,2]" string.
 * order[k] = index in written order of the k-th symbol read.
 */
function parseReadOrder(spec, len) {
  if (Array.isArray(spec)) return normaliseOrder(spec, len);
  let raw = String(spec);
  if (fs.existsSync(raw) && fs.statSync(raw).isFile()) raw = fs.readFileSync(raw, 'utf8');
  raw = raw.trim();
  let arr;
  if (raw.startsWith('[') || raw.startsWith('{')) {
    const j = JSON.parse(raw);
    arr = Array.isArray(j) ? j : findKey(j, ['read_order', 'readOrder', 'readorder', 'order']);
    if (!Array.isArray(arr)) throw new Error('read order JSON has no array');
  } else {
    arr = raw.split(/[\s,;]+/).filter(Boolean).map(Number);
  }
  return normaliseOrder(arr, len);
}

/** Reorder a symbol string (or array): out[k] = text[order[k]]. */
function applyReadOrder(text, order) {
  const out = new Array(order.length);
  for (let k = 0; k < order.length; k++) out[k] = text[order[k]];
  return typeof text === 'string' ? out.join('') : out;
}

/** Order diagnostics: is it a permutation of 0..len-1? */
function orderInfo(order, len) {
  const seen = new Uint8Array(len);
  let dup = 0;
  for (const i of order) { if (seen[i]) dup++; seen[i] = 1; }
  let missing = 0;
  for (let i = 0; i < len; i++) if (!seen[i]) missing++;
  return { length: order.length, permutation: dup === 0 && missing === 0 && order.length === len, duplicates: dup, missing };
}

/* ----------------------------------------------------------------- analysis */

/** Pattern of first occurrences: 'AENz0K0M0[NAM' -> 'abcdefegehcag'. */
function isomorph(text) {
  const m = new Map();
  let out = '';
  for (const ch of text) {
    if (!m.has(ch)) m.set(ch, ISO_CHARS[m.size] || '~');
    out += m.get(ch);
  }
  return out;
}

/** [{symbol, count, positions}] sorted by count (desc), then first occurrence. */
function symbolCounts(text) {
  const m = new Map();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!m.has(ch)) m.set(ch, { symbol: ch, count: 0, positions: [], first: i });
    const e = m.get(ch);
    e.count++;
    e.positions.push(i);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.first - b.first).map(({ symbol, count, positions }) => ({ symbol, count, positions }));
}

/** Distinct symbols in first-occurrence order and the text as symbol ids. */
function symbolTable(text) {
  const symbols = [];
  const idOf = new Map();
  const ids = new Uint16Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!idOf.has(ch)) { idOf.set(ch, symbols.length); symbols.push(ch); }
    ids[i] = idOf.get(ch);
  }
  return { symbols, idOf, ids };
}

/** Index of coincidence of a symbol or letter sequence. */
function ioc(text) {
  const m = new Map();
  for (const ch of text) m.set(ch, (m.get(ch) || 0) + 1);
  let s = 0;
  for (const v of m.values()) s += v * (v - 1);
  const L = text.length;
  return L > 1 ? s / (L * (L - 1)) : 0;
}

/* ---------------------------------------------------------------------- keys */

/**
 * Parse a key "SYM=L,SYM=L" (each SYM is exactly one character, so '=' and ','
 * work as symbols: "==E,,=T"), a JSON object string, a JSON file, or an object.
 * Returns Map symbol -> upper-case letter.
 */
function parseKey(spec) {
  const out = new Map();
  if (spec == null || spec === '') return out;
  if (spec instanceof Map) return new Map(spec);
  if (typeof spec === 'object') {
    for (const [k, v] of Object.entries(spec)) out.set(k, String(v).toUpperCase());
    return out;
  }
  let s = String(spec);
  if (s.length < 4096 && fs.existsSync(s) && fs.statSync(s).isFile()) s = fs.readFileSync(s, 'latin1');
  const t = s.trim();
  if (t.startsWith('{')) return parseKey(JSON.parse(t));
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i]) && !(s[i + 1] === '=' && s[i] === ',')) i++;
    if (i >= s.length) break;
    const sym = s[i];
    if (s[i + 1] !== '=') throw new Error(`parseKey: expected '=' after symbol '${sym}' at offset ${i} in "${s}"`);
    const L = (s[i + 2] || '').toUpperCase();
    if (!/[A-Z]/.test(L)) throw new Error(`parseKey: expected a letter after '${sym}=' at offset ${i}`);
    if (out.has(sym) && out.get(sym) !== L) throw new Error(`parseKey: symbol '${sym}' given two letters`);
    out.set(sym, L);
    i += 3;
  }
  return out;
}

function keyToObject(key) {
  const o = {};
  for (const [k, v] of key) o[k] = v;
  return o;
}

function keyToString(key) {
  return [...key].map(([k, v]) => `${k}=${v}`).join(',');
}

/** Decrypt: every symbol replaced by its letter; unmapped symbols become '?'. */
function applyKey(text, key) {
  const k = key instanceof Map ? key : parseKey(key);
  let out = '';
  for (const ch of text) out += k.has(ch) ? k.get(ch) : '?';
  return out;
}

/** Map letter -> sorted array of distinct symbols that decrypt to it. */
function symbolsPerLetter(key) {
  const m = {};
  for (const [s, l] of key) (m[l] = m[l] || []).push(s);
  for (const l of Object.keys(m)) m[l].sort();
  return m;
}

/**
 * Check a candidate plaintext against a ciphertext (both in the same order).
 *   mode 'homophonic': every symbol must always stand for the same letter.
 *   mode 'simple':     additionally, different symbols must stand for different letters.
 * Plaintext characters other than A-Z (e.g. '?') are wildcards and are skipped.
 * Returns {ok, mode, lengthMatch, conflicts, injectivityConflicts, key, symbolsPerLetter,
 *          symbolsPerLetterCount, distinctSymbols, distinctLetters}.
 */
function checkCandidate(cipherText, plain, opts = {}) {
  const mode = opts.mode || 'homophonic';
  const p = String(plain).toUpperCase().replace(/\s+/g, '');
  const lengthMatch = p.length === cipherText.length;
  const n = Math.min(p.length, cipherText.length);
  const seen = new Map(); // sym -> Map letter -> positions
  for (let i = 0; i < n; i++) {
    const L = p[i];
    if (!/[A-Z]/.test(L)) continue;
    const s = cipherText[i];
    if (!seen.has(s)) seen.set(s, new Map());
    const m = seen.get(s);
    if (!m.has(L)) m.set(L, []);
    m.get(L).push(i);
  }
  const conflicts = [];
  const key = new Map();
  for (const [s, m] of seen) {
    if (m.size > 1) conflicts.push({ symbol: s, letters: Object.fromEntries([...m].map(([l, ps]) => [l, ps])) });
    // majority letter as the key entry
    let best = null, bc = -1;
    for (const [l, ps] of m) if (ps.length > bc) { bc = ps.length; best = l; }
    key.set(s, best);
  }
  const spl = symbolsPerLetter(key);
  const injectivityConflicts = [];
  for (const [l, syms] of Object.entries(spl)) if (syms.length > 1) injectivityConflicts.push({ letter: l, symbols: syms });
  const ok = lengthMatch && conflicts.length === 0 && (mode !== 'simple' || injectivityConflicts.length === 0);
  const splCount = {};
  for (const [l, syms] of Object.entries(spl)) splCount[l] = syms.length;
  return {
    ok, mode, lengthMatch, cipherLength: cipherText.length, plainLength: p.length,
    conflicts, injectivityConflicts: mode === 'simple' ? injectivityConflicts : injectivityConflicts,
    key: keyToObject(key), symbolsPerLetter: spl, symbolsPerLetterCount: splCount,
    distinctSymbols: new Set(cipherText.slice(0, n)).size, distinctLetters: Object.keys(spl).length,
  };
}

/** Fast boolean consistency test of a plaintext (letters only) against a cipher. */
function consistent(cipherText, plain, mode = 'homophonic') {
  if (plain.length !== cipherText.length) return false;
  const k = new Map();
  const used = new Map();
  for (let i = 0; i < plain.length; i++) {
    const s = cipherText[i], L = plain[i];
    const cur = k.get(s);
    if (cur === undefined) {
      if (mode === 'simple') {
        if (used.has(L)) return false;
        used.set(L, s);
      }
      k.set(s, L);
    } else if (cur !== L) return false;
  }
  return true;
}

/* ----------------------------------------------------------------------- CLI */

function parseArgs(argv) {
  const pos = [];
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const nx = argv[i + 1];
      if (nx === undefined || nx.startsWith('--')) o[k] = true; else { o[k] = nx; i++; }
    } else pos.push(a);
  }
  return { pos, o };
}

const HELP = `tools/cipher.js - cipher utilities

  node tools/cipher.js info    <cipher> [--readorder <file>]
  node tools/cipher.js check   <cipher> <PLAINTEXT> [--mode homophonic|simple] [--readorder <file>]
  node tools/cipher.js apply   <cipher> --key "A=M,E=Y" [--readorder <file>]
  node tools/cipher.js reorder <cipher> --readorder <file>

<cipher> is a cipher JSON (data/ciphers/z13.json), a text file of rows, or a raw string.
With --readorder (or a read_order field in the JSON, unless --written is given) the
cipher is read in that order first, and PLAINTEXT is in reading order.`;

function main() {
  const { pos, o } = parseArgs(process.argv.slice(2));
  const cmd = pos[0];
  if (!cmd || o.help) { console.log(HELP); return; }
  const ci = loadCipher(pos[1]);
  let text = ci.text;
  let order = null;
  if (o.readorder) order = parseReadOrder(o.readorder, ci.text.length);
  else if (ci.readOrder && !o.written) order = ci.readOrder;
  if (order) text = applyReadOrder(ci.text, order);
  if (cmd === 'info') {
    const counts = symbolCounts(text);
    const out = {
      id: ci.id, source: ci.source, length: text.length, distinctSymbols: counts.length,
      readOrder: order ? orderInfo(order, ci.text.length) : null,
      text, isomorph: isomorph(text), ioc: ioc(text),
      counts: counts.map((c) => ({ symbol: c.symbol, count: c.count, positions: c.positions })),
      repeats: counts.filter((c) => c.count > 1).length,
      plaintext: order ? (ci.plaintext && ci.plaintext.length === ci.text.length ? applyReadOrder(ci.plaintext, order) : ci.plaintextReadOrder) : ci.plaintext,
    };
    if (out.plaintext) {
      const chk = checkCandidate(text, out.plaintext, { mode: 'homophonic' });
      out.plaintextCheck = { homophonicConsistent: chk.ok, conflicts: chk.conflicts, symbolsPerLetterCount: chk.symbolsPerLetterCount };
    }
    console.log(JSON.stringify(out, null, 1));
  } else if (cmd === 'check') {
    const r = checkCandidate(text, pos[2] || '', { mode: o.mode || 'homophonic' });
    console.log(JSON.stringify(r, null, 1));
    process.exitCode = r.ok ? 0 : 1;
  } else if (cmd === 'apply') {
    const key = parseKey(o.key);
    console.log(applyKey(text, key));
  } else if (cmd === 'reorder') {
    console.log(text);
  } else {
    console.log(HELP);
    process.exitCode = 2;
  }
}

module.exports = {
  LETTERS, loadCipher, parseReadOrder, normaliseOrder, applyReadOrder, orderInfo,
  isomorph, symbolCounts, symbolTable, ioc,
  parseKey, keyToObject, keyToString, applyKey, symbolsPerLetter, checkCandidate, consistent,
  parseArgs,
};

if (require.main === module) main();
