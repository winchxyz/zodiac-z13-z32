'use strict';
/**
 * tools/cyclemodel_explore.js - descriptive statistics of how Zodiac picked
 * homophones in Z408 and Z340 (written order), as input to the model design.
 *
 *   node tools/cyclemodel_explore.js [--out results/cyclemodel/explore.json]
 *
 * For each letter with k >= 2 homophones and each group of segments, the cyclic
 * order of its symbols that maximises the number of "next in cycle" steps is
 * found by brute force (optimistic: it is fitted to the same data), and every
 * transition between consecutive uses is classified by its step in that order:
 * 0 = same symbol, 1 = next, k-1 = previous, other.  Transitions that cross a
 * row (or part) boundary are tallied separately, together with whether the new
 * symbol is the letter's first-used symbol of the group ("reset to start").
 * Prints only counts.
 */
const fs = require('fs');
const path = require('path');
const D = require('./cyclemodel_data');

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((x, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([x].concat(p));
  });
  return out;
}

/** best cyclic order (array of symbols) maximising next-steps in seq */
function bestCycle(seq, syms) {
  const first = syms[0];
  let best = null, bestN = -1;
  for (const p of permutations(syms.slice(1))) {
    const order = [first].concat(p);
    const idx = new Map(order.map((s, i) => [s, i]));
    let n = 0;
    for (let t = 1; t < seq.length; t++) if ((idx.get(seq[t]) - idx.get(seq[t - 1]) + order.length) % order.length === 1) n++;
    if (n > bestN) { bestN = n; best = order; }
  }
  return { order: best, next: bestN };
}

function analyse(groupId, segs, keyH) {
  const events = [];
  for (const s of segs) for (const e of s.events) events.push(Object.assign({ seg: s.id }, e));
  const byL = {};
  for (const e of events) (byL[e.letter] = byL[e.letter] || []).push(e);
  const tally = { within: { same: 0, next: 0, prev: 0, other: 0 }, crossRow: { same: 0, next: 0, prev: 0, other: 0 }, crossPart: { same: 0, next: 0, prev: 0, other: 0 } };
  const resets = { crossRow: { n: 0, toStart: 0, isNext: 0, both: 0, startNotNext: 0, expectedStartIfRandom: 0 }, crossPart: { n: 0, toStart: 0, isNext: 0, both: 0, startNotNext: 0 } };
  const perLetter = {};
  for (const [L, ev] of Object.entries(byL)) {
    const syms = keyH[L];
    const k = syms.length;
    if (k < 2) { perLetter[L] = { k, uses: ev.length }; continue; }
    const seq = ev.map((e) => e.sym);
    // symbols in order of first use, plus unused ones
    const fu = [];
    for (const s of seq) if (!fu.includes(s)) fu.push(s);
    for (const s of syms) if (!fu.includes(s)) fu.push(s);
    const bc = bestCycle(seq, fu);
    const idx = new Map(bc.order.map((s, i) => [s, i]));
    const startSym = seq[0];
    const cnt = { same: 0, next: 0, prev: 0, other: 0 };
    for (let t = 1; t < ev.length; t++) {
      const st = (idx.get(seq[t]) - idx.get(seq[t - 1]) + k) % k;
      const cls = st === 0 ? 'same' : st === 1 ? 'next' : st === k - 1 ? 'prev' : 'other';
      // k = 2: step 1 is both next and prev; count as next
      const crossPart = ev[t].seg !== ev[t - 1].seg;
      const crossRow = !crossPart && ev[t].row !== ev[t - 1].row;
      const where = crossPart ? 'crossPart' : crossRow ? 'crossRow' : 'within';
      tally[where][cls]++;
      cnt[cls]++;
      if (where !== 'within') {
        const r = resets[where];
        r.n++;
        const toStart = seq[t] === startSym, isNext = st === 1;
        if (toStart) r.toStart++;
        if (isNext) r.isNext++;
        if (toStart && isNext) r.both++;
        if (toStart && !isNext) r.startNotNext++;
        if (where === 'crossRow') r.expectedStartIfRandom += 1 / k;
      }
    }
    perLetter[L] = { k, uses: ev.length, transitions: ev.length - 1, cycleNext: bc.next, counts: cnt };
  }
  return { group: groupId, events: events.length, tally, resets, perLetter };
}

/** Row statistics on written symbol strings (no letters needed). */
function rowStats(text, rows) {
  const out = { rows: 0, rowsNoRepeat: 0, sameSymbolPairsWithinRow: 0, nearRepeats: {} };
  for (const [r0, r1] of rows) {
    for (let r = r0; r <= r1; r++) {
      const row = text.slice(r * 17, r * 17 + 17);
      if (!row.length) continue;
      out.rows++;
      const seen = new Map();
      let rep = false;
      for (const ch of row) { seen.set(ch, (seen.get(ch) || 0) + 1); }
      for (const v of seen.values()) { if (v > 1) rep = true; out.sameSymbolPairsWithinRow += v * (v - 1) / 2; }
      if (!rep) out.rowsNoRepeat++;
    }
  }
  for (let d = 1; d <= 4; d++) {
    let n = 0;
    for (let i = 0; i + d < text.length; i++) if (text[i] === text[i + d]) n++;
    out.nearRepeats['d' + d] = n;
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const outF = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'results/cyclemodel/explore.json';
  const segs = D.segments();
  const K = D.keys();
  const g = (ids) => segs.filter((s) => ids.includes(s.id));
  const res = {
    tool: 'tools/cyclemodel_explore.js', created: new Date().toISOString(),
    note: 'cycle order per letter is the brute-force best for the group (optimistic); slips/errors removed; Z408 tail (390-407) removed',
    groups: [
      analyse('z408.p1', g(['z408.p1']), K.z408),
      analyse('z408.p2', g(['z408.p2']), K.z408),
      analyse('z408.p1+p2', g(['z408.p1', 'z408.p2']), K.z408),
      analyse('z408.p3', g(['z408.p3']), K.z408),
      analyse('z340.all', g(['z340.s1', 'z340.s2', 'z340.s3']), K.z340),
      analyse('z340.s1', g(['z340.s1']), K.z340),
      analyse('z340.s2', g(['z340.s2']), K.z340),
    ],
  };
  const T = D.texts();
  res.rowStats = {
    z408_p1p2: rowStats(T.z408, [[0, 15]]),
    z408_p3: rowStats(T.z408, [[16, 22]]),
    z340: rowStats(T.z340, [[0, 19]]),
  };
  fs.mkdirSync(path.dirname(outF), { recursive: true });
  fs.writeFileSync(outF, JSON.stringify(res, null, 1));
  for (const gr of res.groups) {
    console.log(`\n== ${gr.group} (${gr.events} events)`);
    console.log('  within-row  ', JSON.stringify(gr.tally.within));
    console.log('  cross-row   ', JSON.stringify(gr.tally.crossRow));
    console.log('  cross-part  ', JSON.stringify(gr.tally.crossPart));
    console.log('  resets row  ', JSON.stringify(gr.resets.crossRow));
    console.log('  resets part ', JSON.stringify(gr.resets.crossPart));
    const pl = Object.entries(gr.perLetter).filter(([, v]) => v.k >= 2).map(([L, v]) => `${L}:k${v.k} ${v.cycleNext}/${v.transitions} s${v.counts.same} p${v.counts.prev} o${v.counts.other}`);
    console.log('  ' + pl.join(' | '));
  }
  console.log('\nrow stats', JSON.stringify(res.rowStats, null, 0));
}

main();
