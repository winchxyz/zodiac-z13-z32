'use strict';
/**
 * tools/z32search_grammar_count.js - fast exact counting / listing engine for
 * tools/z32search_grammar.js (integer DP states; length-reachability pruning for listing).
 *
 *   const E = require('./z32search_grammar_count');
 *   const F = E.prepForms(G.forms());           // grammar forms, letters only
 *   E.countForm(F[0], pairs)                     // number of derivations of exactly 32 letters satisfying the pairs
 *   E.listFits(F[0], pairs, map, limit)          // distinct strings -> example tokens
 */
const G = require('./z32search_grammar_lib');
const L = 32;

function prepForms(forms) {
  return forms.map((form) => {
    const slots = form.slots.map((sl) => {
      const set = new Set();
      for (const it of sl.items) { const s = G.letters(it.s); if (s.length <= L) set.add(s); }
      const strings = [...set];
      const byLen = new Map();
      for (const s of strings) { if (!byLen.has(s.length)) byLen.set(s.length, []); byLen.get(s.length).push(s); }
      return { name: sl.name, strings, byLen: [...byLen], cache: new Map() };
    });
    // reach[i] = Set of total lengths achievable by slots i..end
    const reach = new Array(slots.length + 1);
    reach[slots.length] = new Set([0]);
    for (let i = slots.length - 1; i >= 0; i--) {
      const r = new Set();
      for (const [len] of slots[i].byLen) for (const x of reach[i + 1]) if (len + x <= L) r.add(len + x);
      reach[i] = r;
    }
    return { id: form.id, desc: form.desc, slots, reach };
  });
}

/** pairs: disjoint [a,b] with a<b (at most 3). */
function roles(pairs) {
  const k = new Int8Array(L).fill(-1), first = new Uint8Array(L), partner = new Int8Array(L).fill(-1);
  pairs.forEach(([a, b], i) => { k[a] = i; k[b] = i; first[a] = 1; partner[a] = b; partner[b] = a; });
  return { k, first, partner };
}

const NONE = 26;
// state = off * 27^3 + p0 * 729 + p1 * 27 + p2   (p = pending letter of pair i, 26 = none)
function countForm(F, pairs) {
  if (pairs.length > 3) throw new Error('countForm: at most 3 pairs');
  const R = roles(pairs);
  const P3 = 19683;
  let states = new Map([[0 * P3 + NONE * 729 + NONE * 27 + NONE, 1]]);
  for (let si = 0; si < F.slots.length; si++) {
    const sl = F.slots[si];
    const reachNext = F.reach[si + 1];
    const next = new Map();
    for (const [key, cnt] of states) {
      const off = Math.floor(key / P3);
      let rest = key - off * P3;
      const pend = [Math.floor(rest / 729), Math.floor((rest % 729) / 27), rest % 27];
      for (const [len, strs] of sl.byLen) {
        const end = off + len;
        if (end > L || !reachNext.has(L - end)) continue;
        const rel = [];
        for (let p = off; p < end; p++) if (R.k[p] >= 0) rel.push(p - off);
        if (!rel.length) { const nk = end * P3 + (key - off * P3); next.set(nk, (next.get(nk) || 0) + cnt * strs.length); continue; }
        const ck = len * 1000003 + rel.reduce((a, r) => a * 33 + r + 1, 0);
        let grp = sl.cache.get(ck);
        if (!grp) {
          const m = new Map();
          for (const s of strs) { let g = 0; for (const r of rel) g = g * 26 + (s.charCodeAt(r) - 65); m.set(g, (m.get(g) || 0) + 1); }
          grp = [];
          for (const [g, c] of m) { const codes = new Array(rel.length); let x = g; for (let t = rel.length - 1; t >= 0; t--) { codes[t] = x % 26; x = Math.floor(x / 26); } grp.push([codes, c]); }
          sl.cache.set(ck, grp);
        }
        for (const [codes, c] of grp) {
          const pa = pend.slice();
          let ok = true;
          for (let t = 0; t < rel.length; t++) {
            const p = off + rel[t], i = R.k[p], ch = codes[t];
            if (R.first[p]) pa[i] = ch;
            else {
              const q = R.partner[p];
              const want = q < off ? pend[i] : codes[rel.indexOf(q - off)];
              if (want !== ch) { ok = false; break; }
              pa[i] = NONE;
            }
          }
          if (!ok) continue;
          const nk = end * P3 + pa[0] * 729 + pa[1] * 27 + pa[2];
          next.set(nk, (next.get(nk) || 0) + cnt * c);
        }
      }
    }
    states = next;
  }
  let total = 0;
  for (const [key, cnt] of states) if (Math.floor(key / P3) === L) total += cnt;
  return total;
}

/** DFS listing with length reachability and constraint pruning. Returns derivations visited. */
function listFits(F, pairs, out, limit) {
  const R = roles(pairs);
  const buf = new Array(L);
  const toks = [];
  let n = 0;
  const rec = (si, off) => {
    if (out.size >= limit) return;
    if (si === F.slots.length) {
      if (off !== L) return;
      n++;
      const s = buf.join('');
      if (!out.has(s)) out.set(s, { form: F.id, tokens: toks.filter(Boolean).join(' ') });
      return;
    }
    const reachNext = F.reach[si + 1];
    for (const [len, strs] of F.slots[si].byLen) {
      const end = off + len;
      if (end > L || !reachNext.has(L - end)) continue;
      for (const s of strs) {
        let ok = true;
        for (let i = 0; i < len; i++) {
          const p = off + i;
          buf[p] = s[i];
          if (R.k[p] >= 0 && !R.first[p] && buf[R.partner[p]] !== s[i]) { ok = false; break; }
        }
        if (!ok) continue;
        toks.push(s);
        rec(si + 1, end);
        toks.pop();
      }
    }
  };
  rec(0, 0);
  return n;
}

module.exports = { prepForms, countForm, listFits, L };
