'use strict';
/**
 * tools/keyprior_h1z13.js - what the Z13 full-pin statistic looks like if a key WERE reused.
 *
 * Under "reuse", the six overlap symbols (A E N z K M) carry the letters of the true plaintext.
 * For plaintexts we take Z13 dictionary fits (enumerate.js words TSV, all-vocabulary fits ranked by
 * word log10 P): the top --top fits, and --sample fits drawn uniformly from the top --pool.  For each,
 * pin the six symbols to the fit's letters and search '0' and '[' exhaustively with the same
 * objective as tools/keyprior_fullpin.js.  The resulting distribution is the alternative (H1)
 * distribution of the statistic; the observed real-key values are placed in it.
 *
 *   node tools/keyprior_h1z13.js --fits <tsv> --top 2000 --pool 100000 --sample 2000 --seed 5
 *        --observed z408:-70.91,z340:-62.05 --out results/keyprior/h1_z13.json
 */
const fs = require('fs');
const readline = require('readline');
const K = require('./keyprior_lib');

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const top = +(o.top || 2000), pool = +(o.pool || 100000), nS = +(o.sample || 2000);
  const rl = readline.createInterface({ input: fs.createReadStream(o.fits), crlfDelay: Infinity });
  const fits = [];
  let head = true;
  for await (const line of rl) {
    if (head) { head = false; continue; }
    const f = line.split('\t');
    if (f.length < 4 || f[3] !== '0') continue;       // all-vocabulary fits only
    fits.push([f[0], parseFloat(f[1]), f[2]]);
  }
  fits.sort((a, b) => b[1] - a[1]);
  const text = K.cipherText('z13.canonical');
  const sc = K.makeScorer(text, K.statOpts(o.stat || 'objective'));
  const rng = K.makeRng(+(o.seed || 5), 0);
  const evalFit = (pt) => {
    const m = new Map();
    for (let i = 0; i < text.length; i++) if (text[i] !== '0' && text[i] !== '[') m.set(text[i], pt[i]);
    const r = K.exhaustiveBest(sc, sc.fixedFrom(m), 1);
    const own = new Map(m); own.set('0', pt[4]); own.set('[', pt[9]);
    return { best: r.top[0].score, bestPt: r.top[0].plaintext, fitScore: sc.score(sc.fixedFrom(own)) };
  };
  const sets = {
    top: fits.slice(0, top).map((f) => Object.assign({ fit: f[0], words: f[2], wordLogp: f[1] }, evalFit(f[0]))),
    sample: [],
  };
  const P = fits.slice(0, pool);
  for (let i = 0; i < nS; i++) { const f = P[rng.int(P.length)]; sets.sample.push(Object.assign({ fit: f[0], words: f[2], wordLogp: f[1] }, evalFit(f[0]))); }
  const observed = String(o.observed || '').split(',').filter(Boolean).map((t) => { const [k, v] = t.split(':'); return { key: k, score: parseFloat(v) }; });
  const out = { tool: 'tools/keyprior_h1z13.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '), statistic: o.stat || 'objective', allVocabFits: fits.length, sets: {} };
  for (const [nm, arr] of Object.entries(sets)) {
    const v = arr.map((x) => x.best);
    out.sets[nm] = {
      n: arr.length, summary: K.summary(v),
      observedPlacement: observed.map((ob) => ({ key: ob.key, score: ob.score, fractionOfH1AtOrBelow: v.filter((x) => x <= ob.score + 1e-9).length / v.length })),
      examples: arr.slice(0, 5).map((x) => ({ fit: x.fit, words: x.words, best: x.best, bestPt: x.bestPt })),
      worst: arr.slice().sort((a, b) => a.best - b.best).slice(0, 5).map((x) => ({ fit: x.fit, words: x.words, best: x.best, bestPt: x.bestPt })),
    };
    const s = out.sets[nm].summary;
    console.log(`${nm}: n=${arr.length} best-completion score median ${s.median.toFixed(2)} q05 ${s.q05.toFixed(2)} min ${s.min.toFixed(2)} | ` + out.sets[nm].observedPlacement.map((p) => `${p.key} ${p.score}: ${(100 * p.fractionOfH1AtOrBelow).toFixed(2)}% of H1 at or below`).join('; '));
  }
  if (o.out) K.writeJSON(o.out, out);
}
main().catch((e) => { console.error(e); process.exit(1); });
