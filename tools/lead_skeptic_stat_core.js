'use strict';
/**
 * tools/lead_skeptic_stat_core.js - is the "frequent letters on Z13's shared symbols" effect a
 * habit of Zodiac's key-making that both solved keys share?  For each key (Z340, Z408) it reports
 * the mean unigram log10 P of the key letter over symbol sets:
 *   all       every symbol of the key
 *   capitals  normal-orientation capital-letter glyphs
 *   core      symbols that occur in all of Z408, Z340 and Z32 (Zodiac's habitual glyphs)
 *   coreCap   core symbols that are capitals
 *   z13       the six Z13 symbols shared with both keys (A E N z K M)
 * and a permutation p for "mean over 6 random symbols drawn from <set> >= mean over the Z13 six".
 * Reads only key mappings and ciphertext symbol inventories (no plaintext).
 *
 *   node tools/lead_skeptic_stat_core.js [--draws 100000] [--out results/lead/skeptic/stat/core.json]
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');
const lm = require('./lm');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DRAWS = +opt('--draws', 100000);
const OUT = opt('--out', 'results/lead/skeptic/stat/core.json');

const keys = R.loadKeys();
const J1 = lm.table(1);
const inv = (txt) => new Set([...txt]);
const s408 = inv(keys.z408.ascii), s340 = inv(keys.z340.ascii), s32 = inv(keys.z32.ascii);
const ETAOIN = new Set([...'ETAOINSHR']);
const out = { generated: new Date().toISOString(), draws: DRAWS, keys: {} };
const rng = R.makeRng(4242);

for (const K of ['z340', 'z408']) {
  const key = keys[K].key;
  const syms = Object.keys(key);
  const lp = (s) => J1[key[s].charCodeAt(0) - 65];
  const sets = {
    all: syms,
    capitals: syms.filter((s) => R.glyphClass(s) === 'capital'),
    core: syms.filter((s) => s408.has(s) && s340.has(s) && s32.has(s)),
    coreCap: syms.filter((s) => s408.has(s) && s340.has(s) && s32.has(s) && R.glyphClass(s) === 'capital'),
    z13: R.SLOTS.slice(),
  };
  const z13mean = R.SLOTS.reduce((a, s) => a + lp(s), 0) / 6;
  const row = { z13Letters: R.SLOTS.map((s) => key[s]).join(''), z13MeanLog10P: z13mean, sets: {} };
  for (const [name, set] of Object.entries(sets)) {
    const vals = set.map(lp);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const etaoin = set.filter((s) => ETAOIN.has(key[s])).length / set.length;
    let ge = 0;
    if (name !== 'z13' && set.length >= 6) {
      for (let d = 0; d < DRAWS; d++) {
        const pick = R.shuffle(vals.slice(), rng).slice(0, 6);
        if (pick.reduce((a, b) => a + b, 0) / 6 >= z13mean - 1e-12) ge++;
      }
    }
    row.sets[name] = { n: set.length, meanLog10P: mean, shareETAOINSHR: etaoin, pSixAtLeastZ13: name !== 'z13' && set.length >= 6 ? (1 + ge) / (1 + DRAWS) : null };
  }
  out.keys[K] = row;
  console.log(K, row.z13Letters, 'z13 mean', z13mean.toFixed(3));
  for (const [n, v] of Object.entries(row.sets)) console.log('  ', n.padEnd(9), 'n', String(v.n).padStart(3), 'mean', v.meanLog10P.toFixed(3), 'ETAOINSHR', v.shareETAOINSHR.toFixed(2), 'p(6 >= z13)', v.pSixAtLeastZ13 === null ? '-' : v.pSixAtLeastZ13.toFixed(4));
}
fs.mkdirSync(path.dirname(path.join(R.ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(R.ROOT, OUT), JSON.stringify(out, null, 1));
