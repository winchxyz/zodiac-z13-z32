'use strict';
/**
 * tools/lead_skeptic_stat_arrange.js - exact conditional (arrangement) test of the Z13 / key lead.
 * Given the multiset of the six letters a key gives Z13's shared symbols (Z340: D R E A A O;
 * Z408: W E E D S H), every distinct arrangement of those letters over the six slots
 * (A E N z K M) is scored with all 36 statistics of lead_skeptic_stat_lib.SPECS.  Under H0 (the key is
 * unrelated to Z13's plaintext) every arrangement is equally likely, so p = #{arr >= real} / N is
 * exact and immune to the letter-frequency / glyph-class confound.  Also run with the crosshair
 * slot fixed (capitals-only arrangements).
 *
 *   node tools/lead_skeptic_stat_arrange.js [--keys z340,z408] [--out results/lead/skeptic/stat/arrange.json]
 */
const fs = require('fs');
const path = require('path');
const S = require('./lead_skeptic_stat_lib');
const R = S.R;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const KEYS = opt('--keys', 'z340,z408').split(',');
const OUT = opt('--out', 'results/lead/skeptic/stat/arrange.json');

const keys = R.loadKeys();
const code = (l) => l.charCodeAt(0) - 65;
const lays = Object.fromEntries(R.VARIANT_IDS.map((id) => [id, R.layout(id)]));
const engines = Object.fromEntries(R.VARIANT_IDS.map((id) => [id, R.engine(lays[id])]));

function allSpecs(slots) {
  const st = {};
  for (const v of R.VARIANT_IDS) st[v] = engines[v].stats(R.slotLetters(lays[v], slots));
  const small = {};
  for (const v of S.SMALL) small[v] = S.smallSpecs(lays[v], R.slotLetters(lays[v], slots));
  return S.SPECS.map((sp) => {
    if (sp.kind === 'W') return st[sp.variant].t2;
    if (sp.variant === 'circles_distinct') return sp.kind === 'M6' ? st[sp.variant].t1 : st[sp.variant].t3;
    return small[sp.variant][sp.kind];
  });
}

const t0 = Date.now();
const out = { generated: new Date().toISOString(), specs: S.SPECS.map((s) => s.id), keys: {} };
for (const K of KEYS) {
  const real = R.SLOTS.map((s) => code(keys[K].key[s]));
  const realStr = real.map((c) => R.LET[c]).join('');
  out.keys[K] = { realSlots: realStr };
  for (const [mode, fixed] of [['all6', []], ['capitalsOnly', [3]]]) {
    const arrs = S.arrangements(real, fixed);
    const mat = arrs.map((a) => allSpecs(a));
    const realIdx = arrs.findIndex((a) => a.join(',') === real.join(','));
    const realVals = mat[realIdx];
    const wy = S.westfallYoung(mat, realVals, true);
    const rank = (t) => 1 + mat.filter((r) => r[t] > realVals[t] + 1e-12).length;
    const sp = S.SPECS.map((s, t) => ({ id: s.id, real: realVals[t], p: wy.pRaw[t], rank: rank(t) }));
    const replication12 = S.SPECS.map((s, t) => (['M6', 'W', 'K6'].includes(s.kind) ? t : -1)).filter((t) => t >= 0);
    const wy12 = S.westfallYoung(mat.map((r) => replication12.map((t) => r[t])), replication12.map((t) => realVals[t]), true);
    const top = (t) => mat.map((r, i) => [r[t], arrs[i].map((c) => R.LET[c]).join('')]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    out.keys[K][mode] = {
      N: arrs.length,
      specs: sp,
      pFWall36: wy.pFW, minP36: wy.minPReal,
      pFWreplication12: wy12.pFW, minP12: wy12.minPReal,
      specsP05: sp.filter((x) => x.p <= 0.05).length,
      specsP01: sp.filter((x) => x.p <= 0.01).length,
      topArrangements: { 'canonical:M6': top(S.SPECS.findIndex((s) => s.id === 'canonical:M6')), 'canonical:W': top(S.SPECS.findIndex((s) => s.id === 'canonical:W')) },
    };
    console.log(`${K} ${mode}: N=${arrs.length} minP36=${wy.minPReal.toFixed(4)} pFW36=${wy.pFW.toFixed(4)} minP12=${wy12.minPReal.toFixed(4)} pFW12=${wy12.pFW.toFixed(4)} specs<=.05: ${out.keys[K][mode].specsP05}/36 (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    for (const x of sp) console.log('  ' + x.id.padEnd(24) + x.real.toFixed(3).padStart(9) + '  p=' + x.p.toFixed(4) + '  rank ' + x.rank);
  }
}
out.seconds = (Date.now() - t0) / 1000;
fs.mkdirSync(path.dirname(path.join(R.ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(R.ROOT, OUT), JSON.stringify(out, null, 1));
