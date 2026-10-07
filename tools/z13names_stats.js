'use strict';
/**
 * tools/z13names_stats.js - statistics for the z13names enumeration grid.
 *
 * Reads results/z13names/runs/<variant>.<mode>.<list>.json (+ .tsv.gz with the 0-filler fits)
 * written by tools/z13names_run.js and computes:
 *  1. fit counts per variant / mode / list / pattern / number of fillers (and, for
 *     z13.crosshair_null, the fits with a name-part boundary at the crosshair, position 3);
 *  2. denominators: how many name strings of the right length each pattern can make, and their
 *     total prior weight, so  fraction = fits / name strings  and  weighted fraction = P(a name drawn
 *     from the prior, conditioned on its length, fits);  with f fillers the denominator is
 *     (names of length Lc-f) x (f+1) placements;
 *  3. a letter-level baseline: P(a string of Lc independent letters fits) for English letter
 *     frequencies (data/lm/ngram1.bin) and for the letter frequencies of the name lists
 *     (exact: inclusion-exclusion over set partitions of the cipher symbols for simple substitution);
 *  4. posteriors over the 0-filler fits under the name-frequency prior: p_i ∝ w_i (simple
 *     substitution: every fit has the same likelihood; homophonic "flat": same) and, for homophonic
 *     mode, p_i ∝ w_i * Lh_i with Lh = probability of the observed symbol pattern when every letter
 *     occurrence picks one of h_l homophones uniformly at random (h_l = mean of the Z408 and Z340
 *     homophone counts, rounded up, at least 1).  Reported per pattern and for an equal-prior
 *     mixture of the patterns (each pattern's prior conditioned on the cipher length).
 *
 * Usage: node tools/z13names_stats.js [--runs results/z13names/runs] [--out results/z13names]
 * Writes: fit_counts.tsv, posterior_top.tsv, stats.json
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const C = require('./cipher');

const ROOT = path.join(__dirname, '..');
const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const VARIANT_FILES = {
  'z13.canonical': ['data/ciphers/variants/z13.canonical.txt', ''],
  'z13.circles_distinct': ['data/ciphers/variants/z13.circles_distinct.txt', ''],
  'z13.crosshair_null': ['data/ciphers/variants/z13.crosshair_null.txt', ''],
  'z13.bracket_is_perp': ['data/ciphers/variants/z13.bracket_is_perp.txt', ''],
  'z13.reversed': ['data/ciphers/variants/z13.reversed.txt', ''],
  'z13.letters_literal': ['data/ciphers/variants/z13.canonical.txt', 'A=A,E=E,N=N,K=K,M=M'],
};
const LIST_FILES = {
  male: { first: 'data/names/first_male.tsv', init: null },
  female: { first: 'data/names/first_female.tsv', init: null },
  nick_male: { first: 'results/z13names/lists/nick_male.tsv', init: 'data/names/first_male.tsv' },
  nick_female: { first: 'results/z13names/lists/nick_female.tsv', init: 'data/names/first_female.tsv' },
};

/* -------------------------------------------------------------- helpers */

function readTsv(file, maxLen) {
  const out = [];
  for (const ln of fs.readFileSync(path.join(ROOT, file), 'latin1').split('\n')) {
    if (!ln) continue;
    const t = ln.indexOf('\t');
    const w = (t < 0 ? ln : ln.slice(0, t)).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(w)) continue;
    const v = t < 0 ? 1 : +ln.slice(t + 1);
    if (w.length <= maxLen) out.push({ w, weight: v });
  }
  return out;
}

function lenProfile(entries, maxLen) {
  const N = new Float64Array(maxLen + 1), W = new Float64Array(maxLen + 1);
  for (const e of entries) { N[e.w.length]++; W[e.w.length] += e.weight; }
  return { N, W };
}

function convolve(a, b, maxLen) {
  const N = new Float64Array(maxLen + 1), W = new Float64Array(maxLen + 1);
  for (let i = 0; i <= maxLen; i++) for (let j = 0; i + j <= maxLen; j++) { N[i + j] += a.N[i] * b.N[j]; W[i + j] += a.W[i] * b.W[j]; }
  return { N, W };
}

const cacheProfiles = {};
function profiles(listName, Lc) {
  const key = listName + '/' + Lc;
  if (cacheProfiles[key]) return cacheProfiles[key];
  const cfg = LIST_FILES[listName];
  const F = readTsv(cfg.first, Lc);
  const L = readTsv('data/names/surnames.tsv', Lc);
  const initSrc = cfg.init ? readTsv(cfg.init, 99) : F;
  const initW = new Float64Array(26);
  let tw = 0;
  for (const e of initSrc) { initW[e.w.charCodeAt(0) - 65] += e.weight; tw += e.weight; }
  let nInit = 0;
  for (let l = 0; l < 26; l++) { initW[l] /= tw; if (initW[l] > 0) nInit++; }
  const I = { N: new Float64Array(Lc + 1), W: new Float64Array(Lc + 1) };
  I.N[1] = nInit; I.W[1] = 1;
  const res = { F: lenProfile(F, Lc), M: lenProfile(F, Lc), L: lenProfile(L, Lc), I };
  cacheProfiles[key] = res;
  return res;
}

function patternProfile(listName, pattern, Lc) {
  const P = profiles(listName, Lc);
  let acc = { N: new Float64Array(Lc + 1), W: new Float64Array(Lc + 1) };
  acc.N[0] = 1; acc.W[0] = 1;
  for (const t of pattern) acc = convolve(acc, P[t], Lc);
  return acc;
}

/* ------------------------------------------------------ letter baseline */

function* setPartitions(n) {
  // restricted growth strings
  const a = new Int32Array(n);
  function* rec(i, m) {
    if (i === n) { yield a; return; }
    for (let b = 0; b <= m + 1 && b < n; b++) { a[i] = b; yield* rec(i + 1, Math.max(m, b)); }
  }
  yield* rec(0, -1);
}

function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

/** P(Lc iid letters with probabilities p match the symbol pattern); pins: symbol -> letter index. */
function letterBaseline(text, pins, p, mode) {
  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) || 0) + 1);
  let fixedProb = 1;
  const pinnedLetters = new Set();
  const free = [];
  for (const [s, c] of counts) {
    if (pins.has(s)) { fixedProb *= Math.pow(p[pins.get(s)], c); pinnedLetters.add(pins.get(s)); } else free.push(c);
  }
  const allowed = [];
  for (let l = 0; l < 26; l++) if (mode !== 'simple' || !pinnedLetters.has(l)) allowed.push(l);
  const powSum = (k) => { let s = 0; for (const l of allowed) s += Math.pow(p[l], k); return s; };
  if (mode !== 'simple') {
    let r = fixedProb;
    for (const c of free) { let s = 0; for (let l = 0; l < 26; l++) s += Math.pow(p[l], c); r *= s; }
    return r;
  }
  let total = 0;
  for (const a of setPartitions(free.length)) {
    const blocks = new Map();
    for (let i = 0; i < free.length; i++) { const b = blocks.get(a[i]) || { size: 0, c: 0 }; b.size++; b.c += free[i]; blocks.set(a[i], b); }
    let term = 1;
    for (const b of blocks.values()) term *= ((b.size - 1) % 2 ? -1 : 1) * fact(b.size - 1) * powSum(b.c);
    total += term;
  }
  return fixedProb * total;
}

/* ------------------------------------------------- homophone likelihood */

function homophoneCounts() {
  const h = {};
  for (const f of ['z408', 'z340']) {
    const key = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ciphers', f + '.json'), 'utf8')).key;
    const cnt = {};
    for (const l of Object.values(key)) cnt[l] = (cnt[l] || 0) + 1;
    h[f] = cnt;
  }
  const out = new Int32Array(26);
  for (let l = 0; l < 26; l++) {
    const a = h.z408[LET[l]] || 0, b = h.z340[LET[l]] || 0;
    out[l] = Math.max(1, Math.ceil((a + b) / 2));
  }
  return { h: out, z408: h.z408, z340: h.z340 };
}

function logLh(plain, text, h) {
  // plain: upper-case letters (0-filler fits only)
  const occ = new Int32Array(26);
  const syms = Array.from({ length: 26 }, () => new Set());
  for (let i = 0; i < plain.length; i++) { const l = plain.charCodeAt(i) - 65; occ[l]++; syms[l].add(text[i]); }
  let lg = 0;
  for (let l = 0; l < 26; l++) {
    if (!occ[l]) continue;
    const k = syms[l].size, hl = h[l];
    if (k > hl) return -Infinity;
    for (let j = 0; j < k; j++) lg += Math.log(hl - j);
    lg -= occ[l] * Math.log(hl);
  }
  return lg;
}

/* ------------------------------------------------------------ posterior */

function postStats(items) {
  // items: [{x (unnormalised), ...}] sorted desc by x
  const S = items.reduce((a, b) => a + b.x, 0);
  if (!(S > 0)) return null;
  let cum = 0, n50 = null, n90 = null, sq = 0, ent = 0;
  items.forEach((it, i) => {
    const q = it.x / S;
    it.post = q;
    cum += q;
    sq += q * q;
    if (q > 0) ent -= q * Math.log(q);
    if (n50 === null && cum >= 0.5) n50 = i + 1;
    if (n90 === null && cum >= 0.9) n90 = i + 1;
  });
  const mass = (k) => items.slice(0, k).reduce((a, b) => a + b.post, 0);
  return { fits: items.length, top1: mass(1), top10: mass(10), top100: mass(100), n50, n90, effectiveN: 1 / sq, perplexity: Math.exp(ent) };
}

/* ----------------------------------------------------------------- main */

function main() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const runsDir = path.join(ROOT, opt('runs', 'results/z13names/runs'));
  const outDir = path.join(ROOT, opt('out', 'results/z13names'));
  const H = homophoneCounts();

  // letter frequencies: English (corpus unigrams) and name letters (prior-weighted, male FL)
  const uni = new Float32Array(fs.readFileSync(path.join(ROOT, 'data', 'lm', 'ngram1.bin')).buffer.slice(0));
  const pEng = Array.from(uni, (x) => Math.pow(10, x));
  const nameLet = new Float64Array(26);
  for (const f of ['data/names/first_male.tsv', 'data/names/first_female.tsv', 'data/names/surnames.tsv']) {
    for (const e of readTsv(f, 99)) for (const ch of e.w) nameLet[ch.charCodeAt(0) - 65] += e.weight;
  }
  const tot = nameLet.reduce((a, b) => a + b, 0);
  const pName = Array.from(nameLet, (x) => x / tot);

  const variants = {};
  for (const [id, [file, pin]] of Object.entries(VARIANT_FILES)) {
    const ci = C.loadCipher(path.join(ROOT, file));
    const pins = new Map();
    for (const [s, l] of C.parseKey(pin)) pins.set(s, l.charCodeAt(0) - 65);
    const base = {};
    for (const mode of ['simple', 'homophonic']) base[mode] = { english: letterBaseline(ci.text, pins, pEng, mode), nameLetters: letterBaseline(ci.text, pins, pName, mode) };
    variants[id] = { text: ci.text, Lc: ci.text.length, isomorph: C.isomorph(ci.text), pin, letterBaseline: base };
  }

  // Monte Carlo estimates (tools/z13names_mc.js), keyed variant|mode|list|pattern|fillers|sampling
  const MC = {};
  const mcFile = path.join(outDir, 'mc.json');
  if (fs.existsSync(mcFile)) for (const r of JSON.parse(fs.readFileSync(mcFile, 'utf8')).results) MC[`${r.variant}|${r.mode}|${r.list}|${r.pattern}|${r.fillers}|${r.sampling}`] = r;
  const files = fs.readdirSync(runsDir).filter((f) => f.endsWith('.json')).sort();
  const countRows = [];
  const runs = [];
  const postRows = [];
  for (const f of files) {
    const res = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
    const m = f.match(/^(z13\.[a-z_]+)\.(simple|homophonic)\.([a-z_]+)\.json$/);
    if (!m) continue;
    const [, variant, mode, list] = m;
    const V = variants[variant];
    const Lc = V.Lc;
    // 1-2: counts and fractions
    const cells = res.counts.cells;
    const agg = {};
    for (const [k, c] of Object.entries(cells)) {
      const [pat, fill] = k.split('|');
      const kk = pat + '|' + fill;
      const a = agg[kk] || (agg[kk] = { pattern: pat, fillers: +fill, n: 0, sw: 0, nb: 0, swb: 0 });
      a.n += c.n; a.sw += c.sw; a.nb += c.nb; a.swb += c.swb;
    }
    const patterns = res.options.patterns;
    const Kmax = res.options.fillers, minW = res.options.minWeight || 0;
    const run = { variant, mode, list, complete: res.counts.complete, totalFits: res.counts.fits, fillersEnumerated: Kmax, minWeight: minW, patterns: {} };
    for (const pat of patterns) {
      const prof = patternProfile(list, pat, Lc);
      run.patterns[pat] = { byFillers: {} };
      for (let fl = 0; fl <= 2; fl++) {
        const a = agg[pat + '|' + fl] || { n: 0, sw: 0, nb: 0, swb: 0 };
        const nameLen = Lc - fl;
        const Nden = prof.N[nameLen] * (fl + 1), Wden = prof.W[nameLen] * (fl + 1);
        const enumerated = fl <= Kmax && !minW && res.counts.complete;
        const row = { variant, mode, list, pattern: pat, fillers: fl, enumerated: fl > Kmax ? 'no' : minW ? `only weight >= ${minW}` : res.counts.complete ? 'complete' : 'incomplete',
          fits: fl <= Kmax ? a.n : null, nameStrings: Nden, fraction: enumerated && Nden ? a.n / Nden : null, weightSum: fl <= Kmax ? a.sw : null, priorWeight: Wden, weightedFraction: enumerated && Wden ? a.sw / Wden : null };
        if (variant === 'z13.crosshair_null') { row.fitsBoundary3 = fl <= Kmax ? a.nb : null; row.weightedFractionBoundary3 = enumerated && Wden ? a.swb / Wden : null; }
        const mcp = MC[`${variant}|${mode}|${list}|${pat}|${fl}|prior`], mcu = MC[`${variant}|${mode}|${list}|${pat}|${fl}|uniform`];
        if (mcp) { row.mcWeightedFraction = mcp.fraction; row.mcWeightedCI = mcp.ci95; row.mcHits = mcp.hits; row.mcN = mcp.n; }
        if (mcu) { row.mcFraction = mcu.fraction; row.mcFractionCI = mcu.ci95; row.mcUniformHits = mcu.hits; }
        if (!enumerated && mcu) row.fitsEstimatedFromMC = mcu.fraction * Nden;
        run.patterns[pat].byFillers[fl] = row;
        countRows.push(row);
      }
    }
    // 3-4: posteriors over the 0-filler fits
    const gz = path.join(runsDir, f.replace(/\.json$/, '.tsv.gz'));
    const byPat = {};
    let distinct = {};
    if (fs.existsSync(gz)) {
      const txt = zlib.gunzipSync(fs.readFileSync(gz)).toString('latin1');
      const lines = txt.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const ln = lines[i];
        if (!ln) continue;
        const [pt, w, pat, parts, fill] = ln.split('\t');
        if (fill !== '0') continue;
        (byPat[pat] || (byPat[pat] = [])).push({ pt, w: +w, parts });
      }
    }
    const mixture = [];
    for (const pat of Object.keys(byPat)) {
      const items = byPat[pat];
      const set = new Set(items.map((x) => x.pt));
      distinct[pat] = set.size;
      const W13 = patternProfile(list, pat, Lc).W[Lc];
      if (minW) {
        // only fits with weight >= minW were enumerated: posterior masses use the Monte Carlo
        // estimate of the total fitting weight as the denominator
        const mcp = MC[`${variant}|${mode}|${list}|${pat}|0|prior`];
        const sorted = items.slice().sort((a, b) => b.w - a.w);
        const tot = mcp && mcp.hits ? mcp.fraction * W13 : null;
        const ci = mcp ? mcp.ci95.map((x) => x * W13) : null;
        run.patterns[pat].zeroFiller = {
          parsesAboveMinWeight: items.length, distinctStringsAboveMinWeight: set.size, minWeight: minW,
          enumeratedWeight: items.reduce((a, b) => a + b.w, 0), mcTotalFittingWeight: tot, mcTotalFittingWeightCI: ci,
          posteriorFlatTop1: tot ? sorted[0].w / tot : null, posteriorFlatTop10: tot ? sorted.slice(0, 10).reduce((a, b) => a + b.w, 0) / tot : null,
          posteriorFlatTop1Range: ci && ci[1] > 0 ? [sorted[0].w / ci[1], ci[0] > 0 ? sorted[0].w / ci[0] : null] : null,
          topFlat: sorted.slice(0, 10).map((e) => ({ plaintext: e.pt, parts: e.parts, weight: e.w, posterior: tot ? e.w / tot : null })),
        };
        sorted.slice(0, 10).forEach((e, i) => postRows.push([variant, mode, list, pat, 'flat (denominator from MC)', i + 1, e.pt, e.parts, e.w.toExponential(4), tot ? (e.w / tot).toFixed(5) : '']));
        continue;
      }
      for (const it of items) it.lh = mode === 'homophonic' ? Math.exp(logLh(it.pt, V.text, H.h)) : 1;
      // strict (simple-substitution) subset of the homophonic 0-filler fits: an independent
      // derivation of the simple-mode 0-filler results
      let strictSubset = null;
      if (mode === 'homophonic') {
        const strict = items.filter((it) => C.consistent(V.text, it.pt, 'simple')).sort((a, b) => b.w - a.w);
        const S = strict.reduce((a, b) => a + b.w, 0);
        strictSubset = { parses: strict.length, distinctStrings: new Set(strict.map((x) => x.pt)).size, weightSum: S, weightedFraction: S / W13,
          top: strict.slice(0, 5).map((x) => ({ plaintext: x.pt, parts: x.parts, weight: x.w, posterior: x.w / S })) };
      }
      const flat = items.map((it) => ({ x: it.w, it })).sort((a, b) => b.x - a.x);
      const sFlat = postStats(flat);
      const sH = mode === 'homophonic' ? postStats(items.map((it) => ({ x: it.w * it.lh, it })).sort((a, b) => b.x - a.x)) : null;
      run.patterns[pat].zeroFiller = {
        parses: items.length, distinctStrings: set.size,
        evidenceFlat: items.reduce((a, b) => a + b.w, 0) / W13,
        evidenceHomophoneModel: mode === 'homophonic' ? items.reduce((a, b) => a + b.w * b.lh, 0) / W13 : null,
        posteriorFlat: sFlat, posteriorHomophoneModel: sH, strictSubset,
        topFlat: flat.slice(0, 10).map((e) => ({ plaintext: e.it.pt, parts: e.it.parts, weight: e.it.w, posterior: e.post })),
      };
      flat.slice(0, 10).forEach((e, i) => postRows.push([variant, mode, list, pat, 'flat', i + 1, e.it.pt, e.it.parts, e.it.w.toExponential(4), e.post.toFixed(5)]));
      if (sH) {
        const hs = items.map((it) => ({ x: it.w * it.lh, it })).sort((a, b) => b.x - a.x);
        postStats(hs);
        run.patterns[pat].zeroFiller.topHomophoneModel = hs.slice(0, 10).map((e) => ({ plaintext: e.it.pt, parts: e.it.parts, weight: e.it.w, lh: e.it.lh, posterior: e.post }));
        hs.slice(0, 10).forEach((e, i) => postRows.push([variant, mode, list, pat, 'homophone-model', i + 1, e.it.pt, e.it.parts, e.it.w.toExponential(4), e.post.toFixed(5)]));
      }
      for (const it of items) mixture.push({ x: (it.w * (mode === 'homophonic' ? it.lh : 1)) / W13 / patterns.length, it, pat });
    }
    mixture.sort((a, b) => b.x - a.x);
    const sMix = minW ? null : postStats(mixture);
    if (sMix) {
      const byPatMass = {};
      for (const e of mixture) byPatMass[e.pat] = (byPatMass[e.pat] || 0) + e.post;
      run.mixture = { note: 'equal prior on the run patterns, each pattern prior conditioned on length ' + Lc + (mode === 'homophonic' ? '; homophone-model likelihood' : ''), stats: sMix, massByPattern: byPatMass, top: mixture.slice(0, 10).map((e) => ({ plaintext: e.it.pt, parts: e.it.parts, pattern: e.pat, posterior: e.post })) };
      mixture.slice(0, 10).forEach((e, i) => postRows.push([variant, mode, list, 'mixture(' + patterns.join('+') + ')', mode === 'homophonic' ? 'homophone-model' : 'flat', i + 1, e.it.pt, e.it.parts, e.it.w.toExponential(4), e.post.toFixed(5)]));
    }
    runs.push(run);
  }

  const hdr = ['variant', 'mode', 'list', 'pattern', 'fillers', 'enumerated', 'fits', 'name_strings', 'fraction', 'weight_sum', 'prior_weight', 'weighted_fraction', 'fits_boundary3', 'weighted_fraction_boundary3', 'mc_fraction', 'mc_weighted_fraction', 'mc_weighted_hits', 'mc_n', 'fits_estimated_from_mc'];
  const fmt = (x) => (x == null ? '' : typeof x === 'number' && !Number.isInteger(x) ? x.toExponential(4) : String(x));
  fs.writeFileSync(path.join(outDir, 'fit_counts.tsv'), [hdr.join('\t'), ...countRows.map((r) => [r.variant, r.mode, r.list, r.pattern, r.fillers, r.enumerated, r.fits, r.nameStrings, r.fraction, r.weightSum, r.priorWeight, r.weightedFraction, r.fitsBoundary3, r.weightedFractionBoundary3, r.mcFraction, r.mcWeightedFraction, r.mcHits, r.mcN, r.fitsEstimatedFromMC].map(fmt).join('\t'))].join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'posterior_top.tsv'), [['variant', 'mode', 'list', 'pattern', 'likelihood', 'rank', 'plaintext', 'parts', 'prior_weight', 'posterior'].join('\t'), ...postRows.map((r) => r.join('\t'))].join('\n') + '\n');
  const out = {
    tool: 'tools/z13names_stats.js', created: new Date().toISOString(),
    homophoneCounts: { rule: 'h_l = max(1, ceil((Z408 count + Z340 count)/2))', h: Object.fromEntries(Array.from(H.h, (x, i) => [LET[i], x])), z408: H.z408, z340: H.z340 },
    letterFrequencies: { english: 'data/lm/ngram1.bin', names: 'prior-weighted letters of first_male, first_female and surnames' },
    variants, runs,
  };
  fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(out, null, 1));
  console.log(`runs: ${runs.length}; rows: ${countRows.length}`);
  for (const [id, v] of Object.entries(variants)) console.log(id, v.isomorph, JSON.stringify(v.letterBaseline));
}

module.exports = { letterBaseline, logLh, patternProfile };
if (require.main === module) main();
