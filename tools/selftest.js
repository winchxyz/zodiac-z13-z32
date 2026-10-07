'use strict';
/**
 * tools/selftest.js - prove that the solver toolkit works, and take a first
 * look at the multiplicity problem of very short homophonic ciphers.
 *
 *   node tools/selftest.js [--quick] [--threads 18] [--only units,z408,z340,synthetic]
 *        [--sets zodiac63_len32,zodiac63_len13,simple_len13] [--out results/selftest.json]
 *
 * Sections
 *   units      lmshare tables vs lm.js; cipher.js checks; encrypt.js round trips;
 *              enumerate.js vs brute force (words and names); anneal determinism
 *              across thread counts; pins / forbidden letters / cribs honoured.
 *   z408       (a) solve Z408 from scratch, % letters correct and time.
 *   z340       (b) solve Z340 with its read order if data/ciphers/z340.json has one;
 *              otherwise say so, and run the clearly-labelled fallback on Oranchak's
 *              published untransposed Z340 (tools/selftest_data).
 *   synthetic  (c) 20 random 32-letter and 20 random 13-letter held-out English phrases,
 *              encrypted Zodiac-style (63 symbols in proportion to English letter
 *              frequency, cycling through each letter's homophones from a random start),
 *              plus the same 13-letter phrases under simple substitution (1 symbol per
 *              letter); solved with anneal.js; for the simple-substitution set the
 *              exhaustive enumerate.js count (top 10,000 words, <=4 words) of English fits that
 *              outscore the truth.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const lm = require('./lm');
const lmshare = require('./lmshare');
const C = require('./cipher');
const A = require('./anneal');
const E = require('./encrypt');
const EN = require('./enumerate');
const TS = require('./textsample');
const core = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const SD = path.join(__dirname, 'selftest_data');

function args() {
  const o = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--/, '');
    if (k === 'quick') o.quick = true; else o[k] = a[++i];
  }
  return o;
}

const log = (...x) => console.log(...x);
const pct = (x) => (x == null ? 'n/a' : (100 * x).toFixed(1) + '%');

/** Best accuracy any consistent homophonic key can reach: each symbol gets its majority letter. */
function ceiling(ct, pt) {
  const m = new Map();
  for (let i = 0; i < ct.length; i++) {
    if (!m.has(ct[i])) m.set(ct[i], {});
    const o = m.get(ct[i]);
    o[pt[i]] = (o[pt[i]] || 0) + 1;
  }
  let s = 0;
  for (const o of m.values()) s += Math.max(...Object.values(o));
  return s / ct.length;
}

function accuracy(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let ok = 0, n = 0;
  for (let i = 0; i < a.length; i++) if (/[A-Z]/.test(b[i])) { n++; if (a[i] === b[i]) ok++; }
  return n ? ok / n : null;
}

/* ------------------------------------------------------------------ units */

async function units(o) {
  const tests = [];
  const add = (name, passed, detail) => { tests.push({ name, passed: !!passed, detail }); log(`  [${passed ? 'ok' : 'FAIL'}] ${name}: ${detail}`); };

  // lmshare vs lm.js
  {
    const sh = lmshare.attach(lmshare.build({ orders: [3, 4, 5, 6], markov: true, six: 'exact' }));
    const rng = core.makeRng(5, 1);
    let maxd = 0;
    for (let i = 0; i < 200000; i++) {
      const idx = rng.u32() % 308915776;
      const d = Math.abs(sh.j6(idx) - lm.j6(idx));
      if (d > maxd) maxd = d;
    }
    let maxJ = 0;
    for (const n of [3, 4, 5]) {
      const J = lm.table(n), Cn = lm.condTable(n);
      for (let i = 0; i < 20000; i++) {
        const idx = rng.u32() % J.length;
        maxJ = Math.max(maxJ, Math.abs(sh.J[n][idx] - J[idx]), Math.abs(sh.C[n][idx] - Cn[idx]));
      }
    }
    add('lmshare exact tables equal lm.js', maxd === 0 && maxJ === 0, `max |shared j6 - lm.j6| over 200k random 6-grams = ${maxd}; max diff of shared J3-5 / C3-5 = ${maxJ}`);
  }
  if (!o.quick) {
    const t = Date.now();
    const shq = lmshare.attach(lmshare.build({ orders: [6], six: 'dense' }));
    const rng = core.makeRng(6, 1);
    let maxd = 0;
    for (let i = 0; i < 200000; i++) {
      const idx = rng.u32() % 308915776;
      const v = lm.j6(idx);
      if (v < -24) continue; // clipped by design
      maxd = Math.max(maxd, Math.abs(shq.j6(idx) - v));
    }
    add('lmshare dense 6-gram within quantisation error', maxd <= 0.0412, `max error ${maxd.toFixed(5)} log10 (bound 0.0412) on 200k random 6-grams, built in ${Date.now() - t} ms`);
  }

  // wordfast.js (inner-loop word term) vs brute-force unigram segmentation with lm.wordLogp
  {
    const WF = require('./wordfast');
    const F = WF.build('common');
    const samp = TS.sampler(31);
    const brute = (s) => {
      const n = s.length;
      let best = -Infinity;
      for (let m = 0; m < 1 << (n - 1); m++) {
        let v = 0, st = 0;
        for (let i = 1; i <= n; i++) if (i === n || (m >> (i - 1)) & 1) { v += lm.wordLogp(s.slice(st, i)); st = i; }
        if (v > best) best = v;
      }
      return best;
    };
    let maxd = 0, n = 0;
    const rng = core.makeRng(31, 2);
    for (let k = 0; k < 120; k++) {
      let s = k % 2 ? samp.phrase(10 + (k % 3)).letters : samp.passage(11).letters;
      if (k % 4 === 0) s = s.split('').map((c, i, a) => a[(i * 7 + rng.int(3)) % a.length]).join(''); // scrambled
      maxd = Math.max(maxd, Math.abs(brute(s) - WF.logp(F, s)));
      n++;
    }
    const strs = [];
    for (let i = 0; i < 500; i++) strs.push(samp.phrase(32).letters);
    let t = Date.now(), c = 0;
    while (Date.now() - t < 500) { WF.logp(F, strs[c % 500]); c++; }
    const fastRate = c * 2;
    t = Date.now(); c = 0;
    while (Date.now() - t < 500) { lm.wordSegment(strs[c % 500]); c++; }
    add('wordfast = brute-force unigram segmentation', maxd < 1e-9, `max |difference| ${maxd} over ${n} strings of 10-12 letters; speed on 32 letters ${fastRate}/s vs lm.wordSegment ${c * 2}/s`);
  }

  // cipher.js
  {
    const z13 = C.loadCipher(path.join(ROOT, 'data', 'ciphers', 'z13.json'));
    add('isomorph of Z13', C.isomorph(z13.text) === 'abcdefegehcag', `${z13.text} -> ${C.isomorph(z13.text)}`);
    const z = C.loadCipher(path.join(SD, 'z408_selftest.json'));
    const h = C.checkCandidate(z.text, z.plaintext, { mode: 'homophonic' });
    const s = C.checkCandidate(z.text, z.plaintext, { mode: 'simple' });
    const bad = z.plaintext.slice(0, 10) + (z.plaintext[10] === 'Q' ? 'X' : 'Q') + z.plaintext.slice(11);
    const b = C.checkCandidate(z.text, bad, { mode: 'homophonic' });
    add('checkCandidate on Z408', h.ok && !s.ok && !b.ok && b.conflicts.length === 1,
      `published plaintext homophonic-consistent=${h.ok} (${Object.keys(h.key).length} symbols, E has ${h.symbolsPerLetterCount.E} symbols); simple-consistent=${s.ok} (${s.injectivityConflicts.length} letters with >1 symbol); one altered letter -> ${b.conflicts.length} conflict`);
    const key = C.parseKey('==E,,=T,A=B C=D');
    add('parseKey with "=" and "," symbols', key.get('=') === 'E' && key.get(',') === 'T' && key.get('A') === 'B' && key.get('C') === 'D', JSON.stringify(C.keyToObject(key)));
    const ord = [3, 0, 2, 1];
    add('applyReadOrder', C.applyReadOrder('abcd', ord) === 'dacb' && C.parseReadOrder('4,1,3,2', 4).join() === ord.join(), `abcd with [3,0,2,1] -> ${C.applyReadOrder('abcd', ord)}; 1-based "4,1,3,2" -> ${C.parseReadOrder('4,1,3,2', 4)}`);
  }

  // encrypt.js
  {
    const samp = TS.sampler(99);
    let okH = 0, okS = 0, n = 0, dsum = 0;
    for (let i = 0; i < 50; i++) {
      const p = samp.passage(100 + i).letters;
      const e = E.encryptText(p, { seed: i, symbols: 63 });
      if (C.checkCandidate(e.cipher, p, { mode: 'homophonic' }).ok) okH++;
      const e2 = E.encryptText(p, { seed: i, alloc: 'simple' });
      if (C.checkCandidate(e2.cipher, p, { mode: 'simple' }).ok) okS++;
      dsum += e.distinctSymbols;
      n++;
    }
    const k = E.makeKey({ symbols: 63, allLetters: true, seed: 3 });
    const counts = Object.fromEntries(Object.entries(k).map(([l, v]) => [l, v.length]));
    const tot = Object.values(counts).reduce((a, b) => a + b, 0);
    add('encrypt round trip', okH === n && okS === n && tot === 63, `${okH}/${n} homophonic and ${okS}/${n} simple encryptions decrypt consistently; mean distinct symbols in 100-149 letters = ${(dsum / n).toFixed(1)}; 63-symbol key E/T/A/Q = ${counts.E}/${counts.T}/${counts.A}/${counts.Q}`);
    // cycling: a letter repeated k times uses min(k, homophones) distinct symbols
    const key = { E: ['a', 'b', 'c'], T: ['d'] };
    const r = E.encrypt('EEEEET', key, { startZero: true });
    add('encrypt cycles homophones', r.cipher === 'abcabd', `EEEEET with E=abc,T=d (start 0) -> ${r.cipher}`);
  }

  // enumerate.js words vs brute force
  {
    const entries = EN.readTsv(path.join(ROOT, 'data', 'lm', 'words_common.tsv'), 250, 13);
    const byLen = {};
    for (const e of entries) (byLen[e.w.length] = byLen[e.w.length] || []).push(e.w);
    const trie = EN.buildTrie(entries);
    const plain = 'PEOPLEWHOKNOW';
    const cs = [
      { name: 'Z13', text: C.loadCipher(path.join(ROOT, 'data', 'ciphers', 'z13.json')).text },
      { name: 'simple(PEOPLEWHOKNOW)', text: E.encryptText(plain, { alloc: 'simple', seed: 4 }).cipher },
      { name: 'zodiac63(PEOPLEWHOKNOW)', text: E.encryptText(plain, { symbols: 63, seed: 4 }).cipher },
    ];
    for (const ci of cs) {
      for (const mode of ['simple', 'homophonic']) {
        if (ci.name.startsWith('zodiac') && mode === 'homophonic') continue; // no repeats: every string fits, brute force too large
        const t0 = Date.now();
        const brute = new Set();
        const lens = Object.keys(byLen).map(Number);
        const L = 13;
        const tryS = (s) => { if (C.consistent(ci.text, s, mode)) brute.add(s); };
        for (const a of lens) {
          if (a === L) for (const w of byLen[a]) tryS(w);
          for (const b of lens) {
            if (a + b === L) for (const w1 of byLen[a]) for (const w2 of byLen[b]) tryS(w1 + w2);
            const c = L - a - b;
            if (c >= 1 && byLen[c]) for (const w1 of byLen[a]) for (const w2 of byLen[b]) { const p = w1 + w2; for (const w3 of byLen[c]) tryS(p + w3); }
          }
        }
        const tb = Date.now() - t0;
        const { symbols, ids } = C.symbolTable(ci.text);
        const eng = EN.makeWordEngine({ L: 13, ids: Array.from(ids), S: symbols.length, mode, M: 3, allowedMask: (1 << 26) - 1, fixed: new Array(symbols.length).fill(-1), trie });
        const got = new Set();
        eng.search(null, 13, (letters) => { let s = ''; for (const x of letters) s += String.fromCharCode(65 + x); got.add(s); });
        let same = got.size === brute.size;
        if (same) for (const s of brute) if (!got.has(s)) { same = false; break; }
        add(`enumerate words = brute force (${ci.name}, ${mode})`, same, `top 250 words, <=3 words: brute force ${brute.size} distinct strings in ${tb} ms, enumerate ${got.size}${brute.has(plain) ? `; contains ${plain}` : ''}`);
      }
    }
    // multi-threaded count equals single-threaded count on a bigger case
    const z13p = path.join(ROOT, 'data', 'ciphers', 'z13.json');
    const r1 = await EN.wordsMode({ cipher: z13p, mode: 'simple', 'top-words': '5000', 'max-words': '4', threads: '1', 'no-score': true, quiet: true, top: '5' });
    const r4 = await EN.wordsMode({ cipher: z13p, mode: 'simple', 'top-words': '5000', 'max-words': '4', threads: '6', 'no-score': true, quiet: true, top: '5' });
    add('enumerate words: threads=1 vs threads=6', r1.counts.consistentStrings === r4.counts.consistentStrings, `Z13 simple, top 5000 words, <=4 words: ${r1.counts.consistentStrings} vs ${r4.counts.consistentStrings} fits`);
  }

  // enumerate.js names vs brute force
  {
    const ND = path.join(ROOT, 'data', 'names');
    const F = EN.readTsv(path.join(ND, 'first_all.tsv'), 300, 13);
    const Ls = EN.readTsv(path.join(ND, 'surnames.tsv'), 3000, 13);
    const enc = E.encryptText('JAMESAJOHNSON', { alloc: 'simple', seed: 8 }).cipher;
    for (const [nm, text] of [['Z13', C.loadCipher(path.join(ROOT, 'data', 'ciphers', 'z13.json')).text], ['simple(JAMES A JOHNSON)', enc]]) {
      for (const mode of ['simple', 'homophonic']) {
        const brute = new Set();
        for (const f of F) for (const l of Ls) {
          if (f.w.length + l.w.length === 13 && C.consistent(text, f.w + l.w, mode)) brute.add('FL|' + f.w + ' ' + l.w);
          if (f.w.length + 1 + l.w.length === 13) for (let k = 0; k < 26; k++) {
            const I = String.fromCharCode(65 + k);
            if (C.consistent(text, f.w + I + l.w, mode)) brute.add('FIL|' + f.w + ' ' + I + ' ' + l.w);
          }
        }
        const { symbols, ids } = C.symbolTable(text);
        const tries = { F: EN.buildTrie(F), L: EN.buildTrie(Ls) };
        tries.M = tries.F;
        const initW = new Float64Array(26).fill(1 / 26);
        const got = new Set();
        for (const pattern of ['FL', 'FIL']) {
          const eng = EN.makeNameEngine({ L: 13, ids: Array.from(ids), S: symbols.length, mode, allowedMask: (1 << 26) - 1, fixed: new Array(symbols.length).fill(-1), tries, initW, pattern, fillers: 0, gaps: new Array(pattern.length + 1).fill(0), minWeight: 0 });
          eng.search(null, (fit) => got.add(pattern + '|' + fit.parts.join(' ')));
        }
        let same = got.size === brute.size;
        if (same) for (const s of brute) if (!got.has(s)) { same = false; break; }
        add(`enumerate names = brute force (${nm}, ${mode})`, same, `top 300 first x top 3000 surnames, FL+FIL: brute force ${brute.size}, enumerate ${got.size}${brute.has('FIL|JAMES A JOHNSON') ? '; contains JAMES A JOHNSON' : ''}`);
      }
    }
    // fillers: a 12-letter name plus one filler must be found at the end
    const enc2 = E.encryptText('JAMESJOHNSONX', { alloc: 'simple', seed: 9 }).cipher;
    const { symbols, ids } = C.symbolTable(enc2);
    const tries = { F: EN.buildTrie(F), L: EN.buildTrie(Ls) };
    tries.M = tries.F;
    let found = false, n = 0;
    const eng = EN.makeNameEngine({ L: 13, ids: Array.from(ids), S: symbols.length, mode: 'simple', allowedMask: (1 << 26) - 1, fixed: new Array(symbols.length).fill(-1), tries, initW: new Float64Array(26).fill(1 / 26), pattern: 'FL', fillers: 1, gaps: [1, 1, 1], minWeight: 0 });
    eng.search(null, (fit) => { n++; if (fit.parts.join(' ') === 'JAMES JOHNSON' && fit.fillers === 1 && fit.codes[12] === -1) found = true; });
    add('enumerate names with a filler letter', found, `JAMESJOHNSON + 1 filler (simple substitution): ${n} fits with <=1 filler, JAMES JOHNSON? found=${found}`);
  }

  // anneal determinism and constraints
  {
    const samp = TS.sampler(7);
    const p = samp.passage(150).letters;
    const e = E.encryptText(p, { seed: 7, symbols: 40 });
    const tmp = path.join(os.tmpdir(), `selftest_det_${process.pid}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ id: 'det', ascii: e.cipher, plaintext_aligned: p }));
    const p1 = A.createPool({ threads: 1, orders: [5] });
    const p4 = A.createPool({ threads: 4, orders: [5] });
    const opts = { cipher: tmp, restarts: 8, iters: 30000, seed: 42, quiet: true, top: 8 };
    const r1 = await A.solve(opts, p1);
    const r4 = await A.solve(opts, p4);
    const sig = (r) => r.solutions.map((s) => `${s.plaintext}:${s.score.toFixed(6)}:${s.hits}`).join('|');
    add('anneal: same seed, threads=1 vs threads=4', sig(r1) === sig(r4), `${r1.solutions.length} distinct solutions, identical=${sig(r1) === sig(r4)}`);
    p4.close();
    fs.unlinkSync(tmp);
    const z = path.join(SD, 'z408_selftest.json');
    const pool = A.createPool({ threads: Math.min(+o.threads || 16, 16), orders: [5] });
    const rc = await A.solve({ cipher: z, restarts: 16, iters: 60000, pin: '9=I,%=L', forbid: 'QZ', crib: ['PEOPLE@any'], quiet: true, top: 16 }, pool);
    let ok = true, why = [];
    for (const s of rc.solutions) {
      if (s.key['9'] !== 'I' || s.key['%'] !== 'L') { ok = false; why.push('pin'); }
      if (/[QZ]/.test(s.plaintext)) { ok = false; why.push('forbid'); }
      if (!s.plaintext.includes('PEOPLE')) { ok = false; why.push('crib'); }
    }
    add('anneal: --pin, --forbid-letters, --crib WORD@any honoured', ok, `${rc.solutions.length} solutions; PEOPLE fits at ${rc.cribFeasible[0].positions.length} positions of Z408 (cycled over restarts); violations: ${why.join(',') || 'none'}`);
    const rp = await A.solve({ cipher: z, restarts: 4, iters: 60000, crib: ['ILIKEKILLINGPEOPLE@0'], quiet: true, top: 1 }, pool);
    add('anneal: --crib WORD@0', rp.solutions[0].plaintext.startsWith('ILIKEKILLINGPEOPLE'), `best starts ${rp.solutions[0].plaintext.slice(0, 30)}, accuracy ${pct(rp.solutions[0].accuracy)}`);
    // --readorder: scramble Z408 with a random permutation P (written[P[k]] = Z408[k]); reading
    // the scrambled text in order P must give Z408 back, and the solver must solve it
    {
      const zc = C.loadCipher(z);
      const rng = core.makeRng(77, 3);
      const P = Array.from({ length: 408 }, (_, i) => i);
      for (let i = P.length - 1; i > 0; i--) { const j = rng.int(i + 1); [P[i], P[j]] = [P[j], P[i]]; }
      const wr = new Array(408), wp = new Array(408);
      for (let k = 0; k < 408; k++) { wr[P[k]] = zc.text[k]; wp[P[k]] = zc.plaintext[k]; }
      const sf = path.join(os.tmpdir(), `selftest_ro_${process.pid}.json`);
      const of = path.join(os.tmpdir(), `selftest_ro_${process.pid}.txt`);
      fs.writeFileSync(sf, JSON.stringify({ id: 'z408-scrambled', ascii: wr.join(''), plaintext_aligned: wp.join('') }));
      fs.writeFileSync(of, P.map((x) => x + 1).join(' ')); // 1-based on purpose
      const back = C.applyReadOrder(wr.join(''), C.parseReadOrder(of, 408)) === zc.text;
      const rr = await A.solve({ cipher: sf, readorder: of, restarts: 16, quiet: true, top: 1 }, pool);
      add('anneal: --readorder (1-based file)', back && rr.solutions[0].accuracy > 0.9, `scrambled Z408 read back exactly: ${back}; solved with the read order: accuracy ${pct(rr.solutions[0].accuracy)}, ${rr.solutions[0].hits}/16 restarts`);
      fs.unlinkSync(sf); fs.unlinkSync(of);
    }
    pool.close();
    p1.close();
  }
  return tests;
}

/* ------------------------------------------------------------------- z408 */

async function z408(o, pool) {
  const canon = path.join(ROOT, 'data', 'ciphers', 'z408.json');
  let file = path.join(SD, 'z408_selftest.json');
  let note = 'data/ciphers/z408.json missing or without an aligned plaintext; used tools/selftest_data/z408_selftest.json (Oranchak key-visualizer transcription + aligned plaintext)';
  if (fs.existsSync(canon)) {
    try {
      const c = C.loadCipher(canon);
      if (c.plaintext && c.plaintext.length === c.text.length && c.text.length === 408) { file = canon; note = 'data/ciphers/z408.json'; }
      else note = 'data/ciphers/z408.json exists but has no 408-letter aligned plaintext; used tools/selftest_data/z408_selftest.json';
    } catch (e) { note = `data/ciphers/z408.json unreadable (${e.message}); used the self-test copy`; }
  }
  const sel = C.loadCipher(path.join(SD, 'z408_selftest.json'));
  const restarts = o.quick ? 18 : 36;
  const out = path.join(ROOT, 'results', 'selftest_z408.json');
  const t0 = Date.now();
  const r = await A.solve({ cipher: file, restarts, quiet: true, top: 5, out }, pool);
  const best = r.solutions[0];
  const zc = C.loadCipher(file);
  const res = {
    cipherFile: path.relative(ROOT, file).replace(/\\/g, '/'), note,
    command: `node tools/anneal.js --cipher ${path.relative(ROOT, file).replace(/\\/g, '/')} --restarts ${restarts} --out results/selftest_z408.json`,
    options: r.options, timeSeconds: (Date.now() - t0) / 1000,
    restarts, distinct: r.summary.distinct, bestHits: best.hits, bestHitFraction: best.hits / restarts,
    accuracy: best.accuracy,
    accuracyCeiling: ceiling(zc.text, zc.plaintext),
    accuracyCeilingNote: 'highest accuracy any single consistent key can reach against this plaintext (the published plaintext contains enciphering slips, so some symbols stand for two letters)',
    accuracyVsAzdecryptPlaintext: accuracy(best.plaintext, sel.json.plaintext_alt_azdecrypt),
    bestScore: best.score, truthScore: r.truthScore ? r.truthScore.score : null,
    plaintext: best.plaintext, words: best.words,
    passed: best.accuracy > 0.9,
  };
  log(`  Z408: best accuracy ${pct(res.accuracy)} (ceiling for a consistent key ${pct(res.accuracyCeiling)}; vs AZdecrypt plaintext ${pct(res.accuracyVsAzdecryptPlaintext)}), reached by ${best.hits}/${restarts} restarts, ${res.timeSeconds.toFixed(1)} s`);
  return res;
}

/* ------------------------------------------------------------------- z340 */

async function z340(o, pool) {
  const canon = path.join(ROOT, 'data', 'ciphers', 'z340.json');
  const un = C.loadCipher(path.join(SD, 'z340_untransposed_selftest.json'));
  const restarts = o.quick ? 18 : 36;
  const result = { canonical: null, fallback: null };
  let canonOk = false;
  if (fs.existsSync(canon)) {
    let c = null;
    try { c = C.loadCipher(canon); } catch (e) { result.canonical = { skipped: true, reason: `data/ciphers/z340.json unreadable: ${e.message}` }; }
    if (c && c.readOrder) {
      const textRO = C.applyReadOrder(c.text, c.readOrder);
      const sameAsOranchak = textRO === un.text;
      let truth = c.plaintextReadOrder;
      let truthSource = 'data/ciphers/z340.json plaintext (reading order)';
      if (truth && truth === un.plaintext) truthSource += ', identical to Oranchak z340-untransposed-pt.txt';
      if (!truth || !C.checkCandidate(textRO, truth).ok) {
        if (C.checkCandidate(textRO, un.plaintext).ok) { truth = un.plaintext; truthSource = 'Oranchak z340-untransposed-pt.txt (the canonical plaintext is missing or inconsistent)'; }
      }
      const out = path.join(ROOT, 'results', 'selftest_z340.json');
      const t0 = Date.now();
      const r = await A.solve({ cipher: canon, restarts, quiet: true, top: 5, out }, pool);
      const best = r.solutions[0];
      result.canonical = {
        cipherFile: 'data/ciphers/z340.json', readOrderUsed: true, readOrder: C.orderInfo(c.readOrder, c.text.length),
        readingOrderTextEqualsOranchakUntransposed: sameAsOranchak,
        command: `node tools/anneal.js --cipher data/ciphers/z340.json --restarts ${restarts} --out results/selftest_z340.json`,
        timeSeconds: (Date.now() - t0) / 1000, restarts, bestHits: best.hits,
        accuracy: accuracy(best.plaintext, truth), truthSource, accuracyCeiling: truth ? ceiling(textRO, truth) : null,
        plaintext: best.plaintext, words: best.words,
      };
      result.canonical.passed = result.canonical.accuracy > 0.9;
      canonOk = true;
      log(`  Z340 (canonical read order): accuracy ${pct(result.canonical.accuracy)}, ${best.hits}/${restarts} restarts, ${result.canonical.timeSeconds.toFixed(1)} s`);
    } else if (c) result.canonical = { skipped: true, reason: 'data/ciphers/z340.json has no read_order field' };
  } else result.canonical = { skipped: true, reason: 'data/ciphers/z340.json does not exist (yet) when the self-test ran' };
  if (!canonOk) log(`  Z340 canonical: SKIPPED (${result.canonical.reason})`);
  // fallback / cross-check on Oranchak's untransposed text
  const out = path.join(ROOT, 'results', 'selftest_z340_untransposed.json');
  const t0 = Date.now();
  const r = await A.solve({ cipher: path.join(SD, 'z340_untransposed_selftest.json'), restarts, quiet: true, top: 5, out }, pool);
  const best = r.solutions[0];
  result.fallback = {
    label: 'NOT the canonical file: Oranchak\'s published Z340 already in reading order (github.com/doranchak/zodiac-cipher-key-visualizer, z340-untransposed.txt), i.e. the read order is applied by the publisher, not by our tools',
    command: `node tools/anneal.js --cipher tools/selftest_data/z340_untransposed_selftest.json --restarts ${restarts} --out results/selftest_z340_untransposed.json`,
    timeSeconds: (Date.now() - t0) / 1000, restarts, bestHits: best.hits, bestHitFraction: best.hits / restarts,
    accuracy: best.accuracy, bestScore: best.score, truthScore: r.truthScore ? r.truthScore.score : null,
    plaintext: best.plaintext, words: best.words, passed: best.accuracy > 0.9,
  };
  log(`  Z340 fallback (untransposed text): accuracy ${pct(best.accuracy)}, ${best.hits}/${restarts} restarts, ${result.fallback.timeSeconds.toFixed(1)} s`);
  return result;
}

/* -------------------------------------------------------------- synthetic */

async function synthetic(o, pool, onSet) {
  const N = o.quick ? 5 : 20;
  const restarts = o.quick ? 18 : 54;
  const samp = TS.sampler(2026);
  const tmpDir = path.join(os.tmpdir(), `zodiac_selftest_${process.pid}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const solverOpts = { restarts, top: 20, wordweight: 1, quiet: true };
  const sets = [
    { name: 'zodiac63_len32', len: 32, enc: { symbols: 63, alloc: 'proportional', select: 'cycle' }, mode: 'homophonic' },
    { name: 'zodiac63_len13', len: 13, enc: { symbols: 63, alloc: 'proportional', select: 'cycle' }, mode: 'homophonic' },
    { name: 'simple_len13', len: 13, enc: { alloc: 'simple' }, mode: 'simple', enumerate: true },
  ];
  const phrases = { 32: [], 13: [] };
  for (let i = 0; i < N; i++) phrases[32].push(samp.phrase(32));
  for (let i = 0; i < N; i++) phrases[13].push(samp.phrase(13));
  const out = {
    definitions: {
      recovered: 'the top-ranked solution equals the true plaintext',
      truthInTop20: 'the true plaintext is among the 20 best distinct solutions returned',
      otherHigher: 'the top solution differs from the truth AND scores higher than the truth under the solver objective (5-gram joint score + entropy penalty 0.5 + 1.0 x wordSegment log10 P)',
      otherHigherWords: 'the top solution differs from the truth AND has a higher wordSegment log10 P than the truth',
      englishLike: 'the top solution segments into dictionary words only (0 unknown words, common vocabulary)',
      enumerateBetter: '(simple-substitution set only) number of distinct consistent strings of <=4 words from the top 10,000 words of data/lm/words_common.tsv whose wordSegment log10 P is at least the truth\'s, excluding the truth (a lower bound: more words or a larger list only add fits)',
    },
    solver: Object.assign({ n: 5, entropy: 0.5, iters: 'auto (<=20000 with the inner word term)' }, solverOpts),
    sets: {},
  };
  for (const set of sets) {
    if (o.sets && !o.sets.split(',').includes(set.name)) continue;
    const rows = [];
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const ph = phrases[set.len][i];
      const e = E.encryptText(ph.letters, Object.assign({ seed: 1000 + i }, set.enc));
      const f = path.join(tmpDir, `${set.name}_${i}.json`);
      fs.writeFileSync(f, JSON.stringify({ id: `${set.name}_${i}`, ascii: e.cipher, plaintext_aligned: ph.letters }));
      const r = await A.solve(Object.assign({ cipher: f, mode: set.mode }, solverOpts), pool);
      const best = r.solutions[0];
      const truthWs = lm.wordSegment(ph.letters);
      const truthIdx = r.solutions.findIndex((s) => s.plaintext === ph.letters);
      const row = {
        truth: ph.words, cipher: e.cipher, distinctSymbols: e.distinctSymbols, isomorph: C.isomorph(e.cipher),
        top: best.plaintext, topWords: best.words, topScore: best.score, truthScore: r.truthScore.score,
        topWordLogp: best.wordLogp, truthWordLogp: truthWs.logp,
        accuracy: best.accuracy, recovered: best.plaintext === ph.letters, truthRank: truthIdx >= 0 ? truthIdx + 1 : null,
        otherHigher: best.plaintext !== ph.letters && best.score > r.truthScore.score + 1e-9,
        otherHigherWords: best.plaintext !== ph.letters && best.wordLogp > truthWs.logp,
        englishLike: best.unknownWords.length === 0,
        distinctFound: r.summary.distinct,
        foundAboveTruth: r.solutions.filter((s) => s.score > r.truthScore.score + 1e-9).length,
      };
      if (set.enumerate) {
        // every consistent string at least as probable as the truth (by wordSegment) passes --min-logp
        const en = await EN.wordsMode({ cipher: f, mode: 'simple', 'top-words': '10000', 'max-words': '4', quiet: true, top: '200000', 'min-logp': String(truthWs.logp - 1e-6), 'max-seconds': o.quick ? '20' : '60', threads: String(Math.min(18, +o.threads || 18)) });
        const truthEnumerated = en.top.some((t) => t.plaintext === ph.letters);
        row.enumerate = {
          complete: en.counts.complete, seconds: en.timeMs.total / 1000,
          consistentStrings: en.counts.consistentStrings, truthEnumerated,
          betterThanTruth: en.counts.passingMinLogp - (truthEnumerated ? 1 : 0),
          bestEnumerated: en.top.length ? en.top[0].words : null, truthRankAmongEnumerated: truthEnumerated ? en.top.findIndex((t) => t.plaintext === ph.letters) + 1 : null,
        };
      }
      rows.push(row);
      process.stdout.write(`\r  ${set.name}: ${i + 1}/${N}`);
    }
    process.stdout.write('\n');
    const mean = (f) => rows.reduce((a, r) => a + (f(r) ? 1 : 0), 0) / rows.length;
    const summary = {
      n: rows.length, timeSeconds: (Date.now() - t0) / 1000,
      recovered: mean((r) => r.recovered), truthInTop20: mean((r) => r.truthRank != null),
      otherHigher: mean((r) => r.otherHigher), otherHigherWords: mean((r) => r.otherHigherWords), englishLike: mean((r) => r.englishLike),
      meanAccuracy: rows.reduce((a, r) => a + r.accuracy, 0) / rows.length,
      meanDistinctSymbols: rows.reduce((a, r) => a + r.distinctSymbols, 0) / rows.length,
    };
    if (set.enumerate) {
      const b = rows.map((r) => r.enumerate.betterThanTruth).sort((x, y) => x - y);
      summary.enumerate = {
        medianBetterThanTruth: b[Math.floor(b.length / 2)], minBetterThanTruth: b[0], maxBetterThanTruth: b[b.length - 1],
        incompleteRuns: rows.filter((r) => !r.enumerate.complete).length,
        zeroBetterThanTruth: rows.filter((r) => r.enumerate.betterThanTruth === 0).length,
        note: 'runs stopped by the time cap give lower bounds (complete = false in the row)',
        truthEnumeratedFraction: mean((r) => r.enumerate.truthEnumerated),
        meanConsistentStrings: rows.reduce((a, r) => a + r.enumerate.consistentStrings, 0) / rows.length,
      };
    }
    out.sets[set.name] = { description: set, summary, rows };
    log(`  ${set.name}: recovered ${pct(summary.recovered)}, truth in top 20 ${pct(summary.truthInTop20)}, different higher-scoring plaintext ${pct(summary.otherHigher)} (by word score ${pct(summary.otherHigherWords)}), English-like top ${pct(summary.englishLike)}, mean letters correct ${pct(summary.meanAccuracy)}, mean distinct symbols ${summary.meanDistinctSymbols.toFixed(1)}`);
    if (summary.enumerate) log(`    enumerate: median ${summary.enumerate.medianBetterThanTruth} English fits score at least as well as the truth (min ${summary.enumerate.minBetterThanTruth}, max ${summary.enumerate.maxBetterThanTruth}; ${summary.enumerate.incompleteRuns} runs hit the time cap, so lower bounds); truth itself enumerated in ${pct(summary.enumerate.truthEnumeratedFraction)}`);
    if (onSet) onSet(out);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return out;
}

/* ------------------------------------------------------------------- main */

async function main() {
  const o = args();
  const only = o.only ? new Set(o.only.split(',')) : null;
  const want = (k) => !only || only.has(k);
  const t0 = Date.now();
  const report = {
    tool: 'tools/selftest.js', created: new Date().toISOString(), quick: !!o.quick,
    machine: `${os.cpus()[0].model}, ${os.cpus().length} logical CPUs, Node ${process.version}`,
    command: `node tools/selftest.js${o.quick ? ' --quick' : ''}${o.only ? ' --only ' + o.only : ''}`,
  };
  const outFile = o.out || path.join(ROOT, 'results', 'selftest.json');
  // merge with an existing report when running a subset
  let prev = {};
  if (only && fs.existsSync(outFile)) { try { prev = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (e) { prev = {}; } }
  // run history: a subset run (--only) keeps the other sections of the previous report
  const sections = ['units', 'z408', 'z340', 'synthetic'].filter(want);
  report.runs = (prev.runs || (prev.created ? [{ created: prev.created, command: prev.command, sections: ['units', 'z408', 'z340', 'synthetic'].filter((k) => prev[k]) }] : []))
    .concat([{ created: report.created, command: report.command, sections }]);
  const save = () => { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(Object.assign({}, prev, report), null, 1)); };
  if (want('units')) { log('units'); report.units = await units(o); save(); }
  const threads = +o.threads || Math.max(1, os.cpus().length - 2);
  const pool = A.createPool({ threads, orders: [5] });
  if (want('z408')) { log('(a) Z408 from scratch'); report.z408 = await z408(o, pool); save(); }
  if (want('z340')) { log('(b) Z340'); report.z340 = await z340(o, pool); save(); }
  if (want('synthetic')) { log('(c) synthetic short ciphers'); report.synthetic = await synthetic(o, pool, (part) => { report.synthetic = part; save(); }); save(); }
  pool.close();
  report.totalSeconds = (Date.now() - t0) / 1000;
  const u = report.units || prev.units || [];
  report.allUnitTestsPassed = u.every((t) => t.passed);
  save();
  log(`wrote ${path.relative(ROOT, outFile)} (${report.totalSeconds.toFixed(0)} s)`);
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
