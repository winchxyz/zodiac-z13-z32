'use strict';
/**
 * tools/lead_skeptic_stat_bench.js - timing probe for the skeptic checks: how long one assignment of
 * the six pinned letters takes per variant with the replication engine (tools/lead_replicate_lib.js).
 *   node tools/lead_skeptic_stat_bench.js
 */
const R = require('./lead_replicate_lib');
const keys = R.loadKeys();
const code = (l) => l.charCodeAt(0) - 65;
const slots = R.SLOTS.map((s) => code(keys.z340.key[s]));
for (const id of R.VARIANT_IDS) {
  const lay = R.layout(id);
  const E = R.engine(lay);
  const pl = R.slotLetters(lay, slots);
  let t0 = Date.now();
  E.stats(pl);
  const first = Date.now() - t0;
  t0 = Date.now();
  const M = E.markov.run(pl);
  const tm = Date.now() - t0;
  t0 = Date.now();
  const s = E.stats(pl);
  const ts = Date.now() - t0;
  console.log(id, 'first', first, 'ms; markov', tm, 'ms; full stats', ts, 'ms', s.t1.toFixed(3), s.t2.toFixed(3), s.t3.toFixed(3), M.t1.toFixed(3));
}
