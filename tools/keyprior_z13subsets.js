'use strict';
/**
 * tools/keyprior_z13subsets.js - partial key carry-over test for Z13 by projection.
 *
 * Input: every homophonically consistent Z13 dictionary fit (enumerate.js words --stream TSV:
 * plaintext, wordLogp, words, unknown), or name fits (enumerate.js names --stream TSV; then the
 * score column is the log10 name weight).  For a key K and a subset T of the Z13 symbols that K
 * covers, the statistic is
 *   best(T)  = max score over fits whose letters agree with K on every symbol of T
 *   count(T) = number of fits with score >= thr that agree with K on T
 * i.e. the best English (or name) that survives pinning exactly the symbols in T.  All 2^m - 1
 * non-empty subsets are evaluated (m = 6 overlap symbols A E N z K M, or 7 with '[' read as the
 * upside-down T 't', README question 13.2).  The same is computed for N null keys (key letters
 * permuted among the key's symbols), giving a p-value per subset and a family-wise p-value for the
 * smallest per-subset p (each null key's own min-p, ranked among the nulls).  p-values use symmetric pooled
 * ranks (the real key is one member of the pool of N + 1 keys), so the real and null min-p are comparable
 * (fixed 2026-10-07 after the first run counted ties asymmetrically).
 *
 *   node tools/keyprior_z13subsets.js --fits <tsv> --kind words|names --keys z408,z340,union --null 5000
 *        --with-t2 --threads 4 --seed 13 --out results/keyprior/z13subsets_words.json
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const readline = require('readline');
const K = require('./keyprior_lib');

// Z13 canonical AENz0K0M0[NAM: overlap symbols and one position of each
const SYMS = ['A', 'E', 'N', 'z', 'K', 'M', '['];
const POS = [0, 1, 2, 3, 5, 7, 9];

function scanKey(letters, scores, nFits, m, keyLetters, thrs) {
  // keyLetters: Int8Array(m) letter codes; returns bestByMask (Float64Array 2^m), countByMask[thr][mask]
  const NM = 1 << m;
  const best = new Float64Array(NM).fill(-Infinity);
  const cnt = thrs.map(() => new Float64Array(NM));
  for (let i = 0; i < nFits; i++) {
    let mask = 0;
    const b = i * 7;
    for (let j = 0; j < m; j++) if (letters[b + j] === keyLetters[j]) mask |= 1 << j;
    const s = scores[i];
    if (s > best[mask]) best[mask] = s;
    for (let t = 0; t < thrs.length; t++) if (s >= thrs[t]) cnt[t][mask]++;
  }
  // superset transforms: best(T) = max_{mask ⊇ T}, count(T) = sum_{mask ⊇ T}
  for (let j = 0; j < m; j++) {
    for (let T = 0; T < NM; T++) {
      if (T & (1 << j)) continue;
      const U = T | (1 << j);
      if (best[U] > best[T]) best[T] = best[U];
      for (let t = 0; t < thrs.length; t++) cnt[t][T] += cnt[t][U];
    }
  }
  return { best, cnt };
}

if (!isMainThread) {
  const { letters, scores, nFits, m, thrs } = workerData;
  parentPort.on('message', (msg) => {
    if (msg.type === 'exit') process.exit(0);
    const out = [];
    for (const job of msg.jobs) {
      const r = scanKey(letters, scores, nFits, m, Int8Array.from(job.key), thrs);
      out.push({ id: job.id, best: Array.from(r.best), cnt: r.cnt.map((c) => Array.from(c)) });
    }
    parentPort.postMessage({ type: 'done', out });
  });
  parentPort.postMessage({ type: 'ready' });
  return;
}

async function loadFits(file, kind) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let header = null;
  const L = [], S = [], P = [];
  for await (const line of rl) {
    if (!header) { header = line.split('\t'); continue; }
    if (!line) continue;
    const f = line.split('\t');
    const pt = f[0];
    let s;
    if (kind === 'words') s = parseFloat(f[1]);
    else {
      const wi = header.indexOf('weight');
      s = Math.log10(parseFloat(f[wi]));
    }
    if (!Number.isFinite(s)) continue;
    S.push(s); P.push(pt);
  }
  // sort by score descending
  const idx = S.map((_, i) => i).sort((a, b) => S[b] - S[a]);
  // --max-fits K: keep only the K best fits (censors the statistic below the K-th score, identically for real and null keys)
  const n = Math.min(idx.length, loadFits.maxFits || Infinity);
  const lettersBuf = new Uint8Array(new SharedArrayBuffer(n * 7));
  const scoresBuf = new Float64Array(new SharedArrayBuffer(n * 8));
  const pts = new Array(n);
  for (let r = 0; r < n; r++) {
    const i = idx[r];
    const pt = P[i];
    for (let j = 0; j < 7; j++) {
      const ch = pt[POS[j]];
      lettersBuf[r * 7 + j] = /[A-Z]/.test(ch) ? ch.charCodeAt(0) - 65 : 255;   // '?' fillers never agree
    }
    scoresBuf[r] = S[i];
    pts[r] = pt;
  }
  return { letters: lettersBuf, scores: scoresBuf, pts, n, header };
}

function subsetName(T, m) {
  let s = '';
  for (let j = 0; j < m; j++) if (T & (1 << j)) s += SYMS[j];
  return s;
}
function popcount(x) { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; }

async function main() {
  const o = K.parseArgs(process.argv.slice(2));
  const kind = o.kind || 'words';
  const keys = String(o.keys || 'z408,z340,union').split(',');
  const N = +(o.null || 2000);
  const threads = +(o.threads || 4);
  const seed = +(o.seed || 13);
  const m = o['with-t2'] ? 7 : 6;
  const t0 = Date.now();
  if (o['max-fits']) loadFits.maxFits = +o['max-fits'];
  const F = await loadFits(o.fits, kind);
  process.stderr.write(`loaded ${F.n} fits in ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
  const rankThr = String(o['thr-ranks'] || '1000,10000,100000').split(',').map(Number).filter((r) => r <= F.n);
  const thrs = rankThr.map((r) => F.scores[r - 1]);
  const workers = [];
  for (let i = 0; i < threads; i++) workers.push(new Worker(__filename, { workerData: { letters: F.letters, scores: F.scores, nFits: F.n, m, thrs } }));

  const jobs = [];
  const meta = [];
  keys.forEach((kn, ki) => {
    const km = K.key(kn);
    // '[' carries the letter of the plain upside-down T 't' (README 13.2)
    const keyLet = (mp) => SYMS.slice(0, m).map((s) => { const sym = s === '[' ? 't' : s; return mp.get(sym).charCodeAt(0) - 65; });
    jobs.push({ id: `${ki}:-1`, key: keyLet(km) });
    const rng = K.makeRng(seed, 2000 + ki);
    for (let j = 0; j < N; j++) jobs.push({ id: `${ki}:${j}`, key: keyLet(K.permuteKey(km, rng)) });
    meta.push({ kn, real: null, nulls: new Array(N), realLetters: SYMS.slice(0, m).map((s) => km.get(s === '[' ? 't' : s)).join('') });
  });
  let next = 0, done = 0;
  const chunk = 16;
  await new Promise((resolve, reject) => {
    let active = 0;
    const send = (w) => { if (next >= jobs.length) return false; const part = jobs.slice(next, next + chunk); next += part.length; active++; w.postMessage({ type: 'jobs', jobs: part }); return true; };
    workers.forEach((w) => {
      w.on('error', reject);
      w.on('message', (msg) => {
        if (msg.type === 'ready') { send(w); return; }
        active--;
        for (const r of msg.out) {
          const [ki, j] = r.id.split(':').map(Number);
          if (j < 0) meta[ki].real = r; else meta[ki].nulls[j] = r;
          done++;
        }
        if (!send(w) && active === 0) resolve();
      });
    });
  });
  workers.forEach((w) => w.postMessage({ type: 'exit' }));

  const NM = 1 << m;
  const results = meta.map((mt) => {
    const subsets = [];
    // per-subset null arrays
    const pReal = new Float64Array(NM).fill(1);
    const pNull = mt.nulls.map(() => new Float64Array(NM).fill(1));
    const stats = [{ name: 'best', get: (r, T) => r.best[T] }].concat(thrs.map((thr, t) => ({ name: `count@rank${rankThr[t]}`, get: (r, T) => r.cnt[t][T] })));
    const famByStat = {};
    for (const st of stats) {
      const pR = new Float64Array(NM).fill(1);
      const pN = mt.nulls.map(() => new Float64Array(NM).fill(1));
      for (let T = 1; T < NM; T++) {
        const nv = mt.nulls.map((r) => st.get(r, T));
        const rv = st.get(mt.real, T);
        // symmetric pooled ranks: the real key is one member of the pool {real} + nulls (N + 1 keys);
        // every member's p = (# pool members >= its value) / (N + 1), counting itself
        const sorted = Float64Array.from(nv.concat([rv])).sort();
        const geCount = (v) => { // number of pool values >= v
          let lo = 0, hi = sorted.length;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] >= v - 1e-9) hi = mid; else lo = mid + 1; }
          return sorted.length - lo;
        };
        pR[T] = geCount(rv) / sorted.length;
        nv.forEach((v, j) => { pN[j][T] = geCount(v) / sorted.length; });
        if (st.name === 'best') {
          const finite = nv.filter(Number.isFinite);
          subsets.push({
            subset: subsetName(T, m), k: popcount(T), realBest: Number.isFinite(rv) ? rv : null,
            realBestFit: null, nullMeanFinite: finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : null,
            nullFiniteFraction: finite.length / nv.length, p: pR[T],
          });
        } else {
          const s = subsets.find((x) => x.subset === subsetName(T, m));
          s[st.name] = { real: rv, nullMean: nv.reduce((a, b) => a + b, 0) / nv.length, p: pR[T] };
        }
      }
      // family-wise: min p over subsets, overall and per size k
      const fam = {};
      const groups = [['all', () => true]].concat([...Array(m).keys()].map((k) => [`k=${k + 1}`, (T) => popcount(T) === k + 1]));
      for (const [g, f] of groups) {
        let minR = 1, argR = 0;
        for (let T = 1; T < NM; T++) if (f(T) && pR[T] < minR) { minR = pR[T]; argR = T; }
        const nullMins = pN.map((arr) => { let mn = 1; for (let T = 1; T < NM; T++) if (f(T) && arr[T] < mn) mn = arr[T]; return mn; });
        const le = nullMins.filter((v) => v <= minR + 1e-12).length;   // pool members (besides the real key) at least as extreme
        fam[g] = { minP: minR, argSubset: subsetName(argR, m), familywiseP: (le + 1) / (nullMins.length + 1), nullsAtLeastAsExtreme: le };
      }
      famByStat[st.name] = fam;
    }
    // best fit text for the real key per subset
    const keyLetters = Int8Array.from(mt.realLetters, (ch) => ch.charCodeAt(0) - 65);
    for (const s of subsets) {
      let T = 0;
      for (const ch of s.subset) T |= 1 << SYMS.indexOf(ch);
      for (let i = 0; i < F.n; i++) {
        let ok = true;
        for (let j = 0; j < m; j++) if ((T & (1 << j)) && F.letters[i * 7 + j] !== keyLetters[j]) { ok = false; break; }
        if (ok) { s.realBestFit = F.pts[i]; break; }
      }
    }
    subsets.sort((a, b) => a.k - b.k || a.subset.localeCompare(b.subset));
    return { key: mt.kn, realLetters: mt.realLetters, symbols: SYMS.slice(0, m).join(''), familywise: famByStat, subsets };
  });
  const out = {
    tool: 'tools/keyprior_z13subsets.js', created: new Date().toISOString(), argv: process.argv.slice(2).join(' '),
    fits: { file: o.fits, kind, n: F.n, scoreQuantiles: { top: F.scores[0], rank1000: F.scores[Math.min(F.n, 1000) - 1], rank10000: F.scores[Math.min(F.n, 10000) - 1], median: F.scores[F.n >> 1] } },
    thresholds: rankThr.map((r, t) => ({ rank: r, score: thrs[t] })),
    null: { kind: 'permute', n: N, seed },
    note: "'[' is pinned to the letter of the plain upside-down T 't' when --with-t2 is given (z13.bracket_is_perp hypothesis)",
    seconds: (Date.now() - t0) / 1000,
    results,
  };
  if (o.out) K.writeJSON(o.out, out);
  for (const r of results) {
    console.log(`key ${r.key} (${r.symbols} -> ${r.realLetters})`);
    for (const [st, fam] of Object.entries(r.familywise)) console.log(`  ${st}: ` + Object.entries(fam).map(([g, v]) => `${g} minP=${v.minP.toFixed(4)}(${v.argSubset}) fw=${v.familywiseP.toFixed(3)}`).join('  '));
    const full = r.subsets.filter((s) => s.k >= m - 1);
    for (const s of full) console.log(`    ${s.subset.padEnd(7)} best ${s.realBest == null ? '-inf' : s.realBest.toFixed(2)} ${s.realBestFit || ''} p=${s.p.toFixed(4)} nullFinite=${s.nullFiniteFraction.toFixed(3)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
