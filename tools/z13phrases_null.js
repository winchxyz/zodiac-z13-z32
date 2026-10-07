'use strict';
/**
 * tools/z13phrases_null.js - the "real English" reference distribution for the
 * z13phrases task: wordSegment log10 P of real held-out phrases of exactly n
 * letters (tools/textsample.js, documents the n-gram tables never saw), under
 * both scoring vocabularies, plus how many of those phrases the dictionary
 * enumerations could produce at all (coverage).
 *
 *   node tools/z13phrases_null.js [--n 4000] [--lengths 11,12,13] [--seed 1301] [--out results/z13phrases/null_real_phrases.json]
 *
 * Output JSON: per length and vocabulary the percentiles of wordSegment logp, and
 * coverage = share of phrases whose own word split uses <= M words that are all in
 * the enumeration list (common top 60006, words <= 13 letters; or the full 333k list),
 * overall and among phrases above the median.  A TSV with every sampled phrase is
 * written next to the JSON.
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const TS = require('./textsample');

function opts(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
  return o;
}

function pct(sorted, q) {
  if (!sorted.length) return null;
  const x = (sorted.length - 1) * q;
  const lo = Math.floor(x), hi = Math.ceil(x);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo);
}

function main() {
  const o = opts(process.argv.slice(2));
  const N = +o.n || 4000;
  const lengths = String(o.lengths || '11,12,13').split(',').map(Number);
  const seed = +o.seed || 1301;
  const out = o.out || 'results/z13phrases/null_real_phrases.json';
  const common = lm.vocab('common');
  const full = lm.vocab('full');
  const res = { tool: 'tools/z13phrases_null.js', created: new Date().toISOString(), n: N, seed, source: 'tools/textsample.js held-out documents (manifest row % 50 == 25), phrase(n): whole words from a sentence start totalling exactly n letters', lengths: {} };
  const tsv = ['length\tletters\twords\tdoc\tlogpCommon\tlogpFull\tnWords\tallInCommon13\tallInFull'];
  for (const L of lengths) {
    const s = TS.sampler(seed + L);
    const rows = [];
    for (let i = 0; i < N; i++) {
      const p = s.phrase(L);
      const wsC = lm.wordSegment(p.letters, { vocab: 'common' });
      const wsF = lm.wordSegment(p.letters, { vocab: 'full' });
      const words = p.words.toUpperCase().split(' ');
      const inC = words.every((w) => w.length <= L && common.map.has(w));
      const inF = words.every((w) => full.map.has(w));
      rows.push({ letters: p.letters, words: p.words, doc: p.doc, c: wsC.logp, f: wsF.logp, nw: words.length, inC, inF });
      tsv.push([L, p.letters, p.words, p.doc, wsC.logp.toFixed(4), wsF.logp.toFixed(4), words.length, inC ? 1 : 0, inF ? 1 : 0].join('\t'));
    }
    const sc = rows.map((r) => r.c).sort((a, b) => a - b);
    const sf = rows.map((r) => r.f).sort((a, b) => a - b);
    const qs = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];
    const perc = (arr) => Object.fromEntries(qs.map((q) => [`p${Math.round(q * 100)}`, +pct(arr, q).toFixed(4)]));
    const medC = pct(sc, 0.5), medF = pct(sf, 0.5);
    const cov = (sel, M, key) => {
      const a = rows.filter(sel);
      return a.length ? +(a.filter((r) => r[key] && r.nw <= M).length / a.length).toFixed(4) : null;
    };
    const nwHist = {};
    for (const r of rows) nwHist[r.nw] = (nwHist[r.nw] || 0) + 1;
    res.lengths[L] = {
      count: rows.length,
      logpCommon: Object.assign({ mean: +(sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(4), max: +sc[sc.length - 1].toFixed(4) }, perc(sc)),
      logpFull: Object.assign({ mean: +(sf.reduce((a, b) => a + b, 0) / sf.length).toFixed(4), max: +sf[sf.length - 1].toFixed(4) }, perc(sf)),
      wordsPerPhrase: nwHist,
      coverage: {
        note: 'share of real phrases that the enumeration could produce: own word split has <= M words, all in the list',
        common_M4: cov(() => true, 4, 'inC'), common_M5: cov(() => true, 5, 'inC'), common_M6: cov(() => true, 6, 'inC'),
        common_M5_aboveMedian: cov((r) => r.c >= medC, 5, 'inC'), common_M6_aboveMedian: cov((r) => r.c >= medC, 6, 'inC'),
        common_M4_aboveMedian: cov((r) => r.c >= medC, 4, 'inC'),
        full_M3: cov(() => true, 3, 'inF'), full_M3_aboveMedianFull: cov((r) => r.f >= medF, 3, 'inF'),
      },
      top5Common: rows.slice().sort((a, b) => b.c - a.c).slice(0, 5).map((r) => [r.words, +r.c.toFixed(3)]),
      bottom3Common: rows.slice().sort((a, b) => a.c - b.c).slice(0, 3).map((r) => [r.words, +r.c.toFixed(3)]),
    };
    process.stderr.write(`length ${L}: median common ${medC.toFixed(3)}, full ${medF.toFixed(3)}\n`);
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  fs.writeFileSync(out.replace(/\.json$/, '.tsv'), tsv.join('\n') + '\n');
  console.log(JSON.stringify(res.lengths, null, 1));
}

main();
