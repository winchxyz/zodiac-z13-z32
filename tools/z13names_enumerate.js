'use strict';
/**
 * tools/z13names_enumerate.js - copy of tools/enumerate.js (2026-10-07) for the z13names task.
 * Only change: names mode accepts --first-file F, --middle-file F, --last-file F (TSV NAME<TAB>weight
 * lists that replace data/names/first_*.tsv / surnames.tsv) and --init-file F (the list whose
 * first-letter shares give the weight of an initial; default = the first-name list).
 * Also --agg: workers aggregate every fit per (pattern, fillers, leading fillers) cell (count, sum of
 * weights, the same for fits with a name-part boundary at --boundary P, top --agg-top fits) and send
 * only fits with <= --stream-max-fillers (default 0) fillers to the main thread / --stream / top list.
 * Everything else is identical to tools/enumerate.js.
 *
 * (original header) tools/enumerate.js - exhaustive dictionary / name search for very short
 * ciphers (Z13, Z32).
 *
 * words mode: every DISTINCT letter string of the cipher's length that
 *   (a) splits into at most M words from the top-N words of a word list, and
 *   (b) is consistent with the ciphertext under the chosen mode
 *       (homophonic: same symbol -> same letter; simple: also 1:1),
 * found by a depth-first search over cipher positions.  The search state is
 * the partial key plus the set of trie nodes reachable by the word splits of
 * the prefix (prefix pruning).  Each string is visited once however many
 * splits it has.  Every fit is scored with lm.wordSegment (the best
 * segmentation under the full common vocabulary, not only the top-N list).
 *
 * names mode: FIRST [MIDDLE | INITIAL] LAST combinations (patterns of the
 * tokens F, M, I, L) from data/names/*.tsv, optionally with up to K filler
 * letters (wildcards) in chosen gaps, consistent with the ciphertext; each
 * fit is reported with its name-frequency weight (product of the part
 * weights; an initial gets the share of first names starting with it).
 *
 * Usage:
 *   node tools/enumerate.js words --cipher data/ciphers/z13.json --mode simple --top-words 20000 --max-words 4
 *        [--min-word-len 1] [--vocab common|full | --words-file F] [--threads 18] [--stream results/x.tsv]
 *        [--min-logp -40] [--top 1000] [--no-score] [--pin "S=L"] [--forbid-letters Q] [--out results/x.json]
 *   node tools/enumerate.js names --cipher data/ciphers/z13.json --mode simple --patterns FL,FIL,FML
 *        [--first male|female|all] [--first-top N] [--middle-top N] [--last-top N]
 *        [--fillers K] [--filler-at any|ends|end|start|between] [--min-weight W] [--stream F] [--out F]
 *
 * Limits (both modes): --max-seconds S and/or --max-fits N stop the search early; the JSON then
 * has counts.complete = false and every count is a lower bound.
 *
 * Defaults: --mode simple (anneal.js defaults to homophonic), --top-words 20000, --max-words 4,
 * --vocab common, --threads cores-2, --top 1000; names: --first all, all names, --patterns FL,FIL,FML,
 * --fillers 0, --filler-at any.  --readorder F / --written as in cipher.js.
 * Output (--out JSON): counts.consistentStrings = number of distinct consistent strings (all of
 * them, whatever --min-logp is), counts.noUnknownWords = how many of those lm.wordSegment splits
 * into vocabulary words only, counts.passingMinLogp = how many have wordSegment log10 P >=
 * --min-logp (default: all); top = the best --top of those by wordSegment log10 P, with keys.
 * --stream writes every fit passing --min-logp as TSV (unsorted).  --no-score skips wordSegment
 * (pure counting, much faster).  Names: counts.fits / perPattern, top by weight, TSV via --stream;
 * in the plaintext '?' marks a free filler letter and lower case a filler letter forced by the key.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ROOT = path.join(__dirname, '..');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/* ------------------------------------------------------------------- tries */

/** Build a trie on SharedArrayBuffers from [{w, weight}] (A-Z words). */
function buildTrie(entries, maxLen) {
  // count nodes
  let nodes = 1;
  const tmp = [new Map()];
  const termOf = [-1];
  for (let i = 0; i < entries.length; i++) {
    const w = entries[i].w;
    let n = 0;
    for (let j = 0; j < w.length; j++) {
      const c = w.charCodeAt(j) - 65;
      let ch = tmp[n].get(c);
      if (ch === undefined) { ch = nodes++; tmp.push(new Map()); termOf.push(-1); tmp[n].set(c, ch); }
      n = ch;
    }
    if (termOf[n] < 0) termOf[n] = i;
  }
  const sab = (Ctor, len) => new Ctor(new SharedArrayBuffer(Math.max(1, len) * Ctor.BYTES_PER_ELEMENT));
  const child = sab(Int32Array, nodes * 26).fill(-1);
  const term = sab(Int32Array, nodes).fill(-1);
  const remMask = sab(Uint32Array, nodes);   // bit j: a word ends exactly j letters below
  const maxW = sab(Float64Array, nodes);      // max weight of a word in the subtree
  const weight = sab(Float64Array, entries.length);
  for (let i = 0; i < entries.length; i++) weight[i] = entries[i].weight;
  for (let n = 0; n < nodes; n++) {
    for (const [c, ch] of tmp[n]) child[n * 26 + c] = ch;
    term[n] = termOf[n];
  }
  // post-order: nodes are created parent-before-child, so a reverse sweep works
  for (let n = nodes - 1; n >= 0; n--) {
    let m = term[n] >= 0 ? 1 : 0;
    let mw = term[n] >= 0 ? weight[term[n]] : 0;
    for (let c = 0; c < 26; c++) {
      const ch = child[n * 26 + c];
      if (ch >= 0) { m |= (remMask[ch] << 1) >>> 0; if (maxW[ch] > mw) mw = maxW[ch]; }
    }
    remMask[n] = m >>> 0;
    maxW[n] = mw;
  }
  let minLen = Infinity, maxL = 0;
  for (const e of entries) { if (e.w.length < minLen) minLen = e.w.length; if (e.w.length > maxL) maxL = e.w.length; }
  return { nodes, child, term, remMask, maxW, weight, words: entries.map((e) => e.w), minLen, maxLen: maxL, maxWeight: entries.reduce((a, e) => Math.max(a, e.weight), 0) };
}

/* ------------------------------------------------------------ word engine */

/** Thrown to unwind a search that hit --max-seconds / --max-fits. */
const ABORT = new Error('enumerate: search stopped by --max-seconds / --max-fits');

function shouldStop(flag, deadline) {
  if (flag && Atomics.load(flag, 0) !== 0) return true;
  if (deadline && Date.now() > deadline) { if (flag) Atomics.store(flag, 0, 1); return true; }
  return false;
}


/**
 * Word-sequence DFS.  cfg: {L, ids, S, mode, M, allowedMask, fixed, trie}
 * search(prefix, stop, onLeaf): letters fixed by `prefix` (array of codes) at
 * the first positions; calls onLeaf(codes, p) at depth `stop` (stop < L: a task
 * prefix) or at L (a complete consistent string).
 */
function makeWordEngine(cfg) {
  const { L, M, mode } = cfg;
  const ids = Uint16Array.from(cfg.ids);
  const S = cfg.S;
  const { child, term, remMask } = cfg.trie;
  const maxLen = cfg.trie.maxLen;
  const allowed = cfg.allowedMask;
  const simple = mode === 'simple';
  const keyOf = new Int8Array(S).fill(-1);
  const ownerOf = new Int16Array(26).fill(-1);
  for (let s = 0; s < S; s++) if (cfg.fixed[s] >= 0) { keyOf[s] = cfg.fixed[s]; ownerOf[cfg.fixed[s]] = s; }
  const stN = [], stK = [], stC = new Int32Array(L + 2);
  for (let p = 0; p <= L; p++) { stN.push(new Int32Array(L + 3)); stK.push(new Int32Array(L + 3)); }
  stN[0][0] = 0; stK[0][0] = 0; stC[0] = 1;
  const letters = new Uint8Array(L);
  let prefix = null, stop = L, onLeaf = null;
  let nodesVisited = 0;
  const stopFlag = cfg.stopFlag || null;   // shared Int32Array: [0] != 0 means stop
  const deadline = cfg.deadline || 0;      // absolute Date.now() limit, 0 = none

  function feasible(node, k, r) {
    // can (node, k) with r letters left finish exactly at the end with <= M words?
    if (node === 0) return r === 0 || (k < M && r <= (M - k) * maxLen);
    let m = remMask[node];
    if (r < 32) m &= (r === 31 ? 0xffffffff : ((1 << (r + 1)) - 1)) >>> 0;
    while (m) {
      const j = 31 - Math.clz32(m & -m);
      m &= m - 1;
      const rest = r - j;
      if (rest === 0) return true;
      if (k + 1 < M && rest <= (M - k - 1) * maxLen) return true;
    }
    return false;
  }

  function step(p, l) {
    // states at p advanced by letter l -> states at p+1; returns count
    const N0 = stN[p], K0 = stK[p], c0 = stC[p];
    const N1 = stN[p + 1], K1 = stK[p + 1];
    const r = L - p - 1;
    let c1 = 0;
    for (let i = 0; i < c0; i++) {
      const ch = child[N0[i] * 26 + l];
      if (ch < 0) continue;
      const k = K0[i];
      if (k < M && feasible(ch, k, r)) c1 = addState(N1, K1, c1, ch, k);
      if (term[ch] >= 0 && k + 1 <= M && feasible(0, k + 1, r)) c1 = addState(N1, K1, c1, 0, k + 1);
    }
    stC[p + 1] = c1;
    return c1;
  }

  function addState(N, K, c, node, k) {
    for (let i = 0; i < c; i++) if (N[i] === node) { if (k < K[i]) K[i] = k; return c; }
    N[c] = node; K[c] = k;
    return c + 1;
  }

  function rec(p) {
    if ((++nodesVisited & 0xffff) === 0 && shouldStop(stopFlag, deadline)) throw ABORT;
    if (p === stop) {
      if (stop === L) {
        const N = stN[p];
        for (let i = 0; i < stC[p]; i++) if (N[i] === 0) { onLeaf(letters, p); return; }
        return;
      }
      onLeaf(letters, p);
      return;
    }
    const s = ids[p];
    const cur = keyOf[s];
    const want = prefix && p < prefix.length ? prefix[p] : -1;
    if (cur >= 0) {
      if (want >= 0 && want !== cur) return;
      if (step(p, cur) === 0) return;
      letters[p] = cur;
      rec(p + 1);
      return;
    }
    for (let l = 0; l < 26; l++) {
      if (want >= 0 && l !== want) continue;
      if (!(allowed & (1 << l))) continue;
      if (simple && ownerOf[l] >= 0) continue;
      if (step(p, l) === 0) continue;
      keyOf[s] = l;
      if (simple) ownerOf[l] = s;
      letters[p] = l;
      rec(p + 1);
      keyOf[s] = -1;
      if (simple) ownerOf[l] = -1;
    }
  }

  return {
    search(pfx, stopAt, cb) {
      prefix = pfx; stop = stopAt; onLeaf = cb;
      rec(0);
    },
    get nodesVisited() { return nodesVisited; },
  };
}

/* ------------------------------------------------------------ name engine */

/**
 * Names DFS.  cfg: {L, ids, S, mode, allowedMask, fixed, tries: {F, L}, initW: Float64Array(26),
 *   pattern: 'FIL', fillers: K, gaps: allowed gap flags (pattern.length + 1), minWeight}
 * search(firstPrefix, cb): cb({parts, fillerPos, weight, codes})
 */
function makeNameEngine(cfg) {
  const L = cfg.L, S = cfg.S;
  const ids = Uint16Array.from(cfg.ids);
  const simple = cfg.mode === 'simple';
  const allowed = cfg.allowedMask;
  const keyOf = new Int8Array(S).fill(-1);
  const ownerOf = new Int16Array(26).fill(-1);
  for (let s = 0; s < S; s++) if (cfg.fixed[s] >= 0) { keyOf[s] = cfg.fixed[s]; ownerOf[cfg.fixed[s]] = s; }
  const pat = cfg.pattern.split('');
  const firstMaxLen = cfg.firstMaxLen || 0;
  const K = cfg.fillers || 0;
  const gaps = cfg.gaps;
  const minW = cfg.minWeight || 0;
  const trieFor = (t) => (t === 'L' ? cfg.tries.L : t === 'M' ? cfg.tries.M : cfg.tries.F);
  // bounds per remaining suffix of the pattern
  const nP = pat.length;
  const sufMaxW = new Float64Array(nP + 1).fill(1);
  const sufMin = new Int32Array(nP + 1), sufMax = new Int32Array(nP + 1);
  for (let i = nP - 1; i >= 0; i--) {
    const t = pat[i];
    let mw, mn, mx;
    if (t === 'I') { mw = Math.max(...cfg.initW); mn = 1; mx = 1; } else { const T = trieFor(t); mw = T.maxWeight; mn = T.minLen; mx = T.maxLen; }
    sufMaxW[i] = sufMaxW[i + 1] * mw;
    sufMin[i] = sufMin[i + 1] + mn;
    sufMax[i] = sufMax[i + 1] + mx;
  }
  let gapsAfter = new Int32Array(nP + 2); // allowed gaps from index g..nP
  for (let g = nP; g >= 0; g--) gapsAfter[g] = gapsAfter[g + 1] + (gaps[g] ? 1 : 0);
  const letters = new Int8Array(L).fill(-1);
  const isFill = new Uint8Array(L);
  const parts = [];
  let cb = null, firstPrefix = null;
  let visits = 0;
  const stopFlag = cfg.stopFlag || null, deadline = cfg.deadline || 0;

  function canAssign(p, l) {
    const s = ids[p];
    const cur = keyOf[s];
    if (cur >= 0) return cur === l ? 0 : -1;  // 0: already that letter
    if (!(allowed & (1 << l))) return -1;
    if (simple && ownerOf[l] >= 0) return -1;
    return 1; // needs assignment
  }
  function assign(p, l) { const s = ids[p]; keyOf[s] = l; if (simple) ownerOf[l] = s; }
  function unassign(p, l) { const s = ids[p]; keyOf[s] = -1; if (simple) ownerOf[l] = -1; }

  function fillersFeasible() {
    if (!simple) return true;
    // every filler symbol still unassigned needs its own unused allowed letter
    const need = new Set();
    for (let p = 0; p < L; p++) if (isFill[p] && keyOf[ids[p]] < 0) need.add(ids[p]);
    if (!need.size) return true;
    let free = 0;
    for (let l = 0; l < 26; l++) if ((allowed & (1 << l)) && ownerOf[l] < 0) free++;
    return need.size <= free;
  }

  function emit(w, used) {
    if (!fillersFeasible()) return;
    const codes = new Array(L);
    for (let p = 0; p < L; p++) codes[p] = isFill[p] ? (keyOf[ids[p]] >= 0 ? -2 - keyOf[ids[p]] : -1) : letters[p];
    cb({ parts: parts.slice(), weight: w, fillers: used, codes });
  }

  // part i starts at position p (after any gap fillers have been placed)
  function part(i, p, w, used) {
    if (i === nP) {
      // trailing gap
      const r = L - p;
      if (r === 0) { emit(w, used); return; }
      if (gaps[nP] && r <= K - used) {
        for (let q = p; q < L; q++) isFill[q] = 1;
        emit(w, used + r);
        for (let q = p; q < L; q++) isFill[q] = 0;
      }
      return;
    }
    const t = pat[i];
    if (t === 'I') {
      if (p >= L) return;
      for (let l = 0; l < 26; l++) {
        const iw = cfg.initW[l];
        if (!(iw > 0)) continue;
        if (minW && w * iw * sufMaxW[i + 1] < minW) continue;
        const a = canAssign(p, l);
        if (a < 0) continue;
        if (a > 0) assign(p, l);
        letters[p] = l;
        parts.push(LETTERS[l]);
        gap(i + 1, p + 1, w * iw, used);
        parts.pop();
        letters[p] = -1;
        if (a > 0) unassign(p, l);
      }
      return;
    }
    walk(trieFor(t), i, 0, p, p, w, used);
  }

  function walk(T, i, node, start, p, w, used) {
    if ((++visits & 0xffff) === 0 && shouldStop(stopFlag, deadline)) throw ABORT;
    const len = p - start;
    if (len > 0 && T.term[node] >= 0) {
      const ww = w * T.weight[T.term[node]];
      if (!minW || ww * sufMaxW[i + 1] >= minW) {
        parts.push(T.words[T.term[node]]);
        gap(i + 1, p, ww, used);
        parts.pop();
      }
    }
    if (p >= L) return;
    // remaining length after this part must be coverable by later parts + fillers
    const rmax = L - p - sufMin[i + 1];
    if (rmax <= 0) return;
    if (minW && w * T.maxW[node] * sufMaxW[i + 1] < minW) return;
    if (i === 0 && firstMaxLen && len >= firstMaxLen) return;
    const want = i === 0 && firstPrefix && len < firstPrefix.length ? firstPrefix[len] : -1;
    for (let l = 0; l < 26; l++) {
      if (want >= 0 && l !== want) continue;
      const ch = T.child[node * 26 + l];
      if (ch < 0) continue;
      if (minW && w * T.maxW[ch] * sufMaxW[i + 1] < minW) continue;
      // can a word below ch end within the remaining room?
      const m = T.remMask[ch];
      const room = Math.min(31, rmax - 1);
      if (room < 0 || (m & (room === 31 ? 0xffffffff : ((1 << (room + 1)) - 1))) === 0) continue;
      const a = canAssign(p, l);
      if (a < 0) continue;
      if (a > 0) assign(p, l);
      letters[p] = l;
      walk(T, i, ch, start, p + 1, w, used);
      letters[p] = -1;
      if (a > 0) unassign(p, l);
    }
  }

  // gap before part i at position p
  function gap(i, p, w, used) {
    // the rest must be fillable by the remaining parts plus the remaining fillers
    if (L - p > sufMax[i] + (K - used)) return;
    if (L - p < sufMin[i]) return;
    if (i < nP && gaps[i] && used < K) {
      part(i, p, w, used);
      for (let f = 1; used + f <= K && p + f <= L; f++) {
        isFill[p + f - 1] = 1;
        part(i, p + f, w, used + f);
      }
      for (let f = 1; used + f <= K && p + f <= L; f++) isFill[p + f - 1] = 0;
      return;
    }
    part(i, p, w, used);
  }

  return {
    search(fp, onFit) {
      firstPrefix = fp; cb = onFit;
      gap(0, 0, 1, 0);
    },
  };
}

/* ------------------------------------------------------------------- lists */

function readTsv(file, topN, maxLen, minLen = 1) {
  const lines = fs.readFileSync(file, 'latin1').split('\n');
  const out = [];
  for (const ln of lines) {
    if (!ln) continue;
    const t = ln.indexOf('\t');
    const w = (t < 0 ? ln : ln.slice(0, t)).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(w)) continue;
    const v = t < 0 ? 1 : +ln.slice(t + 1);
    out.push({ w, weight: v });
  }
  out.sort((a, b) => b.weight - a.weight);
  const top = topN ? out.slice(0, topN) : out;
  return top.filter((e) => e.w.length >= minLen && e.w.length <= maxLen);
}

/* ------------------------------------------------- z13names aggregation */

/**
 * Add one name fit to an aggregate keyed by "pattern|fillers|lead" (lead = leading filler letters).
 * Each cell: n (fits), sw (sum of prior weights), nb / swb (same, restricted to fits that have a
 * name-part boundary at position `boundary`; -1 = not used), top (the `topK` heaviest fits).
 */
function aggAdd(agg, pattern, fit, boundary, topK) {
  const codes = fit.codes;
  let lead = 0;
  while (lead < codes.length && codes[lead] < 0) lead++;
  const key = `${pattern}|${fit.fillers}|${lead}`;
  let c = agg[key];
  if (!c) c = agg[key] = { n: 0, sw: 0, nb: 0, swb: 0, top: [] };
  c.n++; c.sw += fit.weight;
  if (boundary >= 0) {
    let p = lead, hit = false;
    for (const part of fit.parts) { if (p === boundary && p > 0) hit = true; p += part.length; }
    if (hit) { c.nb++; c.swb += fit.weight; }
  }
  if (c.top.length < topK || fit.weight > c.top[c.top.length - 1][1]) {
    const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const pt = codes.map((x) => (x >= 0 ? LET[x] : x === -1 ? '?' : LET[-2 - x].toLowerCase())).join('');
    c.top.push([pt, fit.weight, pattern, fit.parts.join(' '), fit.fillers]);
    c.top.sort((a, b) => b[1] - a[1]);
    if (c.top.length > topK) c.top.length = topK;
  }
}

function aggMerge(into, from, topK) {
  for (const [k, c] of Object.entries(from)) {
    const t = into[k];
    if (!t) { into[k] = c; continue; }
    t.n += c.n; t.sw += c.sw; t.nb += c.nb; t.swb += c.swb;
    t.top = t.top.concat(c.top).sort((a, b) => b[1] - a[1]).slice(0, topK);
  }
}

let aggSink = null;   // set by namesMode in --agg mode; receives each worker task's aggregate

/* ---------------------------------------------------------------- workers */

function workerMain() {
  const d = workerData;
  let lm = null;
  const score = d.score && d.kind === 'words';
  if (score) { lm = require('./lm'); lm.vocab(d.vocab || 'common'); }
  const tries = d.tries;
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    if (m.type !== 'task') return;
    const out = [];
    const agg = {};
    let count = 0, noUnk = 0, aborted = false;
    const minL = d.minLogp == null ? -Infinity : d.minLogp;
    const flag = d.stopFlag || null;
    const maxK = d.maxFits ? Math.ceil(d.maxFits / 1024) : 0;
    const tick = () => {
      // shared fit counter in units of 1024 (flag[1]); trips the stop flag at --max-fits
      if ((count & 1023) === 0 && flag) { const k = Atomics.add(flag, 1, 1) + 1; if (maxK && k >= maxK) Atomics.store(flag, 0, 1); }
    };
    const flush = () => { if (out.length) { parentPort.postMessage({ type: 'fits', fits: out.splice(0) }); } };
    const ecfg = { stopFlag: flag, deadline: d.deadline || 0 };
    try {
      if (flag && Atomics.load(flag, 0) !== 0) throw ABORT;
      if (d.kind === 'words') {
        const eng = makeWordEngine(Object.assign({}, d.cfg, ecfg, { trie: tries.W }));
        for (const pfx of m.prefixes) {
          eng.search(pfx, d.cfg.L, (letters) => {
            count++;
            tick();
            let s = '';
            for (let i = 0; i < letters.length; i++) s += String.fromCharCode(65 + letters[i]);
            if (score) {
              // filter here so that only fits passing --min-logp travel to the main thread
              const ws = lm.wordSegment(s, { vocab: d.vocab || 'common' });
              if (ws.unknown === 0) noUnk++;
              if (ws.logp >= minL) out.push([s, ws.logp, ws.words.join(' '), ws.unknown]);
            } else out.push([s]);
            if (out.length >= 4096) flush();
          });
        }
      } else if (d.agg) {
        // z13names --agg: aggregate every fit here; send only fits with <= streamMaxFillers fillers
        for (const task of m.prefixes) {
          const eng = makeNameEngine(Object.assign({}, d.cfg, ecfg, { tries, pattern: task.pattern, gaps: task.gaps, firstMaxLen: task.firstMaxLen || 0 }));
          eng.search(task.prefix, (fit) => {
            count++;
            tick();
            aggAdd(agg, task.pattern, fit, d.boundary == null ? -1 : d.boundary, d.aggTop || 20);
            if (fit.fillers <= (d.streamMaxFillers || 0)) {
              out.push([task.pattern, fit.parts.join(' '), fit.weight, fit.fillers, fit.codes]);
              if (out.length >= 4096) flush();
            }
          });
        }
      } else {
        for (const task of m.prefixes) {
          const eng = makeNameEngine(Object.assign({}, d.cfg, ecfg, { tries, pattern: task.pattern, gaps: task.gaps, firstMaxLen: task.firstMaxLen || 0 }));
          eng.search(task.prefix, (fit) => {
            count++;
            tick();
            out.push([task.pattern, fit.parts.join(' '), fit.weight, fit.fillers, fit.codes]);
            if (out.length >= 4096) flush();
          });
        }
      }
    } catch (e) {
      if (e !== ABORT) throw e;
      aborted = true;
    }
    flush();
    parentPort.postMessage({ type: 'done', count, noUnk, aborted, agg: d.agg ? agg : undefined });
  });
  parentPort.postMessage({ type: 'ready' });
}

function runPool(nThreads, wdata, tasks, onFits) {
  return new Promise((resolve, reject) => {
    const workers = [];
    let next = 0, active = 0, total = 0, noUnk = 0, aborted = false;
    const flag = wdata.stopFlag || null;
    const finish = () => { for (const w of workers) w.terminate(); resolve({ total, noUnk, aborted, tasksStarted: next, tasks: tasks.length }); };
    const give = (w) => {
      if (next >= tasks.length) return false;
      if (flag && Atomics.load(flag, 0) !== 0) { aborted = true; return false; }
      w.postMessage({ type: 'task', prefixes: tasks[next++] });
      active++;
      return true;
    };
    for (let i = 0; i < nThreads; i++) {
      const w = new Worker(__filename, { workerData: wdata });
      w.on('message', (m) => {
        if (m.type === 'ready') { if (!give(w) && active === 0 && next >= tasks.length) { /* idle */ } }
        else if (m.type === 'fits') onFits(m.fits);
        else if (m.type === 'done') {
          total += m.count; noUnk += m.noUnk || 0; active--;
          if (m.agg && aggSink) aggSink(m.agg);
          if (m.aborted) aborted = true;
          if (!give(w) && active === 0) finish();
        }
      });
      w.on('error', reject);
      workers.push(w);
    }
    if (!tasks.length) finish();
  });
}

/* -------------------------------------------------------------- top-K heap */

class TopK {
  constructor(k, keyFn) { this.k = k; this.key = keyFn; this.a = []; this.min = -Infinity; }
  push(x) {
    const v = this.key(x);
    if (this.a.length >= this.k && v <= this.min) return;
    this.a.push(x);
    if (this.a.length > this.k * 2) this.trim();
  }
  trim() {
    this.a.sort((x, y) => this.key(y) - this.key(x));
    if (this.a.length > this.k) this.a.length = this.k;
    if (this.a.length >= this.k) this.min = this.key(this.a[this.a.length - 1]);
  }
  result() { this.trim(); return this.a; }
}

/* -------------------------------------------------------------------- main */

function parseOpts(argv) {
  const o = { _: [] };
  const flags = new Set(['no-score', 'help', 'written', 'quiet', 'agg']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (flags.has(k)) o[k] = true; else o[k] = argv[++i];
  }
  return o;
}

function cipherSetup(o) {
  const C = require('./cipher');
  const ci = C.loadCipher(o.cipher);
  let order = null;
  if (o.readorder) order = C.parseReadOrder(o.readorder, ci.text.length);
  else if (ci.readOrder && !o.written) order = ci.readOrder;
  const text = order ? C.applyReadOrder(ci.text, order) : ci.text;
  const { symbols, idOf, ids } = C.symbolTable(text);
  const mode = o.mode || 'simple';
  let allowedMask = (1 << 26) - 1;
  for (const ch of String(o['forbid-letters'] || '').toUpperCase()) if (/[A-Z]/.test(ch)) allowedMask &= ~(1 << (ch.charCodeAt(0) - 65));
  const fixed = new Array(symbols.length).fill(-1);
  for (const [s, l] of C.parseKey(o.pin || '')) if (idOf.has(s)) fixed[idOf.get(s)] = l.charCodeAt(0) - 65;
  return { ci, text, symbols, ids: Array.from(ids), mode, allowedMask, fixed, order, C };
}

/** --max-seconds / --max-fits: shared stop flag ([0] stop, [1] fits/1024) and deadline. */
function limits(o, start) {
  const maxSeconds = +o['max-seconds'] || 0;
  const maxFits = +o['max-fits'] || 0;
  return {
    maxSeconds, maxFits,
    deadline: maxSeconds ? start + maxSeconds * 1000 : 0,
    flag: new Int32Array(new SharedArrayBuffer(8)),
  };
}

function stopReason(lim) {
  const r = [];
  if (lim.maxSeconds) r.push(`--max-seconds ${lim.maxSeconds}`);
  if (lim.maxFits) r.push(`--max-fits ${lim.maxFits}`);
  return r.join(' or ');
}

async function wordsMode(o) {
  const t0 = Date.now();
  const cs = cipherSetup(o);
  const L = cs.text.length;
  const M = +o['max-words'] || 4;
  const topN = +o['top-words'] || 20000;
  const minLen = +o['min-word-len'] || 1;
  const vocab = o.vocab || 'common';
  const file = o['words-file'] || path.join(ROOT, 'data', 'lm', vocab === 'full' ? 'words.tsv' : 'words_common.tsv');
  const entries = readTsv(file, topN, L, minLen);
  const trie = buildTrie(entries);
  const cfg = { L, ids: cs.ids, S: cs.symbols.length, mode: cs.mode, M, allowedMask: cs.allowedMask, fixed: cs.fixed };
  // split into tasks by prefixes of depth d
  const eng = makeWordEngine(Object.assign({}, cfg, { trie }));
  const threads = Math.max(1, +o.threads || Math.max(1, os.cpus().length - 2));
  let d = Math.min(L, 1), prefixes = [];
  for (d = 1; d <= Math.min(L, 4); d++) {
    prefixes = [];
    eng.search(null, d, (letters, p) => prefixes.push(Array.from(letters.slice(0, p))));
    if (prefixes.length >= threads * 40) break;
  }
  if (d > Math.min(L, 4)) d = Math.min(L, 4);
  const tasks = [];
  const per = Math.max(1, Math.ceil(prefixes.length / (threads * 8)));
  for (let i = 0; i < prefixes.length; i += per) tasks.push(prefixes.slice(i, i + per));
  const score = !o['no-score'];
  const minLogp = o['min-logp'] != null ? +o['min-logp'] : -Infinity;
  const K = +o.top || 1000;
  const top = new TopK(K, (x) => (score ? x[1] : 0));
  let stream = null;
  if (o.stream) { fs.mkdirSync(path.dirname(path.resolve(o.stream)), { recursive: true }); stream = fs.createWriteStream(o.stream); stream.write(score ? 'plaintext\twordLogp\twords\tunknown\n' : 'plaintext\n'); }
  let noUnknown = 0, passing = 0, total = 0;
  let lastP = Date.now();
  const onFits = (fits) => {
    for (const f of fits) {
      if (score && f[1] < minLogp) continue;
      passing++;
      top.push(f);
      if (stream) stream.write(f.join('\t') + '\n');
    }
    if (!o.quiet && Date.now() - lastP > 3000) { lastP = Date.now(); process.stderr.write(`\renumerate: ${passing} fits passed on, ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  };
  const tSetup = Date.now();
  const lim = limits(o, tSetup);
  let count, aborted = false;
  if (threads <= 1) {
    let lmm = null;
    if (score) lmm = require('./lm');
    const buf = [];
    const e2 = makeWordEngine(Object.assign({}, cfg, { trie, deadline: lim.deadline }));
    try {
      e2.search(null, L, (letters) => {
        let s = '';
        for (let i = 0; i < letters.length; i++) s += String.fromCharCode(65 + letters[i]);
        total++;
        if (score) {
          const ws = lmm.wordSegment(s, { vocab });
          if (ws.unknown === 0) noUnknown++;
          if (ws.logp >= minLogp) buf.push([s, ws.logp, ws.words.join(' '), ws.unknown]);
        } else buf.push([s]);
        if (buf.length >= 4096) onFits(buf.splice(0));
        if (lim.maxFits && total >= lim.maxFits) throw ABORT;
      });
    } catch (e) { if (e !== ABORT) throw e; aborted = true; }
    onFits(buf.splice(0));
    count = total;
  } else {
    const r = await runPool(threads, { kind: 'words', cfg, tries: { W: trie }, score, vocab, minLogp: Number.isFinite(minLogp) ? minLogp : null, stopFlag: lim.flag, deadline: lim.deadline, maxFits: lim.maxFits }, tasks, onFits);
    count = total = r.total;
    noUnknown = r.noUnk;
    aborted = r.aborted;
  }
  if (!o.quiet) process.stderr.write('\n');
  if (stream) await new Promise((r) => stream.end(r));
  const best = top.result().map((f, i) => (score ? { rank: i + 1, plaintext: f[0], wordLogp: f[1], perChar: f[1] / L, words: f[2], unknown: f[3] } : { rank: i + 1, plaintext: f[0] }));
  // attach the key for the best few
  for (const b of best.slice(0, 50)) {
    const chk = cs.C.checkCandidate(cs.text, b.plaintext, { mode: cs.mode });
    b.key = chk.key;
    b.consistent = chk.ok;
  }
  const res = {
    tool: 'tools/enumerate.js words', created: new Date().toISOString(),
    cipher: { id: cs.ci.id, source: cs.ci.source, text: cs.text, length: L, symbols: cs.symbols.length, readOrder: cs.order ? 'applied' : null },
    options: { mode: cs.mode, topWords: topN, wordsUsed: entries.length, maxWords: M, minWordLen: minLen, wordList: path.relative(ROOT, file).replace(/\\/g, '/'), vocabForScoring: vocab, pin: o.pin || '', forbid: o['forbid-letters'] || '', minLogp: Number.isFinite(minLogp) ? minLogp : null, threads, taskDepth: d, tasks: tasks.length },
    counts: {
      complete: !aborted, stoppedBy: aborted ? stopReason(lim) : null,
      consistentStrings: total, workerCount: count, noUnknownWords: score ? noUnknown : null, passingMinLogp: passing, trieNodes: trie.nodes,
      note: aborted ? 'search stopped early: every count is a lower bound and the top list covers only the part searched' : undefined,
    },
    timeMs: { total: Date.now() - t0, setup: tSetup - t0 },
    top: best,
  };
  if (o.out) { fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true }); fs.writeFileSync(o.out, JSON.stringify(res, null, 1)); }
  return res;
}

async function namesMode(o) {
  const t0 = Date.now();
  const cs = cipherSetup(o);
  const L = cs.text.length;
  const ND = path.join(ROOT, 'data', 'names');
  // z13names extension: --first-file / --middle-file / --last-file / --init-file override the lists
  const firstFile = o['first-file'] ? path.resolve(o['first-file']) : path.join(ND, `first_${o.first || 'all'}.tsv`);
  const F = readTsv(firstFile, +o['first-top'] || 0, L);
  const middleFile = o['middle-file'] ? path.resolve(o['middle-file']) : null;
  const Mlist = middleFile ? readTsv(middleFile, +o['middle-top'] || 0, L) : (o['middle-top'] ? F.slice(0, +o['middle-top']) : F);
  const lastFile = o['last-file'] ? path.resolve(o['last-file']) : path.join(ND, 'surnames.tsv');
  const Ls = readTsv(lastFile, +o['last-top'] || 0, L);
  const tries = { F: buildTrie(F), L: buildTrie(Ls) };
  tries.M = Mlist === F ? tries.F : buildTrie(Mlist);
  const initFile = o['init-file'] ? path.resolve(o['init-file']) : null;
  const initSrc = initFile ? readTsv(initFile, 0, 99) : F;
  o._files = { first: path.relative(ROOT, firstFile).replace(/\\/g, '/'), middle: middleFile ? path.relative(ROOT, middleFile).replace(/\\/g, '/') : 'same as first',
    last: path.relative(ROOT, lastFile).replace(/\\/g, '/'), initials: initFile ? path.relative(ROOT, initFile).replace(/\\/g, '/') : 'first list' };
  const initW = new Float64Array(26);
  let tw = 0;
  for (const e of initSrc) { initW[e.w.charCodeAt(0) - 65] += e.weight; tw += e.weight; }
  for (let l = 0; l < 26; l++) initW[l] /= tw || 1;
  const patterns = String(o.patterns || 'FL,FIL,FML').split(',').filter(Boolean).map((p) => p.toUpperCase());
  for (const p of patterns) if (!/^[FMIL]+$/.test(p)) throw new Error(`pattern '${p}': use the tokens F, M, I, L`);
  const K = +o.fillers || 0;
  const where = o['filler-at'] || 'any';
  const gapsFor = (p) => {
    const g = new Array(p.length + 1).fill(0);
    if (K > 0) for (let i = 0; i <= p.length; i++) {
      if (where === 'any') g[i] = 1;
      else if (where === 'ends') g[i] = i === 0 || i === p.length ? 1 : 0;
      else if (where === 'end') g[i] = i === p.length ? 1 : 0;
      else if (where === 'start') g[i] = i === 0 ? 1 : 0;
      else if (where === 'between') g[i] = i > 0 && i < p.length ? 1 : 0;
      else throw new Error(`--filler-at: any|ends|end|start|between`);
    }
    return g;
  };
  const minWeight = +o['min-weight'] || 0;
  const cfg = { L, ids: cs.ids, S: cs.symbols.length, mode: cs.mode, allowedMask: cs.allowedMask, fixed: cs.fixed, initW, fillers: K, minWeight };
  // tasks: (pattern, first two letters of the first part); first parts of one letter
  // (an initial, or a one-letter name if a list has one) get their own tasks
  const tasks = [];
  for (const p of patterns) {
    const gaps = gapsFor(p);
    if (p[0] === 'I') { tasks.push([{ pattern: p, gaps, prefix: null }]); continue; }
    for (let a = 0; a < 26; a++) for (let b = 0; b < 26; b++) tasks.push([{ pattern: p, gaps, prefix: [a, b] }]);
    const T0 = p[0] === 'L' ? tries.L : p[0] === 'M' ? tries.M : tries.F;
    if (T0.minLen <= 1) for (let a = 0; a < 26; a++) tasks.push([{ pattern: p, gaps, prefix: [a], firstMaxLen: 1 }]);
  }
  const threads = Math.max(1, +o.threads || Math.max(1, os.cpus().length - 2));
  const K2 = +o.top || 1000;
  const top = new TopK(K2, (x) => x[1]);
  let stream = null;
  if (o.stream) { fs.mkdirSync(path.dirname(path.resolve(o.stream)), { recursive: true }); stream = fs.createWriteStream(o.stream); stream.write('plaintext\tweight\tpattern\tparts\tfillers\n'); }
  const perPattern = {};
  let total = 0;
  const render = (codes) => codes.map((c) => (c >= 0 ? LETTERS[c] : c === -1 ? '?' : LETTERS[-2 - c].toLowerCase())).join('');
  const AGG = !!o.agg;
  const aggTop = +o['agg-top'] || 20;
  const boundary = o.boundary != null ? +o.boundary : -1;
  const streamMaxFillers = o['stream-max-fillers'] != null ? +o['stream-max-fillers'] : 0;
  const aggregated = {};
  if (AGG) aggSink = (a) => aggMerge(aggregated, a, aggTop);
  const onFits = (fits) => {
    for (const f of fits) {
      const [pat, parts, w, fill, codes] = f;
      const pt = render(codes);
      if (!AGG) { total++; perPattern[pat] = (perPattern[pat] || 0) + 1; }
      const row = [pt, w, pat, parts, fill];
      top.push(row);
      if (stream) stream.write(row.join('\t') + '\n');
    }
  };
  const flat = tasks;
  const lim = limits(o, Date.now());
  let aborted = false;
  const count = threads <= 1 ? (() => {
    let n = 0;
    try {
      for (const t of flat) for (const task of t) {
        const eng = makeNameEngine(Object.assign({}, cfg, { tries, pattern: task.pattern, gaps: task.gaps, firstMaxLen: task.firstMaxLen || 0, deadline: lim.deadline }));
        const buf = [];
        try {
          eng.search(task.prefix, (fit) => {
            n++;
            if (AGG) {
              aggAdd(aggregated, task.pattern, fit, boundary, aggTop);
              if (fit.fillers <= streamMaxFillers) buf.push([task.pattern, fit.parts.join(' '), fit.weight, fit.fillers, fit.codes]);
            } else buf.push([task.pattern, fit.parts.join(' '), fit.weight, fit.fillers, fit.codes]);
            if (lim.maxFits && n >= lim.maxFits) throw ABORT;
          });
        } finally { onFits(buf); }
      }
    } catch (e) { if (e !== ABORT) throw e; aborted = true; }
    return n;
  })() : await (async () => {
    const r = await runPool(threads, { kind: 'names', cfg, tries, stopFlag: lim.flag, deadline: lim.deadline, maxFits: lim.maxFits, agg: AGG, aggTop, boundary, streamMaxFillers }, flat, onFits);
    aborted = r.aborted;
    return r.total;
  })();
  if (stream) await new Promise((r) => stream.end(r));
  const best = top.result().map((r, i) => ({ rank: i + 1, plaintext: r[0], weight: r[1], pattern: r[2], parts: r[3], fillers: r[4] }));
  let cells;
  if (AGG) {
    cells = {};
    for (const k of Object.keys(aggregated).sort()) {
      const c = aggregated[k];
      const [pat] = k.split('|');
      total += c.n;
      perPattern[pat] = (perPattern[pat] || 0) + c.n;
      cells[k] = { n: c.n, sw: c.sw, nb: c.nb, swb: c.swb, top: c.top.map((r) => ({ plaintext: r[0], weight: r[1], parts: r[3] })) };
    }
  }
  const res = {
    tool: 'tools/z13names_enumerate.js names', created: new Date().toISOString(),
    cipher: { id: cs.ci.id, source: cs.ci.source, text: cs.text, length: L, symbols: cs.symbols.length },
    options: {
      mode: cs.mode, patterns, first: o.first || 'all', files: o._files, firstNames: F.length, middleNames: Mlist.length, surnames: Ls.length,
      fillers: K, fillerAt: where, minWeight, threads, pin: o.pin || '', forbid: o['forbid-letters'] || '',
      plaintextLegend: 'upper case = name letter; ? = free filler letter; lower case = filler letter forced by the key',
    },
    counts: {
      complete: !aborted, stoppedBy: aborted ? stopReason(lim) : null, fits: total, rawCallbacks: count, perPattern,
      note: aborted ? 'search stopped early: counts are lower bounds' : undefined,
      cells: AGG ? cells : undefined,
      cellLegend: AGG ? 'key pattern|fillers|leading fillers; n fits, sw sum of prior weights, nb/swb the same for fits with a name-part boundary at --boundary; top = heaviest fits; `top` below holds only streamed fits (fillers <= --stream-max-fillers)' : undefined,
      boundary: AGG ? boundary : undefined, streamMaxFillers: AGG ? streamMaxFillers : undefined,
    },
    timeMs: { total: Date.now() - t0 },
    top: best,
  };
  if (o.out) { fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true }); fs.writeFileSync(o.out, JSON.stringify(res, null, 1)); }
  return res;
}

const HELP = fs.existsSync(__filename) ? fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^'use strict';\s*\/\*\*/, '').replace(/^ \* ?/gm, '') : '';

async function main() {
  const o = parseOpts(process.argv.slice(2));
  const cmd = o._[0];
  if (o.help || !cmd || !o.cipher) { console.log(HELP); return; }
  let res;
  if (cmd === 'words') res = await wordsMode(o);
  else if (cmd === 'names') res = await namesMode(o);
  else { console.log(HELP); process.exitCode = 2; return; }
  console.log(JSON.stringify({ counts: res.counts, timeMs: res.timeMs, options: res.options }, null, 1));
  for (const t of res.top.slice(0, +o.show || 25)) console.log(JSON.stringify(t));
  if (o.out) console.log(`wrote ${o.out}`);
}

module.exports = { buildTrie, makeWordEngine, makeNameEngine, readTsv, wordsMode, namesMode };

if (!isMainThread && workerData && (workerData.kind === 'words' || workerData.kind === 'names')) workerMain();
else if (require.main === module) main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
