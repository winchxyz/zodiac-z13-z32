'use strict';
/**
 * tools/lead_torpedo_fit.js - fluency-free look-elsewhere for the `torpedo` task: how often does a random
 * key's Z13 template ADMIT a theme word at all?
 *
 * For a key, the template is Z13 with the six shared symbols pinned (real Z340 key: DREA?A?O??EDO).
 * A word w fits at offset p
 *   circles   (z13.circles_distinct): if every pinned letter under w equals w's letter (free positions
 *             4, 6, 8, 9 take anything);
 *   canonical (one circle symbol):    as above, and w's letters on the circle positions 4, 6, 8 must agree.
 * We record the minimum number of letter substitutions needed (0 = exact fit; TOTPEDO for TORPEDO is 1),
 * so that "a one-letter misspelling is acceptable" (the allowance in Garlick's published reading) can be
 * priced too.
 *
 * Null keys: the same generators and seeds as tools/lead_torpedo_null.js (permute: makeRng(1970, 1001);
 * stratified: makeRng(1971, 5001)); --n keys of each kind (the first 10,000 are the keys of null.jsonl).
 *
 *   node tools/lead_torpedo_fit.js --n 100000 --out results/lead/torpedo/fit.json
 */
const fs = require('fs');
const path = require('path');
const T = require('./lead_torpedo_core');
const K = require('./keyprior_lib');

function stratifiedKey(m, rng) {
  const up = [...m.keys()].filter((s) => /^[A-Z]$/.test(s));
  const ot = [...m.keys()].filter((s) => !/^[A-Z]$/.test(s));
  const out = new Map();
  for (const cls of [up, ot]) {
    const lets = K.shuffle(cls.map((s) => m.get(s)), rng);
    cls.forEach((s, i) => out.set(s, lets[i]));
  }
  return out;
}

const CIRC = new Set([4, 6, 8]);

/** min substitutions for word codes w at offset p; variant 'circles' or 'canonical' */
function subs(pins, w, p, variant) {
  let mis = 0;
  const circ = [];
  for (let i = 0; i < w.length; i++) {
    const q = p + i;
    const c = pins[q];
    if (c === 255) { if (variant === 'canonical' && CIRC.has(q)) circ.push(w[i]); continue; }
    if (c !== w[i]) mis++;
  }
  if (circ.length > 1) {
    const cnt = new Map();
    let mx = 0;
    for (const x of circ) { const v = (cnt.get(x) || 0) + 1; cnt.set(x, v); if (v > mx) mx = v; }
    mis += circ.length - mx;
  }
  return mis;
}

function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const N = +(o.n || 100000);
  const th = JSON.parse(fs.readFileSync(path.join(T.ROOT, 'results', 'lead', 'torpedo', 'theme_lists.json'), 'utf8'));
  const vocab = new Set(fs.readFileSync(path.join(T.ROOT, 'data', 'lm', 'words_common.tsv'), 'latin1').split('\n').map((l) => l.split('\t')[0]));
  // word sets: bomb words (all, incl. out-of-vocabulary), by minimum length; letter vocabulary >= 6
  const sets = {
    bomb7: th.lists.bomb.filter((w) => w.length >= 7 && w.length <= 13),
    bomb6: th.lists.bomb.filter((w) => w.length >= 6 && w.length <= 13),
    bomb5: th.lists.bomb.filter((w) => w.length >= 5 && w.length <= 13),
    letter6: th.lists.letter.filter((w) => w.length >= 6 && w.length <= 13),
    narrow: [...new Set([].concat(
      th.lists.bomb.filter((w) => w.length >= 5), th.lists.letter.filter((w) => w.length >= 6),
      th.lists.insult.filter((w) => w.length >= 5), th.lists.place.filter((w) => w.length >= 5),
      th.lists.case.filter((w) => w.length >= 5)))].filter((w) => w.length <= 13),
  };
  const codes = Object.fromEntries(Object.entries(sets).map(([k, ws]) => [k, ws.map((w) => ({ w, c: Uint8Array.from(w, (ch) => ch.charCodeAt(0) - 65) }))]));
  function analyse(pins) {
    const r = {};
    for (const [k, list] of Object.entries(codes)) {
      let bc = 99, bk = 99, nExactC = 0, wordC = null, wordK = null;
      for (const { w, c } of list) {
        let mc = 99, mk = 99;
        for (let p = 0; p + c.length <= 13; p++) {
          const a = subs(pins, c, p, 'circles'); if (a < mc) mc = a;
          const b = subs(pins, c, p, 'canonical'); if (b < mk) mk = b;
        }
        if (mc === 0) nExactC++;
        if (mc < bc) { bc = mc; wordC = w; }
        if (mk < bk) { bk = mk; wordK = w; }
      }
      r[k] = { circlesMinSubs: bc, circlesWord: wordC, circlesExactWords: nExactC, canonicalMinSubs: bk, canonicalWord: wordK };
    }
    return r;
  }
  const km = K.key('z340');
  const realPins = T.pinsFromKey(km);
  const out = { tool: 'tools/lead_torpedo_fit.js', created: new Date().toISOString(), N, listSizes: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length])), real: analyse(realPins), kinds: {} };
  for (const kind of ['permute', 'stratified']) {
    const rng = kind === 'permute' ? K.makeRng(1970, 1001) : K.makeRng(1971, 5001);
    const agg = {};
    const examples = {};
    const first10k = {};
    for (let j = 0; j < N; j++) {
      const m = kind === 'permute' ? K.permuteKey(km, rng) : stratifiedKey(km, rng);
      const pins = T.pinsFromKey(m);
      const r = analyse(pins);
      for (const [k, v] of Object.entries(r)) {
        if (!agg[k]) { agg[k] = { circlesExact: 0, circlesLe1: 0, canonicalExact: 0, canonicalLe1: 0, circlesExactWordCounts: {} }; examples[k] = []; first10k[k] = { circlesExact: 0, canonicalLe1: 0 }; }
        const a = agg[k];
        if (v.circlesMinSubs === 0) { a.circlesExact++; a.circlesExactWordCounts[v.circlesWord] = (a.circlesExactWordCounts[v.circlesWord] || 0) + 1; if (examples[k].length < 12) examples[k].push(T.pinString(pins) + ' ' + v.circlesWord); }
        if (v.circlesMinSubs <= 1) a.circlesLe1++;
        if (v.canonicalMinSubs === 0) a.canonicalExact++;
        if (v.canonicalMinSubs <= 1) a.canonicalLe1++;
        if (j < 10000) { if (v.circlesMinSubs === 0) first10k[k].circlesExact++; if (v.canonicalMinSubs <= 1) first10k[k].canonicalLe1++; }
      }
    }
    for (const k of Object.keys(agg)) {
      const a = agg[k];
      a.rates = { circlesExact: a.circlesExact / N, circlesLe1: a.circlesLe1 / N, canonicalExact: a.canonicalExact / N, canonicalLe1: a.canonicalLe1 / N };
      a.circlesExactWordCounts = Object.entries(a.circlesExactWordCounts).sort((x, y) => y[1] - x[1]).slice(0, 25);
      a.examples = examples[k];
      a.first10000 = first10k[k];
    }
    out.kinds[kind] = agg;
  }
  K.writeJSON(o.out || 'results/lead/torpedo/fit.json', out);
  console.log('real', JSON.stringify(out.real));
  for (const kind of Object.keys(out.kinds)) for (const [k, a] of Object.entries(out.kinds[kind])) console.log(kind, k, JSON.stringify(a.rates), 'top words', JSON.stringify(a.circlesExactWordCounts.slice(0, 10)));
}

main();
