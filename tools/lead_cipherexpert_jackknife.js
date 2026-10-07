'use strict';
/**
 * tools/lead_cipherexpert_jackknife.js - leave-one-pin-out robustness of the Z13 / Z340-key lead.
 * For each of the six shared symbols (A,E,N,z,K,M), free that symbol (it becomes a completion
 * group like the circle) and pin only the other five to their Z340-key letters; compare t1/t2
 * (tools/lead_replicate_lib.js) with a permuted-Z340-key null (six letters drawn without
 * replacement from the 63 key letters, the same draws for every subset).
 *
 * usage: node tools/lead_cipherexpert_jackknife.js [--variant canonical] [--null 2000] [--seed 7] [--out file]
 * Output: results/lead/cipherexpert/jackknife_<variant>.json
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');

const args = process.argv.slice(2);
const opt = { variant: 'canonical', nNull: 2000, seed: 7, out: null };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant') opt.variant = args[++i];
  else if (args[i] === '--null') opt.nNull = parseInt(args[++i], 10);
  else if (args[i] === '--seed') opt.seed = parseInt(args[++i], 10);
  else if (args[i] === '--out') opt.out = args[++i];
}
opt.out = opt.out || path.join(R.ROOT, `results/lead/cipherexpert/jackknife_${opt.variant}.json`);
const REAL = [3, 17, 4, 0, 0, 14];

/** Layout with slot `drop` freed (its positions become a free group); drop = -1 keeps all six. */
function layoutDrop(base, drop) {
  if (drop < 0) return base;
  const slotPos = base.slotPos.map((p, k) => (k === drop ? [] : p.slice()));
  const pinned = slotPos.flat().sort((a, b) => a - b);
  const groups = base.groups.map((g) => ({ sym: g.sym, pos: g.pos.slice() }));
  groups.push({ sym: R.SLOTS[drop], pos: base.slotPos[drop].slice() });
  groups.sort((a, b) => a.pos[0] - b.pos[0]);
  return { id: base.id + '-' + R.SLOTS[drop], text: base.text, n: base.n, slotPos, pinned, groups };
}

const keys = R.loadKeys();
const letters = Object.values(keys.z340.key).map((l) => l.charCodeAt(0) - 65);
const rng = R.makeRng(opt.seed);
const draws = [];
for (let i = 0; i < opt.nNull; i++) draws.push(R.shuffle(letters.slice(), rng).slice(0, 6));

const base = R.layout(opt.variant);
const out = { tool: 'tools/lead_cipherexpert_jackknife.js', variant: opt.variant, nNull: opt.nNull, seed: opt.seed, rows: [] };
const t0 = Date.now();
for (let drop = -1; drop < 6; drop++) {
  const lay = layoutDrop(base, drop);
  const E = R.engine(lay);
  const real = E.stats(R.slotLetters(lay, REAL));
  const nv = { t1: [], t2: [] };
  for (const d of draws) {
    const s = E.stats(R.slotLetters(lay, d));
    nv.t1.push(s.t1); nv.t2.push(s.t2);
  }
  const row = { freed: drop < 0 ? 'none' : R.SLOTS[drop], realT1: +real.t1.toFixed(4), realT2: +real.t2.toFixed(4),
    pT1: R.pUpper(real.t1, nv.t1), pT2: R.pUpper(real.t2, nv.t2) };
  out.rows.push(row);
  console.log(JSON.stringify(row), ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
out.seconds = (Date.now() - t0) / 1000;
fs.writeFileSync(opt.out, JSON.stringify(out, null, 1));
console.log('wrote', opt.out);
