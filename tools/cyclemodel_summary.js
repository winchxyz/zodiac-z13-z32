'use strict';
/**
 * tools/cyclemodel_summary.js - collect the key numbers of the cyclemodel task
 * from results/cyclemodel/*.json into results/cyclemodel/summary.json and print them.
 *
 *   node tools/cyclemodel_summary.js
 */
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..', 'results', 'cyclemodel');
const rd = (f) => { const p = path.join(R, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const r3 = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);

const out = { tool: 'tools/cyclemodel_summary.js', created: new Date().toISOString() };

const fit = rd('fit.json');
if (fit) {
  out.selection = {};
  for (const reg of ['z408p12', 'z340', 'z408p3', 'pooled']) {
    const f = fit.fits[reg];
    out.selection[reg] = {
      transitions: f.transitions, thetaExported: reg === 'pooled' ? f.noTau.theta : fit.model.regimes[reg].theta,
      log10L: f.noTau.logLik10, log10Lrandom: f.random.logLik10, lrt_g: f.lrt_g, lrt_tau: f.lrt_tau, bootstrap90: fit.bootstrap[reg] || null,
    };
  }
  out.heldout = fit.heldout.map((h) => ({ train: h.train, test: h.test, perTransModel: h.perTransModel, perTransRandom: h.perTransRandom }));
  out.allocation = fit.alloc.fit;
  out.simulationPercentilesRealKey = Object.fromEntries(Object.entries(fit.simulation).map(([k, v]) => [k, Object.fromEntries(Object.entries(v.simRealKey).map(([s, x]) => [s, x.realPercentile]))]));
}

const compat = rd('compat.json');
if (compat) {
  out.compat = {};
  for (const rep of compat.repeats) {
    const t = rep.table.j0.letters;
    const col = (g) => Object.entries(t).map(([L, row]) => [L, row[g]]);
    const pick = (g, lo, hi) => col(g).filter(([, v]) => v >= lo && v <= hi).map(([L, v]) => `${L}:${v}`);
    out.compat[`${rep.cipher} ${rep.symbol}@${rep.positions.join(',')}`] = {
      zodiacSize_z340_compatible_ge0_3: pick('zodiacSize/z340', 0.3, 1),
      zodiacSize_z340_incompatible_le0_01: pick('zodiacSize/z340', 0, 0.01).map((x) => x.split(':')[0]).join(''),
      zodiacSize_z408p12_incompatible_le0_01: pick('zodiacSize/z408p12', 0, 0.01).map((x) => x.split(':')[0]).join(''),
      small_z340_compatible_ge0_3: pick('small/z340', 0.3, 1).map((x) => x.split(':')[0]).join(''),
    };
  }
}

const hyp = rd('hypotheses.json');
if (hyp) {
  out.z13_keyModel = hyp.z13_keyModel ? { log10Evidence: hyp.z13_keyModel.log10Evidence, posteriorUniform: hyp.z13_keyModel.posterior, passingWindows: hyp.z13_keyModel.passingWindows } : null;
  out.z13_circles = hyp.z13_circles ? hyp.z13_circles.byKeyModel : null;
  out.z13_posteriors = hyp.z13_posteriors ? hyp.z13_posteriors.map((p) => ({ keyPrior: p.keyPrior, setting: p.setting.name, explanation: p.explanation, keyModel: p.keyModel })) : null;
  out.z13_letterAtCircle_corpusPrior = hyp.z13_letterAtCircle ? hyp.z13_letterAtCircle.byGroup : null;
  out.z13_otherVariants = hyp.z13_otherVariants || null;
  out.z32 = hyp.z32 || null;
}

out.z13_rescoring = {};
for (const f of fs.readdirSync(R).filter((x) => /^score_z13_.*\.json$/.test(x))) {
  const s = rd(f);
  out.z13_rescoring[f] = {
    counts: s.counts, evidence: s.evidence, concentration: s.concentration, lmTopMoves: s.lmTopMoves,
    letterPosteriorPost: s.letterPosterior.post, letterPosteriorLM: s.letterPosterior.lm,
    topPost: s.topPost.slice(0, 10).map((r) => `${r.words || r.plaintext} [lm ${r.lm}, logL ${r.logL}, LM rank ${r.rankLM}${r.simpleFit ? ', 1:1' : ''}]`),
    topLM: s.topLM.slice(0, 5).map((r) => `${r.words || r.plaintext} [lm ${r.lm}, logL ${r.logL}, post rank ${r.rankPost}]`),
  };
}
const z32s = rd('score_z32_canonical_anneal.json');
if (z32s) {
  out.z32_rescoring = {
    counts: z32s.counts, concentration: z32s.concentration, lmTopMoves: z32s.lmTopMoves,
    topPost: z32s.topPost.slice(0, 10).map((r) => `${r.words} [lm ${r.lm}, logL ${r.logL}, LM rank ${r.rankLM}]`),
    topLM: z32s.topLM.slice(0, 5).map((r) => `${r.words} [lm ${r.lm}, logL ${r.logL}, post rank ${r.rankPost}]`),
  };
}
for (const c of ['c13', 'c13simple', 'c32']) {
  const j = rd(`calib_${c}.json`);
  if (j) out[`calibration_${c}`] = { tried: j.tried, accepted: j.accepted, summary: j.summary };
}
const real = rd('calib_real32.json');
if (real) out.z32_anneal = real;

fs.writeFileSync(path.join(R, 'summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 20000));
