'use strict';
/**
 * tools/z13phrases_test.js - checks for tools/z13phrases_enum.js:
 *  1. the score bound is >= lm.wordSegment log10 P on random strings, real phrases
 *     and enumerated fits (both vocabularies);
 *  2. with --tlow -1e9 the driver finds exactly the same fits and scores as
 *     tools/enumerate.js words (simple and homophonic, small word lists);
 *  3. --slip makes a position a wildcard (ALFRED E NEUMAN appears only with a slip at 2 or 10);
 *  4. --range keeps a substring.
 *   node tools/z13phrases_test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const lm = require('./lm');
const enumr = require('./enumerate');
const Z = require('./z13phrases_enum');
const TS = require('./textsample');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(os.tmpdir(), 'z13phrases_test');
fs.mkdirSync(TMP, { recursive: true });
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failures++; };

function boundTest(vocab) {
  const V = lm.vocab(vocab);
  const L = 13;
  const sEntries = [], sId = [];
  for (let i = 0; i < V.size; i++) if (V.words[i].length <= L) { sEntries.push({ w: V.words[i], weight: 1 }); sId.push(i); }
  const strie = enumr.buildTrie(sEntries);
  const bound = Z.makeBound(V, strie, Int32Array.from(sId), Z.maxInTable(V), L);
  const rng = makeRng(7, 1);
  const strs = [];
  for (let i = 0; i < 5000; i++) { let s = ''; for (let k = 0; k < L; k++) s += String.fromCharCode(65 + rng.int(26)); strs.push(s); }
  const smp = TS.sampler(99);
  for (let i = 0; i < 3000; i++) strs.push(smp.phrase(L).letters);
  for (const s of ['ADEFINITIVEAT', 'ONTHEDEFEATOF', 'INTHEDESERTIS', 'ALFREDENEUMAN', 'MYNAMEISROBERT', 'THEZODIACKILL'].map((x) => x.slice(0, L))) strs.push(s.padEnd(L, 'E'));
  let viol = 0, gapSum = 0, maxGap = 0;
  for (const s of strs) {
    const codes = lm.encode(s);
    const ub = bound(codes);
    const ex = lm.wordSegment(s, { vocab }).logp;
    if (ex > ub + 1e-9) viol++;
    gapSum += ub - ex; if (ub - ex > maxGap) maxGap = ub - ex;
  }
  ok(viol === 0, `bound >= wordSegment on ${strs.length} strings (${vocab}); mean gap ${(gapSum / strs.length).toFixed(3)}, max gap ${maxGap.toFixed(3)}`);
}

function readTsv(file) {
  const m = new Map();
  const lines = fs.readFileSync(file, 'utf8').split('\n').slice(1);
  for (const ln of lines) { if (!ln) continue; const p = ln.split('\t'); m.set(p[0], +p[1]); }
  return m;
}

function runDriver(args) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'z13phrases_enum.js'), ...args, '--quiet'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.log(r.stdout, r.stderr); throw new Error('driver failed'); }
  return r.stdout;
}

async function compareTest(mode, topWords, maxWords) {
  const cipher = 'data/ciphers/variants/z13.canonical.txt';
  const ref = await enumr.wordsMode({ _: ['words'], cipher, mode, 'top-words': String(topWords), 'max-words': String(maxWords), threads: '1', top: '100000000', quiet: true });
  const refMap = new Map(ref.top.map((t) => [t.plaintext, t.wordLogp]));
  const tsv = path.join(TMP, `cmp_${mode}.tsv`);
  const outJ = path.join(TMP, `cmp_${mode}.json`);
  runDriver(['--cipher', cipher, '--mode', mode, '--top-words', String(topWords), '--max-words', String(maxWords), '--tlow', '-1e9', '--threads', '3', '--stream', tsv, '--out', outJ]);
  const got = readTsv(tsv);
  const J = JSON.parse(fs.readFileSync(outJ, 'utf8'));
  let same = got.size === refMap.size, maxd = 0;
  for (const [s, v] of refMap) { if (!got.has(s)) { same = false; break; } maxd = Math.max(maxd, Math.abs(got.get(s) - v)); }
  ok(same && maxd < 1e-3 && J.counts.consistentStrings === ref.counts.consistentStrings && J.counts.complete,
    `driver = enumerate.js (${mode}, top ${topWords}, <= ${maxWords} words): ${got.size} vs ${refMap.size} fits, counts ${J.counts.consistentStrings} vs ${ref.counts.consistentStrings}, max |dlogp| ${maxd.toExponential(2)}`);
  // threshold run gives the same top and exact counts above tlow
  const outT = path.join(TMP, `cmp_${mode}_t.json`);
  const tl = -12;
  runDriver(['--cipher', cipher, '--mode', mode, '--top-words', String(topWords), '--max-words', String(maxWords), '--tlow', String(tl), '--thresholds', '-12,-10,-9', '--threads', '3', '--out', outT]);
  const T = JSON.parse(fs.readFileSync(outT, 'utf8'));
  const refAbove = (t) => ref.top.filter((x) => x.wordLogp >= t).length;
  ok(T.counts.atLeast['t-10'].count === refAbove(-10) && T.counts.atLeast['t-9'].count === refAbove(-9) && T.counts.atLeast['t-12'].count === refAbove(-12) && T.counts.consistentStrings === ref.counts.consistentStrings,
    `bound prefilter keeps exact counts (${mode}): >=-12 ${T.counts.atLeast['t-12'].count}/${refAbove(-12)}, >=-10 ${T.counts.atLeast['t-10'].count}/${refAbove(-10)}, >=-9 ${T.counts.atLeast['t-9'].count}/${refAbove(-9)}; scored ${T.counts.scored} of ${T.counts.consistentStrings}`);
  ok(T.top[0].plaintext === ref.top[0].plaintext, `same best fit (${mode}): ${T.top[0].plaintext}`);
  // posterior concentration from the all-scored run equals a direct computation
  const ms = ref.top.map((t) => Math.pow(10, t.wordLogp));
  const Zs = ms.reduce((a, b) => a + b, 0);
  const share = Math.max(...ms) / Zs;
  const H = -ms.reduce((a, m) => a + (m / Zs) * Math.log(m / Zs), 0);
  ok(Math.abs(J.posterior.topShare - share) < 1e-3 && Math.abs(J.posterior.effectiveNumberExpEntropy - Math.exp(H)) / Math.exp(H) < 1e-3,
    `posterior (${mode}): topShare ${J.posterior.topShare.toFixed(4)} vs ${share.toFixed(4)}, effN ${J.posterior.effectiveNumberExpEntropy.toFixed(2)} vs ${Math.exp(H).toFixed(2)}`);
}

function slipTest() {
  // ALFREDENEUMAN: N at 2 and 10 would need F and M; a wildcard at 2 or 10 removes the conflict
  const wf = path.join(TMP, 'alfred_words.tsv');
  fs.writeFileSync(wf, 'ALFRED\t100\nE\t50\nNEUMAN\t40\nA\t30\n');
  const res = {};
  for (const slip of ['', '2', '10', '7']) {
    const outJ = path.join(TMP, `slip_${slip || 'none'}.json`);
    const args = ['--cipher', 'data/ciphers/variants/z13.canonical.txt', '--mode', 'simple', '--words-file', wf, '--top-words', '10', '--max-words', '3', '--tlow', '-1e9', '--threads', '1', '--out', outJ];
    if (slip) args.push('--slip', slip);
    runDriver(args);
    const J = JSON.parse(fs.readFileSync(outJ, 'utf8'));
    res[slip || 'none'] = J.top.map((t) => t.plaintext);
  }
  ok(!res.none.includes('ALFREDENEUMAN') && res['2'].includes('ALFREDENEUMAN') && res['10'].includes('ALFREDENEUMAN') && !res['7'].includes('ALFREDENEUMAN'),
    `slip wildcard: ALFREDENEUMAN none=${res.none.includes('ALFREDENEUMAN')} slip2=${res['2'].includes('ALFREDENEUMAN')} slip10=${res['10'].includes('ALFREDENEUMAN')} slip7=${res['7'].includes('ALFREDENEUMAN')}`);
}

function rangeTest() {
  const outJ = path.join(TMP, 'range.json');
  runDriver(['--cipher', 'data/ciphers/variants/z13.canonical.txt', '--mode', 'simple', '--top-words', '3000', '--max-words', '3', '--range', '1:12', '--tlow', '-1e9', '--threads', '2', '--out', outJ]);
  const J = JSON.parse(fs.readFileSync(outJ, 'utf8'));
  const C = require('./cipher');
  let allOk = J.cipher.text === 'ENz0K0M0[NA' && J.cipher.length === 11;
  for (const t of J.top.slice(0, 200)) if (!C.checkCandidate('ENz0K0M0[NA', t.plaintext, { mode: 'simple' }).ok) allOk = false;
  ok(allOk, `--range 1:12 -> ${J.cipher.text}, ${J.counts.consistentStrings} fits, top ${J.top[0] && J.top[0].words}`);
}

(async () => {
  boundTest('common');
  boundTest('full');
  await compareTest('simple', 5000, 4);
  await compareTest('homophonic', 2000, 3);
  slipTest();
  rangeTest();
  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exitCode = failures ? 1 : 0;
})();
