'use strict';
/**
 * tools/lead_replicate_multiplicity.js - rough count of the hypothesis tests the project has run,
 * from the p-value-like fields in results/ (results/lead/ excluded), for a project-level
 * Bonferroni / Holm correction of the Z13 / Z340-key lead (prereg: results/lead/replicate/prereg.md).
 *
 *   node tools/lead_replicate_multiplicity.js --survey            # key names and counts per task
 *   node tools/lead_replicate_multiplicity.js --lead 0.0051 [--lead 0.0102 ...] --out results/lead/replicate/multiplicity.json
 *
 * JSON: every scalar number in [0, 1] whose key looks like a p-value (p, p_*, *_p, pValue, pFW, pWY,
 * minP, fw, ...).  Markdown / logs / TSV / CSV text: every "p = x", "p=x", "p < x", "p ~ x".
 * Distinct tests are approximated by de-duplicating on (task, value rounded to 4 significant
 * digits): the same number repeated in a summary, a log and a report counts once.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RES = path.join(ROOT, 'results');
const args = process.argv.slice(2);
const SURVEY = args.includes('--survey');
const leads = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--lead') leads.push(+args[i + 1]);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args[oi + 1] : null;

const PKEY = /^(p|pval|pvalue|p_?value|p_?raw|p_?adj|p_?fw|p_?wy|p_?holm|p_?bonf|fw|fwp|fw_p|minp|min_p|p_one|p_two|p_upper|p_lower|p_emp|p_mc|p_perm|p_null|p_exact)$|^p_[a-z0-9_]+$|^p[A-Z][A-Za-z0-9]*$|_p$|P$|^fw[A-Z_]/;
// not test p-values: probabilities / likelihoods (P, pIso, pIsoGivenFit, pK1, pTrain, pAnyFit...), words ending in P
const NOT = /^(perChar|perWindow|pos|positions|pinned|pin|pins|pool|pattern|patterns|prefix|path|plaintext|perm|period|prob|pairs|P|pIso|pIsoGivenFit|pK\d*|pTrain|pAnyFit\w*)$|\s|^[A-Z]{2,}$/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (path.relative(RES, f).split(path.sep)[0] === 'lead') continue; walk(f, out); } else out.push(f);
  }
  return out;
}

const files = walk(RES, []);
const recs = [];   // {task, file, where, key, value, kind}
const keyCounts = {};

function fromJson(obj, file, task, trail) {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => { if (v && typeof v === 'object') fromJson(v, file, task, trail + `[${i}]`); });
    return;
  }
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && PKEY.test(k) && !NOT.test(k) && v >= 0 && v <= 1) {
      recs.push({ task, file, where: trail + '.' + k, key: k, value: v, kind: 'json' });
      keyCounts[task] = keyCounts[task] || {};
      keyCounts[task][k] = (keyCounts[task][k] || 0) + 1;
    } else if (v && typeof v === 'object') fromJson(v, file, task, trail + '.' + k);
  }
}

const TXT = /\bp(?:[- _]?value)?\s*(?:=|<|~|≈|<=|≤)\s*([0-9]*\.?[0-9]+(?:e-?[0-9]+)?)/gi;
for (const f of files) {
  const rel = path.relative(RES, f).replace(/\\/g, '/');
  const task = rel.split('/')[0];
  const ext = path.extname(f).toLowerCase();
  let size = 0;
  try { size = fs.statSync(f).size; } catch (e) { continue; }
  if (size > 40e6) continue;
  if (ext === '.json') {
    let j;
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    fromJson(j, rel, task, '');
  } else if (['.md', '.log', '.txt', '.tsv', '.csv'].includes(ext)) {
    const t = fs.readFileSync(f, 'utf8');
    let m;
    TXT.lastIndex = 0;
    while ((m = TXT.exec(t))) {
      const v = +m[1];
      if (v >= 0 && v <= 1) recs.push({ task, file: rel, where: `@${m.index}`, key: 'text', value: v, kind: ext.slice(1) });
    }
  }
}

if (SURVEY) {
  const byTask = {};
  for (const r of recs) { byTask[r.task] = byTask[r.task] || { json: 0, text: 0 }; byTask[r.task][r.kind === 'json' ? 'json' : 'text']++; }
  console.log(JSON.stringify(byTask, null, 1));
  for (const [t, kc] of Object.entries(keyCounts)) console.log(t, Object.entries(kc).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, c]) => `${k}:${c}`).join(' '));
  process.exit(0);
}

// de-duplicate on (task, value to 4 significant digits)
const sig = (v) => (v === 0 ? '0' : v.toPrecision(4));
const distinct = new Map();
for (const r of recs) {
  const k = r.task + '|' + sig(r.value);
  if (!distinct.has(k)) distinct.set(k, r);
}
const byTask = {};
for (const r of recs) { byTask[r.task] = byTask[r.task] || { raw: 0, distinct: 0, files: new Set() }; byTask[r.task].raw++; byTask[r.task].files.add(r.file); }
for (const r of distinct.values()) byTask[r.task].distinct++;
const calibRe = /calib|selftest|certify|verify|smoke|sanity|positive|known|truth/i;
const all = [...distinct.values()];
const z = all.filter((r) => !calibRe.test(r.file) && !calibRe.test(r.where));
// upper-style count: every p-like field outside summary files and outside text (logs/markdown repeat JSON numbers)
const noSummary = recs.filter((r) => r.kind === 'json' && !/(^|\/)summary[^/]*$/i.test(r.file));
const noSummaryNoCalib = noSummary.filter((r) => !calibRe.test(r.file) && !calibRe.test(r.where));
const res = {
  generated: new Date().toISOString(),
  method: 'p-like JSON scalars and "p = x" text matches under results/ (results/lead excluded), de-duplicated on (task, value to 4 significant digits)',
  rawMatches: recs.length,
  jsonFieldsOutsideSummaries: noSummary.length,
  jsonFieldsOutsideSummariesExclCalibration: noSummaryNoCalib.length,
  distinctAll: all.length,
  distinctExcludingCalibration: z.length,
  byTask: Object.fromEntries(Object.entries(byTask).map(([t, v]) => [t, { raw: v.raw, distinct: v.distinct, files: v.files.size }])),
  smallest: all.slice().sort((a, b) => a.value - b.value).slice(0, 40).map((r) => ({ task: r.task, file: r.file, where: r.where, value: r.value })),
  leads: [],
};
function holm(pLead, ps) {
  // ps: all project p-values including pLead's family; rank of pLead among them (ties: pLead first)
  const s = ps.slice().sort((a, b) => a - b);
  const m = s.length;
  let i = 0;
  while (i < m && s[i] < pLead) i++;     // number strictly smaller
  // Holm step-down adjusted p at rank i+1: max over j <= i+1 of (m - j + 1) p_(j)
  let adj = 0;
  for (let j = 0; j < i; j++) adj = Math.max(adj, Math.min(1, (m - j) * s[j]));
  adj = Math.max(adj, Math.min(1, (m - i) * pLead));
  return { m, rank: i + 1, holm: adj, bonferroni: Math.min(1, m * pLead), smallerCount: i };
}
// curated level: p-like JSON fields in the tasks' summary files (headline tables), de-duplicated per task and value
const summ = new Map();
for (const r of recs) if (r.kind === 'json' && /(^|\/)summary[^/]*\.json$/i.test(r.file)) summ.set(r.task + '|' + sig(r.value), r);
res.summaryFilesDistinct = summ.size;
res.summaryFilesByTask = {};
for (const r of summ.values()) res.summaryFilesByTask[r.task] = (res.summaryFilesByTask[r.task] || 0) + 1;
for (const pl of leads) {
  res.leads.push({
    p: pl,
    breakEvenM: 0.05 / pl,
    bonferroniAt: Object.fromEntries([10, 100, summ.size, all.length, recs.length].map((m) => [m, Math.min(1, m * pl)])),
    summaryFiles: holm(pl, [...summ.values()].map((r) => r.value)),
    all: holm(pl, all.map((r) => r.value)),
    excludingCalibration: holm(pl, z.map((r) => r.value)),
    fieldsOutsideSummaries: holm(pl, noSummary.map((r) => r.value)),
    fieldsOutsideSummariesExclCalibration: holm(pl, noSummaryNoCalib.map((r) => r.value)),
  });
}
const text = JSON.stringify(res, null, 1);
if (OUT) fs.writeFileSync(path.join(ROOT, OUT), text);
console.log(JSON.stringify({ rawMatches: res.rawMatches, jsonFieldsOutsideSummaries: res.jsonFieldsOutsideSummaries, jsonFieldsOutsideSummariesExclCalibration: res.jsonFieldsOutsideSummariesExclCalibration, distinctAll: res.distinctAll, distinctExcludingCalibration: res.distinctExcludingCalibration, byTask: res.byTask, leads: res.leads }, null, 1));
