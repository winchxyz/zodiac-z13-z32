'use strict';
/**
 * tools/nullmodel_isolik.js - how probable are Z13's and Z32's symbol patterns
 * under different key models, for English plaintext?
 *
 *   profile likelihood  P(the cipher has the same repeat profile as the real one,
 *                       e.g. Z13: one symbol x3, three x2, four x1) for random
 *                       held-out English windows enciphered with the key model
 *   exact likelihood    P(the cipher has exactly the real isomorph)
 *                       = sum over fitting corpus windows of P(window) * P(exact isomorph | window, key model)
 *                       estimated as f_hom(corpus, clean) * mean over the fitting windows of the
 *                       Monte Carlo probability that a random key of the model produces the isomorph
 * Key models (tools/encrypt.js):
 *   simple        one symbol per letter
 *   z63cycle      63 symbols, proportional allocation, homophones cycle (Z408/Z340 style)
 *   z63random     63 symbols, proportional allocation, homophone drawn at random
 *   z35cycle      35 symbols over all 26 letters (one each plus 9 extra by frequency), cycling
 * The 63- and 35-symbol keys give every one of the 26 letters at least one symbol (allLetters).
 *
 * Usage: node tools/nullmodel_isolik.js [--windows 100000] [--keys 2000] [--out results/nullmodel/isomorph_likelihood.json]
 */
const fs = require('fs');
const path = require('path');
const E = require('./encrypt');
const C = require('./cipher');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');

function args() {
  const a = process.argv.slice(2);
  const o = { windows: 100000, keys: 2000, out: 'results/nullmodel/isomorph_likelihood.json', cache: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--windows') o.windows = +a[++i];
    else if (a[i] === '--keys') o.keys = +a[++i];
    else if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--cache') o.cache = a[++i];
  }
  return o;
}

function readNpy(file) {
  const b = fs.readFileSync(file);
  const ver = b[6];
  const hlen = ver === 1 ? b.readUInt16LE(8) : b.readUInt32LE(8);
  const off = (ver === 1 ? 10 : 12) + hlen;
  return new Uint8Array(b.buffer, b.byteOffset + off, b.length - off);
}

const MODELS = {
  simple: { alloc: 'simple' },
  z63cycle: { symbols: 63, alloc: 'proportional', select: 'cycle', allLetters: true },
  z63random: { symbols: 63, alloc: 'proportional', select: 'random', allLetters: true },
  z35cycle: { symbols: 35, alloc: 'proportional', select: 'cycle', allLetters: true },
};

function profile(text) {
  const m = new Map();
  for (const c of text) m.set(c, (m.get(c) || 0) + 1);
  return [...m.values()].sort((x, y) => y - x).join(',');
}

function main() {
  const o = args();
  const t0 = Date.now();
  const cache = o.cache || path.join(process.env.TEMP || '/tmp', 'zodiac_nullmodel_cache');
  const a = readNpy(path.join(cache, 'heldout_letters.npy'));
  const wc = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/nullmodel/windows/window_counts.json'), 'utf8'));
  const rng = makeRng(26, 0x69736f);
  const rep = { tool: 'tools/nullmodel_isolik.js', created: new Date().toISOString(), command: 'node ' + process.argv.slice(1).join(' '), models: MODELS, ciphers: {} };
  const targets = [
    { id: 'z13.canonical', fits: 'results/nullmodel/windows/fits_z13.canonical_train.tsv' },
    { id: 'z13.circles_distinct', fits: 'results/nullmodel/windows/fits_z13.circles_distinct_heldout.tsv' },
    { id: 'z32.canonical', fits: 'results/nullmodel/windows/fits_z32.canonical_heldout.tsv' },
    { id: 'z32.triangles_merged', fits: 'results/nullmodel/windows/fits_z32.triangles_merged_train.tsv' },
  ];
  for (const t of targets) {
    const v = wc.variants[t.id];
    const text = v.text;
    const L = text.length;
    const iso = C.isomorph(text);
    const prof = profile(text);
    const res = { text, isomorph: iso, profile: prof, profileLikelihood: {}, exactLikelihood: {} };
    // profile likelihood from random held-out windows
    const wins = [];
    while (wins.length < o.windows) {
      const i = rng.int(a.length - L);
      let ok = true, w = '';
      for (let k = 0; k < L; k++) { const c = a[i + k]; if (c === 26) { ok = false; break; } w += String.fromCharCode(65 + c); }
      if (ok) wins.push(w);
    }
    for (const [name, enc] of Object.entries(MODELS)) {
      let hit = 0, distinctSum = 0;
      for (let k = 0; k < wins.length; k++) {
        const e = E.encryptText(wins[k], Object.assign({ seed: 1 + k * 7919 + name.length }, enc));
        distinctSum += e.distinctSymbols;
        if (profile(e.cipher) === prof) hit++;
      }
      res.profileLikelihood[name] = { windows: wins.length, hits: hit, p: hit / wins.length, meanDistinctSymbols: distinctSum / wins.length, realDistinct: new Set(text).size };
    }
    // exact likelihood: fitting windows x random keys
    const rows = fs.readFileSync(path.join(ROOT, t.fits), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')).filter((r) => r[4] === '1');
    const fitWins = [];
    for (const r of rows) for (let c = 0; c < +r[1]; c++) fitWins.push(r[0]);
    const sample = fitWins.length > 400 ? fitWins.filter((_, i) => i % Math.ceil(fitWins.length / 400) === 0) : fitWins;
    const split = t.fits.includes('heldout') ? 'heldout' : 'train';
    const fHom = v.splits[split].homophonic.clean_fraction;
    for (const [name, enc] of Object.entries(MODELS)) {
      let hit = 0, tot = 0;
      for (let k = 0; k < sample.length; k++) {
        for (let r = 0; r < o.keys; r++) {
          const e = E.encryptText(sample[k], Object.assign({ seed: 1000003 * k + r + 17 }, enc));
          tot++;
          if (C.isomorph(e.cipher) === iso) hit++;
        }
      }
      const pIsoGivenFit = hit / tot;
      res.exactLikelihood[name] = { fittingWindowsUsed: sample.length, keysPerWindow: o.keys, hits: hit, pIsoGivenFit, fHomClean: fHom, split,
        pIso: fHom * pIsoGivenFit, log2pIso: hit ? Math.log2(fHom * pIsoGivenFit) : null,
        upperBound95IfZero: hit ? null : fHom * 3 / tot };
    }
    rep.ciphers[t.id] = res;
    console.log(t.id, JSON.stringify(res.profileLikelihood), JSON.stringify(Object.fromEntries(Object.entries(res.exactLikelihood).map(([k, x]) => [k, [x.hits, x.pIsoGivenFit, x.pIso]]))));
  }
  rep.seconds = (Date.now() - t0) / 1000;
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, JSON.stringify(rep, null, 1));
  console.log(`(${rep.seconds.toFixed(1)} s)`);
}

main();
