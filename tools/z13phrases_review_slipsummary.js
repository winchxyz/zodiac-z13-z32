'use strict';
// Reviewer: combine the slip-null batches (results/z13phrases/review/slipnull*.json) into one summary.
//   node tools/z13phrases_review_slipsummary.js -> results/z13phrases/review/slipnull_combined.json
const fs = require('fs');
const path = require('path');
const D = path.join(__dirname, '..', 'results', 'z13phrases', 'review');
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); } catch (_) { return null; } };
const A = load('slipnull.json'), B = load('slipnull_b.json'), E = load('slipnull_eng.json');
const z = A.rows[0];
const scr = [...A.rows.slice(1), ...(B ? B.rows.slice(1) : [])].filter((r) => r.allComplete);
const eng = E ? E.rows.slice(1).filter((r) => r.allComplete) : [];
const ge = (rows, f, v) => rows.filter((r) => r[f] != null && r[f] >= v).length;
const q = (a, p) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); if (!s.length) return null; const x = (s.length - 1) * p, lo = Math.floor(x), hi = Math.ceil(x); return +(s[lo] + (s[hi] - s[lo]) * (x - lo)).toFixed(3); };
const desc = (rows, f) => ({ n: rows.filter((r) => r[f] != null).length, min: q(rows.map((r) => r[f]), 0), median: q(rows.map((r) => r[f]), 0.5), p90: q(rows.map((r) => r[f]), 0.9), max: q(rows.map((r) => r[f]), 1) });
const out = {
  space: 'simple substitution, top 5000 common words, <= 4 words; no slip and one wildcard at each of 13 positions',
  z13: { noSlipBest: z.noSlip && [z.noSlip.best, z.noSlip.bestLogp], maxSlip: [z.maxSlipBest, z.maxSlipBestLogp], improvement: z.improvement, slipAboveMedianTotal: z.slipAboveMedianTotal },
  scrambles: {
    n: scr.length,
    maxSlipBestLogp: desc(scr, 'maxSlipBestLogp'), improvement: desc(scr, 'improvement'), slipAboveMedianTotal: desc(scr, 'slipAboveMedianTotal'),
    atLeastZ13: { maxSlipBestLogp: ge(scr, 'maxSlipBestLogp', z.maxSlipBestLogp), improvement: ge(scr, 'improvement', z.improvement), slipAboveMedianTotal: ge(scr, 'slipAboveMedianTotal', z.slipAboveMedianTotal) },
    empiricalP_maxSlipBest: +((ge(scr, 'maxSlipBestLogp', z.maxSlipBestLogp) + 1) / (scr.length + 1)).toFixed(4),
    empiricalP_improvement: +((ge(scr, 'improvement', z.improvement) + 1) / (scr.filter((r) => r.improvement != null).length + 1)).toFixed(4),
    top: scr.map((r) => [r.maxSlipBest, r.maxSlipBestLogp]).sort((a, b) => b[1] - a[1]).slice(0, 5),
  },
  english: eng.length ? {
    n: eng.length,
    maxSlipBestLogp: desc(eng, 'maxSlipBestLogp'), improvement: desc(eng, 'improvement'), noSlipBest: desc(eng.map((r) => ({ v: r.noSlip && r.noSlip.bestLogp })), 'v'),
    atLeastZ13: { maxSlipBestLogp: ge(eng, 'maxSlipBestLogp', z.maxSlipBestLogp), improvement: ge(eng, 'improvement', z.improvement) },
    rows: eng.map((r) => ({ truth: r.truth, noSlip: r.noSlip && [r.noSlip.best, r.noSlip.bestLogp], maxSlip: [r.maxSlipBest, r.maxSlipBestLogp], improvement: r.improvement })),
  } : null,
};
fs.writeFileSync(path.join(D, 'slipnull_combined.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
