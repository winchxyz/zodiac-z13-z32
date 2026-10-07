'use strict';
/**
 * tools/lead_replicate_bench.js - speed check of the replication engines on RANDOM letters only
 * (no Z13 key letters), to size the runs.  node tools/lead_replicate_bench.js
 */
const R = require('./lead_replicate_lib');
const lm = require('./lm');

const rng = R.makeRng(777);
let t = Date.now();
lm.load({ ngrams: [1, 4, 5], six: true, words: 'common' });
R.wordData();
console.log('load ms', Date.now() - t);

// wordSegment speed on random 13-letter strings
const strs = [];
for (let i = 0; i < 3000; i++) { let s = ''; for (let k = 0; k < 13; k++) s += R.LET[rng.int(26)]; strs.push(s); }
t = process.hrtime.bigint();
let acc = 0;
for (const s of strs) acc += lm.wordSegment(s).logp;
console.log('wordSegment us/call', Number(process.hrtime.bigint() - t) / 1e3 / strs.length, acc > 0);

for (const id of R.VARIANT_IDS) {
  const lay = R.layout(id);
  const t0 = Date.now();
  const E = R.engine(lay);
  const tb = Date.now() - t0;
  const reps = id === 'circles_distinct' ? 3 : 50;
  let tm = 0, tw = 0;
  for (let r = 0; r < reps; r++) {
    const slots = R.SLOTS.map(() => rng.int(26));
    const pl = R.slotLetters(lay, slots);
    let a = Date.now();
    E.markov.run(pl);
    tm += Date.now() - a;
    a = Date.now();
    const W = R.wordEngine(lay);
    W.run(pl);
    tw += Date.now() - a;
  }
  console.log(id, 'groups', lay.groups.map((g) => g.sym + ':' + g.pos.join('/')).join(' '), 'build ms', tb,
    'markov ms/draw', (tm / reps).toFixed(2), 'word ms/draw', (tw / reps).toFixed(2));
}
