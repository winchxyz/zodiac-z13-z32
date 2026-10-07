'use strict';
/**
 * tools/z13phrases_analyze.js - summarise the z13phrases runs.
 *
 *   node tools/z13phrases_analyze.js [--top 2000]
 *
 * Reads results/z13phrases/runs/*.json (tools/z13phrases_enum.js outputs), the real-phrase
 * reference (null_real_phrases.json/.tsv), theme_words.txt and name_tokens.tsv, and writes
 *   results/z13phrases/summary.json            per-run counts, posterior concentration, category
 *                                              shares of the top fits, headline table, theme hits,
 *                                              slip and null-letter comparisons, handle lists
 *   results/z13phrases/categories/<run>.tsv    the top fits of each run with their categories
 *
 * Categories (automatic proxies, calibrated on real phrases in summary.classifierCalibration):
 *   structure (of the best wordSegment split): one-word | attested (every word trigram, or the
 *     bigram of a two-word fit, occurs inside a sentence of the training corpus;
 *     attested_ngrams.json from tools/z13phrases_ngramcheck.js) | chain (not attested, but every
 *     adjacent pair is one of the 258,168 Web 1T bigrams in data/lm/bigrams.tsv) | partial (some
 *     pairs listed) | salad (none).  "phrase-like" = one-word or attested.
 *   name: a token of 3+ letters in name_tokens.tsv (SSA first names / top-50k surnames that are
 *     not among the 5,000 most common words); first-name tokens are flagged separately.
 *   theme: a token in theme_words.txt (curated); plainVocab: a token in plaintext_vocab.txt.
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'results', 'z13phrases');

function opts(argv) { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i]; return o; }

function loadBigrams() {
  const set = new Set();
  for (const ln of fs.readFileSync(path.join(ROOT, 'data', 'lm', 'bigrams.tsv'), 'latin1').split('\n')) {
    if (!ln) continue;
    const p = ln.split('\t');
    if (p[0] === '<S>') continue;
    set.add(p[0] + ' ' + p[1]);
  }
  return set;
}

function main() {
  const o = opts(process.argv.slice(2));
  const TOPN = +o.top || 2000;
  const big = loadBigrams();
  const theme = new Set(fs.readFileSync(path.join(DIR, 'theme_words.txt'), 'utf8').split('\n').filter(Boolean));
  const plainVocab = new Set(fs.readFileSync(path.join(DIR, 'plaintext_vocab.txt'), 'utf8').split('\n').filter(Boolean));
  const names = new Map();
  for (const ln of fs.readFileSync(path.join(DIR, 'name_tokens.tsv'), 'utf8').split('\n').slice(1)) {
    if (!ln) continue;
    const [w, f, s] = ln.split('\t');
    names.set(w, { first: +f, sur: +s });
  }
  // corpus attestation (tools/z13phrases_ngramcheck.js): every word trigram (bigram for two words)
  // occurs inside one sentence of the training corpus
  const attFile = path.join(DIR, 'attested_ngrams.json');
  const attJson = fs.existsSync(attFile) ? JSON.parse(fs.readFileSync(attFile, 'utf8')) : null;
  const att = attJson ? attJson.counts : null;
  const queried = attJson && attJson.queriedList ? new Set(attJson.queriedList) : null;
  let attUnknown = 0, curAttOk = true;
  const attCreated = attJson ? Date.parse(attJson.created) : 0;
  const attested = (ws) => {
    if (!att || !curAttOk) return null;
    const grams = ws.length === 2 ? [ws.join(' ')] : ws.slice(0, -2).map((_, i) => ws.slice(i, i + 3).join(' '));
    if (queried && grams.some((g) => !queried.has(g))) { attUnknown++; return null; } // n-gram not looked up
    return grams.every((g) => !!att[g]);
  };
  const classify = (wordsStr) => {
    const ws = wordsStr.split(' ').filter(Boolean);
    let listed = 0;
    for (let i = 0; i + 1 < ws.length; i++) if (big.has(ws[i] + ' ' + ws[i + 1])) listed++;
    const pairs = ws.length - 1;
    const isAtt = ws.length > 1 ? attested(ws) : null;
    const structure = ws.length === 1 ? 'one-word' : isAtt ? 'attested' : listed === pairs ? 'chain' : listed > 0 ? 'partial' : 'salad';
    const nameToks = ws.filter((w) => w.length >= 3 && names.has(w));
    const firstToks = nameToks.filter((w) => names.get(w).first > 0);
    const themeToks = ws.filter((w) => theme.has(w));
    const plainToks = ws.filter((w) => plainVocab.has(w));
    return { nWords: ws.length, structure, phraseLike: structure === 'one-word' || structure === 'attested', bigramChain: ws.length > 1 && listed === pairs, nameToks, firstToks, themeToks, plainToks };
  };
  const ref = JSON.parse(fs.readFileSync(path.join(DIR, 'null_real_phrases.json'), 'utf8'));

  // classifier calibration on real held-out phrases (same procedure: best wordSegment split)
  const calib = {};
  const refRows = fs.readFileSync(path.join(DIR, 'null_real_phrases.tsv'), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
  for (const L of ['11', '12', '13']) {
    const rows = refRows.filter((r) => r[0] === L);
    const med = ref.lengths[L].logpCommon.p50;
    const tally = (sel) => {
      const t = { n: 0, 'one-word': 0, attested: 0, chain: 0, partial: 0, salad: 0, name: 0, firstName: 0, theme: 0, plainVocab: 0 };
      for (const r of rows.filter(sel)) {
        const ws = lm.wordSegment(r[1], { vocab: 'common' });
        const c = classify(ws.words.join(' '));
        t.n++; t[c.structure]++; if (c.nameToks.length) t.name++; if (c.firstToks.length) t.firstName++; if (c.themeToks.length) t.theme++; if (c.plainToks.length) t.plainVocab++;
      }
      const s = { n: t.n };
      for (const k of ['one-word', 'attested', 'chain', 'partial', 'salad', 'name', 'firstName', 'theme', 'plainVocab']) s[k] = +(t[k] / Math.max(1, t.n)).toFixed(4);
      s.phraseLike = +(s['one-word'] + s.attested).toFixed(4); s.bigramChainOrBetter = +(s['one-word'] + s.attested + s.chain).toFixed(4);
      return s;
    };
    calib[L] = { all: tally(() => true), aboveMedian: tally((r) => +r[4] >= med) };
  }

  // runs
  const runDir = path.join(DIR, 'runs');
  const files = fs.existsSync(runDir) ? fs.readdirSync(runDir).filter((f) => f.endsWith('.json')).sort() : [];
  fs.mkdirSync(path.join(DIR, 'categories'), { recursive: true });
  const runs = [];
  const themeHits = [];
  const allTopAboveMedian = new Map();
  for (const f of files) {
    const r = JSON.parse(fs.readFileSync(path.join(runDir, f), 'utf8'));
    // without a stored query list, only runs written before the attestation scan were queried
    curAttOk = !!queried || fs.statSync(path.join(runDir, f)).mtimeMs <= attCreated;
    const label = r.label || f.replace(/\.json$/, '');
    const L = r.cipher.length;
    const med = r.reference ? r.reference.dist.p50 : null;
    const top = r.top.slice(0, TOPN);
    const cat = { n: top.length, 'one-word': 0, attested: 0, chain: 0, partial: 0, salad: 0, name: 0, firstName: 0, theme: 0, plainVocab: 0 };
    const catMed = { n: 0, 'one-word': 0, attested: 0, chain: 0, partial: 0, salad: 0, name: 0, firstName: 0, theme: 0, plainVocab: 0 };
    const tsv = ['rank\tplaintext\twordLogp\twords\tstructure\tnameTokens\tfirstNameTokens\tthemeTokens\tsolvedPlaintextVocab\taboveRealMedian'];
    for (const t of top) {
      const c = classify(t.words);
      const above = med != null && t.wordLogp >= med;
      for (const T of above ? [cat, catMed] : [cat]) {
        T[c.structure]++; if (c.nameToks.length) T.name++; if (c.firstToks.length) T.firstName++; if (c.themeToks.length) T.theme++; if (c.plainToks.length) T.plainVocab++;
      }
      if (above) catMed.n++;
      tsv.push([t.rank, t.plaintext, t.wordLogp, t.words, c.structure, c.nameToks.join(','), c.firstToks.join(','), c.themeToks.join(','), c.plainToks.join(','), above ? 1 : 0].join('\t'));
      if (c.themeToks.length && above) themeHits.push({ run: label, plaintext: t.plaintext, words: t.words, wordLogp: t.wordLogp, theme: c.themeToks, structure: c.structure });
      if (above && /^w60k5_/.test(label)) {
        const k = t.plaintext + '|' + label.split('_').slice(1).join('_');
        allTopAboveMedian.set(k, { run: label, words: t.words, wordLogp: t.wordLogp, structure: c.structure });
      }
    }
    fs.writeFileSync(path.join(DIR, 'categories', `${label}.tsv`), tsv.join('\n') + '\n');
    const share = (T) => { const s = { n: T.n }; for (const k of ['one-word', 'attested', 'chain', 'partial', 'salad', 'name', 'firstName', 'theme', 'plainVocab']) s[k] = T[k]; s.phraseLike = T['one-word'] + T.attested; s.bigramChainOrBetter = T['one-word'] + T.attested + T.chain; return s; };
    const ac = r.counts.atLeast || {};
    const cnt = (k) => (ac[k] ? ac[k].count : null);
    runs.push({
      label, attestationChecked: curAttOk, cipher: r.cipher.text, length: L, range: r.cipher.range, slips: r.cipher.slips, mode: r.options.mode, vocab: r.options.vocab,
      maxWords: r.options.maxWords, wordsUsed: r.options.wordsUsed, pin: r.options.pin, tlow: r.options.tlow,
      complete: r.counts.complete && !r.counts.taskSample, sampled: r.counts.taskSample ? { k: r.counts.taskSample.k, of: r.counts.taskSample.of } : null,
      estimate: r.counts.estimate ? { consistentStrings: r.counts.estimate.consistentStrings, p50: r.counts.estimate.atLeast.real_p50, p75: r.counts.estimate.atLeast.real_p75, p90: r.counts.estimate.atLeast.real_p90, note: r.counts.estimate.note } : null,
      tasksDone: r.counts.tasksDone, tasks: r.counts.tasks,
      consistentStrings: r.counts.consistentStrings, scored: r.counts.scored,
      atLeast: { p10: cnt('real_p10'), p25: cnt('real_p25'), p50: cnt('real_p50'), p75: cnt('real_p75'), p90: cnt('real_p90'), p95: cnt('real_p95'), p99: cnt('real_p99') },
      thresholds: r.reference ? { p50: r.reference.dist.p50, p75: r.reference.dist.p75, p90: r.reference.dist.p90 } : null,
      posterior: { topShare: r.posterior.topShare, top10Share: r.posterior.top10Share, effN: r.posterior.effectiveNumberExpEntropy, invSimpson: r.posterior.effectiveNumberInverseSimpson,
        unscoredMassBound: r.posterior.unscoredMassBoundFromBoundHistogram, unscoredMassEstimate: r.posterior.unscoredSample ? r.posterior.unscoredSample.massEstimateRelative : null,
        log10Mass: r.posterior.log10TotalMassScored },
      wordsInBestSegmentationAboveMedian: r.wordsInBestSegmentationAboveMedian,
      topCategories: share(cat), aboveMedianCategories: share(catMed),
      best: r.top.slice(0, 10).map((t) => [t.words, t.wordLogp]),
      seconds: r.timeMs ? +(r.timeMs.total / 1000).toFixed(1) : null,
    });
  }
  const byLabel = new Map(runs.map((r) => [r.label, r]));

  // headline: count above the real median, per variant and mode, main runs
  const headline = [];
  for (const v of ['canonical', 'circles_distinct', 'crosshair_null', 'reversed', 'letters_literal']) {
    for (const mode of ['simple', 'homophonic']) {
      for (const fam of ['w60k5', 'w20k4', 'w60k4', 'w60k6', 'full3', 'full2', 'full1', 'llall']) {
        const r = byLabel.get(`${fam}_${v}_${mode}`);
        if (!r) continue;
        headline.push({ variant: v, mode, family: fam, complete: r.complete, sampled: r.sampled, estimate: r.estimate, coverage: r.complete ? 1 : +(r.tasksDone / r.tasks).toFixed(3), consistentStrings: r.consistentStrings,
          aboveRealMedian: r.atLeast.p50, aboveRealP75: r.atLeast.p75, aboveRealP90: r.atLeast.p90, aboveRealP99: r.atLeast.p99,
          phraseLikeAboveMedian: r.aboveMedianCategories.phraseLike, topShare: r.posterior.topShare, effN: r.posterior.effN, unscoredMassEstimate: r.posterior.unscoredMassEstimate, unscoredMassBound: r.posterior.unscoredMassBound, best: r.best[0] });
      }
    }
  }

  // slips: best per position vs no slip
  const slip = {};
  for (const mode of ['simple', 'homophonic']) {
    let base = byLabel.get(mode === 'homophonic' ? 'slipNA_homophonic' : `w60k5_canonical_${mode}`);
    // slip runs on a smaller space (top N words, <= M words) are compared with the no-slip run restricted
    // to that space: its streamed fits (exact above the stream threshold) that split into <= M top-N words
    const anySlip = byLabel.get(`slip00_${mode}`) || byLabel.get(`slip06_${mode}`);
    if (base && anySlip && (anySlip.wordsUsed !== base.wordsUsed || anySlip.maxWords !== base.maxWords)) {
      const tsvF = path.join(runDir, `${base.label}.tsv`);
      const topN = JSON.parse(fs.readFileSync(path.join(runDir, `${anySlip.label}.json`), 'utf8')).options.topWords;
      const M = anySlip.maxWords;
      const allowed = new Set(fs.readFileSync(path.join(ROOT, 'data', 'lm', 'words_common.tsv'), 'latin1').split('\n').filter(Boolean).map((l) => l.split('\t')[0]).filter((w) => w.length <= 13).slice(0, topN));
      const fitsSpace = (pt) => {
        const n = pt.length, best = new Array(n + 1).fill(Infinity);
        best[0] = 0;
        for (let i = 0; i < n; i++) if (best[i] < M) for (let j = i + 1; j <= n; j++) if (allowed.has(pt.slice(i, j)) && best[i] + 1 < best[j]) best[j] = best[i] + 1;
        return best[n] <= M;
      };
      const rowsB = fs.readFileSync(tsvF, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')).filter((r) => fitsSpace(r[0])).map((r) => [r[2], +r[1]]).sort((a, b) => b[1] - a[1]);
      const thr = base.thresholds;
      let mass = 0;
      for (const r of rowsB) mass += Math.pow(10, r[1]);
      base = { label: `${base.label} restricted to top ${topN} words, <= ${M} words (streamed fits >= ${JSON.parse(fs.readFileSync(path.join(runDir, `${base.label}.json`), 'utf8')).options.streamMin.toFixed(2)})`,
        best: rowsB.slice(0, 10), atLeast: { p50: rowsB.filter((r) => r[1] >= thr.p50).length, p75: rowsB.filter((r) => r[1] >= thr.p75).length, p90: rowsB.filter((r) => r[1] >= thr.p90).length },
        posterior: { log10Mass: Math.log10(mass) }, maxWords: M, derived: true };
    }
    const rows = [];
    for (let p = 0; p < 13; p++) {
      const r = byLabel.get(`slip${String(p).padStart(2, '0')}_${mode}`);
      if (!r) continue;
      rows.push({ position: p, symbol: 'AENz0K0M0[NAM'[p], complete: r.complete, maxWords: r.maxWords, consistentStrings: r.consistentStrings, aboveRealMedian: r.atLeast.p50, aboveRealP75: r.atLeast.p75, aboveRealP90: r.atLeast.p90,
        best: r.best[0], second: r.best[1], gapBestToSecond: r.best[1] ? +(r.best[0][1] - r.best[1][1]).toFixed(3) : null, log10Mass: r.posterior.log10Mass });
    }
    if (!rows.length) continue;
    const baseMass = base ? base.posterior.log10Mass : null;
    // heuristic pooled weight: P(no slip) 0.75; one slip at a given position 0.25/13, times ~1/26 for the arbitrary symbol written there
    const wSlip = Math.log10(0.25 / 13 / 26), wNo = Math.log10(0.75);
    const bestOverall = rows.reduce((a, r) => (!a || r.best[1] > a.best[1] ? r : a), null);
    let pooledSlipMass = -Infinity;
    for (const r of rows) { const m = r.log10Mass + wSlip; pooledSlipMass = pooledSlipMass === -Infinity ? m : Math.max(m, pooledSlipMass) + Math.log10(1 + Math.pow(10, -Math.abs(m - pooledSlipMass))); }
    slip[mode] = {
      baseline: base ? { label: base.label, best: base.best[0], second: base.best[1], aboveRealMedian: base.atLeast.p50, aboveRealP75: base.atLeast.p75, log10Mass: baseMass, maxWords: base.maxWords } : null,
      positions: rows,
      bestSlipCandidate: bestOverall ? { position: bestOverall.position, words: bestOverall.best[0], wordLogp: bestOverall.best[1], improvementOverNoSlipBest: base ? +(bestOverall.best[1] - base.best[0][1]).toFixed(3) : null } : null,
      pooled: base ? {
        note: 'heuristic prior: P(no slip)=0.75; a slip at one given position 0.25/13 times 1/26 for the wrong symbol; masses are sums of 10^wordLogp over each run\'s fits',
        log10WeightedMassNoSlip: +(baseMass + wNo).toFixed(3), log10WeightedMassAllSlips: +pooledSlipMass.toFixed(3),
        shareOfSlipHypotheses: 1 / (1 + Math.pow(10, baseMass + wNo - pooledSlipMass)),
        bestSlipCandidateShare: bestOverall ? Math.pow(10, bestOverall.best[1] + wSlip) / (Math.pow(10, baseMass + wNo) + Math.pow(10, pooledSlipMass)) : null,
        bestNoSlipCandidateShare: Math.pow(10, base.best[0][1] + wNo) / (Math.pow(10, baseMass + wNo) + Math.pow(10, pooledSlipMass)),
      } : null,
    };
  }

  // null letters at the ends
  const ends = {};
  for (const mode of ['simple', 'homophonic']) {
    const rows = runs.filter((r) => r.label.startsWith('ends_') && r.mode === mode).map((r) => ({ label: r.label, range: r.range, cipher: r.cipher, complete: r.complete, maxWords: r.maxWords, consistentStrings: r.consistentStrings,
      aboveRealMedian: r.atLeast.p50, aboveRealP75: r.atLeast.p75, aboveRealP90: r.atLeast.p90, realMedian: r.thresholds && r.thresholds.p50, best: r.best.slice(0, 5) }));
    if (rows.length) ends[mode] = rows;
  }

  // one- and two-word handles (full vocabulary)
  const handles = {};
  for (const r of runs.filter((x) => /^full[12]_/.test(x.label))) {
    const rr = JSON.parse(fs.readFileSync(path.join(runDir, `${r.label}.json`), 'utf8'));
    handles[r.label] = { complete: r.complete, fits: r.consistentStrings, aboveRealMedian: r.atLeast.p50,
      top: rr.top.slice(0, 40).map((t) => { const c = classify(t.words); return [t.words, t.wordLogp, c.nameToks.join(','), c.themeToks.join(',')]; }) };
  }

  const summary = {
    tool: 'tools/z13phrases_analyze.js', created: new Date().toISOString(), topN: TOPN,
    reference: Object.fromEntries(Object.entries(ref.lengths).map(([L, e]) => [L, { medianCommon: e.logpCommon.p50, p75Common: e.logpCommon.p75, p90Common: e.logpCommon.p90, medianFull: e.logpFull.p50, coverage: e.coverage }])),
    classifierCalibration: calib,
    headline, slip, ends, handles,
    themeHitsAboveMedian: themeHits.sort((a, b) => b.wordLogp - a.wordLogp).slice(0, 300),
    themeHitsAboveMedianCount: themeHits.length,
    runs,
  };
  fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(`runs ${runs.length}; theme hits above median ${themeHits.length}`);
  for (const h of headline) console.log(`${h.family} ${h.variant} ${h.mode}: complete=${h.complete} strings=${h.consistentStrings} >=median ${h.aboveRealMedian} >=p75 ${h.aboveRealP75} >=p90 ${h.aboveRealP90} phraseLike>=med ${h.phraseLikeAboveMedian} topShare ${h.topShare && h.topShare.toFixed(3)} best ${JSON.stringify(h.best)}`);
}

main();
