'use strict';
// Reviewer check: crosshair as a WORD BOUNDARY (task item 1 asked for it; the attacker ran only
// crosshair-as-null).  Reads the crosshair_null streams (12 letters = AEN + 0K0M0[NAM) and counts
// fits >= the 12-letter real median whose letters split as [3 letters][9 letters] into words of the
// 60006 common list (each side scored with lm.wordSegment, joined score reported).
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const DIR = path.join(__dirname, '..', 'results', 'z13phrases');
const ref = JSON.parse(fs.readFileSync(path.join(DIR, 'null_real_phrases.json'), 'utf8')).lengths['12'].logpCommon;
const V = lm.vocab('common');
// can s be split into words of the common list (<= 5 words)?
function splits(s) {
  const n = s.length, best = new Array(n + 1).fill(Infinity); best[0] = 0;
  for (let i = 0; i < n; i++) if (best[i] < 5) for (let j = i + 1; j <= n; j++) if (V.map.has(s.slice(i, j)) && best[i] + 1 < best[j]) best[j] = best[i] + 1;
  return best[n] <= 5;
}
const out = {};
for (const mode of ['simple', 'homophonic']) {
  const f = path.join(DIR, 'runs', `w60k5_crosshair_null_${mode}.tsv`);
  const rows = fs.readFileSync(f, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
  const above = rows.filter((r) => +r[1] >= ref.p50);
  const ok = above.filter((r) => splits(r[0].slice(0, 3)) && splits(r[0].slice(3)));
  const bestSegAt3 = above.filter((r) => { let k = 0; for (const w of r[2].split(' ')) { k += w.length; if (k === 3) return true; if (k > 3) return false; } return false; });
  // all streamed fits with a 3|9 split, ranked
  const any = rows.filter((r) => splits(r[0].slice(0, 3)) && splits(r[0].slice(3))).sort((a, b) => +b[1] - +a[1]).slice(0, 10).map((r) => [r[2], +r[1]]);
  out[mode] = { streamed: rows.length, aboveMedian12: above.length, aboveMedianWithSplitAt3: ok.length, aboveMedianBestSegBoundaryAt3: bestSegAt3.length, fitsAbove: above.map((r) => r[2]), topWithSplitAt3: any };
}
console.log(JSON.stringify({ median12: ref.p50, out }, null, 1));
