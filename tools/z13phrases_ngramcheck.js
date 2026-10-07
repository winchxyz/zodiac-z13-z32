'use strict';
/**
 * tools/z13phrases_ngramcheck.js - a stricter "grammatical phrase vs word salad" proxy for the
 * z13phrases categories: is every word trigram (bigram for two-word fits) of a fit's best
 * segmentation attested, inside one sentence, in the TRAINING part of the language-model corpus
 * (data/lm/raw/gutenberg, manifest rows with index % 50 != 25; the held-out rows that
 * textsample.js draws real phrases from are excluded, so the calibration on real phrases is fair)?
 *
 *   node tools/z13phrases_ngramcheck.js [--top 2000]
 *
 * Queries: the best segmentation of the top fits of every run (results/z13phrases/runs/*.json)
 * and of the 13-, 12- and 11-letter real phrases (null_real_phrases.tsv).  Writes
 * results/z13phrases/attested_ngrams.json {ngram: corpus count} for every queried n-gram.
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'results', 'z13phrases');
const o = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) o[process.argv[i].slice(2)] = process.argv[++i];
const TOPN = +o.top || 2000;

function ngramsOf(words) {
  const ws = words.split(' ').filter(Boolean);
  if (ws.length === 2) return [ws.join(' ')];
  const out = [];
  for (let i = 0; i + 3 <= ws.length; i++) out.push(ws.slice(i, i + 3).join(' '));
  return out;
}

function main() {
  const t0 = Date.now();
  const need = new Set();
  const runDir = path.join(DIR, 'runs');
  for (const f of fs.readdirSync(runDir).filter((x) => x.endsWith('.json'))) {
    const r = JSON.parse(fs.readFileSync(path.join(runDir, f), 'utf8'));
    for (const t of r.top.slice(0, TOPN)) for (const g of ngramsOf(t.words)) need.add(g);
  }
  const rows = fs.readFileSync(path.join(DIR, 'null_real_phrases.tsv'), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
  for (const r of rows) for (const g of ngramsOf(lm.wordSegment(r[1], { vocab: 'common' }).words.join(' '))) need.add(g);
  // prefix sets for a cheap scan
  const pre2 = new Set();
  for (const g of need) { const p = g.split(' '); pre2.add(p[0] + ' ' + p[1]); }
  const counts = new Map();
  const man = fs.readFileSync(path.join(ROOT, 'data', 'lm', 'corpus_manifest.tsv'), 'utf8').split('\n').filter(Boolean);
  const idc = man[0].split('\t').indexOf('pg_id');
  let docs = 0, words = 0;
  for (let i = 1; i < man.length; i++) {
    if ((i - 1) % 50 === 25) continue; // held-out
    const fp = path.join(ROOT, 'data', 'lm', 'raw', 'gutenberg', `${man[i].split('\t')[idc]}.txt`);
    if (!fs.existsSync(fp)) continue;
    docs++;
    const text = fs.readFileSync(fp, 'latin1').toUpperCase().replace(/['’]/g, '');
    for (const sent of text.split(/[.!?;:]+/)) {
      const ws = sent.match(/[A-Z]+/g);
      if (!ws) continue;
      words += ws.length;
      for (let k = 0; k + 1 < ws.length; k++) {
        const b = ws[k] + ' ' + ws[k + 1];
        if (!pre2.has(b)) continue;
        if (need.has(b)) counts.set(b, (counts.get(b) || 0) + 1);
        if (k + 2 < ws.length) { const t = b + ' ' + ws[k + 2]; if (need.has(t)) counts.set(t, (counts.get(t) || 0) + 1); }
      }
    }
  }
  const out = { tool: 'tools/z13phrases_ngramcheck.js', created: new Date().toISOString(), docs, words, queried: need.size, attested: counts.size, seconds: (Date.now() - t0) / 1000, counts: Object.fromEntries(counts), queriedList: Array.from(need) };
  fs.writeFileSync(path.join(DIR, 'attested_ngrams.json'), JSON.stringify(out));
  console.log(JSON.stringify({ docs, words, queried: need.size, attested: counts.size, seconds: out.seconds }));
}

main();
