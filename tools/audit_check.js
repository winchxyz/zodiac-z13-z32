'use strict';
/**
 * tools/audit_check.js - mechanical audit of published Z13 / Z32 proposals.
 *
 * Inputs
 *   results/audit/proposals.json        hand-compiled named proposals (see its description)
 *   results/audit/wiki_z13_entries.tsv  every candidate listed on the Z13 Solutions wiki page
 *   results/audit/enum/*.json + <scratch>/*.tsv   reference enumerations (tools/audit_enum.sh)
 *   results/audit/corpus_ref.json       natural-English null (tools/audit_corpus_ref.js)
 *   results/audit/z32_theme.json        on-theme "radians and inches" null (tools/audit_z32_theme.js)
 *   results/audit/anneal_z32_canonical.json  solver fits for Z32 (tools/anneal.js)
 *
 * For every proposal with a position-by-position plaintext:
 *   - length check; consistency under homophonic and simple substitution with conflict counts
 *     (positional conflicts = fewest positions that must be enciphering slips;
 *      injectivity violations = extra symbols per letter, which simple substitution forbids)
 *   - implied key: symbols per letter, compared with Zodiac's Z408 / Z340 homophone counts
 *     (excess = symbols beyond the larger of the two keys; letters neither key has a symbol for)
 *   - homophone cycling: consecutive occurrences of a letter that has >= 2 homophones in both
 *     solved keys and reuse the same symbol ("cycle breaks"), with a binomial tail against the
 *     reuse rate measured in Z408 + Z340 (written order)
 *   - lm.wordSegment log10 P and its rank among the reference fits of the same variant and mode
 * plus claim-specific tests (key completions, slips, anagram profiles, transposition families,
 * Ziraoui's chain).  Writes results/audit/audit.csv and results/audit/audit_details.json.
 *
 *   node tools/audit_check.js --scratch <dir with the enumeration TSV streams> [--null-names 300] [--null-phrases 1000]
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const C = require('./cipher');
const lm = require('./lm');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const A = path.join(ROOT, 'results', 'audit');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SCRATCH = opt('scratch', null);
const NULL_NAMES = +opt('null-names', 300);
const NULL_PHRASES = +opt('null-phrases', 1000);
const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const log = (...a) => console.error(...a);

/* ------------------------------------------------------------ ciphers */
const VAR = {};
for (const f of fs.readdirSync(path.join(ROOT, 'data/ciphers/variants'))) VAR[f.replace(/\.txt$/, '')] = C.loadCipher(path.join(ROOT, 'data/ciphers/variants', f)).text;
for (const f of fs.readdirSync(path.join(A, 'ciphers'))) VAR[f.replace(/\.txt$/, '')] = C.loadCipher(path.join(A, 'ciphers', f)).text;
VAR['z13.letters_literal'] = VAR['z13.canonical'];

/* ------------------------------------------------------- Zodiac keys */
const Z408 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ciphers/z408.json'), 'utf8'));
const Z340 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ciphers/z340.json'), 'utf8'));
const h408 = {}, h340 = {};
for (const L of LET) { h408[L] = (Z408.key_homophones[L] || []).length; h340[L] = (Z340.key_homophones[L] || []).length; }
const hmax = {}, hmin = {};
for (const L of LET) { hmax[L] = Math.max(h408[L], h340[L]); hmin[L] = Math.min(h408[L], h340[L]); }
const MULTI = new Set(LET.split('').filter((L) => hmin[L] >= 2)); // letters Zodiac always gave several homophones

/** same-symbol reuse rate for consecutive occurrences of letters with >= 2 homophones (key-decoded, written order) */
function reuseRate(ascii, key, homs, range) {
  const last = {};
  let same = 0, n = 0;
  const [a, b] = range || [0, ascii.length];
  for (let i = a; i < b; i++) {
    const s = ascii[i], L = key[s];
    if (!L || (homs[L] || []).length < 2) continue;
    if (last[L] !== undefined) { n++; if (ascii[last[L]] === s) same++; }
    last[L] = i;
  }
  return { same, n, rate: same / n };
}
const z408ascii = Z408.ascii.replace(/\s+/g, ''), z340ascii = Z340.ascii.replace(/\s+/g, '');
const CAL = {
  z408_all: reuseRate(z408ascii, Z408.key, Z408.key_homophones),
  z408_parts12: reuseRate(z408ascii, Z408.key, Z408.key_homophones, [0, 272]),
  z340_written: reuseRate(z340ascii, Z340.key, Z340.key_homophones),
};
CAL.pooled = { same: CAL.z408_all.same + CAL.z340_written.same, n: CAL.z408_all.n + CAL.z340_written.n };
CAL.pooled.rate = CAL.pooled.same / CAL.pooled.n;
const R_REUSE = CAL.pooled.rate;

function lchoose(n, k) { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; }
function binomTail(S, n, r) { let p = 0; for (let k = S; k <= n; k++) p += Math.exp(lchoose(n, k) + k * Math.log(r) + (n - k) * Math.log(1 - r)); return Math.min(1, p); }

/* ------------------------------------------------------- fit checks */
function fit(text, plain) {
  const out = { lengthMatch: plain.length === text.length, cipherLength: text.length, plainLength: plain.length };
  if (!out.lengthMatch) return out;
  const m = new Map();
  for (let i = 0; i < text.length; i++) {
    const s = text[i], L = plain[i];
    if (!m.has(s)) m.set(s, new Map());
    const mm = m.get(s); mm.set(L, (mm.get(L) || 0) + 1);
  }
  let pos = 0; const conflictSyms = []; const key = {};
  for (const [s, mm] of m) {
    let best = null, bc = -1, tot = 0;
    for (const [L, c] of mm) { tot += c; if (c > bc) { bc = c; best = L; } }
    key[s] = best;
    if (mm.size > 1) { pos += tot - bc; conflictSyms.push(`${s}=${[...mm.keys()].join('/')}`); }
  }
  const syms = {}; // letter -> set of symbols (all observed pairs)
  for (let i = 0; i < text.length; i++) { const L = plain[i]; (syms[L] = syms[L] || new Set()).add(text[i]); }
  let inj = 0; for (const L in syms) inj += syms[L].size - 1;
  Object.assign(out, { homConflicts: pos, conflictSymbols: conflictSyms, homOK: pos === 0, injViolations: inj, simpleOK: pos === 0 && inj === 0, key, syms });
  // key comparison with Zodiac
  const occ = {}; for (const L of plain) occ[L] = (occ[L] || 0) + 1;
  let excess = 0; const excessLetters = []; const noSym = [];
  const spl = [];
  for (const L of Object.keys(syms).sort((a, b) => syms[b].size - syms[a].size || a.localeCompare(b))) {
    if (!/[A-Z]/.test(L)) continue;
    const k = syms[L].size;
    spl.push(`${L}:${k}/${occ[L]}`);
    if (hmax[L] === 0) noSym.push(L);
    if (k > hmax[L]) { excess += k - hmax[L]; excessLetters.push(`${L}(${k}>${hmax[L]})`); }
  }
  // cycling: consecutive occurrences of MULTI letters reusing a symbol
  const last = {}; let S = 0, n = 0;
  for (let i = 0; i < plain.length; i++) {
    const L = plain[i];
    if (!MULTI.has(L)) continue;
    if (last[L] !== undefined) { n++; if (text[last[L]] === text[i]) S++; }
    last[L] = i;
  }
  Object.assign(out, { symbolsPerLetter: spl.join(' '), excess, excessLetters, lettersWithoutZodiacSymbol: noSym, cycleBreaks: S, cyclePairs: n, cycleP: n ? binomTail(S, n, R_REUSE) : 1 });
  return out;
}
function cycleBreaks(text, plain) {
  const last = new Int8Array(26).fill(-1); let S = 0;
  for (let i = 0; i < plain.length; i++) {
    const c = plain.charCodeAt(i) - 65;
    if (!MULTI.has(plain[i])) continue;
    if (last[c] >= 0 && text[last[c]] === text[i]) S++;
    last[c] = i;
  }
  return S;
}
function excessOf(text, plain) {
  const syms = {};
  for (let i = 0; i < plain.length; i++) (syms[plain[i]] = syms[plain[i]] || new Set()).add(text[i]);
  let e = 0; for (const L in syms) if (syms[L].size > hmax[L]) e += syms[L].size - hmax[L];
  return e;
}
const onlyLetters = (s) => s.replace(/[^A-Z]/g, '');
const wseg = (s) => { const r = lm.wordSegment(onlyLetters(s)); return { logp: r.logp, words: r.words.join(' '), unknown: r.unknown }; };

/* ------------------------------------------------------- references */
const lowerBound = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= x) lo = m + 1; else hi = m; } return lo; };
function betterThan(sortedAsc, x) { return sortedAsc.length - lowerBound(sortedAsc, x + 1e-9); }

async function loadStream(file, wantCycle, text) {
  const lp = []; const cyc = wantCycle ? new Uint32Array(14) : null; const exc = wantCycle ? new Uint32Array(14) : null;
  if (!fs.existsSync(file)) return null;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    const t = line.indexOf('\t');
    const pt = line.slice(0, t);
    const v = parseFloat(line.slice(t + 1, line.indexOf('\t', t + 1)));
    lp.push(v);
    if (wantCycle) { cyc[Math.min(13, cycleBreaks(text, pt))]++; exc[Math.min(13, excessOf(text, pt))]++; }
  }
  const arr = Float64Array.from(lp).sort();
  return { sorted: arr, cycleHist: cyc ? Array.from(cyc) : null, excessHist: exc ? Array.from(exc) : null };
}
const enumRef = {};
async function getEnum(variant, mode) {
  const k = `${variant}.${mode}`;
  if (k in enumRef) return enumRef[k];
  const js = path.join(A, 'enum', `${k}.json`);
  if (!fs.existsSync(js) || !SCRATCH) { enumRef[k] = null; return null; }
  const J = JSON.parse(fs.readFileSync(js, 'utf8'));
  const text = VAR[variant];
  const st = await loadStream(path.join(SCRATCH, `${k}.tsv`), variant === 'z13.canonical', text);
  enumRef[k] = st && { total: J.counts.consistentStrings, complete: J.counts.complete, streamed: st.sorted.length, minLogp: J.options.minLogp, sorted: st.sorted, cycleHist: st.cycleHist, excessHist: st.excessHist, top: (J.top || []).slice(0, 5).map((t) => t.words) };
  log('loaded enum', k, enumRef[k] && enumRef[k].total);
  return enumRef[k];
}
const CORPUS = fs.existsSync(path.join(A, 'corpus_ref.json')) ? JSON.parse(fs.readFileSync(path.join(A, 'corpus_ref.json'), 'utf8')) : null;
const THEME = fs.existsSync(path.join(A, 'z32_theme.json')) ? JSON.parse(fs.readFileSync(path.join(A, 'z32_theme.json'), 'utf8')) : null;
const ANNEAL_FILE = [path.join(A, 'anneal_z32_canonical.json'), path.join(ROOT, 'results', 'certify_smoke_z32.json')].find((f) => fs.existsSync(f));
const ANNEAL = ANNEAL_FILE ? JSON.parse(fs.readFileSync(ANNEAL_FILE, 'utf8')) : null;
const annealLp = ANNEAL ? Float64Array.from([...new Map(ANNEAL.solutions.map((s) => [s.plaintext, lm.wordSegment(s.plaintext).logp])).values()]).sort() : null;
const _corpusCache = {};
function corpusRef(variant, mode) {
  if (!CORPUS) return null;
  const ck = variant + '|' + mode;
  if (ck in _corpusCache) return _corpusCache[ck];
  let v = variant;
  if (/^z32\.(bar_is_serif_I|t2_is_perp|bar_I_and_t2_perp|tau_distinct)$/.test(v)) v = 'z32.canonical';
  if (v === 'z13.bracket_is_perp' || v === 'z13.letters_literal') v = 'z13.canonical';
  const r = CORPUS.variants[`${v}|${mode}`];
  if (!r) return (_corpusCache[ck] = null);
  const text = VAR[variant];
  const strings = r.stringsSameOrder || [];
  return (_corpusCache[ck] = {
    total: r.distinctConsistent, sorted: Float64Array.from(r.logpSortedAsc), windows: r.windowsTested,
    excess: Int32Array.from(strings.map((x) => excessOf(text, x))).sort(),
    cycle: Int32Array.from(strings.map((x) => cycleBreaks(text, x))).sort(),
    hasStrings: strings.length > 0,
  });
}

/* ------------------------------------------------- special analyses */
/** all completions of the unpinned symbols (homophonic: any letter each), ranked by wordSegment */
function keyCompletions(text, pins, claim) {
  const fixed = Object.fromEntries(C.parseKey(pins));
  const free = [...new Set(text)].filter((s) => !(s in fixed));
  const rows = [];
  const rec = (i, key) => {
    if (i === free.length) {
      const pt = text.split('').map((s) => key[s] || fixed[s]).join('');
      rows.push({ pt, lp: lm.wordSegment(pt).logp });
      return;
    }
    for (const L of LET) { key[free[i]] = L; rec(i + 1, key); }
    delete key[free[i]];
  };
  rec(0, {});
  rows.sort((a, b) => b.lp - a.lp);
  const idx = rows.findIndex((r) => r.pt === claim);
  const lpc = lm.wordSegment(claim).logp;
  return { pins, freeSymbols: free.join(''), completions: rows.length, claimInSet: idx >= 0, claimRank: idx >= 0 ? idx + 1 : null, betterThanClaim: rows.filter((r) => r.lp > lpc + 1e-9).length, top5: rows.slice(0, 5).map((r) => `${r.pt} (${r.lp.toFixed(2)}; ${lm.wordSegment(r.pt).words.join(' ')})`) };
}

/** number of plaintext strings that are permutations of `letters` and fit `text` (mode), by symbol->letter maps */
function anagramFits(text, letters, mode) {
  if (letters.length !== text.length) return { possible: false, count: 0 };
  const cnt = {}; for (const s of text) cnt[s] = (cnt[s] || 0) + 1;
  const syms = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  const have = {}; for (const L of letters) have[L] = (have[L] || 0) + 1;
  let count = 0; const used = new Set();
  const rec = (i) => {
    if (i === syms.length) { count++; return; }
    const need = cnt[syms[i]];
    for (const L of Object.keys(have)) {
      if (have[L] < need) continue;
      if (mode === 'simple' && used.has(L)) continue;
      have[L] -= need; if (mode === 'simple') used.add(L);
      rec(i + 1);
      have[L] += need; if (mode === 'simple') used.delete(L);
    }
  };
  // simple mode: each letter used by exactly one symbol, so a letter's whole count must go to one symbol
  if (mode === 'simple') {
    const prof = Object.values(have).sort((a, b) => b - a).join(',');
    const sprof = Object.values(cnt).sort((a, b) => b - a).join(',');
    if (prof !== sprof) return { possible: false, count: 0 };
  }
  rec(0);
  return { possible: count > 0, count };
}

/** columnar transpositions of width 2..8 (write rows, read columns in any order) and their inverses */
function* columnarOrders(n, wmax = 8) {
  for (let w = 2; w <= wmax; w++) {
    const cols = [...Array(w).keys()];
    const perms = (arr) => { if (arr.length <= 1) return [arr]; const o = []; arr.forEach((x, i) => { for (const p of perms([...arr.slice(0, i), ...arr.slice(i + 1)])) o.push([x, ...p]); }); return o; };
    for (const p of perms(cols)) {
      const order = [];
      for (const c of p) for (let r = 0; r * w + c < n; r++) order.push(r * w + c);
      yield { w, perm: p.join(''), order, dir: 'rows-in/cols-out' };
      const inv = new Array(n); order.forEach((src, k) => { inv[src] = k; });
      yield { w, perm: p.join(''), order: inv, dir: 'cols-in/rows-out' };
    }
  }
}
const _colCache = {};
function columnarFits(text, plain, mode) {
  let n = 0, total = 0; const ex = [];
  const list = _colCache[plain.length] || (_colCache[plain.length] = [...columnarOrders(plain.length)]);
  for (const o of list) {
    total++;
    const t = o.order.map((i) => plain[i]).join('');
    if (C.consistent(text, t, mode)) { n++; if (ex.length < 3) ex.push(`w${o.w} ${o.perm} ${o.dir}: ${t}`); }
  }
  return { fits: n, ordersTried: total, examples: ex };
}

/** Z32 2-row decimation family: line 2 offset s (0..2), col step d (1..16), start col c0, start row r0, both directions */
function z32ReadOrders() {
  const out = [];
  for (let s = 0; s <= 2; s++) for (let d = 1; d <= 16; d++) for (let c0 = 0; c0 < 17; c0++) for (let r0 = 0; r0 < 2; r0++) {
    const order = [];
    for (let k = 0; k < 34; k++) {
      const r = (r0 + k) % 2, c = (c0 + d * k) % 17;
      if (r === 0) order.push(c);
      else { const j = c - s; if (j >= 0 && j < 15) order.push(17 + j); }
    }
    out.push(order, [...order].reverse());
  }
  return out;
}
const _groupCache = new WeakMap();
/** reading-position groups (positions that share a cipher symbol) for each order */
function orderGroups(text, orders) {
  if (_groupCache.has(orders)) return _groupCache.get(orders);
  const G = orders.map((o) => { const g = {}; o.forEach((src, k) => { (g[text[src]] = g[text[src]] || []).push(k); }); return Object.values(g).filter((x) => x.length > 1); });
  _groupCache.set(orders, G);
  return G;
}
function minConflictsOverOrders(text, plain, orders) {
  let best = 99, nle2 = 0;
  const G = orderGroups(text, orders);
  for (const groups of G) {
    let c = 0;
    for (const g of groups) {
      const m = {}; let mx = 0;
      for (const k of g) { const v = (m[plain[k]] || 0) + 1; m[plain[k]] = v; if (v > mx) mx = v; }
      c += g.length - mx;
    }
    if (c < best) best = c;
    if (c <= 2) nle2++;
  }
  return { min: best, ordersWithAtMost2: nle2, orders: orders.length };
}

/** fast checkers compiled from a cipher text */
function compileFit(text) {
  const groups = {}; for (let i = 0; i < text.length; i++) (groups[text[i]] = groups[text[i]] || []).push(i);
  const G = Object.values(groups);
  const hom = (p) => { if (p.length !== text.length) return false; for (const g of G) for (let k = 1; k < g.length; k++) if (p.charCodeAt(g[k]) !== p.charCodeAt(g[0])) return false; return true; };
  const simple = (p) => { if (!hom(p)) return false; let m = 0; for (const g of G) { const b = 1 << (p.charCodeAt(g[0]) - 65); if (m & b) return false; m |= b; } return true; };
  const prof = G.map((g) => g.length).sort((a, b) => b - a).join(',');
  const profile = (p) => { if (p.length !== text.length) return false; const c = new Uint8Array(26); for (let i = 0; i < p.length; i++) c[p.charCodeAt(i) - 65]++; const v = []; for (const x of c) if (x) v.push(x); return v.sort((a, b) => b - a).join(',') === prof; };
  return { hom, simple, profile };
}

/** 13-letter FIRST+LAST names from the top of the name lists */
function nameCombos(firstTop, lastTop, cb) {
  const rd = (f, top) => fs.readFileSync(path.join(ROOT, 'data/names', f), 'latin1').split('\n').filter(Boolean).slice(0, top).map((l) => l.split('\t')[0]);
  const F = rd('first_all.tsv', firstTop), Ls = rd('surnames.tsv', lastTop);
  const byLen = {}; for (const s of Ls) (byLen[s.length] = byLen[s.length] || []).push(s);
  let n = 0;
  for (const f of F) for (const s of byLen[13 - f.length] || []) { n++; cb(f + s); }
  return n;
}

/* ------------------------------------------------------- main */
(async () => {
  const T0 = Date.now();
  const P = JSON.parse(fs.readFileSync(path.join(A, 'proposals.json'), 'utf8')).proposals;
  const wikiRows = fs.readFileSync(path.join(A, 'wiki_z13_entries.tsv'), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => { const [section, contributor, raw, letters] = l.split('\t'); return { section, contributor, raw, letters }; });
  const details = { created: new Date().toISOString(), calibration: { reuse: CAL, multiHomophoneLetters: [...MULTI].join(''), h408, h340 }, special: {} };
  const rows = [];

  async function refCols(variant, f, letters) {
    const z = {};
    const lp = wseg(letters);
    z.logp = lp.logp; z.words = lp.words; z.unknown = lp.unknown;
    const mode = f.simpleOK ? 'simple' : 'homophonic';
    if (variant.startsWith('z13')) {
      for (const m of ['homophonic', 'simple']) {
        const e = await getEnum(variant === 'z13.bracket_is_perp' ? 'z13.canonical' : variant, m);
        if (!e) continue;
        const valid = e.minLogp === null || z.logp >= e.minLogp;
        z[`enum_${m}_total`] = e.total;
        z[`enum_${m}_better`] = valid ? betterThan(e.sorted, z.logp) : null;
        z[`enum_${m}_complete`] = e.complete;
        if (e.cycleHist) { let le = 0; for (let k = 0; k <= Math.min(13, f.cycleBreaks); k++) le += e.cycleHist[k]; z[`enum_${m}_cycle_le`] = le; }
      }
      z.enum_mode_used = mode;
    }
    if (variant.startsWith('z32')) {
      if (THEME && /^z32\.(canonical|triangles_merged)$/.test(variant)) {
        const th = THEME.variants[variant];
        if (th) { const s = Float64Array.from(th.logpSortedDesc).sort(); z.theme_sampled = s.length; z.theme_better = betterThan(s, z.logp); z.theme_est_total = th.estimatedConsistentSequences; z.theme_est_better = Math.round(z.theme_better / Math.max(1, s.length) * th.estimatedConsistentSequences); }
      }
      if (annealLp && /^z32\.(canonical|bar_is_serif_I|t2_is_perp|bar_I_and_t2_perp|tau_distinct)$/.test(variant)) { z.solver_total = annealLp.length; z.solver_better = betterThan(annealLp, z.logp); }
    }
    const cr = corpusRef(variant, 'homophonic');
    if (cr) {
      z.corpus_total = cr.total; z.corpus_better = betterThan(cr.sorted, z.logp);
      if (cr.hasStrings) { z.corpus_excess_le = lowerBound(cr.excess, f.excess); z.corpus_cycle_le = lowerBound(cr.cycle, f.cycleBreaks); }
    }
    return z;
  }

  for (const p of P) {
    const r = { id: p.id, cipher: p.cipher, who: p.who, year: p.year, kind: p.kind, claim: p.claim, aligned: p.aligned || '', variant: p.variant, transcription_changes: p.transcription_changes, extra_dof: (p.extra_dof || []).join('; '), dof_count: (p.extra_dof || []).length, declared_slips: p.declared_slips ?? '', source: p.source };
    if (p.aligned) {
      const text = VAR[p.variant];
      const f = fit(text, p.aligned);
      r.length_ok = f.lengthMatch; r.cipher_len = f.cipherLength; r.plain_len = f.plainLength;
      if (f.lengthMatch) {
        Object.assign(r, { hom_conflicts: f.homConflicts, conflict_symbols: f.conflictSymbols.join(' '), simple_ok: f.simpleOK, injectivity_violations: f.injViolations, symbols_per_letter: f.symbolsPerLetter, excess_vs_zodiac_keys: f.excess, excess_letters: f.excessLetters.join(' '), letters_without_zodiac_symbol: f.lettersWithoutZodiacSymbol.join(''), cycle_breaks: `${f.cycleBreaks}/${f.cyclePairs}`, cycle_p: +f.cycleP.toPrecision(3) });
        if (/^[A-Z]+$/.test(p.aligned)) Object.assign(r, await refCols(p.variant, f, p.aligned));
        else { const w = wseg(p.aligned); r.logp = w.logp; r.words = w.words; r.note = 'contains a non-letter; LM rank not comparable'; }
      } else { const w = wseg(p.aligned); r.logp = w.logp; r.words = w.words; }
    }
    rows.push(r);
  }

  log('[t]', 'named rows done', ((Date.now() - T0) / 1000).toFixed(1));
  /* ---- claim-specific tests ---- */
  const sp = details.special;
  const z13 = VAR['z13.canonical'], z32 = VAR['z32.canonical'];
  sp.garlick_completions = keyCompletions(z13, 'A=D,E=R,N=E,z=A,K=A,M=O', 'DREATATOTPEDO');
  sp.thedecipherist_completions = keyCompletions(z13, 'A=A,E=E,N=N,M=M,z=D,K=S', 'AENDLSLMLCNAM');
  sp.z408key_completions = keyCompletions(z13, 'A=W,E=E,N=E,z=D,K=S,M=H', 'WEEDXSXHXXEWH');
  log('[t]', 'key completions done', ((Date.now() - T0) / 1000).toFixed(1));
  // slips: distinct 1-slip fits at least as good as the 1-conflict claims
  if (SCRATCH) {
    const thr = { ALFREDENEUMAN: lm.wordSegment('ALFREDENEUMAN').logp, DREATATORPEDO: lm.wordSegment('DREATATORPEDO').logp };
    for (const m of ['simple', 'homophonic']) {
      const seen = new Map(); let sumTotals = 0; let complete = true;
      for (const i of ['00', '02', '04', '06', '07', '08', '10', '11', '12']) {
        const js = path.join(A, 'enum', `z13.slip${i}.${m}.json`);
        if (!fs.existsSync(js)) { complete = false; continue; }
        const J = JSON.parse(fs.readFileSync(js, 'utf8')); sumTotals += J.counts.consistentStrings; complete = complete && J.counts.complete;
        const fpath = path.join(SCRATCH, `z13.slip${i}.${m}.tsv`);
        if (!fs.existsSync(fpath)) continue;
        const rl = readline.createInterface({ input: fs.createReadStream(fpath), crlfDelay: Infinity });
        let first = true;
        for await (const line of rl) { if (first) { first = false; continue; } const [pt, v] = line.split('\t'); seen.set(pt, +v); }
      }
      const o = { mode: m, sumOfPerPositionTotals: sumTotals, complete, distinctStreamed: seen.size };
      for (const [k, t] of Object.entries(thr)) o[`atLeastAs_${k}`] = [...seen.values()].filter((v) => v >= t - 1e-9).length;
      o.best = [...seen].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([pt, v]) => `${pt} (${v.toFixed(2)}; ${lm.wordSegment(pt).words.join(' ')})`);
      sp[`slips_${m}`] = o;
    }
    // names with one slip (FIRST INITIAL LAST, homophonic)
    const nm = { totalFits: 0, alfredFound: false, complete: true };
    for (const i of ['00', '02', '04', '06', '07', '08', '10', '11', '12']) {
      const js = path.join(A, 'enum', `names.z13.slip${i}.homophonic.json`);
      if (!fs.existsSync(js)) { nm.complete = false; continue; }
      const J = JSON.parse(fs.readFileSync(js, 'utf8'));
      nm.totalFits += J.counts.fits; nm.complete = nm.complete && J.counts.complete !== false;
      const fpath = path.join(SCRATCH, `names.z13.slip${i}.homophonic.tsv`);
      if (fs.existsSync(fpath) && fs.readFileSync(fpath, 'latin1').includes('ALFREDENEUMAN')) nm.alfredFound = true;
    }
    sp.names_FIL_one_slip_homophonic = nm;
    for (const m of ['simple', 'homophonic']) {
      const js = path.join(A, 'enum', `names.z13.canonical.${m}.json`);
      if (fs.existsSync(js)) { const J = JSON.parse(fs.readFileSync(js, 'utf8')); sp[`names_canonical_${m}`] = { fits: J.counts.fits, perPattern: J.counts.perPattern, complete: J.counts.complete }; }
    }
  }
  log('[t]', 'slips done', ((Date.now() - T0) / 1000).toFixed(1));
  // Baber and Foxon nulls do not depend on the enumerations: cached in special_cache.json
  const CACHE = path.join(A, 'special_cache.json');
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const cacheKey = `names${NULL_NAMES}_phrases${NULL_PHRASES}_corpus${CORPUS ? CORPUS.created : 'none'}`;
  const useCache = cache.key === cacheKey && !args.includes('--no-cache');
  if (useCache) { sp.baber = cache.baber; log('baber from cache'); }
  // Baber: anagram profile and columnar transpositions, against 13-letter FIRST+LAST names
  if (!useCache) {
    const cf = compileFit(z13);
    const prof = []; const direct = []; const directS = []; let hasMM = false;
    const ncomb = nameCombos(3000, 30000, (x) => {
      if (x === 'MARVINMERRILL') hasMM = true;
      if (cf.hom(x)) { direct.push(x); if (cf.simple(x)) directS.push(x); }
      if (cf.profile(x)) prof.push(x);
    });
    const names = { length: ncomb, includes: () => hasMM };
    const rng = makeRng(13, 0x6e616d65);
    const sample = []; const pool = prof.filter((s) => s !== 'MARVINMERRILL');
    for (let i = 0; i < Math.min(NULL_NAMES, pool.length); i++) sample.push(pool[rng.int(pool.length)]);
    const colFit = sample.map((s) => columnarFits(z13, s, 'simple').fits);
    const mm = columnarFits(z13, 'MARVINMERRILL', 'simple');
    sp.baber = {
      nameSpace: 'top 3,000 first names x top 30,000 surnames (data/names), FIRST+LAST with 13 letters',
      combos13: names.length,
      directFitsHomophonic: direct.length, directFitsSimple: directS.length,
      profileMatches: prof.length, marvinMerrillInSpace: names.includes('MARVINMERRILL'), marvinMerrillProfileMatch: anagramFits(z13, 'MARVINMERRILL', 'simple'),
      marvinMerrillColumnar: mm,
      nullSampleSize: sample.length,
      nullShareWithAnyColumnarFit: colFit.filter((x) => x > 0).length / Math.max(1, sample.length),
      nullMeanColumnarFits: colFit.reduce((a, b) => a + b, 0) / Math.max(1, sample.length),
      profileExamples: prof.slice(0, 12),
    };
  }
  log('[t]', 'baber done', ((Date.now() - T0) / 1000).toFixed(1));
  // anagram claims: profile compatibility (any reading order)
  sp.anagram_profile = {};
  for (const s of ['MARVINMERRILL', 'EARLVANBESTJR', 'ALFREDENEUMAN', 'KNICKERBOCKER', 'AINTGONNATELL', 'BOBBEAUSOLEIL', 'JIMMYPHILLIPS', 'FRANKFRAZETTA', 'GRANTSANTIAGO', 'DEBBIEFARADAY', 'LAWRENCEKANEZ', 'ARTHURLEIGHALLEN'.slice(0, 13)]) {
    sp.anagram_profile[s] = { simple: anagramFits(z13, s, 'simple'), homophonic: anagramFits(z13, s, 'homophonic') };
  }
  log('[t]', 'anagram profile done', ((Date.now() - T0) / 1000).toFixed(1));
  // Foxon: 2-row decimation family on the 17+15 layout
  if (useCache) { sp.foxon = cache.foxon; log('foxon from cache'); }
  else {
    const orders = z32ReadOrders();
    const claimsF = { TWELVEINCHESALONGTHETHREERADIANS: null, THREERADIANSANDTWELVEINCHESALONG: null };
    for (const k of Object.keys(claimsF)) claimsF[k] = minConflictsOverOrders(z32, k, orders);
    let nullStats = null;
    if (CORPUS) {
      // random natural-English 32-letter windows (reservoir) as the null
      const res = CORPUS.lengths['32'] && CORPUS.lengths['32'].reservoirStrings;
      if (res) {
        const rng = makeRng(23, 0x666f78);
        const mins = [];
        for (let i = 0; i < Math.min(NULL_PHRASES, res.length); i++) mins.push(minConflictsOverOrders(z32, res[rng.int(res.length)], orders).min);
        nullStats = { n: mins.length, hist: mins.reduce((h, m) => { h[m] = (h[m] || 0) + 1; return h; }, {}) };
      }
    }
    sp.foxon = { family: '2-row grid (17 + 15 with the second line offset 0-2), column step 1-16, start column 0-16, start row 0-1, forward and reversed', orders: orders.length, claims: claimsF, nullMinConflicts: nullStats };
    fs.writeFileSync(CACHE, JSON.stringify({ key: cacheKey, baber: sp.baber, foxon: sp.foxon }));
  }
  log('[t]', 'foxon done', ((Date.now() - T0) / 1000).toFixed(1));
  // Ziraoui Z32 chain
  {
    const k340 = Z340.key;
    const dec = z32.split('').map((s) => k340[s] || '?').join('');
    const digits = (a, b) => dec.slice(a, b).split('').map((c) => ((c.charCodeAt(0) - 64) % 10)).join('');
    const rest = (dec.slice(0, 20) + dec.slice(30)).replace(/\?/g, '');
    const target = 'LABORDAYFINDNORTWEST';
    const cnt = (s) => { const o = {}; for (const c of s) o[c] = (o[c] || 0) + 1; return o; };
    const a = cnt(rest), b = cnt(target); const missing = [], extra = [];
    for (const c of LET) { const d = (b[c] || 0) - (a[c] || 0); if (d > 0) missing.push(`${c}x${d}`); if (d < 0) extra.push(`${c}x${-d}`); }
    sp.ziraoui_z32 = { z340Decode: dec, digitsPos20to24: digits(20, 25), digitsPos25to29: digits(25, 30), claimedDigits: '45609 / 58719', remainingLetters: rest, remainingCount: rest.length, claimLetters: target, claimNeedsNotAvailable: missing, availableNotUsed: extra, droppedSymbols: (dec.match(/\?/g) || []).length };
  }
  // Stampher funnel against the corpus rate
  if (CORPUS) {
    const c = CORPUS.variants['z32.canonical|homophonic'];
    sp.stampher_funnel = { theirRate: 61 / 154572, corpusRate: c.rateConsistentPerWindow, corpusWindows: c.windowsTested, corpusConsistent: c.distinctConsistent, expectedFromCorpusRate: 154572 * c.rateConsistentPerWindow };
  }

  log('[t]', 'ziraoui/stampher done', ((Date.now() - T0) / 1000).toFixed(1));
  /* ---- wiki entries ---- */
  const wik = [];
  let wi = 0;
  for (const w of wikiRows) {
    wi++;
    const id = `W13-${String(wi).padStart(4, '0')}`;
    let variant = 'z13.canonical'; let kind = 'direct';
    if (/8"?s as spaces/.test(w.raw)) variant = 'z13.circles_as_spaces';
    let aligned = w.letters; let tc = variant === 'z13.circles_as_spaces' ? 'circles read as word spaces' : 'none';
    const dof = [];
    if (w.section === 'anagram') { kind = 'anagram'; dof.push('any reading order (anagram)'); }
    if (w.section === 'relaxed') {
      if (/thebigsecrete/i.test(w.raw)) { variant = 'z13.circles_distinct'; tc = 'circles as wildcards (three different symbols)'; dof.push('circles as wildcards', 'misspelling SECRETE'); }
      else if (/DEBBIE FARADAY/i.test(w.raw)) { kind = 'anagram'; dof.push('one name part in the middle, the other split in half and written backwards'); }
      else { kind = 'multi-step'; aligned = ''; dof.push('multi-step (see the named entry: Lafferty Z13-09 / Rembrandt Z13-14)'); }
    }
    if (variant === 'z13.circles_as_spaces') dof.push('three of 13 symbols read as spaces');
    if (/missing/.test(w.raw)) dof.push('misspelling (a letter missing)');
    if (/^Of These Men Tom/i.test(w.raw)) dof.push('alternative split offered');
    const r = { id, cipher: 'Z13', who: w.contributor, year: '', kind, claim: w.raw, aligned, variant, transcription_changes: tc, extra_dof: dof.join('; '), dof_count: dof.length, declared_slips: 0, source: 'https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions (saved copy data/sources/wiki_z13_solutions.html)' };
    if (!aligned) { wik.push(r); continue; }
    const text = VAR[variant];
    const f = fit(text, aligned);
    r.length_ok = f.lengthMatch; r.cipher_len = f.cipherLength; r.plain_len = f.plainLength;
    if (f.lengthMatch) {
      Object.assign(r, { hom_conflicts: f.homConflicts, conflict_symbols: f.conflictSymbols.join(' '), simple_ok: f.simpleOK, injectivity_violations: f.injViolations, symbols_per_letter: f.symbolsPerLetter, excess_vs_zodiac_keys: f.excess, excess_letters: f.excessLetters.join(' '), letters_without_zodiac_symbol: f.lettersWithoutZodiacSymbol.join(''), cycle_breaks: `${f.cycleBreaks}/${f.cyclePairs}`, cycle_p: +f.cycleP.toPrecision(3) });
      Object.assign(r, await refCols(variant, f, aligned));
      if (kind === 'anagram') { const af = anagramFits(text, aligned, 'simple'); const ah = anagramFits(text, aligned, 'homophonic'); r.anagram_fits_simple = af.count; r.anagram_fits_homophonic = ah.count; }
    }
    wik.push(r);
  }

  log('[t]', 'wiki done', ((Date.now() - T0) / 1000).toFixed(1));
  /* ---- verdicts ---- */
  function verdict(r) {
    const k = r.kind;
    if (k === 'no-plaintext') return ['untestable', 'no plaintext published (or not available to us); nothing to check mechanically'];
    if (k === 'demonstration') return ['compatible but indistinguishable from chance', 'a deliberately generated fit, offered as a demonstration of how many fits exist'];
    if (!r.aligned) return ['compatible but indistinguishable from chance', 'no 1:1 reading; the extra steps (' + r.extra_dof + ') are free choices that can produce other outputs; untestable as a decipherment'];
    if (r.length_ok === false) return ['incompatible', `plaintext has ${r.plain_len} letters for ${r.cipher_len} symbols`];
    const slips = +r.declared_slips || 0;
    if (k === 'anagram') {
      if (r.anagram_fits_homophonic === 0) return ['incompatible', 'no reading order lets these letters fit the repeat pattern'];
      return ['compatible but indistinguishable from chance', `fits only under a free reordering; ${r.anagram_fits_simple} simple-substitution orderings of these letters fit, and tens of thousands of names share the letter profile`];
    }
    if (r.hom_conflicts > slips) {
      if (k === 'transposition') return ['incompatible', `as published (written order) needs ${r.hom_conflicts} conflicting positions; the claimed transposition is either unpublished or tested in the special analyses`];
      return ['incompatible', `${r.hom_conflicts} positional conflict(s) (${r.conflict_symbols}) with ${slips} declared`];
    }
    const parts = [];
    if (r.hom_conflicts > 0) parts.push(`needs ${r.hom_conflicts} declared slip(s)`);
    if (r.enum_homophonic_better != null) parts.push(`${r.enum_homophonic_better} of ${r.enum_homophonic_total} homophonic word fits score higher`);
    if (r.enum_simple_better != null) parts.push(r.simple_ok ? `${r.enum_simple_better} of ${r.enum_simple_total} simple word fits score higher` : `at least ${r.enum_simple_better} word fits score higher (counting only the ${r.enum_simple_total} simple-substitution fits; homophonic fits are a superset)`);
    if (r.solver_better != null) parts.push(`${r.solver_better} of ${r.solver_total} solver fits score higher`);
    if (r.theme_est_total != null) parts.push(`~${Number(r.theme_est_total).toExponential(1)} sentences of a small radians/inches grammar fit, ~${Number(r.theme_est_better).toExponential(1)} of them with higher wordSegment log P (${r.theme_better} of ${r.theme_sampled} sampled)`);
    if (r.corpus_better != null) parts.push(`${r.corpus_better} of ${r.corpus_total} consistent natural-English windows score higher`);
    if (r.excess_vs_zodiac_keys > 0) parts.push(`implied key exceeds Zodiac's homophone counts (${r.excess_letters})${r.corpus_excess_le != null ? `; ${r.corpus_excess_le} of ${r.corpus_total} natural-English fits have an excess this small or smaller` : ''}`);
    return ['compatible but indistinguishable from chance', parts.join('; ') || 'fits; no independent evidence'];
  }
  for (const r of rows.concat(wik)) { const [v, why] = verdict(r); r.verdict = v; r.verdict_reason = why; }
  // reference ranks are only meaningful for strings that fit as claimed (allowing declared slips)
  const REF = ['enum_homophonic_total', 'enum_homophonic_better', 'enum_simple_total', 'enum_simple_better', 'enum_homophonic_cycle_le', 'enum_simple_cycle_le', 'theme_est_total', 'theme_sampled', 'theme_better', 'theme_est_better', 'solver_total', 'solver_better', 'corpus_total', 'corpus_better', 'corpus_excess_le', 'corpus_cycle_le'];
  for (const r of rows.concat(wik)) if (r.aligned && (r.length_ok === false || r.hom_conflicts > (+r.declared_slips || 0))) for (const k of REF) delete r[k];
  // manual overrides where a special analysis decides
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  if (byId['Z13-07']) { byId['Z13-07'].verdict = 'incompatible'; byId['Z13-07'].verdict_reason = `direct reading has ${byId['Z13-07'].hom_conflicts} conflicting positions (${byId['Z13-07'].conflict_symbols}); the letter profile matches Z13, so some reading order fits, but ${sp.baber.profileMatches} of ${sp.baber.combos13} FIRST+LAST names in our list match the same profile; the reported grid transposition is unpublished, and none of ${sp.baber.marvinMerrillColumnar.ordersTried} columnar transpositions of width 2-8 (both directions) makes it fit (${sp.baber.marvinMerrillColumnar.fits}), while ${(100 * sp.baber.nullShareWithAnyColumnarFit).toFixed(1)}% of ${sp.baber.nullSampleSize} random profile-matching names fit under at least one`; }
  if (byId['Z13-04']) { byId['Z13-04'].verdict = 'incompatible'; byId['Z13-04'].verdict_reason = `the circle symbol is given three letters (${byId['Z13-04'].conflict_symbols}), and the final 12-letter name is not a permutation of the 13 letters`; }
  const add = (id, txt) => { if (byId[id]) byId[id].verdict_reason = `${txt}; ${byId[id].verdict_reason}`; };
  {
    const g = sp.garlick_completions;
    add('Z13-02', `Z340-key completions of the two free symbols: ${g.betterThanClaim} of ${g.completions} score higher (rank ${g.claimRank}); Z340 key reuse itself is unsupported (5 of 47 shared symbols agree, chance mean 2.64, p ~ 0.12); TOTPEDO is a misspelling`);
    const t = sp.thedecipherist_completions;
    add('Z13-13', `with A,E,N,M literal and z,K from Z408 the two free symbols give ${t.completions} completions, ${t.betterThanClaim} scoring higher (rank ${t.claimRank}); ALLEN comes from an unpublished checksum, not from the string`);
    const ss = sp.slips_simple, nm = sp.names_FIL_one_slip_homophonic;
    const haveSlips = ss && ss.sumOfPerPositionTotals > 0;
    const haveNames = nm && nm.totalFits > 0;
    if (haveSlips) add('Z13-03', `allowing one wrong symbol, ${ss.atLeastAs_DREATATORPEDO} distinct SIMPLE-substitution word fits (<= 4 words, top 20k) score at least as well as DREATATORPEDO${ss.complete ? '' : ' (some slip runs capped; lower bound)'}; the homophonic count is larger still`);
    if (haveSlips || haveNames) add('Z13-01', [haveSlips ? `allowing one wrong symbol, ${ss.atLeastAs_ALFREDENEUMAN} distinct simple-substitution word fits score at least as well${ss.complete ? '' : ' (lower bound)'}` : '', haveNames ? `${nm.totalFits} FIRST INITIAL LAST homophonic name fits exist with one wrong symbol (summed over slip positions; ALFRED E NEUMAN ${nm.alfredFound ? 'is' : 'is not'} among them with our name lists)` : ''].filter(Boolean).join('; '));
    const ap = sp.anagram_profile;
    add('Z13-08', `no letter occurs three times, so no reading order and no homophonic key fits (anagram fits: ${ap.EARLVANBESTJR.homophonic.count})`);
    add('Z13-01', `under any reading order: ${ap.ALFREDENEUMAN.homophonic.count} homophonic anagram fits`);
    const fx = sp.foxon;
    for (const [id, k] of [['Z32-15', 'TWELVEINCHESALONGTHETHREERADIANS'], ['Z32-16', 'THREERADIANSANDTWELVEINCHESALONG']]) {
      const c = fx.claims[k];
      if (!byId[id]) continue;
      let nullTxt = '';
      if (fx.nullMinConflicts) { const h = fx.nullMinConflicts.hist; let le = 0; for (const [m, n] of Object.entries(h)) if (+m <= c.min) le += n; nullTxt = `; ${le} of ${fx.nullMinConflicts.n} random natural-English 32-letter windows reach ${c.min} or fewer conflicts in the same family`; }
      byId[id].verdict = c.min <= 2 ? 'compatible but indistinguishable from chance' : 'incompatible';
      byId[id].verdict_reason = `direct reading: ${byId[id].hom_conflicts} conflicts; best of ${c.orders} two-row decimation orders: ${c.min} conflicts (${c.ordersWithAtMost2} orders with <= 2)${nullTxt}; Foxon's exact order is not reproduced here, and he needs two misspellings`;
    }
    const zr = sp.ziraoui_z32;
    add('Z32-10', `checked: the Z340 key gives ${zr.z340Decode}; units digits of A1Z26 at positions 20-24 / 25-29 give ${zr.digitsPos20to24} / ${zr.digitsPos25to29} (claim 45609 / 58719); the other ${zr.remainingCount} letters need ${zr.claimNeedsNotAvailable.join(' ')} and leave ${zr.availableNotUsed.join(' ')} unused (a letter change) after a free anagram; ${zr.droppedSymbols} symbols dropped`);
    if (sp.stampher_funnel) { const f = sp.stampher_funnel; add('Z32-21', `their own funnel passed 61 of 154,572 phrases through the three repeat locks (1 in ${Math.round(1 / f.theirRate)}); natural-English windows pass at 1 in ${Math.round(1 / f.corpusRate)} (expected ${f.expectedFromCorpusRate.toFixed(0)}), so the locks select at the chance rate and 54 survivors remained`); }
    if (byId['Z13-12'] && byId['Z13-12'].hom_conflicts > 0) { byId['Z13-12'].verdict = 'incompatible'; }
    const kb = byId['Z13-15'];
    if (kb && kb.hom_conflicts === 0) add('Z13-15', 'fits only if the three circles are different symbols (low-plausibility variant)');
  }

  /* ---- write ---- */
  const cols = ['id', 'cipher', 'who', 'year', 'kind', 'claim', 'aligned', 'variant', 'transcription_changes', 'length_ok', 'cipher_len', 'plain_len', 'hom_conflicts', 'conflict_symbols', 'simple_ok', 'injectivity_violations', 'declared_slips', 'symbols_per_letter', 'excess_vs_zodiac_keys', 'excess_letters', 'letters_without_zodiac_symbol', 'cycle_breaks', 'cycle_p', 'extra_dof', 'dof_count', 'logp', 'words', 'unknown', 'enum_mode_used', 'enum_homophonic_total', 'enum_homophonic_better', 'enum_simple_total', 'enum_simple_better', 'enum_homophonic_cycle_le', 'enum_simple_cycle_le', 'theme_est_total', 'theme_sampled', 'theme_better', 'theme_est_better', 'solver_total', 'solver_better', 'corpus_total', 'corpus_better', 'corpus_excess_le', 'corpus_cycle_le', 'anagram_fits_simple', 'anagram_fits_homophonic', 'verdict', 'verdict_reason', 'source'];
  const esc = (v) => { if (v === undefined || v === null) return ''; if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toPrecision(5)); const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const all = rows.concat(wik);
  fs.writeFileSync(path.join(A, 'audit.csv'), cols.join(',') + '\n' + all.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n') + '\n');
  details.named = rows;
  details.wikiSummary = {
    entries: wik.length,
    bySection: wik.reduce((h, r) => { h[r.kind] = (h[r.kind] || 0) + 1; return h; }, {}),
    lengthMismatch: wik.filter((r) => r.length_ok === false).map((r) => r.claim),
    directFitHomophonic: wik.filter((r) => r.kind === 'direct' && r.hom_conflicts === 0).length,
    directFitSimple: wik.filter((r) => r.kind === 'direct' && r.simple_ok).length,
    directWithConflicts: wik.filter((r) => r.kind === 'direct' && r.hom_conflicts > 0).map((r) => `${r.claim} [${r.conflict_symbols}]`),
    verdicts: wik.reduce((h, r) => { h[r.verdict] = (h[r.verdict] || 0) + 1; return h; }, {}),
    bestByLogp: wik.filter((r) => r.hom_conflicts === 0 && r.kind === 'direct').sort((a, b) => b.logp - a.logp).slice(0, 10).map((r) => ({ claim: r.claim, logp: +r.logp.toFixed(2), simple_ok: r.simple_ok, enum_homophonic_better: r.enum_homophonic_better, enum_simple_better: r.enum_simple_better })),
    anagramProfile: wik.filter((r) => r.kind === 'anagram').map((r) => ({ claim: r.claim, simple: r.anagram_fits_simple, homophonic: r.anagram_fits_homophonic })),
  };
  details.references = {};
  for (const [k, e] of Object.entries(enumRef)) if (e) details.references[k] = { total: e.total, complete: e.complete, streamed: e.streamed, minLogp: e.minLogp, top: e.top, cycleHist: e.cycleHist, excessHist: e.excessHist, logpQuantiles: [0.5, 0.9, 0.99, 0.999].map((q) => +e.sorted[Math.floor(q * (e.sorted.length - 1))].toFixed(3)), best: +e.sorted[e.sorted.length - 1].toFixed(3) };
  if (annealLp) details.references.anneal_z32 = { file: path.relative(ROOT, ANNEAL_FILE).split(path.sep).join('/'), options: ANNEAL.options, summary: ANNEAL.summary, distinct: annealLp.length, best: +annealLp[annealLp.length - 1].toFixed(3), median: +annealLp[Math.floor(annealLp.length / 2)].toFixed(3), top: ANNEAL.solutions.slice(0, 5).map((s) => s.words) };
  fs.writeFileSync(path.join(A, 'audit_details.json'), JSON.stringify(details, null, 1));
  log('rows', rows.length, 'wiki', wik.length);
  for (const r of rows) log(r.id, r.verdict, '|', (r.verdict_reason || '').slice(0, 150));
  log(JSON.stringify(details.wikiSummary.verdicts));
})().catch((e) => { console.error(e); process.exit(1); });
