'use strict';
/**
 * tools/textsample.js - random English test phrases from the HELD-OUT Project
 * Gutenberg documents of the language-model corpus (manifest rows with
 * index % 50 == 25, which tools/lm_build_ngrams.py excluded from the n-gram
 * tables), so solver tests never score text the model was trained on.
 *
 *   const TS = require('./textsample');
 *   const s = TS.sampler(seed);
 *   s.phrase(32)   // {letters: 'THEREWASNOTHING...', words: 'There was nothing ...', doc: pg_id}
 *                  // a run of whole words starting at a sentence start, exactly 32 letters
 *   s.passage(340) // sentence-start passage cut to exactly 340 letters (may end mid-word)
 */
const fs = require('fs');
const path = require('path');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'lm', 'corpus_manifest.tsv');
const GDIR = path.join(ROOT, 'data', 'lm', 'raw', 'gutenberg');
const HOLDOUT_MOD = 50, HOLDOUT_OFF = 25;

let _sent = null;

function heldoutDocs() {
  const lines = fs.readFileSync(MANIFEST, 'utf8').split('\n').filter(Boolean);
  const head = lines[0].split('\t');
  const idc = head.indexOf('pg_id');
  const docs = [];
  for (let i = 1; i < lines.length; i++) {
    const row = i - 1;
    if (row % HOLDOUT_MOD !== HOLDOUT_OFF) continue;
    docs.push(lines[i].split('\t')[idc]);
  }
  return docs;
}

function bodyOf(text) {
  const s = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i.exec(text);
  const e = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i.exec(text);
  if (s) text = text.slice(s.index + s[0].length, e && e.index > s.index ? e.index : text.length);
  return text;
}

/** All usable sentences of the held-out documents: [{doc, words: [..]}]. */
function sentences() {
  if (_sent) return _sent;
  const out = [];
  for (const id of heldoutDocs()) {
    const fp = path.join(GDIR, `${id}.txt`);
    if (!fs.existsSync(fp)) continue;
    let t = bodyOf(fs.readFileSync(fp, 'utf8'));
    t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    // paragraphs -> sentences; skip lines that look like headings / tables
    const paras = t.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length > 60 && /[a-z]/.test(p));
    for (const p of paras) {
      if (/(gutenberg|transcriber|copyright|http|www\.)/i.test(p)) continue;
      for (const s of p.split(/(?<=[.!?]["'\u201d\u2019]?)\s+(?=["'\u201c\u2018]?[A-Z])/)) {
        if (/\d|[_*\[\]{}<>|#@=\\]/.test(s)) continue;
        const words = (s.match(/[A-Za-z]+(?:['\u2019][A-Za-z]+)*/g) || []).map((w) => w.replace(/['\u2019]/g, ''));
        if (words.length < 3) continue;
        // skip shouting / headings (mostly upper-case)
        const up = words.filter((w) => w.length > 1 && w === w.toUpperCase()).length;
        if (up > words.length / 2) continue;
        out.push({ doc: id, words });
      }
    }
  }
  _sent = out;
  return out;
}

function sampler(seed = 1) {
  const rng = makeRng(seed >>> 0, 0x73616d70);
  const S = sentences();
  if (!S.length) throw new Error('textsample: no held-out sentences found (data/lm/raw/gutenberg missing?)');
  return {
    count: S.length,
    /** Whole words from a sentence start totalling exactly n letters. */
    phrase(n, maxTries = 100000) {
      for (let t = 0; t < maxTries; t++) {
        const s = S[rng.int(S.length)];
        let len = 0;
        const ws = [];
        for (const w of s.words) {
          if (len + w.length > n) break;
          ws.push(w);
          len += w.length;
          if (len === n) return { letters: ws.join('').toUpperCase(), words: ws.join(' '), doc: s.doc };
        }
      }
      throw new Error(`textsample: no phrase of exactly ${n} letters found`);
    },
    /** Consecutive sentences from a random start, cut to exactly n letters. */
    passage(n) {
      let i = rng.int(S.length);
      let letters = '';
      const doc = S[i].doc;
      while (letters.length < n) {
        letters += S[i % S.length].words.join('').toUpperCase();
        i++;
      }
      return { letters: letters.slice(0, n), doc };
    },
  };
}

module.exports = { sampler, sentences, heldoutDocs };
