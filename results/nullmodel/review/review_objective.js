'use strict';
/**
 * results/nullmodel/review/review_objective.js - reviewer check: does the nullmodel solver-null
 * and length-scan outcome depend on the anneal objective?
 *
 * The attacker's runs used the self-test objective: joint 5-gram window sum + entropy penalty 0.5 +
 * word term weight 1 ("joint5w").  This script re-solves the SAME synthetic ciphers (taken from
 * results/nullmodel/solvernull.json and results/nullmodel/lengthscan.json) with the Markov 6-gram
 * objective (log10 P6 of the text = the project's own language-model likelihood, "markov6"),
 * in simple mode only (homophonic markov6 degenerates to EEEEEEEEEEEEE, so the entropy term would
 * be needed there), and reports recovery and the truth's rank.
 *
 * Usage: node results/nullmodel/review/review_objective.js [--threads 1] [--out results/nullmodel/review/objective_check.json]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const A = require(path.join(ROOT, 'tools', 'anneal'));
const lm = require(path.join(ROOT, 'tools', 'lm'));

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const threads = +opt('--threads', 1);
const outPath = opt('--out', path.join(__dirname, 'objective_check.json'));

async function main() {
  const sn = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/nullmodel/solvernull.json'), 'utf8'));
  const ls = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/nullmodel/lengthscan.json'), 'utf8'));
  const jobs = [];
  for (const r of sn.rows) if (r.set === 'exact' && r.mode === 'simple') jobs.push({ src: 'solvernull_exact_simple', id: r.id, cipher: r.cipher, truth: r.truth, attackerTop: r.best, attackerRecovered: r.recovered });
  for (const r of ls.rows) if (r.type === 'simple' && (r.L === 13 || r.L === 20 || r.L === 32)) jobs.push({ src: `lengthscan_simple_L${r.L}`, id: `${r.type}_${r.L}_${r.i}`, cipher: r.cipher, truth: r.truth, attackerTop: r.top, attackerRecovered: r.recovered });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nmrev_obj_'));
  const pool = A.createPool({ threads, orders: [6], markov: true, six: 'exact' });
  const rows = [];
  const t0 = Date.now();
  for (const j of jobs) {
    const f = path.join(tmp, j.id + '.json');
    fs.writeFileSync(f, JSON.stringify({ id: j.id, ascii: j.cipher, plaintext_aligned: j.truth }));
    const r = await A.solve({ cipher: f, mode: 'simple', n: '6', score: 'markov', entropy: 0, wordweight: 0, restarts: 54, top: 20, threads, seed: 1, quiet: true }, pool);
    const best = r.solutions[0];
    const idx = r.solutions.findIndex((s) => s.plaintext === j.truth);
    const row = Object.assign({}, j, {
      markov6Top: best.plaintext, markov6TopWords: best.words, markov6TopLogp6: lm.ngramScore(best.plaintext, 6).logp,
      truthLogp6: lm.ngramScore(j.truth, 6).logp, attackerTopLogp6: lm.ngramScore(j.attackerTop, 6).logp,
      markov6Recovered: best.plaintext === j.truth, markov6TruthRank: idx >= 0 ? idx + 1 : null,
      truthBeatsAttackerTopUnderP6: lm.ngramScore(j.truth, 6).logp > lm.ngramScore(j.attackerTop, 6).logp,
    });
    rows.push(row);
    process.stderr.write(`${j.id}: truth ${j.truth} | joint5w top ${j.attackerTop} (${j.attackerRecovered ? 'R' : '-'}) | markov6 top ${best.plaintext} (${row.markov6Recovered ? 'R' : '-'}, rank ${row.markov6TruthRank}) ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  }
  pool.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const summary = {};
  for (const r of rows) {
    const s = summary[r.src] || (summary[r.src] = { n: 0, joint5wRecovered: 0, markov6Recovered: 0, markov6TruthInTop20: 0, truthBeatsAttackerTopUnderP6: 0 });
    s.n++;
    if (r.attackerRecovered) s.joint5wRecovered++;
    if (r.markov6Recovered) s.markov6Recovered++;
    if (r.markov6TruthRank != null) s.markov6TruthInTop20++;
    if (r.truthBeatsAttackerTopUnderP6) s.truthBeatsAttackerTopUnderP6++;
  }
  fs.writeFileSync(outPath, JSON.stringify({ tool: 'results/nullmodel/review/review_objective.js', created: new Date().toISOString(), summary, rows, seconds: (Date.now() - t0) / 1000 }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
