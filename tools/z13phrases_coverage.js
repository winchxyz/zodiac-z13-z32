'use strict';
/**
 * tools/z13phrases_coverage.js - share of real held-out phrases (results/z13phrases/null_real_phrases.tsv)
 * that a words enumeration with the top N common words and at most M words could produce at all,
 * overall and among phrases above the real median (the population the headline counts refer to).
 *   node tools/z13phrases_coverage.js [--length 13]  -> results/z13phrases/coverage.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'results', 'z13phrases');
const o = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) o[process.argv[i].slice(2)] = process.argv[++i];

const rankOf = new Map();
fs.readFileSync(path.join(ROOT, 'data', 'lm', 'words_common.tsv'), 'latin1').split('\n').forEach((l, i) => { if (l) rankOf.set(l.split('\t')[0], i); });
const ref = JSON.parse(fs.readFileSync(path.join(DIR, 'null_real_phrases.json'), 'utf8'));
const out = {};
for (const L of String(o.length || '11,12,13').split(',')) {
  const med = ref.lengths[L].logpCommon.p50;
  const rows = fs.readFileSync(path.join(DIR, 'null_real_phrases.tsv'), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')).filter((r) => r[0] === L);
  const res = {};
  for (const N of [5000, 10000, 20000, 30000, 40000, 60006]) for (const M of [3, 4, 5, 6]) {
    const ok = (r) => { const ws = r[2].toUpperCase().split(' '); return ws.length <= M && ws.every((w) => w.length <= +L && rankOf.has(w) && rankOf.get(w) < N); };
    const above = rows.filter((r) => +r[4] >= med);
    res[`top${N}_M${M}`] = { all: +(rows.filter(ok).length / rows.length).toFixed(4), aboveMedian: +(above.filter(ok).length / above.length).toFixed(4) };
  }
  out[L] = res;
}
fs.writeFileSync(path.join(DIR, 'coverage.json'), JSON.stringify({ tool: 'tools/z13phrases_coverage.js', created: new Date().toISOString(), note: 'rank = line index in data/lm/words_common.tsv (sorted by Web 1T count); words longer than the cipher are excluded as in the enumeration', coverage: out }, null, 1));
for (const [k, v] of Object.entries(out['13'] || {})) console.log(k, JSON.stringify(v));
