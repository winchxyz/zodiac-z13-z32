#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_solve.js - batch runner for the z32search task: runs many tools/anneal.js
 * solves (free search, crib placements, read orders, null ciphers) in one process with a
 * persistent worker pool, appending one compact JSON line per job (resumable).
 *
 *   node tools/run_slot.js --label z32search -- node tools/z32search_solve.js --jobs results/z32search/jobs/free.json \
 *        --out results/z32search/free/runs.jsonl --threads 4 [--max-seconds 2400] [--top 200]
 *
 * Jobs file: {"defaults": {anneal options}, "jobs": [{"id", "group", "cipher": text | path,
 *   "order": [read order, optional], "truth": plaintext in WRITTEN order (optional), ...anneal options}]}
 * Anneal option names as in tools/anneal.js solve(): mode, n, wordweight, entropy, restarts, iters,
 * perRestart, top, crib (array of "WORD@pos"), pin, seed.
 * Each output line: {id, group, text (reading order), pairs, options, summary, truth?, truthScore?,
 *   solutions: [{plaintext, score, ng5, wordLogp, unknown, words, hits, accuracy?}], error?}.
 * ng5 = lm.ngramScore(pt, 5).sum and wordLogp = lm.wordSegment(pt) log10 P (common vocabulary,
 * word-bigram model) are reference metrics, comparable across jobs whatever objective was annealed.
 */
const fs = require('fs');
const path = require('path');
const A = require('./anneal');
const C = require('./cipher');
const lm = require('./lm');
const Z = require('./z32search_lib');

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const k = a.slice(2);
    if (k === 'quiet') { o.quiet = true; continue; }
    o[k] = argv[++i];
  }
  return o;
}

function ordersOf(n) {
  return [...new Set(A.parseOrders(n || '5').map((x) => x.n))].sort();
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.jobs || !o.out) { console.log('usage: node tools/z32search_solve.js --jobs F.json[,G.json] --out F.jsonl[,G.jsonl] [--threads 4] [--max-seconds S] [--top K]'); process.exit(2); }
  const jobFiles = o.jobs.split(','), outFiles = o.out.split(',');
  if (jobFiles.length !== outFiles.length) throw new Error('--jobs and --out need the same number of comma-separated files');
  const threads = +o.threads || 4;
  const maxSec = +o['max-seconds'] || 0;
  const topK = +o.top || 0;
  const t0 = Date.now();
  const pools = new Map();
  const poolFor = (orders) => {
    const key = orders.join(',');
    if (!pools.has(key)) pools.set(key, A.createPool({ threads, orders, six: 'exact', forceWorkers: true }));
    return pools.get(key);
  };
  for (let fi = 0; fi < jobFiles.length; fi++) {
  const spec = JSON.parse(fs.readFileSync(jobFiles[fi], 'utf8'));
  const defaults = spec.defaults || {};
  o.out = outFiles[fi];
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  const done = new Set();
  if (fs.existsSync(o.out)) {
    for (const ln of fs.readFileSync(o.out, 'utf8').split(/\r?\n/)) { if (!ln.trim()) continue; try { done.add(JSON.parse(ln).id); } catch (_) { /* partial line */ } }
  }
  let nRun = 0, nSkip = 0, nErr = 0;
  const jobs = spec.jobs || [];
  for (let ji = 0; ji < jobs.length; ji++) {
    const job = Object.assign({}, defaults, jobs[ji]);
    if (done.has(job.id)) { nSkip++; continue; }
    if (maxSec && (Date.now() - t0) / 1000 > maxSec) { console.error(`z32search_solve: --max-seconds reached after ${nRun} jobs; ${jobs.length - ji} left (rerun to resume)`); break; }
    const ci0 = C.loadCipher(job.cipher);
    const order = job.order || null;
    const text = order ? Z.applyOrder(ci0.text, order) : ci0.text;
    let truthRead = null;
    if (job.truth) truthRead = order ? Z.applyOrder(job.truth, order) : job.truth;
    const ci = { id: job.id, text, rows: [text], readOrder: null, plaintext: truthRead, plaintextReadOrder: null, source: 'z32search job', json: null };
    const opts = {
      cipher: ci, mode: job.mode || 'homophonic', n: job.n || '5', wordweight: job.wordweight ?? 1, entropy: job.entropy ?? 0.5,
      restarts: job.restarts || 40, iters: job.iters || 0, perRestart: job.perRestart || 1, top: job.top || topK || 20,
      crib: job.crib || [], pin: job.pin || '', seed: job.seed ?? 1, quiet: true,
    };
    const rec = { id: job.id, group: job.group || null, meta: job.meta || null, text, pairs: Z.pairsOf(text), isomorph: Z.isomorph(text) };
    const tj = Date.now();
    try {
      const pool = poolFor(ordersOf(opts.n));
      const res = await A.solve(opts, pool);
      rec.options = { mode: res.options.mode, n: res.options.orders.map((x) => `${x.n}:${x.w}`).join(','), wordweight: res.options.wordweight, entropy: res.options.entropy, restarts: res.options.restarts, iters: res.options.iters, perRestart: res.options.perRestart, crib: (job.crib || []), seed: opts.seed };
      rec.summary = { distinct: res.summary.distinct, bestScore: res.summary.bestScore, bestHits: res.summary.bestHits, ms: Date.now() - tj };
      if (res.warnings && res.warnings.length) rec.warnings = res.warnings;
      if (truthRead) {
        const rs = Z.rescore(truthRead);
        rec.truth = { plaintext: truthRead, ng5: rs.ng5, wordLogp: rs.wordLogp, unknown: rs.unknown, words: rs.words, score: res.truthScore ? res.truthScore.score : null };
      }
      rec.solutions = res.solutions.map((s) => ({
        plaintext: s.plaintext, score: s.score,
        ng5: s.ngram && s.ngram[5] ? s.ngram[5].sum : lm.ngramScore(s.plaintext, 5).sum,
        wordLogp: s.wordLogp, unknown: s.unknownWords.length, words: s.words, hits: s.hits,
        accuracy: s.accuracy != null ? s.accuracy : undefined,
        cribPositions: s.cribPositions ? s.cribPositions.slice(0, 3) : undefined,
      }));
      nRun++;
    } catch (e) {
      rec.error = String(e && e.message || e);
      nErr++;
    }
    fs.appendFileSync(o.out, JSON.stringify(rec) + '\n');
    if (!o.quiet) {
      const b = rec.solutions && rec.solutions[0];
      process.stderr.write(`[${ji + 1}/${jobs.length}] ${job.id} ${((Date.now() - tj) / 1000).toFixed(1)}s ${rec.error ? 'ERROR ' + rec.error : (b ? b.score.toFixed(2) + ' ' + b.words : '')}\n`);
    }
  }
  console.log(`z32search_solve: ran ${nRun}, skipped (already done) ${nSkip}, errors ${nErr}, ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${o.out}`);
  }
  for (const p of pools.values()) p.close();
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
