'use strict';
/**
 * tools/lead_skeptic_stat_families.js - project-level multiplicity seen as analyses ("families")
 * instead of single p-values, and FDR (Benjamini-Hochberg) instead of only Bonferroni / Holm.
 *
 * Collects the same p-like JSON fields as tools/lead_replicate_multiplicity.js (same key regexes,
 * results/lead excluded, calibration-like files excluded), groups them by analysis =
 * (task, JSON file with run suffixes such as _n20000 / .log twins merged), and reports:
 *   - number of analyses, and how many of them have a minimum p at or below the lead's values;
 *   - BH q-value of the lead's p among (a) all distinct p-values, (b) per-analysis minima;
 *   - the analyses with the smallest minima (what else in the project looks "as good").
 *
 *   node tools/lead_skeptic_stat_families.js [--out results/lead/skeptic/stat/families.json]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RES = path.join(ROOT, 'results');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args[oi + 1] : 'results/lead/skeptic/stat/families.json';
const LEADS = [0.0051, 0.0102, 0.039, 0.144];

const PKEY = /^(p|pval|pvalue|p_?value|p_?raw|p_?adj|p_?fw|p_?wy|p_?holm|p_?bonf|fw|fwp|fw_p|minp|min_p|p_one|p_two|p_upper|p_lower|p_emp|p_mc|p_perm|p_null|p_exact)$|^p_[a-z0-9_]+$|^p[A-Z][A-Za-z0-9]*$|_p$|P$|^fw[A-Z_]/;
const NOT = /^(perChar|perWindow|pos|positions|pinned|pin|pins|pool|pattern|patterns|prefix|path|plaintext|perm|period|prob|pairs|P|pIso|pIsoGivenFit|pK\d*|pTrain|pAnyFit\w*)$|\s|^[A-Z]{2,}$/;
const calibRe = /calib|selftest|certify|verify|smoke|sanity|positive|known|truth/i;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (path.relative(RES, f).split(path.sep)[0] === 'lead') continue; walk(f, out); } else out.push(f);
  }
  return out;
}
const recs = [];
function fromJson(obj, file, task, trail) {
  if (Array.isArray(obj)) { obj.forEach((v, i) => { if (v && typeof v === 'object') fromJson(v, file, task, trail + `[${i}]`); }); return; }
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && PKEY.test(k) && !NOT.test(k) && v >= 0 && v <= 1) recs.push({ task, file, where: trail + '.' + k, value: v });
    else if (v && typeof v === 'object') fromJson(v, file, task, trail + '.' + k);
  }
}
for (const f of walk(RES, [])) {
  if (path.extname(f).toLowerCase() !== '.json') continue;
  let size = 0;
  try { size = fs.statSync(f).size; } catch (e) { continue; }
  if (size > 40e6) continue;
  const rel = path.relative(RES, f).replace(/\\/g, '/');
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  fromJson(j, rel, rel.split('/')[0], '');
}
// summary files repeat numbers from analysis files: drop them; drop calibration-like records
const analysisRecs = recs.filter((r) => !/(^|\/)summary[^/]*\.json$/i.test(r.file) && !calibRe.test(r.file) && !calibRe.test(r.where));
const famOf = (r) => r.task + ':' + r.file.replace(/^[^/]+\//, '').replace(/\.json$/, '').replace(/^review\//, '').replace(/^(repro_)/, '').replace(/_n\d+$|_lim\d+$|_top\d+k?|_\d+k_\d+w$/g, '');
const fam = new Map();
for (const r of analysisRecs) {
  const k = famOf(r);
  if (!fam.has(k)) fam.set(k, { family: k, task: r.task, n: 0, values: new Set(), min: 1, minWhere: '' });
  const g = fam.get(k);
  g.n++;
  g.values.add(r.value.toPrecision(4));
  if (r.value < g.min) { g.min = r.value; g.minWhere = r.file + ' ' + r.where; }
}
const fams = [...fam.values()].map((g) => ({ family: g.family, task: g.task, fields: g.n, distinct: g.values.size, min: g.min, minWhere: g.minWhere }));
fams.sort((a, b) => a.min - b.min);

// distinct values per task (the replication's de-duplication), calibration excluded
const dist = new Map();
for (const r of analysisRecs) dist.set(r.task + '|' + r.value.toPrecision(4), r.value);
const distinctVals = [...dist.values()];

function bhQ(pLead, ps) {
  const s = ps.concat([pLead]).sort((a, b) => a - b);
  const m = s.length;
  let i = s.indexOf(pLead);
  // BH q at rank i+1 = min over k >= i+1 of m p_(k) / k
  let q = 1;
  for (let k = m; k >= i + 1; k--) q = Math.min(q, (m * s[k - 1]) / k);
  return { m, rank: i + 1, q: Math.min(1, q) };
}
const famMins = fams.map((f) => f.min);
const leadFams = fams.filter((f) => /keyprior/.test(f.task));
const res = {
  generated: new Date().toISOString(),
  method: 'p-like JSON fields (lead_replicate_multiplicity.js regexes), results/lead and summary/calibration files excluded; analysis = task + file stem',
  records: analysisRecs.length,
  distinctValues: distinctVals.length,
  analyses: fams.length,
  analysesByTask: fams.reduce((o, f) => ((o[f.task] = (o[f.task] || 0) + 1), o), {}),
  keypriorShareOfDistinct: distinctVals.length ? [...dist.keys()].filter((k) => k.startsWith('keyprior|')).length / distinctVals.length : 0,
  analysesWithMinAtOrBelow: Object.fromEntries(LEADS.map((p) => [p, { all: fams.filter((f) => f.min <= p).length, nonKeyprior: fams.filter((f) => f.min <= p && f.task !== 'keyprior').length }])),
  bh: Object.fromEntries(LEADS.map((p) => [p, { distinctValues: bhQ(p, distinctVals), analysisMinima: bhQ(p, famMins), analysisMinimaNonKeyprior: bhQ(p, fams.filter((f) => f.task !== 'keyprior').map((f) => f.min)) }])),
  sidakAtAnalyses: Object.fromEntries(LEADS.map((p) => [p, { m: fams.length, pAny: 1 - Math.pow(1 - p, fams.length), mNonKeyprior: fams.filter((f) => f.task !== 'keyprior').length + 1, pAnyNonKeyprior: 1 - Math.pow(1 - p, fams.filter((f) => f.task !== 'keyprior').length + 1) }])),
  smallestAnalyses: fams.slice(0, 40),
  keypriorAnalyses: leadFams.length,
};
fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ records: res.records, distinctValues: res.distinctValues, analyses: res.analyses, analysesByTask: res.analysesByTask, keypriorShareOfDistinct: res.keypriorShareOfDistinct, analysesWithMinAtOrBelow: res.analysesWithMinAtOrBelow, bh: res.bh, sidakAtAnalyses: res.sidakAtAnalyses }, null, 1));
for (const f of res.smallestAnalyses.slice(0, 30)) console.log(f.min.toExponential(2).padEnd(10), String(f.distinct).padStart(5), f.family);
