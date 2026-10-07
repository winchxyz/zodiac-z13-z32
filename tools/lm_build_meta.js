'use strict';
/**
 * Final step of the language-model build: benchmarks + sanity checks for
 * tools/lm.js, then writes data/lm/meta.json (merging ngram_stats.json,
 * words_stats.json, the corpus manifest summary and the names stats).
 *
 * Usage: node tools/lm_build_meta.js
 */
if (process.argv.slice(2).some((a) => a === '-h' || a === '--help')) {
  console.log('Usage: node tools/lm_build_meta.js\n' +
    'Benchmarks and sanity checks for tools/lm.js; writes data/lm/meta.json.\n' +
    'Needs the built tables in data/lm/ (see DATA.md).');
  process.exit(0);
}
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LM = path.join(ROOT, 'data', 'lm');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// ---------------------------------------------------------------- load timing (fresh processes)
function timeLoad(expr) {
  const code = `const t0=process.hrtime.bigint();const lm=require(${JSON.stringify(path.join(__dirname, 'lm.js'))});${expr};` +
    `console.log(Number(process.hrtime.bigint()-t0)/1e6)`;
  return +execFileSync(process.execPath, ['-e', code]).toString().trim();
}
// best of 3 fresh processes (the build machine is shared with other jobs, so single
// timings are noisy; the minimum is the least disturbed run)
const best3 = (f) => Math.min(f(), f(), f());
const loadMs = {
  ngram2to5: best3(() => timeLoad('for(const n of [2,3,4,5]) lm.table(n)')),
  ngram6: best3(() => timeLoad('lm.j6(0)')),
  words_common: best3(() => timeLoad("lm.vocab('common')")),
  words_full: best3(() => timeLoad("lm.vocab('full')")),
  dense6_build: best3(() => timeLoad('lm.dense6()')),
};
console.log('load ms', loadMs);

const lm = require('./lm');
lm.load({ six: true, words: 'common' });

// ---------------------------------------------------------------- held-out text samples
const HOLD_MOD = 50, HOLD_OFF = 25;
const lines = fs.readFileSync(path.join(LM, 'raw', 'corpus_letters.txt'), 'latin1').split('\n');
const held = lines.filter((_, i) => i % HOLD_MOD === HOLD_OFF).filter((l) => l.length > 2000);
let seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; }
function shuffle(s) {
  const a = s.split('');
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.join('');
}
function sample(len, k) {
  const out = [];
  for (let t = 0; t < k; t++) {
    const d = held[Math.floor(rnd() * held.length)];
    const st = Math.floor(rnd() * (d.length - len));
    out.push(d.substr(st, len));
  }
  return out;
}

// ---------------------------------------------------------------- JS vs Python cross-check
const ngs = readJSON(path.join(LM, 'ngram_stats.json'));
const crossCheck = {};
{
  const docs = lines.filter((_, i) => i % HOLD_MOD === HOLD_OFF && lines[i].length > 0);
  for (const n of [2, 3, 4, 5, 6]) {
    let lp = 0, L = 0;
    for (const d of docs) { if (d.length < n) continue; const r = lm.ngramScore(d, n); lp += r.logp; L += r.len; }
    crossCheck[n] = { js_heldout_perChar: lp / L, python_heldout_perChar: ngs.heldout_eval[n].heldout_perChar_log10 };
  }
}
console.log('cross-check', crossCheck);

// ---------------------------------------------------------------- English vs shuffled
const sanity = { english_vs_shuffled: {}, short_window_discrimination: {} };
{
  const passages = sample(1000, 200);
  for (const n of [2, 3, 4, 5, 6]) {
    let e = 0, sh = 0, wins = 0;
    for (const p of passages) {
      const a = lm.ngramScore(p, n).perChar;
      const b = lm.ngramScore(shuffle(p), n).perChar;
      e += a; sh += b; if (a > b) wins++;
    }
    sanity.english_vs_shuffled[n] = {
      passages: passages.length, letters_each: 1000,
      english_mean_perChar: e / passages.length, shuffled_mean_perChar: sh / passages.length,
      english_beats_its_shuffle_fraction: wins / passages.length,
    };
  }
  // how well does the model separate English from shuffled English at Z13 / Z32 lengths?
  for (const len of [13, 32, 100]) {
    const res = {};
    const ps = sample(len, 4000);
    for (const n of [2, 3, 4, 5, 6]) {
      let wins = 0, e = 0, sh = 0;
      for (const p of ps) {
        const a = lm.ngramScore(p, n).perChar;
        const b = lm.ngramScore(shuffle(p), n).perChar;
        e += a; sh += b; if (a > b) wins++;
      }
      res[n] = { english_mean_perChar: e / ps.length, shuffled_mean_perChar: sh / ps.length,
        english_beats_its_shuffle_fraction: wins / ps.length };
    }
    sanity.short_window_discrimination[len] = res;
  }
}
const segTests = {};
for (const t of ['IHOPEYOUAREHAVINGLOTSOFFUN', 'ILIKEKILLINGPEOPLEBECAUSEITISSOMUCHFUN',
  'THEMOUNTDIABLOCODECONCERNSRADIANSANDINCHESALONGTHERADIANS', 'MYNAMEIS',
  'XQZVKWJPLMRT', 'THISISATESTOFTHEEMERGENCYBROADCASTSYSTEM']) {
  const r = lm.wordSegment(t);
  segTests[t] = { words: r.words.join(' '), logp: r.logp, perChar: r.perChar, unknown: r.unknownWords };
}
const required = ('A I AN AM AS AT BE BY DO GO HE IF IN IS IT ME MY NO OF ON OR SO TO UP US WE THE AND YOU ' +
  'ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE TWENTY THIRTY HUNDRED THOUSAND FIRST SECOND THIRD ' +
  'NORTH SOUTH EAST WEST NORTHEAST SOUTHWEST RADIAN RADIANS INCH INCHES MILE MILES FOOT FEET DEGREES ' +
  'BOMB SCHOOL BUS DIABLO MOUNT DIG BURIED BUTTON MAP CODE NAME WASNT DONT IM').split(' ');
sanity.required_words_checked = required.length;
sanity.required_words_missing = required.filter((w) => !lm.isWord(w));
sanity.short_inputs = {
  'ngramScore("AB", 4)': lm.ngramScore('AB', 4),
  'ngramScore("", 4)': lm.ngramScore('', 4),
  'ngramScore("the cat!", 3) (non-letters ignored)': lm.ngramScore('the cat!', 3),
};
{
  // exhaustive check of the Viterbi search on short strings (all 2^(n-1) segmentations)
  const V = lm.vocab('common');
  const ws = (prev, w) => {
    const id = V.map.has(w) ? V.map.get(w) : -1;
    const unk = id < 0 ? lm.wordLogp(w) : 0;
    if (prev === null) return id >= 0 ? V.logp1[id] : unk;
    const pid = V.map.has(prev) ? V.map.get(prev) : -1;
    if (id < 0) return pid >= 0 ? unk + V.logBack[pid] : unk;
    if (pid < 0) return V.logp1[id];
    const r = V.big.get(pid * 1048576 + id);
    return r === undefined ? V.logBack[pid] + V.logp1[id] : Math.log10(V.lam * r + (1 - V.lam * V.s[pid]) * V.p1[id]);
  };
  let tests = 0, mismatches = 0;
  for (const s of [...sample(10, 150), ...sample(12, 50).map(shuffle)]) {
    let bestv = -Infinity;
    for (let mask = 0; mask < 1 << (s.length - 1); mask++) {
      let prev = null, v = 0, st = 0;
      for (let k = 1; k <= s.length; k++) {
        if (k === s.length || (mask >> (k - 1)) & 1) { const w = s.slice(st, k); v += ws(prev, w); prev = w; st = k; }
      }
      if (v > bestv) bestv = v;
    }
    tests++;
    if (Math.abs(lm.wordSegment(s).logp - bestv) > 1e-9) mismatches++;
  }
  sanity.viterbi_vs_bruteforce = { tests, mismatches };
  console.log('viterbi brute force', tests, mismatches);
}
const seg = segTests.IHOPEYOUAREHAVINGLOTSOFFUN.words;
sanity.wordSegment = segTests;
sanity.wordSegment_pass = seg === 'I HOPE YOU ARE HAVING LOTS OF FUN';
sanity.ngram_pass = [2, 3, 4, 5, 6].every((n) => sanity.english_vs_shuffled[n].english_beats_its_shuffle_fraction === 1 &&
  ngs.heldout_eval[n].heldout_perChar_log10 > ngs.heldout_eval[n].shuffled_perChar_log10 + 0.2);
console.log('wordSegment:', seg, sanity.wordSegment_pass, 'ngram pass', sanity.ngram_pass);

// ---------------------------------------------------------------- speed benchmarks
// every figure is the best of 3 repetitions (shared machine; see load timing above)
const bench = {};
{
  const rate = (count, fn) => {
    let bestRate = 0;
    for (let rep = 0; rep < 3; rep++) {
      const t0 = process.hrtime.bigint();
      fn();
      const sec = Number(process.hrtime.bigint() - t0) / 1e9;
      bestRate = Math.max(bestRate, count / sec);
    }
    return bestRate;
  };
  let acc = 0;
  const text = held[0].slice(0, 100000);
  const codes = lm.encode(text);
  for (const n of [2, 3, 4, 5, 6]) {
    lm.ngramSumCodes(codes, n);
    const reps = n === 6 ? 10 : 30;
    bench[`ngramSumCodes_n${n}_Mchars_per_s`] = +(rate(reps * codes.length, () => {
      for (let r = 0; r < reps; r++) acc += lm.ngramSumCodes(codes, n);
    }) / 1e6).toFixed(1);
  }
  // 6-gram lookups on random (mostly unstored) indices
  const R = 2e6;
  const idx = new Float64Array(R);
  for (let i = 0; i < R; i++) idx[i] = Math.floor(rnd() * 308915776);
  bench.j6_random_index_M_per_s = +(rate(R, () => { for (let i = 0; i < R; i++) acc += lm.j6(idx[i]); }) / 1e6).toFixed(1);
  // ngramScore object API on 340-letter strings (Z340 length)
  const strs = sample(340, 2000);
  bench.ngramScore_n5_340chars_per_s = Math.round(rate(strs.length, () => { for (const s of strs) acc += lm.ngramScore(s, 5).sum; }));
  bench.ngramScore_n6_340chars_per_s = Math.round(rate(strs.length, () => { for (const s of strs) acc += lm.ngramScore(s, 6).sum; }));
  for (const len of [13, 32, 100, 340]) {
    const ss = sample(len, len > 100 ? 200 : 1000);
    bench[`wordSegment_${len}chars_per_s`] = Math.round(rate(ss.length, () => { for (const s of ss) acc += lm.wordSegment(s).logp; }));
  }
  // last, because the 309 MB table evicts the CPU caches used by the timings above
  {
    const D = lm.dense6();
    const q = D.q;
    bench.dense6_window_sum_Mchars_per_s = +(rate(10 * codes.length, () => {
      for (let r = 0; r < 10; r++) {
        let idx = 0, sq = 0;
        for (let i = 0; i < 5; i++) idx = idx * 26 + codes[i];
        for (let i = 5; i < codes.length; i++) { idx = (idx % 11881376) * 26 + codes[i]; sq += q[idx]; }
        acc += sq;
      }
    }) / 1e6).toFixed(1);
    let maxErr = 0;
    for (let i = 0; i < 1e6; i++) {
      const k = Math.floor(rnd() * 308915776);
      const v = lm.j6(k);
      if (v >= D.min) maxErr = Math.max(maxErr, Math.abs(D.min + q[k] * D.step - v));
    }
    bench.dense6_max_abs_quantisation_error_log10 = maxErr;
  }
  void acc;
}
console.log('bench', bench);

// ---------------------------------------------------------------- assemble meta.json
const ws = readJSON(path.join(LM, 'words_stats.json'));
const man = fs.readFileSync(path.join(LM, 'corpus_manifest.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const tiers = {};
const decades = {};
const shelves = {};
for (const r of man) {
  const [tier, , birth, letters, , , bs] = r;
  tiers[tier] = tiers[tier] || { texts: 0, letters: 0 };
  tiers[tier].texts++; tiers[tier].letters += +letters;
  const dk = `${Math.floor(+birth / 10) * 10}s`;
  decades[dk] = (decades[dk] || 0) + +letters;
  const key = /Science-Fiction|Science Fiction/.test(bs) ? 'science fiction' : /Crime|Detective|Mystery/.test(bs) ? 'crime/mystery'
    : /Western|Adventure/.test(bs) ? 'adventure/western' : /Novels|Short Stories|American Literature|Humour|Romance/.test(bs) ? 'general fiction' : 'other/unshelved';
  shelves[key] = (shelves[key] || 0) + +letters;
}
const letterEntropy = -Object.values(ngs.letter_freq).reduce((a, p) => a + p * Math.log10(p), 0);
const totalLetters = man.reduce((a, r) => a + +r[3], 0);
const pct = (x) => `${(100 * (x || 0) / totalLetters).toFixed(1)}%`;
const prevMeta = fs.existsSync(path.join(LM, 'meta.json')) ? readJSON(path.join(LM, 'meta.json')) : {};
const meta = {
  description: 'English language data for the Zodiac Z13/Z32 solvers. Load with tools/lm.js.',
  built: new Date().toISOString(),
  build_commands: [
    'python tools/lm_build_corpus.py --download --build',
    'python tools/lm_build_ngrams.py',
    'python tools/lm_build_words.py',
    'python tools/lm_build_names.py',
    'node tools/lm_build_meta.js',
  ],
  corpus: {
    source: 'Project Gutenberg plain-text e-books (catalog https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv; files from the robot mirror http://aleph.gutenberg.org as linked by https://www.gutenberg.org/robot/harvest)',
    selection: 'Language en, Library of Congress class PS (American literature), not Poetry/Plays; tier A = first author born 1880-1945 (max 6 texts per author), tier B = born 1850-1879 (max 5 per author); random order with fixed seed; Gutenberg header/footer and short transcriber/copyright lines removed; NFKD accents folded; A-Z only.',
    manifest: 'data/lm/corpus_manifest.tsv',
    texts: man.length,
    letters_total: man.reduce((a, r) => a + +r[3], 0),
    tiers,
    letters_by_author_birth_decade: decades,
    letters_by_genre_shelf: shelves,
    train_letters: ngs.train_letters,
    heldout_letters: ngs.heldout_letters,
    heldout_rule: 'documents with manifest row index % 50 == 25 are excluded from the tables and used only for evaluation',
    caveat: `All fiction-shelved prose: science fiction ${pct(shelves['science fiction'])}, adventure/western ${pct(shelves['adventure/western'])}, crime/mystery ${pct(shelves['crime/mystery'])}, general fiction ${pct(shelves['general fiction'])}, unshelved ${pct(shelves['other/unshelved'])} of letters. Most texts by authors born after 1900 are 1950s-60s American magazine stories that Project Gutenberg's transcriber notes describe as having no renewed US copyright. No newspaper or private-letter text is included; Zodiac letters (Z408/Z340 plaintexts) are not in the corpus.`,
  },
  ngrams: {
    alphabet: 'A..Z = 0..25',
    index: 'index(c_0..c_{n-1}) = sum c_i * 26^(n-1-i)',
    value: 'joint log10 P(c_0..c_{n-1}); dense tables of order n sum to 1 over all 26^n entries',
    smoothing: 'interpolated modified absolute discounting (three discounts D1, D2, D3+ per order, D estimated from count-of-counts as in Chen & Goodman 1998), recursively interpolated down to an add-one unigram; joint values built by the chain rule J_n(hc) = J_{n-1}(h) + log10 P_n(c|h), so log10 P_n(c|h) = J_n(hc) - J_{n-1}(h) exactly',
    files: {
      'ngram1.bin .. ngram5.bin': 'dense little-endian Float32, 26^n entries',
      'ngram6.keys.bin': `sorted little-endian Uint32 indices of the stored 6-grams (count >= ${ngs.keep6} in training)`,
      'ngram6.vals.bin': 'little-endian Float32 joint log10 P for each key',
      'ngram6.gamma.bin': `dense little-endian Float32, 26^5 entries: G6(h) = log10 of the backoff weight gamma_6(h) of 5-letter history h (0 for histories never seen in training)${ngs.keep6 > 1 ? '; the mass of pruned 6-grams is folded in' : ''}`,
    },
    dense6: 'tools/lm.js dense6() builds (in memory, not on disk) a 26^6-byte Uint8Array q with q[idx] = round((J6 - min)/step), min = -24, step = 21/255 (~0.082), values below -24 clipped; decode J6 ~= min + q*step. Optional SharedArrayBuffer for worker_threads. About 8x faster than j6() for window sums.',
    ngram6_unseen: 'J_6(h c) = J_5(h) + G6(h) + J_5(g[1..5]) - J_4(g[1..4]) for any 6-gram g = h c not stored (exact under the model; tools/lm.js j6() does this)',
    ngram6_floor_constant: ngs.orders[6].floor_constant,
    ngram6_floor_note: 'If a solver insists on a single constant for unstored 6-grams, use ngram6_floor_constant = log10(0.01 / number of training 6-gram windows); the exact backoff above is preferred and is what tools/lm.js uses.',
    per_order: ngs.orders,
    heldout_eval: ngs.heldout_eval,
    letter_frequencies: ngs.letter_freq,
  },
  words: {
    sources: {
      'count_1w.txt / count_2w.txt': 'Peter Norvig, https://norvig.com/ngrams/ (derived from the Google Web 1T 5-gram corpus, LDC2006T13); copied from his repository https://github.com/norvig/pytudes/tree/main/data/text because norvig.com serves a JavaScript bot check to scripts. count_1w.txt: 4,956,241 bytes, md5 1710e1aa36917a32ba8cee42acf8af4f (norvig.com/ngrams lists it as 4.9 MB); count_2w.txt: 5,566,017 bytes, md5 44766e613c3750f952b7861ca54a3e49 (size on norvig.com not cross-checked because of the bot check).',
      totals: 'N tokens = 1,024,908,267,229 and N sentences = 95,119,665,584 (https://catalog.ldc.upenn.edu/LDC2006T13)',
    },
    files: {
      'words.tsv': `WORD<TAB>count, every all-letter entry of count_1w upper-cased (${ws.words_tsv} rows)`,
      'bigrams.tsv': `W1<TAB>W2<TAB>count from count_2w, upper-cased and case-merged, A-Z words or <S> (sentence start) only (${ws.bigrams_tsv} rows)`,
      'words_common.tsv': `WORD<TAB>count curated vocabulary (${ws.words_common} rows): top ${ws.top_k} count_1w words that pass a junk filter (1-letter: A, I; 2-letter: whitelist; no valid Roman numerals except I/MIX; >=3 letters must contain a vowel (whitelist MRS, HMM, ...) and occur >= ${ws.min_gutenberg_count} times in the Gutenberg corpus), plus forced words (numbers, directions, map/measure words, contractions without apostrophes, Zodiac-case vocabulary) and the 400 most frequent Gutenberg words that pass the filter`,
      'words_stats.json': 'parameters read by tools/lm.js (p_oov, OOV length distribution, bigram lambda)',
    },
    forced_added: ws.forced_added,
    forced_missing_from_norvig: ws.forced_missing,
    model: {
      unigram: 'P1(w) = (1 - p_oov) * count(w) / (sum of vocabulary counts)',
      unknown: `P_unk(w) = p_oov * P_len(|w|) * prod_i P_letter(w_i) with P_letter = order-1 letter model; p_oov and P_len (add-0.5 smoothed, lengths 1..30, geometric 0.8 tail) measured on the Gutenberg corpus tokens missing from the vocabulary. This is a proper distribution over all strings and penalises an unknown word by about ${letterEntropy.toFixed(3)} log10 units per letter on average (the letter entropy) plus the OOV overhead log10 p_oov + log10 P_len, so known words win whenever they explain the text.`,
      bigram: 'P(w2|w1) = lam * c2(w1 w2)/c1(w1) + (1 - lam * s(w1)) * P(w2), s(w1) = sum over listed bigrams of c2(w1 .)/c1(w1), c1(<S>) = N sentences; lam tuned on held-out Gutenberg word pairs',
      params: ws.params,
    },
  },
  names: fs.existsSync(path.join(ROOT, 'data', 'names', 'names_stats.json'))
    ? { readme: 'data/names/README.md', stats: readJSON(path.join(ROOT, 'data', 'names', 'names_stats.json')) } : null,
  load_ms: loadMs,
  benchmark: bench,
  benchmark_machine: `${require('os').cpus()[0].model} (${require('os').cpus().length} logical CPUs, shared with other jobs during the build), Node ${process.version}, single thread, best of 3`,
  sanity: { ...sanity, js_python_crosscheck: crossCheck },
  extra: prevMeta.extra,
};
fs.writeFileSync(path.join(LM, 'meta.json'), JSON.stringify(meta, null, 2));
console.log('wrote data/lm/meta.json');
