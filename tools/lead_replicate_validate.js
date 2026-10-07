'use strict';
/**
 * tools/lead_replicate_validate.js - checks the fast replication engines against brute force
 * through lm.js (prereg: results/lead/replicate/prereg.md, "Fast implementations must reproduce").
 * Uses random assignments only; the real Z340/Z408 pin letters are excluded from the test set.
 *
 *   node tools/lead_replicate_validate.js [--n676 200] [--ncircles 20] [--ncircles-word 5] [--seed 4242] [--out results/lead/replicate/validate.json]
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');
const lm = require('./lm');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const N676 = +opt('--n676', 200), NC = +opt('--ncircles', 20), NCW = +opt('--ncircles-word', 5);
const SEED = +opt('--seed', 4242);
const OUT = opt('--out', 'results/lead/replicate/validate.json');

const keys = R.loadKeys();
const rng = R.makeRng(SEED);
const real340 = R.SLOTS.map((s) => keys.z340.key[s]).join('');
const real408 = R.SLOTS.map((s) => keys.z408.key[s]).join('');
const z340Letters = Object.values(keys.z340.key).map((l) => l.charCodeAt(0) - 65);
const ENG = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMWWFFGGYYPPBVK';

function drawAssignment(kind) {
  for (;;) {
    let s;
    if (kind === 0) s = R.SLOTS.map(() => rng.int(26));
    else if (kind === 1) s = R.shuffle(z340Letters.slice(), rng).slice(0, 6);
    else s = R.SLOTS.map(() => ENG.charCodeAt(rng.int(ENG.length)) - 65);
    const str = s.map((x) => R.LET[x]).join('');
    if (str !== real340 && str !== real408) return s;
  }
}

const report = { seed: SEED, started: new Date().toISOString(), checks: [], maxAbsDiff: {}, failures: 0 };
const TOL = 1e-6;
function check(variant, which, fast, ref, assign) {
  const d = Math.abs(fast - ref);
  const k = `${variant}.${which}`;
  report.maxAbsDiff[k] = Math.max(report.maxAbsDiff[k] || 0, d);
  if (!(d <= TOL) && !(fast === -Infinity && ref === -Infinity)) {
    report.failures++;
    if (report.checks.length < 50) report.checks.push({ variant, which, assign, fast, ref, d });
  }
}

const t0 = Date.now();
for (const id of R.VARIANT_IDS) {
  const lay = R.layout(id);
  const E = R.engine(lay);
  const big = id === 'circles_distinct';
  const nA = big ? NC : N676;
  let nWord = 0;
  for (let r = 0; r < nA; r++) {
    const s = drawAssignment(r % 3);
    const pl = R.slotLetters(lay, s);
    const assign = s.map((x) => R.LET[x]).join('');
    const wantWord = !big || r < NCW;
    const fast = E.stats(pl);
    const ref = R.bruteStats(lay, pl, { word: wantWord });
    check(id, 't1', fast.t1, ref.t1, assign);
    check(id, 't3', fast.t3, ref.t3, assign);
    if (wantWord) { check(id, 't2', fast.t2, ref.t2, assign); nWord++; }
    // spot-check individual completion sums against lm.ngramScore
    const M = E.markov.run(pl);
    for (let q = 0; q < 5; q++) {
      const a = rng.int(E.markov.total);
      const gl = [];
      let rr = a;
      for (let g = lay.groups.length - 1; g >= 0; g--) { gl[g] = rr % 26; rr = (rr / 26) | 0; }
      const txt = R.codesToText(R.fill(lay, pl, gl));
      check(id, 'sum', M.sums[a], lm.ngramScore(txt, 6).logp, assign + ':' + txt);
    }
  }
  console.log(`${id}: ${nA} assignments (${nWord} with word check), elapsed ${((Date.now() - t0) / 1000).toFixed(1)} s, failures so far ${report.failures}`);
}
report.elapsedSec = (Date.now() - t0) / 1000;
report.pass = report.failures === 0;
fs.mkdirSync(path.dirname(path.join(R.ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(R.ROOT, OUT), JSON.stringify(report, null, 1));
console.log('maxAbsDiff', JSON.stringify(report.maxAbsDiff));
console.log(report.pass ? 'PASS' : `FAIL (${report.failures})`);
