'use strict';
/**
 * results/cyclemodel/review/review_mccheck.js - reviewer's end-to-end Monte Carlo
 * check of L(P) = P(cipher isomorph | P) as computed by tools/cyclemodel_lib.js
 * makeScorer (the number every cyclemodel re-ranking and evidence sum uses).
 *
 * For a plaintext P: draw a component (S, regime) uniformly from the model's
 * defaultHyp grid, draw key sizes, encipher P with the lib's encrypt(), and count how
 * often the resulting symbol pattern equals the cipher's isomorph.  The hit rate
 * estimates the mixture L(P); it is compared with 10^logL from makeScorer.  This tests
 * the per-letter pattern canonicalisation, the row handling, the product over letters,
 * the allocation and the mixture weights end to end (the unit test only checks one
 * letter at a time).
 *   node results/cyclemodel/review/review_mccheck.js [--n 2000000] [--seed 5]
 * No Zodiac plaintext is used; the test strings are candidate plaintexts from the lists.
 */
const path = require('path');
const fs = require('fs');
const M = require('../../../tools/cyclemodel_lib');

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const N = +opt('n', 2000000);
const SEED = +opt('seed', 5);
const model = M.loadModel(path.join(__dirname, '..', 'fit.json'));
const hyp = model.defaultHyp;

const CASES = [
  { name: 'Z13 canonical', cipher: 'AENz0K0M0[NAM', rowsL: [13], pts: ['SOUTHTHEHOUSE', 'CHIEFOFAFRICA', 'ONTHEDEFEATOF', 'DONOTITSTANDS'] },
  { name: 'Z32 canonical (rows 17+15)', cipher: 'C9J|#Ok[AMf8?ORTGX6FDVj%HCELzPW9', rowsL: [17, 15], pts: ['SURESOMETHINGOFTHEFINDINGSANDYOU'], nScale: 2 },
];

// per (S, letter) cumulative k distribution, built once
const cum = new Map();
function cumFor(S) {
  if (cum.has(S)) return cum.get(S);
  const t = M.targets(model.alloc, S);
  const c = [];
  for (let l = 0; l < 26; l++) {
    const p = M.kDist(model.alloc, t[l]);
    const a = new Float64Array(M.KMAX + 1);
    let s = 0;
    for (let k = 1; k <= M.KMAX; k++) { s += p[k]; a[k] = s; }
    c.push(a);
  }
  cum.set(S, c);
  return c;
}

const res = { tool: 'results/cyclemodel/review/review_mccheck.js', created: new Date().toISOString(), n: N, seed: SEED, cases: [] };
const rng = M.mulberry32(SEED);
for (const cs of CASES) {
  const iso = M.isoOf(cs.cipher);
  const rows = M.rowsFor(cs.rowsL);
  const sc = M.makeScorer(model, { iso, rows, hyp });
  const ks = new Int32Array(26);
  for (const pt of cs.pts) {
    const n = Math.round(N * (cs.nScale || 1));
    const codes = Array.from(pt, (ch) => ch.charCodeAt(0) - 65);
    let hits = 0;
    const t0 = Date.now();
    for (let it = 0; it < n; it++) {
      const S = hyp.S[Math.floor(rng() * hyp.S.length)];
      const reg = hyp.regimes[Math.floor(rng() * hyp.regimes.length)];
      const c = cumFor(S);
      for (let l = 0; l < 26; l++) {
        const u = rng();
        let k = 1;
        while (k < M.KMAX && u >= c[l][k]) k++;
        ks[l] = k;
      }
      const sym = M.encrypt(codes, rows, ks, model.regimes[reg].theta, rng);
      // isomorph of the symbol ids
      const m = new Map();
      let ok = true;
      for (let i = 0; i < sym.length; i++) {
        if (!m.has(sym[i])) m.set(sym[i], m.size);
        if (m.get(sym[i]) !== iso[i]) { ok = false; break; }
      }
      if (ok) hits++;
    }
    const p = hits / n;
    const se = Math.sqrt(p * (1 - p) / n);
    const exact = Math.pow(10, sc.logL(pt));
    const rec = { cipher: cs.name, plaintext: pt, sims: n, hits, mc: p, mcSE: se, scorer: exact, z: se > 0 ? (p - exact) / se : null, log10mc: Math.log10(p), log10scorer: Math.log10(exact), seconds: (Date.now() - t0) / 1000 };
    res.cases.push(rec);
    console.log(`${cs.name} ${pt}: MC ${p.toExponential(4)} +- ${se.toExponential(2)} (${hits} hits / ${n}) vs scorer ${exact.toExponential(4)}  z = ${rec.z == null ? 'n/a' : rec.z.toFixed(2)}  [${rec.seconds.toFixed(1)} s]`);
  }
}
fs.writeFileSync(path.join(__dirname, 'mccheck.json'), JSON.stringify(res, null, 1));
console.log('wrote results/cyclemodel/review/mccheck.json');
