'use strict';
/**
 * tools/z13phrases_known.js - published Z13 word readings (research/z13_literature.md section 4)
 * placed in the z13phrases enumeration: fit type (strict = simple substitution, weak =
 * homophonic only, needs a slip, or none), wordSegment log10 P, its percentile among real
 * 13-letter phrases, and its rank among all fits of the matching run (number of fits with a
 * higher score + 1, counted from the run's TSV stream).
 *   node tools/z13phrases_known.js   -> results/z13phrases/known_readings.json
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const C = require('./cipher');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'results', 'z13phrases');
const Z13 = 'AENz0K0M0[NAM';
const KNOWN = [
  ['ACHIEVELETHAL', 'Oranchak 2012-13 (dictionary search)'],
  ['OFTHESEMENTOM', 'Oranchak 2012-13 (dictionary search)'],
  ['CHASTITYTRACY', 'Oranchak 2012-13 (dictionary search)'],
  ['SARAHTHEHORSE', 'Oranchak 2013 (name search)'],
  ['LAURACATAPULT', 'Oranchak 2013 (name search)'],
  ['GARYLYLELARGE', 'glurk (wiki)'],
  ['EDDIEPENERDEN', 'Quill (wiki)'],
  ['OLSTEVENELSON', 'MickCal (wiki)'],
  ['AMIGOCOLONIAL', 'Toad (wiki)'],
  ['HOPEITISINPHS', 'Jasper (wiki)'],
  ['SAMJRDRFROMSF', '@samuelpotts5143 (wiki)'],
  ['ONTVAWARACTOR', 'CipherS0luti0ns (wiki)'],
  ['SOLVEREVEALSV', 'CipherS0luti0ns (wiki)'],
  ['ILLNEVETELLIT', 'granny101 (wiki)'],
  ['ALFREDENEUMAN', 'Graysmith / Bauer'],
  ['DREATATOTPEDO', 'Garlick 2020'],
  ['THEBIGSECRETE', 'Kelleher (wiki)'],
  ['MARVINMERRILL', 'Baber 2025'],
  ['ARTLEIGHALLEN', 'suspect name (no published decipherment)'],
  ['KATHLEENJOHNS', 'Graysmith victim count'],
];

function percentile(sorted, x) {
  let k = 0;
  while (k < sorted.length && sorted[k] < x) k++;
  return k / sorted.length;
}

function rankIn(tsvFile, logp) {
  if (!fs.existsSync(tsvFile)) return null;
  let higher = 0, minSeen = Infinity;
  const lines = fs.readFileSync(tsvFile, 'utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln) continue;
    const t = ln.indexOf('\t');
    const v = +ln.slice(t + 1, ln.indexOf('\t', t + 1));
    if (v > logp + 1e-6) higher++;
    if (v < minSeen) minSeen = v;
  }
  return { rank: higher + 1, streamMin: minSeen };
}

function slipFits(pt) {
  // positions p such that a wildcard at p makes the reading a simple / homophonic fit
  const out = { simple: [], homophonic: [] };
  for (let p = 0; p < 13; p++) {
    const ct = Z13.slice(0, p) + '#' + Z13.slice(p + 1); // '#' is not in Z13: a fresh symbol
    if (C.checkCandidate(ct, pt, { mode: 'homophonic' }).ok) out.homophonic.push(p);
    // simple with a wildcard: the fresh symbol's letter may repeat another symbol's letter
    let ok = true;
    const key = new Map(), owner = new Map();
    for (let i = 0; i < 13; i++) {
      if (i === p) continue;
      const s = Z13[i], l = pt[i];
      if (key.has(s) && key.get(s) !== l) { ok = false; break; }
      if (owner.has(l) && owner.get(l) !== s) { ok = false; break; }
      key.set(s, l); owner.set(l, s);
    }
    if (ok) out.simple.push(p);
  }
  return out;
}

function main() {
  const ref = JSON.parse(fs.readFileSync(path.join(DIR, 'null_real_phrases.json'), 'utf8'));
  const rows = fs.readFileSync(path.join(DIR, 'null_real_phrases.tsv'), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')).filter((r) => r[0] === '13');
  const sorted = rows.map((r) => +r[4]).sort((a, b) => a - b);
  const out = [];
  for (const [pt, who] of KNOWN) {
    const ws = lm.wordSegment(pt, { vocab: 'common' });
    const simple = C.checkCandidate(Z13, pt, { mode: 'simple' }).ok;
    const homo = C.checkCandidate(Z13, pt, { mode: 'homophonic' }).ok;
    const fit = simple ? 'strict' : homo ? 'weak' : 'none';
    const slips = fit === 'none' ? slipFits(pt) : null;
    const run = simple ? 'w60k5_canonical_simple' : homo ? 'w60k5_canonical_homophonic' : null;
    const rk = run ? rankIn(path.join(DIR, 'runs', `${run}.tsv`), ws.logp) : null;
    // below the stream threshold: bracket the rank with the run's 0.25-wide score histograms
    let rankRange = null;
    if (rk && ws.logp < rk.streamMin) {
      const R = JSON.parse(fs.readFileSync(path.join(DIR, 'runs', `${run}.json`), 'utf8'));
      const H = R.histograms, w = H.binWidth;
      let lo = 0, hi = 0;
      for (const [b, c] of Object.entries(H.exactScored)) { if (+b > ws.logp) lo += c; if (+b + w > ws.logp) hi += c; }
      if (H.boundUnscored) { for (const [b, c] of Object.entries(H.boundUnscored)) if (+b + w > ws.logp) hi += c; } else hi = null;
      rankRange = { atLeast: lo, atMost: hi, consistentStrings: R.counts.consistentStrings };
    }
    const allInList = ws.words.length <= 5 && ws.unknown === 0;
    out.push({ plaintext: pt, source: who, fit, oneSlipPositions: slips, wordSegment: ws.words.join(' '), unknownWords: ws.unknownWords, wordLogp: +ws.logp.toFixed(4),
      realPhrasePercentile: +percentile(sorted, ws.logp).toFixed(3), run, rankInRun: rk ? (ws.logp >= rk.streamMin ? rk.rank : `> ${rk.rank - 1} (below the stream threshold ${rk.streamMin.toFixed(2)})`) : null,
      rankRange, inEnumerationSpace: allInList });
  }
  fs.writeFileSync(path.join(DIR, 'known_readings.json'), JSON.stringify({ tool: 'tools/z13phrases_known.js', created: new Date().toISOString(), realMedian13: ref.lengths['13'].logpCommon.p50, readings: out }, null, 1));
  for (const r of out) console.log(`${r.plaintext.padEnd(14)} ${r.fit.padEnd(6)} ${String(r.wordLogp).padEnd(9)} pct ${r.realPhrasePercentile} rank ${r.rankInRun} ${r.oneSlipPositions ? JSON.stringify(r.oneSlipPositions) : ''} [${r.wordSegment}]`);
}

main();
