'use strict';
// Reviewer check: independent scan of every 13-/12-letter word in data/lm/words.tsv (333k) and in the
// SSA/Census name lists for one-word fits to each Z13 variant, simple and homophonic.
const fs = require('fs');
const path = require('path');
const C = require('./cipher');
const ROOT = path.join(__dirname, '..');
const V = (id) => fs.readFileSync(path.join(ROOT, 'data', 'ciphers', 'variants', `${id}.txt`), 'latin1').trim();
const variants = { canonical: V('z13.canonical'), circles_distinct: V('z13.circles_distinct'), crosshair_null: V('z13.crosshair_null'), reversed: V('z13.reversed') };
const words = fs.readFileSync(path.join(ROOT, 'data', 'lm', 'words.tsv'), 'latin1').split('\n').filter(Boolean).map((l) => l.split('\t')[0].toUpperCase());
const res = {};
for (const [id, ct] of Object.entries(variants)) {
  for (const mode of ['simple', 'homophonic']) {
    const hits = words.filter((w) => w.length === ct.length && /^[A-Z]+$/.test(w) && C.checkCandidate(ct, w, { mode }).ok);
    res[`${id}_${mode}`] = hits;
  }
}
// letters literal: canonical with A,E,N,K,M fixed to themselves
const ct = variants.canonical;
res.letters_literal_any = words.filter((w) => w.length === 13 && /^[A-Z]+$/.test(w) && [...ct].every((c, i) => !'AENKM'.includes(c) || w[i] === c) && C.checkCandidate(ct, w, { mode: 'homophonic' }).ok);
for (const [k, v] of Object.entries(res)) console.log(k, v.length, v.slice(0, 10).join(' '));
