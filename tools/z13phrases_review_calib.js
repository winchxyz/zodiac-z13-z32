'use strict';
/**
 * tools/z13phrases_review_calib.js - REVIEWER calibration for the z13phrases task (not part of the
 * attacker's pipeline; outputs under results/z13phrases/review/).
 *
 * Question: is Z13's dictionary-fit picture (number of fits above the real-phrase median, best fit
 * score, total LM mass of all fits = how probable English makes this isomorph) different from
 *   (a) random rearrangements of Z13's own 13 symbols (same repeat profile 3,2,2,2,1,1,1,1), and
 *   (b) simple-substitution encryptions of real held-out 13-letter phrases with the same profile?
 * For (b) it also records the rank of the true phrase among all fits (truth-rank calibration that the
 * attacker wrote in tools/z13phrases_calib.js but never ran).
 *
 *   node tools/z13phrases_review_calib.js [--n-scr 30] [--n-eng 30] [--top-words 20000] [--max-words 4]
 *        [--threads 4] [--seed 9001] [--cap 150] [--tlow p10] [--out results/z13phrases/review/calib_profile.json]
 *
 * Every enumeration is tools/z13phrases_enum.js (simple substitution), run as a child process.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const lm = require('./lm');
const TS = require('./textsample');
const Cph = require('./cipher');
const EN = require('./enumerate');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const RDIR = path.join(ROOT, 'results', 'z13phrases', 'review', 'calib');
const Z13 = 'AENz0K0M0[NAM';

function opts(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
  return o;
}

function profile(s) {
  const m = new Map();
  for (const c of s) m.set(c, (m.get(c) || 0) + 1);
  return [...m.values()].sort((a, b) => b - a).join(',');
}

function runEnum(args, logFile) {
  return new Promise((res) => {
    const fd = fs.openSync(logFile, 'w');
    const ch = spawn(process.execPath, [path.join(__dirname, 'z13phrases_enum.js'), ...args, '--quiet'], { cwd: ROOT, stdio: ['ignore', fd, fd] });
    ch.on('exit', (c) => { fs.closeSync(fd); res(c); });
  });
}

function pctRank(arr, x) {
  // share of controls with value >= x (upper tail) and <= x (lower tail)
  const n = arr.length;
  return { geShare: +(arr.filter((v) => v >= x).length / n).toFixed(3), leShare: +(arr.filter((v) => v <= x).length / n).toFixed(3) };
}

function quant(arr, q) {
  const s = arr.slice().sort((a, b) => a - b);
  if (!s.length) return null;
  const x = (s.length - 1) * q, lo = Math.floor(x), hi = Math.ceil(x);
  return +(s[lo] + (s[hi] - s[lo]) * (x - lo)).toFixed(4);
}

async function main() {
  const o = opts(process.argv.slice(2));
  const nScr = +(o['n-scr'] ?? 30), nEng = +(o['n-eng'] ?? 30);
  const topWords = String(o['top-words'] || 20000), maxWords = String(o['max-words'] || 4);
  const threads = String(o.threads || 4), cap = String(o.cap || 150), seed = +o.seed || 9001;
  const tlow = String(o.tlow || 'p10');
  const out = o.out || path.join('results', 'z13phrases', 'review', 'calib_profile.json');
  const wanted = profile(Z13);
  const zIso = Cph.isomorph(Z13);
  fs.mkdirSync(path.join(RDIR, 'ciphers'), { recursive: true });
  fs.mkdirSync(path.join(RDIR, 'runs'), { recursive: true });

  // enumeration word list, to say whether a real phrase is inside the searched space at all
  const list = new Set(EN.readTsv(path.join(ROOT, 'data', 'lm', 'words_common.tsv'), +topWords, 13, 1).map((e) => e.w));

  const items = [{ kind: 'z13', name: 'z13_canonical', text: Z13 }];
  const rng = makeRng(seed, 11);
  const seenIso = new Set([zIso]);
  for (let t = 0; items.filter((x) => x.kind === 'scramble').length < nScr && t < 100000; t++) {
    const a = Z13.split('');
    for (let i = a.length - 1; i > 0; i--) { const j = rng.int(i + 1); const x = a[i]; a[i] = a[j]; a[j] = x; }
    const s = a.join('');
    const iso = Cph.isomorph(s);
    if (seenIso.has(iso)) continue;
    seenIso.add(iso);
    items.push({ kind: 'scramble', name: `scr${String(items.length).padStart(2, '0')}`, text: s });
  }
  const smp = TS.sampler(seed);
  const seenTxt = new Set();
  let draws = 0;
  for (let t = 0; items.filter((x) => x.kind === 'english').length < nEng && t < 200000; t++) {
    const p = smp.phrase(13);
    draws++;
    if (profile(p.letters) !== wanted || seenTxt.has(p.letters)) continue;
    seenTxt.add(p.letters);
    const ws = p.words.toUpperCase().split(' ');
    items.push({ kind: 'english', name: `eng${String(items.length).padStart(2, '0')}`, text: Cph.isomorph(p.letters), truth: p.letters, words: p.words, doc: p.doc,
      inSpace: ws.length <= +maxWords && ws.every((w) => list.has(w)) });
  }

  const rows = [];
  for (const it of items) {
    const cf = path.join(RDIR, 'ciphers', `${it.name}.txt`);
    fs.writeFileSync(cf, it.text + '\n');
    const outJ = path.join(RDIR, 'runs', `${it.name}.json`);
    const args = ['--cipher', path.relative(ROOT, cf), '--mode', 'simple', '--top-words', topWords, '--max-words', maxWords,
      '--null', 'results/z13phrases/null_real_phrases.json', '--tlow', tlow, '--stream-min', 'p50', '--threads', threads,
      '--max-seconds', cap, '--top', '300', '--out', path.relative(ROOT, outJ)];
    let truthLogp = null;
    if (it.truth) { truthLogp = lm.wordSegment(it.truth, { vocab: 'common' }).logp; args.push('--thresholds', String(truthLogp - 1e-6)); }
    const t1 = Date.now();
    await runEnum(args, path.join(RDIR, 'runs', `${it.name}.log`));
    let r;
    try { r = JSON.parse(fs.readFileSync(outJ, 'utf8')); } catch (_) { rows.push({ kind: it.kind, name: it.name, error: 'no output' }); continue; }
    const a = r.counts.atLeast;
    const row = {
      kind: it.kind, name: it.name, cipher: it.text, isomorph: Cph.isomorph(it.text), complete: r.counts.complete,
      consistentStrings: r.counts.consistentStrings, aboveMedian: a.real_p50.count, aboveP75: a.real_p75.count, aboveP90: a.real_p90.count,
      bestLogp: r.top[0] ? r.top[0].wordLogp : null, best: r.top[0] ? r.top[0].words : null,
      log10Mass: Number.isFinite(r.posterior.log10TotalMassScored) ? +r.posterior.log10TotalMassScored.toFixed(4) : null,
      topShare: r.posterior.topShare, seconds: +((Date.now() - t1) / 1000).toFixed(1),
    };
    if (it.truth) {
      const tk = Object.keys(a).find((k) => k.startsWith('t'));
      Object.assign(row, { truth: it.truth, words: it.words, doc: it.doc, inSpace: it.inSpace, truthLogp: +truthLogp.toFixed(4),
        truthRank: it.inSpace ? a[tk].count : null, truthIsTop: !!(r.top[0] && r.top[0].plaintext === it.truth),
        truthShare: it.inSpace && r.posterior.log10TotalMassScored > -Infinity ? Math.pow(10, truthLogp - r.posterior.log10TotalMassScored) : null });
    }
    rows.push(row);
    console.log(JSON.stringify(row));
  }

  const ok = rows.filter((r) => !r.error && r.complete);
  const z = ok.find((r) => r.kind === 'z13');
  const grp = (k) => ok.filter((r) => r.kind === k);
  const stat = (k, f) => {
    const g = grp(k).map((r) => r[f]).filter((v) => v != null);
    return { n: g.length, p10: quant(g, 0.1), p25: quant(g, 0.25), median: quant(g, 0.5), p75: quant(g, 0.75), p90: quant(g, 0.9), min: g.length ? Math.min(...g) : null, max: g.length ? Math.max(...g) : null,
      z13: z ? z[f] : null, z13Tail: z && g.length ? pctRank(g, z[f]) : null };
  };
  const eng = grp('english').filter((r) => r.inSpace);
  const summary = {
    z13: z || null,
    scramble: { aboveMedian: stat('scramble', 'aboveMedian'), aboveP75: stat('scramble', 'aboveP75'), bestLogp: stat('scramble', 'bestLogp'), log10Mass: stat('scramble', 'log10Mass'), consistentStrings: stat('scramble', 'consistentStrings') },
    english: { aboveMedian: stat('english', 'aboveMedian'), aboveP75: stat('english', 'aboveP75'), bestLogp: stat('english', 'bestLogp'), log10Mass: stat('english', 'log10Mass'), consistentStrings: stat('english', 'consistentStrings') },
    truthRank: eng.length ? {
      nInSpace: eng.length, nEnglish: grp('english').length,
      truthIsTop: eng.filter((r) => r.truthIsTop).length, inTop10: eng.filter((r) => r.truthRank <= 10).length, inTop100: eng.filter((r) => r.truthRank <= 100).length,
      median: quant(eng.map((r) => r.truthRank), 0.5), all: eng.map((r) => r.truthRank).sort((x, y) => x - y),
      truthShareMedian: quant(eng.map((r) => r.truthShare), 0.5),
      truthAboveMedianShare: +(eng.filter((r) => r.truthLogp >= -9.8613).length / eng.length).toFixed(3),
    } : null,
  };
  const res = { tool: 'tools/z13phrases_review_calib.js', created: new Date().toISOString(), options: { nScr, nEng, topWords, maxWords, threads, cap, seed, tlow, profile: wanted, englishDraws: draws }, summary, rows };
  fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, out), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
