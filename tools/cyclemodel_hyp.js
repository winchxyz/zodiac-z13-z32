'use strict';
/**
 * tools/cyclemodel_hyp.js - posterior over explanations of Z13's '0' at 4, 6, 8
 * (and over key size / selection regime for Z13 and Z32) from the corpus-window
 * marginal likelihoods written by tools/cyclemodel_windows.js.
 *
 *   node tools/cyclemodel_hyp.js [--z13 results/cyclemodel/windows_z13.json] [--z32 results/cyclemodel/windows_z32.json]
 *        [--out results/cyclemodel/hypotheses.json]
 *
 * Evidence E(H) = P(observed isomorph | H) with English windows as the plaintext prior.
 * Explanations of the circles (each combined with a key model: simple substitution,
 * small homophonic key S <= 45, Zodiac-size key S >= 50, and a selection regime):
 *   same     the circles are one symbol (canonical isomorph)
 *   distinct the circles are three different symbols (isomorph of z13.circles_distinct);
 *            needs a visual factor V = P(scan | distinct) / P(scan | same), unknown
 *   null     the circles are nulls (10-letter isomorph) x pi_null = P(a null process puts
 *            one shared null symbol at exactly 4, 6, 8)
 *   slip     one circle is a wrong symbol that happens to equal the others:
 *            sum over the three positions of E(slip_p) x eps x q / (1 - eps),
 *            eps = 0.0219 (pooled Z408+Z340 slip rate), q = P(the wrong symbol is that glyph)
 * Bayes factors are printed so that other priors can be plugged in; the default
 * prior is stated in the output.
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const Z13F = opt('z13', 'results/cyclemodel/windows_z13.json');
const Z32F = opt('z32', 'results/cyclemodel/windows_z32.json');
const OUT = opt('out', 'results/cyclemodel/hypotheses.json');
const EPS = 16 / 730;

const l10 = (x) => (x > 0 ? Math.log10(x) : -Infinity);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);

function groups(v) {
  // evidence per key model group = mean of component evidences (uniform prior within group)
  const g = { simple: [], small: [], zodiacSize: [], z408p12: [], z340: [], z408p3: [] };
  for (const c of v.components) {
    if (c.regime === 'simple') { g.simple.push(c.pIso); continue; }
    if (c.S <= 45) g.small.push(c.pIso); else if (c.S >= 50) g.zodiacSize.push(c.pIso);
    g[c.regime].push(c.pIso);
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const o = {};
  for (const [k, a] of Object.entries(g)) o[k] = mean(a);
  o.homophonicAll = mean(v.components.filter((c) => c.regime !== 'simple').map((c) => c.pIso));
  return o;
}

function main() {
  const res = { tool: 'tools/cyclemodel_hyp.js', created: new Date().toISOString(), epsSlip: EPS };
  if (fs.existsSync(Z13F)) {
    const W = JSON.parse(fs.readFileSync(Z13F, 'utf8'));
    const V = Object.fromEntries(W.variants.map((v) => [v.id, v]));
    const can = V['z13.canonical'];
    // 1. key model posterior given the canonical isomorph (uniform prior over simple / small / zodiac-size)
    const gC = groups(can);
    const keyModels = { simple: gC.simple, small: gC.small, zodiacSize: gC.zodiacSize };
    const zK = Object.values(keyModels).reduce((a, b) => a + b, 0);
    res.z13_keyModel = {
      prior: 'uniform over {simple substitution, homophonic S<=45, homophonic S>=50}; within homophonic uniform over S grid and the three regimes',
      log10Evidence: Object.fromEntries(Object.entries(keyModels).map(([k, v]) => [k, r3(l10(v))])),
      posterior: Object.fromEntries(Object.entries(keyModels).map(([k, v]) => [k, r3(v / zK)])),
      regimeLog10Evidence: { z408p12: r3(l10(gC.z408p12)), z340: r3(l10(gC.z340)), z408p3: r3(l10(gC.z408p3)) },
      bySlog10Evidence: can.components.filter((c) => c.regime !== 'simple').reduce((o, c) => { (o['S' + c.S] = o['S' + c.S] || {})[c.regime] = r3(c.log10pIso); return o; }, {}),
      passingWindows: can.passingWindows, windows: can.windows,
      effWindows: Object.fromEntries(can.components.filter((c) => c.regime === 'simple' || c.S === 30 || c.S === 63).map((c) => [c.label, r3(c.effWindows)])),
    };
    // 2. explanations of the circles
    const ev = (id) => groups(V[id]);
    const gD = ev('z13.circles_distinct'), gN = ev('z13.circles_null');
    const gS = ['z13.slip4', 'z13.slip6', 'z13.slip8'].map(ev);
    const table = {};
    for (const km of ['simple', 'small', 'zodiacSize', 'homophonicAll']) {
      const same = gC[km], distinct = gD[km], nul = gN[km];
      const slipSum = gS.reduce((a, g) => a + g[km], 0);
      table[km] = {
        log10E_same: r3(l10(same)),
        log10BF_distinct_vs_same_beforeVisualFactor: r3(l10(distinct) - l10(same)),
        log10BF_null_vs_same_beforeNullPrior: r3(l10(nul) - l10(same)),
        breakEvenPiNull: r3(same / nul),
        log10BF_slip_vs_same_per_q: r3(l10(slipSum * EPS / (1 - EPS)) - l10(same)),
        breakEvenQslip: r3(same / (slipSum * EPS / (1 - EPS))),
      };
    }
    res.z13_circles = {
      note: 'BF = ratio of marginal likelihoods of the scan reading under each explanation; distinct still needs the visual factor V, null the prior pi_null of the null process, slip the factor q',
      byKeyModel: table,
    };
    // posteriors under explicit prior settings
    const settings = [
      { name: 'sceptical of alternatives', V: 0.01, piNull: 1e-4, q: 0.03 },
      { name: 'moderate', V: 0.1, piNull: 1e-3, q: 0.1 },
      { name: 'generous to alternatives', V: 0.5, piNull: 1e-2, q: 0.3 },
    ];
    const keyPriors = {
      uniform: { simple: 1 / 3, small: 1 / 3, zodiacSize: 1 / 3 },
      zodiacHabit: { simple: 0.2, small: 0.2, zodiacSize: 0.6 },
    };
    res.z13_posteriors = [];
    for (const [kpName, kp] of Object.entries(keyPriors)) for (const st of settings) {
      const post = {};
      for (const km of ['simple', 'small', 'zodiacSize']) {
        const e = {
          same: gC[km],
          distinct: gD[km] * st.V,
          null: gN[km] * st.piNull,
          slip: gS.reduce((a, g) => a + g[km], 0) * EPS * st.q / (1 - EPS),
        };
        for (const [h, x] of Object.entries(e)) post[`${km}/${h}`] = x * kp[km];
      }
      const z = Object.values(post).reduce((a, b) => a + b, 0);
      const byExpl = {}, byKey = {};
      for (const [k, v] of Object.entries(post)) { const [km, h] = k.split('/'); byExpl[h] = (byExpl[h] || 0) + v / z; byKey[km] = (byKey[km] || 0) + v / z; }
      const r = {
        keyPrior: kpName, setting: st,
        explanation: Object.fromEntries(Object.entries(byExpl).map(([k, v]) => [k, r3(v)])),
        keyModel: Object.fromEntries(Object.entries(byKey).map(([k, v]) => [k, r3(v)])),
        joint: Object.fromEntries(Object.entries(post).map(([k, v]) => [k, r3(v / z)]).sort((a, b) => b[1] - a[1]).slice(0, 6)),
      };
      res.z13_posteriors.push(r);
      console.log(`posterior [${kpName}; ${st.name}: V=${st.V} piNull=${st.piNull} q=${st.q}] explanation ${JSON.stringify(r.explanation)} key ${JSON.stringify(r.keyModel)}`);
    }
    // letter at the circles
    res.z13_letterAtCircle = can.track.find((t) => t.position === 4) || null;
    res.z13_letterAtBracket = can.track.find((t) => t.position === 9) || null;
    // other transcription questions (same key models)
    res.z13_otherVariants = {};
    for (const id of ['z13.crosshair_null', 'z13.reversed']) {
      if (!V[id]) continue;
      const g = ev(id);
      res.z13_otherVariants[id] = Object.fromEntries(['simple', 'small', 'zodiacSize'].map((km) => [km, { log10E: r3(l10(g[km])), log10BF_vs_canonical: r3(l10(g[km]) - l10(gC[km])) }]));
    }
    console.log('Z13 key model posterior (canonical isomorph):', JSON.stringify(res.z13_keyModel.posterior), 'log10E', JSON.stringify(res.z13_keyModel.log10Evidence));
    console.log('Z13 circles, by key model:'); for (const [k, v] of Object.entries(table)) console.log('  ' + k + ' ' + JSON.stringify(v));
    if (res.z13_letterAtCircle) console.log('letter at circle (pos 4):', JSON.stringify(res.z13_letterAtCircle.byGroup));
  }
  if (fs.existsSync(Z32F)) {
    const W = JSON.parse(fs.readFileSync(Z32F, 'utf8'));
    res.z32 = {};
    for (const v of W.variants) {
      const hom = v.components.filter((c) => c.regime !== 'simple' && c.pIso > 0);
      const z = hom.reduce((a, c) => a + c.pIso, 0);
      const byS = {}, byR = {};
      for (const c of hom) { byS[c.S] = (byS[c.S] || 0) + c.pIso / z; byR[c.regime] = (byR[c.regime] || 0) + c.pIso / z; }
      const simple = v.components.find((c) => c.regime === 'simple');
      res.z32[v.id] = {
        passingWindows: v.passingWindows, windows: v.windows,
        log10E_homophonicMean: r3(l10(z / Math.max(1, v.components.filter((c) => c.regime !== 'simple').length))),
        log10E_simple: r3(l10(simple.pIso)),
        posteriorS: Object.fromEntries(Object.entries(byS).map(([k, x]) => [k, r3(x)])),
        posteriorRegime: Object.fromEntries(Object.entries(byR).map(([k, x]) => [k, r3(x)])),
      };
      console.log(`${v.id}: posterior S ${JSON.stringify(res.z32[v.id].posteriorS)} regime ${JSON.stringify(res.z32[v.id].posteriorRegime)}`);
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log('wrote ' + OUT);
}

main();
