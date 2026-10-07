'use strict';
// worker_threads entry for tools/cyclemodel_anneal.js: identical to tools/anneal_worker.js
// except that the inner word term becomes  wordW * (wordfast log10 P + (cycW / wordW) * log10 L(P)),
// where L(P) is the isomorph likelihood of tools/cyclemodel_lib.js for this cipher.
const { parentPort, workerData } = require('worker_threads');
const lmshare = require('./lmshare');
const core = require('./solvercore');
const CM = require('./cyclemodel_lib');

const T = lmshare.attach(workerData.lm);
const cyc = workerData.cyc;
const model = CM.loadModel(cyc.modelFile);
const problems = new Map();

function wordSegFor(def) {
  if (!(def.wordW && def.wordInner)) return null;
  const base = core.wordScorer(def);
  if (!(cyc.weight > 0)) return base;
  const rows = cyc.rowsLengths ? CM.rowsFor(cyc.rowsLengths) : new Array(def.L).fill(0);
  if (rows.length !== def.L) throw new Error(`cyclemodel worker: rows (${rows.length}) != cipher length (${def.L})`);
  const sc = CM.makeScorer(model, { iso: def.c, rows, hyp: cyc.hyp || model.defaultHyp });
  const ratio = cyc.weight / def.wordW;
  return (pt) => {
    const l = sc.logL(pt);
    return base(pt) + ratio * (Number.isFinite(l) ? l : -1e6);
  };
}

parentPort.on('message', (m) => {
  try {
    if (m.type === 'problem') {
      problems.set(m.pid, core.prepare(m.def, T, wordSegFor(m.def)));
      for (const k of problems.keys()) if (k < m.pid - 3) problems.delete(k);
    } else if (m.type === 'job') {
      const P = problems.get(m.pid);
      if (!P) throw new Error(`worker: unknown problem ${m.pid}`);
      const out = [];
      for (let r = m.r0; r < m.r1; r++) out.push(core.runRestart(P, r));
      parentPort.postMessage({ type: 'done', pid: m.pid, jobId: m.jobId, out });
    } else if (m.type === 'exit') {
      process.exit(0);
    }
  } catch (e) {
    parentPort.postMessage({ type: 'error', pid: m.pid, jobId: m.jobId, error: String(e && e.stack || e) });
  }
});
parentPort.postMessage({ type: 'ready' });
