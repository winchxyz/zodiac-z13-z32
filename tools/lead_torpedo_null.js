'use strict';
/**
 * tools/lead_torpedo_null.js - step 3 and step 4 of the `torpedo` task: look-elsewhere with random keys.
 *
 * Null keys are the same as in results/keyprior/review/review_family.js for the Z340 key:
 *   permute:    K.permuteKey(z340 key, makeRng(1970, 1001)), j = 0..N-1  (the key's 63 letters shuffled
 *               over its 63 symbols);
 *   stratified: letters shuffled only within glyph classes (normal upper-case letter glyphs vs all other
 *               symbols), makeRng(1971, 5001).
 * For every null key, Z13's six shared symbols are pinned from that key and
 *   circles   (z13.circles_distinct): all 26^4 completions are scored with the fast unigram word score
 *             (tools/wordfast.js); every completion with fast score >= --wfcut (default -18.2) is rescored
 *             with lm.wordSegment (the exact bigram word model). Exact minus fast is at most 2.59 on all
 *             456,976 completions of the real Z340 key (2.04 for Z408), so with the default cut every
 *             completion with exact score >= -15.2 is captured (checked again by --validate);
 *   canonical (one circle symbol): all 676 completions scored exactly.
 * Per key it records the best completion, the number of completions at least as fluent as
 * DREAM A TORPEDO (-12.178) and DR EAT A TORPEDO (-15.144), and for every theme category and minimum
 * word length the best rank and score of a completion whose segmentation contains such a word.
 *
 *   node tools/lead_torpedo_null.js --n 10000 --kinds permute,stratified --threads 4 --out results/lead/torpedo/null.jsonl
 *   node tools/lead_torpedo_null.js --validate 12 --threads 4 --out results/lead/torpedo/validate.json
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const T = require('./lead_torpedo_core');
const K = require('./keyprior_lib');

const S_STRICT = -12.1784;   // DREAM A TORPEDO, exact lm.wordSegment logp (real.json)
const S_LOOSE = -15.1442;    // DR EAT A TORPEDO

function stratifiedKey(m, rng) {
  // identical to results/keyprior/review/review_family.js
  const up = [...m.keys()].filter((s) => /^[A-Z]$/.test(s));
  const ot = [...m.keys()].filter((s) => !/^[A-Z]$/.test(s));
  const out = new Map();
  for (const cls of [up, ot]) {
    const lets = K.shuffle(cls.map((s) => m.get(s)), rng);
    cls.forEach((s, i) => out.set(s, lets[i]));
  }
  return out;
}

function catSummary(cands, th) {
  const cat = {};
  const ex = {};
  for (const c of T.CATS) { cat[c] = {}; for (const L of T.MINLENS) cat[c][L] = [0, null]; }
  for (let r = 0; r < cands.length; r++) {
    const c = cands[r];
    const hits = T.hitsOf(c.words, th);
    for (const h of hits) {
      for (const L of T.MINLENS) if (h.len >= L && cat[h.cat][L][0] === 0) cat[h.cat][L] = [r + 1, +c.word.toFixed(4)];
      const k = h.cat + (h.len >= 7 ? '7' : h.len >= 5 ? '5' : h.len >= 4 ? '4' : '3');
      if (!ex[k] && r < 1000) ex[k] = [r + 1, +c.word.toFixed(3), c.words.join(' ')];
    }
  }
  return { cat, ex };
}

function workerMain() {
  const WF = require('./wordfast');
  const lm = require('./lm');
  const F = WF.build('common');
  const th = T.themes();
  const wfcut = workerData.wfcut;
  const minKeep = 300;
  const cap = 80000;
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    const out = [];
    for (const job of m.jobs) {
      const pins = Uint8Array.from(job.pins);
      const rec = { i: job.i, kind: job.kind, pins: T.pinString(pins) };
      // ---- circles
      const codes = new Uint8Array(13);
      for (let i = 0; i < 13; i++) codes[i] = pins[i] === 255 ? 0 : pins[i];
      const keepIdx = [];
      const keepWf = [];
      // also a small top list in case fewer than minKeep pass the cut
      const topIdx = new Int32Array(minKeep).fill(-1), topWf = new Float64Array(minKeep).fill(-Infinity);
      let wfBest = -Infinity;
      for (let a = 0; a < 26; a++) { codes[4] = a; for (let b = 0; b < 26; b++) { codes[6] = b; for (let c = 0; c < 26; c++) { codes[8] = c; for (let d = 0; d < 26; d++) {
        codes[9] = d;
        const v = WF.logpCodes(F, codes, 13);
        const idx = ((a * 26 + b) * 26 + c) * 26 + d;
        if (v > wfBest) wfBest = v;
        if (v >= wfcut) { keepIdx.push(idx); keepWf.push(v); }
        else if (v > topWf[minKeep - 1]) {
          // insertion into the small sorted top list
          let k = minKeep - 1;
          while (k > 0 && topWf[k - 1] < v) { topWf[k] = topWf[k - 1]; topIdx[k] = topIdx[k - 1]; k--; }
          topWf[k] = v; topIdx[k] = idx;
        }
      } } } }
      let sel = keepIdx.map((idx, k) => ({ idx, wf: keepWf[k] }));
      if (sel.length < minKeep) for (let k = 0; k < minKeep && sel.length < minKeep; k++) if (topIdx[k] >= 0) sel.push({ idx: topIdx[k], wf: topWf[k] });
      let capped = false;
      if (sel.length > cap) { sel.sort((x, y) => y.wf - x.wf); sel = sel.slice(0, cap); capped = true; }
      const cands = sel.map((s) => {
        const str = T.circlesString(pins, s.idx);
        const ws = lm.wordSegment(str);
        return { str, wf: s.wf, word: ws.logp, words: ws.words };
      });
      cands.sort((x, y) => y.word - x.word);
      let nS = 0, nL = 0, maxGap = -Infinity;
      for (const c of cands) { if (c.word >= S_STRICT) nS++; if (c.word >= S_LOOSE) nL++; if (c.word - c.wf > maxGap) maxGap = c.word - c.wf; }
      const cs = catSummary(cands, th);
      rec.c = { n: cands.length, capped, wfBest: +wfBest.toFixed(4), s1: +cands[0].word.toFixed(4), w1: cands[0].words.join(' '), s2: cands[1] ? +cands[1].word.toFixed(4) : null, s3: cands[2] ? +cands[2].word.toFixed(4) : null, nS, nL, maxGap: +maxGap.toFixed(3), cat: cs.cat, ex: cs.ex };
      if (job.validate) {
        // full exact scoring: every completion with exact >= -15.2 must be among the rescored ones
        const kept = new Set(cands.map((c) => c.str));
        let missed = 0, nAbove = 0, bestAll = -Infinity, bestStr = '';
        for (let a = 0; a < 26; a++) for (let b = 0; b < 26; b++) for (let c = 0; c < 26; c++) for (let d = 0; d < 26; d++) {
          const str = T.circlesString(pins, ((a * 26 + b) * 26 + c) * 26 + d);
          const s = lm.wordSegment(str).logp;
          if (s > bestAll) { bestAll = s; bestStr = str; }
          if (s >= -15.2) { nAbove++; if (!kept.has(str)) missed++; }
        }
        rec.validate = { nAboveMinus15_2: nAbove, missed, bestAll: +bestAll.toFixed(4), bestStr, prefilterBest: rec.c.s1 };
      }
      // ---- canonical: 676 completions, exact
      const can = [];
      let cwfBest = -Infinity;
      for (let x = 0; x < 26; x++) for (let y = 0; y < 26; y++) {
        const str = T.canonicalString(pins, x, y);
        const ws = lm.wordSegment(str);
        const wf = WF.logp(F, str);
        if (wf > cwfBest) cwfBest = wf;
        can.push({ str, word: ws.logp, words: ws.words });
      }
      can.sort((x, y) => y.word - x.word);
      const ks = catSummary(can, th);
      rec.k = { wfBest: +cwfBest.toFixed(4), s1: +can[0].word.toFixed(4), w1: can[0].words.join(' '), s2: +can[1].word.toFixed(4), cat: ks.cat, ex: ks.ex };
      out.push(rec);
    }
    parentPort.postMessage({ type: 'done', out });
  });
  parentPort.postMessage({ type: 'ready' });
}

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const threads = +(o.threads || 4);
  const wfcut = o.wfcut != null ? +o.wfcut : -18.2;
  const km = K.key('z340');
  const jobs = [];
  if (o.validate && o['validate-from']) {
    // validate the prefilter on the most fluent null keys of a finished run (largest nL, then capped ones)
    const rows = fs.readFileSync(path.join(T.ROOT, o['validate-from']), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.kind !== 'real');
    rows.sort((a, b) => (b.c.capped - a.c.capped) || (b.c.nL - a.c.nL));
    for (const r of rows.slice(0, +o.validate)) {
      const pins = Array.from(r.pins, (ch) => (ch === '?' ? 255 : ch.charCodeAt(0) - 65));
      jobs.push({ i: r.i, kind: r.kind, pins, validate: true });
    }
    o.validate = true;
  } else if (o.validate) {
    const nv = +o.validate;
    const rng = K.makeRng(1970, 1001);
    for (let j = 0; j < nv; j++) jobs.push({ i: j, kind: 'permute', pins: Array.from(T.pinsFromKey(K.permuteKey(km, rng))), validate: true });
    jobs.push({ i: -1, kind: 'real', pins: Array.from(T.pinsFromKey(km)), validate: true });
  } else {
    const N = +(o.n || 10000);
    const kinds = String(o.kinds || 'permute,stratified').split(',');
    const start = +(o.start || 0);
    for (const kind of kinds) {
      const rng = kind === 'permute' ? K.makeRng(1970, 1001) : K.makeRng(1971, 5001);
      for (let j = 0; j < start + N; j++) {
        const m = kind === 'permute' ? K.permuteKey(km, rng) : stratifiedKey(km, rng);
        if (j >= start) jobs.push({ i: j, kind, pins: Array.from(T.pinsFromKey(m)) });
      }
    }
    jobs.push({ i: -1, kind: 'real', pins: Array.from(T.pinsFromKey(km)) });
  }
  const outPath = path.isAbsolute(o.out) ? o.out : path.join(T.ROOT, o.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const t0 = Date.now();
  const results = [];
  const fd = o.validate ? null : fs.openSync(outPath, 'w');
  await new Promise((resolve, reject) => {
    const workers = [];
    let next = 0, active = 0, done = 0;
    const chunk = o.validate ? 1 : 8;
    const send = (w) => { if (next >= jobs.length) return false; const part = jobs.slice(next, next + chunk); next += part.length; active++; w.postMessage({ type: 'jobs', jobs: part }); return true; };
    for (let t = 0; t < threads; t++) {
      const w = new Worker(__filename, { workerData: { wfcut } });
      workers.push(w);
      w.on('error', reject);
      w.on('message', (m) => {
        if (m.type === 'ready') { send(w); return; }
        active--;
        for (const r of m.out) { if (fd !== null) fs.writeSync(fd, JSON.stringify(r) + '\n'); else results.push(r); done++; }
        if (done % 200 < chunk) process.stderr.write(`${done}/${jobs.length} ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
        if (!send(w) && active === 0) { workers.forEach((x) => x.postMessage({ type: 'exit' })); resolve(); }
      });
    }
  });
  if (fd !== null) fs.closeSync(fd);
  else K.writeJSON(outPath, { tool: 'tools/lead_torpedo_null.js --validate', created: new Date().toISOString(), wfcut, results: results.map((r) => ({ i: r.i, kind: r.kind, pins: r.pins, n: r.c.n, maxGap: r.c.maxGap, validate: r.validate })) });
  process.stderr.write(`done ${jobs.length} keys in ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  if (o.validate) for (const r of results) console.log(r.i, r.pins, JSON.stringify(r.validate), 'rescored', r.c.n, 'maxGap', r.c.maxGap);
}

if (isMainThread) main().catch((e) => { console.error(e); process.exit(1); });
else workerMain();
