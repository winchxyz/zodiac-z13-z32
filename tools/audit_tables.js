'use strict';
/**
 * tools/audit_tables.js - markdown tables for results/audit/audit.md from
 * results/audit/audit_details.json (written by tools/audit_check.js).
 *
 *   node tools/audit_tables.js > results/audit/tables.md
 */
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'results', 'audit', 'audit_details.json'), 'utf8'));
const f = (x, d = 2) => (x === undefined || x === null || x === '' ? '-' : typeof x === 'number' ? (Number.isInteger(x) ? x.toLocaleString('en-US') : x.toFixed(d)) : String(x));
const pct = (a, b) => (a == null || !b ? '-' : `${f(a)} / ${f(b)} (${(100 * a / b).toPrecision(2)}%)`);
const fitsAsClaimed = (r) => r.aligned && r.length_ok !== false && r.hom_conflicts != null && r.hom_conflicts <= (+r.declared_slips || 0);
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function z13Table(rows) {
  const out = ['| id | who | claimed plaintext | variant | hom. conflicts | simple | key vs Zodiac | cycle breaks (p) | wordSeg log P | homophonic word fits scoring higher | simple word fits scoring higher (a subset of the homophonic fits, so a lower bound for them) | verdict |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    const conf = r.aligned ? (r.length_ok === false ? `length ${r.plain_len}/${r.cipher_len}` : `${f(r.hom_conflicts)}${r.conflict_symbols ? ` (${r.conflict_symbols})` : ''}`) : 'n/a';
    out.push(`| ${r.id} | ${cell(r.who)} | ${cell(r.claim)} | ${r.variant} | ${cell(conf)} | ${r.aligned && r.length_ok ? (r.simple_ok ? 'yes' : `no (${r.injectivity_violations})`) : '-'} | ${r.excess_letters ? cell(r.excess_letters) : (r.aligned && r.length_ok ? 'within' : '-')} | ${r.cycle_breaks ? `${r.cycle_breaks} (${r.cycle_p})` : '-'} | ${r.logp != null ? f(r.logp) : '-'} | ${fitsAsClaimed(r) ? pct(r.enum_homophonic_better, r.enum_homophonic_total) : 'does not fit'} | ${fitsAsClaimed(r) ? pct(r.enum_simple_better, r.enum_simple_total) : 'does not fit'} | ${r.verdict} |`);
  }
  return out.join('\n');
}
function z32Table(rows) {
  const out = ['| id | who | claimed plaintext | variant | hom. conflicts | key vs Zodiac | wordSeg log P | natural-English fits scoring higher | solver fits scoring higher | grammar sentences scoring higher (est.) | verdict |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    const conf = r.aligned ? (r.length_ok === false ? `length ${r.plain_len}/${r.cipher_len}` : `${f(r.hom_conflicts)}${r.conflict_symbols ? ` (${r.conflict_symbols})` : ''}`) : 'n/a';
    out.push(`| ${r.id} | ${cell(r.who)} | ${cell(r.claim)} | ${r.variant} | ${cell(conf)} | ${r.excess_letters ? cell(r.excess_letters) : (r.aligned && r.length_ok ? 'within' : '-')} | ${r.logp != null ? f(r.logp) : '-'} | ${fitsAsClaimed(r) ? pct(r.corpus_better, r.corpus_total) : '-'} | ${fitsAsClaimed(r) ? pct(r.solver_better, r.solver_total) : '-'} | ${r.theme_est_better != null ? `~${Number(r.theme_est_better).toExponential(1)} of ~${Number(r.theme_est_total).toExponential(1)}` : '-'} | ${r.verdict} |`);
  }
  return out.join('\n');
}
const named = D.named;
console.log('## Z13 named proposals\n');
console.log(z13Table(named.filter((r) => r.cipher === 'Z13')));
console.log('\n## Z32 proposals\n');
console.log(z32Table(named.filter((r) => r.cipher === 'Z32')));
console.log('\n## Verdict reasons\n');
for (const r of named) console.log(`- **${r.id}** ${r.verdict}: ${cell(r.verdict_reason)}`);
console.log('\n## Wiki summary\n');
console.log('```\n' + JSON.stringify(D.wikiSummary, null, 1).slice(0, 6000) + '\n```');
console.log('\n## Special\n');
console.log('```\n' + JSON.stringify(D.special, null, 1).slice(0, 12000) + '\n```');
console.log('\n## References\n');
console.log('```\n' + JSON.stringify(D.references, null, 1).slice(0, 6000) + '\n```');
