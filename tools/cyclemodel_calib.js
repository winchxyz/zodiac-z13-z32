'use strict';
/**
 * tools/cyclemodel_calib.js - (1) Z32 candidates from many anneal runs with and
 * without the isomorph-likelihood term; (2) calibration on synthetic ciphers made
 * WITH the fitted homophone-selection model: does adding log10 L(P) to the language
 * model raise the rank of the true plaintext?
 *
 *   node tools/run_slot.js --label cyclemodel-calib -- node tools/cyclemodel_calib.js --parts real32,c13,c32 \
 *        [--n13 16] [--n13simple 6] [--n32 14] [--enum-seconds 35] [--restarts32 40] [--real-restarts 300] [--seed 1970]
 *
 * c13: held-out 13-letter phrases (tools/textsample.js), key size S and regime drawn
 *   from the model's default prior, enciphered with the model; kept only if the cipher
 *   has <= 10 distinct symbols (Z13 has 8; otherwise exhaustive enumeration is
 *   infeasible).  Competitors = enumerate.js words --mode homophonic (top 10,000 words,
 *   <= 4 words, time-limited) with wordSegment log10 P >= the truth's lm + logL.  Rank of
 *   the truth by lm alone vs lm + logL among the same list.  A second set uses simple
 *   substitution (model mismatch check).
 * c32: held-out 32-letter phrases, rows 17 + 15, model-enciphered, kept if 27..31 distinct
 *   symbols (Z32 has 29).  Solved twice with tools/cyclemodel_anneal.js (cycweight 0 = plain
 *   objective, 1 = with log10 L); top-solution accuracy, exact recoveries, number of
 *   returned solutions scoring above the truth under each objective, score gap.
 * real32: Z32 canonical and triangles_merged, cycweight 0 and 1, many restarts; all
 *   distinct solutions written for re-scoring with tools/cyclemodel_score.js.
 * All threads: 4.  Writes results/cyclemodel/calib*.json and calib/ working files.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');
const M = require('./cyclemodel_lib');
const TS = require('./textsample');
const lm = require('./lm');
const CA = require('./cyclemodel_anneal');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const PARTS = opt('parts', 'real32,c13,c32').split(',');
const N13 = +opt('n13', 16), N13S = +opt('n13simple', 6), N32 = +opt('n32', 14);
const ENUM_TOP = opt('enum-top-words', '10000');
const ENUM_SEC = +opt('enum-seconds', 35), R32 = +opt('restarts32', 40), RREAL = +opt('real-restarts', 300);
const SEED = +opt('seed', 1970);
const ITERS32 = +opt('iters32', 50000); // annealing proposals per restart for 32-letter ciphers (both objectives)
const DIR = path.resolve(ROOT, opt('workdir', 'results/cyclemodel/calib'));
const OUTDIR = path.resolve(ROOT, opt('outdir', 'results/cyclemodel'));
fs.mkdirSync(DIR, { recursive: true });
const SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MODELF = opt('model', 'results/cyclemodel/fit.json');
const TH = +opt('threads', 4);
const model = M.loadModel(MODELF);
const hyp = model.defaultHyp;
const rng = M.mulberry32(SEED);

function symString(sym) {
  const m = new Map();
  let s = '';
  for (const x of sym) { if (!m.has(x)) m.set(x, SAFE[m.size]); s += m.get(x); }
  return s;
}

function drawComp() {
  const S = hyp.S[Math.floor(rng() * hyp.S.length)];
  const reg = hyp.regimes[Math.floor(rng() * hyp.regimes.length)];
  return { S, reg, theta: model.regimes[reg].theta };
}

function log(msg) { console.log(msg); fs.mkdirSync(OUTDIR, { recursive: true }); fs.appendFileSync(path.join(OUTDIR, 'calib.log'), msg + '\n'); }

async function readTsv(file, cb) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) { if (first) { first = false; continue; } if (line) { const f = line.split('\t'); cb(f[0], +f[1]); } }
}

/* -------------------------------------------------------------- c13 */
async function c13(simple, n, tag) {
  const sampler = TS.sampler(SEED + (simple ? 7 : 3));
  const rows = new Array(13).fill(0);
  const out = [];
  let tried = 0;
  while (out.length < n && tried < 20000) {
    tried++;
    const ph = sampler.phrase(13);
    const comp = simple ? { S: 0, reg: 'simple' } : drawComp();
    const ks = M.drawKeySizes(model, comp.S, rng, simple);
    const sym = M.encrypt(ph.letters, rows, ks, comp.theta || model.regimes.z408p12.theta, rng);
    const distinct = new Set(sym).size;
    if (distinct > 10) continue;
    const ctext = symString(sym);
    const file = path.join(DIR, `c13${tag}_${out.length}.txt`);
    fs.writeFileSync(file, ctext + '\n');
    const sc = M.makeScorer(model, { iso: M.isoOf(ctext), rows, hyp });
    const truthLM = lm.wordSegment(ph.letters, { vocab: 'common' }).logp;
    const truthL = sc.logL(ph.letters);
    const minLogp = truthLM + Math.min(0, truthL) - 0.01;
    const tsv = path.join(DIR, `c13${tag}_${out.length}.tsv`);
    const js = path.join(DIR, `c13${tag}_${out.length}.json`);
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ['tools/enumerate.js', 'words', '--cipher', path.relative(ROOT, file), '--mode', 'homophonic', '--top-words', ENUM_TOP, '--max-words', '4',
      '--threads', String(TH), '--max-seconds', String(ENUM_SEC), '--min-logp', minLogp.toFixed(3), '--top', '5', '--stream', path.relative(ROOT, tsv), '--out', path.relative(ROOT, js)], { cwd: ROOT, encoding: 'utf8' });
    let complete = null, consistent = null;
    try { const j = JSON.parse(fs.readFileSync(js, 'utf8')); complete = j.counts.complete; consistent = j.counts.consistentStrings; } catch (e) { log('enumerate failed: ' + (r.stderr || '').slice(0, 300)); continue; }
    let aboveLM = 0, tieLM = 0, abovePost = 0, tiePost = 0, listed = 0, truthListed = false;
    const truthPost = truthLM + truthL;
    await readTsv(tsv, (p, w) => {
      if (p === ph.letters) { truthListed = true; return; }
      listed++;
      if (w > truthLM + 1e-9) aboveLM++; else if (Math.abs(w - truthLM) <= 1e-9) tieLM++;
      const L = sc.logL(p);
      const post = w + L;
      if (post > truthPost + 1e-9) abovePost++; else if (Math.abs(post - truthPost) <= 1e-9) tiePost++;
    });
    fs.unlinkSync(tsv);
    const rec = {
      i: out.length, S: comp.S, regime: comp.reg, distinct, cipher: ctext, truthLM: +truthLM.toFixed(3), truthLogL: +truthL.toFixed(3),
      rankLM: 1 + aboveLM + tieLM / 2, rankPost: 1 + abovePost + tiePost / 2, listedAboveThreshold: listed, truthListed, enumerateComplete: complete, consistentStrings: consistent,
      seconds: (Date.now() - t0) / 1000,
    };
    out.push(rec);
    log(`c13${tag} #${rec.i} S=${rec.S} ${rec.regime} distinct ${distinct}: rank LM ${rec.rankLM} -> LM+L ${rec.rankPost} (logL truth ${rec.truthLogL}; complete ${complete}; listed ${truthListed})`);
  }
  return { tried, accepted: out.length, rows: out, summary: summarize13(out) };
}

function summarize13(rows) {
  if (!rows.length) return null;
  const lr = rows.map((r) => Math.log10(r.rankPost) - Math.log10(r.rankLM));
  const mean = lr.reduce((a, b) => a + b, 0) / lr.length;
  const sd = Math.sqrt(lr.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lr.length - 1));
  const hit = (k, key) => rows.filter((r) => r[key] <= k).length;
  const sorted = lr.slice().sort((a, b) => a - b);
  return {
    n: rows.length, meanLog10RankChange: +mean.toFixed(3), sdLog10RankChange: +sd.toFixed(3), seMean: +(sd / Math.sqrt(lr.length)).toFixed(3),
    medianLog10RankChange: +sorted[Math.floor(sorted.length / 2)].toFixed(3),
    improved: lr.filter((x) => x < 0).length, worse: lr.filter((x) => x > 0).length, same: lr.filter((x) => x === 0).length,
    top1: { lm: hit(1, 'rankLM'), post: hit(1, 'rankPost') }, top10: { lm: hit(10, 'rankLM'), post: hit(10, 'rankPost') },
    top100: { lm: hit(100, 'rankLM'), post: hit(100, 'rankPost') }, top1000: { lm: hit(1000, 'rankLM'), post: hit(1000, 'rankPost') },
    medianRankLM: rows.map((r) => r.rankLM).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
    medianRankPost: rows.map((r) => r.rankPost).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
  };
}

/* -------------------------------------------------------------- c32 */
async function c32(pools) {
  const sampler = TS.sampler(SEED + 11);
  const rows = M.rowsFor([17, 15]);
  const out = [];
  let tried = 0;
  while (out.length < N32 && tried < 20000) {
    tried++;
    const ph = sampler.phrase(32);
    const comp = drawComp();
    const ks = M.drawKeySizes(model, comp.S, rng, false);
    const sym = M.encrypt(ph.letters, rows, ks, comp.theta, rng);
    const distinct = new Set(sym).size;
    if (distinct < 27 || distinct > 31) continue;
    const ctext = symString(sym);
    const file = path.join(DIR, `c32_${out.length}.json`);
    fs.writeFileSync(file, JSON.stringify({ id: `synthetic32_${out.length}`, ascii: ctext, plaintext: ph.letters }));
    const rec = { i: out.length, S: comp.S, regime: comp.reg, distinct, cipher: ctext };
    for (const w of [0, 1]) {
      const o = { cipher: path.relative(ROOT, file), mode: 'homophonic', restarts: R32, iters: ITERS32, wordweight: 1, top: 50, threads: TH, model: MODELF, seed: SEED + out.length, rows: '17,15', cycweight: w, quiet: true };
      const t0 = Date.now();
      const res = await CA.solveCyc(o, pools[w]);
      const truthObj = res.truthScore.score + (w ? res.truthLogL : 0);
      const sols = res.solutions;
      const acc = sols.length ? [...sols[0].plaintext].filter((c, k) => c === ph.letters[k]).length / 32 : 0;
      rec['w' + w] = {
        topAccuracy: +acc.toFixed(3), recovered: sols.length > 0 && sols[0].plaintext === ph.letters, truthInReturned: sols.some((s) => s.plaintext === ph.letters),
        returnedAboveTruth: sols.filter((s) => s.score > truthObj + 1e-9).length, gapBestMinusTruth: sols.length ? +(sols[0].score - truthObj).toFixed(3) : null,
        truthLogL: +res.truthLogL.toFixed(3), topLogL: sols.length ? +sols[0].logL.toFixed(3) : null, topWordLogp: sols.length ? +sols[0].wordLogp.toFixed(3) : null,
        truthWordLogp: +lm.wordSegment(ph.letters, { vocab: 'common' }).logp.toFixed(3), seconds: (Date.now() - t0) / 1000,
      };
    }
    out.push(rec);
    log(`c32 #${rec.i} S=${rec.S} ${rec.regime} distinct ${distinct}: acc ${rec.w0.topAccuracy} -> ${rec.w1.topAccuracy}; above truth ${rec.w0.returnedAboveTruth} -> ${rec.w1.returnedAboveTruth}; gap ${rec.w0.gapBestMinusTruth} -> ${rec.w1.gapBestMinusTruth}; truth logL ${rec.w1.truthLogL} top logL ${rec.w1.topLogL}`);
  }
  const s = (w, f) => out.map((r) => r['w' + w][f]);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  return {
    tried, accepted: out.length, rows: out,
    summary: {
      n: out.length,
      meanTopAccuracy: { w0: +mean(s(0, 'topAccuracy')).toFixed(3), w1: +mean(s(1, 'topAccuracy')).toFixed(3) },
      recovered: { w0: s(0, 'recovered').filter(Boolean).length, w1: s(1, 'recovered').filter(Boolean).length },
      truthInReturned: { w0: s(0, 'truthInReturned').filter(Boolean).length, w1: s(1, 'truthInReturned').filter(Boolean).length },
      allReturnedAboveTruth50: { w0: s(0, 'returnedAboveTruth').filter((x) => x >= 50).length, w1: s(1, 'returnedAboveTruth').filter((x) => x >= 50).length },
      meanGap: { w0: +mean(s(0, 'gapBestMinusTruth')).toFixed(3), w1: +mean(s(1, 'gapBestMinusTruth')).toFixed(3) },
      meanTruthLogLminusTopLogL_w1: +mean(out.map((r) => r.w1.truthLogL - r.w1.topLogL)).toFixed(3),
    },
  };
}

/* ----------------------------------------------------------- real32 */
async function real32(pools) {
  const res = {};
  for (const v of ['z32.canonical', 'z32.triangles_merged']) {
    for (const w of [0, 1]) {
      const o = { cipher: `data/ciphers/variants/${v}.txt`, mode: 'homophonic', restarts: RREAL, iters: ITERS32, perRestart: 3, wordweight: 1, top: 400, threads: TH, model: MODELF, seed: SEED, rows: '17,15', cycweight: w, quiet: true };
      const t0 = Date.now();
      const r = await CA.solveCyc(o, pools[w]);
      const f = path.join(OUTDIR, `anneal_${v.replace('.', '_')}_w${w}.json`);
      fs.writeFileSync(f, JSON.stringify(r, null, 1));
      res[`${v}_w${w}`] = { file: path.relative(ROOT, f), distinct: r.summary.distinct, seconds: (Date.now() - t0) / 1000, best: r.solutions.slice(0, 5).map((s) => ({ words: s.words, wordLogp: +s.wordLogp.toFixed(2), logL: +s.logL.toFixed(2), hits: s.hits })) };
      log(`real32 ${v} cycweight ${w}: ${r.summary.distinct} distinct in ${res[`${v}_w${w}`].seconds.toFixed(0)} s; best: ${r.solutions.slice(0, 3).map((s) => `${s.words} [${s.wordLogp.toFixed(1)}, L ${s.logL.toFixed(1)}]`).join(' | ')}`);
    }
  }
  return res;
}

async function main() {
  const t0 = Date.now();
  const res = { tool: 'tools/cyclemodel_calib.js', created: new Date().toISOString(), command: 'node tools/cyclemodel_calib.js ' + argv.join(' '), model: MODELF, hyp };
  let pools = null;
  if (PARTS.includes('real32') || PARTS.includes('c32')) {
    const cyc = (w) => ({ modelFile: MODELF, hyp, rowsLengths: [17, 15], weight: w });
    pools = [new CA.CycPool({ threads: TH, orders: [5], cyc: cyc(0) }), new CA.CycPool({ threads: TH, orders: [5], cyc: cyc(1) })];
  }
  const outFile = (p) => path.join(OUTDIR, `calib_${p}.json`);
  if (PARTS.includes('real32')) { res.real32 = await real32(pools); fs.writeFileSync(outFile('real32'), JSON.stringify(res.real32, null, 1)); }
  if (PARTS.includes('c13')) {
    res.c13 = await c13(false, N13, '');
    log('c13 summary ' + JSON.stringify(res.c13.summary));
    fs.writeFileSync(outFile('c13'), JSON.stringify(Object.assign({ command: res.command }, res.c13), null, 1));
    res.c13simple = await c13(true, N13S, 's');
    log('c13 simple-substitution summary ' + JSON.stringify(res.c13simple.summary));
    fs.writeFileSync(outFile('c13simple'), JSON.stringify(Object.assign({ command: res.command }, res.c13simple), null, 1));
  }
  if (PARTS.includes('c32')) {
    res.c32 = await c32(pools);
    log('c32 summary ' + JSON.stringify(res.c32.summary));
    fs.writeFileSync(outFile('c32'), JSON.stringify(Object.assign({ command: res.command }, res.c32), null, 1));
  }
  if (pools) pools.forEach((p) => p.close());
  res.seconds = (Date.now() - t0) / 1000;
  log(`calib done in ${res.seconds.toFixed(0)} s`);
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
