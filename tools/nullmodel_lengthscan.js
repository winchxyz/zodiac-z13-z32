'use strict';
/**
 * tools/nullmodel_lengthscan.js - empirical unicity curve of our solver.
 *
 * For each length L and key type, encrypt N held-out English texts with
 * tools/encrypt.js and run the standard anneal pipeline (tools/anneal.js
 * solve(), same options as the self-test: 5-grams, entropy 0.5, word term
 * weight 1, top 20).  Records whether the top solution equals the truth
 * ("recovered"), the letter accuracy of the top solution, whether the truth is
 * among the returned solutions, and whether a different plaintext outscored the
 * truth under the solver objective.
 *
 * Key types:
 *   zodiac63 : 63 symbols, proportional allocation, homophones cycle (encrypt.js
 *              defaults), solved in homophonic mode
 *   simple   : one symbol per letter, solved in simple mode
 *
 * Plaintexts: textsample.phrase(L) (whole words from a sentence start) for
 * L <= 100, textsample.passage(L) (consecutive sentences cut at L) above.
 *
 * Usage:
 *   node tools/nullmodel_lengthscan.js [--lengths 13,20,32,50,75,100,150,200,340]
 *        [--types zodiac63,simple] [--n 10] [--threads 4] [--max-seconds 2400]
 *        [--restarts-short 54] [--restarts-long 36] [--out results/nullmodel/lengthscan]
 * Writes <out>.json (all rows, rewritten after every cipher) and <out>.csv
 * (one row per length x type).  Resumes from an existing <out>.json.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('./anneal');
const E = require('./encrypt');
const TS = require('./textsample');
const C = require('./cipher');
const lm = require('./lm');

function args() {
  const a = process.argv.slice(2);
  const o = { lengths: '13,20,32,50,75,100,150,200,340', types: 'zodiac63,simple', n: 10, threads: 4, maxSeconds: 2400, out: 'results/nullmodel/lengthscan', seed: 4242 };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--lengths') o.lengths = a[++i];
    else if (k === '--types') o.types = a[++i];
    else if (k === '--n') o.n = +a[++i];
    else if (k === '--threads') o.threads = +a[++i];
    else if (k === '--max-seconds') o.maxSeconds = +a[++i];
    else if (k === '--out') o.out = a[++i];
    else if (k === '--seed') o.seed = +a[++i];
    else if (k === '--restarts-short') RESTARTS_SHORT = +a[++i];
    else if (k === '--restarts-long') RESTARTS_LONG = +a[++i];
    else { console.error('unknown option ' + k); process.exit(2); }
  }
  return o;
}

const TYPES = {
  zodiac63: { enc: { symbols: 63, alloc: 'proportional', select: 'cycle' }, mode: 'homophonic' },
  simple: { enc: { alloc: 'simple' }, mode: 'simple' },
};

let RESTARTS_SHORT = 54, RESTARTS_LONG = 36;
function solverOpts(L) {
  // same as tools/selftest.js synthetic: wordweight 1, top 20; fewer restarts for long texts
  return { restarts: L <= 64 ? RESTARTS_SHORT : RESTARTS_LONG, top: 20, wordweight: 1, quiet: true };
}

function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

async function main() {
  const o = args();
  // single-writer guard: another live process resuming the same output -> do nothing
  const lock = o.out + '.lock';
  try { const pid = +fs.readFileSync(lock, 'utf8'); if (pid && pid !== process.pid && alive(pid)) { console.error(`${o.out}.json is being written by pid ${pid}; nothing to do`); return; } } catch (_) { /* no lock */ }
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(lock, String(process.pid));
  process.on('exit', () => { try { if (+fs.readFileSync(lock, 'utf8') === process.pid) fs.rmSync(lock); } catch (_) {} });
  const lengths = o.lengths.split(',').map(Number);
  const types = o.types.split(',');
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  const jsonPath = o.out + '.json';
  let rep = { tool: 'tools/nullmodel_lengthscan.js', created: new Date().toISOString(), command: 'node ' + process.argv.slice(1).join(' '), rows: [] };
  if (fs.existsSync(jsonPath)) {
    const prev = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    rep.rows = prev.rows || [];
    rep.resumedFrom = prev.created;
  }
  const done = new Set(rep.rows.map((r) => `${r.type}|${r.L}|${r.i}`));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nullmodel_ls_'));
  const pool = A.createPool({ threads: o.threads, orders: [{ n: 5, w: 1 }] });
  const t0 = Date.now();
  const save = () => fs.writeFileSync(jsonPath, JSON.stringify(rep, null, 1));
  let stopped = false;
  outer:
  for (const L of lengths) {
    // the same plaintexts for both key types at a given length
    const samp = TS.sampler(o.seed + L);
    const texts = [];
    for (let i = 0; i < o.n; i++) texts.push(L <= 100 ? samp.phrase(L) : samp.passage(L));
    for (const type of types) {
      const T = TYPES[type];
      for (let i = 0; i < o.n; i++) {
        if (done.has(`${type}|${L}|${i}`)) continue;
        if ((Date.now() - t0) / 1000 > o.maxSeconds) { stopped = true; break outer; }
        const ph = texts[i];
        const e = E.encryptText(ph.letters, Object.assign({ seed: 7000 + 100 * L + i }, T.enc));
        const f = path.join(tmp, `${type}_${L}_${i}.json`);
        fs.writeFileSync(f, JSON.stringify({ id: `${type}_${L}_${i}`, ascii: e.cipher, plaintext_aligned: ph.letters }));
        const ts = Date.now();
        const r = await A.solve(Object.assign({ cipher: f, mode: T.mode, threads: o.threads }, solverOpts(L)), pool);
        const best = r.solutions[0];
        const truthIdx = r.solutions.findIndex((s) => s.plaintext === ph.letters);
        const truthWs = lm.wordSegment(ph.letters);
        const row = {
          type, L, i, mode: T.mode, doc: ph.doc, truth: ph.letters, cipher: e.cipher, distinctSymbols: e.distinctSymbols,
          multiplicity: e.distinctSymbols / L, isomorph: C.isomorph(e.cipher),
          top: best.plaintext, topWords: best.words, topScore: best.score, truthScore: r.truthScore ? r.truthScore.score : null,
          topWordLogp: best.wordLogp, truthWordLogp: truthWs.logp,
          accuracy: best.accuracy, recovered: best.plaintext === ph.letters, truthRank: truthIdx >= 0 ? truthIdx + 1 : null,
          otherHigher: best.plaintext !== ph.letters && r.truthScore && best.score > r.truthScore.score + 1e-9,
          bestHitFraction: r.summary.bestHitFraction, distinctFound: r.summary.distinct,
          restarts: r.options.restarts, iters: r.options.iters, seconds: (Date.now() - ts) / 1000,
        };
        rep.rows.push(row);
        save();
        process.stderr.write(`${type} L=${L} #${i}: acc ${(100 * row.accuracy).toFixed(0)}% ${row.recovered ? 'RECOVERED' : ''} (${row.seconds.toFixed(1)} s, total ${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
      }
    }
  }
  pool.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  // summary CSV
  const groups = new Map();
  for (const r of rep.rows) {
    const k = `${r.type}|${r.L}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const lines = ['key_type,mode,length,n,recovered,recovery_rate,acc_ge_90,mean_accuracy,median_accuracy,truth_in_top20,other_higher_than_truth,mean_distinct_symbols,mean_multiplicity,mean_seconds'];
  const summary = [];
  for (const type of types) for (const L of lengths) {
    const g = groups.get(`${type}|${L}`);
    if (!g) continue;
    const n = g.length;
    const acc = g.map((r) => r.accuracy).sort((a, b) => a - b);
    const s = {
      type, mode: TYPES[type].mode, L, n,
      recovered: g.filter((r) => r.recovered).length,
      accGe90: g.filter((r) => r.accuracy >= 0.9).length,
      meanAccuracy: acc.reduce((a, b) => a + b, 0) / n,
      medianAccuracy: n % 2 ? acc[(n - 1) / 2] : (acc[n / 2 - 1] + acc[n / 2]) / 2,
      truthInTop: g.filter((r) => r.truthRank != null).length,
      otherHigher: g.filter((r) => r.otherHigher).length,
      meanDistinct: g.reduce((a, r) => a + r.distinctSymbols, 0) / n,
      meanMultiplicity: g.reduce((a, r) => a + r.multiplicity, 0) / n,
      meanSeconds: g.reduce((a, r) => a + r.seconds, 0) / n,
    };
    summary.push(s);
    lines.push([type, s.mode, L, n, s.recovered, (s.recovered / n).toFixed(3), s.accGe90, s.meanAccuracy.toFixed(3), s.medianAccuracy.toFixed(3), s.truthInTop, s.otherHigher, s.meanDistinct.toFixed(1), s.meanMultiplicity.toFixed(3), s.meanSeconds.toFixed(1)].join(','));
  }
  rep.summary = summary;
  rep.stoppedByTimeCap = stopped;
  rep.totalSeconds = (Date.now() - t0) / 1000;
  save();
  fs.writeFileSync(o.out + '.csv', lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
