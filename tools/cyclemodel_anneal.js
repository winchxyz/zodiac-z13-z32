'use strict';
/**
 * tools/cyclemodel_anneal.js - tools/anneal.js with the isomorph likelihood of the
 * homophone-selection model added to the objective:
 *
 *   score = n-gram term - penalties + wordW * wordSegment(P) + cycW * log10 L(P)
 *
 * L(P) = P(cipher repeat pattern | P, fitted selection model), marginalised over
 * keys (tools/cyclemodel_lib.js).  The word term must be on (--wordweight > 0)
 * because the cycle term rides on the inner-loop word hook.
 *
 *   node tools/cyclemodel_anneal.js --cipher data/ciphers/z32.json --rows 17,15 --cycweight 1 \
 *        --wordweight 1 --restarts 200 --threads 4 --top 100 --out results/cyclemodel/x.json
 *   (all tools/anneal.js options are accepted; --cycweight 0 = plain anneal.js objective)
 * Extra options: --rows L1,L2 (written row lengths, default one row), --model F,
 *   --hyp-S "30,35,..." --hyp-regimes "z408p12,z340,z408p3" (default: the fitted defaultHyp).
 * Every reported solution gets logL (mixture), logLperRegime and lmPlusL = wordLogp + logL.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const A = require('./anneal');
const lmshare = require('./lmshare');
const CM = require('./cyclemodel_lib');
const C = require('./cipher');

class CycPool {
  constructor(opts) {
    this.n = Math.max(1, opts.threads || 4);
    this.spec = { orders: [...new Set(opts.orders || [5])], markov: !!opts.markov, six: opts.six || 'exact' };
    this.shared = lmshare.build(this.spec);
    this.workers = [];
    this.pid = 0; this.jobId = 0;
    for (let i = 0; i < this.n; i++) {
      const w = new Worker(path.join(__dirname, 'cyclemodel_anneal_worker.js'), { workerData: { lm: this.shared, cyc: opts.cyc } });
      w.unref();
      this.workers.push(w);
    }
  }
  covers(spec) {
    const have = new Set(this.spec.orders);
    if (spec.orders.some((n) => !have.has(n))) return false;
    if (spec.markov && !this.spec.markov) return false;
    if (spec.orders.includes(6) && spec.six !== this.spec.six) return false;
    return true;
  }
  run(def, nRestarts, opts = {}) {
    const pid = ++this.pid;
    const batch = Math.max(1, opts.batch || Math.ceil(nRestarts / (this.n * 6)));
    const jobs = [];
    for (let r = 0; r < nRestarts; r += batch) jobs.push([r, Math.min(nRestarts, r + batch)]);
    return new Promise((resolve, reject) => {
      const out = [];
      let next = 0, active = 0, done = 0, failed = false;
      const handlers = [];
      const cleanup = () => this.workers.forEach((w, i) => w.off('message', handlers[i]));
      const dispatch = (w) => {
        if (next >= jobs.length) return false;
        const [r0, r1] = jobs[next++];
        active++;
        w.postMessage({ type: 'job', pid, jobId: ++this.jobId, r0, r1 });
        return true;
      };
      this.workers.forEach((w, i) => {
        const h = (m) => {
          if (failed || m.pid !== pid) return;
          if (m.type === 'error') { failed = true; cleanup(); reject(new Error(m.error)); return; }
          if (m.type !== 'done') return;
          active--;
          for (const x of m.out) out.push(x);
          done += m.out.length;
          if (opts.onProgress) opts.onProgress(done, nRestarts);
          if (!dispatch(w) && active === 0) { cleanup(); resolve(out.sort((a, b) => a.restart - b.restart)); }
        };
        handlers[i] = h;
        w.on('message', h);
        w.ref();
      });
      for (const w of this.workers) w.postMessage({ type: 'problem', pid, def });
      for (const w of this.workers) dispatch(w);
      if (jobs.length === 0) { cleanup(); resolve(out); }
    }).finally(() => { for (const w of this.workers) w.unref(); });
  }
  close() { for (const w of this.workers) w.terminate(); this.workers = []; }
}

function parseArgs(argv) {
  const o = {};
  const crib = [];
  const flags = new Set(['no-polish', 'quiet', 'written', 'help']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument '${a}'`);
    const k = a.slice(2);
    if (flags.has(k)) { o[k] = true; continue; }
    const v = argv[++i];
    if (k === 'crib') crib.push(v); else o[k] = v;
  }
  const map = { 'per-restart': 'perRestart', 'forbid-letters': 'forbid', 'max-per-letter': 'maxPerLetter', 'read-order': 'readorder' };
  for (const [a, b] of Object.entries(map)) if (o[a] !== undefined) { o[b] = o[a]; delete o[a]; }
  if (o['no-polish']) { o.polish = false; delete o['no-polish']; }
  if (crib.length) o.crib = crib;
  return o;
}

/** library entry: run one solve with the cycle term; returns the anneal.js result + cyc fields */
async function solveCyc(o, pool) {
  const modelFile = o.model || 'results/cyclemodel/fit.json';
  const model = CM.loadModel(modelFile);
  const hyp = Object.assign({}, model.defaultHyp);
  if (o['hyp-S']) hyp.S = String(o['hyp-S']).split(',').map(Number);
  if (o['hyp-regimes']) hyp.regimes = String(o['hyp-regimes']).split(',');
  const rowsLengths = o.rows ? String(o.rows).split(',').map(Number) : null;
  const cycW = o.cycweight == null ? 1 : +o.cycweight;
  if (cycW > 0 && !(+o.wordweight > 0)) throw new Error('--cycweight needs --wordweight > 0 (the cycle term rides on the word hook)');
  let own = false;
  if (!pool) {
    const orders = A.parseOrders(o.n || '5').map((x) => x.n);
    pool = new CycPool({ threads: +o.threads || 4, orders, six: o.six || 'exact', cyc: { modelFile, hyp, rowsLengths, weight: cycW } });
    own = true;
  }
  const res = await A.solve(Object.assign({}, o, { quiet: o.quiet !== undefined ? o.quiet : true }), pool);
  if (own) pool.close();
  // annotate with logL (same isomorph in reading order = written order unless a read order is used)
  const ci = C.loadCipher(o.cipher);
  const text = res.cipher.text;
  const iso = CM.isoOf(text);
  const rows = rowsLengths ? CM.rowsFor(rowsLengths) : new Array(text.length).fill(0);
  const sc = CM.makeScorer(model, { iso, rows, hyp });
  const perReg = {};
  for (const r of hyp.regimes) perReg[r] = CM.makeScorer(model, { iso, rows, hyp: { kind: 'homophonic', S: hyp.S, regimes: [r] } });
  for (const s of res.solutions) {
    s.logL = sc.logL(s.plaintext);
    s.logLperRegime = Object.fromEntries(Object.entries(perReg).map(([r, x]) => [r, x.logL(s.plaintext)]));
    s.lmPlusL = s.wordLogp + s.logL;
  }
  if (res.truth && /^[A-Z]+$/.test(res.truth)) res.truthLogL = sc.logL(res.truth);
  res.cyclemodel = { modelFile, hyp, rowsLengths, cycweight: cycW, cipherId: ci.id };
  return res;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || !o.cipher) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); return; }
  const res = await solveCyc(o);
  console.log(`cipher ${res.cipher.id}: L=${res.cipher.length} S=${res.cipher.symbols}, cycweight ${res.cyclemodel.cycweight}, restarts ${res.summary.restarts}, distinct ${res.summary.distinct}, ${(res.summary.timeMs.total / 1000).toFixed(1)} s`);
  for (const s of res.solutions.slice(0, 15)) console.log(`#${s.rank} score=${s.score.toFixed(2)} words=${s.wordLogp.toFixed(2)} logL=${s.logL.toFixed(2)}  ${s.words}`);
  if (o.out) { fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true }); fs.writeFileSync(o.out, JSON.stringify(res, null, 1)); console.log('wrote ' + o.out); }
}

module.exports = { solveCyc, CycPool };

if (require.main === module) main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
