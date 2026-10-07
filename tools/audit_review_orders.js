'use strict';
/**
 * tools/audit_review_orders.js - review of the transposition analyses in tools/audit_check.js.
 *  A. Foxon: independent re-implementation of the audit's 3,264-order two-row decimation family,
 *     the order(s) that give candidate a zero conflicts, and the audit's random-window null
 *     (same reservoir, same RNG draw) to check "256 of 1,000 fit exactly".
 *  B. Baber: the reported "2x7 grid with keyword" read literally: 13 letters in a 2-row x 7-column
 *     (or 7 x 2) grid with the one blank cell in ANY of the 14 cells, columns read in any order,
 *     top-down or bottom-up, plus the inverse direction; does MARVIN MERRILL fit any of them
 *     (simple substitution), and how often does a random profile-matching name fit?
 *
 *   node tools/audit_review_orders.js [--names 200] [--out results/audit/review/orders.json]
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');
const { makeRng } = require('./solvercore');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const NNAMES = +opt('names', 200);
const OUT = opt('out', path.join(ROOT, 'results/audit/review/orders.json'));
const z32 = C.loadCipher(path.join(ROOT, 'data/ciphers/variants/z32.canonical.txt')).text;
const z13 = C.loadCipher(path.join(ROOT, 'data/ciphers/variants/z13.canonical.txt')).text;
const out = {};

/* A. Foxon */
function famOrders() {
  const o = [];
  for (let s = 0; s <= 2; s++) for (let d = 1; d <= 16; d++) for (let c0 = 0; c0 < 17; c0++) for (let r0 = 0; r0 < 2; r0++) {
    const ord = [];
    for (let k = 0; k < 34; k++) { const r = (r0 + k) % 2, c = (c0 + d * k) % 17; if (r === 0) ord.push(c); else { const j = c - s; if (j >= 0 && j < 15) ord.push(17 + j); } }
    if (new Set(ord).size !== 32 || ord.length !== 32) throw new Error('not a permutation');
    o.push({ s, d, c0, r0, rev: false, ord }, { s, d, c0, r0, rev: true, ord: [...ord].reverse() });
  }
  return o;
}
const conf = (text, plain, ord) => { const g = {}; ord.forEach((src, k) => { (g[text[src]] = g[text[src]] || []).push(k); }); let c = 0; for (const ks of Object.values(g)) { if (ks.length < 2) continue; const m = {}; for (const k of ks) m[plain[k]] = (m[plain[k]] || 0) + 1; c += ks.length - Math.max(...Object.values(m)); } return c; };
{
  const F = famOrders();
  const a = 'TWELVEINCHESALONGTHETHREERADIANS', b = 'THREERADIANSANDTWELVEINCHESALONG';
  const za = F.filter((o) => conf(z32, a, o.ord) === 0).map((o) => `s${o.s} d${o.d} c0=${o.c0} r0=${o.r0}${o.rev ? ' reversed' : ''}`);
  const zb = F.filter((o) => conf(z32, b, o.ord) <= 1).map((o) => `s${o.s} d${o.d} c0=${o.c0} r0=${o.r0}${o.rev ? ' reversed' : ''}`);
  const cor = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/audit/corpus_ref.json'), 'utf8'));
  const res = cor.lengths['32'].reservoirStrings;
  const rng = makeRng(23, 0x666f78);
  const h = {};
  for (let i = 0; i < 1000; i++) { const w = res[rng.int(res.length)]; let mn = 9; for (const o of F) { const c = conf(z32, w, o.ord); if (c < mn) mn = c; if (!mn) break; } h[mn] = (h[mn] || 0) + 1; }
  // how much freedom: distinct constraint sets (pairs of plaintext positions forced equal) in the family
  const sets = new Set(F.map((o) => { const g = {}; o.ord.forEach((src, k) => { (g[z32[src]] = g[z32[src]] || []).push(k); }); return Object.values(g).filter((x) => x.length > 1).map((x) => x.join('-')).sort().join('|'); }));
  out.foxon = { orders: F.length, distinctConstraintSets: sets.size, candidateA_zeroConflictOrders: za, candidateB_atMost1Orders: zb.length, nullSameDrawAsAudit: h };
}

/* B. Baber 2 x 7 grids with the blank anywhere */
function gridOrders(rows, cols) {
  const res = [];
  const perms = (arr) => { if (arr.length <= 1) return [arr]; const o = []; arr.forEach((x, i) => { for (const p of perms([...arr.slice(0, i), ...arr.slice(i + 1)])) o.push([x, ...p]); }); return o; };
  const P = perms([...Array(cols).keys()]);
  for (let blank = 0; blank < rows * cols; blank++) {
    // cell -> plaintext index when written row by row skipping the blank
    const cellIdx = new Array(rows * cols).fill(-1); let k = 0;
    for (let cell = 0; cell < rows * cols; cell++) if (cell !== blank) cellIdx[cell] = k++;
    for (const p of P) for (const up of [false, true]) {
      const ord = [];
      for (const c of p) for (let rr = 0; rr < rows; rr++) { const r = up ? rows - 1 - rr : rr; const v = cellIdx[r * cols + c]; if (v >= 0) ord.push(v); }
      res.push(ord);
      const inv = new Array(13); ord.forEach((src, j) => { inv[src] = j; }); res.push(inv);
    }
  }
  return res;
}
{
  const G = gridOrders(2, 7).concat(gridOrders(7, 2));
  const fits = (s) => G.some((o) => C.consistent(z13, o.map((i) => s[i]).join(''), 'simple'));
  const mmFits = G.filter((o) => C.consistent(z13, o.map((i) => 'MARVINMERRILL'[i]).join(''), 'simple')).length;
  // null: random profile-matching FIRST+LAST names from the same name space as the audit
  const rd = (f, top) => fs.readFileSync(path.join(ROOT, 'data/names', f), 'latin1').split('\n').filter(Boolean).slice(0, top).map((l) => l.split('\t')[0].trim());
  const Fn = rd('first_all.tsv', 3000), Ls = rd('surnames.tsv', 30000);
  const prof = (s) => { const c = {}; for (const x of s) c[x] = (c[x] || 0) + 1; return Object.values(c).sort((p, q) => q - p).join(','); };
  const zp = prof(z13);
  const byLen = {}; for (const s of Ls) (byLen[s.length] = byLen[s.length] || []).push(s);
  const pm = []; for (const f of Fn) for (const s of byLen[13 - f.length] || []) { const x = f + s; if (prof(x) === zp) pm.push(x); }
  const rng = makeRng(77, 0x6772);
  let nf = 0; for (let i = 0; i < NNAMES; i++) if (fits(pm[rng.int(pm.length)])) nf++;
  out.baber2x7 = { orders: G.length, marvinMerrillFits: mmFits, profileMatchingNames: pm.length, nullNames: NNAMES, nullShareFitting: +(nf / NNAMES).toFixed(3) };
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
