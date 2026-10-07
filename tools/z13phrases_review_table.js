'use strict';
// Reviewer helper: tabulate headline counts from results/z13phrases/runs/*.json (read-only).
const fs = require('fs');
const path = require('path');
const d = path.join(__dirname, '..', 'results', 'z13phrases', 'runs');
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) {
  if (only && !only.test(f)) continue;
  const r = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
  const a = r.counts.atLeast || {};
  const g = (k) => (a[k] ? a[k].count : '-');
  const top = r.top && r.top[0] ? `${r.top[0].words} ${r.top[0].wordLogp}` : '';
  console.log([f.replace('.json', ''), r.cipher.text, r.cipher.length, r.options.mode, `${r.options.topWords}/${r.options.maxWords}/${r.options.vocab}`,
    r.counts.complete ? 'C' : 'INC', `${r.counts.tasksDone}/${r.counts.tasks}`, r.counts.consistentStrings, `p50=${g('real_p50')}`, `p75=${g('real_p75')}`, `p90=${g('real_p90')}`,
    `viol=${r.counts.boundViolations}`, `t=${(r.timeMs.total / 1000).toFixed(0)}s`, `tlow=${Number(r.options.tlow).toFixed(2)}`, `slip=${(r.cipher.slips || []).join(',')}`, `range=${JSON.stringify(r.cipher.range)}`, top].join(' | '));
}
