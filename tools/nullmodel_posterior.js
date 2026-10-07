'use strict';
/**
 * tools/nullmodel_posterior.js - the yardstick applied to concrete readings.
 *
 * For each candidate plaintext of Z13 / Z32 (published proposals, our solver's best
 * readings, the best dictionary fits) report:
 *   consistent      homophonic / simple fit with the canonical transcription (tools/cipher.js)
 *   log10P6         log10 probability of the string under the 6-gram letter model
 *   percentile      share of the corpus windows that fit the same cipher (held-out and training)
 *                   whose 6-gram probability is LOWER than the candidate's (100% = more probable
 *                   than every English window that fits)
 *   posterior       P6(candidate) / f, f = corpus fit fraction (homophonic: clean windows; simple:
 *                   strict fits) = probability that the candidate is the plaintext if the plaintext
 *                   were a random English window and the key carried no other information
 *
 * Usage: node tools/nullmodel_posterior.js [--out results/nullmodel/posterior_candidates.json]
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const C = require('./cipher');

const ROOT = path.join(__dirname, '..');
const LOG2_10 = Math.log2(10);

const CANDIDATES = {
  'z13.canonical': [
    ['INTHEDESERTIS', 'corpus window (training) and top enumerate fit (certify smoke)'],
    ['ONTHEDEFEATOF', 'top enumerate fit (certify smoke)'],
    ['ADEFINITIVEAT', 'top enumerate fit (certify smoke)'],
    ['SARAHTHEHORSE', 'Oranchak 2013 example (weak fit)'],
    ['CHASTITYTRACY', 'Oranchak 2013 example (strict fit)'],
    ['EDDIERESENDES', 'Oranchak 2013 example (weak fit)'],
    ['ACHIEVELETHAL', 'Oranchak 2013 example'],
    ['DREATATOTPEDO', 'Garlick (Z340 key)'],
  ],
  'z32.canonical': [
    ['INTHREEANDTHREEEIGHTHSRADIANSTEN', 'DMW 2019; Stampher 2026'],
    ['ESTIMATEFOURRADIANSANDFIVEINCHES', 'Grinell 2020 / InStepWithTheStars'],
    ['THREERADIANSFROMMOUNTAREATWOINCH', 'Cragle 2022'],
    ['OKAYISEVENINSSOUTHOFDIABLOMTPEAK', 'Burke 2019'],
    ['DSBELISHOURTWICHTHEKINGMADEARSES', 'Pelling (deliberate nonsense)'],
  ],
};

function main() {
  const outPath = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'results/nullmodel/posterior_candidates.json';
  const wc = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/nullmodel/windows/window_counts.json'), 'utf8'));
  const sn = fs.existsSync(path.join(ROOT, 'results/nullmodel/solvernull.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'results/nullmodel/solvernull.json'), 'utf8')) : null;
  const cands = JSON.parse(JSON.stringify(CANDIDATES));
  if (sn) {
    for (const r of sn.rows.filter((x) => x.set === 'real' && (x.variant === 'z13.canonical' || x.variant === 'z32.canonical'))) {
      cands[r.variant].push([r.best, `our solver's best (${r.mode} mode, tools/nullmodel_solvernull.js)`]);
    }
  }
  const rep = { tool: 'tools/nullmodel_posterior.js', created: new Date().toISOString(), ciphers: {} };
  for (const [vid, list] of Object.entries(cands)) {
    const text = wc.variants[vid].text;
    const tr = wc.variants[vid].splits.train;
    const fHom = tr.homophonic.clean_fraction;
    const fSim = tr.simple.fraction;
    // 6-gram log10 P of the fitting corpus windows (held-out + training, clean)
    const fitP = [];
    for (const sp of ['heldout', 'train']) {
      const rows = fs.readFileSync(path.join(ROOT, `results/nullmodel/windows/fits_${vid}_${sp}.tsv`), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
      for (const r of rows) if (r[4] === '1') fitP.push(lm.ngramScore(r[0], 6).logp);
    }
    fitP.sort((a, b) => a - b);
    const out = [];
    const seen = new Set();
    for (const [pt, src] of list) {
      if (seen.has(pt + src)) continue;
      seen.add(pt + src);
      const hom = C.checkCandidate(text, pt, { mode: 'homophonic' });
      const sim = C.checkCandidate(text, pt, { mode: 'simple' });
      const lp = lm.ngramScore(pt, 6).logp;
      const below = fitP.filter((x) => x < lp).length;
      const ws = lm.wordSegment(pt);
      out.push({
        plaintext: pt, words: ws.words.join(' '), source: src, length: pt.length,
        homophonicFit: hom.ok, simpleFit: sim.ok, log10P6: lp, bits: -lp * LOG2_10,
        percentileAmongCorpusFits: fitP.length ? below / fitP.length : null, corpusFitsCompared: fitP.length,
        posteriorHomophonic: hom.ok ? 10 ** lp / fHom : 0, posteriorSimple: sim.ok && fSim > 0 ? 10 ** lp / fSim : 0,
        log10PosteriorHomophonic: hom.ok ? lp - Math.log10(fHom) : null,
      });
    }
    rep.ciphers[vid] = { text, fHomClean: fHom, fSimple: fSim, candidates: out };
    for (const c of out) {
      console.log(`${vid} ${c.words.padEnd(42)} hom ${c.homophonicFit ? 'Y' : 'n'} simple ${c.simpleFit ? 'Y' : 'n'} log10P6 ${c.log10P6.toFixed(2)} pct ${(100 * c.percentileAmongCorpusFits).toFixed(0)}% posterior(hom) ${c.log10PosteriorHomophonic == null ? '-' : '1e' + c.log10PosteriorHomophonic.toFixed(1)}`);
    }
  }
  fs.writeFileSync(outPath, JSON.stringify(rep, null, 1));
}

main();
