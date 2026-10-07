#!/usr/bin/env node
// synthesis_pvalues.js: list every p-value quoted in the attack reports and their reviews.
//
// usage: node tools/synthesis_pvalues.js [--in results/synthesis/reports_and_reviews.json]
//                                        [--out results/synthesis/pvalues.json] [--max 0.05]
//
// It walks every string in each task's report and review, finds p-value mentions
// ("p = 0.0051", "p 0.026", "p ~ 0.12", "p-value 0.3", "family-wise p 0.026", "pMean 0.95",
// "P(null>=Z32) = 0.73", "p < 1e-4"), keeps the sentence around each one, and writes:
//   - per task: number of mentions, number of distinct values, counts at or below 0.005 / 0.01 / 0.05;
//   - every mention at or below --max with its context, for hand classification.
// Distinct values are counted per task after rounding to 3 significant figures, so a number quoted
// in both a report and its review counts once. This is a rough count of tests REPORTED, not of
// tests run; it is a look-elsewhere yardstick only.
//
// It also checks that the file holds no slice of the Z408 / Z340 plaintexts (20+ letters), and
// prints only the count of such slices.
'use strict';
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const inFile = arg('in', 'results/synthesis/reports_and_reviews.json');
const outFile = arg('out', 'results/synthesis/pvalues.json');
const maxP = Number(arg('max', '0.05'));

const data = JSON.parse(fs.readFileSync(inFile, 'utf8'));

function strings(v, acc, where) {
  if (typeof v === 'string') acc.push({ where, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, acc, where + '[' + i + ']'));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, acc, where + '.' + k);
  return acc;
}

// p-value mention: a "p" token (p, P, pMean, pFW, p-value, P(...)) followed by a relation and a number.
const NUM = '(\\d*\\.\\d+(?:e-?\\d+)?|\\d+e-\\d+|1(?:\\.0+)?|0)';
const RE = new RegExp(
  '(?:^|[^A-Za-z])(p(?:Mean|FW)?|P|p-value|p-values)' + // token
  '(?:\\([^)]{0,40}\\))?' + // optional P(...) argument
  '\\s*(?:=|~|≈|<=|>=|<|>|of about|of|is|at)?\\s*(?:about\\s*|~\\s*)?' +
  NUM, 'g');

function sigfig(x) { return x === 0 ? '0' : Number(x.toPrecision(3)).toString(); }

const perTask = {};
const small = [];
for (const [task, obj] of Object.entries(data.tasks)) {
  const rec = { mentions: 0, distinct: new Set(), le005: new Set(), le01: new Set(), le05: new Set() };
  for (const kind of ['report', 'review']) {
    if (!obj[kind]) continue;
    for (const { where, text } of strings(obj[kind], [], kind)) {
      RE.lastIndex = 0;
      let m;
      while ((m = RE.exec(text)) !== null) {
        const val = Number(m[2]);
        if (!Number.isFinite(val) || val < 0 || val > 1) continue;
        // skip things like "P6" scores or "p75" percentiles: require the token not glued to digits
        const after = text.slice(m.index + m[0].length - m[2].length - 1, m.index + m[0].length - m[2].length);
        rec.mentions++;
        const key = sigfig(val);
        rec.distinct.add(key);
        if (val <= 0.005) rec.le005.add(key);
        if (val <= 0.01) rec.le01.add(key);
        if (val <= 0.05) rec.le05.add(key);
        if (val <= maxP) {
          const s = Math.max(0, m.index - 140);
          const e = Math.min(text.length, m.index + m[0].length + 60);
          small.push({ task, kind, where, value: val, context: text.slice(s, e).replace(/\s+/g, ' ') });
        }
        void after;
      }
    }
  }
  perTask[task] = {
    mentions: rec.mentions,
    distinctValues: rec.distinct.size,
    distinctLe0005: rec.le005.size,
    distinctLe001: rec.le01.size,
    distinctLe005: rec.le05.size,
  };
}
const totals = Object.values(perTask).reduce((a, r) => {
  for (const k of Object.keys(r)) a[k] = (a[k] || 0) + r[k];
  return a;
}, {});

// Plaintext-slice check (counts only; never prints plaintext).
function lettersOf(obj) {
  const keys = ['plaintext', 'solution'];
  for (const k of keys) if (typeof obj[k] === 'string') return obj[k].toUpperCase().replace(/[^A-Z]/g, '');
  return '';
}
let slices = 0;
const blob = JSON.stringify(data).toUpperCase().replace(/[^A-Z]/g, '');
for (const f of ['data/ciphers/z408.json', 'data/ciphers/z340.json']) {
  const pt = lettersOf(JSON.parse(fs.readFileSync(f, 'utf8')));
  for (let i = 0; i + 20 <= pt.length; i += 5) if (blob.includes(pt.slice(i, i + 20))) slices++;
}

const out = { created: new Date().toISOString(), input: inFile, maxP, perTask, totals, plaintextSlicesFound: slices, small };
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log('task         mentions distinct <=0.005 <=0.01 <=0.05');
for (const [t, r] of Object.entries(perTask)) {
  console.log(t.padEnd(12), String(r.mentions).padStart(8), String(r.distinctValues).padStart(8),
    String(r.distinctLe0005).padStart(7), String(r.distinctLe001).padStart(6), String(r.distinctLe005).padStart(6));
}
console.log('TOTAL       ', String(totals.mentions).padStart(8), String(totals.distinctValues).padStart(8),
  String(totals.distinctLe0005).padStart(7), String(totals.distinctLe001).padStart(6), String(totals.distinctLe005).padStart(6));
console.log('Z408/Z340 plaintext slices (20 letters) found in the input:', slices);
console.log('mentions at or below', maxP, ':', small.length, '-> ' + outFile);
