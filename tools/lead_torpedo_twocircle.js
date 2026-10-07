'use strict';
/**
 * tools/lead_torpedo_twocircle.js - the "two circle symbols" readings of Z13 for the `torpedo` task.
 *
 * Garlick's corrected reading DR EAT A TORPEDO needs circles 4 and 6 = T and circle 8 = R. Besides the
 * certified readings (one circle symbol; three different circle symbols) there are three ways to split
 * the circles into two symbols: P46 = {4,6}{8}, P48 = {4,8}{6}, P68 = {6,8}{4}. P46 is the partition that
 * DR EAT A TORPEDO requires (chosen after seeing the reading, so it is a post-hoc variant). Each has
 * 26^3 = 17,576 completions (two circle letters and the hook letter).
 *
 * For the real Z340 key and for null keys (same generators and seeds as tools/lead_torpedo_null.js) this
 * scores every completion with the fast unigram word score, rescores those with fast score >= -18.2
 * (at least the top 300) with lm.wordSegment, and records per partition the best completion, and the
 * best rank / score of a completion containing a bomb word of >= 7 letters, a bomb word of >= 5 letters,
 * or a narrow "striking" word (same definition as tools/lead_torpedo_summary.js).
 *
 *   node tools/lead_torpedo_twocircle.js --n 10000 --threads 4 --out results/lead/torpedo/twocircle.json
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const T = require('./lead_torpedo_core');
const K = require('./keyprior_lib');

const PARTS = { P46: [[4, 6], [8]], P48: [[4, 8], [6]], P68: [[6, 8], [4]] };
const NARROW = { bomb: 5, letter: 6, insult: 5, place: 5, case: 5, fullname: 3 };
const S_STRICT = -12.1784, S_LOOSE = -15.1442;

function stratifiedKey(m, rng) {
  const up = [...m.keys()].filter((s) => /^[A-Z]$/.test(s));
  const ot = [...m.keys()].filter((s) => !/^[A-Z]$/.test(s));
  const out = new Map();
  for (const cls of [up, ot]) {
    const lets = K.shuffle(cls.map((s) => m.get(s)), rng);
    cls.forEach((s, i) => out.set(s, lets[i]));
  }
  return out;
}

function worker() {
  const WF = require('./wordfast');
  const lm = require('./lm');
  const F = WF.build('common');
  const th = T.themes();
  const wantStr = workerData.wantStr;
  parentPort.on('message', (m) => {
    if (m.type === 'exit') process.exit(0);
    const res = [];
    for (const job of m.jobs) {
      const pins = Uint8Array.from(job.pins);
      const rec = { i: job.i, kind: job.kind, pins: T.pinString(pins), p: {} };
      for (const [pn, [g1, g2]] of Object.entries(PARTS)) {
        const codes = new Uint8Array(13);
        for (let q = 0; q < 13; q++) codes[q] = pins[q] === 255 ? 0 : pins[q];
        const all = [];
        for (let x = 0; x < 26; x++) for (let y = 0; y < 26; y++) for (let z = 0; z < 26; z++) {
          for (const q of g1) codes[q] = x;
          for (const q of g2) codes[q] = y;
          codes[9] = z;
          all.push({ str: T.codesToString(codes), wf: WF.logpCodes(F, codes, 13) });
        }
        all.sort((a, b) => b.wf - a.wf);
        let sel = all.filter((c) => c.wf >= -18.2);
        if (sel.length < 300) sel = all.slice(0, 300);
        for (const c of sel) { const ws = lm.wordSegment(c.str); c.word = ws.logp; c.words = ws.words; }
        sel.sort((a, b) => b.word - a.word);
        const best = { bomb7: [0, null], bomb5: [0, null], narrow: [0, null] };
        let target = null;
        sel.forEach((c, r) => {
          if (wantStr && c.str === wantStr) target = { rank: r + 1, word: c.word, words: c.words.join(' ') };
          for (const h of T.hitsOf(c.words, th)) {
            if (h.cat === 'bomb' && h.len >= 7 && !best.bomb7[0]) best.bomb7 = [r + 1, +c.word.toFixed(4), c.words.join(' ')];
            if (h.cat === 'bomb' && h.len >= 5 && !best.bomb5[0]) best.bomb5 = [r + 1, +c.word.toFixed(4), c.words.join(' ')];
            if (NARROW[h.cat] && h.len >= NARROW[h.cat] && !best.narrow[0]) best.narrow = [r + 1, +c.word.toFixed(4), c.words.join(' ')];
          }
        });
        rec.p[pn] = { n: all.length, rescored: sel.length, s1: +sel[0].word.toFixed(4), w1: sel[0].words.join(' '), nS: sel.filter((c) => c.word >= S_STRICT).length, nL: sel.filter((c) => c.word >= S_LOOSE).length, best, target,
          top: job.kind === 'real' ? sel.slice(0, 25).map((c, r) => `${r + 1} ${c.words.join(' ')} ${c.word.toFixed(3)}`) : undefined };
      }
      res.push(rec);
    }
    parentPort.postMessage({ type: 'done', res });
  });
  parentPort.postMessage({ type: 'ready' });
}

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const N = +(o.n || 10000);
  const threads = +(o.threads || 4);
  const km = K.key('z340');
  const jobs = [{ i: -1, kind: 'real', pins: Array.from(T.pinsFromKey(km)) }];
  for (const kind of ['permute', 'stratified']) {
    const rng = kind === 'permute' ? K.makeRng(1970, 1001) : K.makeRng(1971, 5001);
    for (let j = 0; j < N; j++) jobs.push({ i: j, kind, pins: Array.from(T.pinsFromKey(kind === 'permute' ? K.permuteKey(km, rng) : stratifiedKey(km, rng))) });
  }
  const t0 = Date.now();
  const results = [];
  await new Promise((resolve, reject) => {
    let next = 0, active = 0;
    const ws = [];
    const send = (w) => { if (next >= jobs.length) return false; const part = jobs.slice(next, next + 16); next += part.length; active++; w.postMessage({ type: 'jobs', jobs: part }); return true; };
    for (let t = 0; t < threads; t++) {
      const w = new Worker(__filename, { workerData: { wantStr: 'DREATATORPEDO' } });
      ws.push(w);
      w.on('error', reject);
      w.on('message', (m) => {
        if (m.type === 'ready') { send(w); return; }
        active--;
        results.push(...m.res);
        if (results.length % 800 < 16) process.stderr.write(`${results.length}/${jobs.length} ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
        if (!send(w) && active === 0) { ws.forEach((x) => x.postMessage({ type: 'exit' })); resolve(); }
      });
    }
  });
  const real = results.find((r) => r.kind === 'real');
  const out = { tool: 'tools/lead_torpedo_twocircle.js', created: new Date().toISOString(), N, real, stats: {} };
  const ev = (rec, what, crit) => { const b = rec.best[what]; if (!b[0]) return false; return crit.rank ? b[0] <= crit.rank : b[1] >= crit.score - 1e-4; };
  for (const kind of ['permute', 'stratified']) {
    const R = results.filter((r) => r.kind === kind);
    const st = {};
    for (const pn of Object.keys(PARTS)) {
      const rr = real.p[pn];
      const s = { real: { s1: rr.s1, w1: rr.w1, target: rr.target, best: rr.best } };
      const cnt = (f) => { const c = R.filter((r) => f(r.p[pn])).length; return { count: c, n: R.length, rate: +(c / R.length).toFixed(5), p: +((c + 1) / (R.length + 1)).toFixed(5) }; };
      s.fluency_bestGeReal = cnt((x) => x.s1 >= rr.s1 - 1e-9);
      if (rr.target) {
        const tr = rr.target.rank, tw = rr.target.word;
        s.bomb7_atRankLeTarget = cnt((x) => ev(x, 'bomb7', { rank: tr }));
        s.bomb7_atScoreGeTarget = cnt((x) => ev(x, 'bomb7', { score: tw }));
        s.narrow_atRankLeTarget = cnt((x) => ev(x, 'narrow', { rank: tr }));
        s.narrow_atScoreGeTarget = cnt((x) => ev(x, 'narrow', { score: tw }));
        s.anyCompletionGeTargetScore = cnt((x) => x.s1 >= tw - 1e-9);
      }
      s.bomb7_rank1 = cnt((x) => ev(x, 'bomb7', { rank: 1 }));
      s.bomb7_rank3 = cnt((x) => ev(x, 'bomb7', { rank: 3 }));
      s.narrow_rank1 = cnt((x) => ev(x, 'narrow', { rank: 1 }));
      s.narrow_rank3 = cnt((x) => ev(x, 'narrow', { rank: 3 }));
      st[pn] = s;
    }
    out.stats[kind] = st;
  }
  out.seconds = (Date.now() - t0) / 1000;
  K.writeJSON(o.out || 'results/lead/torpedo/twocircle.json', out);
  for (const pn of Object.keys(PARTS)) console.log(pn, 'real best', real.p[pn].w1, real.p[pn].s1, 'target', JSON.stringify(real.p[pn].target), 'bomb7', JSON.stringify(real.p[pn].best.bomb7), '\n  top:', (real.p[pn].top || []).slice(0, 12).join(' | '));
  console.log(JSON.stringify(out.stats, null, 1));
}

if (isMainThread) main().catch((e) => { console.error(e); process.exit(1); });
else worker();
