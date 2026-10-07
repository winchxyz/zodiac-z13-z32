'use strict';
/**
 * tools/z13phrases_enum.js - exhaustive "Z13 is an English word sequence" search
 * with exact accounting (z13phrases task).  Extends tools/enumerate.js (words
 * mode) without changing it:
 *
 *  - every consistent string is counted, and gets a cheap UPPER BOUND on its
 *    lm.wordSegment log10 P (a unigram-style Viterbi in which every word after the
 *    first is given the largest transition probability any predecessor could give
 *    it; unknown words get their exact spelling-model cost).  Only strings whose
 *    bound reaches --tlow are scored exactly with lm.wordSegment, so the counts
 *    above any threshold >= tlow are exact, not estimates;
 *  - --slip P makes cipher position P a wildcard (any letter, no key constraint):
 *    Zodiac wrote a wrong symbol there.  "all" is not supported here; loop over P;
 *  - --range a:b keeps only positions a..b-1 (null / filler letters outside);
 *  - --null FILE takes the thresholds (percentiles of real held-out phrases of the
 *    same length, tools/z13phrases_null.js) for the scoring vocabulary;
 *  - progress (tasks done / total) on stderr, so a stopped run reports how much
 *    of the space it covered.
 *
 * Usage:
 *   node tools/z13phrases_enum.js --cipher data/ciphers/variants/z13.canonical.txt --mode simple
 *        --top-words 60006 --max-words 5 [--vocab common|full] [--pin "A=A"] [--forbid-letters Q]
 *        [--slip 7] [--range 1:13] [--null results/z13phrases/null_real_phrases.json]
 *        [--tlow -11.4] [--thresholds -9.86,-8.34] [--top 5000] [--threads 4] [--max-seconds 2400]
 *        [--stream results/z13phrases/runs/x.tsv] [--out results/z13phrases/runs/x.json] [--label x]
 *
 * --vocab sets both the enumeration word list (data/lm/words_common.tsv or words.tsv, top
 * --top-words by count, words no longer than the cipher) and the wordSegment scoring vocabulary.
 * --tlow default: the 25th percentile of the real-phrase reference (or -Infinity = score all).
 * --stream-min: only fits with an exact score >= this are streamed / ranked (default tlow, or the
 * real p10 when tlow is -Infinity); the posterior sums still cover every scored fit.
 * Output JSON: counts.consistentStrings (all), counts.scored (bound >= tlow), counts.atLeast
 * {threshold: exact count}, histograms of the bound (all strings) and of the exact score
 * (scored strings, 0.25-wide bins), the top --top fits with keys, and the posterior concentration
 * of the language-model prior restricted to the fits (share of the best fit, effective number).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ROOT = path.join(__dirname, '..');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BIN = 0.25, BIN_LO = -60; // histogram bins [BIN_LO + k*BIN, ...)
const NBINS = Math.ceil(-BIN_LO / BIN) + 1;

/* ------------------------------------------------------------ word engine */
/* Copy of enumerate.js makeWordEngine plus cfg.free: symbols that are wildcards. */
const ABORT = new Error('z13phrases_enum: stopped');

function makeWordEngine(cfg) {
  const { L, M, mode } = cfg;
  const ids = Uint16Array.from(cfg.ids);
  const S = cfg.S;
  const { child, term, remMask } = cfg.trie;
  const maxLen = cfg.trie.maxLen;
  const allowed = cfg.allowedMask;
  const simple = mode === 'simple';
  const free = cfg.free || new Uint8Array(S);
  const keyOf = new Int8Array(S).fill(-1);
  const ownerOf = new Int16Array(26).fill(-1);
  for (let s = 0; s < S; s++) if (cfg.fixed[s] >= 0) { keyOf[s] = cfg.fixed[s]; ownerOf[cfg.fixed[s]] = s; }
  const stN = [], stK = [], stC = new Int32Array(L + 2);
  for (let p = 0; p <= L; p++) { stN.push(new Int32Array(L + 3)); stK.push(new Int32Array(L + 3)); }
  stN[0][0] = 0; stK[0][0] = 0; stC[0] = 1;
  const letters = new Uint8Array(L);
  let prefix = null, stop = L, onLeaf = null;
  let nodesVisited = 0;
  const stopFlag = cfg.stopFlag || null;
  const deadline = cfg.deadline || 0;

  function feasible(node, k, r) {
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
  function addState(N, K, c, node, k) {
    for (let i = 0; i < c; i++) if (N[i] === node) { if (k < K[i]) K[i] = k; return c; }
    N[c] = node; K[c] = k;
    return c + 1;
  }
  function step(p, l) {
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
  function rec(p) {
    if ((++nodesVisited & 0xffff) === 0) {
      if ((stopFlag && Atomics.load(stopFlag, 0) !== 0) || (deadline && Date.now() > deadline)) { if (stopFlag) Atomics.store(stopFlag, 0, 1); throw ABORT; }
    }
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
    const want = prefix && p < prefix.length ? prefix[p] : -1;
    if (free[s]) {
      for (let l = 0; l < 26; l++) {
        if (want >= 0 && l !== want) continue;
        if (!(allowed & (1 << l))) continue;
        if (step(p, l) === 0) continue;
        letters[p] = l;
        rec(p + 1);
      }
      return;
    }
    const cur = keyOf[s];
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
    search(pfx, stopAt, cb) { prefix = pfx; stop = stopAt; onLeaf = cb; rec(0); },
    get nodesVisited() { return nodesVisited; },
  };
}

/* ------------------------------------------------------- score upper bound */

/** Per-word maximum transition log10 P over all predecessors (see header). */
function maxInTable(V) {
  const maxIn = Float64Array.from(V.logp1);
  const KEYMUL = 1048576;
  for (const [k, r] of V.big) {
    const a = Math.floor(k / KEYMUL), b = k - a * KEYMUL;
    if (a === V.START) continue;
    const v = Math.log10(V.lam * r + (1 - V.lam * V.s[a]) * V.p1[b]);
    if (v > maxIn[b]) maxIn[b] = v;
  }
  return maxIn;
}

/** Upper-bound scorer for strings of length n over a scoring trie (term -> vocab id via idOf). */
function makeBound(V, strie, idOf, maxIn, n) {
  const { child, term } = strie;
  const ll = V.lenLog;
  const unkLen = new Float64Array(n + 1);
  for (let L = 1; L <= n; L++) unkLen[L] = V.logPoov + (L <= ll.length ? ll[L - 1] : ll[ll.length - 1] + (L - ll.length) * Math.log10(0.8));
  const J1 = V.J1, logp1 = V.logp1;
  const U = new Float64Array(n + 1), cum = new Float64Array(n + 1);
  const maxU = 20;
  return function bound(letters) {
    for (let k = 0; k < n; k++) cum[k + 1] = cum[k] + J1[letters[k]];
    U.fill(-Infinity);
    for (let i = 0; i < n; i++) {
      const base = i === 0 ? 0 : U[i];
      if (base === -Infinity) continue;
      let node = 0;
      for (let j = i + 1; j <= n; j++) {
        const L = j - i;
        if (node >= 0) node = child[node * 26 + letters[j - 1]];
        let cand;
        if (node >= 0 && term[node] >= 0) {
          const id = idOf[term[node]];
          cand = base + (i === 0 ? logp1[id] : maxIn[id]);
        } else {
          if (L > maxU) break;
          cand = base + unkLen[L] + (cum[j] - cum[i]);
        }
        if (cand > U[j]) U[j] = cand;
      }
    }
    return U[n];
  };
}

/* ------------------------------------------------------------------ worker */

function workerMain() {
  const d = workerData;
  const lm = require('./lm');
  const V = lm.vocab(d.vocab);
  const maxIn = maxInTable(V);
  const bound = makeBound(V, d.strie, d.idOf, maxIn, d.cfg.L);
  const tlow = d.tlow;
  const smin = d.streamMin;
  const every = d.unscoredEvery || 0; // systematic sample: score every k-th string below the bound threshold
  let unseen = 0;
  const thr = d.thresholds;
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    if (m.type !== 'task') return;
    const out = [];
    let count = 0, scored = 0, aborted = false;
    let mZ = 0, mA = 0, mQ = 0; // sums of m, m ln m, m^2 with m = 10^logp over scored fits
    let uN = 0, uZ = 0, uMax = -Infinity; // systematic sample of the unscored strings
    const ubHist = new Float64Array(NBINS), exHist = new Float64Array(NBINS), unHist = new Float64Array(NBINS);
    const atLeast = new Float64Array(thr.length);
    const flush = () => { if (out.length) parentPort.postMessage({ type: 'fits', fits: out.splice(0) }); };
    try {
      if (d.stopFlag && Atomics.load(d.stopFlag, 0) !== 0) throw ABORT;
      const eng = makeWordEngine(Object.assign({}, d.cfg, { trie: d.trie, stopFlag: d.stopFlag, deadline: d.deadline }));
      for (const pfx of m.prefixes) {
        eng.search(pfx, d.cfg.L, (letters) => {
          count++;
          const ub = bound(letters);
          let b = Math.floor((ub - BIN_LO) / BIN); if (b < 0) b = 0; if (b >= NBINS) b = NBINS - 1;
          ubHist[b]++;
          if (ub + 1e-6 < tlow) {
            unHist[b]++;
            if (every && ++unseen % every === 0) {
              let s0 = '';
              for (let i = 0; i < letters.length; i++) s0 += LETTERS[letters[i]];
              const w0 = lm.wordSegment(s0, { vocab: d.vocab }).logp;
              uN++; uZ += Math.pow(10, w0); if (w0 > uMax) uMax = w0;
            }
            return;
          }
          let s = '';
          for (let i = 0; i < letters.length; i++) s += LETTERS[letters[i]];
          const ws = lm.wordSegment(s, { vocab: d.vocab });
          scored++;
          if (ws.logp > ub + 1e-6) parentPort.postMessage({ type: 'boundViolation', s, ub, logp: ws.logp });
          let e = Math.floor((ws.logp - BIN_LO) / BIN); if (e < 0) e = 0; if (e >= NBINS) e = NBINS - 1;
          exHist[e]++;
          for (let t = 0; t < thr.length; t++) if (ws.logp >= thr[t]) atLeast[t]++;
          const mm = Math.pow(10, ws.logp);
          mZ += mm; mA += mm * ws.logp * Math.LN10; mQ += mm * mm;
          if (ws.logp >= smin) out.push([s, ws.logp, ws.words.join(' '), ws.unknown]);
          if (out.length >= 4096) flush();
        });
      }
    } catch (e) {
      if (e !== ABORT) throw e;
      aborted = true;
    }
    flush();
    parentPort.postMessage({ type: 'done', count, scored, aborted, mZ, mA, mQ, uN, uZ, uMax, ubHist: Array.from(ubHist), exHist: Array.from(exHist), unHist: Array.from(unHist), atLeast: Array.from(atLeast) });
  });
  parentPort.postMessage({ type: 'ready' });
}

/* -------------------------------------------------------------------- main */

class TopK {
  constructor(k) { this.k = k; this.a = []; this.min = -Infinity; }
  push(x) {
    if (this.a.length >= this.k && x[1] <= this.min) return;
    this.a.push(x);
    if (this.a.length > this.k * 2) this.trim();
  }
  trim() {
    this.a.sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    if (this.a.length > this.k) this.a.length = this.k;
    if (this.a.length >= this.k) this.min = this.a[this.a.length - 1][1];
  }
  result() { this.trim(); return this.a; }
}

function parseOpts(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (k === 'help' || k === 'quiet') o[k] = true; else o[k] = argv[++i];
  }
  return o;
}

function setup(o) {
  const C = require('./cipher');
  const enumr = require('./enumerate');
  const lm = require('./lm');
  const ci = C.loadCipher(o.cipher);
  let text = ci.text;
  if (o.readorder) text = C.applyReadOrder(text, C.parseReadOrder(o.readorder, text.length));
  let range = null;
  if (o.range) {
    const [a, b] = String(o.range).split(':').map(Number);
    range = [a, b];
    text = text.slice(a, b);
  }
  const L = text.length;
  const { symbols, idOf } = C.symbolTable(text);
  const ids = Array.from(C.symbolTable(text).ids);
  let S = symbols.length;
  const slips = o.slip != null && o.slip !== '' ? String(o.slip).split(',').map(Number) : [];
  const freeList = [];
  for (const p of slips) {
    if (!(p >= 0 && p < L)) throw new Error(`--slip ${p}: outside 0..${L - 1}`);
    ids[p] = S;          // a fresh symbol that occurs only here ...
    freeList.push(S);    // ... and is a wildcard
    S++;
  }
  const free = new Uint8Array(S);
  for (const s of freeList) free[s] = 1;
  const mode = o.mode || 'simple';
  let allowedMask = (1 << 26) - 1;
  for (const ch of String(o['forbid-letters'] || '').toUpperCase()) if (/[A-Z]/.test(ch)) allowedMask &= ~(1 << (ch.charCodeAt(0) - 65));
  const fixed = new Array(S).fill(-1);
  for (const [s, l] of C.parseKey(o.pin || '')) if (idOf.has(s)) fixed[idOf.get(s)] = l.charCodeAt(0) - 65;
  const vocab = o.vocab || 'common';
  const M = +o['max-words'] || 4;
  const topN = +o['top-words'] || 20000;
  const file = o['words-file'] || path.join(ROOT, 'data', 'lm', vocab === 'full' ? 'words.tsv' : 'words_common.tsv');
  const entries = enumr.readTsv(file, topN, L, 1);
  const trie = enumr.buildTrie(entries);
  // scoring trie: vocabulary words of at most L letters, term -> vocab id
  const V = lm.vocab(vocab);
  const sEntries = [], sId = [];
  for (let i = 0; i < V.size; i++) if (V.words[i].length <= L) { sEntries.push({ w: V.words[i], weight: 1 }); sId.push(i); }
  const strie = enumr.buildTrie(sEntries);
  const idOfTerm = new Int32Array(new SharedArrayBuffer(4 * Math.max(1, sId.length)));
  idOfTerm.set(sId);
  // thresholds
  // --tlow / --stream-min take a number or a real-phrase percentile name such as p10 (needs --null)
  let thresholds = [], thrNames = [], nullInfo = null, dist = null;
  if (o.null) {
    const nj = JSON.parse(fs.readFileSync(o.null, 'utf8'));
    const ent = nj.lengths[String(L)];
    if (!ent) throw new Error(`--null: no reference for length ${L}`);
    dist = vocab === 'full' ? ent.logpFull : ent.logpCommon;
    for (const k of ['p10', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99']) { thresholds.push(dist[k]); thrNames.push(`real_${k}`); }
    nullInfo = { file: o.null, length: L, vocab, dist };
  }
  const val = (v) => {
    if (v == null) return null;
    if (/^p\d+$/.test(String(v))) { if (!dist || dist[v] == null) throw new Error(`threshold ${v} needs --null with that percentile`); return dist[v]; }
    return +v;
  };
  let tlow = val(o.tlow);
  if (tlow == null) tlow = dist ? dist.p25 : -Infinity;
  if (o.thresholds) for (const t of String(o.thresholds).split(',')) { thresholds.push(+t); thrNames.push(`t${t}`); }
  let streamMin = o['stream-min'] != null ? val(o['stream-min']) : (Number.isFinite(tlow) ? tlow : (dist ? dist.p10 : -Infinity));
  if (streamMin < tlow) streamMin = tlow;
  return { C, ci, text, L, symbols, ids, S, free, freeList, slips, range, mode, allowedMask, fixed, vocab, M, topN, file, entries, trie, strie, idOfTerm, thresholds, thrNames, tlow, streamMin, nullInfo };
}

function runPool(nThreads, wdata, tasks, onMsg) {
  return new Promise((resolve, reject) => {
    const workers = [];
    let next = 0, active = 0, done = 0, ready = 0;
    const flag = wdata.stopFlag;
    const finish = () => { for (const w of workers) w.terminate(); resolve({ tasksDone: done, tasks: tasks.length }); };
    const give = (w) => {
      if (next >= tasks.length) return false;
      if (Atomics.load(flag, 0) !== 0) return false;
      w.postMessage({ type: 'task', prefixes: tasks[next++] });
      active++;
      return true;
    };
    for (let i = 0; i < nThreads; i++) {
      const w = new Worker(__filename, { workerData: wdata });
      w.on('message', (m) => {
        if (m.type === 'ready') { ready++; if (!give(w) && active === 0 && ready === nThreads) finish(); }
        else if (m.type === 'done') {
          active--;
          if (!m.aborted) done++;
          onMsg(m);
          if (!give(w) && active === 0) finish();
        } else onMsg(m);
      });
      w.on('error', reject);
      workers.push(w);
    }
    if (!tasks.length) finish();
  });
}

function log10SumExp(arr) {
  if (!arr.length) return -Infinity;
  let m = -Infinity;
  for (const v of arr) if (v > m) m = v;
  let s = 0;
  for (const v of arr) s += Math.pow(10, v - m);
  return m + Math.log10(s);
}

async function main() {
  const o = parseOpts(process.argv.slice(2));
  // results/z13phrases/overrides.json {label: {option: value}} replaces options of an already-queued
  // job (used when a batch's job list was fixed before a cheaper setting was chosen); recorded in the output
  let overrides = null;
  try {
    const ovf = path.join(ROOT, 'results', 'z13phrases', 'overrides.json');
    if (o.label && fs.existsSync(ovf)) { const ov = JSON.parse(fs.readFileSync(ovf, 'utf8'))[o.label]; if (ov) { overrides = ov; Object.assign(o, ov); } }
  } catch (e) { console.error('overrides: ' + e.message); }
  if (o.help || !o.cipher) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); return; }
  const t0 = Date.now();
  const cs = setup(o);
  const L = cs.L;
  const cfg = { L, ids: cs.ids, S: cs.S, mode: cs.mode, M: cs.M, allowedMask: cs.allowedMask, fixed: cs.fixed, free: cs.free };
  const threads = Math.max(1, +o.threads || 4);
  // tasks by prefix
  const eng = makeWordEngine(Object.assign({}, cfg, { trie: cs.trie }));
  let d, prefixes = [];
  for (d = 1; d <= Math.min(L, 5); d++) {
    prefixes = [];
    eng.search(null, d, (letters, p) => prefixes.push(Array.from(letters.slice(0, p))));
    if (prefixes.length >= threads * 60) break;
  }
  if (d > Math.min(L, 5)) d = Math.min(L, 5);
  let tasks = [];
  const per = Math.max(1, Math.ceil(prefixes.length / (threads * 30)));
  for (let i = 0; i < prefixes.length; i += per) tasks.push(prefixes.slice(i, i + per));
  // --task-sample K [--task-seed S]: run a uniform random sample of K of the tasks (estimates with standard errors)
  const allTasks = tasks.length;
  let sample = null;
  if (o['task-sample']) {
    const k = Math.min(allTasks, +o['task-sample']);
    const rng = require('./solvercore').makeRng(+o['task-seed'] || 1, 0x7461736b);
    const idx = Array.from({ length: allTasks }, (_, i) => i);
    for (let i = allTasks - 1; i > 0; i--) { const j = rng.int(i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    const pick = idx.slice(0, k).sort((x, y) => x - y);
    sample = { k, of: allTasks, indices: pick, seed: +o['task-seed'] || 1 };
    tasks = pick.map((i) => tasks[i]);
  }
  const perTask = []; // per completed task: [count, atLeast...]
  const maxSeconds = +o['max-seconds'] || 0;
  const stopFlag = new Int32Array(new SharedArrayBuffer(8));
  const deadline = maxSeconds ? Date.now() + maxSeconds * 1000 : 0;
  const K = +o.top || 5000;
  const top = new TopK(K);
  let stream = null;
  if (o.stream) { fs.mkdirSync(path.dirname(path.resolve(o.stream)), { recursive: true }); stream = fs.createWriteStream(o.stream); stream.write('plaintext\twordLogp\twords\tunknown\n'); }
  let total = 0, scored = 0, kept = 0, violations = [];
  const ubHist = new Float64Array(NBINS), exHist = new Float64Array(NBINS), unHist = new Float64Array(NBINS), atLeast = new Float64Array(cs.thresholds.length);
  let mZ = 0, mA = 0, mQ = 0, uNs = 0, uZs = 0, uMaxs = -Infinity;
  const unscoredEvery = o['unscored-every'] != null ? +o['unscored-every'] : 1000;
  const wordsHistAbove = {}; // number of words in the best segmentation, for kept fits above each threshold index 2 (median) if present
  const medIdx = cs.thrNames.indexOf('real_p50');
  let lastP = Date.now(), tasksDone = 0;
  const label = o.label || path.basename(o.out || 'run', '.json');
  const onMsg = (m) => {
    if (m.type === 'fits') {
      for (const f of m.fits) {
        kept++;
        top.push(f);
        if (medIdx >= 0 && f[1] >= cs.thresholds[medIdx]) { const nw = f[2].split(' ').length; wordsHistAbove[nw] = (wordsHistAbove[nw] || 0) + 1; }
        if (stream) stream.write(`${f[0]}\t${f[1].toFixed(4)}\t${f[2]}\t${f[3]}\n`);
      }
    } else if (m.type === 'done') {
      total += m.count; scored += m.scored; tasksDone += m.aborted ? 0 : 1;
      if (!m.aborted) perTask.push([m.count, ...m.atLeast]);
      mZ += m.mZ; mA += m.mA; mQ += m.mQ;
      uNs += m.uN; uZs += m.uZ; if (m.uMax > uMaxs) uMaxs = m.uMax;
      for (let i = 0; i < NBINS; i++) { ubHist[i] += m.ubHist[i]; exHist[i] += m.exHist[i]; unHist[i] += m.unHist[i]; }
      for (let t = 0; t < atLeast.length; t++) atLeast[t] += m.atLeast[t];
      if (!o.quiet && Date.now() - lastP > 15000) {
        lastP = Date.now();
        process.stderr.write(`[${label}] tasks ${tasksDone}/${tasks.length}, strings ${total}, scored ${scored}, kept ${kept}, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
      }
    } else if (m.type === 'boundViolation') {
      if (violations.length < 20) violations.push(m);
    }
  };
  const tSetup = Date.now();
  const r = await runPool(threads, {
    cfg, trie: cs.trie, strie: cs.strie, idOf: cs.idOfTerm, vocab: cs.vocab, tlow: cs.tlow, streamMin: cs.streamMin, unscoredEvery,
    thresholds: cs.thresholds, stopFlag, deadline,
  }, tasks, onMsg);
  if (stream) await new Promise((res) => stream.end(res));
  const complete = r.tasksDone === tasks.length;
  // estimates for the whole space from the completed tasks (exact when every task ran)
  let estimate = null;
  if (sample || !complete) {
    const n = perTask.length, N = allTasks;
    const est = (col) => {
      if (!n) return null;
      const xs = perTask.map((t) => t[col]);
      const mean = xs.reduce((a2, b2) => a2 + b2, 0) / n;
      const v = n > 1 ? xs.reduce((a2, x) => a2 + (x - mean) * (x - mean), 0) / (n - 1) : NaN;
      return { estimate: N * mean, se: n > 1 ? N * Math.sqrt(v / n) * Math.sqrt(1 - n / N) : null };
    };
    estimate = {
      note: sample ? 'uniform random sample of tasks; total = tasks x mean per task, se with finite-population correction' : 'run stopped early: tasks were run roughly in prefix order, so this extrapolation is BIASED; use --task-sample for an unbiased estimate',
      tasksUsed: n, tasksTotal: N,
      consistentStrings: est(0),
      atLeast: Object.fromEntries(cs.thrNames.map((nm, i) => [nm, cs.thresholds[i] >= cs.tlow ? est(i + 1) : null])),
    };
  }
  const best = top.result();
  // keys for the top fits
  const keyOf = (pt) => {
    const k = {};
    for (let p = 0; p < L; p++) {
      const s = cs.ids[p];
      if (cs.free[s]) continue;
      const sym = cs.symbols[s];
      if (k[sym] && k[sym] !== pt[p]) return null;
      k[sym] = pt[p];
    }
    if (cs.mode === 'simple') { const v = Object.values(k); if (new Set(v).size !== v.length) return null; }
    return k;
  };
  // posterior of the LM prior restricted to the scored fits: Z = sum m, H = ln Z - (sum m ln m)/Z
  const lse = mZ > 0 ? Math.log10(mZ) : -Infinity;
  const ent = mZ > 0 ? Math.log(mZ) - mA / mZ : 0;
  const sq = mZ > 0 ? mQ / (mZ * mZ) : 0;
  const unscored = total - scored;
  const hist = (h) => { const out = {}; for (let i = 0; i < NBINS; i++) if (h[i]) out[(BIN_LO + i * BIN).toFixed(2)] = h[i]; return out; };
  const res = {
    tool: 'tools/z13phrases_enum.js', created: new Date().toISOString(), label,
    cipher: { id: cs.ci.id, source: cs.ci.source, text: cs.text, length: L, symbols: cs.symbols.length, range: cs.range, slips: cs.slips, isomorphAfterSlips: cs.ids.map((s) => (cs.free[s] ? '*' : 'abcdefghijklmnopqrstuvwxyz'[s])).join('') },
    options: { overrides, mode: cs.mode, topWords: cs.topN, wordsUsed: cs.entries.length, maxWords: cs.M, vocab: cs.vocab, wordList: path.relative(ROOT, cs.file).replace(/\\/g, '/'), pin: o.pin || '', forbid: o['forbid-letters'] || '', tlow: cs.tlow, streamMin: cs.streamMin, threads, taskDepth: d, tasks: tasks.length, maxSeconds },
    reference: cs.nullInfo,
    counts: {
      complete, tasksDone: r.tasksDone, tasks: tasks.length, taskSample: sample, estimate,
      consistentStrings: total, scored, keptAtLeastStreamMin: kept,
      atLeast: Object.fromEntries(cs.thrNames.map((n, i) => [n, { threshold: cs.thresholds[i], count: cs.thresholds[i] >= cs.tlow ? atLeast[i] : null, exact: cs.thresholds[i] >= cs.tlow }])),
      boundViolations: violations.length,
      note: complete ? 'complete enumeration; counts at thresholds >= tlow are exact' : 'stopped early: all counts are lower bounds for the space searched (tasksDone/tasks)',
    },
    wordsInBestSegmentationAboveMedian: wordsHistAbove,
    posterior: {
      note: 'LM prior (10^wordLogp) renormalised over all scored fits (score bound >= tlow); unscored fits add at most unscoredMassBound relative mass',
      log10TotalMassScored: lse,
      topShare: best.length && mZ > 0 ? Math.pow(10, best[0][1]) / mZ : null,
      top10Share: best.length && mZ > 0 ? best.slice(0, 10).reduce((a, f) => a + Math.pow(10, f[1]), 0) / mZ : null,
      effectiveNumberExpEntropy: Math.exp(ent),
      effectiveNumberInverseSimpson: sq ? 1 / sq : null,
      unscoredMassBoundRelative: Number.isFinite(cs.tlow) ? unscored * Math.pow(10, cs.tlow - lse) : 0,
      unscoredSample: { every: unscoredEvery, sampled: uNs, maxWordLogp: uNs ? uMaxs : null,
        massEstimateRelative: uNs && mZ > 0 ? (uZs * unscoredEvery) / mZ : null,
        note: 'systematic sample (every k-th unscored string scored exactly); estimated total mass of the unscored fits relative to the scored mass' },
      unscoredMassBoundFromBoundHistogram: (() => { let u = 0; for (let i = 0; i < NBINS; i++) if (unHist[i]) u += unHist[i] * Math.pow(10, Math.min(cs.tlow, BIN_LO + (i + 1) * BIN) - lse); return u; })(),
    },
    histograms: { binWidth: BIN, boundAllStrings: hist(ubHist), exactScored: hist(exHist), boundUnscored: hist(unHist) },
    timeMs: { total: Date.now() - t0, setup: tSetup - t0 },
    violations,
    top: best.map((f, i) => ({ rank: i + 1, plaintext: f[0], wordLogp: +f[1].toFixed(4), words: f[2], unknown: f[3], key: i < 200 ? keyOf(f[0]) : undefined })),
  };
  if (o.out) { fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true }); fs.writeFileSync(o.out, JSON.stringify(res, null, 1)); }
  console.log(JSON.stringify({ label, cipher: res.cipher, counts: res.counts, posterior: res.posterior, timeMs: res.timeMs }, null, 1));
  for (const t of res.top.slice(0, +o.show || 15)) console.log(t.rank, t.plaintext, t.wordLogp, t.words);
  if (o.out) console.log(`wrote ${o.out}`);
}

if (!isMainThread && workerData && workerData.cfg) workerMain();
else if (require.main === module) main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });

module.exports = { makeWordEngine, maxInTable, makeBound };
