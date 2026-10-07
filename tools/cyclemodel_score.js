'use strict';
/**
 * tools/cyclemodel_score.js - re-rank candidate plaintexts of a cipher by
 * posterior = language model x isomorph likelihood L(P) of the homophone-selection model.
 *
 *   node tools/cyclemodel_score.js --cipher data/ciphers/variants/z13.canonical.txt \
 *        --in results/cyclemodel/enum_z13_canonical_homo.tsv [--in more.tsv|.json ...] \
 *        [--rows 17,15] [--track 4,9] [--top 40] [--model results/cyclemodel/fit.json] --out results/cyclemodel/x.json
 *
 * Inputs: enumerate.js words TSV (plaintext, wordLogp, ...), enumerate.js names TSV
 * (plaintext, weight; LM = log10 weight), or anneal JSON (solutions[].plaintext, wordLogp).
 * Candidates are de-duplicated (first LM value kept).  Plaintexts with '?' are skipped.
 *
 * For every candidate:  lm (log10), logL (mixture over key size x regime, homophonic),
 *   logL per regime, logLsimple (0 if the fit is 1:1, else -inf),
 *   post = lm + logL, postComb = lm + log10(0.5 L + 0.5 Lsimple).
 * Output: counts, top lists under lm / post / postComb with ranks under the other
 * orderings, posterior over the plaintext letter at --track positions, posterior
 * concentration (share of the top 1 / 10 / 100, effective number of candidates).
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const M = require('./cyclemodel_lib');
const C = require('./cipher');

const argv = process.argv.slice(2);
const ins = [];
const o = {};
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  const v = argv[++i];
  if (k === 'in') ins.push(v); else o[k] = v;
}

async function readCandidates(file, add) {
  if (file.endsWith('.json')) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const s of j.solutions || []) add(s.plaintext, s.wordLogp, s.words || '');
    return;
  }
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!header) { header = line.split('\t'); continue; }
    if (!line) continue;
    const f = line.split('\t');
    if (header[1] === 'wordLogp') add(f[0], +f[1], f[2] || '');
    else if (header[1] === 'weight') add(f[0], Math.log10(+f[1]), f[3] || '');
    else add(f[0], NaN, '');
  }
}

function logsumexp10(arr) {
  let mx = -Infinity;
  for (const x of arr) if (x > mx) mx = x;
  if (mx === -Infinity) return -Infinity;
  let s = 0;
  for (const x of arr) s += Math.pow(10, x - mx);
  return mx + Math.log10(s);
}

async function main() {
  const t0 = Date.now();
  const model = M.loadModel(o.model);
  const ci = C.loadCipher(o.cipher);
  const text = ci.text;
  const iso = M.isoOf(text);
  const rows = o.rows ? M.rowsFor(o.rows.split(',').map(Number)) : new Array(text.length).fill(0);
  if (rows.length !== text.length) throw new Error('rows do not add up to the cipher length');
  const hyp = model.defaultHyp;
  const sc = M.makeScorer(model, { iso, rows, hyp });
  const perReg = Object.fromEntries(hyp.regimes.map((r) => [r, M.makeScorer(model, { iso, rows, hyp: { kind: 'homophonic', S: hyp.S, regimes: [r] } })]));
  const zs = M.makeScorer(model, { iso, rows, hyp: { kind: 'homophonic', S: [54, 63], regimes: hyp.regimes } });
  const smallS = hyp.S.filter((x) => x <= 45);
  const ss = M.makeScorer(model, { iso, rows, hyp: { kind: 'homophonic', S: smallS, regimes: hyp.regimes } });
  const sm = M.makeScorer(model, { iso, rows, hyp: { kind: 'simple' } });
  const track = o.track ? o.track.split(',').map(Number) : [];
  const TOP = +(o.top || 40);

  const seen = new Set();
  let cand = []; // {p, lm, words}
  let skipped = 0, inconsistent = 0, read = 0, belowWindow = 0;
  // candidates more than WINDOW log10 units below the best LM are dropped: logL is <= 0 and
  // above about -10 for the top candidates, so they can neither reach the top lists nor
  // change the evidence sums by more than ~N * 10^-WINDOW relative
  const WINDOW = +(o.window || 12);
  let maxLM = -Infinity;
  const add = (p, lm, words) => {
    read++;
    if (!p || p.length !== text.length || !/^[A-Z]+$/.test(p)) { skipped++; return; }
    if (Number.isFinite(lm) && lm < maxLM - WINDOW) { belowWindow++; return; }
    if (seen.has(p)) return;
    seen.add(p);
    if (lm > maxLM) maxLM = lm;
    cand.push({ p, lm, words });
  };
  for (const f of ins) await readCandidates(f, add);
  const before = cand.length;
  cand = cand.filter((c) => !(c.lm < maxLM - WINDOW));
  belowWindow += before - cand.length;
  const n = cand.length;
  const LM = new Float64Array(n), LL = new Float64Array(n), LS = new Float64Array(n), LZ = new Float64Array(n), LSM = new Float64Array(n);
  let approxCount = 0;
  const LR = Object.fromEntries(hyp.regimes.map((r) => [r, new Float64Array(n)]));
  for (let i = 0; i < n; i++) {
    const c = cand[i];
    LM[i] = c.lm;
    LL[i] = sc.logL(c.p);
    if (LL[i] === -Infinity) inconsistent++;
    LS[i] = sm.logL(c.p);
    LZ[i] = zs.logL(c.p);
    LSM[i] = ss.logL(c.p);
    if (sc.approx(c.p)) approxCount++;
    for (const r of hyp.regimes) LR[r][i] = perReg[r].logL(c.p);
  }
  const POST = new Float64Array(n), COMB = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    POST[i] = LM[i] + LL[i];
    const a = LL[i] + Math.log10(0.5), b = LS[i] === 0 ? Math.log10(0.5) : -Infinity;
    COMB[i] = LM[i] + logsumexp10([a, b]);
  }
  const order = (arr) => Array.from({ length: n }, (_, i) => i).sort((x, y) => arr[y] - arr[x]);
  const rankOf = (ord) => { const r = new Int32Array(n); ord.forEach((i, k) => { r[i] = k + 1; }); return r; };
  const oLM = order(LM), oPOST = order(POST), oCOMB = order(COMB);
  const rLM = rankOf(oLM), rPOST = rankOf(oPOST), rCOMB = rankOf(oCOMB);
  const row = (i) => ({
    plaintext: cand[i].p, words: cand[i].words, lm: +LM[i].toFixed(3), logL: +LL[i].toFixed(3), logLzodiacSize: +LZ[i].toFixed(3),
    logLperRegime: Object.fromEntries(hyp.regimes.map((r) => [r, +LR[r][i].toFixed(3)])), simpleFit: LS[i] === 0,
    post: +POST[i].toFixed(3), postComb: +COMB[i].toFixed(3), rankLM: rLM[i], rankPost: rPOST[i], rankComb: rCOMB[i],
  });
  // posterior concentration
  const conc = (ord, arr) => {
    const z = logsumexp10(Array.from(arr));
    const p = ord.slice(0, Math.min(n, 100000)).map((i) => Math.pow(10, arr[i] - z));
    const share = (k) => p.slice(0, k).reduce((a, b) => a + b, 0);
    let s2 = 0;
    for (let i = 0; i < n; i++) { const q = Math.pow(10, arr[i] - z); s2 += q * q; }
    return { top1: +share(1).toFixed(4), top10: +share(10).toFixed(4), top100: +share(100).toFixed(4), effectiveN: +(1 / s2).toFixed(1) };
  };
  const trackPost = (arr) => track.map((pos) => {
    const z = logsumexp10(Array.from(arr));
    const acc = new Float64Array(26);
    for (let i = 0; i < n; i++) acc[cand[i].p.charCodeAt(pos) - 65] += Math.pow(10, arr[i] - z);
    return { position: pos, symbol: text[pos], letters: Object.fromEntries([...acc].map((x, l) => [M.LETTERS[l], +x.toFixed(4)]).filter(([, x]) => x >= 0.005).sort((a, b) => b[1] - a[1])) };
  });
  // Spearman-like summary: how far the LM top-K move
  const moveStats = (k) => {
    const ids = oLM.slice(0, k);
    const lr = ids.map((i) => Math.log10(rPOST[i] / rLM[i]));
    return { k, meanLog10RankChange: +(lr.reduce((a, b) => a + b, 0) / k).toFixed(3), stillInTopK: ids.filter((i) => rPOST[i] <= k).length };
  };
  // evidence of each key model under the candidate list as prior (sum over candidates of 10^lm * L)
  const ev = (arr) => logsumexp10(Array.from(LM, (x, i) => x + arr[i]));
  const evidence = {
    note: 'log10 sum over the listed candidates of 10^lm * L_H(P); comparable between hypotheses on the same list (same normalisation)',
    simple: ev(LS), homophonicSmallS: ev(LSM), homophonicZodiacSize: ev(LZ), homophonicMixture: ev(LL),
    perRegime: Object.fromEntries(hyp.regimes.map((r) => [r, ev(LR[r])])),
    lmOnly: logsumexp10(Array.from(LM)),
  };
  const res = {
    tool: 'tools/cyclemodel_score.js', created: new Date().toISOString(), command: 'node tools/cyclemodel_score.js ' + argv.join(' '),
    cipher: { source: o.cipher, text, isomorph: C.isomorph(text), rows: o.rows || String(text.length) },
    inputs: ins, model: o.model || 'results/cyclemodel/fit.json', hyp,
    counts: { read, droppedBelowLmWindow: belowWindow, lmWindow: WINDOW, maxLM, candidates: n, skipped, inconsistentWithIsomorph: inconsistent, simpleFits: Array.from(LS).filter((x) => x === 0).length, approximatedPatterns: approxCount },
    evidence,
    concentration: { lm: conc(oLM, LM), post: conc(oPOST, POST), postComb: conc(oCOMB, COMB) },
    lmTopMoves: [10, 100, 1000].filter((k) => k <= n).map(moveStats),
    letterPosterior: { lm: trackPost(LM), post: trackPost(POST), postComb: trackPost(COMB) },
    topLM: oLM.slice(0, TOP).map(row), topPost: oPOST.slice(0, TOP).map(row), topComb: oCOMB.slice(0, TOP).map(row),
    seconds: (Date.now() - t0) / 1000,
  };
  const out = o.out || 'results/cyclemodel/score.json';
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(`${n} candidates (${inconsistent} inconsistent, ${res.counts.simpleFits} 1:1 fits); concentration lm ${JSON.stringify(res.concentration.lm)} post ${JSON.stringify(res.concentration.post)}`);
  console.log('LM top moves: ' + JSON.stringify(res.lmTopMoves));
  console.log('evidence (log10): ' + JSON.stringify(evidence));
  console.log('top by post:');
  for (const r of res.topPost.slice(0, 12)) console.log(`  ${r.rankPost} (LM rank ${r.rankLM}) lm ${r.lm} logL ${r.logL} ${r.simpleFit ? '1:1' : '   '} ${r.words || r.plaintext}`);
  for (const t of res.letterPosterior.post) console.log(`posterior letter at ${t.position} (${t.symbol}) under post: ${JSON.stringify(t.letters)}`);
  console.log(`wrote ${out} (${res.seconds.toFixed(1)} s)`);
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
