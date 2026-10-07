'use strict';
/**
 * tools/lead_replicate_power.js - positive control (power) for the Z13 / Z340-key lead test
 * (prereg: results/lead/replicate/prereg.md, "Positive control").
 *
 * Real 13-letter windows of English (letters-only stream of each Gutenberg document of the LM
 * corpus, any start position) that fit the variant's homophonic pattern are treated as Z13
 * plaintexts.  Their six pinned letters (A E N z K M) play the role of the "known" key letters:
 * a phrase is used only if those letters can come from a permutation of the Z340 key (a random
 * Zodiac-style key that shares them with the true key), so the null of the test is exactly N1
 * (and, for class-realizable phrases, N2).  p-values use the raw null values written by
 * tools/lead_replicate_run.js.
 *
 *   node tools/lead_replicate_power.js [--max 2000] [--seed 99] [--nulls results/lead/replicate/nulls_z340.json]
 *        [--out results/lead/replicate/power.json]
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MAX = +opt('--max', 2000);
const SEED = +opt('--seed', 99);
const NULLS = opt('--nulls', 'results/lead/replicate/nulls_z340.json');
const OUT = opt('--out', 'results/lead/replicate/power.json');

const GDIR = path.join(R.ROOT, 'data', 'lm', 'raw', 'gutenberg');
const MANIFEST = path.join(R.ROOT, 'data', 'lm', 'corpus_manifest.tsv');

function docLetters(id) {
  const fp = path.join(GDIR, `${id}.txt`);
  if (!fs.existsSync(fp)) return null;
  let t = fs.readFileSync(fp, 'utf8');
  const s = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i.exec(t);
  const e = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i.exec(t);
  if (s) t = t.slice(s.index + s[0].length, e && e.index > s.index ? e.index : t.length);
  return t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}

const PATTERNS = {
  canonical: (w) => w[0] === w[11] && w[2] === w[10] && w[4] === w[6] && w[6] === w[8] && w[7] === w[12],
  circles_distinct: (w) => w[0] === w[11] && w[2] === w[10] && w[7] === w[12],
};
// slot positions in the 13-letter phrase: A=0, E=1, N=2, z=3, K=5, M=7
const SLOTPOS = [0, 1, 2, 3, 5, 7];

const keys = R.loadKeys();
const K = keys.z340.key;
const syms = Object.keys(K);
const ms = (list) => { const c = new Array(26).fill(0); for (const l of list) c[l.charCodeAt(0) - 65]++; return c; };
const allMS = ms(syms.map((s) => K[s]));
const capMS = ms(syms.filter((s) => R.glyphClass(s) === 'capital').map((s) => K[s]));
const nonMS = ms(syms.filter((s) => R.glyphClass(s) === 'nonletter').map((s) => K[s]));
function fits(ms0, letters) { const c = ms0.slice(); for (const l of letters) { const k = l.charCodeAt(0) - 65; if (--c[k] < 0) return false; } return true; }

// ---- collect windows
const lines = fs.readFileSync(MANIFEST, 'utf8').split('\n').filter(Boolean);
const head = lines[0].split('\t');
const idc = head.indexOf('pg_id');
const found = { canonical: new Map(), circles_distinct: new Map() };   // phrase -> source
let lettersHeld = 0, lettersTrain = 0;
const t0 = Date.now();
for (let i = 1; i < lines.length; i++) {
  const row = i - 1;
  const held = row % 50 === 25;
  const id = lines[i].split('\t')[idc];
  const L = docLetters(id);
  if (!L) continue;
  if (held) lettersHeld += L.length; else lettersTrain += L.length;
  for (let st = 0; st + 13 <= L.length; st++) {
    // cheap pre-check shared by both patterns
    if (L.charCodeAt(st) !== L.charCodeAt(st + 11) || L.charCodeAt(st + 2) !== L.charCodeAt(st + 10) || L.charCodeAt(st + 7) !== L.charCodeAt(st + 12)) continue;
    const w = L.slice(st, st + 13);
    for (const v of Object.keys(PATTERNS)) {
      if (v === 'circles_distinct' && !held) continue;          // held-out text is enough for circles_distinct
      if (!PATTERNS[v](w)) continue;
      const prev = found[v].get(w);
      if (!prev || (held && prev !== 'heldout')) found[v].set(w, held ? 'heldout' : 'training');
    }
  }
}
console.log(`scanned ${lettersHeld} held-out and ${lettersTrain} training letters in ${((Date.now() - t0) / 1000).toFixed(0)} s;`,
  Object.entries(found).map(([v, m]) => `${v}: ${m.size} distinct fitting windows (${[...m.values()].filter((s) => s === 'heldout').length} held-out)`).join('; '));

// ---- null distributions
const NJ = JSON.parse(fs.readFileSync(path.isAbsolute(NULLS) ? NULLS : path.join(R.ROOT, NULLS), 'utf8'));
const NV = NJ.variants.length, NS = NJ.stats.length, NT = NV * NS;
function nullCols(name) {
  const rec = NJ.nulls[name];
  const buf = fs.readFileSync(path.join(R.ROOT, rec.raw));
  const a = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8);
  const cols = [];
  for (let t = 0; t < NT; t++) { const c = []; for (let r = 0; r < a.length / NT; r++) if (Number.isFinite(a[r * NT + t])) c.push(a[r * NT + t]); cols.push(c.sort((x, y) => x - y)); }
  return cols;
}
const cols = { perm: nullCols('perm'), class: nullCols('class') };
function pOf(sortedCol, x) {
  let lo = 0, hi = sortedCol.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sortedCol[m] < x) lo = m + 1; else hi = m; }
  return (1 + sortedCol.length - lo) / (1 + sortedCol.length);
}

// ---- evaluate
const rng = R.makeRng(SEED);
const out = { seed: SEED, max: MAX, lettersHeld, lettersTrain, variants: {} };
for (const v of Object.keys(PATTERNS)) {
  const vi = NJ.variants.indexOf(v);
  const lay = R.layout(v);
  const E = R.engine(lay);
  const all = [...found[v].entries()].map(([w, src]) => ({ w, src }));
  const usable = all.filter((x) => fits(allMS, SLOTPOS.map((p) => x.w[p])));
  R.shuffle(usable, rng);
  // held-out first, then training
  usable.sort((a, b) => (a.src === b.src ? 0 : a.src === 'heldout' ? -1 : 1));
  const take = usable.slice(0, MAX);
  const realVals = NJ.real[v];
  const rows = [];
  const tv = Date.now();
  for (const x of take) {
    const slots = SLOTPOS.map((p) => x.w.charCodeAt(p) - 65);
    const pl = R.slotLetters(lay, slots);
    const s = E.stats(pl);
    const classOK = fits(capMS, [0, 1, 2, 5, 7].map((p) => x.w[p])) && fits(nonMS, [x.w[3]]);
    const row = { w: x.w, src: x.src, t1: s.t1, t2: s.t2, t3: s.t3, classOK };
    for (const st of ['t1', 't2', 't3']) {
      const t = vi * NS + NJ.stats.indexOf(st);
      row['p_perm_' + st] = pOf(cols.perm[t], s[st]);
      if (classOK) row['p_class_' + st] = pOf(cols.class[t], s[st]);
    }
    rows.push(row);
  }
  const summ = {};
  for (const src of ['all', 'heldout', 'training']) {
    const rs = rows.filter((r) => src === 'all' || r.src === src);
    if (!rs.length) continue;
    const o = { n: rs.length };
    for (const st of ['t1', 't2', 't3']) {
      const t = vi * NS + NJ.stats.indexOf(st);
      const realX = realVals[st];
      const pReal = NJ.nulls.perm.tests[`${v}.${st}`].p;
      const pp = rs.map((r) => r['p_perm_' + st]);
      const frac = (f) => pp.filter(f).length / pp.length;
      const phraseTail = rs.filter((r) => r[st] >= realX).length / rs.length;
      const fi = cols.perm[t].findIndex((y) => y >= realX);
      const nullTail = fi < 0 ? 0 : (cols.perm[t].length - fi) / cols.perm[t].length;
      o[st] = {
        power05: frac((p) => p <= 0.05), power01: frac((p) => p <= 0.01), powerAtRealP: frac((p) => p <= pReal), realP: pReal,
        medianP: pp.slice().sort((a, b) => a - b)[Math.floor(pp.length / 2)],
        phraseTailAtReal: phraseTail, nullTailAtReal: nullTail, tailRatio: nullTail > 0 ? phraseTail / nullTail : null,
      };
      const rc = rs.filter((r) => r.classOK);
      if (rc.length) {
        const pc = rc.map((r) => r['p_class_' + st]);
        o[st].classN = rc.length;
        o[st].classPower05 = pc.filter((p) => p <= 0.05).length / pc.length;
        o[st].classPower01 = pc.filter((p) => p <= 0.01).length / pc.length;
      }
    }
    summ[src] = o;
  }
  out.variants[v] = { fittingWindows: all.length, realizable: usable.length, used: take.length, seconds: (Date.now() - tv) / 1000, summary: summ,
    examples: rows.slice(0, 25).map((r) => ({ w: r.w, src: r.src, p_perm_t1: r.p_perm_t1, p_perm_t2: r.p_perm_t2 })) };
  console.log(v, JSON.stringify(out.variants[v].summary));
  fs.writeFileSync(path.join(R.ROOT, OUT.replace(/\.json$/, `_${v}_rows.json`)), JSON.stringify(rows));
}
fs.writeFileSync(path.join(R.ROOT, OUT), JSON.stringify(out, null, 1));
console.log('wrote', OUT);
