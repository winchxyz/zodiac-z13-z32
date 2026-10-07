'use strict';
/**
 * Independent re-derivation of the iid-letter baseline P(13 independent English letters fit the
 * symbol pattern) by a DP over letters (each letter is given to at most one unassigned symbol), not
 * by inclusion-exclusion as in tools/z13names_stats.js. Homophonic: product over symbols of sum p^c.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const uni = new Float32Array(fs.readFileSync(path.join(ROOT, 'data/lm/ngram1.bin')).buffer.slice(0));
const p = Array.from(uni.slice(0, 26), (x) => Math.pow(10, x));
console.log('sum p =', p.reduce((a, b) => a + b, 0).toFixed(6));
const V = { 'z13.canonical': 'AENz0K0M0[NAM', 'z13.crosshair_null': 'AEN0K0M0[NAM', 'z13.circles_distinct': 'AENz0K{M}[NAM', 'z13.reversed': 'MAN[0M0K0zNEA' };
for (const [id, t] of Object.entries(V)) {
  const cnt = new Map();
  for (const ch of t) cnt.set(ch, (cnt.get(ch) || 0) + 1);
  const c = [...cnt.values()], S = c.length;
  let dp = new Float64Array(1 << S); dp[0] = 1;
  for (let l = 0; l < 26; l++) {
    const nd = Float64Array.from(dp);
    for (let m = 0; m < 1 << S; m++) if (dp[m]) for (let s = 0; s < S; s++) if (!(m >> s & 1)) nd[m | 1 << s] += dp[m] * Math.pow(p[l], c[s]);
    dp = nd;
  }
  const simple = dp[(1 << S) - 1];
  const homo = c.reduce((a, k) => a * p.reduce((x, q) => x + Math.pow(q, k), 0), 1);
  console.log(id, 'simple', simple.toExponential(4), '(1 in', (1 / simple).toExponential(3) + ')', 'homophonic', homo.toExponential(4));
}
