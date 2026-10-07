'use strict';
// worker_threads entry for tools/anneal.js (one restart batch per job message).
const { parentPort, workerData } = require('worker_threads');
const lmshare = require('./lmshare');
const core = require('./solvercore');

const T = lmshare.attach(workerData.lm);
const problems = new Map();

function wordSegFor(def) {
  if (!(def.wordW && def.wordInner)) return null;
  return core.wordScorer(def);
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
