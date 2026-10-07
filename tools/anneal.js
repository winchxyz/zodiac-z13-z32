'use strict';
/**
 * tools/anneal.js - homophonic (or simple) substitution solver by simulated
 * annealing + greedy polish with random restarts, parallel over worker_threads.
 *
 * CLI (see HELP below or run with --help):
 *   node tools/anneal.js --cipher data/ciphers/z408.json --restarts 36 --iters 400000 --out results/z408_anneal.json
 *
 * Library:
 *   const A = require('./anneal');
 *   const pool = A.createPool({threads: 18, orders: [5]});
 *   const res = await A.solve({cipher: 'data/ciphers/z13.json', restarts: 2000, iters: 20000, n: '5', top: 20}, pool);
 *   pool.close();
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const C = require('./cipher');
const lm = require('./lm');
const lmshare = require('./lmshare');
const core = require('./solvercore');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/* ------------------------------------------------------------------ options */

const DEFAULTS = {
  mode: 'homophonic', n: '5', score: 'joint', six: 'exact',
  restarts: 40, iters: 0 /* auto */, T0: 0 /* auto */, T1: 0,
  threads: 0 /* auto */, seed: 1, top: 10, perRestart: 1,
  wordweight: 0, wordinner: 'auto', wordInnerMax: 64, vocab: 'common', wordmodel: 'fast',
  ioc: 0, iocTarget: 0, entropy: 0.5, entropyTarget: 0, maxPerLetter: 0,
  pin: '', crib: [], forbid: '', polish: true, batch: 0, quiet: false,
  maxPinSets: 200000,
};

/** "5" | "4,5" | "3:0.5,5:1" -> [{n, w}] */
function parseOrders(spec) {
  if (Array.isArray(spec)) return spec.map((o) => (typeof o === 'number' ? { n: o, w: 1 } : { n: +o.n, w: o.w == null ? 1 : +o.w }));
  return String(spec).split(',').filter(Boolean).map((t) => {
    const [n, w] = t.split(':');
    const nn = parseInt(n, 10);
    if (!(nn >= 1 && nn <= 6)) throw new Error(`--n: order must be 1..6, got '${t}'`);
    return { n: nn, w: w == null ? 1 : parseFloat(w) };
  });
}

/** Auto iterations: enough for Z408-size problems, cheap for short ones. */
function autoIters(L, S) {
  return Math.round(Math.min(3000000, Math.max(20000, 2000 * S * Math.sqrt(L))));
}

/** Auto start temperature (in log10 units of the score), scaled by the order weights. */
function autoT0(orders, score) {
  // tuned on Z408 / Z340 (reading order) / synthetic 340-letter ciphers: T0 = 8 for joint 5-grams
  let w = 0;
  for (const o of orders) w += o.w * (score === 'markov' ? 0.5 : 1.6) * o.n;
  return Math.max(0.05, w);
}

/** Expected plug-in entropy (bits) of an i.i.d. English letter sample of length L. */
function expectedEntropy(L, seed = 7) {
  const f = lm.meta().ngrams.letter_frequencies;
  const p = LETTERS.split('').map((c) => f[c]);
  const cdf = [];
  let a = 0;
  for (const x of p) { a += x; cdf.push(a); }
  const rng = core.makeRng(seed, 0);
  const N = 4000;
  let tot = 0;
  const cnt = new Int32Array(26);
  for (let t = 0; t < N; t++) {
    cnt.fill(0);
    for (let i = 0; i < L; i++) {
      const u = rng.next() * a;
      let k = 0;
      while (k < 25 && cdf[k] < u) k++;
      cnt[k]++;
    }
    let s = 0;
    for (let k = 0; k < 26; k++) if (cnt[k]) s += cnt[k] * Math.log2(cnt[k]);
    tot += Math.log2(L) - s / L;
  }
  return tot / N;
}

function englishIoc() {
  const f = lm.meta().ngrams.letter_frequencies;
  let s = 0;
  for (const c of LETTERS) s += f[c] * f[c];
  return s;
}

/* -------------------------------------------------------------------- cribs */

/** "WORD@12,OTHER@any" or array -> [{word, pos: number | 'any'}] */
function parseCribs(spec) {
  if (!spec) return [];
  const items = Array.isArray(spec) ? spec : [spec];
  const out = [];
  for (const it of items) {
    if (!it) continue;
    if (typeof it === 'object') { out.push({ word: String(it.word).toUpperCase(), pos: it.pos }); continue; }
    for (const t of String(it).split(',').filter(Boolean)) {
      const m = /^([A-Za-z]+)@(any|\d+)$/i.exec(t.trim());
      if (!m) throw new Error(`--crib: expected WORD@pos or WORD@any, got '${t}'`);
      out.push({ word: m[1].toUpperCase(), pos: /any/i.test(m[2]) ? 'any' : parseInt(m[2], 10) });
    }
  }
  return out;
}

/** Try to add pins [s, l] to a fixed array copy; returns the new array or null if inconsistent. */
function mergePins(fixed, pins, mode) {
  const f = Int8Array.from(fixed);
  for (const [s, l] of pins) {
    if (f[s] >= 0 && f[s] !== l) return null;
    f[s] = l;
  }
  if (mode === 'simple') {
    const own = new Int16Array(26).fill(-1);
    for (let s = 0; s < f.length; s++) if (f[s] >= 0) {
      if (own[f[s]] >= 0 && own[f[s]] !== s) return null;
      own[f[s]] = s;
    }
  }
  return f;
}

function cribPins(ids, word, pos) {
  const pins = [];
  for (let i = 0; i < word.length; i++) pins.push([ids[pos + i], word.charCodeAt(i) - 65]);
  return pins;
}

/* ------------------------------------------------------------- definitions */

/**
 * Build the cipher view and the structured-cloneable problem definition.
 * Returns {def, view} where view has the symbols, reading-order text, crib info, etc.
 */
function makeProblem(o) {
  const ci = C.loadCipher(o.cipher);
  let order = null;
  if (o.readorder) order = C.parseReadOrder(o.readorder, ci.text.length);
  else if (ci.readOrder && !o.written) order = ci.readOrder;
  const text = order ? C.applyReadOrder(ci.text, order) : ci.text;
  // known plaintext (if any) in reading order: the aligned plaintext put through the read order in use
  const truth = order ? (ci.plaintext && ci.plaintext.length === ci.text.length ? C.applyReadOrder(ci.plaintext, order) : ci.plaintextReadOrder) : ci.plaintext;
  const { symbols, idOf, ids } = C.symbolTable(text);
  const S = symbols.length, L = text.length;
  const mode = o.mode;
  if (mode !== 'homophonic' && mode !== 'simple') throw new Error(`--mode must be homophonic or simple`);
  let forbidMask = 0;
  for (const ch of String(o.forbid || '').toUpperCase()) if (/[A-Z]/.test(ch)) forbidMask |= 1 << (ch.charCodeAt(0) - 65);
  let fixed = new Int8Array(S).fill(-1);
  const pinMap = C.parseKey(o.pin || '');
  const warnings = [];
  for (const [sym, l] of pinMap) {
    if (!idOf.has(sym)) { warnings.push(`pin ${sym}=${l}: symbol not in cipher, ignored`); continue; }
    fixed[idOf.get(sym)] = l.charCodeAt(0) - 65;
  }
  const merged0 = mergePins(fixed, [], mode);
  if (!merged0) throw new Error('pins are inconsistent with simple-substitution mode (two symbols pinned to one letter)');
  const cribs = parseCribs(o.crib);
  const anyCribs = [];
  for (const cr of cribs) {
    if (cr.pos === 'any') { anyCribs.push(cr); continue; }
    if (cr.pos < 0 || cr.pos + cr.word.length > L) throw new Error(`crib ${cr.word}@${cr.pos} runs past the cipher end`);
    const f = mergePins(fixed, cribPins(ids, cr.word, cr.pos), mode);
    if (!f) throw new Error(`crib ${cr.word}@${cr.pos} is inconsistent with the cipher/pins under ${mode} substitution`);
    fixed = f;
  }
  // forbidden letters among pins are allowed (pins win) but noted
  for (let s = 0; s < S; s++) if (fixed[s] >= 0 && (forbidMask & (1 << fixed[s]))) warnings.push(`symbol ${symbols[s]} is pinned to forbidden letter ${LETTERS[fixed[s]]}`);
  let pinSets = null, pinSetPositions = null;
  const cribFeasible = [];
  if (anyCribs.length) {
    const lists = anyCribs.map((cr) => {
      const ok = [];
      for (let p = 0; p + cr.word.length <= L; p++) {
        const pins = cribPins(ids, cr.word, p);
        if (pins.some(([, l]) => forbidMask & (1 << l))) continue;
        if (mergePins(fixed, pins, mode)) ok.push(p);
      }
      cribFeasible.push({ word: cr.word, positions: ok });
      return ok;
    });
    if (lists.some((l) => l.length === 0)) {
      const bad = anyCribs.filter((_, i) => lists[i].length === 0).map((c) => c.word);
      throw new Error(`crib(s) ${bad.join(', ')} fit nowhere in the cipher under ${mode} substitution with the given pins`);
    }
    pinSets = [];
    pinSetPositions = [];
    const total = lists.reduce((a, l) => a * l.length, 1);
    const rng = core.makeRng(o.seed >>> 0, 987654321);
    const tryCombo = (idx) => {
      let f = fixed;
      const posArr = [];
      const extra = [];
      for (let k = 0; k < lists.length; k++) {
        const p = idx[k];
        posArr.push(p);
        const pins = cribPins(ids, anyCribs[k].word, p);
        f = mergePins(f, pins, mode);
        if (!f) return;
        extra.push(...pins);
      }
      if (mode === 'simple') {
        let nf = 0, used = 0;
        for (let s = 0; s < S; s++) if (f[s] < 0) nf++;
        const seenL = new Set();
        for (let s = 0; s < S; s++) if (f[s] >= 0) seenL.add(f[s]);
        for (let l = 0; l < 26; l++) if (!(forbidMask & (1 << l)) && !seenL.has(l)) used++;
        if (nf > used) return;
      }
      const uniq = new Map();
      for (const [s, l] of extra) uniq.set(s, l);
      pinSets.push([...uniq]);
      pinSetPositions.push(posArr);
    };
    if (total <= o.maxPinSets) {
      const idx = new Array(lists.length).fill(0);
      for (let t = 0; t < total; t++) {
        let x = t;
        for (let k = lists.length - 1; k >= 0; k--) { idx[k] = lists[k][x % lists[k].length]; x = Math.floor(x / lists[k].length); }
        tryCombo(idx.slice());
      }
    } else {
      for (let t = 0; t < o.maxPinSets; t++) tryCombo(lists.map((l) => l[rng.int(l.length)]));
      warnings.push(`${total} crib position combinations; sampled ${o.maxPinSets}`);
    }
    if (!pinSets.length) throw new Error('no mutually consistent placement of the @any cribs');
  }
  if (mode === 'simple') {
    let free = 0;
    for (let s = 0; s < S; s++) if (fixed[s] < 0) free++;
    let avail = 0;
    const usedL = new Set([...fixed].filter((x) => x >= 0));
    for (let l = 0; l < 26; l++) if (!(forbidMask & (1 << l)) && !usedL.has(l)) avail++;
    if (free > avail) throw new Error(`simple mode: ${free} free symbols but only ${avail} unused allowed letters`);
  }
  const orders = parseOrders(o.n);
  const useOrders = orders.filter((x) => x.n <= L);
  const finalOrders = useOrders.length ? useOrders : [{ n: Math.min(L, 5), w: 1 }];
  const wordInner = o.wordweight > 0 && (o.wordinner === true || o.wordinner === 'true' || (o.wordinner === 'auto' && L <= o.wordInnerMax));
  const iocTarget = o.iocTarget || englishIoc();
  const entTarget = o.entropy ? (o.entropyTarget || expectedEntropy(L)) : 0;
  const def = {
    L, S, c: Array.from(ids), mode, orders: finalOrders, score: o.score,
    fixed: Array.from(fixed), forbidMask, pinSets,
    maxPerLetter: +o.maxPerLetter || 0,
    iocW: +o.ioc || 0, iocTarget, entW: +o.entropy || 0, entTarget,
    wordW: +o.wordweight || 0, wordInner, vocab: o.vocab, wordModel: o.wordmodel === 'exact' ? 'exact' : 'fast',
    // the exact (bigram) inner word term costs ~50-150 us per proposal, so its auto budget is capped at 20k
    iters: +o.iters || (wordInner && o.wordmodel === 'exact' ? Math.min(20000, autoIters(L, S)) : autoIters(L, S)),
    T0: +o.T0 || autoT0(finalOrders, o.score), T1: +o.T1 || 0,
    perRestart: +o.perRestart || 1, polish: o.polish !== false && o.polish !== 'false',
    seed: +o.seed >>> 0,
  };
  const view = {
    cipherId: ci.id, source: ci.source, written: ci.text, text, readOrder: order, symbols, ids, truth,
    cribs, cribFeasible, pinSetPositions, warnings,
  };
  return { def, view };
}

/* --------------------------------------------------------------------- pool */

function lmSpecFor(def, six) {
  return { orders: def.orders.map((o) => o.n), markov: def.score === 'markov', six };
}

class Pool {
  constructor(opts = {}) {
    this.n = Math.max(1, opts.threads || Math.max(1, os.cpus().length - 2));
    this.spec = { orders: [...new Set(opts.orders || [5])], markov: !!opts.markov, six: opts.six || 'exact' };
    this.shared = lmshare.build(this.spec);
    this.workers = [];
    this.pid = 0;
    this.jobId = 0;
    this.inProcess = this.n <= 1 && !opts.forceWorkers;
    if (!this.inProcess) {
      for (let i = 0; i < this.n; i++) {
        const w = new Worker(path.join(__dirname, 'anneal_worker.js'), { workerData: { lm: this.shared } });
        w.unref();
        this.workers.push(w);
      }
    } else {
      this.T = lmshare.attach(this.shared);
    }
  }

  covers(spec) {
    const have = new Set(this.spec.orders);
    if (spec.orders.some((n) => !have.has(n))) return false;
    if (spec.markov && !this.spec.markov) return false;
    if (spec.orders.includes(6) && spec.six !== this.spec.six) return false;
    return true;
  }

  /** Run restarts [0, nRestarts) of def; resolves to an array of restart outputs. */
  run(def, nRestarts, opts = {}) {
    const pid = ++this.pid;
    if (this.inProcess) {
      const wordSeg = def.wordW && def.wordInner ? core.wordScorer(def) : null;
      const P = core.prepare(def, this.T, wordSeg);
      const out = [];
      for (let r = 0; r < nRestarts; r++) {
        out.push(core.runRestart(P, r));
        if (opts.onProgress) opts.onProgress(out.length, nRestarts);
      }
      return Promise.resolve(out);
    }
    const batch = Math.max(1, opts.batch || Math.ceil(nRestarts / (this.n * 6)));
    const jobs = [];
    for (let r = 0; r < nRestarts; r += batch) jobs.push([r, Math.min(nRestarts, r + batch)]);
    return new Promise((resolve, reject) => {
      const out = [];
      let next = 0, active = 0, done = 0, failed = false;
      const handlers = [];
      const cleanup = () => this.workers.forEach((w, i) => w.off('message', handlers[i]));
      const dispatch = (w) => {
        if (next >= jobs.length) return false;
        const [r0, r1] = jobs[next++];
        active++;
        w.postMessage({ type: 'job', pid, jobId: ++this.jobId, r0, r1 });
        return true;
      };
      this.workers.forEach((w, i) => {
        const h = (m) => {
          if (failed || m.pid !== pid) return;
          if (m.type === 'error') { failed = true; cleanup(); reject(new Error(m.error)); return; }
          if (m.type !== 'done') return;
          active--;
          for (const x of m.out) out.push(x);
          done += m.out.length;
          if (opts.onProgress) opts.onProgress(done, nRestarts);
          if (!dispatch(w) && active === 0) { cleanup(); resolve(out.sort((a, b) => a.restart - b.restart)); }
        };
        handlers[i] = h;
        w.on('message', h);
        w.ref();
      });
      for (const w of this.workers) w.postMessage({ type: 'problem', pid, def });
      for (const w of this.workers) dispatch(w);
      if (jobs.length === 0) { cleanup(); resolve(out); }
    }).finally(() => { for (const w of this.workers) w.unref(); });
  }

  close() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }
}

function createPool(opts = {}) {
  return new Pool(opts);
}

/* ------------------------------------------------------------------- solve */

function decodeKey(view, keyStr) {
  let pt = '';
  for (let i = 0; i < view.ids.length; i++) pt += keyStr[view.ids[i]];
  return pt;
}

function keyObject(view, keyStr) {
  const o = {};
  view.symbols.forEach((s, i) => { o[s] = keyStr[i]; });
  return o;
}

function letterStats(pt) {
  const cnt = new Int32Array(26);
  for (const ch of pt) cnt[ch.charCodeAt(0) - 65]++;
  let s2 = 0, s = 0;
  for (const k of cnt) { s2 += k * (k - 1); if (k) s += k * Math.log2(k); }
  const L = pt.length;
  return { ioc: L > 1 ? s2 / (L * (L - 1)) : 0, entropyBits: L ? Math.log2(L) - s / L : 0 };
}

/**
 * Solve.  `opts` uses the CLI option names (see HELP).  `pool` is optional; when
 * omitted a pool is created for this call and closed afterwards.
 */
async function solve(userOpts = {}, pool = null) {
  const o = Object.assign({}, DEFAULTS, userOpts);
  if (typeof o.crib === 'string') o.crib = [o.crib];
  const t0 = Date.now();
  const { def, view } = makeProblem(o);
  const spec = lmSpecFor(def, o.six);
  let own = false;
  const threads = +o.threads || Math.max(1, Math.min(os.cpus().length - 2, +o.restarts));
  if (!pool || !pool.covers(spec)) {
    if (pool && !o.quiet) process.stderr.write('anneal: pool lacks the needed tables; creating a temporary pool\n');
    pool = createPool({ threads, orders: spec.orders, markov: spec.markov, six: spec.six });
    own = true;
  }
  const tLoad = Date.now();
  let lastP = 0;
  const outs = await pool.run(def, +o.restarts, {
    batch: +o.batch || 0,
    onProgress: o.quiet ? null : (d, n) => {
      const now = Date.now();
      if (now - lastP > 2000 || d === n) { lastP = now; process.stderr.write(`\ranneal: ${d}/${n} restarts, ${((now - t0) / 1000).toFixed(1)} s`); }
    },
  });
  if (!o.quiet) process.stderr.write('\n');
  if (own) pool.close();
  const tSearch = Date.now();
  // aggregate distinct plaintexts
  const byKey = new Map();
  for (const ro of outs) {
    ro.results.forEach((res, rank) => {
      let e = byKey.get(res.key);
      if (!e) {
        e = { key: res.key, score: res.score, ngram: res.ngram, sums: res.sums, pen: res.pen, word: res.word, hits: 0, seen: 0, restarts: [], pinSets: new Set() };
        byKey.set(res.key, e);
      }
      if (rank === 0) { e.hits++; if (e.restarts.length < 12) e.restarts.push(ro.restart); }
      e.seen++;
      if (ro.pinSetIndex >= 0) e.pinSets.add(ro.pinSetIndex);
    });
  }
  let sols = [...byKey.values()].sort((a, b) => b.score - a.score);
  // optional final word-term polish for long texts (word term not in the inner loop)
  let wordPolished = false;
  if (def.wordW > 0 && !def.wordInner) {
    const T = lmshare.attach(lmshare.build(spec));
    const P = core.prepare(Object.assign({}, def, { wordInner: true }), T, core.wordScorer(def));
    const nPol = Math.min(sols.length, Math.max(+o.top, 10));
    const polished = [];
    for (let i = 0; i < nPol; i++) {
      const e = sols[i];
      let fixedArr = def.fixed;
      if (def.pinSets && e.pinSets.size) {
        const f = Int8Array.from(def.fixed);
        for (const [s, l] of def.pinSets[[...e.pinSets][0]]) f[s] = l;
        fixedArr = Array.from(f);
      }
      const r = core.polishKey(P, e.key, fixedArr);
      polished.push(Object.assign({}, e, r, { polishedFrom: e.key !== r.key ? e.key : undefined }));
    }
    // merge by key
    const m = new Map();
    for (const e of polished) {
      const x = m.get(e.key);
      if (!x) m.set(e.key, e);
      else { x.hits += e.hits; x.seen += e.seen; for (const p of e.pinSets) x.pinSets.add(p); }
    }
    sols = [...m.values()].sort((a, b) => b.score - a.score);
    wordPolished = true;
  }
  const top = sols.slice(0, +o.top).map((e, i) => {
    const pt = decodeKey(view, e.key);
    const ws = lm.wordSegment(pt, { vocab: o.vocab });
    const ng = {};
    for (const ord of def.orders) {
      const r = lm.ngramScore(pt, ord.n);
      ng[ord.n] = { sum: r.sum, perWindow: r.perWindow, logp: r.logp, perChar: r.perChar };
    }
    const sol = {
      rank: i + 1, plaintext: pt, score: e.score, ngramTerm: e.ngram, penalty: e.pen, wordTerm: e.word,
      ngram: ng, words: ws.words.join(' '), wordLogp: ws.logp, wordPerChar: ws.perChar, unknownWords: ws.unknownWords,
      hits: e.hits, seen: e.seen, restarts: e.restarts,
      key: keyObject(view, e.key), keyString: view.symbols.map((s, k) => `${s}=${e.key[k]}`).join(','),
      symbolsPerLetter: C.symbolsPerLetter(new Map(view.symbols.map((s, k) => [s, e.key[k]]))),
      stats: letterStats(pt),
    };
    if (e.polishedFrom) sol.polishedFrom = decodeKey(view, e.polishedFrom);
    if (view.pinSetPositions && e.pinSets.size) {
      sol.cribPositions = [...e.pinSets].slice(0, 20).map((k) => view.pinSetPositions[k]);
    }
    if (view.truth && view.truth.length === pt.length) {
      let ok = 0, n = 0;
      for (let k = 0; k < pt.length; k++) if (/[A-Z]/.test(view.truth[k])) { n++; if (view.truth[k] === pt[k]) ok++; }
      sol.accuracy = n ? ok / n : null;
    }
    return sol;
  });
  const res = {
    tool: 'tools/anneal.js',
    created: new Date().toISOString(),
    cipher: { id: view.cipherId, source: view.source, length: def.L, symbols: def.S, text: view.text, readOrder: view.readOrder ? 'applied' : null, isomorph: C.isomorph(view.text) },
    options: {
      mode: def.mode, orders: def.orders, score: def.score, six: o.six, restarts: +o.restarts, iters: def.iters, T0: def.T0, T1: def.T1,
      threads: own ? threads : pool.n, seed: def.seed, perRestart: def.perRestart, polish: def.polish,
      wordweight: def.wordW, wordModel: def.wordModel, wordInner: def.wordInner, wordFinalPolish: wordPolished, vocab: def.vocab,
      ioc: def.iocW, iocTarget: def.iocTarget, entropy: def.entW, entropyTarget: def.entTarget, maxPerLetter: def.maxPerLetter,
      pin: o.pin || '', crib: view.cribs, forbid: o.forbid || '', pinSets: def.pinSets ? def.pinSets.length : 0,
    },
    cribFeasible: view.cribFeasible,
    warnings: view.warnings,
    summary: {
      restarts: outs.length, distinct: sols.length,
      bestScore: sols.length ? sols[0].score : null,
      bestHits: sols.length ? sols[0].hits : 0,
      bestHitFraction: sols.length ? sols[0].hits / outs.length : 0,
      timeMs: { total: Date.now() - t0, setup: tLoad - t0, search: tSearch - tLoad },
      restartMs: (() => { const v = outs.map((x) => x.ms || 0).sort((x, y) => x - y); return v.length ? { min: v[0], median: v[v.length >> 1], max: v[v.length - 1], sum: v.reduce((x, y) => x + y, 0) } : null; })(),
    },
    truth: view.truth || null,
    solutions: top,
  };
  if (view.truth && /^[A-Z]+$/.test(view.truth) && view.truth.length === def.L) {
    // how the known plaintext scores under the same objective (if it is consistent)
    const chk = C.checkCandidate(view.text, view.truth, { mode: 'homophonic' });
    const keyStr = view.symbols.map((s) => chk.key[s] || 'E').join('');
    const T = lmshare.attach(lmshare.build(spec));
    // same objective as the reported solution scores (word term included when it was used, inner or final polish)
    const withWord = def.wordInner || wordPolished;
    const P = core.prepare(Object.assign({}, def, { wordInner: withWord }), T, withWord ? core.wordScorer(def) : null);
    const sc = core.scoreKey(P, keyStr);
    res.truthScore = { consistent: chk.ok, plaintextUnderMajorityKey: decodeKey(view, keyStr), score: sc.score, ngramTerm: sc.ngram };
  }
  if (o.out) {
    fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
    fs.writeFileSync(o.out, JSON.stringify(res, null, 1));
  }
  return res;
}

/* ---------------------------------------------------------------------- CLI */

const HELP = `tools/anneal.js - homophonic substitution solver (simulated annealing, random restarts, worker_threads)

  node tools/anneal.js --cipher <json|txt|raw string> [options]

Input
  --cipher X           cipher JSON (data/ciphers/z408.json), text file of rows, or a raw symbol string
  --readorder F        read order file/inline list (order[k] = written index read k-th); a JSON
                       read_order field is used automatically unless --written is given
  --mode M             homophonic (default: same symbol -> same letter) | simple (also 1:1)
Search
  --restarts N         independent restarts (default ${DEFAULTS.restarts})
  --iters N            annealing proposals per restart (default auto: 2000*S*sqrt(L), 20k..3M;
                       at most 20k when --wordmodel exact is in the inner loop)
  --T0 x --T1 y        start / end temperature in log10 score units (default T0 = 1.6*n*w summed over orders
                       for --score joint, 0.5*n*w for markov; T1 0), linear schedule
  --threads N          worker threads (default: cores-2, at most --restarts; 1 = run in-process)
  --seed N             base seed; restart r uses stream r, so results do not depend on --threads
  --per-restart K      keep the K best distinct keys seen in each restart (default 1)
  --no-polish          skip the final greedy hill-climb
Score
  --n SPEC             n-gram order(s): "5", "6", or weighted "3:0.3,5:1" (default 5)
  --score joint|markov joint = sum of joint log10 P over windows (classic); markov = log10 P(text)
  --six exact|dense    6-gram lookup: exact backoff (default) or the 309 MB byte table (faster)
  --wordweight w       add w * (word-segmentation log10 P of the plaintext) to the score; in the annealing
                       loop when L <= ${DEFAULTS.wordInnerMax} (--wordinner auto), else only in a final greedy polish
  --wordmodel M        fast (default: unigram trie Viterbi, tools/wordfast.js, ~280k calls/s on 32 letters)
                       | exact (lm.wordSegment with the word-bigram model, ~13k calls/s); solutions are
                       always reported with lm.wordSegment
  --wordinner auto|true|false
  --vocab common|full  vocabulary for the word term (default common)
  --ioc w              penalty w*L*max(0, IoC - target), target = English sum p^2 (--ioc-target)
  --entropy w          penalty w*L*max(0, target - H) bits, target = expected H of an English sample of
                       length L (default 0.5; 0 disables; without it the n-gram optimum of Z408 is degenerate)
  --max-per-letter K   at most K symbols per letter
Constraints
  --pin "S=L,S=L"      fixed mappings (each S is one character, so "==E" pins symbol '=')
  --crib WORD@pos      WORD must start at reading position pos (0-based); repeatable / comma list
  --crib WORD@any      WORD must appear somewhere: every feasible placement is tried, cycling over restarts
  --forbid-letters XYZ no symbol may decrypt to these letters
Output
  --top K              number of distinct solutions reported (default ${DEFAULTS.top})
  --out FILE           write the full JSON result (results/<name>.json)
  --quiet              no progress on stderr
`;

function cliOptions(argv) {
  const o = {};
  const crib = [];
  const flags = new Set(['no-polish', 'quiet', 'written', 'help']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument '${a}'`);
    const k = a.slice(2);
    if (flags.has(k)) { o[k] = true; continue; }
    const v = argv[++i];
    if (v === undefined) throw new Error(`--${k} needs a value`);
    if (k === 'crib') crib.push(v); else o[k] = v;
  }
  const map = {
    'per-restart': 'perRestart', 'forbid-letters': 'forbid', 'ioc-target': 'iocTarget', 'entropy-target': 'entropyTarget',
    'max-per-letter': 'maxPerLetter', 'word-weight': 'wordweight', 'read-order': 'readorder',
  };
  for (const [a, b] of Object.entries(map)) if (o[a] !== undefined) { o[b] = o[a]; delete o[a]; }
  if (o['no-polish']) { o.polish = false; delete o['no-polish']; }
  if (crib.length) o.crib = crib;
  return o;
}

async function main() {
  const o = cliOptions(process.argv.slice(2));
  if (o.help || !o.cipher) { console.log(HELP); return; }
  const res = await solve(o);
  const s = res.summary;
  console.log(`cipher ${res.cipher.id}: L=${res.cipher.length} S=${res.cipher.symbols} mode=${res.options.mode} n=${res.options.orders.map((x) => x.n + ':' + x.w).join(',')} iters=${res.options.iters} T0=${res.options.T0}`);
  console.log(`restarts ${s.restarts}, distinct ${s.distinct}, best hit by ${s.bestHits} (${(100 * s.bestHitFraction).toFixed(1)}%), ${(s.timeMs.total / 1000).toFixed(1)} s`);
  for (const sol of res.solutions) {
    const acc = sol.accuracy != null ? ` acc=${(100 * sol.accuracy).toFixed(1)}%` : '';
    console.log(`#${sol.rank} score=${sol.score.toFixed(3)} hits=${sol.hits}${acc} words=${sol.wordLogp.toFixed(2)}  ${sol.plaintext.length <= 120 ? sol.plaintext : sol.plaintext.slice(0, 120) + '...'}`);
    console.log(`    ${sol.words.length <= 160 ? sol.words : sol.words.slice(0, 160) + '...'}`);
  }
  if (res.truthScore) console.log(`known plaintext scores ${res.truthScore.score.toFixed(3)} (consistent: ${res.truthScore.consistent})`);
  if (res.warnings.length) console.log('warnings: ' + res.warnings.join('; '));
  if (o.out) console.log(`wrote ${o.out}`);
}

module.exports = { solve, createPool, makeProblem, parseOrders, parseCribs, autoIters, autoT0, expectedEntropy, englishIoc, decodeKey, DEFAULTS, HELP };

if (require.main === module) {
  main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
}
