# English language data for the Zodiac solvers

Full documentation is in `meta.json`. It covers sources, formulas, held-out evaluation,
sanity checks and speeds. This page is the quick reference.

## Use from JavaScript (`tools/lm.js`, CommonJS)

Each table loads lazily the first time a function needs it.

```js
const lm = require('../tools/lm');           // path relative to your script

lm.ngramScore('IHOPEYOUAREHAVINGLOTSOFFUN', 5);
// -> {n, len, windows, sum, perWindow, logp, perChar}
//    sum/perWindow: sum of joint log10 P over the overlapping windows (classic solver fitness)
//    logp/perChar:  log10 P(text) under the order-n Markov chain (use perChar to compare lengths)
lm.ngram6Score(text);                         // the same with n = 6, exact backoff for unseen 6-grams
lm.wordSegment('IHOPEYOUAREHAVINGLOTSOFFUN'); // {words:['I','HOPE',...], logp, perChar, unknown, unknownWords}
lm.wordSegment(text, { vocab: 'full', sentenceStart: true, maxUnknownLen: 20 });
lm.wordLogp('RADIANS');                       // log10 unigram probability (spelling model if unknown)
lm.isWord('DIABLO');                          // true; checks words_common.tsv ({vocab:'full'} for words.tsv)

// fast paths for hill-climbing
const codes = lm.encode('SOMETEXT');          // Uint8Array, A=0 .. Z=25
lm.ngramSumCodes(codes, 4);                   // window sum, no allocation
const J4 = lm.table(4);                       // dense Float32Array, 26^4 joint log10 P
const C4 = lm.condTable(4);                   // dense Float32Array, log10 P(c3 | c0 c1 c2)
lm.j6(idx);                                   // joint log10 P of a 6-gram index, exact backoff
const D = lm.dense6({ shared: true });        // optional 309 MB byte table: J6 ~= D.min + D.q[idx]*D.step
```

The 6-gram index is `idx = sum c_i * 26^(5-i)`. To roll it forward one letter, use
`idx = (idx % 26**5) * 26 + c`.

## Files

| File | Format |
|---|---|
| `ngram1.bin` … `ngram5.bin` | dense little-endian Float32, 26^n entries, joint log10 P(n-gram) |
| `ngram6.keys.bin` | sorted little-endian Uint32 indices of every 6-gram seen in training (4,233,150) |
| `ngram6.vals.bin` | little-endian Float32 joint log10 P for each key |
| `ngram6.gamma.bin` | dense Float32, 26^5 entries: log10 backoff weight G6 of each 5-letter history |
| `words.tsv` | `WORD<TAB>count`, all of Norvig's count_1w (333,333 rows) |
| `bigrams.tsv` | `W1<TAB>W2<TAB>count` from count_2w (`<S>` = sentence start) |
| `words_common.tsv` | `WORD<TAB>count`, curated 60,006-word vocabulary |
| `words_stats.json`, `ngram_stats.json` | build parameters and statistics (read by lm.js / merged into meta.json) |
| `corpus_manifest.tsv` | the 870 Project Gutenberg texts in the corpus (tier, id, author birth year, letters, author, title) |
| `raw/` | downloads and intermediate files; rebuildable, safe to delete except for reproducing the build |

**6-grams the table does not store.** The value is exact under the model:

```
J6(g) = J5(g[0..4]) + G6(g[0..4]) + J5(g[1..5]) - J4(g[1..4])
```

If you want a single constant floor instead, use `meta.json → ngrams.ngram6_floor_constant`.

**Reading the tables from Python:**

```python
np.fromfile('data/lm/ngram5.bin', '<f4')
np.fromfile('data/lm/ngram6.keys.bin', '<u4')
```

## Rebuild

```
python tools/lm_build_corpus.py --download --build   # ~25 min of polite downloading, then ~4 min
python tools/lm_build_ngrams.py                      # ~1 min; needs several GB of RAM (order-6 counts alone are 2.5 GB)
python tools/lm_build_words.py
python tools/lm_build_names.py
node tools/lm_build_meta.js                          # benchmarks + sanity checks -> meta.json
```
