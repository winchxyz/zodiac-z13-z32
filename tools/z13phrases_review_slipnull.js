'use strict';
/**
 * tools/z13phrases_review_slipnull.js - REVIEWER null model for the one-slip result (OF THE DIRECTOR,
 * slip at position 6, -5.83, "2.48 above the no-slip best").  The attacker asserted that such a rise is
 * expected when 13 wildcard positions are tried; this measures it.  For Z13 and for K random
 * rearrangements of Z13's own symbols (same repeat profile), run simple substitution with no slip and
 * with a wildcard at each of the 13 positions, on a reduced word space (default top 5000 words, <= 4
 * words), and record the best fit score and counts above the 13-letter real median.
 *
 *   node tools/z13phrases_review_slipnull.js [--k 10] [--top-words 5000] [--max-words 4] [--threads 4]
 *        [--seed 4321] [--cap 60] [--out results/z13phrases/review/slipnull.json]
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Cph = require('./cipher');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const Z13 = 'AENz0K0M0[NAM';
const o = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) o[process.argv[i].slice(2)] = process.argv[++i];
// --tag X: separate work directory (slipnull_X) so that two batches can run at once
const RDIR = path.join(ROOT, 'results', 'z13phrases', 'review', o.tag ? `slipnull_${o.tag}` : 'slipnull');
const K = +o.k || 10, TW = String(o['top-words'] || 5000), MW = String(o['max-words'] || 4), TH = String(o.threads || 4), CAP = String(o.cap || 60);
const seed = +o.seed || 4321;
const out = o.out || 'results/z13phrases/review/slipnull.json';

function runEnum(args, logFile) {
  return new Promise((res) => {
    const fd = fs.openSync(logFile, 'w');
    const ch = spawn(process.execPath, [path.join(__dirname, 'z13phrases_enum.js'), ...args, '--quiet'], { cwd: ROOT, stdio: ['ignore', fd, fd] });
    ch.on('exit', (c) => { fs.closeSync(fd); res(c); });
  });
}

async function main() {
  fs.mkdirSync(path.join(RDIR, 'ciphers'), { recursive: true });
  fs.mkdirSync(path.join(RDIR, 'runs'), { recursive: true });
  const ciphers = [{ name: 'z13', text: Z13 }];
  const rng = makeRng(seed, 5);
  const seen = new Set([Cph.isomorph(Z13)]);
  // --english: controls are simple-substitution isomorphs of real held-out 13-letter phrases with
  // Z13's repeat profile (tools/textsample.js) instead of scrambles of Z13's symbols
  if (o.english) {
    const TS = require('./textsample');
    const prof = (s) => { const m = new Map(); for (const ch of s) m.set(ch, (m.get(ch) || 0) + 1); return [...m.values()].sort((x, y) => y - x).join(','); };
    const smp = TS.sampler(seed);
    const want = prof(Z13);
    for (let t = 0; ciphers.length < K + 1 && t < 200000; t++) {
      const p = smp.phrase(13);
      if (prof(p.letters) !== want || seen.has(p.letters)) continue;
      seen.add(p.letters);
      ciphers.push({ name: `eng${String(ciphers.length).padStart(2, '0')}`, text: Cph.isomorph(p.letters), truth: p.letters, words: p.words });
    }
  }
  for (let t = 0; !o.english && ciphers.length < K + 1 && t < 100000; t++) {
    const a = Z13.split('');
    for (let i = a.length - 1; i > 0; i--) { const j = rng.int(i + 1); const x = a[i]; a[i] = a[j]; a[j] = x; }
    const s = a.join(''), iso = Cph.isomorph(s);
    if (seen.has(iso)) continue;
    seen.add(iso);
    ciphers.push({ name: `scr${String(ciphers.length).padStart(2, '0')}`, text: s });
  }
  const rows = [];
  for (const c of ciphers) {
    const cf = path.join(RDIR, 'ciphers', `${c.name}.txt`);
    fs.writeFileSync(cf, c.text + '\n');
    const row = { name: c.name, cipher: c.text, isomorph: Cph.isomorph(c.text), truth: c.words || null, noSlip: null, slips: [] };
    for (let p = -1; p < 13; p++) {
      const tag = p < 0 ? 'none' : String(p).padStart(2, '0');
      const outJ = path.join(RDIR, 'runs', `${c.name}_${tag}.json`);
      const args = ['--cipher', path.relative(ROOT, cf), '--mode', 'simple', '--top-words', TW, '--max-words', MW, '--null', 'results/z13phrases/null_real_phrases.json',
        '--tlow', 'p10', '--stream-min', 'p50', '--top', '20', '--threads', TH, '--max-seconds', CAP, '--out', path.relative(ROOT, outJ)];
      if (p >= 0) args.push('--slip', String(p));
      await runEnum(args, outJ.replace(/\.json$/, '.log'));
      let r;
      try { r = JSON.parse(fs.readFileSync(outJ, 'utf8')); } catch (_) { row.slips.push({ p, error: 'no output' }); continue; }
      const e = { p, complete: r.counts.complete, n: r.counts.consistentStrings, aboveMedian: r.counts.atLeast.real_p50.count, best: r.top[0] ? r.top[0].words : null, bestLogp: r.top[0] ? r.top[0].wordLogp : null };
      if (p < 0) row.noSlip = e; else row.slips.push(e);
    }
    const sl = row.slips.filter((s) => s.bestLogp != null);
    const top = sl.reduce((a, s) => (!a || s.bestLogp > a.bestLogp ? s : a), null);
    row.maxSlipBestLogp = top ? top.bestLogp : null;
    row.maxSlipBest = top ? `${top.best} @${top.p}` : null;
    row.improvement = top && row.noSlip && row.noSlip.bestLogp != null ? +(top.bestLogp - row.noSlip.bestLogp).toFixed(3) : null;
    row.slipAboveMedianTotal = row.slips.reduce((a, s) => a + (s.aboveMedian || 0), 0);
    row.allComplete = !!(row.noSlip && row.noSlip.complete && row.slips.every((s) => s.complete));
    rows.push(row);
    console.log(JSON.stringify({ name: row.name, cipher: row.cipher, noSlipBest: row.noSlip && [row.noSlip.best, row.noSlip.bestLogp], maxSlip: [row.maxSlipBest, row.maxSlipBestLogp], improvement: row.improvement, slipAboveMedianTotal: row.slipAboveMedianTotal, allComplete: row.allComplete }));
  }
  const z = rows[0], s = rows.slice(1).filter((r) => r.maxSlipBestLogp != null);
  const share = (f, v) => +(s.filter((r) => r[f] != null && r[f] >= v).length / Math.max(1, s.length)).toFixed(3);
  const summary = {
    z13: { noSlipBestLogp: z.noSlip && z.noSlip.bestLogp, maxSlipBestLogp: z.maxSlipBestLogp, maxSlipBest: z.maxSlipBest, improvement: z.improvement, slipAboveMedianTotal: z.slipAboveMedianTotal },
    scrambles: { n: s.length, maxSlipBestLogp: s.map((r) => r.maxSlipBestLogp).sort((a, b) => a - b), improvement: s.map((r) => r.improvement).sort((a, b) => a - b), noSlipBest: s.map((r) => r.noSlip && r.noSlip.bestLogp).sort((a, b) => a - b) },
    shareOfScramblesAtLeastZ13: { maxSlipBestLogp: share('maxSlipBestLogp', z.maxSlipBestLogp), improvement: share('improvement', z.improvement) },
  };
  fs.writeFileSync(path.resolve(ROOT, out), JSON.stringify({ tool: 'tools/z13phrases_review_slipnull.js', created: new Date().toISOString(), options: { K, TW, MW, TH, CAP, seed }, summary, rows }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
