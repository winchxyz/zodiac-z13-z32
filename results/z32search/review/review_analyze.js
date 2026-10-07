#!/usr/bin/env node
'use strict';
/**
 * results/z32search/review/review_analyze.js - aggregates the review reruns:
 *   1. exact reproduction of three nullfree jobs (repro/runs.jsonl vs ../nullfree/runs.jsonl)
 *   2. run-to-run variance of crib-constrained optima (cribvar/runs.jsonl, seeds 3, 31, 32, 33)
 *   3. crib cost with equal-effort baselines: every cipher's free best = mean over seeds 101-103
 *      (Z32 from ../nullfree, nulls from ../nullfree seed 101 + baseline/runs.jsonl seeds 102, 103)
 *   4. RADIANS pass 1 + pass 2 combined (max over both passes for every cipher)
 * Writes review/review_summary.json.   node results/z32search/review/review_analyze.js
 */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const rd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : []);
const best = (r) => r.solutions[0].score;
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const out = {};

// 1. reproduction
const nf = rd(path.join(R, 'nullfree', 'runs.jsonl'));
const rep = rd(path.join(__dirname, 'repro', 'runs.jsonl'));
out.repro = rep.map((r) => { const o = nf.find((x) => x.id === r.id); return { id: r.id, original: r2(best(o)), rerun: r2(best(r)), originalWords: o.solutions[0].words, rerunWords: r.solutions[0].words, truthOriginal: o.truth ? r2(o.truth.score) : null, truthRerun: r.truth ? r2(r.truth.score) : null }; });

// baselines (mean over 3 seeds of 80 restarts x 150k)
const base = new Map();
const addB = (cid, v) => { if (!base.has(cid)) base.set(cid, []); base.get(cid).push(v); };
for (const r of nf) { if (r.group === 'z32') addB('z32', best(r)); else addB(r.id.replace(/_main100$/, ''), best(r)); }
for (const r of rd(path.join(__dirname, 'baseline', 'runs.jsonl'))) addB(r.id.replace(/_main100_seed\d+$/, ''), best(r));
out.baselines = Object.fromEntries([...base].map(([k, v]) => [k, { seeds: v.map(r2), mean: r2(mean(v)), max: r2(Math.max(...v)) }]));

// 2-3. crib variance and fair costs
const cv = rd(path.join(__dirname, 'cribvar', 'runs.jsonl')).filter((r) => !r.error);
out.cribvar = {};
for (const w of [...new Set(cv.map((r) => r.meta.word))]) {
  const rows = [];
  for (const cid of [...new Set(cv.filter((r) => r.meta.word === w).map((r) => r.meta.cipher))]) {
    const runs = cv.filter((r) => r.meta.word === w && r.meta.cipher === cid);
    const scores = runs.map((r) => ({ seed: r.meta.seed, best: best(r), words: r.solutions[0].words }));
    const b = base.get(cid);
    const bm = b ? mean(b) : null;
    const costs = scores.map((s) => bm - s.best);
    rows.push({ cipher: cid, placements: runs[0].meta.placements, perSeedBest: scores.map((s) => r2(s.best)), spread: r2(Math.max(...scores.map((s) => s.best)) - Math.min(...scores.map((s) => s.best))), sdOverSeeds: r2(sd(scores.map((s) => s.best))), baselineMean: r2(bm), costPerSeed: costs.map(r2), costMean: r2(mean(costs)), costOfMaxOverSeeds: r2(bm - Math.max(...scores.map((s) => s.best))), bestOverSeeds: scores.slice().sort((a, c) => c.best - a.best)[0].words });
  }
  const z = rows.find((x) => x.cipher === 'z32');
  const nulls = rows.filter((x) => x.cipher !== 'z32');
  out.cribvar[w] = {
    rows,
    z32CostMean: z ? z.costMean : null,
    nullCostMeans: nulls.map((x) => x.costMean),
    nullsWithLowerMeanCost: z ? nulls.filter((x) => x.costMean < z.costMean).length + '/' + nulls.length : null,
    z32CostOfMax: z ? z.costOfMaxOverSeeds : null,
    nullCostOfMax: nulls.map((x) => x.costOfMaxOverSeeds),
    nullsWithLowerCostOfMax: z ? nulls.filter((x) => x.costOfMaxOverSeeds < z.costOfMaxOverSeeds).length + '/' + nulls.length : null,
    // single-seed rank of Z32 among nulls, per seed (how unstable is the attacker's one-seed test?)
    z32RankPerSeed: z ? z.costPerSeed.map((c, k) => nulls.filter((x) => x.costPerSeed[k] < c).length + '/' + nulls.length + ' nulls cheaper') : null,
    meanSeedSpreadAllCiphers: r2(mean(rows.map((x) => x.spread))),
  };
}

// 4. RADIANS pass 1 + pass 2 combined, with the attacker's own baselines (max of 3 seeds for Z32, seed 101 for nulls)
{
  const p1 = rd(path.join(R, 'cribs', 'runs.jsonl')).filter((r) => !r.error && r.meta.word === 'RADIANS');
  const p1n = rd(path.join(R, 'cribnull', 'runs.jsonl')).filter((r) => !r.error && r.meta.word === 'RADIANS');
  const p2 = rd(path.join(R, 'cribs2', 'runs.jsonl')).filter((r) => !r.error && r.meta.word === 'RADIANS');
  const bestBy = new Map();
  const upd = (cid, v, tag) => { const e = bestBy.get(cid) || {}; e[tag] = v; bestBy.set(cid, e); };
  for (const r of p1) upd('z32', best(r), 'pass1');
  for (const r of p1n) upd(r.meta.null, best(r), 'pass1');
  for (const r of p2) upd(r.meta.cipher, best(r), 'pass2');
  const attackerBase = (cid) => (cid === 'z32' ? Math.max(...base.get('z32').slice(0, 3)) : base.get(cid)[0]);
  const rows = [...bestBy].map(([cid, e]) => {
    const m = Math.max(...[e.pass1, e.pass2].filter((x) => x != null));
    return { cipher: cid, pass1: r2(e.pass1), pass2: r2(e.pass2), combinedBest: r2(m), costAttackerBaseline: r2(attackerBase(cid) - m), costMeanBaseline: r2(mean(base.get(cid)) - m) };
  });
  const z = rows.find((x) => x.cipher === 'z32');
  const nb = rows.filter((x) => x.cipher !== 'z32' && x.pass2 != null);
  out.radiansCombined = { rows, z32CostAttackerBaseline: z.costAttackerBaseline, nullsCheaperAttackerBaseline: nb.filter((x) => x.costAttackerBaseline < z.costAttackerBaseline).length + '/' + nb.length, nullsCheaperMeanBaseline: nb.filter((x) => x.costMeanBaseline < z.costMeanBaseline).length + '/' + nb.length };
}

fs.writeFileSync(path.join(__dirname, 'review_summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
