'use strict';
/**
 * tools/nullmodel_solvernull.js - solver null model for Z13 and Z32.
 *
 * Runs the standard anneal pipeline (tools/anneal.js solve(), self-test options:
 * 5-grams, entropy 0.5, word term weight 1, top 20) on
 *   real       the real cipher variants with distinct isomorphs
 *   exact      synthetic ciphers with EXACTLY the real isomorph, made from corpus
 *              windows that fit (the truth is known); symbols relabelled at random
 *              and a different solver seed per cipher
 *   scrambled  random isomorphs with the same length and repeat profile
 *              (Z13: one symbol x3, three x2, four x1; Z32: three pairs, 26 singles)
 * and records the solver's best objective score, its 6-gram log10 P, its word
 * log10 P, and for synthetic ciphers the truth's score and rank.
 *
 * Usage:
 *   node tools/nullmodel_solvernull.js [--which z13,z32] [--n-exact 20] [--n-scrambled 20]
 *        [--n32 12 (Z32 caps on --n-exact and --n-scrambled)] [--threads 4] [--modes13 homophonic,simple] [--out results/nullmodel/solvernull.json]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('./anneal');
const C = require('./cipher');
const lm = require('./lm');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const SYMS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+-./:;<=>@^_~';

function args() {
  const a = process.argv.slice(2);
  const o = { which: 'z13,z32', nExact: 20, nScrambled: 20, n32: 12, threads: 4, modes13: 'homophonic,simple', out: 'results/nullmodel/solvernull.json' };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--which') o.which = a[++i];
    else if (k === '--n-exact') o.nExact = +a[++i];
    else if (k === '--n-scrambled') o.nScrambled = +a[++i];
    else if (k === '--n32') o.n32 = +a[++i];
    else if (k === '--threads') o.threads = +a[++i];
    else if (k === '--modes13') o.modes13 = a[++i];
    else if (k === '--out') o.out = a[++i];
    else { console.error('unknown option ' + k); process.exit(2); }
  }
  return o;
}

function readFits(file, simpleOnly) {
  const rows = fs.readFileSync(file, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
  return rows.filter((r) => r[4] === '1' && (!simpleOnly || r[3] === '1')).map((r) => r[0]);
}

/** cipher text with the given isomorph structure (classes of the real text), symbols drawn at random */
function relabel(text, rng) {
  const pool = SYMS.split('');
  for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const m = new Map();
  return Array.from(text, (c) => { if (!m.has(c)) m.set(c, pool[m.size]); return m.get(c); }).join('');
}

/** random isomorph with the same class sizes */
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

function ng6(pt) { return lm.ngramScore(pt, 6).logp; }

async function runOne(pool, tmp, rec, opts) {
  const f = path.join(tmp, `${rec.id}.json`);
  const j = { id: rec.id, ascii: rec.cipher };
  if (rec.truth) j.plaintext_aligned = rec.truth;
  fs.writeFileSync(f, JSON.stringify(j));
  const t0 = Date.now();
  const r = await A.solve(Object.assign({ cipher: f, mode: rec.mode, threads: opts.threads, seed: rec.seed || 1 }, opts.solver), pool);
  const best = r.solutions[0];
  const out = Object.assign({}, rec, {
    isomorph: C.isomorph(rec.cipher),
    best: best.plaintext, bestWords: best.words, bestScore: best.score, bestNgram5Sum: best.ngramTerm,
    bestLogp6: ng6(best.plaintext), bestWordLogp: best.wordLogp, bestEnglishLike: best.unknownWords.length === 0,
    top5: r.solutions.slice(0, 5).map((s) => ({ words: s.words, score: s.score, logp6: ng6(s.plaintext), wordLogp: s.wordLogp })),
    distinctFound: r.summary.distinct, bestHitFraction: r.summary.bestHitFraction, seconds: (Date.now() - t0) / 1000,
  });
  if (rec.truth) {
    const ws = lm.wordSegment(rec.truth);
    const idx = r.solutions.findIndex((s) => s.plaintext === rec.truth);
    Object.assign(out, {
      truthScore: r.truthScore ? r.truthScore.score : null, truthLogp6: ng6(rec.truth), truthWordLogp: ws.logp, truthWords: ws.words.join(' '),
      recovered: best.plaintext === rec.truth, truthRank: idx >= 0 ? idx + 1 : null,
      bestBeatsTruth: best.plaintext !== rec.truth && r.truthScore && best.score > r.truthScore.score + 1e-9,
      accuracy: best.accuracy,
    });
  }
  return out;
}

function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

/** single-run guard: skip when the output is already complete or another live process is writing it */
function guard(out) {
  try { const j = JSON.parse(fs.readFileSync(out, 'utf8')); if (j.totalSeconds != null) { console.error(`${out} is already complete; nothing to do`); return false; } } catch (_) { /* missing or partial */ }
  const lock = out + '.lock';
  try { const pid = +fs.readFileSync(lock, 'utf8'); if (pid && pid !== process.pid && alive(pid)) { console.error(`${out} is being written by pid ${pid}; nothing to do`); return false; } } catch (_) { /* no lock */ }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(lock, String(process.pid));
  process.on('exit', () => { try { if (+fs.readFileSync(lock, 'utf8') === process.pid) fs.rmSync(lock); } catch (_) {} });
  return true;
}

async function main() {
  const o = args();
  if (!guard(o.out)) return;
  const rng = makeRng(20261007, 0x6e756c6c);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nullmodel_sn_'));
  const pool = A.createPool({ threads: o.threads, orders: [{ n: 5, w: 1 }] });
  const solverZ13 = { restarts: 54, top: 20, wordweight: 1, quiet: true };
  const solverZ32 = { restarts: 54, top: 20, wordweight: 1, quiet: true };
  const jobs = [];
  const V = (id) => fs.readFileSync(path.join(ROOT, 'data', 'ciphers', 'variants', id + '.txt'), 'latin1').trim();
  const which = o.which.split(',');
  if (which.includes('z13')) {
    const modes = o.modes13.split(',');
    const canon = V('z13.canonical');
    // corpus windows that fit Z13 (clean; simple-fit ones for the simple-mode runs)
    const fitsHom = [...new Set(readFits(path.join(ROOT, 'results/nullmodel/windows/fits_z13.canonical_train.tsv'), false)
      .concat(readFits(path.join(ROOT, 'results/nullmodel/windows/fits_z13.canonical_heldout.tsv'), false)))];
    const fitsSim = readFits(path.join(ROOT, 'results/nullmodel/windows/fits_z13.canonical_train.tsv'), true);
    for (const mode of modes) {
      for (const id of ['z13.canonical', 'z13.circles_distinct', 'z13.crosshair_null', 'z13.reversed']) {
        jobs.push({ cipherName: 'z13', set: 'real', variant: id, id: `${id}_${mode}`, cipher: V(id), mode, solver: solverZ13 });
      }
      const pool13 = mode === 'simple' ? fitsSim : fitsHom;
      const pick = pool13.slice();
      for (let i = pick.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pick[i], pick[j]] = [pick[j], pick[i]]; }
      pick.slice(0, o.nExact).forEach((truth, i) => jobs.push({ cipherName: 'z13', set: 'exact', id: `z13_exact_${mode}_${i}`, cipher: relabel(canon, rng), truth, mode, seed: 100 + i, solver: solverZ13 }));
      for (let i = 0; i < o.nScrambled; i++) jobs.push({ cipherName: 'z13', set: 'scrambled', id: `z13_scr_${mode}_${i}`, cipher: scramble(canon, rng), mode, seed: 300 + i, solver: solverZ13 });
    }
  }
  if (which.includes('z32')) {
    const canon = V('z32.canonical');
    for (const id of ['z32.canonical', 'z32.triangles_merged', 'z32.reversed']) {
      jobs.push({ cipherName: 'z32', set: 'real', variant: id, id: `${id}_homophonic`, cipher: id === 'z32.reversed' ? canon.split('').reverse().join('') : V(id), mode: 'homophonic', solver: solverZ32 });
    }
    // held-out windows that fit Z32 (never seen by the n-gram tables)
    const fits = readFits(path.join(ROOT, 'results/nullmodel/windows/fits_z32.canonical_heldout.tsv'), false);
    const pick = fits.slice();
    for (let i = pick.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pick[i], pick[j]] = [pick[j], pick[i]]; }
    pick.slice(0, Math.min(o.nExact, o.n32)).forEach((truth, i) => jobs.push({ cipherName: 'z32', set: 'exact', id: `z32_exact_${i}`, cipher: relabel(canon, rng), truth, mode: 'homophonic', seed: 100 + i, solver: solverZ32 }));
    for (let i = 0; i < Math.min(o.nScrambled, o.n32); i++) jobs.push({ cipherName: 'z32', set: 'scrambled', id: `z32_scr_${i}`, cipher: scramble(canon, rng), mode: 'homophonic', seed: 300 + i, solver: solverZ32 });
  }
  const rep = { tool: 'tools/nullmodel_solvernull.js', created: new Date().toISOString(), command: 'node ' + process.argv.slice(1).join(' '),
    solver: { n: 5, entropy: 0.5, wordweight: 1, restarts: 54, top: 20, iters: 'auto' }, rows: [] };
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  const t0 = Date.now();
  for (const job of jobs) {
    const { solver, ...rec } = job;
    const r = await runOne(pool, tmp, rec, { threads: o.threads, solver });
    rep.rows.push(r);
    fs.writeFileSync(o.out, JSON.stringify(rep, null, 1));
    process.stderr.write(`${r.id}: ${r.bestWords} score ${r.bestScore.toFixed(2)}${r.truth ? ` | truth ${r.truthWords} ${r.truthScore.toFixed(2)} rank ${r.truthRank}` : ''} (${r.seconds.toFixed(1)} s, total ${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
  }
  pool.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  rep.totalSeconds = (Date.now() - t0) / 1000;
  fs.writeFileSync(o.out, JSON.stringify(rep, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
