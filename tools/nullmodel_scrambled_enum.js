'use strict';
/**
 * tools/nullmodel_scrambled_enum.js - dictionary-fit counts for random isomorphs
 * with Z13's repeat profile (one symbol x3, three x2, four x1) compared with
 * the real Z13 variants.
 *
 * For each cipher: tools/enumerate.js words mode (simple substitution, top
 * 20,000 words of words_common.tsv, at most 4 words) -> number of consistent
 * strings, number made only of vocabulary words, best wordSegment log10 P;
 * and tools/nullmodel_tuplejoin.js counts are left to the Oranchak script.
 *
 * Usage: node tools/nullmodel_scrambled_enum.js [--n 30] [--threads 4] [--mode simple]
 *        [--top-words 20000] [--max-words 4] [--out results/nullmodel/scrambled_enum.json]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const EN = require('./enumerate');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const SYMS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function args() {
  const a = process.argv.slice(2);
  const o = { n: 30, threads: 4, mode: 'simple', topWords: 20000, maxWords: 4, out: 'results/nullmodel/scrambled_enum.json' };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--n') o.n = +a[++i];
    else if (k === '--threads') o.threads = +a[++i];
    else if (k === '--mode') o.mode = a[++i];
    else if (k === '--top-words') o.topWords = +a[++i];
    else if (k === '--max-words') o.maxWords = +a[++i];
    else if (k === '--out') o.out = a[++i];
  }
  return o;
}

function scramble(text, rng) {
  const cnt = new Map();
  for (const c of text) cnt.set(c, (cnt.get(c) || 0) + 1);
  const sizes = [...cnt.values()].sort((x, y) => y - x);
  const L = text.length;
  const perm = Array.from({ length: L }, (_, i) => i);
  for (let i = L - 1; i > 0; i--) { const j = rng.int(i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const out = new Array(L);
  let k = 0;
  sizes.forEach((sz, ci) => { for (let t = 0; t < sz; t++) out[perm[k++]] = SYMS[ci]; });
  return out.join('');
}

async function main() {
  const o = args();
  const rng = makeRng(13131313, 0x656e756d);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nullmodel_se_'));
  const V = (id) => fs.readFileSync(path.join(ROOT, 'data', 'ciphers', 'variants', id + '.txt'), 'latin1').trim();
  const canon = V('z13.canonical');
  const jobs = [];
  for (const id of ['z13.canonical', 'z13.reversed', 'z13.crosshair_null']) jobs.push({ set: 'real', id, cipher: V(id) });
  for (let i = 0; i < o.n; i++) jobs.push({ set: 'scrambled', id: `scr_${i}`, cipher: scramble(canon, rng) });
  const rep = { tool: 'tools/nullmodel_scrambled_enum.js', created: new Date().toISOString(), command: 'node ' + process.argv.slice(1).join(' '),
    options: { mode: o.mode, topWords: o.topWords, maxWords: o.maxWords, wordList: 'data/lm/words_common.tsv' }, rows: [] };
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  for (const j of jobs) {
    const f = path.join(tmp, `${j.id}.txt`);
    fs.writeFileSync(f, j.cipher);
    const t0 = Date.now();
    const en = await EN.wordsMode({ cipher: f, mode: o.mode, 'top-words': String(o.topWords), 'max-words': String(o.maxWords), quiet: true, top: '5', threads: String(o.threads) });
    const best = en.top[0] || null;
    const row = { set: j.set, id: j.id, cipher: j.cipher, consistentStrings: en.counts.consistentStrings, noUnknownWords: en.counts.noUnknownWords, complete: en.counts.complete,
      best: best ? best.words : null, bestWordLogp: best ? best.wordLogp : null, top5: en.top.slice(0, 5).map((t) => [t.words, t.wordLogp]), seconds: (Date.now() - t0) / 1000 };
    rep.rows.push(row);
    fs.writeFileSync(o.out, JSON.stringify(rep, null, 1));
    process.stderr.write(`${j.id} ${j.cipher}: ${row.consistentStrings} consistent, ${row.noUnknownWords} all-word, best ${row.best} ${row.bestWordLogp && row.bestWordLogp.toFixed(2)} (${row.seconds.toFixed(1)} s)\n`);
  }
  const scr = rep.rows.filter((r) => r.set === 'scrambled');
  const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
  rep.summary = {};
  for (const key of ['consistentStrings', 'noUnknownWords', 'bestWordLogp']) {
    const vals = scr.map((r) => r[key]);
    rep.summary[key] = { scrambledMedian: q(vals, 0.5), scrambledP05: q(vals, 0.05), scrambledP95: q(vals, 0.95),
      real: Object.fromEntries(rep.rows.filter((r) => r.set === 'real').map((r) => [r.id, { value: r[key], fractionScrambledAtLeast: vals.filter((v) => v >= r[key]).length / vals.length }])) };
  }
  fs.writeFileSync(o.out, JSON.stringify(rep, null, 1));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(JSON.stringify(rep.summary, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
