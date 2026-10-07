'use strict';
/**
 * tools/lead_skeptic_stat_influence.js - influence / decomposition check of the Z13 key lead
 * (canonical Z13 only, 676 completions).
 *
 * Statistics: U  = sum over the 9 pinned positions of the unigram log10 P of the pinned letter
 *                  (pure letter-frequency component, no completion),
 *             M6 = replication T1, S4 = best 4-gram window sum, W = replication T2.
 * Nulls (permuted key, the replication's N1 mechanism, fresh seeds):
 *   perm        - six entries drawn without replacement from the key's letters
 *   fix:<slot>  - the slot keeps its real letter; the other five are drawn from the key's letters
 *                 with one copy of that letter removed (p conditional on that one pin)
 * A pin whose conditioning pushes p far up carries the evidence alone.
 *
 *   node tools/lead_skeptic_stat_influence.js --key z340 [--draws 10000] [--nulls perm,fix:A,...] [--out results/lead/skeptic/stat/influence_z340.json]
 */
const fs = require('fs');
const path = require('path');
const S = require('./lead_skeptic_stat_lib');
const R = S.R;
const lm = S.lm;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const KEY = opt('--key', 'z340');
const DRAWS = +opt('--draws', 10000);
const OUT = opt('--out', `results/lead/skeptic/stat/influence_${KEY}.json`);

const keys = R.loadKeys();
const K = keys[KEY];
const code = (l) => l.charCodeAt(0) - 65;
const lay = R.layout('canonical');
const E = R.engine(lay);
const J1 = lm.table(1);
const realSlots = R.SLOTS.map((s) => code(K.key[s]));
const keyLetters = Object.values(K.key).map(code);

function stats(slots) {
  const pl = R.slotLetters(lay, slots);
  let U = 0;
  for (const p of lay.pinned) U += J1[pl[p]];
  const sm = S.smallSpecs(lay, pl);
  const w = E.stats(pl).t2;
  return [U, sm.M6, sm.S4, w];
}
const NAMES = ['U', 'M6', 'S4', 'W'];

const t0 = Date.now();
const real = stats(realSlots);
const out = { generated: new Date().toISOString(), key: KEY, realSlots: realSlots.map((c) => R.LET[c]).join(''), draws: DRAWS, real: Object.fromEntries(NAMES.map((n, i) => [n, real[i]])), nulls: {} };

function runNull(name, fixSlot, seed) {
  const rng = R.makeRng(seed);
  const pool = keyLetters.slice();
  if (fixSlot >= 0) pool.splice(pool.indexOf(realSlots[fixSlot]), 1);
  const ge = new Array(NAMES.length).fill(0);
  for (let d = 0; d < DRAWS; d++) {
    const pick = R.shuffle(pool.slice(), rng).slice(0, fixSlot >= 0 ? 5 : 6);
    let slots;
    if (fixSlot >= 0) { slots = pick.slice(); slots.splice(fixSlot, 0, realSlots[fixSlot]); } else slots = pick;
    const v = stats(slots);
    for (let i = 0; i < NAMES.length; i++) if (v[i] >= real[i] - 1e-12) ge[i]++;
  }
  out.nulls[name] = Object.fromEntries(NAMES.map((n, i) => [n, (1 + ge[i]) / (1 + DRAWS)]));
  console.log(`${name.padEnd(8)} ` + NAMES.map((n, i) => `${n} p=${out.nulls[name][n].toFixed(4)}`).join('  ') + `  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

console.log(`${KEY} real ${out.realSlots}: ` + NAMES.map((n, i) => `${n}=${real[i].toFixed(3)}`).join(' '));
// --nulls perm,fix:A,... runs a subset (shards write separate --out files)
const WANT = opt('--nulls', ['perm', ...R.SLOTS.map((s) => 'fix:' + s)].join(',')).split(',');
if (WANT.includes('perm')) runNull('perm', -1, 7101 + (KEY === 'z408' ? 1000 : 0));
R.SLOTS.forEach((s, k) => { if (WANT.includes('fix:' + s)) runNull('fix:' + s, k, 7110 + k + (KEY === 'z408' ? 1000 : 0)); });
out.seconds = (Date.now() - t0) / 1000;
fs.mkdirSync(path.dirname(path.join(R.ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(R.ROOT, OUT), JSON.stringify(out, null, 1));
