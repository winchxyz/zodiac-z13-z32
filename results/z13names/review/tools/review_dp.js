'use strict';
/**
 * results/z13names/review/tools/review_dp.js - INDEPENDENT exact counter for the z13names grid
 * (adversarial review). It shares no search code with tools/z13names_enumerate.js: instead of a
 * trie DFS it runs a dynamic programme over name parts. For every pattern, filler count f (0-2,
 * split between the two ends: lead = 0..f) and split of the name length into part lengths, it
 * walks the parts left to right; the state is (letters of the symbols seen so far that occur again
 * later in the name range, plus - in simple mode - the 26-bit mask of letters already used).
 * Names of one part are grouped by the letters they must have at symbols already fixed by earlier
 * parts, so each state only meets compatible names.
 *
 * Fit rule (the same as the attacker's): homophonic = same symbol -> same letter inside the name
 * range; simple = also different symbols -> different letters; pins fix letters (simple: pinned
 * letters reserved). Filler positions are free (always satisfiable: <= 10 symbols, 26 letters).
 * Weight of a fit = product of part weights; an initial = share of first-list weight by first letter.
 *
 * Usage: node review_dp.js --variant z13.canonical --mode homophonic --list male [--patterns FL,FIL]
 *        [--fillers 0,1,2] [--out file.json]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');

const VARIANTS = {
  'z13.canonical': ['data/ciphers/variants/z13.canonical.txt', ''],
  'z13.circles_distinct': ['data/ciphers/variants/z13.circles_distinct.txt', ''],
  'z13.crosshair_null': ['data/ciphers/variants/z13.crosshair_null.txt', ''],
  'z13.bracket_is_perp': ['data/ciphers/variants/z13.bracket_is_perp.txt', ''],
  'z13.reversed': ['data/ciphers/variants/z13.reversed.txt', ''],
  'z13.letters_literal': ['data/ciphers/variants/z13.canonical.txt', 'A=A,E=E,N=N,K=K,M=M'],
};
const LISTS = {
  male: { first: 'data/names/first_male.tsv', init: 'data/names/first_male.tsv' },
  female: { first: 'data/names/first_female.tsv', init: 'data/names/first_female.tsv' },
  nick_male: { first: 'results/z13names/lists/nick_male.tsv', init: 'data/names/first_male.tsv' },
  nick_female: { first: 'results/z13names/lists/nick_female.tsv', init: 'data/names/first_female.tsv' },
};

function readText(file) {
  // one-line variant file, whitespace stripped
  return fs.readFileSync(path.join(ROOT, file), 'latin1').replace(/\s+/g, '');
}

function readList(file, maxLen) {
  const best = new Map();
  for (const ln of fs.readFileSync(path.join(ROOT, file), 'latin1').split('\n')) {
    if (!ln.trim()) continue;
    const t = ln.indexOf('\t');
    const w = (t < 0 ? ln : ln.slice(0, t)).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(w) || w.length > maxLen) continue;
    const v = t < 0 ? 1 : +ln.slice(t + 1);
    if (!best.has(w) || best.get(w) < v) best.set(w, v);
  }
  const byLen = [];
  for (let l = 0; l <= maxLen; l++) byLen.push([]);
  for (const [w, v] of best) byLen[w.length].push({ codes: Array.from(w, (c) => c.charCodeAt(0) - 65), w: v, s: w });
  return byLen;
}

function initWeights(file) {
  const iw = new Float64Array(26);
  let tot = 0;
  for (const ln of fs.readFileSync(path.join(ROOT, file), 'latin1').split('\n')) {
    if (!ln.trim()) continue;
    const t = ln.indexOf('\t');
    const w = (t < 0 ? ln : ln.slice(0, t)).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(w)) continue;
    const v = t < 0 ? 1 : +ln.slice(t + 1);
    iw[w.charCodeAt(0) - 65] += v; tot += v;
  }
  for (let l = 0; l < 26; l++) iw[l] /= tot;
  return iw;
}

function splitsOf(pattern, n) {
  const out = [];
  const rec = (i, rem, acc) => {
    if (i === pattern.length) { if (rem === 0) out.push(acc.slice()); return; }
    for (let l = 1; l <= rem; l++) {
      if (pattern[i] === 'I' && l !== 1) continue;
      acc.push(l); rec(i + 1, rem - l, acc); acc.pop();
    }
  };
  rec(0, n, []);
  return out;
}

/**
 * Count fits of names (pattern, part lengths) against sub-cipher `sub` (array of symbol chars).
 * pins: Map symbol -> letter index. Returns {n, w}.
 */
function countSplit(sub, pins, mode, pattern, lens, lists) {
  const simple = mode === 'simple';
  const n = sub.length;
  const starts = [];
  let p = 0;
  for (const l of lens) { starts.push(p); p += l; }
  let reservedMask = 0;
  if (simple) for (const l of pins.values()) reservedMask |= 1 << l;
  // symbols seen before position x, symbols occurring at/after position x
  const firstPos = new Map();
  sub.forEach((s, i) => { if (!firstPos.has(s)) firstPos.set(s, i); });
  const lastPos = new Map();
  sub.forEach((s, i) => lastPos.set(s, i));
  // state symbols after part k: non-pinned symbols with firstPos < end_k and lastPos >= end_k
  let states = new Map(); // key -> {n, w}
  let stateSyms = [];
  states.set(0, { n: 1, w: 1 });
  for (let k = 0; k < lens.length; k++) {
    const s0 = starts[k], e0 = s0 + lens[k];
    const partSyms = sub.slice(s0, e0);
    // incoming: non-pinned symbols in this part with firstPos < s0  (all are in stateSyms)
    const incoming = [...new Set(partSyms)].filter((s) => !pins.has(s) && firstPos.get(s) < s0);
    const inIdx = incoming.map((s) => stateSyms.indexOf(s));
    if (inIdx.some((x) => x < 0)) throw new Error('state bookkeeping error');
    const nextSyms = [...new Set(sub.slice(0, e0))].filter((s) => !pins.has(s) && lastPos.get(s) >= e0);
    // candidate names for this part
    const t = pattern[k];
    let cands;
    if (t === 'I') { cands = []; for (let l = 0; l < 26; l++) if (lists.initW[l] > 0) cands.push({ codes: [l], w: lists.initW[l] }); }
    else cands = (t === 'L' ? lists.L : lists.F)[lens[k]] || [];
    // group candidates by incoming letters
    const groups = new Map();
    for (const c of cands) {
      // internal consistency + pins
      const m = new Map();
      let ok = true;
      for (let j = 0; j < lens[k] && ok; j++) {
        const s = partSyms[j], l = c.codes[j];
        if (pins.has(s)) { if (pins.get(s) !== l) ok = false; continue; }
        if (m.has(s)) { if (m.get(s) !== l) ok = false; } else m.set(s, l);
      }
      if (!ok) continue;
      let newMask = 0;
      if (simple) {
        // new symbols (first seen in this part) need distinct letters, not reserved
        const used = new Set();
        for (const [s, l] of m) {
          if (firstPos.get(s) >= s0) {
            if (used.has(l) || (reservedMask >> l) & 1) { ok = false; break; }
            used.add(l); newMask |= 1 << l;
          }
        }
        if (!ok) continue;
        // a new symbol may not take the letter of an incoming symbol (checked against state mask later)
      }
      let inKey = 0;
      for (const s of incoming) inKey = inKey * 32 + m.get(s);
      // outgoing letters contributed by this part for nextSyms that are new here
      const contrib = nextSyms.map((s) => (m.has(s) && firstPos.get(s) >= s0 ? m.get(s) : -1));
      if (!groups.has(inKey)) groups.set(inKey, []);
      groups.get(inKey).push({ newMask, contrib, w: c.w });
    }
    const nextIdxPrev = nextSyms.map((s) => stateSyms.indexOf(s));
    const next = new Map();
    for (const [key, st] of states) {
      // decode state
      let mask = 0, rest = key;
      if (simple) { mask = rest % 67108864; rest = Math.floor(rest / 67108864); }
      const letters = new Array(stateSyms.length);
      for (let i = stateSyms.length - 1; i >= 0; i--) { letters[i] = rest % 32; rest = Math.floor(rest / 32); }
      let need = 0;
      for (const i of inIdx) need = need * 32 + letters[i];
      const g = groups.get(need);
      if (!g) continue;
      for (const c of g) {
        if (simple && (c.newMask & mask)) continue;
        let nk = 0;
        for (let j = 0; j < nextSyms.length; j++) nk = nk * 32 + (c.contrib[j] >= 0 ? c.contrib[j] : letters[nextIdxPrev[j]]);
        if (simple) nk = nk * 67108864 + ((mask | c.newMask) >>> 0);
        const cur = next.get(nk);
        if (cur) { cur.n += st.n; cur.w += st.w * c.w; } else next.set(nk, { n: st.n, w: st.w * c.w });
      }
    }
    states = next;
    stateSyms = nextSyms;
    if (!states.size) return { n: 0, w: 0 };
  }
  let N = 0, W = 0;
  for (const st of states.values()) { N += st.n; W += st.w; }
  return { n: N, w: W };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const vid = opt('variant', 'z13.canonical');
  const mode = opt('mode', 'homophonic');
  const lname = opt('list', 'male');
  const [file, pin] = VARIANTS[vid];
  const text = readText(file);
  const Lc = text.length;
  const pins = new Map();
  for (const kv of pin.split(',').filter(Boolean)) { const [s, l] = kv.split('='); pins.set(s, l.charCodeAt(0) - 65); }
  const L = LISTS[lname];
  const lists = { F: readList(L.first, Lc), L: readList('data/names/surnames.tsv', Lc), initW: initWeights(L.init) };
  const patterns = opt('patterns', lname.startsWith('nick') ? 'FL,FIL' : 'FL,FIL,FML,FIIL,IIL,LF').split(',');
  const fillers = opt('fillers', '0,1,2').split(',').map(Number);
  const t0 = Date.now();
  const cells = {};
  // crosshair read as a word divider: also count fits with a part starting at absolute position 3
  const boundary = vid === 'z13.crosshair_null' ? 3 : -1;
  for (const pat of patterns) for (const f of fillers) {
    const nlen = Lc - f;
    let N = 0, W = 0, NB = 0, WB = 0;
    const byLead = {};
    for (let lead = 0; lead <= f; lead++) {
      const sub = Array.from(text.slice(lead, lead + nlen));
      let n = 0, w = 0;
      for (const sp of splitsOf(pat, nlen)) {
        const r = countSplit(sub, pins, mode, pat, sp, lists);
        n += r.n; w += r.w;
        if (boundary >= 0) { let q = lead, hit = false; for (const l of sp) { if (q === boundary && q > 0) hit = true; q += l; } if (hit) { NB += r.n; WB += r.w; } }
      }
      byLead[lead] = { n, w };
      N += n; W += w;
    }
    cells[`${pat}|${f}`] = { n: N, sw: W, byLead };
    if (boundary >= 0) Object.assign(cells[`${pat}|${f}`], { nb: NB, swb: WB });
    process.stderr.write(`${vid} ${mode} ${lname} ${pat} f=${f}: ${N} (${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
  }
  const res = { tool: 'results/z13names/review/tools/review_dp.js', variant: vid, mode, list: lname, Lc, cells, seconds: (Date.now() - t0) / 1000 };
  const out = opt('out', null);
  if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res, null, 1)); }
  console.log(JSON.stringify(res));
}

module.exports = { countSplit, splitsOf, readList, initWeights };
if (require.main === module) main();
