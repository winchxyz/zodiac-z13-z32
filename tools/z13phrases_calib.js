'use strict';
/**
 * tools/z13phrases_calib.js - calibration for the z13phrases task: what would the Z13
 * enumeration look like if Z13 really were a 13-letter English phrase?
 *
 *   node tools/z13phrases_calib.js distinct [--n 20000] [--seed 4242]
 *       Cheap (one thread): distribution of the number of distinct symbols in 13-symbol
 *       encryptions of real held-out phrases under simple substitution and under
 *       Zodiac-style homophonic keys (whole-alphabet keys of 54 or 63 symbols, homophones
 *       cycled or random), the share with <= 8 distinct symbols (Z13 has 8), and with one
 *       symbol 3 times inside a 5-symbol window (Z13's circles at 4, 6, 8).
 *       -> results/z13phrases/calib/distinct.json
 *   node tools/z13phrases_calib.js enum [--n 30] [--seed 777] [--distinct 8] [--modes simple,homophonic]
 *        [--max-words 5] [--threads 4] [--cap 300]
 *       Heavy (run inside tools/run_slot.js): for n real phrases whose simple-substitution
 *       isomorph has --distinct distinct letters, enumerate the isomorph exactly like Z13
 *       (60006 common words, <= max-words words) and record the rank of the true phrase, the
 *       number of fits above the real-phrase median, and the pattern mass (sum of 10^wordLogp
 *       over all fits, the probability that English produces this pattern).
 *       -> results/z13phrases/calib/enum_<mode>.json (+ runs/ per phrase)
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const lm = require('./lm');
const TS = require('./textsample');
const E = require('./encrypt');
const Cph = require('./cipher');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'results', 'z13phrases', 'calib');

function opts(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i]; else o._.push(argv[i]); }
  return o;
}

function tripleIn5(s) {
  for (let i = 0; i + 5 <= s.length; i++) {
    const m = new Map();
    for (let k = i; k < i + 5; k++) { m.set(s[k], (m.get(s[k]) || 0) + 1); if (m.get(s[k]) >= 3) return true; }
  }
  return false;
}

function distinctCmd(o) {
  const N = +o.n || 20000;
  const seed = +o.seed || 4242;
  const smp = TS.sampler(seed);
  const rng = makeRng(seed, 3);
  const systems = {
    simple: { alloc: 'simple' },
    homophonic63_cycle: { symbols: 63, select: 'cycle' },
    homophonic63_random: { symbols: 63, select: 'random' },
    homophonic54_cycle: { symbols: 54, select: 'cycle' },
  };
  const res = {};
  for (const k of Object.keys(systems)) res[k] = { hist: {}, le8: 0, eq8: 0, triple5: 0, sameIsomorphAsZ13: 0 };
  const z13iso = 'abcdefegehcag';
  for (let i = 0; i < N; i++) {
    const p = smp.phrase(13).letters;
    for (const [k, sys] of Object.entries(systems)) {
      const key = E.makeKey({ plaintext: p, allLetters: true, alloc: sys.alloc || 'proportional', symbols: sys.symbols, rng });
      const c = E.encrypt(p, key, { select: sys.select || 'cycle', rng }).cipher;
      const d = new Set(c).size;
      const r = res[k];
      r.hist[d] = (r.hist[d] || 0) + 1;
      if (d <= 8) r.le8++;
      if (d === 8) r.eq8++;
      if (tripleIn5(c)) r.triple5++;
      if (Cph.isomorph(c) === z13iso) r.sameIsomorphAsZ13++;
    }
  }
  for (const r of Object.values(res)) { r.shareLe8 = r.le8 / N; r.shareEq8 = r.eq8 / N; r.shareTriple5 = r.triple5 / N; }
  const out = { tool: 'tools/z13phrases_calib.js distinct', created: new Date().toISOString(), n: N, seed, z13: { distinct: 8, triple5: true, isomorph: z13iso }, systems: res,
    note: 'keys cover the whole alphabet (allLetters); proportional allocation of 54/63 symbols by English letter frequency; cycle = homophones used in turn from a random start' };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'distinct.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

function runEnum(args, logFile) {
  return new Promise((res) => {
    const fd = fs.openSync(logFile, 'w');
    const ch = spawn(process.execPath, [path.join(__dirname, 'z13phrases_enum.js'), ...args, '--quiet'], { cwd: ROOT, stdio: ['ignore', fd, fd] });
    ch.on('exit', (c) => { fs.closeSync(fd); res(c); });
  });
}

async function enumCmd(o) {
  const N = +o.n || 30;
  const seed = +o.seed || 777;
  const want = +o.distinct || 8;
  const modes = String(o.modes || 'simple,homophonic').split(',');
  const M = o['max-words'] || '5';
  const threads = o.threads || '4';
  const cap = o.cap || '300';
  const smp = TS.sampler(seed);
  const phrases = [];
  const seen = new Set();
  for (let t = 0; phrases.length < N && t < 200000; t++) {
    const p = smp.phrase(13);
    if (new Set(p.letters).size !== want || seen.has(p.letters)) continue;
    // the true phrase must be producible by the enumeration (common words, <= M words), else its rank is undefined
    const ws = p.words.toUpperCase().split(' ');
    if (ws.length > +M || !ws.every((w) => lm.isWord(w))) continue;
    seen.add(p.letters);
    phrases.push(p);
  }
  fs.mkdirSync(path.join(OUT, 'ciphers'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });
  for (const mode of modes) {
    const rows = [];
    for (let i = 0; i < phrases.length; i++) {
      const p = phrases[i];
      const iso = Cph.isomorph(p.letters);
      const cf = path.join(OUT, 'ciphers', `p${String(i).padStart(2, '0')}.txt`);
      fs.writeFileSync(cf, iso + '\n');
      const truth = lm.wordSegment(p.letters, { vocab: 'common' }).logp;
      const name = `p${String(i).padStart(2, '0')}_${mode}`;
      const outJ = path.join(OUT, 'runs', `${name}.json`);
      const tlow = String(Math.min(mode === 'simple' ? -16 : -13, truth - 0.5));
      const args = ['--cipher', path.relative(ROOT, cf), '--mode', mode, '--top-words', '60006', '--max-words', M, '--null', 'results/z13phrases/null_real_phrases.json',
        '--tlow', tlow, '--stream-min', 'p50', '--thresholds', String(truth - 1e-6), '--threads', threads, '--max-seconds', cap, '--top', '200', '--out', path.relative(ROOT, outJ)];
      const t1 = Date.now();
      await runEnum(args, path.join(OUT, 'runs', `${name}.log`));
      let r;
      try { r = JSON.parse(fs.readFileSync(outJ, 'utf8')); } catch (_) { rows.push({ i, words: p.words, error: 'no output' }); continue; }
      const thrKey = Object.keys(r.counts.atLeast).find((k) => k.startsWith('t'));
      const atOrAbove = r.counts.atLeast[thrKey].count; // includes the truth itself
      const found = r.top.some((t) => t.plaintext === p.letters) || atOrAbove > 0;
      const row = {
        i, words: p.words, isomorph: iso, truthLogp: +truth.toFixed(4), complete: r.counts.complete, consistentStrings: r.counts.consistentStrings,
        truthRank: atOrAbove, truthIsTop: r.top.length > 0 && r.top[0].plaintext === p.letters,
        aboveMedian: r.counts.atLeast.real_p50.count, aboveP75: r.counts.atLeast.real_p75.count,
        log10PatternMass: +r.posterior.log10TotalMassScored.toFixed(4), truthPosteriorShare: Math.pow(10, truth - r.posterior.log10TotalMassScored),
        topShare: r.posterior.topShare, best: r.top[0] && r.top[0].words, bestLogp: r.top[0] && r.top[0].wordLogp, seconds: (Date.now() - t1) / 1000,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
    const ok = rows.filter((r) => !r.error && r.complete);
    const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
    const summary = {
      mode, n: rows.length, completeRuns: ok.length,
      truthIsTop: ok.filter((r) => r.truthIsTop).length,
      truthRankMedian: med(ok.map((r) => r.truthRank)),
      truthInTop10: ok.filter((r) => r.truthRank <= 10).length,
      truthInTop100: ok.filter((r) => r.truthRank <= 100).length,
      aboveMedianMedian: med(ok.map((r) => r.aboveMedian)),
      aboveMedianRange: ok.length ? [Math.min(...ok.map((r) => r.aboveMedian)), Math.max(...ok.map((r) => r.aboveMedian))] : null,
      log10PatternMassMedian: med(ok.map((r) => r.log10PatternMass)),
      log10PatternMassAll: ok.map((r) => r.log10PatternMass).sort((a, b) => a - b),
      truthPosteriorShareMedian: med(ok.map((r) => r.truthPosteriorShare)),
    };
    const out = { tool: 'tools/z13phrases_calib.js enum', created: new Date().toISOString(), seed, distinct: want, maxWords: M, summary, rows };
    fs.writeFileSync(path.join(OUT, `enum_${mode}.json`), JSON.stringify(out, null, 1));
    console.log(JSON.stringify(summary));
  }
}

const o = opts(process.argv.slice(2));
if (o._[0] === 'distinct') distinctCmd(o);
else if (o._[0] === 'enum') enumCmd(o).catch((e) => { console.error(e); process.exit(1); });
else console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
