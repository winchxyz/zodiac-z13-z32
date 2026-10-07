'use strict';
/**
 * tools/cyclemodel_windows.js - marginal likelihood of a cipher ISOMORPH under
 * each enciphering hypothesis, P(iso | H) = E_P[ L_H(P) ], with P running over
 * EVERY window of the right length in the 114M-letter English corpus
 * (data/lm/raw/corpus_letters.txt).  This is the evidence term used to compare
 * hypotheses (key size S, selection regime, simple substitution, transcription
 * variants, nulls, slips) and to get the posterior over the letter behind a symbol.
 *
 *   node tools/cyclemodel_windows.js --set z13 [--model results/cyclemodel/fit.json] [--out results/cyclemodel/windows_z13.json]
 *   node tools/cyclemodel_windows.js --set z32
 *
 * For every variant the scan keeps the windows whose letters are equal wherever the
 * isomorph has equal symbols (the necessary condition for every substitution
 * hypothesis), then adds L_H(P) for each component H of the grid
 * (S x regime, plus 'simple').  Reported: windows scanned, windows passing,
 * P(iso | H) = sum L / windows, its Monte-Carlo standard error (windows treated as
 * independent; they overlap, so this understates it), the effective number of
 * contributing windows, the posterior over the plaintext letter at chosen
 * positions, and the top contributing windows (corpus text, not Zodiac text).
 */
const fs = require('fs');
const path = require('path');
// REVIEW COPY of tools/cyclemodel_windows.js: only the library is swapped for
// results/cyclemodel/review/review_lib.js (k = 1 outlier term in kDist; identical when eta1 = 0).
const M = require('./review_lib');

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const SET = opt('set', 'z13');
const MODEL = opt('model', 'results/cyclemodel/fit.json');
const OUT = opt('out', `results/cyclemodel/review/windows_${SET}_review.json`);
const CORPUS = opt('corpus', 'data/lm/raw/corpus_letters.txt');
const SGRID = (opt('S', '15,20,26,30,35,40,45,50,54,58,63,68')).split(',').map(Number);

const VARIANTS = {
  z13: [
    { id: 'z13.canonical', text: 'AENz0K0M0[NAM', rows: [13], track: [4, 9] },
    { id: 'z13.circles_distinct', text: 'AENz0K{M}[NAM', rows: [13], track: [4, 6, 8] },
    { id: 'z13.crosshair_null', text: 'AEN0K0M0[NAM', rows: [12], track: [3] },
    { id: 'z13.circles_null', text: 'AENzKM[NAM', rows: [10], track: [], note: 'the three circles removed as nulls (10 letters)' },
    { id: 'z13.reversed', text: 'MAN[0M0K0zNEA', rows: [13], track: [4] },
    { id: 'z13.slip4', text: 'AENz#K0M0[NAM', rows: [13], track: [4, 6], note: 'circle at 4 is a different symbol (slip that produced the same glyph)' },
    { id: 'z13.slip6', text: 'AENz0K#M0[NAM', rows: [13], track: [4, 6], note: 'circle at 6 is a different symbol' },
    { id: 'z13.slip8', text: 'AENz0K0M#[NAM', rows: [13], track: [4, 8], note: 'circle at 8 is a different symbol' },
  ],
  z32: [
    { id: 'z32.canonical', text: 'C9J|#Ok[AMf8?ORTGX6FDVj%HCELzPW9', rows: [17, 15], track: [0, 1, 5] },
    { id: 'z32.triangles_merged', text: 'C9J|#Ok[AMf9?ORTGX6FDVj%HCELzPW9', rows: [17, 15], track: [1] },
    { id: 'z32.one_row', text: 'C9J|#Ok[AMf8?ORTGX6FDVj%HCELzPW9', rows: [32], track: [], note: 'canonical isomorph, row structure ignored' },
    { id: 'z32.reversed', text: '9WPzLECH%jVDF6XGTRO?8fMA[kO#|J9C', rows: [15, 17], track: [] },
  ],
};

function main() {
  const t0 = Date.now();
  const model = M.loadModel(MODEL);
  const regimes = Object.keys(model.regimes);
  const buf = fs.readFileSync(CORPUS);
  // letters only (the file is A-Z already; guard anyway)
  let n = 0;
  const L = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) { const c = buf[i]; if (c >= 65 && c <= 90) L[n++] = c - 65; }
  const text = L.subarray(0, n);
  console.log(`corpus ${n} letters, loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const res = { tool: 'tools/cyclemodel_windows.js', created: new Date().toISOString(), command: 'node tools/cyclemodel_windows.js ' + args.join(' '), corpus: CORPUS, corpusLetters: n, model: MODEL, Sgrid: SGRID, regimes, variants: [] };
  for (const v of VARIANTS[SET]) {
    const tv = Date.now();
    const iso = M.isoOf(v.text);
    const len = v.text.length;
    const rows = M.rowsFor(v.rows);
    // equality constraints: each position vs first position of its class
    const first = new Map();
    const eq = [];
    for (let i = 0; i < len; i++) { if (first.has(iso[i])) eq.push([first.get(iso[i]), i]); else first.set(iso[i], i); }
    const sh = M.makeScorer(model, { iso, rows, hyp: { kind: 'homophonic', S: SGRID, regimes } });
    const ss = M.makeScorer(model, { iso, rows, hyp: { kind: 'simple' } });
    const nC = sh.comps.length;
    const sum = new Float64Array(nC + 1), sum2 = new Float64Array(nC + 1), mx = new Float64Array(nC + 1);
    const trackSum = v.track.map(() => Array.from({ length: nC + 1 }, () => new Float64Array(26)));
    const topBy = []; // best windows by mixture L
    let passing = 0;
    const N = n - len + 1;
    const ea = new Int32Array(eq.map((x) => x[0])), eb = new Int32Array(eq.map((x) => x[1]));
    const ne = eq.length;
    const codes = new Uint8Array(len);
    for (let w = 0; w < N; w++) {
      let ok = true;
      for (let e = 0; e < ne; e++) if (text[w + ea[e]] !== text[w + eb[e]]) { ok = false; break; }
      if (!ok) continue;
      passing++;
      for (let i = 0; i < len; i++) codes[i] = text[w + i];
      const pc = sh.perComp(codes);
      const vals = new Float64Array(nC + 1);
      if (pc) for (let c = 0; c < nC; c++) vals[c] = Math.pow(10, pc[c]);
      const sv = ss.logL(codes);
      vals[nC] = sv === 0 ? 1 : 0;
      let mix = 0;
      for (let c = 0; c <= nC; c++) {
        sum[c] += vals[c]; sum2[c] += vals[c] * vals[c]; if (vals[c] > mx[c]) mx[c] = vals[c];
        if (c < nC) mix += vals[c] / nC;
      }
      v.track.forEach((p, ti) => { for (let c = 0; c <= nC; c++) trackSum[ti][c][codes[p]] += vals[c]; });
      if (mix > 0 && (topBy.length < 25 || mix > topBy[topBy.length - 1].mix)) {
        let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(65 + codes[i]);
        if (!topBy.some((t) => t.s === s)) {
          topBy.push({ s, mix, simple: vals[nC] }); topBy.sort((a, b) => b.mix - a.mix); if (topBy.length > 25) topBy.pop();
        }
      }
    }
    const comps = sh.comps.map((c) => c.label).concat(['simple']);
    const out = { id: v.id, text: v.text, note: v.note || null, length: len, rows: v.rows, windows: N, passingWindows: passing, components: [] };
    for (let c = 0; c <= nC; c++) {
      const mean = sum[c] / N;
      const se = Math.sqrt(Math.max(0, sum2[c] / N - mean * mean) / N);
      out.components.push({ label: comps[c], S: c < nC ? sh.comps[c].S : null, regime: c < nC ? sh.comps[c].regime : 'simple', pIso: mean, log10pIso: mean > 0 ? Math.log10(mean) : null, relSE: mean > 0 ? se / mean : null, effWindows: sum2[c] > 0 ? (sum[c] * sum[c]) / sum2[c] : 0, maxShare: sum[c] > 0 ? mx[c] / sum[c] : null });
    }
    out.track = v.track.map((p, ti) => {
      const o = { position: p, byGroup: {} };
      const groups = { mixtureAll: [...Array(nC).keys()], simple: [nC] };
      for (const r of regimes) groups['regime_' + r] = sh.comps.map((c, i) => (c.regime === r ? i : -1)).filter((i) => i >= 0);
      groups.zodiacSize = sh.comps.map((c, i) => (c.S >= 50 && c.S <= 68 ? i : -1)).filter((i) => i >= 0);
      groups.smallKey = sh.comps.map((c, i) => (c.S <= 45 ? i : -1)).filter((i) => i >= 0);
      for (const [g, idx] of Object.entries(groups)) {
        const tot = new Float64Array(26);
        for (const c of idx) for (let l = 0; l < 26; l++) tot[l] += trackSum[ti][c][l];
        const z = tot.reduce((a, b) => a + b, 0);
        if (z > 0) o.byGroup[g] = Object.fromEntries([...tot].map((x, l) => [M.LETTERS[l], Math.round(1e4 * x / z) / 1e4]).filter(([, x]) => x >= 0.005).sort((a, b) => b[1] - a[1]));
      }
      return o;
    });
    out.topWindows = topBy.map((t) => ({ window: t.s, meanLmixture: t.mix, simpleFits: t.simple === 1 }));
    out.seconds = (Date.now() - tv) / 1000;
    res.variants.push(out);
    const best = out.components.filter((c) => c.pIso > 0).sort((a, b) => b.pIso - a.pIso).slice(0, 4).map((c) => `${c.label} ${c.log10pIso.toFixed(2)}`);
    const simple = out.components[nC];
    console.log(`${v.id}: ${passing} of ${N} windows pass equalities; simple log10P ${simple.log10pIso == null ? '-inf' : simple.log10pIso.toFixed(2)} (eff ${simple.effWindows.toFixed(1)}); best homophonic: ${best.join(' | ')}  [${out.seconds.toFixed(1)} s]`);
  }
  res.seconds = (Date.now() - t0) / 1000;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log(`wrote ${OUT} (${res.seconds.toFixed(1)} s)`);
}

main();
