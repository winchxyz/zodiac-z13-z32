'use strict';
/**
 * tools/z13names_suspects.js - test every named Zodiac suspect / proposed person against Z13.
 *
 * For each person it builds every rendering of each of their names (legal name and aliases):
 * full name, full + suffix, F L, F I L, I I L, I L, middle-name-as-first (M L, I M L), surname first
 * (L F, L F M, L F I), and nickname forms (N L, N I L, N M L), plus explicit strings from the
 * literature.  Each rendering is checked against every Z13 variant, in simple and homophonic
 * substitution, with 0-2 free filler letters split between the two ends (the same rule as
 * tools/z13names_enumerate.js --filler-at ends --fillers 2).
 *
 * Null model (permutation / matched-random test): every name part of every person (first, middle,
 * surname, nickname slot) is replaced by a random name of the SAME LENGTH and similar frequency
 * (same 0.5-decade bin of log10 weight in the same list, widened until >= 10 candidates), shared
 * parts stay shared (an alias with the same first name keeps it), and the same renderings are
 * rebuilt.  Statistic: number of persons with >= 1 fitting rendering (and number of fitting
 * renderings), per variant x mode and pooled.  p = (1 + #null >= observed) / (1 + R).
 *
 * Usage: node tools/z13names_suspects.js [--reps 5000] [--seed 1970] [--out results/z13names]
 * Writes: suspects_table.tsv (one row per person x rendering), suspects.json (persons, renderings,
 *         fits, null test), suspects_null.json (null distributions).
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');

const ROOT = path.join(__dirname, '..');

/* ----------------------------------------------------------- the persons */
// slot names: F* first names, M* middle names (first-name list), L* surnames, N* nicknames,
// S* constants (suffixes, kept in the null).  `records` = the person's names (legal first).
// Sources: research/z13_literature.md, Wikipedia "Zodiac Killer suspects" (fetched 2026-10-07),
// and the other pages cited in `src`.
const PERSONS = [
  { id: 'allen', name: 'Arthur Leigh Allen', sex: 'm', cat: 'suspect (police)', src: 'Wikipedia suspects; Graysmith pseudonym Robert Hall Starr',
    slots: { F: 'ARTHUR', M1: 'LEIGH', L: 'ALLEN', N1: 'ART', F2: 'ROBERT', M2: 'HALL', L2: 'STARR', N2: 'BOB' },
    records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1'] }, { label: 'alias Robert Hall Starr (Graysmith)', F: 'F2', M: ['M2'], L: 'L2', N: ['N2'] }] },
  { id: 'best', name: 'Earl Van Best Jr.', sex: 'm', cat: 'suspect (Stewart 2014)', src: 'Wikipedia suspects; Oranchak 2014',
    slots: { F: 'EARL', M1: 'VAN', L: 'BEST', S1: 'JR', L2: 'VANBEST' },
    records: [{ F: 'F', M: ['M1'], L: 'L', S: 'S1' }, { label: 'surname read as Van Best', F: 'F', M: [], L: 'L2', S: 'S1' }] },
  { id: 'bevilacqua', name: 'Giuseppe Bevilacqua', sex: 'm', cat: 'suspect (Amicone 2017)', src: 'Wikipedia suspects',
    slots: { F: 'GIUSEPPE', L: 'BEVILACQUA', N1: 'JOE', F2: 'JOSEPH' },
    records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }, { label: 'anglicised Joseph', F: 'F2', M: [], L: 'L', N: ['N1'] }] },
  { id: 'doerr', name: 'Paul Doerr', sex: 'm', cat: 'suspect (Kobek 2022)', src: 'Wikipedia suspects; research/z13_literature.md',
    slots: { F: 'PAUL', L: 'DOERR' }, records: [{ F: 'F', M: [], L: 'L' }] },
  { id: 'gaikowski', name: 'Richard Gaikowski', sex: 'm', cat: 'suspect (Narlow; Blaine Smith)', src: 'Wikipedia suspects; zodiacciphers.com',
    slots: { F: 'RICHARD', L: 'GAIKOWSKI', N1: 'DICK', N2: 'RICK', S1: 'GYKE' },
    records: [{ F: 'F', M: [], L: 'L', N: ['N1', 'N2'] }], extra: [{ label: 'nickname Gyke + surname', parts: ['S1', 'L'] }] },
  { id: 'kane', name: 'Lawrence Kane', sex: 'm', cat: 'suspect (Hines; Ziraoui)', src: 'Wikipedia suspects ("also spelled Lawrence Kaye")',
    slots: { F: 'LAWRENCE', L: 'KANE', N1: 'LARRY', L2: 'KAYE' },
    records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }, { label: 'alias Lawrence Kaye', F: 'F', M: [], L: 'L2', N: ['N1'] }] },
  { id: 'marshall', name: 'Richard Marshall (Rick Marshall)', sex: 'm', cat: 'suspect (Narlow)', src: 'Wikipedia suspects',
    slots: { F: 'RICHARD', L: 'MARSHALL', N1: 'RICK', N2: 'DICK' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1', 'N2'] }] },
  { id: 'poste', name: 'Gary Francis Poste', sex: 'm', cat: 'suspect (Case Breakers 2021)', src: 'Wikipedia suspects',
    slots: { F: 'GARY', M1: 'FRANCIS', L: 'POSTE' }, records: [{ F: 'F', M: ['M1'], L: 'L' }] },
  { id: 'sullivan', name: 'Ross Sullivan', sex: 'm', cat: 'suspect (Riverside link)', src: 'Wikipedia suspects',
    slots: { F: 'ROSS', L: 'SULLIVAN' }, records: [{ F: 'F', M: [], L: 'L' }] },
  { id: 'manson', name: 'Charles Milles Manson', sex: 'm', cat: 'investigated 1970, eliminated', src: 'Wikipedia suspects (Manson Family)',
    slots: { F: 'CHARLES', M1: 'MILLES', L: 'MANSON', N1: 'CHARLIE', L2: 'MADDOX' },
    records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1'] }, { label: 'birth surname Maddox', F: 'F', M: ['M1'], L: 'L2', N: ['N1'] }] },
  { id: 'davis', name: 'Bruce McGregor Davis', sex: 'm', cat: 'floated (Manson Family member)', src: 'InsideHook / Oxygen summaries',
    slots: { F: 'BRUCE', M1: 'MCGREGOR', L: 'DAVIS' }, records: [{ F: 'F', M: ['M1'], L: 'L' }] },
  { id: 'hoffman', name: 'Richard Hoffman', sex: 'm', cat: 'accused by grandson (TikTok 2024)', src: 'Wikipedia suspects',
    slots: { F: 'RICHARD', L: 'HOFFMAN', N1: 'DICK', N2: 'RICK' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1', 'N2'] }] },
  { id: 'mordecai', name: 'Jim Mordecai', sex: 'm', cat: 'suspected by family', src: 'Wikipedia suspects',
    slots: { F: 'JAMES', L: 'MORDECAI', N1: 'JIM' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }] },
  { id: 'tarrance', name: 'Jack Tarrance', sex: 'm', cat: 'accused by stepson Dennis Kaufman', src: 'Wikipedia suspects',
    slots: { F: 'JACK', L: 'TARRANCE', F2: 'JOHN' }, records: [{ F: 'F', M: [], L: 'L' }, { label: 'Jack as John (assumed formal name)', F: 'F2', M: [], L: 'L', N: [] }] },
  { id: 'hendrickson', name: 'Guy Ward Hendrickson', sex: 'm', cat: 'accused by daughter Deborah Perez (2009)', src: 'press reports 2009',
    slots: { F: 'GUY', M1: 'WARD', L: 'HENDRICKSON' }, records: [{ F: 'F', M: ['M1'], L: 'L' }] },
  { id: 'myers', name: 'Louie (Louis) Joseph Myers', sex: 'm', cat: 'claimed confession (Kennedy/Johnson 2001-02)', src: 'Wikipedia suspects',
    slots: { F: 'LOUIS', M1: 'JOSEPH', L: 'MYERS', N1: 'LOUIE', N2: 'LOU' }, records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1', 'N2'] }] },
  { id: 'bundy', name: 'Theodore Robert Bundy', sex: 'm', cat: 'eliminated 1989', src: 'Wikipedia suspects',
    slots: { F: 'THEODORE', M1: 'ROBERT', L: 'BUNDY', N1: 'TED' }, records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1'] }] },
  { id: 'carpenter', name: 'David Joseph Carpenter', sex: 'm', cat: 'ruled out', src: 'Wikipedia suspects',
    slots: { F: 'DAVID', M1: 'JOSEPH', L: 'CARPENTER', N1: 'DAVE' }, records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1'] }] },
  { id: 'kaczynski', name: 'Theodore John Kaczynski', sex: 'm', cat: 'investigated 1996, eliminated; Oswell Z13 reading', src: 'Wikipedia suspects; Z13 Solutions wiki',
    slots: { F: 'THEODORE', M1: 'JOHN', L: 'KACZYNSKI', N1: 'TED' }, records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1'] }] },
  { id: 'qvale', name: 'Kjell Qvale', sex: 'm', cat: 'accused by Mike Rodelli', src: 'Wikipedia suspects',
    slots: { F: 'KJELL', L: 'QVALE' }, records: [{ F: 'F', M: [], L: 'L' }] },
  { id: 'andrew', name: 'William McDuff Andrew', sex: 'm', cat: 'suggested by Mike Morford (2023)', src: 'Wikipedia suspects',
    slots: { F: 'WILLIAM', M1: 'MCDUFF', L: 'ANDREW', N1: 'BILL' }, records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1'] }] },
  { id: 'margolis', name: 'Marvin Margolis (Marvin Merrill)', sex: 'm', cat: 'Baber 2025 Z13 claim', src: 'Wikipedia suspects; Newsweek; LA Times',
    slots: { F: 'MARVIN', L: 'MARGOLIS', L2: 'MERRILL', N1: 'MARV' },
    records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }, { label: 'alias Marvin Merrill', F: 'F', M: [], L: 'L2', N: ['N1'] }] },
  { id: 'hodel', name: 'George Hill Hodel', sex: 'm', cat: 'suspect (Steve Hodel)', src: 'Steve Hodel books; InsideHook',
    slots: { F: 'GEORGE', M1: 'HILL', L: 'HODEL' }, records: [{ F: 'F', M: ['M1'], L: 'L' }] },
  { id: 'edwards', name: 'Edward Wayne Edwards', sex: 'm', cat: 'suspect (John Cameron)', src: 'InsideHook; Oxygen',
    slots: { F: 'EDWARD', M1: 'WAYNE', L: 'EDWARDS', N1: 'ED', N2: 'EDDIE' }, records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1', 'N2'] }] },
  { id: 'ohare', name: "Michael O'Hare", sex: 'm', cat: 'accused by Gareth Penn (1981-)', src: 'Wikipedia Gareth Penn; zodiackillerfacts.com',
    slots: { F: 'MICHAEL', L: 'OHARE', N1: 'MIKE' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }] },
  { id: 'penn', name: 'Gareth Penn', sex: 'm', cat: 'author; named as a suspect by some researchers', src: 'Wikipedia Gareth Penn',
    slots: { F: 'GARETH', L: 'PENN' }, records: [{ F: 'F', M: [], L: 'L' }] },
  { id: 'grant', name: 'William Joseph Grant (Lafferty suspect)', sex: 'm', cat: 'Lafferty 2012 (NAME GRANT); pseudonyms George Russell Tucker (Lafferty), Andrew Todd Walker (Graysmith)', src: 'research/z13_literature.md; ABC News 2012; zodiacrevisited.com',
    slots: { F: 'WILLIAM', M1: 'JOSEPH', L: 'GRANT', N1: 'BILL', F2: 'GEORGE', M2: 'RUSSELL', L2: 'TUCKER', F3: 'ANDREW', M3: 'TODD', L3: 'WALKER' },
    records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1'] }, { label: 'pseudonym George Russell Tucker', F: 'F2', M: ['M2'], L: 'L2', N: [] }, { label: 'pseudonym Andrew Todd Walker', F: 'F3', M: ['M3'], L: 'L3', N: [] }] },
  { id: 'manalli', name: 'Fred Manalli', sex: 'm', cat: 'suspect named in Oranchak Ep. 11 rebuttal of Ziraoui', src: 'research/z13_literature.md',
    slots: { F: 'FRED', L: 'MANALLI', F2: 'FREDERICK' }, records: [{ F: 'F', M: [], L: 'L' }, { label: 'formal Frederick (assumed)', F: 'F2', M: [], L: 'L' }] },
  { id: 'beausoleil', name: 'Robert Kenneth Beausoleil', sex: 'm', cat: 'Z13 anagram reading (Deb Silva)', src: 'Z13 Solutions wiki',
    slots: { F: 'ROBERT', M1: 'KENNETH', L: 'BEAUSOLEIL', N1: 'BOB', N2: 'BOBBY' }, records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1', 'N2'] }] },
  { id: 'corona', name: 'Juan Vallejo Corona', sex: 'm', cat: 'real killer matching a Z13 Solutions wiki reading (JUAN O CORONA JR)', src: 'Z13 Solutions wiki',
    slots: { F: 'JUAN', M1: 'VALLEJO', L: 'CORONA' }, records: [{ F: 'F', M: ['M1'], L: 'L' }], literal: ['JUANOCORONAJR'] },
  { id: 'kaufman', name: 'Dennis Kaufman', sex: 'm', cat: 'accuser of Jack Tarrance, not a suspect', src: 'Wikipedia suspects',
    slots: { F: 'DENNIS', L: 'KAUFMAN', N1: 'DENNY' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }] },
  { id: 'kauffman_k', name: 'Kenneth Kauffman (as listed in the task brief; no source found)', sex: 'm', cat: 'unverified', src: 'task brief only',
    slots: { F: 'KENNETH', L: 'KAUFFMAN', N1: 'KEN' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }] },
  { id: 'johns', name: 'Kathleen Johns', sex: 'f', cat: 'abduction victim; Graysmith counts her among the claimed ten', src: 'research/z13_literature.md',
    slots: { F: 'KATHLEEN', L: 'JOHNS', N1: 'KATHY' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }] },
  { id: 'neuman', name: 'Alfred E. Neuman (fictional)', sex: 'm', cat: 'Graysmith/Bauer reading', src: 'Bauer, Unsolved! p.182',
    slots: { F: 'ALFRED', M1: 'E', L: 'NEUMAN', N1: 'AL', N2: 'FRED' }, records: [{ F: 'F', M: ['M1'], L: 'L', N: ['N1', 'N2'] }] },
  { id: 'odell', name: 'Andrea J. Odell', sex: 'f', cat: 'T.C. 2025 reading', src: 'zodiacresearch.blogspot.com',
    slots: { F: 'ANDREA', M1: 'J', L: 'ODELL' }, records: [{ F: 'F', M: ['M1'], L: 'L' }] },
  { id: 'shaw', name: 'Ed Shaw', sex: 'm', cat: '"Rembrandt" reading', src: 'Z13 Solutions wiki',
    slots: { F: 'EDWARD', L: 'SHAW', N1: 'ED' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1'] }] },
];

/* ---------------------------------------------------------- name lists */

function readList(file) {
  const m = new Map();
  for (const ln of fs.readFileSync(path.join(ROOT, file), 'latin1').split('\n')) {
    if (!ln.trim()) continue;
    const [n, w] = ln.trim().split('\t');
    if (/^[A-Z]+$/.test(n)) m.set(n, +w);
  }
  return m;
}

/* ------------------------------------------------------------ renderings */

const LETTER = (s) => s[0];

/** Build the renderings of one person from a slot -> string map. Returns [{label, str, parts}]. */
function renderings(p, val) {
  const out = [];
  const seen = new Set();
  const add = (label, parts) => {
    const str = parts.join('');
    if (!/^[A-Z]+$/.test(str)) return;
    if (seen.has(str)) return;
    seen.add(str);
    out.push({ label, str, parts: parts.slice() });
  };
  p.records.forEach((r, ri) => {
    const pre = ri === 0 ? '' : `[${r.label}] `;
    const F = val[r.F], L = val[r.L];
    const Ms = (r.M || []).map((s) => val[s]);
    const Ns = (r.N || []).map((s) => val[s]);
    const S = r.S ? val[r.S] : null;
    add(pre + 'full', [F, ...Ms, L]);
    if (S) add(pre + 'full + suffix', [F, ...Ms, L, S]);
    add(pre + 'F L', [F, L]);
    if (S) add(pre + 'F L + suffix', [F, L, S]);
    add(pre + 'I L', [LETTER(F), L]);
    if (Ms.length) {
      add(pre + 'F I L', [F, LETTER(Ms[0]), L]);
      if (S) add(pre + 'F I L + suffix', [F, LETTER(Ms[0]), L, S]);
      add(pre + 'I I L', [LETTER(F), LETTER(Ms[0]), L]);
      add(pre + 'M L (goes by middle name)', [Ms[0], L]);
      add(pre + 'I M L', [LETTER(F), Ms[0], L]);
      add(pre + 'L F M', [L, F, Ms[0]]);
      add(pre + 'L F I', [L, F, LETTER(Ms[0])]);
    }
    add(pre + 'L F', [L, F]);
    for (const N of Ns) {
      add(pre + 'nickname L', [N, L]);
      if (S) add(pre + 'nickname L + suffix', [N, L, S]);
      if (Ms.length) { add(pre + 'nickname I L', [N, LETTER(Ms[0]), L]); add(pre + 'nickname M L', [N, Ms[0], L]); }
      add(pre + 'L nickname', [L, N]);
    }
  });
  for (const e of p.extra || []) add(e.label, e.parts.map((s) => val[s]));
  return out;
}

/* ------------------------------------------------------------ fit check */

function loadVariants() {
  const V = [
    ['z13.canonical', 'data/ciphers/variants/z13.canonical.txt', ''],
    ['z13.circles_distinct', 'data/ciphers/variants/z13.circles_distinct.txt', ''],
    ['z13.crosshair_null', 'data/ciphers/variants/z13.crosshair_null.txt', ''],
    ['z13.bracket_is_perp', 'data/ciphers/variants/z13.bracket_is_perp.txt', ''],
    ['z13.reversed', 'data/ciphers/variants/z13.reversed.txt', ''],
    ['z13.letters_literal', 'data/ciphers/variants/z13.canonical.txt', 'A=A,E=E,N=N,K=K,M=M'],
  ];
  return V.map(([id, file, pin]) => {
    const ci = C.loadCipher(path.join(ROOT, file));
    const { symbols, idOf, ids } = C.symbolTable(ci.text);
    const fixed = new Int8Array(symbols.length).fill(-1);
    for (const [s, l] of C.parseKey(pin)) if (idOf.has(s)) fixed[idOf.get(s)] = l.charCodeAt(0) - 65;
    return { id, text: ci.text, ids: Int16Array.from(ids), S: symbols.length, fixed, boundary: id === 'z13.crosshair_null' ? 3 : -1 };
  });
}

/**
 * Check rendering string str (with part lengths) against variant v in mode; fillers at the ends.
 * Returns [] or a list of fitting placements {lead, trail, plaintext, boundary}.
 */
const keyBuf = new Int8Array(64), ownBuf = new Int16Array(26);
function fits(v, mode, str, partLens) {
  const Lc = v.ids.length, n = str.length;
  const f = Lc - n;
  if (f < 0 || f > 2) return [];
  const res = [];
  const simple = mode === 'simple';
  for (let lead = 0; lead <= f; lead++) {
    keyBuf.fill(-1, 0, v.S); ownBuf.fill(-1);
    for (let s = 0; s < v.S; s++) if (v.fixed[s] >= 0) { keyBuf[s] = v.fixed[s]; ownBuf[v.fixed[s]] = s; }
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      const s = v.ids[lead + i], l = str.charCodeAt(i) - 65;
      const cur = keyBuf[s];
      if (cur >= 0) { if (cur !== l) ok = false; continue; }
      if (simple) { if (ownBuf[l] >= 0) { ok = false; continue; } ownBuf[l] = s; }
      keyBuf[s] = l;
    }
    if (!ok) continue;
    if (simple) {
      const need = new Set();
      for (let p = 0; p < Lc; p++) if ((p < lead || p >= lead + n) && keyBuf[v.ids[p]] < 0) need.add(v.ids[p]);
      let free = 0;
      for (let l = 0; l < 26; l++) if (ownBuf[l] < 0) free++;
      if (need.size > free) continue;
    }
    let pt = '';
    for (let p = 0; p < Lc; p++) {
      if (p >= lead && p < lead + n) pt += str[p - lead];
      else { const k = keyBuf[v.ids[p]]; pt += k >= 0 ? String.fromCharCode(97 + k) : '?'; }
    }
    let boundary = false;
    if (v.boundary >= 0 && partLens) { let q = lead; for (const pl of partLens) { if (q === v.boundary && q > 0) boundary = true; q += pl; } }
    res.push({ lead, trail: f - lead, plaintext: pt, boundary });
  }
  return res;
}

/* --------------------------------------------------------------- null model */

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Index a list by (length, 0.5-decade bin). */
function indexList(map) {
  const byLen = new Map();
  let minW = Infinity;
  for (const w of map.values()) if (w > 0 && w < minW) minW = w;
  for (const [n, w] of map) {
    const b = Math.floor(Math.log10(Math.max(w, minW)) * 2);
    if (!byLen.has(n.length)) byLen.set(n.length, new Map());
    const m = byLen.get(n.length);
    if (!m.has(b)) m.set(b, []);
    m.get(b).push(n);
  }
  return { map, byLen, minW };
}

/** Candidate pool for a name of this length and weight (same bin, widened to >= 10 names). */
function poolFor(idx, name) {
  const m = idx.byLen.get(name.length);
  if (!m) return null;
  const w = idx.map.get(name) || idx.minW;
  const b = Math.floor(Math.log10(Math.max(w, idx.minW)) * 2);
  for (let r = 0; r <= 40; r++) {
    const pool = [];
    for (let d = -r; d <= r; d++) { const a = m.get(b + d); if (a) pool.push(...a); }
    if (pool.length >= 10 || r === 40) return { pool, bin: b, widen: r, inList: idx.map.has(name) };
  }
  return null;
}

/* --------------------------------------------------------------------- main */

function main() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const reps = +opt('reps', 5000);
  const seed = +opt('seed', 1970);
  const outDir = path.join(ROOT, opt('out', 'results/z13names'));
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();

  const lists = {
    m: { F: indexList(readList('data/names/first_male.tsv')), N: indexList(readList('results/z13names/lists/nick_male.tsv')) },
    f: { F: indexList(readList('data/names/first_female.tsv')), N: indexList(readList('results/z13names/lists/nick_female.tsv')) },
    L: indexList(readList('data/names/surnames.tsv')),
  };
  const variants = loadVariants();
  const modes = ['simple', 'homophonic'];
  const VM = [];
  for (const v of variants) for (const mode of modes) VM.push({ v, mode, key: `${v.id}/${mode}` });

  // slot pools
  const slotInfo = {};
  for (const p of PERSONS) {
    slotInfo[p.id] = {};
    for (const [s, val] of Object.entries(p.slots)) {
      const kind = s[0];
      let idx = null;
      if (kind === 'F' || kind === 'M') idx = lists[p.sex].F;
      else if (kind === 'L') idx = lists.L;
      else if (kind === 'N') idx = lists[p.sex].N;
      if (!idx || val.length === 1) { slotInfo[p.id][s] = { kind, fixed: true }; continue; } // constants, one-letter initials
      let pi = poolFor(idx, val);
      if (!pi || pi.pool.length < 3) { // nickname of an unusual length: fall back to the first-name list
        if (kind === 'N') pi = poolFor(lists[p.sex].F, val);
      }
      slotInfo[p.id][s] = { kind, fixed: false, pool: pi ? pi.pool : [val], bin: pi ? pi.bin : null, widen: pi ? pi.widen : null, inList: pi ? pi.inList : false, poolSize: pi ? pi.pool.length : 1 };
    }
  }

  // observed
  const persons = [];
  const tableRows = [];
  const obs = {};
  for (const k of VM) obs[k.key] = { persons: 0, renderings: 0, persons0: 0 };
  obs.any = { persons: 0, renderings: 0, persons0: 0 };
  for (const p of PERSONS) {
    const rs = renderings(p, p.slots);
    // literature readings that were themselves found by fitting the cipher: reported, never counted
    for (const lit of p.literal || []) rs.push({ label: 'literature reading (fitted post hoc; excluded from the test)', str: lit, parts: [lit], literal: true });
    const pr = { id: p.id, name: p.name, cat: p.cat, src: p.src, renderings: [] };
    const hitVM = new Set(), hitVM0 = new Set();
    for (const r of rs) {
      const row = { label: r.label, str: r.str, len: r.str.length, parts: r.parts.join(' '), fits: {} };
      for (const k of VM) {
        const f = fits(k.v, k.mode, r.str, r.parts.map((x) => x.length));
        if (f.length) {
          row.fits[k.key] = f;
          if (r.literal) continue;
          obs[k.key].renderings++;
          hitVM.add(k.key);
          if (f.some((x) => x.lead + x.trail === 0)) hitVM0.add(k.key);
        }
      }
      if (r.literal) row.excludedFromTest = true;
      else if (Object.keys(row.fits).length) obs.any.renderings++;
      pr.renderings.push(row);
      tableRows.push([p.id, p.name, r.label, r.str, r.str.length, ...VM.map((k) => (row.fits[k.key] ? row.fits[k.key].map((x) => x.plaintext + (x.boundary ? '|B' : '')).join(';') : '')), Object.keys(row.fits).length]);
    }
    for (const k of hitVM) obs[k].persons++;
    for (const k of hitVM0) obs[k].persons0++;
    if (hitVM.size) obs.any.persons++;
    if (hitVM0.size) obs.any.persons0++;
    pr.fitVariantsModes = [...hitVM];
    pr.slots = slotInfo[p.id];
    persons.push(pr);
  }

  // null replicates
  const R = rng(seed);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const nullDist = {};
  for (const k of [...VM.map((x) => x.key), 'any']) nullDist[k] = { persons: new Int32Array(reps), renderings: new Int32Array(reps), persons0: new Int32Array(reps) };
  const perPersonNull = {};
  for (const p of PERSONS) perPersonNull[p.id] = { anyFit: 0, meanFitRenderings: 0 };
  for (let rep = 0; rep < reps; rep++) {
    for (const p of PERSONS) {
      const val = {};
      for (const [s, v] of Object.entries(p.slots)) { const si = slotInfo[p.id][s]; val[s] = si.fixed ? v : pick(si.pool); }
      const rs = renderings(p, val);
      const hitVM = new Set(), hitVM0 = new Set();
      let fitR = 0;
      for (const r of rs) {
        let any = false;
        for (const k of VM) {
          const f = fits(k.v, k.mode, r.str, null);
          if (f.length) {
            nullDist[k.key].renderings[rep]++;
            hitVM.add(k.key);
            if (f.some((x) => x.lead + x.trail === 0)) hitVM0.add(k.key);
            any = true;
          }
        }
        if (any) { nullDist.any.renderings[rep]++; fitR++; }
      }
      for (const k of hitVM) nullDist[k].persons[rep]++;
      for (const k of hitVM0) nullDist[k].persons0[rep]++;
      if (hitVM.size) { nullDist.any.persons[rep]++; perPersonNull[p.id].anyFit++; }
      if (hitVM0.size) nullDist.any.persons0[rep]++;
      perPersonNull[p.id].meanFitRenderings += fitR / reps;
    }
  }
  const test = {};
  for (const k of Object.keys(nullDist)) {
    const o = obs[k];
    test[k] = {};
    for (const stat of ['persons', 'persons0', 'renderings']) {
      const d = nullDist[k][stat];
      let ge = 0, sum = 0;
      for (let i = 0; i < reps; i++) { sum += d[i]; if (d[i] >= o[stat]) ge++; }
      test[k][stat] = { observed: o[stat], nullMean: sum / reps, p: (1 + ge) / (1 + reps) };
    }
  }
  for (const pr of persons) {
    const pn = perPersonNull[pr.id];
    pr.null = { pAnyFitRandomMatched: pn.anyFit / reps, meanFittingRenderings: pn.meanFitRenderings };
    pr.observedFittingRenderings = pr.renderings.filter((r) => !r.excludedFromTest && Object.keys(r.fits).length).length;
    pr.nRenderings = pr.renderings.filter((r) => !r.excludedFromTest).length;
    pr.nRenderingsInLengthRange = pr.renderings.filter((r) => !r.excludedFromTest && r.len >= 10 && r.len <= 13).length;
  }

  const header = ['person_id', 'person', 'rendering', 'string', 'length', ...VM.map((k) => k.key), 'n_variant_modes_fitting'];
  fs.writeFileSync(path.join(outDir, 'suspects_table.tsv'), [header.join('\t'), ...tableRows.map((r) => r.join('\t'))].join('\n') + '\n');
  const out = {
    tool: 'tools/z13names_suspects.js', created: new Date().toISOString(), seed, reps,
    rules: {
      fillers: '0-2 free filler letters split between the two ends (lowercase in plaintext = filler forced by the key, ? = free)',
      boundary: 'z13.crosshair_null only: |B marks a placement with a name-part boundary at position 3 (crosshair read as a divider)',
      null: 'every name slot replaced by a random name of the same length and same 0.5-decade log10-weight bin (widened to >= 10 names) from first_<sex>.tsv, surnames.tsv or nick_<sex>.tsv; constants and one-letter initials kept; same renderings rebuilt',
      statistics: 'persons = number of persons with >= 1 fitting rendering (0-2 fillers); persons0 = same with 0 fillers; renderings = number of fitting renderings',
    },
    variantsModes: VM.map((k) => k.key), observed: obs, test, persons,
    timeSeconds: (Date.now() - t0) / 1000,
  };
  fs.writeFileSync(path.join(outDir, 'suspects.json'), JSON.stringify(out, null, 1));
  const hist = {};
  for (const [k, d] of Object.entries(nullDist)) { hist[k] = {}; for (const stat of Object.keys(d)) { const h = {}; for (const x of d[stat]) h[x] = (h[x] || 0) + 1; hist[k][stat] = h; } }
  fs.writeFileSync(path.join(outDir, 'suspects_null.json'), JSON.stringify({ seed, reps, histograms: hist }, null, 1));
  console.log(JSON.stringify({ observed: obs.any, test: test.any, timeSeconds: out.timeSeconds }, null, 1));
  for (const pr of persons) {
    const fr = pr.renderings.filter((r) => Object.keys(r.fits).length);
    if (fr.length) console.log(pr.id, '|', fr.map((r) => `${r.str} [${Object.keys(r.fits).join(',')}]`).join(' ; '));
  }
}

module.exports = { PERSONS, renderings, fits, loadVariants };
if (require.main === module) main();
