#!/usr/bin/env node
'use strict';
/**
 * results/z32search/review/review_grammar_dpcheck.js - cross-check of the grammar DP counter
 * (tools/z32search_grammar_count.js countForm) against brute-force DFS enumeration (listFits plus an
 * independent recursive enumerator written here) for the smallest form, on Z32 and on two random patterns.
 *   node results/z32search/review/review_grammar_dpcheck.js
 */
const G = require('../../../tools/z32search_grammar_lib');
const E = require('../../../tools/z32search_grammar_count');
const Z = require('../../../tools/z32search_lib');

// reduced grammar (cardinal numbers only) so brute force finishes in seconds; the DP code path is the same
const F = E.prepForms(G.forms().map((fm) => Object.assign({}, fm, { slots: fm.slots.map((sl) => (sl.name === 'NUM' ? Object.assign({}, sl, { items: sl.items.filter((it) => it.kind === 'cardinal') }) : sl)) })));
const f = F[4]; // LEAD_I=num-unit_R=num-unit_TAIL (the form where Z32 sits at the null's upper 5%)
const pats = [Z.pairsOf(Z.z32Text('canonical')), [[0, 28], [18, 29], [25, 27]], [[3, 26], [4, 12], [5, 17]]];
function brute(form, pairs) {
  // independent: enumerate all slot-string sequences of total length 32, check equalities on the joined string
  let n = 0, distinct = new Set();
  const rec = (si, s) => {
    if (s.length > 32) return;
    if (si === form.slots.length) { if (s.length === 32 && pairs.every(([a, b]) => s[a] === s[b])) { n++; distinct.add(s); } return; }
    for (const t of form.slots[si].strings) rec(si + 1, s + t);
  };
  rec(0, '');
  return { n, distinct: distinct.size };
}
for (const p of pats) {
  const dp = E.countForm(f, p);
  const t0 = Date.now();
  const b = brute(f, p);
  console.log(JSON.stringify(p), 'DP', dp, 'brute derivations', b.n, 'distinct strings', b.distinct, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
