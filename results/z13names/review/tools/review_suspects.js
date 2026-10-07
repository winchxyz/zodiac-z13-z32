'use strict';
/**
 * results/z13names/review/tools/review_suspects.js - adversarial re-check of the z13names suspect test.
 *
 * 1. Independent fit check (tools/cipher.js `consistent` on the kept positions; no code from
 *    tools/z13names_suspects.js except the PERSONS data and the renderings() builder).
 * 2. Extension the attacker did not run: tolerate ONE enciphering slip (the phase-1 pooled slip rate
 *    of 2.19% gives P(>= 1 slip in 13 symbols) ~ 25%). A slip at position p means the symbol written
 *    at p carries no information, so p is simply dropped from the check (like a filler).
 * 3. Extra persons from research/z13_literature.md anagram readings (not fitted to the isomorph):
 *    Jimmy Phillips, Frank Frazetta, Debbie Faraday.
 * 4. Matched-random null (same rule as the attacker: each name slot replaced by a random name of the
 *    same length from the same list and the same 0.5-decade log10-weight bin, widened to >= 10).
 *
 * Usage: node review_suspects.js [--reps 2000] [--seed 4242] [--out results/z13names/review]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const C = require(path.join(ROOT, 'tools', 'cipher.js'));
const S = require(path.join(ROOT, 'tools', 'z13names_suspects.js'));

const EXTRA = [
  { id: 'phillips', name: 'Jimmy Phillips (anagram reading)', sex: 'm', slots: { F: 'JAMES', L: 'PHILLIPS', N1: 'JIMMY', N2: 'JIM' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1', 'N2'] }] },
  { id: 'frazetta', name: 'Frank Frazetta (anagram reading; born Frazzetta)', sex: 'm', slots: { F: 'FRANK', L: 'FRAZETTA', L2: 'FRAZZETTA', F2: 'FRANCIS' }, records: [{ F: 'F', M: [], L: 'L' }, { label: 'birth surname', F: 'F', M: [], L: 'L2' }, { label: 'formal Francis (assumed)', F: 'F2', M: [], L: 'L' }] },
  { id: 'faraday', name: 'Debbie Faraday (anagram reading)', sex: 'f', slots: { F: 'DEBORAH', L: 'FARADAY', N1: 'DEBBIE', N2: 'DEB' }, records: [{ F: 'F', M: [], L: 'L', N: ['N1', 'N2'] }] },
];

const VARS = [
  ['z13.canonical', 'data/ciphers/variants/z13.canonical.txt', ''],
  ['z13.circles_distinct', 'data/ciphers/variants/z13.circles_distinct.txt', ''],
  ['z13.crosshair_null', 'data/ciphers/variants/z13.crosshair_null.txt', ''],
  ['z13.bracket_is_perp', 'data/ciphers/variants/z13.bracket_is_perp.txt', ''],
  ['z13.reversed', 'data/ciphers/variants/z13.reversed.txt', ''],
  ['z13.letters_literal', 'data/ciphers/variants/z13.canonical.txt', 'A=A,E=E,N=N,K=K,M=M'],
].map(([id, f, pin]) => {
  const text = C.loadCipher(path.join(ROOT, f)).text;
  const pins = new Map();
  for (const [s, l] of C.parseKey(pin)) pins.set(s, l);
  return { id, text, pins };
});

/** does `str` fit variant v in mode with fillers at the ends and at most `slips` dropped positions? */
function fitCheck(v, mode, str, slips) {
  const Lc = v.text.length, n = str.length, f = Lc - n;
  if (f < 0 || f > 2) return null;
  const reserved = new Set(v.pins.values());
  for (let lead = 0; lead <= f; lead++) {
    const drops = [[]];
    if (slips >= 1) for (let i = 0; i < n; i++) drops.push([i]);
    for (const d of drops) {
      let cs = '', ps = '', ok = true;
      for (let i = 0; i < n && ok; i++) {
        if (d.includes(i)) continue;
        const sym = v.text[lead + i], L = str[i];
        if (v.pins.has(sym)) { if (v.pins.get(sym) !== L) ok = false; continue; }
        if (mode === 'simple' && reserved.has(L)) { ok = false; continue; }
        cs += sym; ps += L;
      }
      if (!ok) continue;
      if (C.consistent(cs, ps, mode)) return { lead, trail: f - lead, slip: d.length ? d[0] + lead : null };
    }
  }
  return null;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function readList(file) {
  const m = new Map();
  for (const ln of fs.readFileSync(path.join(ROOT, file), 'latin1').split('\n')) { if (!ln.trim()) continue; const [n, w] = ln.trim().split('\t'); if (/^[A-Z]+$/.test(n)) m.set(n, +w); }
  return m;
}
function pool(map, name) {
  let minW = Infinity;
  for (const w of map.values()) if (w > 0 && w < minW) minW = w;
  const bin = (w) => Math.floor(Math.log10(Math.max(w, minW)) * 2);
  const b = bin(map.get(name) || minW);
  const byBin = new Map();
  for (const [n, w] of map) if (n.length === name.length) { const k = bin(w); if (!byBin.has(k)) byBin.set(k, []); byBin.get(k).push(n); }
  for (let r = 0; r <= 40; r++) {
    const p = [];
    for (let d = -r; d <= r; d++) if (byBin.has(b + d)) p.push(...byBin.get(b + d));
    if (p.length >= 10 || r === 40) return p;
  }
  return [name];
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const reps = +opt('reps', 2000), seed = +opt('seed', 4242);
  const outDir = path.join(ROOT, opt('out', 'results/z13names/review'));
  // --exclude: persons who entered the list only through a reading fitted to the cipher
  // (selection bias); default none, so the attacker's set is reproduced
  const exclude = new Set(String(opt('exclude', '')).split(',').filter(Boolean));
  const tagName = opt('tag', exclude.size ? 'excl' : 'all');
  const persons = S.PERSONS.concat(EXTRA).filter((p) => !exclude.has(p.id));
  const lists = { m: { F: readList('data/names/first_male.tsv'), N: readList('results/z13names/lists/nick_male.tsv') }, f: { F: readList('data/names/first_female.tsv'), N: readList('results/z13names/lists/nick_female.tsv') }, L: readList('data/names/surnames.tsv') };
  const pools = {};
  for (const p of persons) {
    pools[p.id] = {};
    for (const [s, val] of Object.entries(p.slots)) {
      const k = s[0];
      if (val.length === 1 || !'FMLN'.includes(k)) { pools[p.id][s] = null; continue; }
      const map = k === 'L' ? lists.L : k === 'N' ? lists[p.sex].N : lists[p.sex].F;
      let pl = pool(map, val);
      if (k === 'N' && pl.length < 3) pl = pool(lists[p.sex].F, val);
      pools[p.id][s] = pl;
    }
  }
  const settings = [];
  for (const v of VARS) for (const mode of ['simple', 'homophonic']) for (const slips of [0, 1]) settings.push({ v, mode, slips, key: `${v.id}/${mode}/slips${slips}` });
  const evalPerson = (p, val) => {
    const rs = S.renderings(p, val);
    const hits = {};
    for (const st of settings) {
      const h = [];
      for (const r of rs) { const f = fitCheck(st.v, st.mode, r.str, st.slips); if (f) h.push({ str: r.str, label: r.label, ...f }); }
      hits[st.key] = h;
    }
    return { n: rs.length, hits };
  };
  // observed
  const obs = {};
  const detail = [];
  for (const st of settings) obs[st.key] = { persons: 0, persons0: 0, personsExtra: 0 };
  for (const p of persons) {
    const e = evalPerson(p, p.slots);
    const extra = EXTRA.includes(p);
    for (const st of settings) {
      const h = e.hits[st.key];
      if (h.length) { obs[st.key].persons++; if (extra) obs[st.key].personsExtra++; detail.push({ person: p.id, setting: st.key, fits: h }); }
      if (h.some((x) => x.lead + x.trail === 0)) obs[st.key].persons0++;
    }
  }
  // literature strings fitted post hoc: report only
  const lit = {};
  for (const s of ['JUANOCORONAJR', 'ALFREDENEUMAN', 'EARLVANBESTJR', 'ARTLEIGHALLEN', 'KATHLEENJOHNS', 'MARVINMERRILL', 'ANDREAJODELL']) {
    lit[s] = settings.filter((st) => fitCheck(st.v, st.mode, s, st.slips)).map((st) => st.key);
  }
  // null
  const R = rng(seed);
  const nul = {};
  for (const st of settings) nul[st.key] = { persons: new Int32Array(reps), persons0: new Int32Array(reps) };
  for (let rep = 0; rep < reps; rep++) {
    for (const p of persons) {
      const val = {};
      for (const [s, v] of Object.entries(p.slots)) { const pl = pools[p.id][s]; val[s] = pl ? pl[Math.floor(R() * pl.length)] : v; }
      const e = evalPerson(p, val);
      for (const st of settings) {
        const h = e.hits[st.key];
        if (h.length) nul[st.key].persons[rep]++;
        if (h.some((x) => x.lead + x.trail === 0)) nul[st.key].persons0[rep]++;
      }
    }
  }
  const test = {};
  for (const st of settings) {
    test[st.key] = {};
    for (const stat of ['persons', 'persons0']) {
      const d = nul[st.key][stat], o = obs[st.key][stat];
      let ge = 0, sum = 0;
      for (const x of d) { sum += x; if (x >= o) ge++; }
      test[st.key][stat] = { observed: o, nullMean: sum / reps, p: (1 + ge) / (1 + reps) };
    }
  }
  const out = { tool: 'results/z13names/review/tools/review_suspects.js', created: new Date().toISOString(), reps, seed, persons: persons.length, excluded: [...exclude], test, literatureStrings: lit, fits: detail };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `suspects_review_${tagName}.json`), JSON.stringify(out, null, 1));
  for (const st of settings) { const t = test[st.key]; if (t.persons.observed || t.persons.nullMean > 0.05) console.log(st.key, JSON.stringify(t)); }
  console.log('literature', JSON.stringify(lit));
  for (const d of detail) console.log(d.person, d.setting, d.fits.map((x) => `${x.str}@lead${x.lead}${x.slip != null ? ' slip' + x.slip : ''}`).join(' ; '));
}

module.exports = { fitCheck };
if (require.main === module) main();
