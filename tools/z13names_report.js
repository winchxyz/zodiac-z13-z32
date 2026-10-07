'use strict';
/**
 * tools/z13names_report.js - markdown tables for results/z13names/summary.md.
 * Reads results/z13names/{stats.json, suspects.json, mc.json} and writes results/z13names/report_tables.md
 * (the narrative summary.md quotes these tables).
 * Usage: node tools/z13names_report.js
 */
const fs = require('fs');
const path = require('path');

const D = path.join(__dirname, '..', 'results', 'z13names');
const rd = (f) => (fs.existsSync(path.join(D, f)) ? JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')) : null);
const stats = rd('stats.json'), sus = rd('suspects.json'), mc = rd('mc.json');
const e = (x, d = 2) => (x == null ? '-' : x === 0 ? '0' : Math.abs(x) >= 1e4 || Math.abs(x) < 1e-2 ? x.toExponential(d) : +x.toPrecision(3) + '');
const L = [];
const VORDER = ['z13.canonical', 'z13.bracket_is_perp', 'z13.reversed', 'z13.crosshair_null', 'z13.circles_distinct', 'z13.letters_literal'];
const LORDER = ['male', 'female', 'nick_male', 'nick_female'];

if (stats) {
  const runs = stats.runs.slice().sort((a, b) => VORDER.indexOf(a.variant) - VORDER.indexOf(b.variant) || a.mode.localeCompare(b.mode) || LORDER.indexOf(a.list) - LORDER.indexOf(b.list));
  L.push('## A. Letter-level baseline: P(a string of independent letters fits)', '');
  L.push('| variant | isomorph | simple, English letters | simple, name letters | homophonic, English letters | homophonic, name letters |', '|---|---|---|---|---|---|');
  for (const v of VORDER) {
    const x = stats.variants[v];
    if (!x) continue;
    const b = x.letterBaseline;
    L.push(`| ${v} | \`${x.isomorph}\` | ${e(b.simple.english)} (1 in ${e(1 / b.simple.english, 3)}) | ${e(b.simple.nameLetters)} | ${e(b.homophonic.english)} (1 in ${e(1 / b.homophonic.english, 3)}) | ${e(b.homophonic.nameLetters)} |`);
  }
  L.push('');
  L.push('## B. Fits per variant, mode, list and pattern', '');
  L.push('f0/f1/f2 = number of fits with 0/1/2 filler letters at the ends (a fit = one name parse plus one filler placement). "frac" = fits / name strings of that length (x placements); "wfrac" = the same weighted by the name-frequency prior. MC = Monte Carlo estimate where the enumeration is not complete (2,000,000 samples per cell).', '');
  L.push('| variant | mode | list | pattern | f0 | f1 | f2 | frac f0 | wfrac f0 | wfrac f2 |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of runs) {
    for (const [pat, pr] of Object.entries(r.patterns)) {
      const b = pr.byFillers;
      const cnt = (fl) => {
        const x = b[fl];
        if (!x) return '-';
        if (x.enumerated === 'complete') return String(x.fits);
        if (x.fitsEstimatedFromMC != null) return '~' + e(x.fitsEstimatedFromMC) + ' (MC)';
        return x.enumerated === 'no' ? 'n/e' : '-';
      };
      const wf = (fl) => { const x = b[fl]; if (!x) return '-'; if (x.weightedFraction != null) return e(x.weightedFraction); if (x.mcWeightedFraction != null) return e(x.mcWeightedFraction) + ' (MC)'; return 'n/e'; };
      const fr0 = b[0].fraction != null ? e(b[0].fraction) : b[0].mcFraction != null ? e(b[0].mcFraction) + ' (MC)' : '-';
      L.push(`| ${r.variant} | ${r.mode} | ${r.list} | ${pat} | ${cnt(0)} | ${cnt(1)} | ${cnt(2)} | ${fr0} | ${wf(0)} | ${wf(2)} |`);
    }
  }
  L.push('', 'n/e = not enumerated (bracket_is_perp has the same isomorph as canonical, so its 1-2 filler cells equal canonical\'s by construction).', '');

  const cn = runs.filter((r) => r.variant === 'z13.crosshair_null');
  if (cn.length) {
    L.push('## C. z13.crosshair_null with the crosshair as a word divider (a name part must start at position 3, AEN | ...)', '');
    L.push('| mode | list | pattern | f0 fits (with divider) | f1 | f2 |', '|---|---|---|---|---|---|');
    for (const r of cn) for (const [pat, pr] of Object.entries(r.patterns)) {
      const b = pr.byFillers;
      L.push(`| ${r.mode} | ${r.list} | ${pat} | ${b[0].fits} (${b[0].fitsBoundary3}) | ${b[1].fits} (${b[1].fitsBoundary3}) | ${b[2].fits} (${b[2].fitsBoundary3}) |`);
    }
    L.push('');
  }

  L.push('## D. Posterior over the 0-filler fits under the name-frequency prior', '');
  L.push('Within one pattern, if Z13 IS a name of that pattern. "flat" = every consistent key equally likely (exact for simple substitution); "h-model" = homophonic random-homophone likelihood (h_l from the Z408/Z340 keys). top1 = posterior of the best fit; n50 = fits needed for half the mass; effN = 1/sum p^2.', '');
  L.push('| variant | mode | list | pattern | fits | distinct strings | best fit (flat) | top1 | top10 | n50 | effN | best fit (h-model) | top1 h |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of runs) {
    for (const [pat, pr] of Object.entries(r.patterns)) {
      const z = pr.zeroFiller;
      if (!z) continue;
      if (z.minWeight) {
        const t = z.topFlat[0];
        L.push(`| ${r.variant} | ${r.mode} | ${r.list} | ${pat} | ${z.parsesAboveMinWeight} with w>=${z.minWeight} | ${z.distinctStringsAboveMinWeight} | ${t ? t.parts : '-'} | ${e(z.posteriorFlatTop1)} (MC denominator) | ${e(z.posteriorFlatTop10)} | - | - | - | - |`);
        continue;
      }
      const pf = z.posteriorFlat, ph = z.posteriorHomophoneModel;
      const tf = z.topFlat[0], th = z.topHomophoneModel ? z.topHomophoneModel[0] : null;
      L.push(`| ${r.variant} | ${r.mode} | ${r.list} | ${pat} | ${z.parses} | ${z.distinctStrings} | ${tf ? tf.parts : '-'} | ${pf ? e(pf.top1) : '-'} | ${pf ? e(pf.top10) : '-'} | ${pf ? pf.n50 : '-'} | ${pf ? e(pf.effectiveN) : '-'} | ${th ? th.parts : '-'} | ${ph ? e(ph.top1) : '-'} |`);
    }
  }
  L.push('');
  L.push('### Equal-prior mixture of the patterns (each pattern conditioned on the cipher length)', '');
  L.push('| variant | mode | list | top 3 (posterior) | mass by pattern | effN |', '|---|---|---|---|---|---|');
  for (const r of runs) {
    if (!r.mixture) continue;
    const t = r.mixture.top.slice(0, 3).map((x) => `${x.parts} (${x.pattern}, ${e(x.posterior)})`).join('; ');
    const m = Object.entries(r.mixture.massByPattern).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${e(v)}`).join(', ');
    L.push(`| ${r.variant} | ${r.mode} | ${r.list} | ${t} | ${m} | ${e(r.mixture.stats.effectiveN)} |`);
  }
  L.push('');
}

if (mc) {
  L.push('## E. Monte Carlo check of the enumerated weighted fractions (canonical, fillers 2)', '');
  L.push('| mode | list | pattern | enumerated wfrac | MC wfrac [95% CI] | hits |', '|---|---|---|---|---|---|');
  const st = stats ? stats.runs : [];
  for (const r of mc.results) {
    if (r.variant !== 'z13.canonical' || r.fillers !== 2 || r.sampling !== 'prior') continue;
    const run = st.find((x) => x.variant === r.variant && x.mode === r.mode && x.list === r.list);
    const ew = run && run.patterns[r.pattern] ? run.patterns[r.pattern].byFillers[2].weightedFraction : null;
    L.push(`| ${r.mode} | ${r.list} | ${r.pattern} | ${e(ew)} | ${e(r.fraction)} [${e(r.ci95[0])}, ${e(r.ci95[1])}] | ${r.hits} |`);
  }
  L.push('');
}

if (sus) {
  L.push('## F. Suspects and proposed persons', '');
  L.push(`Each rendering checked against ${sus.variantsModes.length} variant x mode combinations with 0-2 free fillers at the ends. Null: ${sus.reps} replicates with every name part replaced by a random name of the same length and frequency bin.`, '');
  L.push('| person | category | renderings (in length range) | fitting renderings | null P(>=1 fit) | null mean fitting renderings |', '|---|---|---|---|---|---|');
  for (const p of sus.persons) {
    const fr = p.renderings.filter((r) => Object.keys(r.fits).length).map((r) => `${r.str}${r.excludedFromTest ? ' (lit., excluded)' : ''}: ${Object.keys(r.fits).map((k) => k.replace('z13.', '')).join(', ')}`).join('<br>');
    L.push(`| ${p.name} | ${p.cat} | ${p.nRenderings} (${p.nRenderingsInLengthRange}) | ${fr || 'none'} | ${e(p.null.pAnyFitRandomMatched)} | ${e(p.null.meanFittingRenderings)} |`);
  }
  L.push('');
  L.push('### Permutation test (suspects vs matched random names)', '');
  L.push('| variant/mode | persons with a fit: observed / null mean / p | persons, 0 fillers: obs / mean / p | fitting renderings: obs / mean / p |', '|---|---|---|---|');
  for (const [k, t] of Object.entries(sus.test)) {
    L.push(`| ${k} | ${t.persons.observed} / ${e(t.persons.nullMean)} / ${e(t.persons.p, 3)} | ${t.persons0.observed} / ${e(t.persons0.nullMean)} / ${e(t.persons0.p, 3)} | ${t.renderings.observed} / ${e(t.renderings.nullMean)} / ${e(t.renderings.p, 3)} |`);
  }
  L.push('');
}

fs.writeFileSync(path.join(D, 'report_tables.md'), L.join('\n') + '\n');

// compact machine-readable summary
const S = { created: new Date().toISOString(), sources: ['stats.json', 'suspects.json', 'mc.json', 'fit_counts.tsv', 'posterior_top.tsv', 'suspects_table.tsv'] };
if (stats) {
  S.letterBaseline = Object.fromEntries(Object.entries(stats.variants).map(([k, v]) => [k, v.letterBaseline]));
  S.cells = [];
  for (const r of stats.runs) for (const [pat, pr] of Object.entries(r.patterns)) {
    const b = pr.byFillers, z = pr.zeroFiller || {};
    S.cells.push({
      variant: r.variant, mode: r.mode, list: r.list, pattern: pat,
      fits: [0, 1, 2].map((f) => (b[f].enumerated === 'complete' ? b[f].fits : null)),
      fitsEstimatedMC: [0, 1, 2].map((f) => (b[f].fitsEstimatedFromMC != null ? b[f].fitsEstimatedFromMC : null)),
      weightedFraction: [0, 1, 2].map((f) => (b[f].weightedFraction != null ? b[f].weightedFraction : b[f].mcWeightedFraction != null ? b[f].mcWeightedFraction : null)),
      fraction: [0, 1, 2].map((f) => (b[f].fraction != null ? b[f].fraction : b[f].mcFraction != null ? b[f].mcFraction : null)),
      boundary3: r.variant === 'z13.crosshair_null' ? [0, 1, 2].map((f) => b[f].fitsBoundary3) : undefined,
      enumerated: [0, 1, 2].map((f) => b[f].enumerated),
      best: z.topFlat && z.topFlat[0] ? { parts: z.topFlat[0].parts, posteriorFlat: z.topFlat[0].posterior } : null,
      bestHomophoneModel: z.topHomophoneModel && z.topHomophoneModel[0] ? { parts: z.topHomophoneModel[0].parts, posterior: z.topHomophoneModel[0].posterior } : null,
      posteriorFlat: z.posteriorFlat || null,
    });
  }
  S.mixtures = stats.runs.filter((r) => r.mixture).map((r) => ({ variant: r.variant, mode: r.mode, list: r.list, top: r.mixture.top.slice(0, 5), massByPattern: r.mixture.massByPattern, effectiveN: r.mixture.stats.effectiveN }));
}
if (sus) {
  S.suspects = {
    persons: sus.persons.length, reps: sus.reps, test: sus.test,
    fitting: sus.persons.filter((p) => p.renderings.some((r) => Object.keys(r.fits).length)).map((p) => ({ id: p.id, name: p.name, fits: p.renderings.filter((r) => Object.keys(r.fits).length).map((r) => ({ str: r.str, label: r.label, excludedFromTest: !!r.excludedFromTest, variantsModes: Object.keys(r.fits), plaintexts: Object.values(r.fits).flat().map((x) => x.plaintext) })) })),
  };
}
fs.writeFileSync(path.join(D, 'summary.json'), JSON.stringify(S, null, 1));
console.log('wrote results/z13names/summary.json');
console.log(`wrote results/z13names/report_tables.md (${L.length} lines)`);
