'use strict';
/**
 * tools/keyprior_condnull.js - sharper nulls for the Z13 full-pin result (single thread, small).
 *
 *  (a) arrangement null: the real key's six letters for A E N z K M, permuted among those six symbols
 *      (all distinct arrangements).  Asks whether the specific symbol->letter assignment matters,
 *      given the letters themselves.
 *  (b) conditional null: permuted keys with N fixed to E (both known keys give N = E).
 *  (c) English-frequency null: six letters drawn i.i.d. from English letter frequencies
 *      (data/lm/meta.json), i.e. ignoring the key's letter distribution.
 * Statistic: --stat objective | word (as tools/keyprior_fullpin.js).
 *
 *   node tools/keyprior_condnull.js --stat word --null 5000 --seed 21 --out results/keyprior/condnull_word.json
 */
const K = require('./keyprior_lib');
const lm = require('./lm');

function perms(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  const seen = new Set();
  arr.forEach((x, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of perms(rest)) { const q = [x].concat(p); const k = q.join(''); if (!seen.has(k)) { seen.add(k); out.push(q); } }
  });
  return out;
}

function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const stat = o.stat || 'objective';
  const N = +(o.null || 5000);
  const rng = K.makeRng(+(o.seed || 21), 0);
  const text = K.cipherText(o.cipher || 'z13.canonical');
  const sc = K.makeScorer(text, K.statOpts(stat));
  const syms = ['A', 'E', 'N', 'z', 'K', 'M'];
  const best = (m) => K.exhaustiveBest(sc, sc.fixedFrom(m), 1).top[0];
  const f = lm.meta().ngrams.letter_frequencies;
  const L = Object.keys(f).sort();
  const cdf = [];
  let acc = 0;
  for (const l of L) { acc += f[l]; cdf.push(acc); }
  const drawEng = () => { const u = rng.next() * acc; let i = 0; while (cdf[i] < u) i++; return L[i]; };
  const out = { tool: 'tools/keyprior_condnull.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '), statistic: stat, cipher: text, results: {} };
  for (const kn of ['z408', 'z340']) {
    const km = K.key(kn);
    const realLetters = syms.map((s) => km.get(s));
    const real = best(new Map(syms.map((s, i) => [s, realLetters[i]])));
    const r = { realLetters: realLetters.join(''), real: { score: real.score, plaintext: real.plaintext } };
    // (a) arrangements
    const arr = perms(realLetters).map((p) => best(new Map(syms.map((s, i) => [s, p[i]]))).score);
    r.arrangement = { n: arr.length, ...K.upperP(real.score, arr), summary: K.summary(arr) };
    // (b) conditional N = E
    const cond = [];
    for (let j = 0; j < N; j++) { const nk = K.permuteKey(km, rng); nk.set('N', 'E'); cond.push(best(nk).score); }
    r.conditionalNisE = { n: N, ...K.upperP(real.score, cond), summary: K.summary(cond) };
    // (c) English-frequency letters
    const eng = [];
    for (let j = 0; j < N; j++) eng.push(best(new Map(syms.map((s) => [s, drawEng()]))).score);
    r.englishFreq = { n: N, ...K.upperP(real.score, eng), summary: K.summary(eng) };
    out.results[kn] = r;
    console.log(`${kn} ${r.realLetters} real ${real.score.toFixed(2)} ${real.plaintext} | arrangement p=${r.arrangement.p.toFixed(4)} (n=${arr.length}) | N=E cond p=${r.conditionalNisE.p.toFixed(4)} | English-freq p=${r.englishFreq.p.toFixed(4)}`);
  }
  if (o.out) K.writeJSON(o.out, out);
}
main();
