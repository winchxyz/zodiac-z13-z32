'use strict';
/**
 * tools/lead_cipherexpert_arrange.js - hostile-expert checks of the Z13 / Z340-key lead using the
 * replication's engines (tools/lead_replicate_lib.js; t1 = best 6-gram Markov log10 P,
 * t2 = best word-segmentation log10 P, t3 = mean of the 10 best 6-gram values).
 *
 *   (a) arrangement test: all 360 distinct arrangements of the real six letters D,R,E,A,A,O over
 *       the six shared Z13 symbols; rank of the real arrangement per statistic and variant.
 *       (keyprior claimed "best of all 360" under its own objective.)
 *   (b) strict reuse: if Zodiac had reused the Z340 key one symbol per letter, his two new glyphs
 *       ('0' and '[') would stand for letters the Z340 key has no symbol for (J K Q X Z); best
 *       completions under that restriction.
 *
 * usage: node tools/lead_cipherexpert_arrange.js [--variants canonical,circles_distinct] [--out file]
 * Output: results/lead/cipherexpert/arrange.json
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');

const args = process.argv.slice(2);
const opt = { variants: ['canonical', 'circles_distinct'], out: path.join(R.ROOT, 'results/lead/cipherexpert/arrange.json') };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variants') opt.variants = args[++i].split(',');
  else if (args[i] === '--out') opt.out = args[++i];
}

const REAL = [3, 17, 4, 0, 0, 14]; // A=D E=R N=E z=A K=A M=O (slot order A,E,N,z,K,M)

function distinctPerms(arr) {
  const out = [];
  const a = arr.slice().sort((x, y) => x - y);
  const used = new Array(a.length).fill(false);
  const cur = [];
  (function rec() {
    if (cur.length === a.length) { out.push(cur.slice()); return; }
    for (let i = 0; i < a.length; i++) {
      if (used[i] || (i > 0 && a[i] === a[i - 1] && !used[i - 1])) continue;
      used[i] = true; cur.push(a[i]); rec(); cur.pop(); used[i] = false;
    }
  })();
  return out;
}

const perms = distinctPerms(REAL);
const result = { tool: 'tools/lead_cipherexpert_arrange.js', nArrangements: perms.length, variants: {} };
const t0 = Date.now();
for (const v of opt.variants) {
  const lay = R.layout(v);
  const E = R.engine(lay);
  const rows = perms.map((p) => ({ p, s: E.stats(R.slotLetters(lay, p)) }));
  const realKey = REAL.join(',');
  const realRow = rows.find((r) => r.p.join(',') === realKey);
  const vres = { real: realRow.s, perStat: {} };
  for (const st of R.STATS) {
    const vals = rows.map((r) => r.s[st]);
    const greater = vals.filter((x) => x > realRow.s[st] + 1e-12).length;
    const ties = vals.filter((x) => Math.abs(x - realRow.s[st]) <= 1e-12).length - 1;
    const sorted = rows.slice().sort((a, b) => b.s[st] - a.s[st]);
    vres.perStat[st] = {
      real: +realRow.s[st].toFixed(4),
      rank: greater + 1, ties, n: rows.length,
      p_ge: (greater + ties + 1) / rows.length,
      top5: sorted.slice(0, 5).map((r) => ({ letters: r.p.map((x) => R.LET[x]).join(''), value: +r.s[st].toFixed(4) })),
    };
  }
  // (b) strict reuse: free symbols restricted to J K Q X Z
  const restricted = [9, 10, 16, 23, 25];
  const plReal = R.slotLetters(lay, REAL);
  const G = lay.groups.length;
  const lmMod = require('./lm');
  let best1 = { v: -Infinity, t: '' }, best2 = { v: -Infinity, t: '' };
  const total = restricted.length ** G;
  for (let a = 0; a < total; a++) {
    let r = a; const gl = new Array(G);
    for (let g = G - 1; g >= 0; g--) { gl[g] = restricted[r % restricted.length]; r = Math.floor(r / restricted.length); }
    const txt = R.codesToText(R.fill(lay, plReal, gl));
    const m = lmMod.ngramScore(txt, 6).logp;
    const w = lmMod.wordSegment(txt).logp;
    if (m > best1.v) best1 = { v: m, t: txt };
    if (w > best2.v) best2 = { v: w, t: txt };
  }
  vres.strictReuse = { freeLetters: 'JKQXZ', completions: total, bestT1: { value: +best1.v.toFixed(3), text: best1.t }, bestT2: { value: +best2.v.toFixed(3), text: best2.t, words: lmMod.wordSegment(best2.t).words || null } };
  result.variants[v] = vres;
  console.log(v, JSON.stringify(vres.perStat, null, 0));
  console.log(v, 'strict reuse', JSON.stringify(vres.strictReuse));
}
result.seconds = (Date.now() - t0) / 1000;
fs.mkdirSync(path.dirname(opt.out), { recursive: true });
fs.writeFileSync(opt.out, JSON.stringify(result, null, 1));
console.log('wrote', opt.out, result.seconds, 's');
