'use strict';
// Reviewer check: are the nullmodel "posteriors" P6(W)/f normalized? Sum P6(W)/f over the distinct
// corpus strings that fit (clean and junk separately). A coherent posterior must sum to <= 1.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const lm = require(path.join(ROOT, 'tools', 'lm'));
const wc = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/nullmodel/windows/window_counts.json'), 'utf8'));
const out = {};
for (const vid of ['z13.canonical', 'z32.canonical']) {
  const tr = wc.variants[vid].splits.train;
  const fHom = tr.homophonic.clean_fraction, fSim = tr.simple.fraction;
  const seen = new Map();
  for (const sp of ['train', 'heldout']) {
    const rows = fs.readFileSync(path.join(ROOT, `results/nullmodel/windows/fits_${vid}_${sp}.tsv`), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
    for (const r of rows) if (!seen.has(r[0])) seen.set(r[0], { clean: r[4] === '1', simple: r[3] === '1' });
  }
  let sClean = 0, sJunk = 0, sSimple = 0, top = [];
  for (const [w, f] of seen) {
    const p = 10 ** lm.ngramScore(w, 6).logp;
    if (f.clean) sClean += p; else sJunk += p;
    if (f.simple && f.clean) sSimple += p;
    top.push([p, w, f.clean]);
  }
  top.sort((a, b) => b[0] - a[0]);
  out[vid] = { distinct: seen.size, fHomClean: fHom, fSimple: fSim,
    sumP6_clean_over_f: sClean / fHom, sumP6_junk_over_f: sJunk / fHom, sumP6_simple_over_fSimple: fSim ? sSimple / fSim : null,
    top10: top.slice(0, 10).map(([p, w, c]) => ({ w: vid.startsWith('z13') ? w : w.slice(0, 12) + '...', log10P6: +Math.log10(p).toFixed(3), clean: c, postOverF: +(p / fHom).toExponential(3) })) };
}
for (const w of ['EEEEEEEEEEEEE', 'HHHHHHHHHHHHH', 'INTHEDESERTIS', 'INTHERESENTIS', 'ANTHEWERESTAR', 'THEREWEWERETW']) out[w] = lm.ngramScore(w, 6).logp;
fs.writeFileSync(path.join(__dirname, 'posterior_normalization.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
