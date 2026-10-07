'use strict';
// Reviewer: compare a reproduction run JSON with the attacker's run JSON (counts, thresholds, top fits).
//   node tools/z13phrases_review_compare.js results/z13phrases/review/repro_X.json results/z13phrases/runs/X.json
const fs = require('fs');
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const pick = (r) => ({
  text: r.cipher.text, slips: r.cipher.slips, mode: r.options.mode, topWords: r.options.topWords, maxWords: r.options.maxWords, tlow: r.options.tlow,
  complete: r.counts.complete, consistentStrings: r.counts.consistentStrings, scored: r.counts.scored,
  atLeast: Object.fromEntries(Object.entries(r.counts.atLeast).map(([k, v]) => [k, v.count])),
  topShare: r.posterior.topShare && +r.posterior.topShare.toFixed(4), effN: +r.posterior.effectiveNumberExpEntropy.toFixed(2),
  top5: r.top.slice(0, 5).map((t) => `${t.words} ${t.wordLogp}`),
});
const A = pick(a), B = pick(b);
console.log('repro   ', JSON.stringify(A));
console.log('attacker', JSON.stringify(B));
const same = JSON.stringify({ ...A, tlow: 0 }) === JSON.stringify({ ...B, tlow: 0 });
console.log(same ? 'IDENTICAL (all compared fields)' : 'DIFFERENT');
// compare full top lists
const n = Math.min(a.top.length, b.top.length);
let diff = 0;
for (let i = 0; i < n; i++) if (a.top[i].plaintext !== b.top[i].plaintext || Math.abs(a.top[i].wordLogp - b.top[i].wordLogp) > 1e-4) diff++;
console.log(`top lists: ${a.top.length} vs ${b.top.length}, ${diff} of the first ${n} differ`);
