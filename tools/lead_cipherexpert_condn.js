'use strict';
/**
 * tools/lead_cipherexpert_condn.js - N=E-conditional null with the replication's statistics.
 * N=E is the one Z13 assignment that the Z408 and Z340 keys share.  Null keys keep N=E and draw
 * the other five slot letters without replacement from the Z340 key letters (one E removed);
 * p for t1/t2/t3 (tools/lead_replicate_lib.js).  Also reports the same for the Z408 key
 * (which also has N=E) as a negative control.
 *
 * usage: node tools/lead_cipherexpert_condn.js [--variant canonical] [--null 10000] [--seed 11] [--out file]
 * Output: results/lead/cipherexpert/condn_<variant>.json
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');

const args = process.argv.slice(2);
const opt = { variant: 'canonical', nNull: 10000, seed: 11, out: null };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant') opt.variant = args[++i];
  else if (args[i] === '--null') opt.nNull = parseInt(args[++i], 10);
  else if (args[i] === '--seed') opt.seed = parseInt(args[++i], 10);
  else if (args[i] === '--out') opt.out = args[++i];
}
opt.out = opt.out || path.join(R.ROOT, `results/lead/cipherexpert/condn_${opt.variant}.json`);
const keys = R.loadKeys();
const lay = R.layout(opt.variant);
const E = R.engine(lay);
const NIDX = R.SLOTS.indexOf('N');
const out = { tool: 'tools/lead_cipherexpert_condn.js', variant: opt.variant, nNull: opt.nNull, seed: opt.seed, keys: {} };
for (const kname of ['z340', 'z408']) {
  const key = keys[kname].key;
  const real = R.SLOTS.map((s) => key[s].charCodeAt(0) - 65);
  const pool = Object.values(key).map((l) => l.charCodeAt(0) - 65);
  pool.splice(pool.indexOf(4), 1); // remove one E (the N=E assignment)
  const rng = R.makeRng(opt.seed);
  const realS = E.stats(R.slotLetters(lay, real));
  const nv = { t1: [], t2: [], t3: [] };
  for (let i = 0; i < opt.nNull; i++) {
    const d = R.shuffle(pool.slice(), rng).slice(0, 5);
    const slots = [];
    let j = 0;
    for (let k = 0; k < 6; k++) slots.push(k === NIDX ? 4 : d[j++]);
    const s = E.stats(R.slotLetters(lay, slots));
    for (const st of R.STATS) nv[st].push(s[st]);
  }
  out.keys[kname] = { realLetters: real.map((x) => R.LET[x]).join(''),
    real: Object.fromEntries(R.STATS.map((st) => [st, +realS[st].toFixed(4)])),
    p: Object.fromEntries(R.STATS.map((st) => [st, R.pUpper(realS[st], nv[st])])) };
  console.log(kname, JSON.stringify(out.keys[kname]));
}
fs.writeFileSync(opt.out, JSON.stringify(out, null, 1));
console.log('wrote', opt.out);
