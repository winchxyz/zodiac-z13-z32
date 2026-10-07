'use strict';
/**
 * tools/z13names_mc.js - Monte Carlo estimate of the fraction of name strings that fit a Z13 variant.
 *
 * For each variant x mode x list x pattern x number of fillers f (0-2, split between the ends), draw
 * N names of length Lc - f and a uniform placement, and check the fit (the same rule as
 * tools/z13names_enumerate.js --filler-at ends: fillers are free letters).
 *   prior   sampling: length split ∝ product of the parts' weight sums, each part ∝ its weight, an
 *           initial ∝ first-letter share  ->  estimates the WEIGHTED fraction of the enumeration;
 *   uniform sampling: every name string of that length equally likely -> the COUNT fraction.
 * Used for z13.circles_distinct (too many fits to enumerate) and as an independent check of the
 * enumerated fractions.
 *
 * Usage: node tools/z13names_mc.js [--variants z13.circles_distinct,z13.canonical] [--n 2000000]
 *        [--fillers 0,1,2] [--lists male,female] [--seed 7] [--out results/z13names/mc.json]
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');

const ROOT = path.join(__dirname, '..');
const VARIANT_FILES = {
  'z13.canonical': ['data/ciphers/variants/z13.canonical.txt', ''],
  'z13.circles_distinct': ['data/ciphers/variants/z13.circles_distinct.txt', ''],
  'z13.crosshair_null': ['data/ciphers/variants/z13.crosshair_null.txt', ''],
  'z13.bracket_is_perp': ['data/ciphers/variants/z13.bracket_is_perp.txt', ''],
  'z13.reversed': ['data/ciphers/variants/z13.reversed.txt', ''],
  'z13.letters_literal': ['data/ciphers/variants/z13.canonical.txt', 'A=A,E=E,N=N,K=K,M=M'],
};
const LISTS = { male: 'data/names/first_male.tsv', female: 'data/names/first_female.tsv' };
const PATTERNS = ['FL', 'FIL', 'FML', 'FIIL', 'IIL', 'LF'];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function readList(file, maxLen) {
  const byLen = [];
  for (let l = 0; l <= maxLen; l++) byLen.push({ names: [], w: [] });
  for (const ln of fs.readFileSync(path.join(ROOT, file), 'latin1').split('\n')) {
    if (!ln) continue;
    const t = ln.indexOf('\t');
    const n = ln.slice(0, t).trim();
    if (!/^[A-Z]+$/.test(n) || n.length > maxLen) continue;
    byLen[n.length].names.push(Uint8Array.from(n, (c) => c.charCodeAt(0) - 65));
    byLen[n.length].w.push(+ln.slice(t + 1));
  }
  for (const b of byLen) {
    b.N = b.names.length;
    b.W = b.w.reduce((a, x) => a + x, 0);
    b.cum = new Float64Array(b.N);
    let c = 0;
    for (let i = 0; i < b.N; i++) { c += b.w[i]; b.cum[i] = c; }
  }
  return byLen;
}

function pickWeighted(b, u) {
  const x = u * b.W;
  let lo = 0, hi = b.N - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.cum[m] < x) lo = m + 1; else hi = m; }
  return b.names[lo];
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const variants = opt('variants', 'z13.circles_distinct,z13.canonical').split(',');
  const N = +opt('n', 2000000);
  const fillersList = opt('fillers', '0,1,2').split(',').map(Number);
  const lists = opt('lists', 'male,female').split(',');
  const patterns = opt('patterns', PATTERNS.join(',')).split(',');
  const modes = opt('modes', 'simple,homophonic').split(',');
  const R = rng(+opt('seed', 7));
  const outFile = path.join(ROOT, opt('out', 'results/z13names/mc.json'));
  const t0 = Date.now();
  const SUR = readList('data/names/surnames.tsv', 13);
  const results = [];
  for (const lname of lists) {
    const FIRST = readList(LISTS[lname], 13);
    const initW = new Float64Array(26);
    let tw = 0;
    for (const b of FIRST) for (let i = 0; i < b.N; i++) { initW[b.names[i][0]] += b.w[i]; tw += b.w[i]; }
    const initCum = new Float64Array(26);
    let c = 0;
    for (let l = 0; l < 26; l++) { c += initW[l] / tw; initCum[l] = c; }
    const nInit = Array.from(initW).filter((x) => x > 0).length;
    const pickInit = (u) => { let l = 0; while (l < 25 && initCum[l] < u) l++; return l; };
    for (const vid of variants) {
      const [file, pin] = VARIANT_FILES[vid];
      const ci = C.loadCipher(path.join(ROOT, file));
      const { symbols, idOf, ids } = C.symbolTable(ci.text);
      const S = symbols.length, Lc = ci.text.length;
      const fixed = new Int8Array(S).fill(-1);
      for (const [s, l] of C.parseKey(pin)) if (idOf.has(s)) fixed[idOf.get(s)] = l.charCodeAt(0) - 65;
      const key = new Int8Array(S), own = new Int16Array(26);
      const buf = new Uint8Array(Lc);
      for (const pat of patterns) for (const f of fillersList) {
        const n = Lc - f;
        // length splits
        const splits = [];
        const rec = (i, rem, acc) => {
          if (i === pat.length) { if (rem === 0) splits.push(acc.slice()); return; }
          const t = pat[i];
          for (let l = 1; l <= rem; l++) {
            if (t === 'I' && l !== 1) continue;
            acc.push(l); rec(i + 1, rem - l, acc); acc.pop();
          }
        };
        rec(0, n, []);
        const partStat = (t, l) => (t === 'I' ? { N: l === 1 ? nInit : 0, W: l === 1 ? 1 : 0 } : t === 'L' ? SUR[l] || { N: 0, W: 0 } : FIRST[l] || { N: 0, W: 0 });
        const sw = [], sn = [];
        for (const sp of splits) {
          let w = 1, m = 1;
          sp.forEach((l, i) => { const st = partStat(pat[i], l); w *= st.W; m *= st.N; });
          sw.push(w); sn.push(m);
        }
        const totW = sw.reduce((a, b) => a + b, 0), totN = sn.reduce((a, b) => a + b, 0);
        if (!(totW > 0)) continue;
        for (const sampling of ['prior', 'uniform']) {
          const weights = sampling === 'prior' ? sw : sn;
          const tot = sampling === 'prior' ? totW : totN;
          const cum = [];
          let cc = 0;
          for (const x of weights) { cc += x / tot; cum.push(cc); }
          const hits = {};
          for (const mode of modes) hits[mode] = 0;
          for (let it = 0; it < N; it++) {
            let u = R(), si = 0;
            while (si < cum.length - 1 && cum[si] < u) si++;
            const sp = splits[si];
            const lead = Math.floor(R() * (f + 1));
            let p = lead;
            for (let i = 0; i < pat.length; i++) {
              const t = pat[i], l = sp[i];
              if (t === 'I') {
                buf[p++] = sampling === 'prior' ? pickInit(R()) : (() => { const k = Math.floor(R() * nInit); let q = -1; for (let x = 0; x < 26; x++) if (initW[x] > 0 && ++q === k) return x; return 0; })();
              } else {
                const b = t === 'L' ? SUR[l] : FIRST[l];
                const nm = sampling === 'prior' ? pickWeighted(b, R()) : b.names[Math.floor(R() * b.N)];
                for (let j = 0; j < l; j++) buf[p++] = nm[j];
              }
            }
            for (const mode of modes) {
              const simple = mode === 'simple';
              key.fill(-1); own.fill(-1);
              for (let s = 0; s < S; s++) if (fixed[s] >= 0) { key[s] = fixed[s]; own[fixed[s]] = s; }
              let ok = true;
              for (let q = lead; q < lead + n && ok; q++) {
                const s = ids[q], l = buf[q];
                const cur = key[s];
                if (cur >= 0) { if (cur !== l) ok = false; continue; }
                if (simple) { if (own[l] >= 0) { ok = false; continue; } own[l] = s; }
                key[s] = l;
              }
              if (ok) hits[mode]++;
            }
          }
          for (const mode of modes) {
            const h = hits[mode], phat = h / N;
            const z = 1.96, den = 1 + z * z / N;
            const centre = (phat + z * z / (2 * N)) / den, half = (z * Math.sqrt(phat * (1 - phat) / N + z * z / (4 * N * N))) / den;
            results.push({ variant: vid, mode, list: lname, pattern: pat, fillers: f, sampling, n: N, hits: h, fraction: phat, ci95: [Math.max(0, centre - half), centre + half], nameStrings: totN * (f + 1), priorWeight: totW * (f + 1) });
          }
        }
        process.stderr.write(`\r${lname} ${vid} ${pat} f=${f} ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
      }
    }
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ tool: 'tools/z13names_mc.js', created: new Date().toISOString(), seed: +opt('seed', 7), nPerCell: N, results, timeSeconds: (Date.now() - t0) / 1000 }, null, 1));
  process.stderr.write('\n');
  console.log(`cells: ${results.length}; ${(Date.now() - t0) / 1000} s; wrote ${path.relative(ROOT, outFile)}`);
}

main();
