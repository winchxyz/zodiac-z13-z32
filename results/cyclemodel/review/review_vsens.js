'use strict';
/**
 * results/cyclemodel/review/review_vsens.js - reviewer's prior-sensitivity table for
 * the Z13 circle explanations, using exactly the formulas of tools/cyclemodel_hyp.js
 * (same evidence groups, same slip and null terms) but a wider grid of the visual
 * factor V = P(scan | three distinct symbols) / P(scan | one symbol) and pi_null.
 *   node results/cyclemodel/review/review_vsens.js [--windows results/cyclemodel/review/windows_z13_orig.json]
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const ROOT = path.join(__dirname, '..', '..', '..');
const WF = path.resolve(ROOT, opt('windows', 'results/cyclemodel/review/windows_z13_orig.json'));
const EPS = 16 / 730;

function groups(v) {
  const g = { simple: [], small: [], zodiacSize: [] };
  for (const c of v.components) {
    if (c.regime === 'simple') { g.simple.push(c.pIso); continue; }
    if (c.S <= 45) g.small.push(c.pIso); else if (c.S >= 50) g.zodiacSize.push(c.pIso);
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return Object.fromEntries(Object.entries(g).map(([k, a]) => [k, mean(a)]));
}

const W = JSON.parse(fs.readFileSync(WF, 'utf8'));
const V = Object.fromEntries(W.variants.map((v) => [v.id, groups(v)]));
const gC = V['z13.canonical'], gD = V['z13.circles_distinct'], gN = V['z13.circles_null'];
const gS = ['z13.slip4', 'z13.slip6', 'z13.slip8'].map((id) => V[id]);
const keyPriors = { uniform: { simple: 1 / 3, small: 1 / 3, zodiacSize: 1 / 3 }, zodiacHabit: { simple: 0.2, small: 0.2, zodiacSize: 0.6 } };
const out = { tool: 'results/cyclemodel/review/review_vsens.js', windows: path.relative(ROOT, WF), rows: [] };
for (const [kpName, kp] of Object.entries(keyPriors)) {
  for (const Vf of [0.0001, 0.001, 0.003, 0.01, 0.1]) {
    for (const piNull of [1e-5, 1e-4, 1e-3]) {
      const q = 0.1;
      const post = {};
      for (const km of ['simple', 'small', 'zodiacSize']) {
        const e = { same: gC[km], distinct: gD[km] * Vf, null: gN[km] * piNull, slip: gS.reduce((a, g) => a + g[km], 0) * EPS * q / (1 - EPS) };
        for (const [h, x] of Object.entries(e)) post[`${km}/${h}`] = x * kp[km];
      }
      const z = Object.values(post).reduce((a, b) => a + b, 0);
      const byExpl = {}, byKey = {};
      for (const [k, v] of Object.entries(post)) { const [km, h] = k.split('/'); byExpl[h] = (byExpl[h] || 0) + v / z; byKey[km] = (byKey[km] || 0) + v / z; }
      const r3 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
      const row = { keyPrior: kpName, V: Vf, piNull, q, explanation: r3(byExpl), keyModel: r3(byKey) };
      out.rows.push(row);
      console.log(`${kpName.padEnd(11)} V=${String(Vf).padEnd(6)} piNull=${String(piNull).padEnd(6)} -> ${JSON.stringify(row.explanation)}  key ${JSON.stringify(row.keyModel)}`);
    }
  }
}
fs.writeFileSync(path.join(__dirname, 'vsens.json'), JSON.stringify(out, null, 1));
console.log('wrote results/cyclemodel/review/vsens.json');
