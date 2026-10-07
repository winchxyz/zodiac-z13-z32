'use strict';
/**
 * tools/keyprior_selftest.js - checks for tools/keyprior_lib.js:
 *  1. makeScorer().score equals solvercore scoreKey (anneal.makeProblem, wordweight 1, fast words) on random keys;
 *  2. exhaustiveBest finds a planted optimum (brute force agrees with a direct maximum on a 2-free-symbol case);
 *  3. permuteKey keeps the letter multiset; key('union') = Z408 where defined, else Z340.
 *   node tools/keyprior_selftest.js
 */
const K = require('./keyprior_lib');
const A = require('./anneal');
const core = require('./solvercore');
const lmshare = require('./lmshare');

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

const T = lmshare.attach(lmshare.build({ orders: [5], markov: false, six: 'exact' }));
const rng = K.makeRng(7, 0);
for (const id of ['z13.canonical', 'z32.canonical', 'z13.crosshair_null']) {
  const text = K.cipherText(id);
  const sc = K.makeScorer(text);
  const o = Object.assign({}, A.DEFAULTS, { cipher: text, mode: 'homophonic', wordweight: 1, wordmodel: 'fast', n: '5', entropy: 0.5 });
  const { def, view } = A.makeProblem(o);
  check(view.symbols.join('') === sc.symbols.join(''), `${id}: symbol order matches anneal (${sc.symbols.length} symbols)`);
  const P = core.prepare(Object.assign({}, def, { wordInner: true }), T, core.wordScorer(def));
  let maxd = 0;
  for (let t = 0; t < 200; t++) {
    const key = new Int8Array(sc.S);
    for (let s = 0; s < sc.S; s++) key[s] = rng.int(26);
    const a = sc.score(key);
    const b = core.scoreKey(P, key).score;
    maxd = Math.max(maxd, Math.abs(a - b));
  }
  check(maxd < 1e-6, `${id}: scorer == solvercore.scoreKey on 200 random keys (max |diff| ${maxd.toExponential(2)})`);
}

// exhaustive search check: pin all but two symbols of Z13 to a known English fit, recover it
{
  const text = K.cipherText('z13.canonical');
  const sc = K.makeScorer(text);
  const pt = 'OFTHEDEFEATOF';
  const m = new Map();
  for (let i = 0; i < text.length; i++) m.set(text[i], pt[i]);
  const pins = new Map([...m].filter(([s]) => s !== '0' && s !== '['));
  const fixed = sc.fixedFrom(pins);
  const r = K.exhaustiveBest(sc, fixed, 5);
  check(r.evals === 676, `exhaustive over 2 free symbols evaluates 676 keys (got ${r.evals})`);
  // direct maximum
  let best = -Infinity, bestPt = '';
  const key = Int8Array.from(fixed);
  const i0 = sc.symbols.indexOf('0'), i1 = sc.symbols.indexOf('[');
  for (let a = 0; a < 26; a++) for (let b = 0; b < 26; b++) {
    key[i0] = a; key[i1] = b;
    const v = sc.score(key);
    if (v > best) { best = v; bestPt = sc.decode(key); }
  }
  check(Math.abs(best - r.top[0].score) < 1e-9 && bestPt === r.top[0].plaintext, `exhaustive best = direct max (${r.top[0].plaintext})`);
  const truth = sc.score(sc.fixedFrom(m));
  check(r.top.some((t) => t.plaintext === pt) || r.top[0].score >= truth, `planted text ${pt} is found or beaten (truth ${truth.toFixed(2)}, best ${r.top[0].score.toFixed(2)})`);
}

// null keys
{
  const k = K.key('z408');
  const p = K.permuteKey(k, rng);
  const ms = (m) => [...m.values()].sort().join('');
  check(ms(p) === ms(k) && [...p.keys()].join('') === [...k.keys()].join(''), 'permuteKey keeps symbols and the letter multiset');
  const u = K.key('union');
  const k3 = K.key('z340');
  let ok = true;
  for (const [s, l] of u) if ((k.has(s) && k.get(s) !== l) || (!k.has(s) && k3.get(s) !== l)) ok = false;
  check(ok && u.size === new Set([...k.keys(), ...k3.keys()]).size, `union key: ${u.size} symbols, Z408 letter where defined else Z340`);
}
console.log(fails ? `${fails} FAILED` : 'all keyprior_lib checks passed');
process.exit(fails ? 1 : 0);
