'use strict';
/**
 * tools/z13names_test.js - self-checks for the z13names tools.
 *  1. The suspect fit checker (z13names_suspects.fits) agrees with tools/cipher.js checkCandidate
 *     on literature examples (strict / weak / violating).
 *  2. Brute force: every FIRST LAST of length 13 from the top --nf male first names and top --nl
 *     surnames is checked with the fit checker; the set of fits must equal the 0-filler FL fits of
 *     the enumerator run (restricted to the same names), for z13.canonical simple and homophonic.
 *  3. Fillers: same brute force for names of length 11-12 with 1-2 filler letters at the ends,
 *     compared with a fresh enumerator run on the same sub-lists (plain streaming, no --agg).
 * Usage: node tools/z13names_test.js [--nf 400] [--nl 4000]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const C = require('./cipher');
const S = require('./z13names_suspects');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const nf = +opt('nf', 400), nl = +opt('nl', 4000);
let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) failures++; };

const variants = S.loadVariants();
const V = Object.fromEntries(variants.map((v) => [v.id, v]));

// 1. literature examples
const lit = [
  ['CHASTITYTRACY', 'strict'], ['GARYLYLELARGE', 'weak'], ['EDDIEPENERDEN', 'weak'],
  ['ALFREDENEUMAN', 'violates'], ['EARLVANBESTJR', 'violates'], ['KATHLEENJOHNS', 'violates'], ['ARTLEIGHALLEN', 'violates'],
];
for (const [s, want] of lit) {
  const cs = C.checkCandidate(V['z13.canonical'].text, s, { mode: 'simple' }).ok;
  const ch = C.checkCandidate(V['z13.canonical'].text, s, { mode: 'homophonic' }).ok;
  const fs_ = S.fits(V['z13.canonical'], 'simple', s, null).some((x) => x.lead + x.trail === 0);
  const fh = S.fits(V['z13.canonical'], 'homophonic', s, null).some((x) => x.lead + x.trail === 0);
  const got = cs ? 'strict' : ch ? 'weak' : 'violates';
  check(`literature ${s}`, got === want && cs === fs_ && ch === fh, `expected ${want}, cipher.js ${got}, checker simple=${fs_} homophonic=${fh}`);
}
// letters_literal pin check: a string with A,E,N,K,M at their own positions
{
  const v = V['z13.letters_literal'];
  const okS = S.fits(v, 'simple', 'AENDOKOMOLNAM', null).length > 0;
  const badS = S.fits(v, 'simple', 'BENDOKOMOLNBM', null).length > 0;
  check('letters_literal pins', okS && !badS, `AENDOKOMOLNAM fits=${okS}, BENDOKOMOLNBM fits=${badS}`);
}

// 2-3. brute force vs enumerator on sub-lists
function readTop(file, n) {
  const out = [];
  for (const ln of fs.readFileSync(path.join(ROOT, file), 'latin1').split('\n')) {
    if (!ln) continue;
    const [w, x] = ln.split('\t');
    if (/^[A-Z]+$/.test(w)) out.push([w, +x]);
    if (out.length >= n) break;
  }
  return out;
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'z13names-test-'));
const F = readTop('data/names/first_male.tsv', nf), L = readTop('data/names/surnames.tsv', nl);
fs.writeFileSync(path.join(tmp, 'f.tsv'), F.map((e) => e.join('\t')).join('\n') + '\n');
fs.writeFileSync(path.join(tmp, 'l.tsv'), L.map((e) => e.join('\t')).join('\n') + '\n');
for (const vid of ['z13.canonical', 'z13.circles_distinct', 'z13.crosshair_null', 'z13.letters_literal']) {
  const v = V[vid];
  const file = vid === 'z13.letters_literal' ? 'data/ciphers/variants/z13.canonical.txt' : `data/ciphers/variants/${vid}.txt`;
  for (const mode of ['simple', 'homophonic']) {
    const tsv = path.join(tmp, `${vid}.${mode}.tsv`);
    const args = [path.join(ROOT, 'tools', 'z13names_enumerate.js'), 'names', '--cipher', file, '--mode', mode, '--patterns', 'FL',
      '--first-file', path.join(tmp, 'f.tsv'), '--last-file', path.join(tmp, 'l.tsv'), '--fillers', '2', '--filler-at', 'ends', '--threads', '1', '--show', '0', '--stream', tsv];
    if (vid === 'z13.letters_literal') args.push('--pin', 'A=A,E=E,N=N,K=K,M=M');
    const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) { check(`enumerate ${vid} ${mode}`, false, r.stderr.slice(0, 300)); continue; }
    const enumSet = new Set();
    for (const ln of fs.readFileSync(tsv, 'utf8').split('\n').slice(1)) {
      if (!ln) continue;
      const [pt, , , parts] = ln.split('\t');
      let lead = 0;
      while (!(pt[lead] >= 'A' && pt[lead] <= 'Z')) lead++;
      enumSet.add(parts + '@' + lead);
    }
    const bruteSet = new Set();
    const Lc = v.ids.length;
    for (const [f] of F) for (const [l] of L) {
      const n = f.length + l.length;
      if (n < Lc - 2 || n > Lc) continue;
      for (const x of S.fits(v, mode, f + l, [f.length, l.length])) bruteSet.add(`${f} ${l}@${x.lead}`);
    }
    let same = enumSet.size === bruteSet.size;
    if (same) for (const k of enumSet) if (!bruteSet.has(k)) { same = false; break; }
    check(`brute force FL ${vid} ${mode} (0-2 fillers at ends)`, same, `enumerator ${enumSet.size}, brute force ${bruteSet.size}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exitCode = failures ? 1 : 0;
