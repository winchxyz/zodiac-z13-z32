#!/usr/bin/env node
'use strict';
/**
 * results/z32search/review/review_jobs.js - job files for the adversarial review of z32search.
 * Uses the attacker's own tools (tools/z32search_lib.js nullSet, tools/z32search_solve.js) unchanged.
 *
 *   node results/z32search/review/review_jobs.js
 *   -> review/jobs/repro.json     Z32 seed 101 + null00, null02 (exact reruns of nullfree jobs; seeds are deterministic)
 *   -> review/jobs/baseline.json  null00..null05 free search with seeds 102 and 103 (Z32 got 3 seeds, nulls 1)
 *   -> review/jobs/cribvar.json   RADIANS@any and THREE@any on Z32 and null00..null05, seeds 3 (repro of pass 1), 31, 32, 33
 */
const fs = require('fs');
const path = require('path');
const Z = require('../../../tools/z32search_lib');
const A = require('../../../tools/anneal');

const OUT = path.join(__dirname, 'jobs');
fs.mkdirSync(OUT, { recursive: true });
const CANON = 'data/ciphers/variants/z32.canonical.txt';
const MAIN = { mode: 'homophonic', n: '5', wordweight: 1, entropy: 0.5, perRestart: 3 };
const CRIB_OPTS = { mode: 'homophonic', n: '5', wordweight: 1, entropy: 0.5, perRestart: 1, iters: 120000 };
const nulls = Z.nullSet(12, 2032);

function pinSetCount(cipher, cribs) {
  const { def } = A.makeProblem(Object.assign({}, A.DEFAULTS, { cipher, crib: cribs, mode: 'homophonic' }));
  return def.pinSets ? def.pinSets.length : 1;
}
function write(name, obj) {
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(obj, null, 1));
  console.log(`wrote review/jobs/${name}.json: ${obj.jobs.length} jobs`);
}

// 1. exact reproduction of three nullfree jobs
write('repro', {
  defaults: Object.assign({}, MAIN, { top: 50 }),
  jobs: [
    { id: 'z32_main100_seed101', group: 'z32', cipher: CANON, restarts: 80, iters: 150000, seed: 101 },
    { id: 'null00_main100', group: 'null', cipher: nulls[0].cipher, truth: nulls[0].letters, restarts: 80, iters: 150000, seed: 101 },
    { id: 'null02_main100', group: 'null', cipher: nulls[2].cipher, truth: nulls[2].letters, restarts: 80, iters: 150000, seed: 101 },
  ],
});

// 2. equal-effort free baselines for the crib nulls
const bj = [];
for (const s of [102, 103]) for (const nl of nulls.slice(0, 6)) bj.push({ id: `${nl.id}_main100_seed${s}`, group: 'null', cipher: nl.cipher, truth: nl.letters, restarts: 80, iters: 150000, seed: s });
write('baseline', { defaults: Object.assign({}, MAIN, { top: 20 }), jobs: bj });

// 3. crib run-to-run variance at pass-1 effort (one restart per placement)
const cj = [];
for (const w of ['RADIANS', 'THREE']) {
  for (const seed of [3, 31, 32, 33]) {
    const np = pinSetCount(CANON, [`${w}@any`]);
    cj.push({ id: `cv_${w}_z32_s${seed}`, group: 'z32', meta: { word: w, cipher: 'z32', placements: np, seed }, cipher: CANON, crib: [`${w}@any`], restarts: np, seed });
    for (const nl of nulls.slice(0, 6)) {
      const nn = pinSetCount(nl.cipher, [`${w}@any`]);
      cj.push({ id: `cv_${w}_${nl.id}_s${seed}`, group: 'null', meta: { word: w, cipher: nl.id, placements: nn, seed }, cipher: nl.cipher, truth: nl.letters, crib: [`${w}@any`], restarts: nn, seed });
    }
  }
}
write('cribvar', { defaults: Object.assign({}, CRIB_OPTS, { top: 5 }), jobs: cj });
