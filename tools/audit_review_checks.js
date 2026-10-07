'use strict';
/**
 * tools/audit_review_checks.js - adversarial review of the task "audit" (results/audit/).
 *
 * Light checks (single thread):
 *  1. fits of the named claims under the alternative Z13 variants (circles_distinct, crosshair_null,
 *     bracket_is_perp), to see whether a claim was judged on the variant its author assumed;
 *  2. recomputed Z340-key / letters-literal completions (Garlick, TheDecipherist);
 *  3. calibration of the fluency criterion against Zodiac's own solved plaintexts (Z408 without its
 *     18-letter unsolved tail, Z340 in reading order): wordSegment log10 P of their 13- and 32-letter
 *     windows, compared with the claims and with the reference distributions the audit used.
 *     Plaintexts are never printed, only numbers;
 *  4. Foxon: the specific Z340-style knight-move order (second line shifted 2, column step 2) and a
 *     null on that single order with the same number of conflicts allowed;
 *  5. homophone-cycling calibration recomputed with the same letter set the candidate test uses;
 *  6. Baber: re-run of the name-profile and columnar null with another seed (--baber).
 * Optional inputs: --simple-stream / --homo-stream = enumerate.js --stream TSVs of z13.canonical
 * (simple / homophonic, top 20,000 words, <= 4 words) to rank claims and Zodiac windows among all fits;
 * --corpus = a corpus_ref.json (default results/audit/corpus_ref.json).
 *
 *   node tools/audit_review_checks.js [--simple-stream F] [--homo-stream F] [--corpus F] [--baber] [--out F]
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const C = require('./cipher');
const lm = require('./lm');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = opt('out', path.join(ROOT, 'results/audit/review/review_checks.json'));
const CORPUS_FILE = opt('corpus', path.join(ROOT, 'results/audit/corpus_ref.json'));
const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const out = { tool: 'tools/audit_review_checks.js', created: new Date().toISOString() };
const ws = (s) => lm.wordSegment(s).logp;
const V = (f) => C.loadCipher(path.join(ROOT, f)).text;
const VAR = {
  'z13.canonical': V('data/ciphers/variants/z13.canonical.txt'),
  'z13.circles_distinct': V('data/ciphers/variants/z13.circles_distinct.txt'),
  'z13.crosshair_null': V('data/ciphers/variants/z13.crosshair_null.txt'),
  'z13.bracket_is_perp': V('data/ciphers/variants/z13.bracket_is_perp.txt'),
  'z32.canonical': V('data/ciphers/variants/z32.canonical.txt'),
};

/** fewest positions that must be slips (homophonic) */
function conflicts(text, plain) {
  if (text.length !== plain.length) return null;
  const m = {};
  for (let i = 0; i < text.length; i++) { (m[text[i]] = m[text[i]] || {}); m[text[i]][plain[i]] = (m[text[i]][plain[i]] || 0) + 1; }
  let c = 0;
  for (const s in m) { const v = Object.values(m[s]); c += v.reduce((a, b) => a + b, 0) - Math.max(...v); }
  return c;
}

/* 1. alternative variants for the Z13 named claims */
const z13claims = {
  'Z13-01 ALFREDENEUMAN': 'ALFREDENEUMAN', 'Z13-02 DREATATOTPEDO': 'DREATATOTPEDO', 'Z13-03 DREATATORPEDO': 'DREATATORPEDO',
  'Z13-04 DREAJALORNEDO': 'DREAJALORNEDO', 'Z13-07 MARVINMERRILL': 'MARVINMERRILL', 'Z13-08 EARLVANBESTJR': 'EARLVANBESTJR',
  'Z13-13 AENDLSLMLCNAM': 'AENDLSLMLCNAM', 'Z13-15 THEBIGSECRETE': 'THEBIGSECRETE', 'Z13-18 SARAHTHEHORSE': 'SARAHTHEHORSE',
};
out.variantFits = {};
for (const [k, p] of Object.entries(z13claims)) {
  const o = {};
  for (const v of ['z13.canonical', 'z13.circles_distinct', 'z13.bracket_is_perp']) o[v] = { conflicts: conflicts(VAR[v], p), hom: C.consistent(VAR[v], p, 'homophonic'), simple: C.consistent(VAR[v], p, 'simple') };
  o.logp = +ws(p).toFixed(3);
  out.variantFits[k] = o;
}
// T.C.'s final name vs the 13 letters
{
  const cnt = (s) => { const o = {}; for (const c of s) o[c] = (o[c] || 0) + 1; return o; };
  const a = cnt('DREAJALORNEDO'), b = cnt('ANDREAJODELL'); const diff = [];
  for (const c of LET) if ((a[c] || 0) !== (b[c] || 0)) diff.push(`${c}:${a[c] || 0}->${b[c] || 0}`);
  out.tc_anagram_letter_diff = diff.join(' ');
}

/* 2. key completions */
function keyCompletions(text, pins, claim) {
  const fixed = Object.fromEntries(C.parseKey(pins));
  const free = [...new Set(text)].filter((s) => !(s in fixed));
  const rows = [];
  const rec = (i, key) => {
    if (i === free.length) { const pt = text.split('').map((s) => key[s] || fixed[s]).join(''); rows.push({ pt, lp: ws(pt) }); return; }
    for (const L of LET) { key[free[i]] = L; rec(i + 1, key); }
    delete key[free[i]];
  };
  rec(0, {});
  const lpc = ws(claim);
  return { completions: rows.length, claimLogp: +lpc.toFixed(3), strictlyHigher: rows.filter((r) => r.lp > lpc + 1e-9).length, rankIfTiesBelow: rows.filter((r) => r.lp > lpc + 1e-9).length + 1 };
}
out.completions = {
  garlick: keyCompletions(VAR['z13.canonical'], 'A=D,E=R,N=E,z=A,K=A,M=O', 'DREATATOTPEDO'),
  thedecipherist: keyCompletions(VAR['z13.canonical'], 'A=A,E=E,N=N,M=M,z=D,K=S', 'AENDLSLMLCNAM'),
};

/* 3. Zodiac's own plaintexts as calibration (never printed) */
const Z408 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ciphers/z408.json'), 'utf8'));
const Z340 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ciphers/z340.json'), 'utf8'));
const p408 = Z408.plaintext.replace(/[^A-Z]/g, '').slice(0, Z408.unsolved_tail.positions[0]);
const p340 = Z340.plaintext.replace(/[^A-Z]/g, '');
function windows(text, L) {
  const all = [];
  for (let i = 0; i + L <= text.length; i++) all.push(text.substr(i, L));
  // word-aligned windows: boundaries from wordSegment of the whole text (approximate for misspelled text)
  const seg = lm.wordSegment(text).words; const ends = new Set([0]); let o = 0;
  for (const w of seg) { o += w.length; ends.add(o); }
  const aligned = [];
  for (const a of ends) if (ends.has(a + L) && a + L <= text.length) aligned.push(text.substr(a, L));
  return { all, aligned };
}
const quant = (arr, qs) => { const s = Float64Array.from(arr).sort(); const o = {}; for (const q of qs) o[q] = s.length ? +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(2) : null; return o; };
const Q = [0.1, 0.25, 0.5, 0.75, 0.9];
const CORPUS = JSON.parse(fs.readFileSync(CORPUS_FILE, 'utf8'));
const z32fits = Float64Array.from(CORPUS.variants['z32.canonical|homophonic'].logpSortedAsc);
const betterThan = (sortedAsc, x) => { let lo = 0, hi = sortedAsc.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sortedAsc[m] <= x + 1e-9) lo = m + 1; else hi = m; } return sortedAsc.length - lo; };
const median = (a) => { const s = Float64Array.from(a).sort(); return s[Math.floor(s.length / 2)]; };
const z32claims = { DMW_Stampher: 'INTHREEANDTHREEEIGHTHSRADIANSTEN', Grinell_InStep: 'ESTIMATEFOURRADIANSANDFIVEINCHES', Cragle: 'THREERADIANSFROMMOUNTAREATWOINCH', Burke: 'OKAYISEVENINSSOUTHOFDIABLOMTPEAK', Foxon_a: 'TWELVEINCHESALONGTHETHREERADIANS' };
out.zodiacCalibration = { note: 'wordSegment log10 P of windows of the solved Zodiac plaintexts (Z408 first 390 letters, Z340 reading order, as enciphered, misspellings kept)' };
for (const L of [32, 13]) {
  const w408 = windows(p408, L), w340 = windows(p340, L);
  const res = {};
  for (const [name, set] of [['all', w408.all.concat(w340.all)], ['wordAligned', w408.aligned.concat(w340.aligned)]]) {
    const lps = set.map(ws);
    const r = { n: set.length, logpQuantiles: quant(lps, Q) };
    if (L === 32) {
      const corpusMedian = median(z32fits);
      r.corpusFitMedian = +corpusMedian.toFixed(2);
      r.shareAboveCorpusFitMedian = +(lps.filter((x) => x > corpusMedian).length / lps.length).toFixed(3);
      r.corpusFitsHigher_quantiles = quant(lps.map((x) => betterThan(z32fits, x)), Q);
      r.corpusFitsTotal = z32fits.length;
      r.shareOfZodiacWindowsScoringAtOrBelowClaim = {};
      for (const [k, s] of Object.entries(z32claims)) { const c = ws(s); r.shareOfZodiacWindowsScoringAtOrBelowClaim[k] = { claimLogp: +c.toFixed(2), share: +(lps.filter((x) => x <= c).length / lps.length).toFixed(3) }; }
    }
    if (L === 13) {
      r.shareOfZodiacWindowsScoringAtOrBelowClaim = {};
      for (const [k, s] of Object.entries(z13claims)) { const c = ws(s); r.shareOfZodiacWindowsScoringAtOrBelowClaim[k] = { claimLogp: +c.toFixed(2), share: +(lps.filter((x) => x <= c).length / lps.length).toFixed(3) }; }
    }
    r._lps = lps;
    res[name] = r;
  }
  out.zodiacCalibration[`L${L}`] = res;
}
// natural-English reservoir of the same lengths (any window, not only fits) for comparison
out.naturalReservoir = {};
for (const L of ['13', '32']) if (CORPUS.lengths[L]) out.naturalReservoir[L] = { n: CORPUS.lengths[L].reservoirSize, logpQuantiles: CORPUS.lengths[L].reservoirLogpQuantiles };

/* 4. Foxon: the specific knight-move order */
function order(s, d, c0, r0) {
  const o = [];
  for (let k = 0; k < 34; k++) { const r = (r0 + k) % 2, c = (c0 + d * k) % 17; if (r === 0) o.push(c); else { const j = c - s; if (j >= 0 && j < 15) o.push(17 + j); } }
  return o;
}
function conflictsUnderOrder(text, plain, o) {
  // plaintext letter k is enciphered by the symbol at written position o[k]
  const g = {};
  o.forEach((src, k) => { (g[text[src]] = g[text[src]] || []).push(k); });
  let c = 0; const detail = [];
  for (const [sym, ks] of Object.entries(g)) {
    if (ks.length < 2) continue;
    const m = {}; for (const k of ks) m[plain[k]] = (m[plain[k]] || 0) + 1;
    const mx = Math.max(...Object.values(m)); c += ks.length - mx;
    if (Object.keys(m).length > 1) detail.push(`${sym}@${ks.join('/')}=${ks.map((k) => plain[k]).join('/')}`);
  }
  return { c, detail };
}
{
  const z32 = VAR['z32.canonical'];
  const fx = { family: 'second line shifted s, column step d, start column c0, start row r0; plaintext letter k sits at written position order[k]' };
  const knight = [];
  for (const s of [0, 1, 2]) for (let c0 = 0; c0 < 17; c0++) for (const r0 of [0, 1]) for (const rev of [false, true]) {
    const o0 = order(s, 2, c0, r0); const o = rev ? [...o0].reverse() : o0;
    knight.push({ s, c0, r0, rev, o });
  }
  const res = fx.claims = {};
  for (const [k, p] of Object.entries({ a: 'TWELVEINCHESALONGTHETHREERADIANS', b: 'THREERADIANSANDTWELVEINCHESALONG' })) {
    const rows = knight.map((K) => ({ s: K.s, c0: K.c0, r0: K.r0, rev: K.rev, ...conflictsUnderOrder(z32, p, K.o) }));
    const start = rows.filter((r) => r.c0 === 0 && r.r0 === 0 && !r.rev);
    res[k] = { knightOrders: rows.length, minConflicts: Math.min(...rows.map((r) => r.c)), histogram: rows.reduce((h, r) => { h[r.c] = (h[r.c] || 0) + 1; return h; }, {}), topLeftForward: start.map((r) => ({ s: r.s, conflicts: r.c, detail: r.detail.join(' ') })) };
  }
  // null on the single most natural order (s=2, d=2, c0=0, r0=0, forward): random natural-English windows
  const res32 = CORPUS.lengths['32'].reservoirStrings;
  const o = order(2, 2, 0, 0);
  const h = {}; for (const w of res32) { const c = conflictsUnderOrder(z32, w, o).c; h[c] = (h[c] || 0) + 1; }
  fx.nullSingleOrder_s2_d2_c0_r0 = { n: res32.length, histogram: h, shareAtMost2: +(((h[0] || 0) + (h[1] || 0) + (h[2] || 0)) / res32.length).toFixed(3) };
  // null over the 204 knight-move orders (s 0-2, any start, both directions)
  let fit0 = 0, le1 = 0;
  for (const w of res32.slice(0, 1000)) { let mn = 9; for (const K of knight) { const c = conflictsUnderOrder(z32, w, K.o).c; if (c < mn) mn = c; if (!mn) break; } if (mn === 0) fit0++; if (mn <= 1) le1++; }
  fx.nullKnightFamily = { orders: knight.length, n: Math.min(1000, res32.length), exactFit: fit0, atMost1: le1 };
  out.foxon = fx;
}

/* 5. homophone cycling, letter set as in the candidate test (>= 2 homophones in BOTH keys) */
{
  const h408 = {}, h340 = {};
  for (const L of LET) { h408[L] = (Z408.key_homophones[L] || []).length; h340[L] = (Z340.key_homophones[L] || []).length; }
  const MULTI = new Set(LET.split('').filter((L) => Math.min(h408[L], h340[L]) >= 2));
  const rr = (ascii, key, set, a, b) => { const last = {}; let same = 0, n = 0; for (let i = a; i < b; i++) { const s = ascii[i], L = key[s]; if (!L || !set(L)) continue; if (last[L] !== undefined) { n++; if (ascii[last[L]] === s) same++; } last[L] = i; } return { same, n, rate: +(same / n).toFixed(4) }; };
  const a408 = Z408.ascii.replace(/\s+/g, ''), a340 = Z340.ascii.replace(/\s+/g, '');
  out.cycling = {
    multiLetters: [...MULTI].join(''),
    sameSetAsTest: { z408_all: rr(a408, Z408.key, (L) => MULTI.has(L), 0, a408.length), z408_first390: rr(a408, Z408.key, (L) => MULTI.has(L), 0, 390), z340_written: rr(a340, Z340.key, (L) => MULTI.has(L), 0, a340.length) },
    perKeySetAsAudit: { z408_all: rr(a408, Z408.key, (L) => h408[L] >= 2, 0, a408.length), z340_written: rr(a340, Z340.key, (L) => h340[L] >= 2, 0, a340.length) },
  };
  const s = out.cycling.sameSetAsTest; out.cycling.sameSetAsTest.pooled = +((s.z408_all.same + s.z340_written.same) / (s.z408_all.n + s.z340_written.n)).toFixed(4);
}

/* 6. Baber re-run with another seed (optional, ~2-3 min) */
function columnarOrders(n, wmax = 8) {
  const res = [];
  const perms = (arr) => { if (arr.length <= 1) return [arr]; const o = []; arr.forEach((x, i) => { for (const p of perms([...arr.slice(0, i), ...arr.slice(i + 1)])) o.push([x, ...p]); }); return o; };
  for (let w = 2; w <= wmax; w++) for (const p of perms([...Array(w).keys()])) {
    const o = []; for (const c of p) for (let r = 0; r * w + c < n; r++) o.push(r * w + c);
    res.push(o); const inv = new Array(n); o.forEach((src, k) => { inv[src] = k; }); res.push(inv);
  }
  return res;
}
if (args.includes('--baber')) {
  const z13 = VAR['z13.canonical'];
  const rd = (f, top) => fs.readFileSync(path.join(ROOT, 'data/names', f), 'latin1').split('\n').filter(Boolean).slice(0, top).map((l) => l.split('\t')[0].trim());
  const F = rd('first_all.tsv', 3000), Ls = rd('surnames.tsv', 30000);
  const prof = (s) => { const c = {}; for (const x of s) c[x] = (c[x] || 0) + 1; return Object.values(c).sort((a, b) => b - a).join(','); };
  const zp = (() => { const c = {}; for (const x of z13) c[x] = (c[x] || 0) + 1; return Object.values(c).sort((a, b) => b - a).join(','); })();
  const byLen = {}; for (const s of Ls) (byLen[s.length] = byLen[s.length] || []).push(s);
  let combos = 0; const pm = []; let hom = 0, simp = 0;
  for (const f of F) for (const s of byLen[13 - f.length] || []) { combos++; const x = f + s; if (prof(x) === zp) pm.push(x); if (C.consistent(z13, x, 'homophonic')) { hom++; if (C.consistent(z13, x, 'simple')) simp++; } }
  const orders = columnarOrders(13);
  const rng = makeRng(2027, 0xbabe);
  const sample = []; for (let i = 0; i < 500; i++) sample.push(pm[rng.int(pm.length)]);
  const fitsAny = sample.filter((x) => orders.some((o) => C.consistent(z13, o.map((i) => x[i]).join(''), 'simple'))).length;
  const mm = orders.filter((o) => C.consistent(z13, o.map((i) => 'MARVINMERRILL'[i]).join(''), 'simple')).length;
  out.baber = { combos13: combos, profileMatches: pm.length, directHomophonic: hom, directSimple: simp, columnarOrders: orders.length, marvinMerrillColumnarFits: mm, nullSample: sample.length, nullShareAnyColumnarFit: +(fitsAny / sample.length).toFixed(4), powerNote: 'share of random profile-matching names that FAIL every columnar order = 1 - nullShareAnyColumnarFit' };
}

/* optional: ranks among the Z13 word fits */
async function loadStream(file) {
  const lp = [];
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) { if (first) { first = false; continue; } const t = line.indexOf('\t'); lp.push(parseFloat(line.slice(t + 1, line.indexOf('\t', t + 1)))); }
  return Float64Array.from(lp).sort();
}
(async () => {
  for (const [mode, f] of [['simple', opt('simple-stream', null)], ['homophonic', opt('homo-stream', null)]]) {
    if (!f || !fs.existsSync(f)) continue;
    const sorted = await loadStream(f);
    const r = { file: path.basename(f), fits: sorted.length, best: +sorted[sorted.length - 1].toFixed(3), median: +sorted[Math.floor(sorted.length / 2)].toFixed(3) };
    r.claims = {}; for (const [k, p] of Object.entries(z13claims)) r.claims[k] = { logp: +ws(p).toFixed(3), fitsScoringHigher: betterThan(sorted, ws(p)) };
    for (const set of ['all', 'wordAligned']) r[`zodiacWindows_${set}_fitsScoringHigher_quantiles`] = quant(out.zodiacCalibration.L13[set]._lps.map((x) => betterThan(sorted, x)), Q);
    out[`z13_${mode}_ranks`] = r;
  }
  for (const L of ['L32', 'L13']) for (const s of ['all', 'wordAligned']) delete out.zodiacCalibration[L][s]._lps;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
