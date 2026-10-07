#!/usr/bin/env node
// synthesis_multiplicity.js: look-elsewhere arithmetic for the one surviving lead (the Z340 key
// letters on Z13), at the scale of the whole project.
//
// usage: node tools/synthesis_multiplicity.js [--pvalues results/synthesis/pvalues.json]
//
// Takes the number of distinct p-values quoted in the attack reports and reviews (from
// tools/synthesis_pvalues.js) as a rough count m of tests reported, and for the lead's corrected
// p-values (0.0051 within the Z340 family, 0.0102 over both keys) prints:
//   - Bonferroni p * m (capped at 1);
//   - P(at least one of m independent null tests reaches p or smaller) = 1 - (1 - p)^m;
//   - the expected number of such tests, m * p.
// Also prints the same for m = 50, 100, 200 to show how much the count matters. The tests are
// not independent and m is rough, so this is an order-of-magnitude yardstick, not a corrected p.
'use strict';
const fs = require('fs');
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const pv = JSON.parse(fs.readFileSync(arg('pvalues', 'results/synthesis/pvalues.json'), 'utf8'));
const mQuoted = pv.totals.distinctValues;
const leads = [
  { name: 'Z340-key family-wise (Westfall-Young, 4 variants x 2 statistics)', p: 0.0051 },
  { name: 'both known keys (Sidak)', p: 0.0102 },
];
const ms = [mQuoted, 50, 100, 200];
const out = { mQuoted, rows: [] };
for (const l of leads) {
  for (const m of ms) {
    const row = {
      lead: l.name, p: l.p, m,
      bonferroni: Math.min(1, l.p * m),
      pAtLeastOneByChance: 1 - Math.pow(1 - l.p, m),
      expectedCount: l.p * m,
    };
    out.rows.push(row);
    console.log(`${l.name.padEnd(66)} p=${l.p} m=${String(m).padStart(3)}  Bonferroni ${row.bonferroni.toFixed(3)}  P(>=1 by chance) ${row.pAtLeastOneByChance.toFixed(3)}  expected ${row.expectedCount.toFixed(2)}`);
  }
}
fs.writeFileSync('results/synthesis/multiplicity.json', JSON.stringify(out, null, 1));
console.log('m (distinct p-values quoted in reports and reviews):', mQuoted, '-> results/synthesis/multiplicity.json');
