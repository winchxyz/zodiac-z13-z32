'use strict';
/**
 * results/nullmodel/review/review_windows.js - independent re-implementation (reviewer) of the
 * corpus-window fit counts in tools/nullmodel_windows.py, written from scratch without numpy or
 * the attacker's cache: reads data/lm/raw/corpus_letters.txt (one document per line, manifest
 * order), splits documents into training (row % 50 != 25) and held-out (== 25), and counts every
 * window of the cipher length inside one document that fits.
 *
 * Fit definitions:
 *   hom     equal symbols -> equal letters
 *   strict  hom AND different symbols -> different letters
 *   clean   no run of three identical letters inside the window
 * Also counts, for 13-letter windows, how many have the letter-count profile 3,2,2,2,1,1,1,1
 * (the probability that a simple-substitution encipherment of a random English window has
 * Z13's repeat profile).
 *
 * Usage: node results/nullmodel/review/review_windows.js [--out results/nullmodel/review/windows_check.json]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(__dirname, 'windows_check.json');

function classesOf(text) {
  const m = new Map();
  for (let i = 0; i < text.length; i++) { if (!m.has(text[i])) m.set(text[i], []); m.get(text[i]).push(i); }
  return [...m.values()];
}

const V = (id) => fs.readFileSync(path.join(ROOT, 'data/ciphers/variants', id + '.txt'), 'latin1').trim();
const targets = {
  'z13.canonical': V('z13.canonical'),
  'z13.crosshair_null': V('z13.crosshair_null'),
  'z13.circles_distinct': V('z13.circles_distinct'),
  'z13.reversed': V('z13.reversed'),
  'z32.canonical': V('z32.canonical'),
  'z32.triangles_merged': V('z32.triangles_merged'),
};

const t0 = Date.now();
const buf = fs.readFileSync(path.join(ROOT, 'data/lm/raw/corpus_letters.txt'));
// document boundaries
const docs = [];
let s = 0;
for (let i = 0; i <= buf.length; i++) {
  if (i === buf.length || buf[i] === 10) { if (i > s) docs.push([s, i]); s = i + 1; }
}
const manifestRows = fs.readFileSync(path.join(ROOT, 'data/lm/corpus_manifest.tsv'), 'utf8').split('\n').slice(1).filter((l) => l.trim()).length;

const res = { docs: docs.length, manifestRows, variants: {} };
for (const [id, text] of Object.entries(targets)) {
  const L = text.length;
  const cls = classesOf(text);
  const eq = [];
  for (const c of cls) for (let k = 1; k < c.length; k++) eq.push([c[0], c[k]]);
  const reps = cls.map((c) => c[0]);
  const r = { text, L, train: { windows: 0, hom: 0, homClean: 0, strict: 0, strictClean: 0 }, heldout: { windows: 0, hom: 0, homClean: 0, strict: 0, strictClean: 0 }, examplesStrict: [] };
  const seen = new Set();
  docs.forEach(([a, b], k) => {
    const sp = k % 50 === 25 ? r.heldout : r.train;
    const n = b - a - L + 1;
    if (n <= 0) return;
    sp.windows += n;
    for (let i = a; i < a + n; i++) {
      let ok = true;
      for (const [p, q] of eq) if (buf[i + p] !== buf[i + q]) { ok = false; break; }
      if (!ok) continue;
      sp.hom++;
      let clean = true;
      for (let j = 0; j + 2 < L; j++) if (buf[i + j] === buf[i + j + 1] && buf[i + j + 1] === buf[i + j + 2]) { clean = false; break; }
      if (clean) sp.homClean++;
      const used = new Set();
      let strict = true;
      for (const p of reps) { const c = buf[i + p]; if (used.has(c)) { strict = false; break; } used.add(c); }
      if (strict) {
        sp.strict++;
        if (clean) sp.strictClean++;
        const w = buf.toString('latin1', i, i + L);
        if (L === 13 && !seen.has(w) && r.examplesStrict.length < 40) { seen.add(w); r.examplesStrict.push(w); }
      }
    }
  });
  r.trainFracHomClean = r.train.homClean / r.train.windows;
  r.trainFracStrict = r.train.strict / r.train.windows;
  r.heldoutFracHomClean = r.heldout.homClean / r.heldout.windows;
  r.bitsHomClean = -Math.log2(r.trainFracHomClean);
  r.bitsStrict = r.train.strict ? -Math.log2(r.trainFracStrict) : null;
  res.variants[id] = r;
  console.log(id, JSON.stringify({ train: r.train, heldout: r.heldout, bitsHomClean: r.bitsHomClean, bitsStrict: r.bitsStrict }));
}

// repeat-profile likelihood under a simple key, 13-letter held-out windows (all of them, not a sample)
const target = '3,2,2,2,1,1,1,1';
let nwin = 0, hit = 0, hitTrain = 0, nwinTrain = 0;
const cnt = new Int32Array(256);
docs.forEach(([a, b], k) => {
  const held = k % 50 === 25;
  const n = b - a - 13 + 1;
  if (n <= 0) return;
  for (let i = a; i < a + n; i++) {
    if (!held && (i % 20) !== 0) continue; // training: every 20th window
    cnt.fill(0, 65, 91);
    for (let j = 0; j < 13; j++) cnt[buf[i + j]]++;
    const prof = [];
    for (let c = 65; c < 91; c++) if (cnt[c]) prof.push(cnt[c]);
    prof.sort((x, y) => y - x);
    const ok = prof.join(',') === target;
    if (held) { nwin++; if (ok) hit++; } else { nwinTrain++; if (ok) hitTrain++; }
  }
});
res.simpleKeyProfileLikelihood = { profile: target, heldoutWindows: nwin, heldoutHits: hit, p: hit / nwin, trainEvery20thWindows: nwinTrain, trainHits: hitTrain, pTrain: hitTrain / nwinTrain };
console.log('simple-key profile likelihood', JSON.stringify(res.simpleKeyProfileLikelihood));
res.seconds = (Date.now() - t0) / 1000;
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(`(${res.seconds} s)`);
