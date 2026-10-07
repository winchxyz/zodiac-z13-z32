'use strict';
/**
 * tools/lead_replicate_lib.js - fresh, independent code for the replication of the Z13 / Z340-key
 * lead (pre-registration: results/lead/replicate/prereg.md).  Shares only tools/lm.js with the
 * rest of the project; nothing from tools/keyprior_* is used.
 *
 *   const R = require('./lead_replicate_lib');
 *   const keys = R.loadKeys();                      // {z340:{key,counts,ascii}, z408:{...}, z32:{ascii}}
 *   const lay = R.layout('canonical');              // variant layout (positions, slots, free groups)
 *   const pl = R.slotLetters(lay, [3,17,4,0,0,14]); // pinned letters per position from slot letters
 *   const E = R.engine(lay);                        // fast statistics for this layout
 *   E.stats(pl)                                     // {t1, t2, t3}
 *   R.bruteStats(lay, pl, {word:true})              // reference: all completions through lm.js directly
 *
 * Statistics (see prereg): t1 = max over completions of the 6-gram Markov log10 P
 * (lm.ngramScore(text,6).logp), t2 = max over completions of lm.wordSegment(text).logp,
 * t3 = mean of the 10 largest 6-gram Markov log10 P values.  A completion gives every free
 * symbol any of the 26 letters (homophonic).
 *
 * Never decodes Z340 or Z408 with its own key; only the `key`, `ascii` and `symbols` fields are read.
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');

const ROOT = path.join(__dirname, '..');
const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SLOTS = ['A', 'E', 'N', 'z', 'K', 'M'];   // the six Z13 symbols that occur in Z340 (and Z408)
const VARIANT_IDS = ['canonical', 'circles_distinct', 'crosshair_null', 'reversed'];
const STATS = ['t1', 't2', 't3'];
const TOPK = 10;
const KEYMUL = 1048576;                          // lm.js bigram key multiplier (2^20)

/* ------------------------------------------------------------------ data */

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }

function loadKeys() {
  const out = {};
  for (const name of ['z340', 'z408']) {
    const j = readJson(`data/ciphers/${name}.json`);
    const key = {};
    for (const [s, l] of Object.entries(j.key)) key[s] = String(l).toUpperCase();
    const counts = {};
    for (const s of j.symbols) counts[s.ascii] = s.count;
    out[name] = { name, key, counts, ascii: j.ascii.replace(/\s+/g, '') };
  }
  const z32 = readJson('data/ciphers/z32.json');
  out.z32 = { ascii: z32.ascii.replace(/\s+/g, '') };
  const z13 = readJson('data/ciphers/z13.json');
  out.z13 = { ascii: z13.ascii.replace(/\s+/g, '') };
  return out;
}

/** Visual class of a glyph code (ASCII convention of data/ciphers/README.md). */
function glyphClass(sym) {
  if (sym === 'z') return 'nonletter';           // crosshair: a sign, not a letter shape
  if (/^[A-Z]$/.test(sym)) return 'capital';     // normal-orientation capital letters
  if (/^[a-z]$/.test(sym)) return 'reversed';    // mirrored / rotated letters
  return 'nonletter';                            // digits and punctuation: shapes
}

/* --------------------------------------------------------------- layouts */

function variantText(id) {
  return fs.readFileSync(path.join(ROOT, 'data', 'ciphers', 'variants', `z13.${id}.txt`), 'utf8').replace(/\s+/g, '');
}

/**
 * Layout of a variant: n, text, slotPos[k] = positions of SLOTS[k] (empty if absent),
 * pinned = sorted pinned positions, groups = free symbols [{sym, pos:[...]}] in order of first position.
 */
function layout(id) {
  const text = variantText(id);
  const n = text.length;
  const slotPos = SLOTS.map((s) => [...text].map((c, i) => (c === s ? i : -1)).filter((i) => i >= 0));
  const pinned = slotPos.flat().sort((a, b) => a - b);
  const groups = [];
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (SLOTS.includes(c)) continue;
    if (!seen.has(c)) { seen.set(c, groups.length); groups.push({ sym: c, pos: [] }); }
    groups[seen.get(c)].pos.push(i);
  }
  return { id, text, n, slotPos, pinned, groups };
}

/** Pinned letters per position (Int8Array, -1 = free) from six slot letters (codes 0..25). */
function slotLetters(lay, slots) {
  const pl = new Int8Array(lay.n).fill(-1);
  for (let k = 0; k < SLOTS.length; k++) for (const p of lay.slotPos[k]) pl[p] = slots[k];
  return pl;
}

/** Pinned letters per position taken from a 13-symbol window decoded with a key (null if a pinned symbol is unkeyed). */
function windowLetters(lay, winSyms, key) {
  const pl = new Int8Array(lay.n).fill(-1);
  for (const p of lay.pinned) {
    const l = key[winSyms[p]];
    if (!l) return null;
    pl[p] = l.charCodeAt(0) - 65;
  }
  return pl;
}

/** Fill a completion: pinned letters plus one letter per free group. */
function fill(lay, pl, groupLetters) {
  const c = Uint8Array.from(pl, (x) => (x < 0 ? 0 : x));
  lay.groups.forEach((g, gi) => { for (const p of g.pos) c[p] = groupLetters[gi]; });
  return c;
}

const codesToText = (c) => Array.from(c, (x) => LET[x]).join('');

/* --------------------------------------------------- reference (brute force) */

/** All completions through lm.js directly.  Returns {t1, t2, t3, best1, best2}. */
function bruteStats(lay, pl, opts = {}) {
  const G = lay.groups.length;
  const total = 26 ** G;
  const gl = new Array(G).fill(0);
  let t1 = -Infinity, t2 = -Infinity, best1 = '', best2 = '';
  const top = [];
  for (let a = 0; a < total; a++) {
    let r = a;
    for (let g = G - 1; g >= 0; g--) { gl[g] = r % 26; r = (r / 26) | 0; }
    const txt = codesToText(fill(lay, pl, gl));
    const m = lm.ngramScore(txt, 6).logp;
    if (m > t1) { t1 = m; best1 = txt; }
    if (top.length < TOPK) { top.push(m); top.sort((x, y) => x - y); } else if (m > top[0]) { top[0] = m; top.sort((x, y) => x - y); }
    if (opts.word !== false) {
      const w = lm.wordSegment(txt).logp;
      if (w > t2) { t2 = w; best2 = txt; }
    }
  }
  const t3 = top.reduce((s, x) => s + x, 0) / top.length;
  return { t1, t2: opts.word === false ? NaN : t2, t3, best1, best2 };
}

/* -------------------------------------------------- fast 6-gram enumerator */

/**
 * Markov 6-gram engine for a layout: term k (window ending at e = k + 5) depends on the free
 * groups that have a position in [e-5, e].  Per call, each term gets a table over its groups'
 * letters; the 26^G completions are then summed from the tables.
 */
function markovEngine(lay) {
  const n = lay.n, G = lay.groups.length;
  const J5 = lm.table(5);
  const posGroup = new Int8Array(n).fill(-1);
  lay.groups.forEach((g, gi) => g.pos.forEach((p) => { posGroup[p] = gi; }));
  const terms = [];
  for (let e = 5; e < n; e++) {
    const deps = [];
    for (let p = e - 5; p <= e; p++) if (posGroup[p] >= 0 && !deps.includes(posGroup[p])) deps.push(posGroup[p]);
    deps.sort((a, b) => a - b);
    terms.push({ e, first: e === 5, deps, size: 26 ** deps.length, tab: new Float64Array(26 ** deps.length) });
  }
  const total = 26 ** G;
  // map: completion index -> term table index (layout constant)
  const maps = terms.map((t) => {
    const m = new Int32Array(total);
    for (let a = 0; a < total; a++) {
      let idx = 0;
      for (const g of t.deps) idx = idx * 26 + (Math.floor(a / 26 ** (G - 1 - g)) % 26);
      m[a] = idx;
    }
    return m;
  });
  const codes = new Uint8Array(n);
  const sums = new Float64Array(total);
  for (const t of terms) t.lastKey = '';
  let hits = 0, misses = 0;

  function termValue(t) {
    let idx = 0;
    for (let p = t.e - 5; p <= t.e; p++) idx = idx * 26 + codes[p];
    const v = lm.j6(idx);
    return t.first ? v : v - J5[(idx / 26) | 0];
  }

  /** Returns {t1, t3, sums} (sums[a] = Markov log10 P of completion a; a encodes group letters base 26, group 0 most significant). */
  function run(pl) {
    for (let p = 0; p < n; p++) codes[p] = pl[p] < 0 ? 0 : pl[p];
    let constant = 0;
    for (const t of terms) {
      if (t.deps.length === 0) { constant += termValue(t); continue; }
      // a term table depends only on the pinned letters inside its window: reuse it when they repeat
      let key = '';
      for (let p = t.e - 5; p <= t.e; p++) key += pl[p] < 0 ? '?' : LET[pl[p]];
      if (key === t.lastKey) { hits++; continue; }
      misses++;
      t.lastKey = key;
      const d = t.deps.length;
      for (let i = 0; i < t.size; i++) {
        let r = i;
        for (let k = d - 1; k >= 0; k--) {
          const gl = r % 26; r = (r / 26) | 0;
          for (const p of lay.groups[t.deps[k]].pos) codes[p] = gl;
        }
        t.tab[i] = termValue(t);
      }
    }
    const act = terms.map((t, i) => i).filter((i) => terms[i].deps.length > 0);
    const top = new Float64Array(TOPK).fill(-Infinity);  // ascending: top[0] is the smallest kept
    let t1 = -Infinity;
    for (let a = 0; a < total; a++) {
      let s = constant;
      for (let q = 0; q < act.length; q++) { const ti = act[q]; s += terms[ti].tab[maps[ti][a]]; }
      sums[a] = s;
      if (s > t1) t1 = s;
      if (s > top[0]) {
        let k = 0;
        while (k + 1 < TOPK && top[k + 1] < s) { top[k] = top[k + 1]; k++; }
        top[k] = s;
      }
    }
    let t3 = 0, cnt = 0;
    for (const v of top) if (v > -Infinity) { t3 += v; cnt++; }
    return { t1, t3: t3 / cnt, sums };
  }
  return { run, total, G, cacheStats: () => ({ hits, misses }) };
}

/* ---------------------------------------------- word model: pattern Viterbi */

let _W = null;
/** Word-model structures derived from lm.vocab('common'): words by length, forward bigram lists. */
function wordData() {
  if (_W) return _W;
  const V = lm.vocab('common');
  const byLen = [];
  for (let L = 0; L <= 30; L++) byLen.push([]);
  for (let id = 0; id < V.size; id++) { const w = V.words[id]; if (w.length <= 30) byLen[w.length].push(id); }
  const lenData = byLen.map((ids, L) => {
    const letters = new Uint8Array(ids.length * L);
    ids.forEach((id, k) => { const w = V.words[id]; for (let q = 0; q < L; q++) letters[k * L + q] = w.charCodeAt(q) - 65; });
    return { ids: Int32Array.from(ids), letters };
  });
  // forward adjacency (CSR) of listed bigrams a -> b with r (already rescaled in lm.js)
  const deg = new Int32Array(V.size + 2);
  for (const k of V.big.keys()) { const a = Math.floor(k / KEYMUL); deg[a + 1]++; }
  for (let i = 1; i < deg.length; i++) deg[i] += deg[i - 1];
  const adjB = new Int32Array(V.big.size), adjR = new Float64Array(V.big.size);
  const fillPos = deg.slice();
  for (const [k, r] of V.big) {
    const a = Math.floor(k / KEYMUL), b = k - a * KEYMUL;
    const q = fillPos[a]++;
    adjB[q] = b; adjR[q] = r;
  }
  const J1 = lm.table(1);
  const order = [...Array(26).keys()].sort((x, y) => J1[y] - J1[x]);   // letters by unigram P, best first
  const ll = V.lenLog;
  const lenTerm = (L) => (L <= ll.length ? ll[L - 1] : ll[ll.length - 1] + (L - ll.length) * Math.log10(0.8));
  _W = { V, lenData, adjStart: deg, adjB, adjR, J1, order, lenTerm, candMark: new Int32Array(V.size).fill(-1) };
  return _W;
}

/** Best unknown-word log10 P over fillings of a span pattern (codes, -1 = wildcard) that are not vocabulary words. */
function unknownBest(W, pat) {
  const V = W.V;
  const L = pat.length;
  let base = V.logPoov + W.lenTerm(L);
  const wild = [];
  for (let q = 0; q < L; q++) { if (pat[q] < 0) wild.push(q); else base += W.J1[pat[q]]; }
  const buf = Array.from(pat, (x) => (x < 0 ? 'A' : LET[x]));
  if (wild.length === 0) return V.map.has(buf.join('')) ? -Infinity : base;
  // best-first enumeration of wildcard rank tuples
  const w = wild.length;
  const val = (rk) => rk.reduce((s, r) => s + W.J1[W.order[r]], 0);
  const heap = [{ rk: new Array(w).fill(0), v: val(new Array(w).fill(0)) }];
  const seen = new Set([heap[0].rk.join(',')]);
  let guard = 0;
  while (heap.length) {
    let bi = 0;
    for (let i = 1; i < heap.length; i++) if (heap[i].v > heap[bi].v) bi = i;
    const cur = heap[bi];
    heap[bi] = heap[heap.length - 1]; heap.pop();
    for (let k = 0; k < w; k++) buf[wild[k]] = LET[W.order[cur.rk[k]]];
    if (!V.map.has(buf.join(''))) return base + cur.v;
    if (++guard > 100000) throw new Error('unknownBest: runaway');
    for (let k = 0; k < w; k++) {
      if (cur.rk[k] >= 25) continue;
      const rk = cur.rk.slice(); rk[k]++;
      const key = rk.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      heap.push({ rk, v: val(rk) });
    }
  }
  return -Infinity;
}

/** Vocabulary ids matching a span pattern (codes, -1 = wildcard). */
function matchIds(W, pat) {
  const L = pat.length;
  const V = W.V;
  const wild = [];
  for (let q = 0; q < L; q++) if (pat[q] < 0) wild.push(q);
  const D = W.lenData[L];
  if (!D || D.ids.length === 0) return [];
  if (wild.length === 0) {
    const id = V.map.get(Array.from(pat, (x) => LET[x]).join(''));
    return id === undefined ? [] : [id];
  }
  const out = [];
  if (wild.length <= 2 && 26 ** wild.length < D.ids.length) {
    const buf = Array.from(pat, (x) => (x < 0 ? 'A' : LET[x]));
    const tot = 26 ** wild.length;
    for (let a = 0; a < tot; a++) {
      let r = a;
      for (let k = wild.length - 1; k >= 0; k--) { buf[wild[k]] = LET[r % 26]; r = (r / 26) | 0; }
      const id = V.map.get(buf.join(''));
      if (id !== undefined) out.push(id);
    }
    return out;
  }
  const fixedQ = [], fixedC = [];
  for (let q = 0; q < L; q++) if (pat[q] >= 0) { fixedQ.push(q); fixedC.push(pat[q]); }
  const nf = fixedQ.length;
  const letters = D.letters;
  for (let k = 0, base = 0; k < D.ids.length; k++, base += L) {
    let ok = true;
    for (let f = 0; f < nf; f++) if (letters[base + fixedQ[f]] !== fixedC[f]) { ok = false; break; }
    if (ok) out.push(D.ids[k]);
  }
  return out;
}

const _spanCache = new Map();
const SPAN_CACHE_MAX = 400000;
/** Cached {ids, unk} of a span pattern (unk only meaningful when allowUnk). */
function spanInfo(W, sp, allowUnk) {
  let key = '';
  for (let q = 0; q < sp.length; q++) key += sp[q] < 0 ? '?' : LET[sp[q]];
  let v = _spanCache.get(key);
  if (v) return v;
  v = { ids: matchIds(W, sp), unk: allowUnk ? unknownBest(W, sp) : -Infinity };
  if (_spanCache.size >= SPAN_CACHE_MAX) _spanCache.clear();
  _spanCache.set(key, v);
  return v;
}

/**
 * max over fillings of the wildcards (-1) of lm.wordSegment(text).logp, exactly, for a text whose
 * wildcard positions are all distinct free symbols (each occurs once).  Default wordSegment options.
 */
function wordMaxPattern(pat, opts = {}) {
  const W = wordData();
  const V = W.V;
  const n = pat.length;
  const maxU = 20;
  const LL = Math.max(V.maxLen, maxU);
  const known = [];                       // known[i]: Map pid -> best score of paths ending at i with last word pid
  const unk = new Float64Array(n + 1).fill(-Infinity);
  for (let i = 0; i <= n; i++) known.push(new Map());
  const mark = W.candMark;
  for (let i = 0; i < n; i++) {
    let A = -Infinity;                    // best predecessor value for a backoff transition
    if (i > 0) {
      A = unk[i];
      for (const [pid, sc] of known[i]) { const v = sc + V.logBack[pid]; if (v > A) A = v; }
      if (A === -Infinity) continue;      // position not reachable
    }
    const cands = [];                     // {id, j}
    const top = Math.min(n, i + LL);
    for (let j = i + 1; j <= top; j++) {
      const sp = pat.subarray ? pat.subarray(i, j) : pat.slice(i, j);
      const info = spanInfo(W, sp, j - i <= maxU);
      for (const id of info.ids) cands.push({ id, j });
      if (j - i <= maxU) {
        const u = info.unk;
        if (u > -Infinity) {
          const v = i === 0 ? u : u + A;
          if (v > unk[j]) unk[j] = v;
        }
      }
    }
    if (cands.length === 0) continue;
    const best = new Float64Array(cands.length);
    for (let c = 0; c < cands.length; c++) {
      const id = cands[c].id;
      best[c] = i === 0 ? V.logp1[id] : A + V.logp1[id];
      mark[id] = c;
    }
    if (i > 0) {
      for (const [pid, sc] of known[i]) {
        const a0 = W.adjStart[pid], a1 = W.adjStart[pid + 1];
        const bo = 1 - V.lam * V.s[pid];
        if (a1 - a0 <= cands.length) {
          for (let q = a0; q < a1; q++) {
            const c = mark[W.adjB[q]];
            if (c < 0) continue;
            const id = W.adjB[q];
            const v = sc + Math.log10(V.lam * W.adjR[q] + bo * V.p1[id]);
            if (v > best[c]) best[c] = v;
          }
        } else {
          for (let c = 0; c < cands.length; c++) {
            const id = cands[c].id;
            const r = V.big.get(pid * KEYMUL + id);
            if (r === undefined) continue;
            const v = sc + Math.log10(V.lam * r + bo * V.p1[id]);
            if (v > best[c]) best[c] = v;
          }
        }
      }
    }
    for (let c = 0; c < cands.length; c++) {
      const { id, j } = cands[c];
      mark[id] = -1;
      const m = known[j];
      const old = m.get(id);
      if (old === undefined || best[c] > old) m.set(id, best[c]);
    }
  }
  let res = unk[n];
  for (const sc of known[n].values()) if (sc > res) res = sc;
  return res;
}

/** Word engine for a layout: enumerate multi-position free groups, wildcards for single-position ones. */
function wordEngine(lay) {
  const multi = lay.groups.map((g, gi) => gi).filter((gi) => lay.groups[gi].pos.length > 1);
  const tot = 26 ** multi.length;
  const pat = new Int8Array(lay.n);
  return {
    run(pl) {
      let best = -Infinity;
      for (let a = 0; a < tot; a++) {
        pat.set(pl);
        let r = a;
        for (let k = multi.length - 1; k >= 0; k--) {
          const l = r % 26; r = (r / 26) | 0;
          for (const p of lay.groups[multi[k]].pos) pat[p] = l;
        }
        const v = wordMaxPattern(pat);
        if (v > best) best = v;
      }
      return best;
    },
  };
}

/** Combined fast engine: {stats(pl) -> {t1, t2, t3}}. */
function engine(lay, opts = {}) {
  const M = markovEngine(lay);
  const Wd = opts.word === false ? null : wordEngine(lay);
  return {
    lay,
    stats(pl) {
      const m = M.run(pl);
      return { t1: m.t1, t2: Wd ? Wd.run(pl) : NaN, t3: m.t3 };
    },
    markov: M,
  };
}

/* ------------------------------------------------------------------- RNG */

/** xoshiro128** seeded through splitmix32; rng.next() in [0,1), rng.int(n). */
function makeRng(seed) {
  let x = seed >>> 0;
  const sm = () => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = sm(), b = sm(), c = sm(), d = sm();
  const rotl = (v, k) => ((v << k) | (v >>> (32 - k))) >>> 0;
  function u32() {
    const r = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotl(d, 11);
    return r;
  }
  return {
    u32,
    next: () => u32() / 4294967296,
    int: (n) => Math.floor((u32() / 4294967296) * n),
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) { const j = rng.int(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}

/** Weighted sampling of k distinct items without replacement (weights > 0). */
function weightedDistinct(items, weights, k, rng) {
  const it = items.slice(), w = weights.slice();
  const out = [];
  for (let t = 0; t < k; t++) {
    let tot = 0;
    for (const x of w) tot += x;
    let u = rng.next() * tot, i = 0;
    while (i < w.length - 1 && u >= w[i]) { u -= w[i]; i++; }
    out.push(it[i]);
    it.splice(i, 1); w.splice(i, 1);
  }
  return out;
}

/* ---------------------------------------------------------------- p-values */

/** One-sided add-one p-value: (1 + #{null >= real}) / (1 + N). */
function pUpper(real, nullVals) {
  let ge = 0;
  for (const v of nullVals) if (v >= real) ge++;
  return (1 + ge) / (1 + nullVals.length);
}

module.exports = {
  ROOT, LET, SLOTS, VARIANT_IDS, STATS, TOPK, KEYMUL,
  loadKeys, glyphClass, variantText, layout, slotLetters, windowLetters, fill, codesToText,
  bruteStats, markovEngine, wordData, unknownBest, matchIds, wordMaxPattern, wordEngine, engine,
  makeRng, shuffle, weightedDistinct, pUpper,
};
