'use strict';
/**
 * tools/cyclemodel_compat.js - which plaintext letters are compatible with each
 * symbol repeat of Z13 and Z32 under the fitted homophone-selection model.
 *
 *   node tools/cyclemodel_compat.js [--model results/cyclemodel/fit.json] [--out results/cyclemodel/compat.json]
 *
 * For each repeat (symbol, positions, rows) and each letter X, the probability that
 * X's uses at those positions show exactly that repeat, given j other uses of X
 * (with other, distinct symbols) between consecutive occurrences:
 *   P(rep | X) = sum_k P(k | X, S) * P(pattern | k, theta)
 * per regime and key-size group (zodiac-size S in {54, 63}; small S in {30, 35, 40, 45}),
 * plus P(k = 1 | X, S).  A letter is "compatible" with a repeat when P(rep | X)
 * is not small; a single-homophone letter gives probability 1 for any repeat.
 */
const fs = require('fs');
const path = require('path');
const M = require('./cyclemodel_lib');

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const model = M.loadModel(opt('model', 'results/cyclemodel/fit.json'));
const OUT = opt('out', 'results/cyclemodel/compat.json');

const REPEATS = [
  { cipher: 'Z13', symbol: '0', positions: [4, 6, 8], rowsOf: [0, 0, 0] },
  { cipher: 'Z13', symbol: 'A', positions: [0, 11], rowsOf: [0, 0] },
  { cipher: 'Z13', symbol: 'N', positions: [2, 10], rowsOf: [0, 0] },
  { cipher: 'Z13', symbol: 'M', positions: [7, 12], rowsOf: [0, 0] },
  { cipher: 'Z32', symbol: 'C', positions: [0, 25], rowsOf: [0, 1] },
  { cipher: 'Z32', symbol: 'O', positions: [5, 13], rowsOf: [0, 0] },
  { cipher: 'Z32', symbol: '9', positions: [1, 31], rowsOf: [0, 1] },
];
const GROUPS = { zodiacSize: [54, 63], small: [30, 35, 40, 45] };
const regimes = Object.keys(model.regimes);
const f = M.englishFreq();

/** pattern with j distinct other symbols between each consecutive pair of occurrences */
function patternFor(rep, j) {
  const cls = [], rows = [];
  let next = 1;
  rep.rowsOf.forEach((r, t) => {
    if (t > 0) for (let q = 0; q < j; q++) { cls.push(next++); rows.push(rep.rowsOf[t - 1] === r ? r : (q < j / 2 ? rep.rowsOf[t - 1] : r)); }
    cls.push(0); rows.push(r);
  });
  return { cls, rows };
}

function probRep(X, S, theta, pat) {
  const t = M.targets(model.alloc, S)[X];
  const kd = M.kDist(model.alloc, t);
  let p = 0;
  for (let k = 1; k <= M.KMAX; k++) if (kd[k] > 0) p += kd[k] * M.patternProb(theta, k, pat.cls, pat.rows);
  return { p, pk1: kd[1], meanK: kd.reduce((a, x, k) => a + x * k, 0) };
}

function main() {
  const res = { tool: 'tools/cyclemodel_compat.js', created: new Date().toISOString(), groups: GROUPS, regimes, repeats: [] };
  const lettersByFreq = [...Array(26).keys()].sort((a, b) => f[b] - f[a]);
  // key-size table
  res.keySizes = {};
  for (const S of [30, 40, 54, 63]) {
    const t = M.targets(model.alloc, S);
    res.keySizes['S' + S] = Object.fromEntries(lettersByFreq.map((l) => {
      const kd = M.kDist(model.alloc, t[l]);
      return [M.LETTERS[l], { target: +t[l].toFixed(2), pK1: +kd[1].toFixed(3), meanK: +kd.reduce((a, x, k) => a + x * k, 0).toFixed(2) }];
    }));
  }
  for (const rep of REPEATS) {
    const r = { cipher: rep.cipher, symbol: rep.symbol, positions: rep.positions, rows: rep.rowsOf, table: {} };
    for (const j of rep.positions.length === 3 ? [0, 1] : [0, 1, 2]) {
      const pat = patternFor(rep, j);
      const tab = {};
      for (const l of lettersByFreq) {
        const row = {};
        for (const [g, Ss] of Object.entries(GROUPS)) for (const reg of regimes) {
          let p = 0, pk1 = 0;
          for (const S of Ss) { const q = probRep(l, S, model.regimes[reg].theta, pat); p += q.p / Ss.length; pk1 += q.pk1 / Ss.length; }
          row[`${g}/${reg}`] = +p.toPrecision(3);
          row[`${g}/pK1`] = +pk1.toPrecision(3);
        }
        tab[M.LETTERS[l]] = row;
      }
      r.table['j' + j] = { pattern: pat.cls.join(''), rows: pat.rows.join(''), letters: tab };
    }
    res.repeats.push(r);
    // print the j = 0 table compactly
    const t0 = r.table.j0.letters;
    console.log(`\n${rep.cipher} '${rep.symbol}' at ${rep.positions.join(',')} (rows ${rep.rowsOf.join(',')}), j = 0 intervening uses: P(repeat | letter)`);
    console.log('  letter  ' + Object.keys(t0.E).join('  '));
    for (const L of 'ETAOINSHRDLUCMWFGYPBVKXJQZ') console.log(`  ${L}       ` + Object.values(t0[L]).map((x) => String(x).padEnd(8)).join(' '));
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log(`\nwrote ${OUT}`);
}

main();
