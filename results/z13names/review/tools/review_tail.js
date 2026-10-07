'use strict';
/**
 * How much fitting prior mass do the name lists leave out? The lists hold 97.5% of first-name mass and
 * 90.4% of surname mass (data/names/names_stats.json); the rest is spread over names too rare to be
 * listed. Model (an explicit assumption): the unlisted mass U is spread evenly over pseudo-names that
 * look like the rarest listed names (the bottom --rare names of each list). Then the expected fitting
 * weight from the tail = DP weight sum with the rare list re-weighted to U / n_rare per name.
 * Reports, for canonical / reversed x simple / homophonic x male / female and patterns FL, FML:
 * enumerated fitting weight S, tail estimate T, and the top-1 flat posterior before and after.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const DP = require('./review_dp.js');
const C = require(path.join(ROOT, 'tools', 'cipher.js'));
const zlib = require('zlib');
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/names/names_stats.json'), 'utf8'));

function rareList(byLen, nRare, mass) {
  const all = [];
  byLen.forEach((arr) => arr.forEach((e) => all.push(e)));
  all.sort((a, b) => a.w - b.w);
  const rare = all.slice(0, nRare);
  const out = byLen.map(() => []);
  for (const e of rare) out[e.codes.length].push({ codes: e.codes, w: mass / rare.length, s: e.s });
  return out;
}

const VAR = { 'z13.canonical': 'data/ciphers/variants/z13.canonical.txt', 'z13.reversed': 'data/ciphers/variants/z13.reversed.txt' };
const res = [];
for (const [vid, file] of Object.entries(VAR)) {
  const text = Array.from(C.loadCipher(path.join(ROOT, file)).text);
  for (const sex of ['male', 'female']) {
    const F = DP.readList(`data/names/first_${sex}.tsv`, 13), L = DP.readList('data/names/surnames.tsv', 13);
    const initW = DP.initWeights(`data/names/first_${sex}.tsv`);
    const UF = 1 - stats[`first_${sex}.tsv`].weight_sum, UL = 1 - stats['surnames.tsv'].weight_sum;
    const Frare = rareList(F, 2000, UF), Lrare = rareList(L, 40000, UL);
    for (const mode of ['simple', 'homophonic']) for (const pat of ['FL', 'FML']) {
      const sum = (lists) => { let w = 0; for (const sp of DP.splitsOf(pat, 13)) w += DP.countSplit(text, new Map(), mode, pat, sp, lists).w; return w; };
      const S = sum({ F, L, initW });
      // tail: replace one list at a time by its rare pseudo-tail (second-order terms ignored)
      const TL = sum({ F, L: Lrare, initW });
      const TF = pat === 'FL' ? sum({ F: Frare, L, initW }) : sum({ F: Frare, L, initW }) * 2; // FML: F or M slot from the tail (approx.)
      // top-1 weight from the attacker's 0-filler TSV
      const tsv = path.join(ROOT, 'results/z13names/runs', `${vid}.${mode}.${sex}.tsv.gz`);
      let top = 0, topName = '';
      for (const ln of zlib.gunzipSync(fs.readFileSync(tsv)).toString('latin1').split('\n').slice(1)) {
        if (!ln) continue;
        const r = ln.split('\t');
        if (r[2] === pat && r[4] === '0' && +r[1] > top) { top = +r[1]; topName = r[3]; }
      }
      const row = { variant: vid, sex, mode, pattern: pat, enumeratedFitWeight: S, tailSurname: TL, tailFirst: TF, tailShare: (TL + TF) / (S + TL + TF), top: topName, top1Before: S ? top / S : null, top1After: S ? top / (S + TL + TF) : null };
      res.push(row);
      console.log(JSON.stringify(row, (k, v) => (typeof v === 'number' ? +v.toPrecision(3) : v)));
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'results/z13names/review/tail_mass.json'), JSON.stringify({ tool: 'results/z13names/review/tools/review_tail.js', assumption: 'unlisted mass spread evenly over pseudo-names shaped like the 2000 rarest first names / 40000 rarest surnames', rows: res }, null, 1));
