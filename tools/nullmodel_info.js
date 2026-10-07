'use strict';
/**
 * tools/nullmodel_info.js - information content of Z13 / Z32 and the expected
 * number of English solutions.
 *
 * For every transcription variant:
 *   C_uniform  -log2 P(fit) for uniformly random letters (Oranchak 2013's "1 in 12 million" for Z13)
 *   C_iid      -log2 P(fit) for i.i.d. letters with English frequencies (exact; simple mode via the
 *              Moebius function of the partition lattice of the symbol classes)
 *   C_corpus   -log2 of the corpus window fit fraction (results/nullmodel/windows/window_counts.json,
 *              'clean' windows: no run of three identical letters)
 *   H(K)       key entropy: homophonic s*log2(26); simple log2(26!/(26-s)!)
 *   H_L        entropy of an L-letter English window: 6-gram cross-entropy (held-out windows,
 *              arbitrary start and word-aligned), and the per-letter rates 2.2, 1.3, 1.0 bits x L
 *   N          expected number of English strings that fit = 2^(H_L - C)
 *   H(W|fit)   E[-log2 P6(W) | W fits] - C_corpus, the bits still missing after the cipher is known;
 *              2^H(W|fit) is the effective number of fitting English strings under the 6-gram model
 * and, if results/nullmodel/solvernull.json exists, the posterior P6(best)/f of the solver's best
 * reading of each real cipher (probability that it is the plaintext under the 6-gram prior).
 *
 * Usage: node tools/nullmodel_info.js [--samples 60000] [--out results/nullmodel/information.json]
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const LOG2_10 = Math.log2(10);
const LOG2_26 = Math.log2(26);

function args() {
  const a = process.argv.slice(2);
  const o = { samples: 60000, out: 'results/nullmodel/information.json', cache: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--samples') o.samples = +a[++i];
    else if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--cache') o.cache = a[++i];
  }
  return o;
}

function readNpy(file) {
  const b = fs.readFileSync(file);
  const ver = b[6];
  const hlen = ver === 1 ? b.readUInt16LE(8) : b.readUInt32LE(8);
  const off = (ver === 1 ? 10 : 12) + hlen;
  return new Uint8Array(b.buffer, b.byteOffset + off, b.length - off);
}

function classesOf(text) {
  const m = new Map();
  for (let i = 0; i < text.length; i++) { if (!m.has(text[i])) m.set(text[i], []); m.get(text[i]).push(i); }
  return [...m.values()];
}

/** all set partitions of [0..n-1] (n <= 10) */
function partitions(n) {
  const out = [];
  const blocks = [];
  (function rec(i) {
    if (i === n) { out.push(blocks.map((b) => b.slice())); return; }
    for (const b of blocks) { b.push(i); rec(i + 1); b.pop(); }
    blocks.push([i]); rec(i + 1); blocks.pop();
  })(0);
  return out;
}

function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

/** exact P(fit) for i.i.d. letters with probabilities p: homophonic and simple */
function iidFit(sizes, p) {
  const pw = (k) => p.reduce((a, x) => a + x ** k, 0);
  const hom = sizes.reduce((a, k) => a * pw(k), 1);
  let simple = null;
  if (sizes.length > 26) simple = 0;
  else if (sizes.length <= 10) {
    // sum over injective assignments = sum over partitions pi of mu(pi) prod_B pw(sum sizes in B)
    simple = 0;
    for (const pi of partitions(sizes.length)) {
      let term = 1;
      for (const B of pi) {
        const k = B.reduce((a, i) => a + sizes[i], 0);
        term *= ((B.length - 1) % 2 ? -1 : 1) * fact(B.length - 1) * pw(k);
      }
      simple += term;
    }
  }
  return { hom, simple };
}

function log2fact(n) { let r = 0; for (let i = 2; i <= n; i++) r += Math.log2(i); return r; }

function main() {
  const o = args();
  const t0 = Date.now();
  const meta = lm.meta();
  const freq = meta.ngrams.letter_frequencies;
  const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => freq[c]);
  const psum = p.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 26; i++) p[i] /= psum;
  const wc = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/nullmodel/windows/window_counts.json'), 'utf8'));
  const rep = { tool: 'tools/nullmodel_info.js', created: new Date().toISOString(), command: 'node ' + process.argv.slice(1).join(' '), variants: {}, entropy: {} };

  // ---- entropy of L-letter windows under the 6-gram model (held-out and training, arbitrary and aligned)
  const cache = o.cache || path.join(process.env.TEMP || '/tmp', 'zodiac_nullmodel_cache');
  const splits = {};
  for (const sp of ['heldout', 'train']) {
    splits[sp] = { a: readNpy(path.join(cache, `${sp}_letters.npy`)), s: readNpy(path.join(cache, `${sp}_wstart.npy`)), e: readNpy(path.join(cache, `${sp}_wend.npy`)) };
  }
  const rng = makeRng(1970, 0x656e74);
  const Ls = [12, 13, 32];
  for (const L of Ls) {
    rep.entropy[L] = {};
    for (const sp of ['heldout', 'train']) {
      const { a, s, e } = splits[sp];
      for (const aligned of [false, true]) {
        const vals = [];
        let tries = 0;
        while (vals.length < o.samples && tries < o.samples * 400) {
          tries++;
          const i = rng.int(a.length - L);
          let ok = true;
          for (let k = 0; k < L; k++) if (a[i + k] === 26) { ok = false; break; }
          if (!ok) continue;
          if (aligned && !(s[i] && e[i + L - 1])) continue;
          let w = '';
          for (let k = 0; k < L; k++) w += String.fromCharCode(65 + a[i + k]);
          vals.push(-lm.ngramScore(w, 6).logp * LOG2_10);
        }
        const n = vals.length;
        const mean = vals.reduce((x, y) => x + y, 0) / n;
        const sd = Math.sqrt(vals.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1));
        rep.entropy[L][`${sp}_${aligned ? 'aligned' : 'any'}`] = { n, meanBits: mean, perLetter: mean / L, sdBits: sd, seBits: sd / Math.sqrt(n) };
      }
    }
  }

  // ---- per variant
  const H6 = (L, key) => rep.entropy[L === 12 ? 12 : L][key].meanBits;
  for (const [vid, v] of Object.entries(wc.variants)) {
    const L = v.length;
    const classes = classesOf(v.text);
    const sizes = classes.map((c) => c.length);
    const s = sizes.length;
    const pinned = v.pinned;
    // pinned variant (z13.letters_literal): the 5 letter glyphs A E N K M decode to themselves
    const nPinned = pinned ? 5 : 0;
    const uniHom = (L - s + nPinned) * LOG2_26;
    const free = s - nPinned;
    const uniSimple = s > 26 ? Infinity : uniHom - (log2fact(26 - nPinned) - log2fact(26 - nPinned - free) - free * LOG2_26);
    let iid;
    if (pinned) {
      const t = v.text;
      let hom = 1;
      classes.forEach((cl) => {
        const sym = t[cl[0]];
        if ('AENKM'.includes(sym)) hom *= p[sym.charCodeAt(0) - 65] ** cl.length;
        else hom *= p.reduce((a, x) => a + x ** cl.length, 0);
      });
      iid = { hom, simple: null };
    } else iid = iidFit(sizes, p);
    const tr = v.splits.train, ho = v.splits.heldout;
    const fHom = tr.homophonic.clean_fraction, fSim = tr.simple.fraction;
    const fHomAll = (tr.homophonic.clean_fits + ho.homophonic.clean_fits) / (tr.windows + ho.windows);
    const fSimAll = (tr.simple.fits + ho.simple.fits) / (tr.windows + ho.windows);
    // exact Poisson 95% interval for the training count (Garwood), via chi-square quantiles approximated by Wilson-Hilferty
    const garwood = (k, N) => {
      const chi2q = (pq, df) => { if (df <= 0) return 0; const z = pq < 0.5 ? -normq(1 - pq) : normq(pq); const h = 2 / (9 * df); return df * (1 - h + z * Math.sqrt(h)) ** 3; };
      return [k === 0 ? 0 : chi2q(0.025, 2 * k) / 2 / N, chi2q(0.975, 2 * k + 2) / 2 / N];
    };
    const HK = { homophonic: free * LOG2_26, simple: s > 26 ? null : log2fact(26 - nPinned) - log2fact(26 - nPinned - free) };
    const C = {
      uniform: { homophonic: uniHom, simple: uniSimple },
      iid: { homophonic: -Math.log2(iid.hom), simple: iid.simple == null ? null : iid.simple > 0 ? -Math.log2(iid.simple) : Infinity },
      corpus: {
        homophonic: fHom > 0 ? -Math.log2(fHom) : null, simple: fSim > 0 ? -Math.log2(fSim) : null,
        homophonicCI95: garwood(tr.homophonic.clean_fits, tr.windows).map((x) => (x > 0 ? -Math.log2(x) : null)),
        simpleCI95: garwood(tr.simple.fits, tr.windows).map((x) => (x > 0 ? -Math.log2(x) : null)),
        trainCounts: { windows: tr.windows, homophonicClean: tr.homophonic.clean_fits, simple: tr.simple.fits },
        heldoutCounts: { windows: ho.windows, homophonicClean: ho.homophonic.clean_fits, simple: ho.simple.fits },
        pooledHomophonic: fHomAll > 0 ? -Math.log2(fHomAll) : null, pooledSimple: fSimAll > 0 ? -Math.log2(fSimAll) : null,
        alignedHomophonic: tr.homophonic.clean_aligned_fraction > 0 ? -Math.log2(tr.homophonic.clean_aligned_fraction) : null,
        alignedSimple: tr.simple.aligned_fraction > 0 ? -Math.log2(tr.simple.aligned_fraction) : null,
      },
    };
    const HL = {
      ngram6_any: H6(L, 'heldout_any'), ngram6_aligned: H6(L, 'heldout_aligned'),
      rate2_2: 2.2 * L, rate1_3: 1.3 * L, rate1_0: 1.0 * L,
    };
    const N = {};
    for (const mode of ['homophonic', 'simple']) {
      const c = C.corpus[mode];
      N[mode] = {};
      for (const [k, h] of Object.entries(HL)) N[mode][k] = c != null ? { log2: h - c, value: 2 ** (h - c) } : null;
    }
    // H(W|fit) from the fitting windows' 6-gram probabilities
    const fitFile = (sp) => path.join(ROOT, `results/nullmodel/windows/fits_${vid}_${sp}.tsv`);
    const condH = {};
    for (const sp of ['heldout', 'train']) {
      if (!fs.existsSync(fitFile(sp))) continue;
      const rows = fs.readFileSync(fitFile(sp), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
      for (const mode of ['homophonic', 'simple']) {
        let n = 0, sum = 0;
        for (const r of rows) {
          if (r[4] !== '1') continue;
          if (mode === 'simple' && r[3] !== '1') continue;
          const c = +r[1];
          sum += c * -lm.ngramScore(r[0], 6).logp * LOG2_10;
          n += c;
          if (n > 20000) break;
        }
        if (n) {
          const meanBits = sum / n;
          const cc = C.corpus[mode];
          condH[`${sp}_${mode}`] = { windows: n, meanMinusLog2P6: meanBits, HWgivenFit: cc != null ? meanBits - cc : null, effectiveSolutions: cc != null ? 2 ** (meanBits - cc) : null };
        }
      }
    }
    rep.variants[vid] = { text: v.text, length: L, symbols: s, classSizes: sizes.filter((x) => x > 1), pinned, keyEntropyBits: HK, constraintBits: C, windowEntropyBits: HL, expectedSolutions: N, conditionalEntropy: condH,
      shannonSpuriousKeys: HK.homophonic != null ? { homophonic_rate2_2: 2 ** (HK.homophonic + 2.2 * L - L * LOG2_26) } : null };
  }
  // training-vs-heldout bias of the 6-gram model on 13 / 32-letter windows
  rep.entropy.trainingBiasBits = {};
  for (const L of Ls) rep.entropy.trainingBiasBits[L] = rep.entropy[L].heldout_any.meanBits - rep.entropy[L].train_any.meanBits;

  // ---- posterior of the solver's best readings (needs results/nullmodel/solvernull.json)
  const snf = path.join(ROOT, 'results/nullmodel/solvernull.json');
  if (fs.existsSync(snf)) {
    const sn = JSON.parse(fs.readFileSync(snf, 'utf8'));
    rep.posterior = [];
    for (const r of sn.rows.filter((x) => x.set === 'real')) {
      const v = rep.variants[r.variant];
      if (!v) continue;
      const c = v.constraintBits.corpus[r.mode === 'simple' ? 'simple' : 'homophonic'];
      const rows = (r.top5 || []).map((t) => ({ words: t.words, log2P6: t.logp6 * LOG2_10, posteriorLog10: c != null ? t.logp6 + c / LOG2_10 : null }));
      rep.posterior.push({ variant: r.variant, mode: r.mode, best: r.bestWords, constraintBits: c, top: rows });
    }
  }
  rep.seconds = (Date.now() - t0) / 1000;
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, JSON.stringify(rep, null, 1));
  // console summary
  for (const [vid, v] of Object.entries(rep.variants)) {
    const c = v.constraintBits;
    const f = (x) => (x == null ? '   -  ' : x === Infinity ? '  inf ' : x.toFixed(2).padStart(6));
    console.log(`${vid.padEnd(22)} C_uni ${f(c.uniform.homophonic)}/${f(c.uniform.simple)} C_iid ${f(c.iid && c.iid.homophonic)}/${f(c.iid && c.iid.simple)} C_corpus ${f(c.corpus.homophonic)}/${f(c.corpus.simple)}  H6 ${v.windowEntropyBits.ngram6_any.toFixed(1)} N_hom(6g) ${v.expectedSolutions.homophonic.ngram6_any ? v.expectedSolutions.homophonic.ngram6_any.value.toExponential(2) : '-'}`);
  }
  console.log('entropy', JSON.stringify(rep.entropy));
  console.log(`(${rep.seconds.toFixed(1)} s)`);
}

/** standard normal quantile (Acklam) */
function normq(pq) {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pl = 0.02425;
  let q, r;
  if (pq < pl) { q = Math.sqrt(-2 * Math.log(pq)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (pq <= 1 - pl) { q = pq - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  q = Math.sqrt(-2 * Math.log(1 - pq));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

main();
