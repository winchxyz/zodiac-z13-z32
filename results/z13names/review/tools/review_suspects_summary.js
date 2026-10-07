'use strict';
// Print the suspect-review tests (results/z13names/review/suspects_review_<tag>.json).
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
for (const tag of ['all', 'excl']) {
  const r = require(path.join(ROOT, `results/z13names/review/suspects_review_${tag}.json`));
  console.log(`== ${tag}: persons ${r.persons}, excluded [${r.excluded.join(',')}], reps ${r.reps}`);
  for (const [k, t] of Object.entries(r.test)) {
    if (!t.persons.observed && t.persons.nullMean <= 0.01) continue;
    console.log(k.padEnd(40), 'persons', t.persons.observed, 'null', t.persons.nullMean.toFixed(3), 'p', t.persons.p.toFixed(4), '| 0 fillers', t.persons0.observed, 'null', t.persons0.nullMean.toFixed(4), 'p', t.persons0.p.toFixed(4));
  }
  const nonCD = r.fits.filter((d) => !d.setting.startsWith('z13.circles_distinct'));
  for (const d of nonCD) console.log('  fit', d.person, d.setting, d.fits.map((x) => `${x.str}@lead${x.lead}${x.slip != null ? ' slip@' + x.slip : ''}`).join(' ; '));
}
