#!/usr/bin/env node
// synthesis_extract.js: copy the attack-phase reports and adversarial reviews out of a workflow
// journal (JSON lines written by the workflow harness) into one JSON file in the workspace, so
// the synthesis can be checked without the session transcript.
//
// usage: node tools/synthesis_extract.js --journal <path/to/journal.jsonl> --out results/synthesis/reports_and_reviews.json
//
// Each journal line of type "started" carries a label ("attack:<task>" or "review:<task>") and an
// agentId; each line of type "result" carries the agentId and the structured result. This script
// joins them and writes { tasks: { <task>: { report, review } }, source, created }.
'use strict';
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const journal = arg('journal');
const out = arg('out', 'results/synthesis/reports_and_reviews.json');
if (!journal) {
  console.error('usage: node tools/synthesis_extract.js --journal <journal.jsonl> [--out <file>]');
  process.exit(2);
}
const lines = fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean);
const labelOf = {};
const results = {};
for (const l of lines) {
  const e = JSON.parse(l);
  if (e.type === 'started' && e.label) labelOf[e.agentId] = e.label;
  if (e.type === 'result' && e.result) results[e.agentId] = e.result;
}
const tasks = {};
for (const [agentId, result] of Object.entries(results)) {
  const label = labelOf[agentId] || 'unknown:' + agentId;
  const [kind, task] = label.split(':');
  if (!tasks[task]) tasks[task] = {};
  tasks[task][kind === 'attack' ? 'report' : kind] = Object.assign({ agentId }, result);
}
const names = Object.keys(tasks).sort();
for (const t of names) {
  const has = Object.keys(tasks[t]).join(',');
  console.log(t.padEnd(12), has);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  created: new Date().toISOString(),
  source: 'workflow journal ' + path.basename(path.dirname(journal)),
  tasks,
}, null, 1));
console.log('wrote', out, '(' + names.length + ' tasks)');
