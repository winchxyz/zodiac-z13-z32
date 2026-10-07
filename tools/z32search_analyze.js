#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_analyze.js - aggregates every z32search output into results/z32search/summary.json
 * and prints the key numbers.  Reads (whatever exists):
 *   results/z32search/{free,nullfree,orders,ordernull,cribs,cribnull,pairs}/runs.jsonl  (tools/z32search_solve.js)
 *   results/z32search/heldout/heldout.json, grammar/grammar.json, enumerate/*.json
 *   node tools/z32search_analyze.js
 */
const fs = require('fs');
const path = require('path');
const Z = require('./z32search_lib');
const lm = require('./lm');

const R = path.join(Z.ROOT, 'results', 'z32search');
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : []);
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const best = (r) => (r.solutions && r.solutions.length ? r.solutions[0] : null);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const out = { tool: 'tools/z32search_analyze.js', created: new Date().toISOString(), sections: {} };

/* expected Hamming distance between unrelated English strings of 32 letters */
const f = lm.meta().ngrams.letter_frequencies;
let sp2 = 0;
for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') sp2 += f[c] * f[c];
const hamRandom = 32 * (1 - sp2);

function hammingStats(pts) {
  const d = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) d.push(Z.hamming(pts[i], pts[j]));
  const toBest = pts.slice(1).map((p) => Z.hamming(pts[0], p));
  return { n: pts.length, pairs: d.length, mean: d.length ? r2(d.reduce((a, b) => a + b, 0) / d.length) : null, quantiles: Z.quantiles(d), toBestQuantiles: Z.quantiles(toBest), pairsWithin8: d.filter((x) => x <= 8).length, pairsWithin16: d.filter((x) => x <= 16).length };
}

/* ------------------------------------------------------------ 1. free search */
{
  const runs = readJsonl(path.join(R, 'free', 'runs.jsonl')).filter((r) => !r.error);
  const configs = runs.map((r) => {
    const sols = r.solutions || [];
    const fluent = sols.filter((s) => s.unknown === 0);
    return {
      id: r.id, n: r.options.n, wordweight: r.options.wordweight, entropy: r.options.entropy, restarts: r.options.restarts, iters: r.options.iters,
      distinctKeys: r.summary.distinct, bestHits: r.summary.bestHits, reported: sols.length, fluentInReported: fluent.length,
      best: best(r) ? { words: best(r).words, score: r2(best(r).score), ng5: r2(best(r).ng5), wordLogp: r2(best(r).wordLogp) } : null,
      bestByWordLogp: sols.length ? (() => { const b = sols.slice().sort((a, c) => c.wordLogp - a.wordLogp)[0]; return { words: b.words, wordLogp: r2(b.wordLogp), ng5: r2(b.ng5) }; })() : null,
      hamming: hammingStats(sols.map((s) => s.plaintext)),
      seconds: r2(r.summary.ms / 1000),
    };
  });
  // pooled over all configs on the canonical text (written order)
  const pool = new Map();
  for (const r of runs) if (r.group === 'free') for (const s of r.solutions || []) if (!pool.has(s.plaintext)) pool.set(s.plaintext, s);
  const all = [...pool.values()];
  const fluent = all.filter((s) => s.unknown === 0).sort((a, b) => b.wordLogp - a.wordLogp);
  const top200 = fluent.slice(0, 200);
  out.sections.free = {
    note: 'homophonic anneal on z32.canonical; the variants bar_is_serif_I, t2_is_perp, bar_I_and_t2_perp and tau_distinct have the same isomorph as canonical, so a homophonic solver gives identical results on them; triangles_merged differs (p1=p11=p31)',
    configs,
    totalRestarts: runs.filter((r) => r.group === 'free').reduce((a, r) => a + r.options.restarts, 0),
    pooledDistinctReported: all.length,
    pooledFluent: fluent.length,
    pooledFluentTop: top200.slice(0, 40).map((s) => ({ words: s.words, wordLogp: r2(s.wordLogp), ng5: r2(s.ng5) })),
    pooledFluentTop200Hamming: hammingStats(top200.map((s) => s.plaintext)),
    hammingExpectedUnrelatedEnglish: r2(hamRandom),
    bestByNgram5: all.length ? (() => { const b = all.slice().sort((a, c) => c.ng5 - a.ng5)[0]; return { words: b.words, ng5: r2(b.ng5), wordLogp: r2(b.wordLogp) }; })() : null,
  };
}

/* held-out English that fits Z32 */
const held = readJson(path.join(R, 'heldout', 'heldout.json'));
if (held) {
  const v = held.variants.canonical;
  out.sections.heldout = {
    windows: held.corpus.distinctWindows, fitsZ32: v.fits, oneIn: r2(v.oneIn), nullPercentileAtOrAbove: v.nullPercentile.atOrAbove,
    nullFitsQuantiles: held.null.quantiles, singlePairEqualityRate: r2(held.singlePairEqualityRate * 1e4) / 1e4,
    trianglesMergedFits: held.variants.triangles_merged.fits,
    examples: v.bestByWordLogp.slice(0, 12).map((x) => ({ phrase: x.phrase, wordLogp: r2(x.wordLogp), ng5: r2(x.ng5) })),
    fitScoreQuantiles: { wordLogp: v.allFitScoreQuantiles.wordLogp, ng5: v.allFitScoreQuantiles.ng5 },
    ordersTop5: held.orders.slice(0, 5).map((o) => ({ id: o.id, fits: o.fits, nullPge: o.nullPercentile.atOrAbove })),
    ordersBottom3: held.orders.slice(-3).map((o) => ({ id: o.id, fits: o.fits, nullPge: o.nullPercentile.atOrAbove })),
  };
}

/* ------------------------------------------------------------ 2. null for the free search */
const nullfree = readJsonl(path.join(R, 'nullfree', 'runs.jsonl')).filter((r) => !r.error);
const freeBestOf = new Map();
{
  const z = nullfree.filter((r) => r.group === 'z32');
  const n = nullfree.filter((r) => r.group === 'null');
  for (const r of nullfree) freeBestOf.set(r.id, best(r));
  const zb = z.map((r) => best(r).score), nb = n.map((r) => best(r).score);
  const ms = Z.meanSd(nb);
  out.sections.nullFree = {
    settings: z[0] ? z[0].options : null,
    z32BestScores: zb.map(r2), z32BestWords: z.map((r) => best(r).words),
    nullBestScores: nb.map(r2), nullMeanSd: { mean: r2(ms.mean), sd: r2(ms.sd), n: ms.n },
    z32MeanZ: ms.sd ? r2((zb.reduce((a, b) => a + b, 0) / Math.max(1, zb.length) - ms.mean) / ms.sd) : null,
    nullRows: n.map((r) => ({ id: r.id, truth: r.truth.words, truthScore: r2(r.truth.score), truthWordLogp: r2(r.truth.wordLogp), solverBest: best(r).words, solverScore: r2(best(r).score), solverWordLogp: r2(best(r).wordLogp), accuracy: best(r).accuracy, truthBeatsSolver: r.truth.score > best(r).score, truthInReported: (r.solutions || []).some((s) => s.plaintext === r.truth.plaintext) })),
  };
  const rows = out.sections.nullFree.nullRows;
  out.sections.nullFree.truthRecovered = rows.filter((x) => x.truthInReported).length;
  out.sections.nullFree.solverAboveTruth = rows.filter((x) => !x.truthBeatsSolver).length;
  out.sections.nullFree.meanAccuracy = rows.length ? r2(rows.reduce((a, x) => a + (x.accuracy || 0), 0) / rows.length) : null;
}

/* ------------------------------------------------------------ 3. cribs */
{
  const cr = readJsonl(path.join(R, 'cribs', 'runs.jsonl'));
  const cn = readJsonl(path.join(R, 'cribnull', 'runs.jsonl')).filter((r) => !r.error);
  const z32Free = [...nullfree.filter((r) => r.group === 'z32')].map((r) => best(r).score);
  const z32FreeBest = z32Free.length ? Math.max(...z32Free) : null;
  const rows = cr.map((r) => {
    if (r.error) return { word: r.meta && r.meta.word, error: r.error };
    const b = best(r);
    return { word: r.meta.word, category: r.meta.category, placements: r.meta.placements, best: b.words, bestScore: r2(b.score), bestWordLogp: r2(b.wordLogp), unknown: b.unknown, position: b.cribPositions ? b.cribPositions[0] : null, costVsZ32Free: z32FreeBest != null ? r2(z32FreeBest - b.score) : null };
  }).sort((a, b) => (b.bestScore ?? -1e9) - (a.bestScore ?? -1e9));
  // null comparison for key cribs: cost = free best (nullfree, same cipher) - crib best
  const nullFreeBest = new Map();
  for (const r of nullfree.filter((x) => x.group === 'null')) nullFreeBest.set(r.id.replace(/_main\d+$/, ''), best(r).score);
  const byWord = new Map();
  for (const r of cn) {
    const w = r.meta.word, nl = r.meta.null;
    if (!byWord.has(w)) byWord.set(w, []);
    const fb = nullFreeBest.get(nl);
    byWord.get(w).push({ null: nl, cribBest: best(r).score, cost: fb != null ? fb - best(r).score : null, truthContainsWord: r.truth.plaintext.includes(w) });
  }
  const keyCmp = [];
  for (const [w, arr] of byWord) {
    const z = rows.find((x) => x.word === w);
    const costs = arr.map((x) => x.cost).filter((x) => x != null);
    const scores = arr.map((x) => x.cribBest);
    keyCmp.push({ word: w, z32CribBest: z ? z.bestScore : null, z32Cost: z ? z.costVsZ32Free : null, nullCribBest: scores.map(r2), nullCosts: costs.map(r2), nullCostMeanSd: (() => { const m = Z.meanSd(costs); return { mean: r2(m.mean), sd: r2(m.sd), n: m.n }; })(), z32CostRankAmongNull: z && z.costVsZ32Free != null ? costs.filter((c) => c <= z.costVsZ32Free).length + '/' + costs.length + ' nulls have cost <= Z32' : null });
  }
  out.sections.cribs = {
    settings: cr.find((r) => !r.error) ? cr.find((r) => !r.error).options : null,
    z32FreeBestSameFamily: r2(z32FreeBest), freeBestNote: 'Z32 free best = best of the three 100-restart, 150k-iteration main-config runs (nullfree); crib runs use 120k iterations and one restart per placement, so a crib best can only be lower unless the free search missed the optimum',
    ranked: rows, keyCribNullComparison: keyCmp,
    anyCribAboveFree: rows.filter((x) => x.costVsZ32Free != null && x.costVsZ32Free < 0).map((x) => x.word),
  };
  const pr = readJsonl(path.join(R, 'pairs', 'runs.jsonl')).filter((r) => !r.error);
  out.sections.pairs = pr.map((r) => ({ id: r.id, group: r.group, placements: r.meta.placements, best: best(r).words, bestScore: r2(best(r).score), wordLogp: r2(best(r).wordLogp), positions: best(r).cribPositions ? best(r).cribPositions[0] : null, top5: (r.solutions || []).slice(0, 5).map((s) => `${r2(s.score)} ${s.words}`), costVsFree: r.group === 'pair' ? (z32FreeBest != null ? r2(z32FreeBest - best(r).score) : null) : (nullFreeBest.get(r.meta.null) != null ? r2(nullFreeBest.get(r.meta.null) - best(r).score) : null) }));
}

/* crib pass 2 (RADIANS, 2 restarts per placement, Z32 vs 6 nulls) and pair feasibility */
{
  const c2 = readJsonl(path.join(R, 'cribs2', 'runs.jsonl')).filter((r) => !r.error);
  if (c2.length) {
    const nullFreeBest = new Map();
    for (const r of nullfree.filter((x) => x.group === 'null')) nullFreeBest.set(r.id.replace(/_main\d+$/, ''), best(r).score);
    const z32Free = nullfree.filter((r) => r.group === 'z32').map((r) => best(r).score);
    const zf = z32Free.length ? Math.max(...z32Free) : null;
    const rows = c2.map((r) => {
      const cid = r.meta.cipher;
      const fb = cid === 'z32' ? zf : nullFreeBest.get(cid);
      return { word: r.meta.word, cipher: cid, placements: r.meta.placements, best: best(r).words, bestScore: r2(best(r).score), position: best(r).cribPositions ? best(r).cribPositions[0] : null, cost: fb != null ? r2(fb - best(r).score) : null };
    });
    const z = rows.find((x) => x.cipher === 'z32');
    const nc = rows.filter((x) => x.cipher !== 'z32').map((x) => x.cost);
    out.sections.cribs2 = { settings: c2[0].options, rows, z32Cost: z ? z.cost : null, nullCosts: nc, nullsWithLowerOrEqualCost: z ? nc.filter((c) => c <= z.cost).length : null };
  }
  const feas = readJson(path.join(R, 'pairs', 'feasibility.json'));
  if (feas) out.sections.pairFeasibility = { nullPatterns: feas.nullPatterns, rows: feas.pairs.map((p) => ({ words: p.words.join('+'), z32: p.z32, nullMedian: p.nullQuantiles[0.5], null95: p.nullQuantiles[0.95], PnullGe: p.PnullGe })), note: 'Z32 admits more two-word placements than most random 3-pair patterns for theme and control pairs alike: its repeated pairs touch the edge positions 0, 1 and 31, which few placements cover' };
  const typ = readJson(path.join(R, 'heldout', 'typical.json'));
  if (typ) out.sections.typicalSet = { bitsPerLetter5gram: r2(typ.bitsPerLetter_5gram), bitsPerLetterWords: r2(typ.bitsPerLetter_words), fractionFittingZ32: typ.fractionFittingZ32, log10EnglishTextsFittingZ32_5gram: r2(typ.log10EnglishTextsFittingZ32_5gram), log10EnglishTextsFittingZ32_words: r2(typ.log10EnglishTextsFittingZ32_words), note: typ.note };
}

/* ------------------------------------------------------------ 4. read orders */
{
  const ord = readJsonl(path.join(R, 'orders', 'runs.jsonl')).filter((r) => !r.error);
  const on = readJsonl(path.join(R, 'ordernull', 'runs.jsonl')).filter((r) => !r.error);
  const nullBy = new Map();
  for (const r of on) { const k = r.meta.order; if (!nullBy.has(k)) nullBy.set(k, []); nullBy.get(k).push(best(r).score); }
  const allNull = on.map((r) => best(r).score);
  const ms = Z.meanSd(allNull);
  const rows = ord.map((r) => {
    const b = best(r);
    const id = r.id.replace(/^order_/, '');
    const own = nullBy.get(id);
    return { id, family: r.meta.family, pairs: r.pairs, best: b.words, bestScore: r2(b.score), wordLogp: r2(b.wordLogp), z: ms.sd ? r2((b.score - ms.mean) / ms.sd) : null, ownNull: own ? own.map(r2) : null };
  }).sort((a, b) => b.bestScore - a.bestScore);
  const sc = rows.map((x) => x.bestScore);
  out.sections.orders = {
    settings: ord[0] ? ord[0].options : null, count: rows.length,
    pooledNull: { n: allNull.length, mean: r2(ms.mean), sd: r2(ms.sd), quantiles: Z.quantiles(allNull.map(r2)) },
    orderScoreSpread: { meanSd: Z.meanSd(sc), quantiles: Z.quantiles(sc) },
    ranked: rows,
    note: 'a homophonic solver sees only the isomorph of the reordered text, i.e. where the three repeated pairs fall; the null for every order is therefore a random 3-pair pattern (ordernull runs the null ciphers through the written and skip19 orders as a check)',
  };
}

/* ------------------------------------------------------------ 5. grammar + enumerate */
const gram = readJson(path.join(R, 'grammar', 'grammar.json')) || readJson(path.join(R, 'grammar', 'grammar_quick.json'));
const member = readJson(path.join(R, 'grammar', 'published_membership.json'));
if (gram) {
  out.sections.grammar = {
    derivationsOfLength32: gram.totals.derivationsOfLength32, fitZ32: gram.totals.fitZ32, oneIn: r2(gram.totals.oneIn),
    nullTotalQuantiles: gram.null.totalQuantiles, nullPgeZ32: gram.null.PgeZ32, nullPatterns: gram.null.patterns,
    forms: gram.forms.map((x) => ({ id: x.id, total: x.derivationsOfLength32, fitZ32: x.fitZ32, nullMedian: x.nullQuantiles[0.5], nullPge: x.nullPgeZ32 })),
    z32DistinctStrings: gram.z32List.distinctStrings, integerOnly: gram.z32List.integerOnly, integerOnlyFullUnitWords: gram.z32List.integerOnlyFullUnitWords,
    integerOnlyFullUnitWordsTop: gram.z32List.integerOnlyFullUnitWordsTop.slice(0, 40).map((x) => `${r2(x.wordLogp)} ${x.tokens}`),
    topOverall: gram.z32List.top.slice(0, 20).map((x) => `${r2(x.wordLogp)} ${x.tokens}`),
    ordersTop5: gram.orders.slice(0, 5).map((o) => ({ id: o.id, fits: o.fits, PnullGe: o.PnullGe })),
    lookElsewhere: gram.lookElsewhere, orderDetail: gram.orderDetail, published: member || gram.published, listing: gram.z32List.listing, ordersTested: gram.orders.map((o) => ({ id: o.id, fits: o.fits, PnullGe: o.PnullGe, pairs: o.pairs })),
  };
}
{
  const E = path.join(R, 'enumerate');
  const z5 = readJson(path.join(E, 'z32_m5.json')), z6 = readJson(path.join(E, 'z32_m6.json'));
  const nulls = [];
  if (fs.existsSync(path.join(E))) for (const fn of fs.readdirSync(E)) if (/^null\d+_m5\.json$/.test(fn)) nulls.push(readJson(path.join(E, fn)).counts.consistentStrings);
  if (z5 || z6) {
    let structured = null;
    const tsv = path.join(E, 'z32_m5_fits.tsv');
    if (fs.existsSync(tsv)) {
      const lines = fs.readFileSync(tsv, 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split('\t')[0]);
      const vocab = fs.readFileSync(path.join(E, 'theme_words.tsv'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')[0]);
      const RU = new Set(['RADIAN', 'RADIANS', 'RAD', 'RADS']), IU = new Set(['INCH', 'INCHES', 'INS']);
      // is there a split into <= 5 theme words that contains a radian unit and an inch unit?  (one example split)
      const splitWith = (s) => {
        const rec = (i, toks) => {
          if (i === s.length) return toks.some((t) => RU.has(t)) && toks.some((t) => IU.has(t)) ? toks.slice() : null;
          if (toks.length >= 5) return null;
          for (const w of vocab) if (s.startsWith(w, i)) { toks.push(w); const r = rec(i + w.length, toks); toks.pop(); if (r) return r; }
          return null;
        };
        return rec(0, []);
      };
      const both = [];
      for (const s of lines) { const sp = splitWith(s); if (sp) both.push(sp.join(' ')); }
      structured = { fitsM5: lines.length, withRadianAndInchUnit: both.length, examples: both.slice(0, 40) };
    }
    out.sections.enumerate = {
      wordList: 'results/z32search/enumerate/theme_words.tsv (76 theme words)',
      z32: { maxWords5: z5 ? z5.counts : null, maxWords6: z6 ? z6.counts : null },
      nullMaxWords5: { n: nulls.length, quantiles: Z.quantiles(nulls), PgeZ32: z5 && nulls.length ? nulls.filter((c) => c >= z5.counts.consistentStrings).length / nulls.length : null },
      structured,
    };
  }
}

fs.writeFileSync(path.join(R, 'summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, (k, v) => (k === 'ranked' || k === 'configs' || k === 'nullRows' || k === 'orderDetail' ? (Array.isArray(v) ? v.slice(0, 12) : v) : v), 1).slice(0, 60000));
