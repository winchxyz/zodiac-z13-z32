'use strict';
/**
 * tools/lead_replicate_report.js - collects the replication outputs into
 * results/lead/replicate/summary.json and prints Markdown tables for the report.
 *   node tools/lead_replicate_report.js
 */
const fs = require('fs');
const path = require('path');
const R = require('./lead_replicate_lib');

const D = path.join(R.ROOT, 'results', 'lead', 'replicate');
const rd = (f) => (fs.existsSync(path.join(D, f)) ? JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')) : null);
const z340 = rd('nulls_z340.json'), z408 = rd('nulls_z408.json'), power = rd('power.json'), mult = rd('multiplicity.json'), classes = rd('classes.json'), val = rd('validate.json');
const fmt = (p) => (p == null ? '-' : p < 0.001 ? p.toExponential(1) : p.toFixed(4));
const lines = [];
const sum = { generated: new Date().toISOString(), validation: val ? { pass: val.pass, maxAbsDiff: val.maxAbsDiff } : null, keys: {} };

for (const J of [z340, z408]) {
  if (!J) continue;
  const ks = { realSlots: J.realSlots, real: J.real, nulls: {} };
  lines.push(`\n### ${J.key} key (pins ${J.realSlots} for A E N z K M)\n`);
  lines.push('| variant | pinned | T1 markov6max | T2 wordmax | T3 markov6top10 |');
  lines.push('|---|---|---|---|---|');
  for (const v of J.variants) {
    const r = J.real[v];
    lines.push(`| ${v} | \`${r.pinned}\` | ${r.t1.toFixed(3)} (${r.best1}) | ${r.t2.toFixed(3)} (${r.bestWords}) | ${r.t3.toFixed(3)} |`);
  }
  lines.push('');
  const nulls = Object.keys(J.nulls);
  lines.push('| null | N | ' + J.variants.flatMap((v) => J.stats.map((s) => `${v.replace('circles_distinct', 'circles').replace('crosshair_null', 'xhair')} ${s}`)).join(' | ') + ' | WY min |');
  lines.push('|---|---|' + J.variants.flatMap(() => J.stats.map(() => '---')).join('|') + '|---|');
  for (const n of nulls) {
    const rec = J.nulls[n];
    const cells = J.variants.flatMap((v) => J.stats.map((s) => fmt(rec.tests[`${v}.${s}`].p)));
    lines.push(`| ${n} | ${rec.tests[`canonical.t1`].nNull} | ${cells.join(' | ')} | ${fmt(rec.wyMin)} |`);
    ks.nulls[n] = { nDraws: rec.nDraws, wyRows: rec.wyRows, wyMin: rec.wyMin,
      tests: Object.fromEntries(Object.entries(rec.tests).map(([k, t]) => [k, { real: t.real, p: t.p, pWY: t.pWY, ge: t.ge, nNull: t.nNull, z: t.z, nullMean: t.null.mean, nullSd: t.null.sd, nullQ95: t.null.q95, nullMax: t.null.max }])) };
    if (rec.topCanonicalT2) ks.nulls[n].topCanonicalT2 = rec.topCanonicalT2;
    if (rec.realAmongDraws != null) ks.nulls[n].realAmongDraws = rec.realAmongDraws;
  }
  lines.push('\nWestfall-Young adjusted p (within each null, 12 tests):\n');
  lines.push('| null | ' + J.variants.flatMap((v) => J.stats.map((s) => `${v.replace('circles_distinct', 'circles').replace('crosshair_null', 'xhair')} ${s}`)).join(' | ') + ' |');
  lines.push('|---|' + J.variants.flatMap(() => J.stats.map(() => '---')).join('|') + '|');
  for (const n of nulls) {
    const rec = J.nulls[n];
    lines.push(`| ${n} | ` + J.variants.flatMap((v) => J.stats.map((s) => fmt(rec.tests[`${v}.${s}`].pWY))).join(' | ') + ' |');
  }
  sum.keys[J.key] = ks;
}
if (power) {
  sum.power = power.variants;
  lines.push('\n### Positive control\n');
  lines.push('| variant | source | n | stat | power p<=0.05 | power p<=0.01 | power p<=real p | real p | median p | phrase tail at real | null tail at real | ratio | class n | class power .05 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [v, rec] of Object.entries(power.variants)) {
    for (const [src, o] of Object.entries(rec.summary)) {
      for (const st of ['t1', 't2', 't3']) {
        const x = o[st];
        lines.push(`| ${v} | ${src} | ${o.n} | ${st} | ${x.power05.toFixed(3)} | ${x.power01.toFixed(3)} | ${x.powerAtRealP.toFixed(3)} | ${fmt(x.realP)} | ${fmt(x.medianP)} | ${x.phraseTailAtReal.toFixed(3)} | ${x.nullTailAtReal.toFixed(4)} | ${x.tailRatio == null ? '-' : x.tailRatio.toFixed(1)} | ${x.classN || '-'} | ${x.classPower05 == null ? '-' : x.classPower05.toFixed(3)} |`);
      }
    }
  }
}
if (mult) sum.multiplicity = { rawMatches: mult.rawMatches, distinctAll: mult.distinctAll, distinctExcludingCalibration: mult.distinctExcludingCalibration, leads: mult.leads, byTask: mult.byTask };
if (classes) sum.classes = classes;
fs.writeFileSync(path.join(D, 'summary.json'), JSON.stringify(sum, null, 1));
fs.writeFileSync(path.join(D, 'tables.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
