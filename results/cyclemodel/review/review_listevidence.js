'use strict';
/**
 * results/cyclemodel/review/review_listevidence.js - reviewer's re-computation of the
 * candidate-list evidence of tools/cyclemodel_score.js (log10 sum over candidates of
 * 10^lm * L_H(P)) for simple / small-key / Zodiac-size key, under several model files
 * (to test the sensitivity of the Bayes factor to the key-size allocation).
 * Same conventions as cyclemodel_score.js: dedup (first lm kept), candidates more than
 * 12 log10 units below the best lm dropped, Zodiac-size = S {54, 63}, small = defaultHyp S <= 45.
 *   node results/cyclemodel/review/review_listevidence.js --cipher data/ciphers/variants/z13.canonical.txt \
 *        --in A.tsv --in B.tsv --models results/cyclemodel/fit.json,results/cyclemodel/review/model_k1fit.json --out X.json
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const M = require('./review_lib');
const C = require('../../../tools/cipher');

const argv = process.argv.slice(2);
const ins = [];
const o = {};
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); const v = argv[++i]; if (k === 'in') ins.push(v); else o[k] = v; }
const WINDOW = 12;

function lse(arr) {
  let mx = -Infinity;
  for (const x of arr) if (x > mx) mx = x;
  if (mx === -Infinity) return -Infinity;
  let s = 0;
  for (const x of arr) s += Math.pow(10, x - mx);
  return mx + Math.log10(s);
}

async function main() {
  const t0 = Date.now();
  const text = C.loadCipher(o.cipher).text;
  const iso = M.isoOf(text);
  const rows = new Array(text.length).fill(0);
  const seen = new Set();
  const cand = [];
  let maxLM = -Infinity;
  for (const f of ins) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    let header = null;
    for await (const line of rl) {
      if (!header) { header = line.split('\t'); continue; }
      if (!line) continue;
      const x = line.split('\t');
      const p = x[0];
      let lm;
      if (header[1] === 'wordLogp') lm = +x[1]; else if (header[1] === 'weight') lm = Math.log10(+x[1]); else continue;
      if (!p || p.length !== text.length || !/^[A-Z]+$/.test(p)) continue;
      if (lm < maxLM - WINDOW) continue;
      if (seen.has(p)) continue;
      seen.add(p);
      if (lm > maxLM) maxLM = lm;
      cand.push([p, lm]);
    }
  }
  const kept = cand.filter((c) => !(c[1] < maxLM - WINDOW));
  const res = { tool: 'results/cyclemodel/review/review_listevidence.js', cipher: o.cipher, inputs: ins, candidates: kept.length, maxLM, models: {} };
  for (const mf of o.models.split(',')) {
    const model = M.loadModel(mf);
    const hyp = model.defaultHyp;
    const scZ = M.makeScorer(model, { iso, rows, hyp: { kind: 'homophonic', S: [54, 63], regimes: hyp.regimes } });
    const scS = M.makeScorer(model, { iso, rows, hyp: { kind: 'homophonic', S: hyp.S.filter((x) => x <= 45), regimes: hyp.regimes } });
    const scM = M.makeScorer(model, { iso, rows, hyp: { kind: 'simple' } });
    const eZ = [], eS = [], eM = [];
    for (const [p, lm] of kept) { eZ.push(lm + scZ.logL(p)); eS.push(lm + scS.logL(p)); eM.push(lm + scM.logL(p)); }
    const r = { alloc: model.alloc, simple: lse(eM), homophonicSmallS: lse(eS), homophonicZodiacSize: lse(eZ) };
    r.log10BF_simple_vs_zodiacSize = r.simple - r.homophonicZodiacSize;
    r.log10BF_simple_vs_small = r.simple - r.homophonicSmallS;
    res.models[mf] = r;
    console.log(`${mf}: simple ${r.simple.toFixed(3)} small ${r.homophonicSmallS.toFixed(3)} zodiacSize ${r.homophonicZodiacSize.toFixed(3)}  BF simple/zodiac 10^${r.log10BF_simple_vs_zodiacSize.toFixed(2)}`);
  }
  res.seconds = (Date.now() - t0) / 1000;
  fs.writeFileSync(o.out, JSON.stringify(res, null, 1));
  console.log(`${kept.length} candidates; wrote ${o.out} (${res.seconds.toFixed(1)} s)`);
}
main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
