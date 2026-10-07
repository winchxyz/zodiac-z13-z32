'use strict';
/**
 * tools/lead_skeptic_stat_multiverse.js - specification-curve / multiverse check of the Z13 / Z340-key
 * lead.  Re-scores the replication's own null draws (results/lead/replicate/nulls_<key>.json,
 * drawsSlots) with 36 reasonable statistic choices (lead_skeptic_stat_lib.SPECS: Markov orders 2-6,
 * window sums 3-6, top-10 mean, word model; 3 small variants + circles_distinct) and reports the
 * per-spec p, the Westfall-Young family-wise p over the whole multiverse, and the share of specs
 * reaching p <= 0.05 for the real key against the same share for every null draw.
 *
 *   node tools/lead_skeptic_stat_multiverse.js --key z340 --null perm [--limit N] [--out results/lead/skeptic/stat/multiverse_z340_perm.json]
 *
 * W (small variants) and all circles_distinct statistics are read from the replication's raw
 * Float64 file (t1 t2 t3 per variant); M6 and K6 are recomputed here and checked against it.
 */
const fs = require('fs');
const path = require('path');
const S = require('./lead_skeptic_stat_lib');
const R = S.R;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const KEY = opt('--key', 'z340');
const NULL = opt('--null', 'perm');
const LIMIT = +opt('--limit', 0);
const OUT = opt('--out', `results/lead/skeptic/stat/multiverse_${KEY}_${NULL}${LIMIT ? '_lim' + LIMIT : ''}.json`);

const rep = JSON.parse(fs.readFileSync(path.join(R.ROOT, `results/lead/replicate/nulls_${KEY}.json`), 'utf8'));
const nd = rep.nulls[NULL];
if (!nd || !nd.drawsSlots) throw new Error(`no drawsSlots for ${KEY}/${NULL}`);
const rawBuf = fs.readFileSync(path.join(R.ROOT, nd.raw));
const raw = new Float64Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength / 8);
const NV = R.VARIANT_IDS.length, NS = 3, NT = NV * NS;
const vIdx = (v) => R.VARIANT_IDS.indexOf(v);

const lays = Object.fromEntries(R.VARIANT_IDS.map((id) => [id, R.layout(id)]));
const code = (l) => l.charCodeAt(0) - 65;
const keys = R.loadKeys();
const realSlots = R.SLOTS.map((s) => code(keys[KEY].key[s]));

function specRow(slots, rawRow) {
  const out = new Float64Array(S.SPECS.length);
  const small = {};
  for (const v of S.SMALL) small[v] = S.smallSpecs(lays[v], R.slotLetters(lays[v], slots));
  S.SPECS.forEach((sp, t) => {
    if (sp.variant === 'circles_distinct') {
      out[t] = rawRow[vIdx(sp.variant) * NS + (sp.kind === 'M6' ? 0 : sp.kind === 'W' ? 1 : 2)];
    } else if (sp.kind === 'W') {
      out[t] = rawRow[vIdx(sp.variant) * NS + 1];
    } else out[t] = small[sp.variant][sp.kind];
  });
  return { out, small };
}

const t0 = Date.now();
// real
const realRaw = new Float64Array(NT);
R.VARIANT_IDS.forEach((v, vi) => {
  const s = R.engine(lays[v]).stats(R.slotLetters(lays[v], realSlots));
  realRaw[vi * NS] = s.t1; realRaw[vi * NS + 1] = s.t2; realRaw[vi * NS + 2] = s.t3;
});
const real = specRow(realSlots, realRaw).out;

const D = LIMIT ? Math.min(LIMIT, nd.drawsSlots.length) : nd.drawsSlots.length;
const mat = [];
let maxDiffM6 = 0, maxDiffK6 = 0;
for (let d = 0; d < D; d++) {
  const slots = [...nd.drawsSlots[d]].map(code);
  const rawRow = raw.subarray(d * NT, d * NT + NT);
  const { out, small } = specRow(slots, rawRow);
  for (const v of S.SMALL) {
    maxDiffM6 = Math.max(maxDiffM6, Math.abs(small[v].M6 - rawRow[vIdx(v) * NS]));
    maxDiffK6 = Math.max(maxDiffK6, Math.abs(small[v].K6 - rawRow[vIdx(v) * NS + 2]));
  }
  mat.push(out);
  if (d % 1000 === 999) console.log(`${d + 1}/${D} draws, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

const wy = S.westfallYoung(mat, Array.from(real));
// share of specs with p <= 0.05 (and <= 0.01): real vs each draw
const cnt = (pv, a) => pv.filter((p) => p <= a).length;
const realC05 = cnt(wy.pRaw, 0.05), realC01 = cnt(wy.pRaw, 0.01);
let ge05 = 0, ge01 = 0;
const drawC05 = [];
for (let d = 0; d < D; d++) {
  const c05 = cnt(Array.from(wy.nullP[d]), 0.05), c01 = cnt(Array.from(wy.nullP[d]), 0.01);
  drawC05.push(c05);
  if (c05 >= realC05) ge05++;
  if (c01 >= realC01) ge01++;
}
// per-family minimum p (small variants only, by kind), and a "Markov orders only" family
function familyWY(filter) {
  const idx = S.SPECS.map((s, i) => (filter(s) ? i : -1)).filter((i) => i >= 0);
  const r = S.westfallYoung(mat.map((row) => idx.map((i) => row[i])), idx.map((i) => real[i]));
  return { tests: idx.length, minP: r.minPReal, pFW: r.pFW };
}
const families = {
  all36: { tests: S.SPECS.length, minP: wy.minPReal, pFW: wy.pFW },
  canonicalOnly: familyWY((s) => s.variant === 'canonical'),
  markovOrdersCanonical: familyWY((s) => s.variant === 'canonical' && /^M/.test(s.kind)),
  windowSumsCanonical: familyWY((s) => s.variant === 'canonical' && /^S/.test(s.kind)),
  replicationTwelve: familyWY((s) => ['M6', 'W', 'K6'].includes(s.kind)),
};
const res = {
  generated: new Date().toISOString(),
  key: KEY, null: NULL, draws: D, seconds: (Date.now() - t0) / 1000,
  check: { maxAbsDiffM6vsReplicationT1: maxDiffM6, maxAbsDiffK6vsReplicationT3: maxDiffK6 },
  specs: S.SPECS.map((s, t) => ({ id: s.id, real: real[t], p: wy.pRaw[t] })),
  families,
  countTest: {
    realSpecsP05: realC05, realSpecsP01: realC01, of: S.SPECS.length,
    pCount05: (1 + ge05) / (1 + D), pCount01: (1 + ge01) / (1 + D),
    nullMeanSpecsP05: drawC05.reduce((a, b) => a + b, 0) / D,
  },
  pRange: { min: Math.min(...wy.pRaw), median: [...wy.pRaw].sort((a, b) => a - b)[Math.floor(wy.pRaw.length / 2)], max: Math.max(...wy.pRaw) },
};
fs.mkdirSync(path.dirname(path.join(R.ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(R.ROOT, OUT), JSON.stringify(res, null, 1));
const f64 = new Float64Array(D * S.SPECS.length);
mat.forEach((row, d) => f64.set(row, d * S.SPECS.length));
fs.writeFileSync(path.join(R.ROOT, OUT.replace(/\.json$/, '.f64')), Buffer.from(f64.buffer));
console.log(JSON.stringify({ key: KEY, null: NULL, draws: D, check: res.check, families, countTest: res.countTest, pRange: res.pRange }, null, 1));
for (const s of res.specs) console.log(s.id.padEnd(24), s.real.toFixed(3).padStart(9), s.p.toFixed(4));
