# Z13 and Z32: what an exhaustive computational attack can and cannot say

Final project report, 2026-10-07. Machine-readable summaries: `results/summary.json` (the eight attack tasks) and `results/lead/decision/numbers.json` (the Z340-key lead). `results/summary.json` was written before the lead workflow finished; where the two disagree, this report and `results/lead/DECISION.md` take precedence (Appendix C).

This report covers the two unsolved Zodiac ciphers: Z13, the 13-symbol "My name is" cipher (letter of April 20, 1970), and Z32, the 32-symbol Mt. Diablo cipher (letter of June 26, 1970). The two solved Zodiac ciphers, Z408 and Z340, served only as calibration data. Eight attack tasks ran, and each was checked by an independent adversarial reviewer who reran its key computations. A follow-up workflow (`results/lead/`) then tested the project's one candidate signal with a pre-registered replication, three independent skeptic reviews, a look-elsewhere test of the TORPEDO completions and a prior-art search; its verdict is in `results/lead/DECISION.md`. Where a reviewer corrected a number, this report uses the corrected number, and no claim is rated higher than its reviewer rated it.

Labels used throughout:
- **computed**: produced by a script in `tools/` and reproduced by a reviewer, unless stated otherwise;
- **assumed**: a modelling choice the result depends on;
- **judgement**: an interpretation that no statistic can make for us.

---

## What this project is and is not

**It is** an exhaustive, reproducible computational analysis of Z13 and Z32, and its results are negative:
- every script is in `tools/` and every output in `results/` (§9);
- every attack was rerun by an adversarial reviewer, and the one candidate signal was re-tested under a protocol fixed in advance;
- what it produces is measured fit rates, calibrations, null comparisons and an audit of published proposals.

**It is not** a solution of either cipher. No string in this report is offered as what Z13 or Z32 says, and every candidate listed is unsupported or refuted.

**Nothing here identifies the Zodiac or a bomb location.** Names were tested only to measure how often names fit; a name that fits the pattern says nothing about that person. The map work tests published instructions geometrically; no point on or off the map is supported as a bomb site.

**It is not a set of new discoveries either.** The prior-art search found that the ideas behind most results had been published before. The project's own decision is that nothing here clears the bar of a genuinely new finding; the few things that may be called new are listed, in fixed wording, in §7.1.

---

## 1. Bottom line

**Neither cipher is solved, and this project found no candidate text for either that beats a fair null model.** Every published proposal we could test is either incompatible with the cipher or indistinguishable from chance. This is a negative result, and the numbers below explain why it is the expected one.

What we can claim:

1. **The ciphers are too short to pick out an answer from the symbols alone (computed).**
   - About 1 English 13-letter window in 2.1 million fits Z13's repeat pattern. A 13-letter English text carries roughly 34 bits by our language model, and the pattern removes only about 21. That leaves thousands of fitting English strings, and tens of thousands to millions of fitting personal names.
   - About 1 English 32-letter window in 3,800 to 5,400 fits Z32. Between 10^6 and 10^19 English texts fit it, depending on how predictable the underlying text is assumed to be.
   - No amount of extra computing changes this. The limit is information, not search.
2. **Z13 is probably not an ordinary English phrase under plain substitution with no errors (computed, plus a judgement).**
   - If it were, calibration says its true text would very likely be among the few dozen most fluent fits. Those fits are fragments and word salad (A DEFINITIVE AT, ON THE DEFEAT OF, IN THE DESERT IS).
   - This disfavours that one hypothesis. It leaves open a name, an enciphering slip, null symbols, a transposition, or a non-English text.
3. **Z13's repeat pattern is not what Zodiac's usual keys and habits produce (computed; the strength depends on the model).**
   - One symbol appears three times in five positions, and only 8 different symbols appear in 13 positions. No 5-symbol stretch of the 748 solved symbols repeats a symbol three times. (Oranchak showed in 2012 that no window of Z408 shorter than 22 symbols, or of Z340 shorter than 15 in written order, is as repetitive as Z13.)
   - Real phrases enciphered with Zodiac-style 54- or 63-symbol cycling keys never reproduced either feature (0 of 20,000).
   - Depending on the model, the pattern favours a key with mostly one symbol per letter by roughly 100:1 to 6,000:1. An independent check with the real Z340 homophones points the same way (§4.5).
   - Either Z13 used a different kind of key, or the circled letter was one Zodiac gave a single symbol, or the three circles are three different symbols.
4. **One statistical curiosity, which does not hold up (computed; `results/lead/`; §4.4).**
   - With the Z340 key's letters on Z13's six shared symbols, the best completions are slightly more English-like than with random key letters. A pre-registered replication with fresh code gives p about 0.01-0.015 per test (0.0147 for the primary 6-gram test, 0.0096 for the word statistic) and 0.039 family-wise over its 12 tests.
   - It fails the replication's own negative control: Zodiac's unrelated Z408 key does about as well on the n-gram statistics (p = 0.026 and 0.022). A frequency-free test, the real six letters against all 360 rearrangements of themselves, gives 0.144 family-wise.
   - It is not significant at project level under any accounting (Šidák over the project's 51 analyses: 0.23 for the original 0.0051, 0.87 for the replicated 0.039). All three skeptic reviews independently reached "refuted" for key reuse.
   - The TORPEDO completions need the circles to be different symbols, which no published transcription asserts. They are not the top completion, and random keys produce comparable text; after look-elsewhere they are worth a likelihood ratio of only 1.9-3.9. They carry no weight.
   - It is a statistical curiosity, not evidence of key reuse, and no completion means anything. Reading Z13 with the Z340 key is not ours: Garlick, Ziraoui, Marclean and T.C. did it first.
5. **Nothing on the Mt. Diablo map singles out a location (computed).**
   - The mailed map piece has two properties that matter for every radians-and-inches interpretation. Both were published before, most precisely by shaqmeister (forum, 2026-05-12); we confirm them independently:
     - true north is about 4.6 degrees clockwise of the map's up direction;
     - its printed scale bar is about 9% too long for the geography (7.0-7.2 ground miles per paper inch; shaqmeister: 7.02).
   - Several published instructions point off the piece Zodiac mailed.
   - Gareth Penn's "one radian" is 60.3 degrees.
   - The only tight coincidence, Lake Herman Road at one radian from magnetic north, was noted before (zodiackillerfacts.com illustration, about 2011; Hodel 2010; Grinell; DMW 2019). It is post hoc. Its chance probability is 0.01 to 0.33, depending on how many alternatives one admits.

What we cannot claim: an identity, a bomb location, evidence of key reuse, or evidence about whether Z32 shares a key with Z13 or with the solved ciphers. With 13 + 32 symbols, the joint-key question cannot be tested by the methods available (0 of 5 synthetic shared-key pairs were detected).

What would settle it (§8): more ciphertext under the same key, Zodiac's worksheets or key sheets, an outside source text, or higher-resolution images of the originals. Higher-resolution images bear directly on whether Z13's three circles are one symbol.

---

## 2. The ciphers

### 2.1 Verified transcriptions

All four files use David Oranchak's ASCII convention (the one in his webtoy, Cipher Explorer and AZdecrypt). In it, `z` is the crosshair, `0` the circled glyph of Z13, `[` an upside-down T whose base hooks up at the right, `?` an omega, `|` a plain vertical bar, `8` the filled triangle, `9` the open triangle, and lower-case letters are mirror-reversed letters.

```
Z13  AENz0K0M0[NAM        13 symbols, 8 distinct, pattern abcdefegehcag
Z32  C9J|#Ok[AMf8?ORTG    row 1, 17 symbols
     X6FDVj%HCELzPW9      row 2, 15 symbols; 29 distinct
```

- Z13 repeats: `0` at positions 4, 6, 8; `A` at 0, 11; `N` at 2, 10; `M` at 7, 12 (0-based).
- Z32 repeats: `C` at 0, 25; `O` at 5, 13; `9` at 1, 31. Every other Z32 symbol occurs once.
- Z13 and Z32 share the symbols `A E M z [`. Z13's `K` is a normal K; Z32's `k` is a different, reversed glyph.

The certification step checked every glyph by eye against magnified scans (`data/ciphers/README.md`, "Certification"):

| cipher | images checked (in `data/images/`) | result |
|---|---|---|
| Z13 | `z13_letter_1970-04-20_p1_commons.gif` (binarized 640x829, the best scan found); `z13_glyphs_magnified_from_commons.png`; `z13_letter_1970-04-20_p1_zkf.jpg` (colour, 407x576); `z13_letter_top_zodiackillerciphers.jpg` (colour, 657x262) | same 13 glyphs in every image; no published source disagrees on symbol identity or order |
| Z32 | `z32_letter_1970-06-26_color_commons.jpg`; `z32_letter_1970-06-26_zodiackiller.png`; `z32_letter_1970-06-26_police_photo_zkc.jpg` (SFPD photo, 5100x7014); also `z32_letter_1970-06-26_color_hires_zkc.jpg` | same 17 + 15 symbols in all three independent images |
| shared glyphs | Commons colour photo of Z340; Oranchak's combined Z408/Z340 key image | Z32 position 23 is `%` (open triangle at upper left); position 22 is the backward J `j`; Z13 position 9 and Z32 position 7 are the same hooked glyph `[`, which differs from the plain Z340 `t`; Z32 position 3 is the plain bar `|`, not the serifed Z408 `I` |
| map and later letter | `z32_map_1970-06-26_large_zkf.jpg`, `z32_map_1970-06-26_zodiackiller.png`, `z32_letter_and_map_1970-06-26_commons.jpg`, unmarked exemplar `z32_map_phillips66_*_zkf.jpg`, July 26 letter `z32_little_list_letter_1970-07-26_p2/_p5_zodiackiller.png` | used for the map geometry (§5.6) |

### 2.2 Open transcription questions and the variants we ran

Every alternative transcription was run as its own cipher. Most have a file `data/ciphers/variants/<id>.txt`; `z13.letters_literal` is the canonical file run with pinned letters (`--pin`), and `z32.reversed` is generated by the scripts that use it (`tools/keyprior_lib.js`, `tools/audit_make_ciphers.js`). Plausibility is our judgement from the images.

| id | string | what changes | plausibility | effect on our conclusions |
|---|---|---|---|---|
| `z13.canonical` | `AENz0K0M0[NAM` | default | default | |
| `z13.circles_distinct` | `AENz0K{M}[NAM` | the three circles are three different symbols | low | about 500 times easier to fit (1 in 4,000 English windows); 1 name in 15 to 40 fits with 2 filler letters; makes every Z13 test less informative |
| `z13.crosshair_null` | `AEN0K0M0[NAM` | crosshair is a signature or null (12 symbols); also tried as a word break | low | similar to canonical; as a word break it removes most name fits but not all |
| `z13.bracket_is_perp` | `AENz0K0M0tNAM` | `[` is the plain upside-down T | medium | same pattern as canonical; matters only for key carry-over (Z408 R, Z340 L) |
| `z13.reversed` | `MAN[0M0K0zNEA` | read right to left | low | fit counts similar to canonical |
| `z13.letters_literal` | canonical, with A, E, N, K, M pinned to themselves | the letter glyphs stand for themselves | low | no English word sequence fits by simple substitution; no real name fits without forced filler letters |
| `z32.canonical` | `C9J\|#Ok[AMf8?ORTGX6FDVj%HCELzPW9` | default | default | |
| `z32.triangles_merged` | open and filled triangles one symbol | adds a fourth repeat | low | about 3.6 more bits of constraint; no change in conclusions |
| `z32.bar_is_serif_I`, `z32.t2_is_perp`, `z32.bar_I_and_t2_perp`, `z32.tau_distinct` | glyph identities at positions 3, 7, 22 | same repeat pattern as canonical | low to medium | matter only for key carry-over; every carry-over test has p >= 0.28 (§5.5) |
| `z32.reversed` | read right to left | | low | no change |

The README in `data/ciphers/` agrees with the task brief on every foundation fact. Two foundation statements needed qualification after review:
- The brief's self-test summary, that the solver "always returns different English that scores higher than the truth", holds only for its default objective (§3.3).
- `research/z13_literature.md` and `research/keys_methods.md` label Oranchak's "1 in 12 million" as a strict-substitution figure. It is the uniform-letter homophonic figure, 26^-5 (§3.4).

---

## 3. Why short ciphers resist

### 3.1 The information budget (computed; `results/nullmodel/`)

A substitution cipher hides the letters but keeps the pattern of repeats. If a symbol occurs twice, the same letter occurs twice. That pattern is all the information a short cipher offers, and it can be measured. We slid a window over 114 million letters of American fiction (1850-1945) and counted how many real English windows have the pattern. We then compared that count with how much information an English text of the same length carries.

| quantity | Z13 (canonical) | Z32 (canonical) |
|---|---|---|
| length, distinct symbols | 13, 8 | 32, 29 |
| English windows that fit, homophonic (repeated symbols = same letter) | 53 of 112,021,522 = 1 in 2.1 million | 29,475 of 112,005,315 = 1 in 3,800 (other corpora: 1 in 4,465 to 1 in 5,361) |
| English windows that fit, strict (also different symbols = different letters) | 12 = 1 in 9.3 million | impossible: 29 symbols, 26 letters |
| constraint removed by the pattern | 21.0 bits homophonic (95% CI 20.6-21.4), 23.2 strict | 11.9 bits |
| information in an English window of that length (6-gram model, held-out text) | 34.0 bits (31.1 word-aligned) | 76.2 bits (73.4 word-aligned) |
| key entropy | 37.6 bits | 136.3 bits |
| Shannon unicity distance (from `research/keys_methods.md`) | 10-22 symbols | 37-80 symbols |

**Expected number of English strings that fit**, 2^(information - constraint), for several assumptions about how predictable the underlying text is (homophonic):

| assumption about the underlying text | Z13 | Z32 |
|---|---|---|
| 6-gram model, any window | about 7,900 | about 2.3 x 10^19 |
| 6-gram model, word-aligned (reviewer-corrected) | about 1,500 (range 420-4,000) | about 2.6 x 10^18 |
| 2.2 bits per letter | about 190 | about 4 x 10^17 |
| 1.3 bits per letter (redundancy of long running text) | about 0.06 | about 9 x 10^8 |
| 1.0 bits per letter | about 0.004 | about 1 x 10^6 |

What this means:
- **Z13** would have a unique meaningful fit only if its true text were as predictable as long running English text. A name or an isolated phrase is not that predictable. Under simple substitution the figures are about four times smaller (about 1,800 at 6-gram, about 390 word-aligned).
- **Z32** has at least a million fitting English texts under the most generous assumption.
- **The exact positions of the repeats are not unusual.** 42% of random rearrangements of Z13's symbols, and 25% of random 3-pair patterns for Z32, are fitted by English at least as often as the real ciphers.

### 3.2 The empirical unicity curve (computed; `results/nullmodel/lengthscan*`, reviewer reruns in `results/nullmodel/review/`)

We encrypted held-out English of various lengths and asked our annealing solver to recover it.

| length | simple key, exact recovery, default objective | simple key, 6-gram likelihood objective (reviewer) | Zodiac-style 63-symbol cycling key |
|---|---|---|---|
| 13 | 1/12 | 4/12 (Wilson 95% CI 14-61%) | 0/12 (degenerate: no repeated symbols) |
| 20 | 0/12 | 1/12 | 0/12 (degenerate) |
| 32 | 8/12 | 9/12 | 0/12 (9 of 12 had no repeats) |
| 50 | 10/12 | | 0/12 |
| 75 / 100 | 8/10, 8/10 | | 0/10, 0/10 |
| 150 / 200 | 10/10, 10/10 | | 0/10, 0/10 (2/10 at least 90% letters right at 200) |
| 340 | 10/10 | | 5/10 exact, 10/10 at least 90% right |

- Simple-substitution ciphers become reliably solvable at about 30-50 letters.
- Zodiac-style homophonic ciphers need about 200-340 letters.
- The short Zodiac-style points (13 to 32 letters) are uninformative. Our encryptor gave homophones only to letters present in each synthetic text, so those synthetic ciphers had no repeats at all (a reviewer finding).
- The valid comparison for Z32 is the exact-pattern null below: 0 of 12 recovered.

### 3.3 A solver only sees the pattern (computed)

A homophonic solver's output depends only on the cipher's repeat pattern, not on what the symbols look like. Relabelling Z32's symbols gives an identical result with the same seed. So for every text that fits Z13's pattern, the solver returns the same answer:
- For Z13 with the default objective, that answer is IN THE RESENT IS. It came back for all 20 synthetic ciphers with Z13's exact pattern, each built from a different true text.
- For Z32 it scored above the true text in 12 of 12 synthetic cases.

The reviewers showed that this "the solver always beats the truth" behaviour belongs to the default objective (joint 5-gram score plus a word term), which is not a likelihood. With the 6-gram likelihood as objective:
- the same solver recovers 4 of 12 13-letter simple-substitution phrases;
- it returns IN THE DESERT IS for Z13 under strict substitution;
- 10 of 11 strict corpus truths outrank the default-objective answer.

**Consequence.** Under the narrow hypothesis "Z13 is a fluent English phrase in strict substitution", Z13 sits at the edge of solvability rather than far below it. That is why the calibration in §4.3 has teeth.

### 3.4 Earlier published numbers, reproduced (computed)

- **Oranchak's "about 1 in 12 million"** (2013) is 26^8 / 26^13, the chance that 13 uniformly random letters fit the homophonic pattern. It is not a strict-substitution figure. Real English fits 5.6 times more often (1 in 2.1 million).
  - His alternative figure from letter-repetition probabilities, 1 in 670,000, matches our independent-letters figure (1 in 687,000).
  - The z13names task quoted a strict independent-letters baseline of 1 in 10.8 million as "agreeing" with him; that agreement is a coincidence of two different quantities.
- **His 213 name fits in about 0.5 billion tests** match our rate for FIRST LAST names in homophonic mode: 4.8 x 10^-7, about 1 in 2.08 million. A fit count is simply the number of tests times this rate.
- **His word counts** (283 two-word and 1,283,443 three-word fits, from a dictionary of about 150,000 words) fall inside our list-dependent range. The fit rate per candidate tuple, about 3-4 x 10^-7, is what agrees:

  | word list | two-word fits | three-word fits |
  |---|---|---|
  | common words, 59,000 | 113 | 362,906 |
  | Gutenberg, 125,000 | 421 | 1,719,786 |
  | Web 1T, 322,000 | 4,772 | 114,491,125 |

  His fits were homophonic, which his SARAH THE HORSE example confirms.

---

## 4. Z13

### 4.1 Is it a personal name? (`results/z13names/`; reviewed, reproduced exactly)

**Method (computed).** We enumerated every way to fit Z13 with a name built from US name lists: SSA first names for births 1900-1955 and Census surnames. The search covered:
- the patterns FIRST LAST, FIRST INITIAL LAST, FIRST MIDDLE LAST, FIRST INITIAL INITIAL LAST, INITIAL INITIAL LAST and LAST FIRST, plus nicknames;
- male and female lists;
- 0 to 2 free filler letters at the ends;
- all six transcription variants, in both simple and homophonic mode.

An independent dynamic program written by the reviewer matched all 416 exhaustive cells exactly.

**Too many names fit.** Canonical cipher, no filler letters (male / female lists):

| pattern | strict (simple substitution) | homophonic |
|---|---|---|
| FIRST LAST | 6 / 44 | 72 / 321 |
| FIRST INITIAL LAST | 208 / 234 | 1,494 / 2,958 |
| FIRST MIDDLE LAST | 9,723 / 51,521 | 72,182 / 367,670 |
| FIRST INITIAL INITIAL LAST | 4,142 / 11,454 | 33,725 / 76,049 |
| LAST FIRST | 12 / 3 | 56 / 87 |

- With 0-2 filler letters the totals reach 5.6 to 69 million.
- Under `circles_distinct` (exact count), 2.5-6.4% of all names fit homophonically once 2 fillers are allowed.

**No suspect fits.**
- We tested 36 suspects and other named people through 386 renderings of their names. Nobody fits the canonical, bracket, reversed, crosshair or letters-literal transcriptions, in either mode, even with 2 fillers.
- The only fits are 5 renderings under `circles_distinct` in homophonic mode, each needing 1-2 forced fillers: EARL V BEST JR, JOSEPH MYERS, GEORGE HODEL, JUAN V CORONA and KEN KAUFFMAN. Matched random names fit at the same rate: 5 observed against 5.48 expected, p = 0.69.
- The reviewer added a one-enciphering-slip allowance. Only two names then fit the canonical transcription: ALFRED E NEUMAN and JUAN V CORONA. Both entered the list because someone had already fitted them to the cipher. Excluding names chosen that way, no suspect fits any transcription other than `circles_distinct` even with a slip, against a chance expectation of 0.2-0.9.
- A caveat on power: under the canonical transcription chance predicts only 0.015 fitting suspects, so a test that finds none had little power to begin with.
- Prior art: Quicktrader (2021, about 30,000 names) and Stampher (2026, about 31,000 Vallejo names) found no fits; many single suspects were checked before (§7.4).

**The pattern gives a name no support.**
- A name drawn from the census prior fits the canonical pattern no more often than a random string of English letters does; in canonical homophonic mode it fits 2.4 to 861 times less often.
- Under some other transcriptions, names fit slightly more often than letters, so the robust statement is just "no support".
- Top-ranked names (EDDIE RESENDES, CARL BOB ABARCA, MARY LULA LERMA, AMY HELENE RYAN, CHASTITY TRACY, DONALD LYLE NGO when reversed) change with every variant, mode, sex list and pattern.
- Their large within-pattern shares come from a lopsided prior over a few fits. EDDIE RESENDES's 0.93 drops to about 0.58 once names missing from the lists are allowed for.

### 4.2 Is it an English phrase? (`results/z13phrases/`; reviewed, reproduced exactly)

**Search (computed).** We enumerated every sequence of up to 5 words from a 60,006-word common vocabulary that fits Z13. This space contains every one of 2,002 above-median real 13-letter phrases in a held-out coverage test.

**How many good fits (canonical):**

| mode | consistent strings | at or above the real-phrase median | at or above the 75th percentile | at or above the 90th percentile |
|---|---|---|---|---|
| simple | 25,761,330 | 22 (24 with a deduplicated reference) | 1 | 0 |
| homophonic | 148,816,201 | 64 (69) | 3 (4) | 0 |

- The best fits are A DEFINITIVE AT, ON THE DEFEAT OF and IN THE DESERT IS (simple), and SOUTH THE HOUSE (homophonic).
- 3 of the 22 and 9 of the 64 pass a crude grammaticality check, against 84% of real phrases. Those that pass are fragments, not messages.

**Other transcriptions and allowances.**
- No single word in a 333,000-word vocabulary fits any transcription except `circles_distinct`, which admits SLEEPLESSNESS, STEADFASTNESS and TROUBLESHOOTS.
- Two-word fits from the full vocabulary are web-token salad (OF THE BENETTON).
- Allowing filler letters at the ends, or one miswritten symbol, adds more generic fits and no meaningful ones.
- The best one-slip fit, OF THE DIRECTOR (slip at the middle circle), is matched by random rearrangements of Z13's own symbols 8% of the time (p about 0.08).
- If the letter glyphs stand for themselves, no English word sequence fits.

**Z13 looks like any rearrangement of its symbols (reviewer, computed).** Its fit statistics sit in the middle of the distributions for random rearrangements of its own 13 symbols:

| statistic | Z13 | random rearrangements | real phrases with the same repeat profile |
|---|---|---|---|
| fits above the median | 22 | median 13; 20% have 22 or more | median 12; 28% have 22 or more |
| best fit score | -8.31 | median -8.59 | median -8.05 |

So the dictionary search gives no evidence that Z13 is English at all.

### 4.3 What a real answer would look like (computed; judgement in the last step)

Two reviewer calibrations measure where a true text would rank among the fits:

- **Real phrases with Z13's repeat profile** (common vocabulary, at most 4 words, simple substitution):
  - the true phrase was the top fit in 6 of 20 cases and in the top 10 in 17 of 20;
  - median rank 2.
- **Zodiac's own writing.** Real 13-letter word-aligned windows of the solved Z408/Z340 messages, scored the same way, are typically more fluent than all but 58 of Z13's 4,151,724 homophonic dictionary fits (median; 90th percentile 27,864).

So if Z13 were an ordinary English phrase in Zodiac's style, enciphered without slips, its true text would very likely be among the few dozen most fluent fits. Those fits are fragments and word salad:

> SOUTH THE HOUSE, OF THE DEFEAT OF, A DEFINITIVE AT, OF THE DEFECT OF, ON THE DEFEAT OF, IN THE DESERT IS, LEBANON ENABLE, OF THESE NEWTON, DO NOT IT STANDS, ...

None answers "My name is". **Judgement:** this disfavours the hypothesis "ordinary English phrase, plain substitution, no errors". It leaves standing the possibilities the letter itself suggests:
- a name or pseudonym (these score below the fluency bar and number in the tens of thousands);
- a slip, nulls or a transposition;
- a non-English text.

Prior art: IN THE DESERT IS was already among Oranchak's 2012 Project Gutenberg fits. The calibration argument is what this project adds (§7.1).

### 4.4 Did Zodiac reuse a known key? (`results/keyprior/`, then `results/lead/`; reviewed, replicated only weakly, refuted as key reuse)

**Background (computed).**
- The Z408 and Z340 keys share 47 symbols but agree on only 5, against 2.64 expected by chance (p about 0.12). Zodiac did not reuse a key between those two ciphers.
- Six of Z13's eight symbols occur in both. Putting the Z408 key's letters on those six symbols gives WEED?S?H??EWH; the Z340 key's letters give DREA?A?O??EDO. The circle and `[` occur in neither, so each key leaves 26^2 = 676 ways to complete Z13 (26^4 = 456,976 if the three circles are three different symbols).
- The idea is not ours. Garlick (PDF 2020; *Let's Crack Zodiac* episode 23, 2025), Marclean (forum, 2020), Ziraoui (2021) and T.C. (2024-25) read Z13 with the Z340 key, and Oranchak (2013) applied the Z408 key. We found no significance test in any of their published work, although video transcripts and some forums could not be read (§7.5).

**The question tested.** With A=D, E=R, N=E, z=A, K=A, M=O pinned and the free symbols searched exhaustively, are the best completions more English-like than with random key letters? The keyprior task first found p = 0.0008. Every stricter test since then has given a weaker result:

| step | p-value | source |
|---|---|---|
| first report, anneal objective | 0.0008 | `results/keyprior/` |
| same objective, fresh seed, pooled with the first run | 0.00105 | `results/lead/skeptic/family.json` |
| keyprior review, family-wise over 4 transcriptions x 2 statistics | 0.0051 | `results/keyprior/review/family.json` |
| over both known keys | 0.0102 | same |
| pre-registered replication, primary test (canonical, 6-gram) | 0.0147 | `results/lead/replicate/summary.json` |
| pre-registered replication, word statistic | 0.0096 | same |
| pre-registered replication, family-wise over its 12 tests | 0.039 | same |
| frequency-free exact test (all 360 rearrangements of the real six letters), family-wise over the same 12 | 0.144 | `results/lead/skeptic/stat/summary.json` |

**The pre-registered replication (computed; `results/lead/replicate/`).** The protocol was written and hashed before any statistic was computed (`prereg.md`, `prereg.sha256`), and the code was new (`tools/lead_replicate_*`). It ran 4 transcriptions x 3 statistics (best 6-gram score, best word-segmentation score, mean of the 10 best 6-gram scores) against 8 null models of 10,000 draws each (137 eligible windows for the window null), with real-English positive controls and Zodiac's unrelated Z408 key as the negative control.
- **What holds.** Across the 8 null models (permuted key, glyph-class null with and without the crosshair fixed, i.i.d. letters, occurrence-weighted, two isomorph nulls from other ciphers, real Z408/Z32 windows), the canonical p stays at 0.0105-0.0246 for the 6-gram statistic and 0.0052-0.0145 for the word statistic. An independent brute-force recomputation matched to the last digit, and no code bug was found. The glyph-class confound is real (capital glyphs in Z340 carry ETAOINSHR letters 75% of the time, against 65% overall) but explains only a small part.
- **The negative control failed.** The Z408 key reaches p = 0.026 (6-gram) and 0.022 (top-10 6-gram) on the same canonical test, and the pre-registered success criterion required it to stay above 0.05. Only the word statistic separates the two keys (Z340 0.0096, Z408 0.29).
- **Verdict of the replication:** it replicates only weakly, fails its negative control, and is not significant at project level.

**What the replication and the three skeptic reviews found against it (computed; `results/lead/skeptic/`, `results/lead/skeptic/stat/`, `results/lead/cipherexpert/`).** All three skeptics independently reached "refuted" for key reuse.
- **Mostly letter frequency and one shared letter.** Letter frequencies alone give p = 0.074. N=E is the one assignment both solved keys share; freeing it raises p to 0.15 (6-gram) and 0.08 (word). With N=E held fixed in the null, the Z340 key gives 0.036 / 0.020 / 0.046 and the Z408 key 0.049 / 0.50 / 0.050 (6-gram / word / top-10).
- **"Best of all 360 arrangements" holds for one statistic only**, the original anneal objective. Under the replication's statistics the real arrangement of the six letters ranks 28th (6-gram), 9th (word) and 29th (top-10) of 360. The Z408 key's own arrangement ranks 16th on the 6-gram statistic, better than Z340's. Family-wise over the 12 tests, this frequency-free test gives 0.144.
- **The key-specific part is small.** The word statistic's frequency-free version gives p = 0.025, a likelihood ratio of about 4.3-4.7 against real-English positive controls. Density likelihood ratios on the replication statistics are 5.8-9.1 (26.5 for one `circles_distinct` statistic).
- **The test would have found a fluent phrase, and found none.** If Z13 were a fluent phrase under this key, the best completion would score far higher: for the 2,000 most fluent dictionary fits of Z13's pattern, the best word score averages -11.18, and 0 of 2,000 fall as low as Z13's observed -14.46. The best actual completion is DREAM A MOM WE DO.
- **Reuse does not match how Zodiac used the Z340 key.** Enciphering 12.4 million English windows with the real Z340 homophones, Z13's repeat profile appears 99 times less often under random homophone choice, and about 48,700 times less often under cycling, than under a simple key. No 13-symbol window of Z340 has fewer than 9 distinct symbols; Z13 has 8.

**Project-level correction (computed; `results/lead/decision/numbers.json`).** The project ran 51 analyses and its result files hold 1,992 distinct p-values, 1,806 of them from keyprior itself.

| accounting | 0.0051 (original, most favourable) | 0.039 (pre-registered replication) |
|---|---|---|
| Šidák over 24 key-carry-over tests | 0.12 | 0.62 |
| Šidák over the project's 51 analyses | 0.23 | 0.87 |
| Benjamini-Hochberg q over 1,862 distinct p-values | 0.12 | 0.23 |
| Bonferroni / Holm over 1,992 distinct p-values | 1.0 | 1.0 |

- The Benjamini-Hochberg row uses the 1,862 values left once summary and calibration files are excluded.
- The Bonferroni row over-counts, so it is too harsh. The Šidák row over 51 analyses is the fairest single figure.
- **The result is not significant under any accounting:** about 0.2 at the most generous, about 0.9 for the replicated value.
- As a Bayes-factor bound (Sellke), 0.0051 is worth at most 13.7 and 0.039 at most 2.9. With a 5% prior on reuse, the posterior is at most 0.42 and 0.13 respectively, and 0.065 for the frequency-free test.
- The cruder count in the synthesis draft (about 109 p-values quoted in the reports; with 100 independent null tests, a 40% chance of some p <= 0.0051 and 64% of some p <= 0.0102; `tools/synthesis_multiplicity.js`) points the same way.

**TORPEDO (computed; `results/lead/torpedo/`).** Garlick's DR EAT A TORPEDO (published with the letters TOTPEDO) and the related DREAM A TORPEDO get no weight:
- **They need a contested transcription.** TORPEDO requires the circles to be different symbols (all three for DREAM A TORPEDO; the third different from the first two for DR EAT A TORPEDO), and every published transcription reads one glyph. The repeat pattern alone favours distinct circles by 10^2.0-10^4.5 (§4.5), so that transcription is not absurd, but the answer depends entirely on the visual prior, and the available images cannot settle it.
- **DREAM A TORPEDO is not the top completion.** Under the three-distinct-circles transcription it ranks 3rd of 456,976 by the word model, behind DREAM A HOUSE DO and DREAM A MOVIE DO, and 14th by the 6-gram model. DR EAT A TORPEDO ranks 348th. Garlick's published letters (TOTPEDO) rank 174th of 676 under the standard one-circle transcription, where the best completion is DREAM A MOM WE DO and no weapon word appears above rank 320.
- **Random keys do as well.** 1.5-2.0% of random keys give a completion at least as fluent. Counting the content as well, the likelihood ratio is 10-18 within this one transcription. It falls to 1.9-3.9 once the five circle transcriptions and the two keys an analyst would try are allowed for. The 7-letter cut that gives larger numbers was chosen after seeing TORPEDO, and its largest value rests on 3 random-key hits.
- **TORPEDO is the easiest weapon word to get.** It is the 7-letter weapon word random keys produce most often (137 per 100,000 templates), because its ending needs only letters the key already pins.
- **The joint chance is ordinary at project scale.** A random key that is both this fluent and holds a word from the narrow theme list, after allowing for transcriptions and keys, occurs with probability 0.0051-0.0082. Over 51 analyses that is 0.23-0.34.
- **It needs new glyphs the key did not need.** The completion puts M, T, R and P on new glyphs, although the Z340 key already had symbols for all four.
- The letter's context (the question about the last cipher just before Z13, the bomb paragraph just after) makes TORPEDO an appealing story, but that is the story, not evidence: the theme lists were built knowing the claim.

**Other carry-over results (computed).**
- **The Z408 key.** On the word statistic it shows nothing (p = 0.25 in keyprior, 0.29 in the replication). On the 6-gram statistics it does about as well as the Z340 key (0.026, 0.022); that is the failed negative control above. No completion is meaningful and no name fits.
- **Partial carry-over** (best of all 127 subsets of the shared symbols, 20,000 null keys): family-wise 0.026 for the best statistic, 0.05-0.12 for count statistics. Its best completion, TREATY TO THE TO, is word salad. It is the same curiosity.
- **The completions themselves.** Under the canonical transcription, none of the 676 Z340-key completions is meaningful English or a plausible name; the best are DREAM A MOM WE DO and DREAD A DODGE DO. With `[` read as the plain upside-down T (Z340 L), no completion is made of dictionary words at all. Under `circles_distinct`, at least 29,220 completions are dictionary words, so a fluent-looking one is unremarkable.
- The test measures how English-friendly the six letters are. At 13 letters that is a poor proxy for truth (§3.3).

**Standing: a statistical curiosity, not key reuse.** With the Z340 key's letters on Z13's six shared symbols, the best completions are slightly more English-like than with random key letters (pre-registered replication: p about 0.01-0.015 per test, 0.039 over its 12 tests). The effect is mostly letter frequency and the one letter both solved keys share. Zodiac's unrelated Z408 key does about as well on n-gram statistics, and a frequency-free test gives 0.144. It is not significant at project scale (Šidák over 51 analyses: 0.23 for the original 0.0051, 0.87 for the replicated 0.039). It would require an encipherment unlike Zodiac's own practice, and none of the 676 completions under the standard transcription means anything. All three skeptic reviews reached "refuted" for key reuse, and the TORPEDO completions deserve no weight.

**Z32 and the joint key (computed).**
- Z32 shows no carry-over of the Z408, Z340 or union key in any of 7 transcription variants (all p >= 0.28; the key-pinned strings score about -300, against about -160 for English). Applying the solved keys to Z32 is not new: Ziraoui used the Z340 key (2021) and Garlick the Z408 key (*Let's Crack Zodiac* episode 24, 2025).
- Partial pins show nothing either (key-level p 0.67-0.93 upper tail).
- A joint Z13+Z32 key through their five shared symbols could not be tested. The test detected 0 of 5 synthetic shared-key pairs, and the solver had not converged. That result is not evidence either way.
- No rule of key construction (glyph families, mirror pairs, letter-shaped glyphs, alphabet offsets) predicts letters for new symbols.

### 4.5 How Zodiac chose homophones, and the triple circle (`results/cyclemodel/`; reviewed, reproduced, strength corrected)

**Habits fitted on the solved ciphers (computed).**
- Z408 parts 1-2: Zodiac stepped through each letter's homophones in a fixed cycle 87% of the time (90% CI 68-95%) and almost never repeated a symbol back to back.
- Z340, in written order: weaker cycling (29%) plus strong avoidance of reusing a symbol within a written row.
- Z408 part 3: close to random choice.
- The habits are not stable across ciphers. Each regime predicts the other cipher worse than random choice, so every likelihood below averages over the three regimes and over key sizes of 20 to 68 symbols (assumed).

**The triple circle (computed).**
- Under a Zodiac-size key, a frequent letter (E, T, A, O, I, N, S, H, R) produces Z13's three identical symbols within five positions with probability about 0.007-0.010 under the regime mixture.
- If Zodiac sometimes gave a frequent letter a single symbol, as he did with H in Z340, that rises to about 0.06. The reviewer's allocation model, which fits the solved keys about 30 times better, allows exactly that.

**Which kind of key made Z13 (computed; strength depends on the model).** Z13's pattern favours simple substitution over a fresh Zodiac-size homophonic key by 10^2.7 to 10^3.8 (about 500:1 to 6,000:1):
- the range spans the reviewer's improved allocation and the attacker's original one;
- the nullmodel task's cruder comparison gives a similar order (about 100:1);
- 0 of 20,000 real phrases enciphered with Zodiac-style 54- or 63-symbol cycled keys produce 8 or fewer distinct symbols, against 24% under simple substitution;
- an independent check by the lead skeptics agrees: in 12.4 million English windows enciphered with the real Z340 homophones, Z13's repeat profile appears 99 times less often under random homophone choice, and about 48,700 times less often under cycling, than under a simple key.

The direction is robust. If such a key was used anyway, the circled letter is most likely E or O (posterior about 0.32-0.38 for E), with a single symbol.

Prior art: Pelling (2017) argued qualitatively that Z13's many repeats point to a monoalphabetic cipher, and Oranchak (2012) showed that no 13-symbol window of the solved ciphers is as repetitive. The fitted model and the Bayes factors are what this project adds (§7.1).

**Are the three circles one symbol? (computed, prior-dependent)**

| key model | Bayes factor for three distinct symbols over one, from the pattern alone |
|---|---|
| simple | 10^2.0 |
| small homophonic | 10^2.8 |
| Zodiac-size | 10^4.5 |

- Which transcription wins depends on how strongly the images say "one glyph". Every transcriber reads one glyph, but the best scan is a binarized 640x829 image.
- Posteriors ranged from 0.06 to 0.91 for "same symbol" over plausible priors, so the data cannot decide. Only the Bayes factors are robust.
- Explaining the circles as nulls needs a prior of at least 0.0016 for exactly that null placement. A slip at the circles is never favoured under simple substitution.

**Re-ranking with the pattern likelihood (computed).**
- Adding this likelihood to the language model raises the true text's rank in model-generated 13-letter ciphers: pooled n = 28, mean log10 rank change -0.29 (SE 0.10), two-sided sign test p = 0.004, top-1 hits from 1 to 4.
- That is a modest, real gain (about 1.9 times better rank), and too small to single out any Z13 candidate. The effective number of candidates moves only from 15.3 to 12.7.
- For 32-letter ciphers it does not matter: 0 of 10 recovered either way.

### 4.6 Best Z13 candidates and their standing

| candidate | how it arises | standing (reviewer verdict) | why |
|---|---|---|---|
| A DEFINITIVE AT / ON THE DEFEAT OF / IN THE DESERT IS | most fluent strict fits; IN THE DESERT IS is the 6-gram MAP fit (already in Oranchak's 2012 list) | unsupported | expected by chance (Z13 is typical of its own scrambles); not a message |
| SOUTH THE HOUSE | most fluent homophonic fit | unsupported | word salad; homophonic share not established; drops to rank 41 once simple substitution is weighted in |
| IN THE RESENT IS | default solver output | refuted | an objective artifact returned for every cipher with Z13's pattern |
| OF THE DIRECTOR | one assumed slip at the middle circle | unsupported | scramble null p about 0.08; siblings score the same |
| SLEEPLESSNESS | `circles_distinct` only | unsupported | low-plausibility variant with hundreds of good fits |
| EDDIE RESENDES, CARL BOB ABARCA, MARY LULA LERMA, AMY HELENE RYAN, CHASTITY TRACY, DONALD LYLE NGO | top names under various patterns and transcriptions | unsupported | leader changes with every assumption; prior-driven shares |
| DREAM A MOM WE DO, DREAD A DODGE DO | Z340 key, canonical | unsupported | the curiosity behind it is not significant at project scale (§4.4); text meaningless |
| DREAM A TORPEDO; DR EAT A TORPEDO | Z340 key, three distinct circles (Garlick) | unsupported; no weight | rank 3rd and 348th of 456,976; random keys give comparably fluent text (likelihood ratio 1.9-3.9 after look-elsewhere); needs distinct circle symbols, which no published transcription asserts |
| TREATY TO THE TO | Z340 key, partial (E N z M) | unsupported | family-wise 0.026 at best; word salad |
| WEED AS A HAVE WH | Z408 key | unsupported | no signal on the word statistic (p = 0.25-0.29) |

---

## 5. Z32

### 5.1 What the pattern allows (computed)

Z32's only constraint under homophonic substitution is three equalities: positions 0 = 25, 1 = 31 and 5 = 13. That is about 12 bits.
- Between 1 in 3,800 and 1 in 5,400 real English 32-letter windows satisfy it, depending on the corpus. That is ordinary for three random pairs (P = 0.73).
- Examples include NOTHING A MAN CAN DO THAT A WOMAN CANT DO and THE CHAUFFEUR HAD BEEN THROWN THROUGH.
- Simple substitution is impossible, since 29 symbols exceed 26 letters.
- The pattern favours a Zodiac-size key of 45 or more symbols (posterior 0.94), with a weak preference for strict Z408-style cycling (Bayes factor about 4). This assumes an English underlying text.

### 5.2 Free solver search (`results/z32search/`; reviewed, reproduced exactly)

- 2,980 annealing restarts over 13 configurations.
- Almost every restart ends at a new optimum. In the main configuration's top 200, no key was found by two restarts.
- The best score (-126.27, A TURNED THAT THE LOOKING THE WAS ABOUT) is ordinary for the pattern: Z32 scores -127.9 at equal effort against 12 null ciphers at -129.1 +/- 1.8 (z = 0.14).
- On every null cipher the solver's top text outscored the true text.
- The 1,065 "all dictionary word" outputs are word salad: none is grammatical, and they average 28.5 of 32 letters apart.

### 5.3 Themes: cribs and radian/inch messages (computed)

**Cribs.**
- 80 of 88 theme words fit at every position. The other 8 are long words that lose placements spanning the 5 = 13 pair.
- The crib-cost test has almost no power. The reviewer's positive control, with THREE truly in the synthetic text, moved the cost by only 1.4 points (p = 0.098) and never found the true position.
- So neither "RADIANS fits better than nulls" (pass 1) nor "THREE fits worse than every null" (robust over 4 seeds) means anything. Combining runs, RADIANS sits mid-pack: 1-2 of 6 null ciphers are cheaper.

**Structured radian/inch messages.** Three independently built grammars agree that such messages fit Z32 at the ordinary rate:

| grammar | derivations of 32 letters | fit Z32 | comparison |
|---|---|---|---|
| z32search | 1,469,362,720 | 376,072 (1 in 3,907) | null median (P = 0.60) |
| nullmodel reviewer | 47,730,756 | 20,181 (1 in 2,365) | |
| audit | about 1.46 x 10^10 | about 5.1 million | |

The published proposals ESTIMATE FOUR RADIANS AND FIVE INCHES (Grinell 2020) and IN THREE AND THREE EIGHTHS RADIANS TEN (DMW 2019, Stampher 2026) are among these fits, alongside trivial siblings such as ESTIMATE NINE RADIANS DIG FIVE INCHES. Stampher (2026) had already enumerated such phrases (61 of 154,572 fit, 1 in 2,534) without a null comparison.

### 5.4 Transpositions (computed)

- We tested 51 read orders: rows, boustrophedon, column reads of the 17 + 15 layout, Z340-style diagonals, regrids, rail fences and decimations.
- None stands out. Held-out English fits ranged from 0 to 41 against a null median of 25. One order at p about 0.04 among 51 is what chance predicts.
- The apparent outlier at period 19 (skip19, also Z340's period) came from lead words in our own grammar.
- Under homophonic substitution with a free key, a transposition changes only which three pairs must match, so this test is weak by construction. Read orders would matter under a key model, which was not combined with transposition.

### 5.5 Key carry-over (computed)

- No Z408, Z340 or union carry-over in any of 7 transcription variants (p >= 0.28).
- The four glyph-identity variants (`bar_is_serif_I`, `t2_is_perp`, `bar_I_and_t2_perp`, `tau_distinct`) matter only through carry-over, so no transcription choice changes a Z32 conclusion.

### 5.6 The Mt. Diablo map (`results/mapgeometry/`; reviewed, reproduced exactly, with independent geodesy)

The July 26 letter says the code "concerns Radians & # inches along the radians". We tested that instruction geometrically, without deciphering anything.

![Mt. Diablo map geometry](results/mapgeometry/mapgeometry_figure.png)

*Left: the mailed inset with rays every radian from "map-up + 17 degrees" and rings in paper inches. Right: the same on the ground (true north up, rings every 6.4 miles), with the inset outline and Zodiac-related sites. Source: `results/mapgeometry/mapgeometry_figure.png`.*

**The map itself (computed, independently confirmed; known before, see "Prior art" below).**
- The mailed piece is the "San Francisco and Vicinity" inset of a Phillips 66 road map. On it, **true north lies about 4.6 degrees clockwise of map-up** (4.2-4.9 over landmark subsets; two independent scans agree). The printed N arrow points to map-up.
- **The printed scale bar is about 9% too long for the geography** (ratio 1.09-1.10). One paper inch covers 7.0-7.2 ground miles, not the labelled 6.4.
- The inset measures 6.7 x 8.1 inches by ruler. From the summit it reaches only about 2.5 in north, 1.2 in east, 5.7 in west and 5.8 in south.
- Zodiac's drawn crosshair is centred on the printed summit cross. Its 0-arm points 1.9-3.2 degrees clockwise of map-up, about 2 degrees west of true north. It does **not** point to 1970 magnetic north, which is 16.9 degrees east of true north (NOAA model).
- Blue Rock Springs lies 0.5-1.1 miles beyond the top edge of the mailed piece. Lake Herman Road is 1.2-1.85 miles inside it.

**Prior art.** These map facts were published before, and our numbers are an independent confirmation, not a discovery:
- shaqmeister (forum, 2026-05-12): the inset is turned about 4.6 degrees from true north, and the scale is about 7.02 mi per inch instead of 6.4 (7.06 in September 2026);
- Amicone (2020): the drawn axis leans about 2 degrees east, and the map scale is wrong;
- Marclean (forum, 2023) and VT_Squire (Cipher Mysteries, 2025): the scale or the north direction is wrong, without a magnitude;
- zodiackillerfacts.com (Butterfield, 2007-2011): Blue Rock Springs would sit just above the northern border;
- Hodel (2010), DMW (2019) and zodiackillerfacts.com turn the cross about 17 degrees for magnetic north.

**Published radian theories (computed).**

| theory | test result | verdict |
|---|---|---|
| Penn (1981/1987): Blue Rock Springs and the Stine site subtend one radian at the summit | 60.28 degrees = 1.052 rad (5.2% over); the watch-face version also gives 60.1 degrees; chance of some pair being this close to 1 rad 0.18-0.51 | refuted as "one radian" |
| Grinell / InStepWithTheStars: 4 rad clockwise from magnetic north, 5 in | lands 2.24 mi from Ingleside station using 6.4 mi/in on the ground, 6.15 mi measured on the paper; the ray misses the San Francisco crime sites by 9-12 degrees | unsupported |
| DMW / Stampher: ten o'clock, 3 3/8 in | 1.15 mi from Blue Rock Springs at 6.4 mi/in; 0.49 mi from the Vallejo phone booth measured on paper; the point moves with the convention; 2 of 44 claim points within 1 mi of a site (one by construction), p = 0.05 | unsupported |
| Foxon (12 in, 3 rad) and (3 in, 0 rad); Burke "7 in south"; Penn "4 in along the radian" | all fall off the mailed piece, in their own conventions too (Foxon: 12 of 12 variants) | refuted as instructions on this map |
| Lake Herman Road = 1.000 rad counter-clockwise of 1970 magnetic north, and "3 in" at 6.4 mi/in lands 0.13 mi from it | the angle was noted before (zodiackillerfacts.com illustration, about 2011; Hodel 2010; Grinell, about 2024; DMW 2019); the 3-inch match is post hoc. At a realistic 0.25-mile tolerance, chance p is 0.01-0.05 in narrow integer-step families and 0.12-0.33 in wider ones. It reads counter-clockwise against the clockwise 0-3-6-9 labels. On the mailed sheet it is 0.92 rad and 2.69-2.75 in. It marks a murder site, not a bomb site | unsupported (a negative result) |
| July 26 doodle: the bold zero sits at 241-242 degrees, the Stine site's magnetic bearing is 241.0 | p = 0.07-0.14 after look-elsewhere | not significant |

**Grid of all radian/inch points (computed).**
- We placed points at every half-step from k = 0.5 to 6 radians and n = 0.5 to 12 inches, under 8 conventions.
- In the four main conventions, no grid point lies within 1 mile of a Zodiac-related site.
- The school-proximity test was uninformative rather than negative: its random-point null was not matched to the grid's distances from the summit.

### 5.7 Best Z32 candidates and their standing

| candidate | how it arises | standing |
|---|---|---|
| A TURNED THAT THE LOOKING THE WAS ABOUT; WELL THAT THEIR HAND COMPARED WITH THE; ES NOTHING FOR THERE WAS AND THE THINGS | solver optima | refuted (word salad at the null level; solver beats truth 12/12) |
| AND THERE FOR THE RADIANS WERE AND THEN | best RADIANS crib completion | refuted (forced completion, mid-pack against nulls, test has no power) |
| SURE SOMETHING OF THE FINDINGS AND YOU | solver with the pattern likelihood | unsupported (ungrammatical; typical solver output) |
| ESTIMATE FOUR RADIANS AND FIVE INCHES | Grinell 2020 | unsupported (fits; 1 of hundreds of thousands of on-theme fits; map step post hoc) |
| IN THREE AND THREE EIGHTHS RADIANS TEN | DMW 2019, Stampher 2026 | unsupported (fits; Stampher's own funnel passed 61 phrases and kept 54 survivors) |
| Z408 / Z340 / union carry-over strings | key reuse | refuted (p about 0.8) |

---

## 6. Published claims audit (`results/audit/`; reviewed, core counts reproduced exactly)

We checked 43 named proposals (18 for Z13, 25 for Z32) and all 1,153 strings on the Z13 Solutions wiki page.
- **Z13:** 10 compatible but indistinguishable from chance, 5 incompatible, 3 untestable.
- **Z32:** 13 compatible but indistinguishable from chance, 4 incompatible, 8 untestable.
- **Wiki:** of the 1,153 strings, 1,148 fit (or are anagrams with Z13's letter profile) and 5 do not fit as listed.
- **No proposal is supported by independent evidence.**

| claim | proponent | mechanical result | verdict (after review) |
|---|---|---|---|
| ALFRED E NEUMAN | Graysmith 2002, Bauer 2017 | 1 conflict (N must be both F and M), which its proponents concede; impossible in any reading order without that slip | unsupported |
| DR EAT A TOTPEDO / TORPEDO | Garlick 2020, 2025 | homophonic fit with the Z340 key (TORPEDO needs a slip, or the three-distinct-circles transcription); rank 174 of the 676 completions of its own premise; 2.45 million homophonic dictionary fits read better | unsupported; no weight after the look-elsewhere test (§4.4) |
| ANDREA J ODELL (from DREAJALORNEDO) | T.C. 2024-2025 | DREAJALORNEDO fits only if the circles are three different symbols; the final name is not a permutation of the 13 letters | incompatible |
| KAYR / KAYE | Ziraoui 2021 | multi-step chain of free choices (Z340 key, dial numbers, A1Z26 digits, trifid, an assumed error) | indistinguishable from chance |
| MARVIN MERRILL | Baber 2025 | 5 conflicting positions in direct order (shown before by Hodel 2026 and 0xfab1); 0 of 92,464 columnar transpositions (92,323 distinct; blanks only at the end of the last row) and 0 of 282,352 2x7 / 7x2 grid orders fit; the prior-art rerun of the described 2x7 box (null anywhere, all 5,040 column orders, both directions) fits 0 of 423,922 distinct orders under the canonical, bracket and reversed transcriptions, and 91 homophonic orders only under three distinct circles, none with the reported LIZABETH order; 1,224,045 of 15 million FIRST+LAST names share its letter profile, and 4% (box) to 8-9% (columnar) of random profile-matching names fit some order | refuted as reported (the test has low power) |
| EARL VAN BEST JR | Stewart 2014 | no letter occurs three times, so no key and no reading order fits | incompatible |
| NAME GRANT | Lafferty 2012 | multi-step with free choices; the same steps yield hundreds of names | indistinguishable from chance |
| LAWRENCE KANE; FROM TED KACZYNSKI | Dragallas 2017; Oswell | 5 conflicts; 16 letters for 13 symbols | incompatible |
| AENDLSLMLCNAM ("ALLEN") | TheDecipherist 2026 | strict fit, but not English; rank 254 of 676; ALLEN comes from an outside checksum | unsupported |
| ED SHAW | "Rembrandt" | Z408 key plus 7 of 13 symbols treated as nulls | indistinguishable from chance |
| THE BIG SECRETE | Kelleher | fits only the three-distinct-circles transcription; 418 of 649 natural fits read better | unsupported |
| DR GEORGE HODEL / GEORGE HODEL MD | Hodel (found by the reviewer) | 5 conflicts in direct order; GEORGEHODELMD has Z13's letter profile, so it is anagram-compatible like 1.2 million other names | incompatible as written |
| SARAH THE HORSE, CHASTITY TRACY | Oranchak 2013 (demonstrations) | fit; offered by him as examples of how many fits exist | demonstrations |
| IN THREE AND THREE EIGHTHS RADIANS TEN | DMW 2019, Stampher 2026 | fits; its fluency is within Zodiac's own range, so fluency rank is not evidence against it | unsupported |
| ESTIMATE FOUR RADIANS AND FIVE INCHES | Grinell 2020, InStepWithTheStars | fits; near the top of the grammar null and above 60% of Zodiac's own aligned 32-letter windows | unsupported |
| THREE RADIANS FROM MOUNT AREA TWO INCH | Cragle 2022 | fits; ungrammatical | unsupported |
| OKAY I SEVEN INS SOUTH OF DIABLO MT PEAK | Burke 2019 | fits; less fluent than 95.6% of Zodiac's own aligned windows | unsupported |
| TWELVE INCHES ALONG THE THREE RADIANS | Foxon 2023 | on his own order (second row shifted 2, knight move from top-left) it has exactly his two declared misspellings; 15.3% of random English windows do as well on that order; he calls it unconvincing himself | unsupported |
| RADIANS AND 5 INCHES ALONG THE RADIANS | Grinell 2018 | 2 conflicts | incompatible |
| LABOR DAY FIND 45.609 NORT 58.719 WEST | Ziraoui 2021 | the digits reproduce exactly from the Z340-key letters, but the 20-letter anagram needs a letter that string lacks, and 2 symbols are dropped | unsupported |
| Roberts 2014; Boyouk 2022; NoName 2024 | | 62, 38 and 33 letters for 32 symbols | incompatible |
| Sundberg & Thelin 2014; Dickinson 2026; Praetorian 2026 | | multi-step proposals with free parameters (Praetorian brute-forced about 24,000 combinations) | indistinguishable from chance |
| Penn; Cobb; Case Breakers; Garlick (Z32 video); Baber (Z32); Dominik; Lewison; Kobek; Voigt | | no checkable text available | untestable |

Two audit arguments were corrected in review:
- **Fluency ranks are not evidence against the Z32 one-to-one proposals.** Zodiac's own word-aligned 32-letter windows typically have 553 of the 743 natural fits reading better. The case against those proposals rests on the weakness of the three-equality test, their multiplicity and the post-hoc map step.
- **For Z13 the calibration runs the other way.** Zodiac's own 13-letter windows rank near the top of the fits, so low-ranked Z13 proposals (Garlick, TheDecipherist) are atypical of real Zodiac text.

---

## 7. What is new, what was known, and what is negative

A prior-art search (`results/lead/priorart/priorart.md`) checked every candidate finding (F1-F10 below) after the draft of this report was written. It changed this section. The map facts the draft listed as new had been published five months earlier, and the Z340-key result turned out to rest on a known idea (reading Z13 with the Z340 key), while our new test of it finds no evidence of reuse (§4.4). The project's decision (`results/lead/DECISION.md`, section 3) is that **nothing here is a genuinely new fact about what Z13 or Z32 say, and the results should not be published as new findings.** If a methods-and-negative-results repository is published anyway, the wording in §7.1 is the limit of what may be called new.

### 7.1 What may be called new, and in what words

To our knowledge, and subject to the gaps in §7.5:

1. **F1 (new method, negative result).** "To our knowledge, the first permutation-null test of whether Zodiac reused the Z340 key in Z13. The six shared symbols decode to letters slightly more English-friendly than random key letters (p about 0.01 per test, 0.039 over 12 pre-registered tests), but Zodiac's unrelated Z408 key does about as well on n-gram statistics, a frequency-free test gives 0.144, and the result is not significant once the project's other analyses are counted. We find no evidence of key reuse. Reading Z13 with the Z340 key is due to Garlick and others." The others are Marclean (2020), Ziraoui (2021) and T.C. (2024-25).
2. **F2 (quantification).** "A homophone-choice model fitted to Z408 and Z340 puts the evidence that Z13 was made with a key giving most letters a single symbol, rather than a Zodiac-style homophonic key, at roughly 10^2.7 to 10^3.8 (model-dependent). Pelling (2017) argued this qualitatively, and Oranchak (2012) showed no 13-symbol window of the solved ciphers is as repetitive."
3. **F3b (observation).** "No 5-symbol window of Z408 or Z340, in written or reading order, contains a symbol three times; Z13 does (positions 4, 6, 8)."
4. **F5 (quantification).** "On Foxon's own read order, 15.3% of random English 32-letter windows fit Z32 with at most two slips, the same standard his candidate meets."
5. **F4 (extension of a known refutation).** "Under the 2x7 box transposition as described in secondary sources, MARVIN MERRILL fits none of 423,922 orders under the standard transcription, and none using the reported keyword order under any transcription we tested. The test has low power (4-9% of random profile-matched names pass)." Credit: Hodel (2026) and 0xfab1 showed that the direct reading fails.
6. **F6, F9 and F10, one sentence each beside the prior work they extend.**
   - F6, new comparison: the radians-and-inches grammar fits Z32 at the rate expected for random three-pair repeat patterns (P = 0.60; 1 in 3,907 derivations), a null comparison that Stampher's (2026) enumeration (61 of 154,572 phrases, 1 in 2,534) did not make.
   - F9, new calibration: real phrases with Z13's repeat profile rank near the top of their own fits (median rank 2), so the fragments at the top of Z13's list, including IN THE DESERT IS from Oranchak's 2012 list, count against the ordinary-English-phrase hypothesis.
   - F10, new comparison: across 36 named suspects and six transcriptions, suspects fit Z13 no more often than random names (p = 0.69, and only under three distinct circles with forced fillers), a random-name null that the checks of Quicktrader (2021, about 30,000 names) and Stampher (2026, about 31,000 Vallejo names) did not use; the test has low power.

Nothing else in this report is claimed as new. Internal calibrations, such as the solver-objective comparison in §3.3, are method checks, not findings.

### 7.2 Replications and confirmations, with credit

- **F3a, windows.** Oranchak (2012): the smallest windows as repetitive as Z13 are 22 symbols in Z408 and 15 in Z340. Reproduced exactly for Z13's profile (`results/lead/priorart/windows.json`; 14 in Z340 reading order).
- **F7, map facts.** shaqmeister (forum, 2026-05-12) published the 4.6-degree turn and about 7.02 mi per paper inch; Amicone (2020), Marclean (2023) and VT_Squire (2025) had noted the wrong axis, scale or north. zodiackillerfacts.com (Butterfield, 2007-2011) noted Blue Rock Springs just above the top border. Hodel (2010), DMW (2019) and zodiackillerfacts.com turn the cross about 17 degrees for magnetic north. Our georeferencing on two scans, with independent geodesy agreeing to 0.001 degrees, confirms these figures (4.2-4.9 degrees, 7.0-7.2 mi per inch) and measures Blue Rock Springs at 0.5-1.1 mi beyond the edge.
- **F8, the one-radian angle to Lake Herman Road.** zodiackillerfacts.com illustration (about 2011), Hodel (2010), Grinell (about 2024) and DMW (2019). The 3-inch match at the printed scale was evaluated here; it is post hoc and not significant (§5.6), and it is reported as a negative result, not as a finding.
- **F9, the phrase.** IN THE DESERT IS appears in Oranchak's 2012 list of Project Gutenberg fits; here it is also the 6-gram MAP fit under strict substitution.
- **Oranchak's counts.** His "about 1 in 12 million" and his 213 name fits reproduce as tests times fit rate (§3.4).
- **Z340 cycling in written order.** Z340's homophone cycling runs in written (transposed) order, not reading order (z = 7.6 against 1.4; 9 of 20 rows without a repeated symbol, against 1 of 20), as Oranchak, Blake and Van Eycke (2024) proposed.

### 7.3 Negative results

- The Z340-key lead and the TORPEDO completions (§4.4).
- Z408, Z340 and union key carry-over to Z32 (p about 0.8; §4.4, §5.5).
- Every audited published proposal (§6).
- The radian theories, including Lake Herman Road (§5.6).
- The suspect names (§4.1).
- The ordinary-English-phrase hypothesis for Z13 (§4.3).
- All solver outputs for Z32 (§5.2, §5.7).

### 7.4 Prior art

| finding | verdict | what was known | what this project adds |
|---|---|---|---|
| Lead: Z13 made partly with the Z340 key; DREAM A TORPEDO / DR EAT A TORPEDO | known idea; refuted (3 of 3 skeptics; the replication failed its negative control) | Garlick (2020, 2025; TORPEDO is his), Marclean (2020), Ziraoui (2021), T.C. (2024-25) read Z13 with the Z340 key | the negative result only |
| F1: permutation-null test of Z340-key carry-over | partly known | the idea (row above); arXiv:2403.17350 names links to the solved ciphers as a possible confirmation but runs no test | the test; its answer is "no evidence of reuse" |
| F2: homophone-choice model; near-simple key favoured by 10^2.7-10^3.8 | partly known | Pelling (2017), qualitative; Oranchak (2012), windows; cycling studied by Oranchak, King and Bahler (1993), Raddum and Sýs (2010), Oranchak, Blake and Van Eycke (2024) | the fitted model and the numbers; strength is model-dependent |
| F3: windows of 22 / 15; no 5-window triple | known (22/15) plus novel (5-window) | Oranchak (2012) | the 5-window observation, a small one |
| F4: MARVIN MERRILL under 2x7 box orders | partly known | direct reading fails (Hodel 2026, 0xfab1); the method is known only from secondary descriptions, and the Colab notebook could not be read | 0 of 423,922 orders; low power |
| F5: Foxon's order, 15.3% of random windows fit | novel | Foxon himself calls the fit weak and declares the two misspellings | the measured rate |
| F6: radians grammar fits at the null rate | partly known | non-uniqueness widely known (Oranchak 2014; arXiv:2403.17350; DMW; Foxon); Stampher (2026), 1 in 2,534; Dominik (2026) | the comparison with random repeat patterns |
| F7: map turn 4.6 degrees, scale about 7.0 mi/in, Blue Rock Springs off the sheet | known | shaqmeister (2026-05-12); Amicone (2020); Marclean (2023); VT_Squire (2025); zodiackillerfacts.com | an independent confirmation only |
| F8: Lake Herman Road at one radian, 3 in | partly known | the angle: zodiackillerfacts.com (about 2011), Hodel (2010), Grinell, DMW (2019) | nothing claimed as new: the 3-inch match was evaluated and is not significant (a negative result) |
| F9: IN THE DESERT IS; calibration of a true phrase's rank | partly known | the phrase: Oranchak (2012) | the calibration argument |
| F10: 36 suspects against a random-name null | partly known | Quicktrader (2021), Stampher (2026); single-suspect checks by Oranchak, Hodel, 0xfab1 and Bauer | the random-name null; low power |

### 7.5 Limits of the prior-art search

- No YouTube transcripts could be retrieved, so only descriptions and chapter lists of *Let's Crack Zodiac* were read. Episodes 23, 24 and 27 part 1 are where an informal version of F1 or F4 would most likely be.
- Not readable: Reddit, Tapatalk, the now-offline zodiackillersite.com, zodiackiller.com, the Baber Colab notebook, Medium, SSRN, and Foxon's PDF (the project's earlier notes were used).
- F7 shows how fragile novelty claims are here: the draft of this report called those map facts new, and the search found them on a forum five months earlier.

---

## 8. What would actually settle it

More computation on the existing 45 symbols will not. The binding limit is information (§3), and every further search only enlarges the set of fits. What would help:

1. **More ciphertext under the same key.** Another cipher, a draft or an unmailed sheet that uses Z13's or Z32's symbols would multiply the constraints. Even 50-100 more symbols under a small key could make Z13's key recoverable (§3.2).
2. **Zodiac's worksheets or key sheets.** The Z340 solvers named these, a known source text, or solid links to the solved ciphers as the evidence that could confirm any proposal for Z13 or Z32.
3. **Higher-resolution images of the originals**, especially the April 20, 1970 letter. The best available Z13 scan is a binarized 640x829 image.
   - The three-circles question has a Bayes factor of 10^2 to 10^4.5 riding on it, and only the images can answer it.
   - The images would also settle whether the hook on `[` is deliberate, which matters for key carry-over.
   - For Z32, the illegible print code on the map inset would date the map edition.
4. **New data for the Z340-key question.** The pre-registered replication (§4.4) re-tested the same 13 symbols and could only re-describe the curiosity. Only a further Zodiac cipher that shares symbols with Z340 could test it: do those symbols get English-friendly letters from the Z340 key?
5. **For the map: physical or documentary evidence.** No bomb was found, and no geometric interpretation can be validated by geometry alone. A 1970 USGS quad covering Mt. Diablo would at least fix the declination Zodiac could have used (probably 17 degrees east), on which the Lake Herman Road coincidence moves by 0.1-0.4 degrees.

---

## 9. Reproducibility

Run from the repository root.
- Commands longer than about 30 seconds, or using more than one thread, go through the slot runner: `node tools/run_slot.js --label <task> -- <command>`, with at most 4 threads.
- Pass cipher files, never raw cipher strings (node is a cmd.exe shim and `|` breaks).
- Full command lists: each main task's `commands_run` field in `results/synthesis/reports_and_reviews.json`. `results/keyprior/`, `results/keyprior/review/`, `results/nullmodel/`, `results/nullmodel/review/` and the lead tasks (`results/lead/replicate/`, `torpedo/`, `skeptic/`, `skeptic/stat/`, `cipherexpert/`) also keep a `commands.log`; the other tasks keep per-run logs in their `logs/` folders (`results/audit/` and `results/mapgeometry/` keep `*_log.txt` files in the task folder instead).

**Foundation**
```
python tools/certify_ciphers.py                 # transcriptions, derived fields, variant export
node tools/verify_calibration.js                # Z408/Z340 calibration files (25 checks)
python tools/key_analysis.py                    # key statistics, cycling, overlap, unicity table
node tools/selftest.js                          # solver self-tests (results/selftest.json)
```

**Information and nulls** (`results/nullmodel/commands.log`; review: `results/nullmodel/review/commands.log`)
```
node tools/run_slot.js --label nullmodel-windows -- python tools/nullmodel_windows.py --cache <scratch> --scrambled13 100 --scrambled 300
node tools/nullmodel_info.js --samples 40000 --cache <scratch> --out results/nullmodel/information.json
node tools/run_slot.js --label nullmodel-isolik -- node tools/nullmodel_isolik.js --windows 100000 --keys 2000 --out results/nullmodel/isomorph_likelihood.json
node tools/run_slot.js --label nullmodel-lengthscan -- node tools/nullmodel_lengthscan.js --n 12 --threads 4 --max-seconds 2400 --out results/nullmodel/lengthscan
node tools/run_slot.js --label nullmodel-review-objective -- node results/nullmodel/review/review_objective.js --threads 4
```

**Z13 names** (`results/z13names/`)
```
node tools/run_slot.js --label z13names-h -- node tools/z13names_run.js --threads 4 --lists male,female --modes homophonic
node tools/run_slot.js --label z13names-s -- node tools/z13names_run.js --threads 4 --lists male,female,nick_male,nick_female --modes simple
node tools/z13names_suspects.js --reps 10000 --seed 1970 --out results/z13names
node tools/z13names_stats.js ; node tools/z13names_crosscheck.js ; node tools/z13names_report.js
```

**Z13 phrases** (`results/z13phrases/`; reviewer script `results/z13phrases/review/run_review.sh`)
```
node tools/z13phrases_null.js --n 4000
node tools/run_slot.js --label z13phrases-H1 -- node tools/z13phrases_batch.js --plan main_homophonic --budget 2400 --threads 4
node tools/z13phrases_calib.js distinct --n 20000
node tools/z13phrases_review_calib.js ; node tools/z13phrases_review_slipnull.js
```

**Key reuse, first pass** (`results/keyprior/commands.log`, `results/keyprior/review/commands.log`)
```
node tools/run_slot.js --label keyprior -- node tools/keyprior_fullpin.js --ciphers z13.canonical,z13.bracket_is_perp,z13.crosshair_null,z13.reversed --keys z408,z340,union --null 10000 --null-kind permute --threads 4 --seed 1970
node results/keyprior/review/review_family.js --null 10000 --threads 4 --seed 1970 --out results/keyprior/review/family.json
node tools/run_slot.js --label keyprior -- node tools/keyprior_fullpin.js --ciphers z32.canonical,... --keys z408,z340,union --null 1000 --max-free 4 --threads 4
```

**The Z340-key lead** (`results/lead/`; verdict `results/lead/DECISION.md`)
```
# pre-registration: results/lead/replicate/prereg.md, hashed in prereg.sha256 before any statistic was computed
node tools/run_slot.js --label lead-replicate -- node tools/lead_replicate_validate.js --n676 200 --ncircles 20 --ncircles-word 5 --seed 4242 --out results/lead/replicate/validate.json
node tools/run_slot.js --label lead-replicate-z340 -- node tools/lead_replicate_run.js --key z340 --draws 10000 --threads 4 --out results/lead/replicate/nulls_z340.json
node tools/run_slot.js --label lead-replicate-z408 -- node tools/lead_replicate_run.js --key z408 --draws 10000 --threads 4 --out results/lead/replicate/nulls_z408.json   # negative control
node tools/lead_replicate_multiplicity.js --lead 0.0051 --lead 0.0102 --lead 0.0096 --lead 0.0147 --lead 0.0392 --out results/lead/replicate/multiplicity.json
node tools/lead_replicate_report.js                       # results/lead/replicate/summary.json and tables.md
node tools/run_slot.js --label torpedo -- node tools/lead_torpedo_null.js --n 10000 --kinds permute,stratified --threads 4 --out results/lead/torpedo/null.jsonl
node tools/lead_torpedo_headline.js > results/lead/torpedo/headline.log ; python tools/lead_torpedo_derived.py
node tools/run_slot.js --label lead-skeptic -- node tools/lead_skeptic_check.js --null 10000 --seed 777 --h1top 2000 --h1sample 2000 --fits <scratch>/keyprior/z13_homo_fits_top500k.tsv --dump --out results/lead/skeptic/check.json
node tools/run_slot.js --label lead-skeptic -- node tools/lead_skeptic_homophones.js --chars 30000000 --stride 2 --seed 99 --out results/lead/skeptic/homophones.json
python tools/lead_skeptic_family.py > results/lead/skeptic/family.json
node tools/run_slot.js --label skeptic -- node tools/lead_skeptic_stat_multiverse.js --key z340 --null perm   # other key/null pairs and the arrangement, influence, families and Bayes scripts: results/lead/skeptic/stat/commands.log
node tools/lead_skeptic_stat_summary.js                   # results/lead/skeptic/stat/summary.json
node tools/run_slot.js --label lead-cipherexpert -- node tools/lead_cipherexpert_condn.js --variant canonical --null 10000 --seed 11
python tools/lead_cipherexpert_summary.py                 # results/lead/cipherexpert/summary.json
node tools/run_slot.js --label priorart -- python tools/lead_priorart_boxperm.py --names 300 --seed 2026
python tools/lead_priorart_windows.py                     # results/lead/priorart/windows.json
node tools/lead_decision_numbers.js                       # re-reads every number in DECISION.md -> results/lead/decision/numbers.json
```

**Homophone-choice model** (`results/cyclemodel/`)
```
node tools/cyclemodel_test.js
node tools/run_slot.js --label cyclemodel-pipeA -- node tools/cyclemodel_pipeline.js --steps fit,compat,win13,win32,enum,score
node tools/cyclemodel_hyp.js ; node tools/cyclemodel_summary.js
```

**Z32 search** (`results/z32search/`; review in `results/z32search/review/`)
```
node tools/z32search_check_lib.js
node tools/run_slot.js --label z32search-A -- node tools/z32search_solve.js --jobs results/z32search/jobs/free_main.json,... --threads 4 --max-seconds 2400
node tools/z32search_heldout.js ; node tools/z32search_typical.js --sample 8000
node tools/z32search_grammar.js --null 20 --threads 1 --orders written,skip19,cols_bt_r2right,diag_dc2,diag_dc2_r2right --out results/z32search/grammar/grammar_quick.json
```

**Map geometry** (`results/mapgeometry/`; reviewer rerun `results/mapgeometry/review/rerun.py`, independent geodesy `results/mapgeometry/review/independent.py`)
```
python tools/mapgeometry_core.py ; python tools/mapgeometry_radian.py --trials 20000 ; python tools/mapgeometry_gridhit.py --trials 20000
python tools/mapgeometry_report.py ; python tools/mapgeometry_figure.py
```

**Claims audit** (`results/audit/`; reviewer slot script `tools/audit_review_slot.sh`)
```
python tools/audit_wiki_parse.py
node tools/run_slot.js --label audit-theme -- node tools/audit_z32_theme.js --samples 3000000
node tools/audit_corpus_ref.js --docs all --reservoir 3000
node tools/audit_check.js --scratch <scratch> --null-names 300 --null-phrases 1000 ; node tools/audit_tables.js > results/audit/tables.md
```

**This synthesis** (`results/synthesis/`)
```
node tools/synthesis_extract.js --journal <workflow journal.jsonl> --out results/synthesis/reports_and_reviews.json
node tools/synthesis_pvalues.js        # p-values quoted per task; also checks that no Z408/Z340 message slice is present (0 found)
node tools/synthesis_multiplicity.js   # first, rough look-elsewhere arithmetic for the Z340-key lead (superseded by tools/lead_decision_numbers.js)
```

---

## Appendix A. Every nominally significant result, and what became of it

From `results/synthesis/pvalues.json` (p-values quoted in the reports and reviews) and the lead workflow (`results/lead/decision/numbers.json`), classified by hand. Calibration and positive-control p-values are listed where they bear on a claim.

| result | nominal p | fate |
|---|---|---|
| Z340 key letters on Z13, full pin | 0.0008 (objective), 0.0105 (word); replication 0.0096-0.0152 per canonical test | weaker at every stricter step: family-wise 0.0051 in keyprior, 0.039 over the replication's 12 tests, 0.144 frequency-free; the Z408 negative control reaches 0.026; not significant at project scale (Šidák over 51 analyses 0.23-0.87); refuted as key reuse by three skeptics; no meaningful completion; a statistical curiosity |
| Z408 key on Z13, 6-gram statistics (negative control) | 0.026, 0.022 | the control the Z340 result had to beat, and did not |
| Z340 key, partial pin E N z M | 0.00045 per subset | family-wise 0.026 (best statistic), 0.05-0.12 (counts); same curiosity |
| Z340 key under three distinct circles (TORPEDO) | 0.012 (word), 0.002 (objective); replication 0.0057 (top-10 6-gram) | same curiosity on a low-plausibility transcription; the TORPEDO content is worth a likelihood ratio of 1.9-3.9 after look-elsewhere; joint chance 0.0051-0.0082, which is 0.23-0.34 over 51 analyses |
| Z408 key, `[` read as the plain upside-down T | 0.0085 (objective) | Z408 family-wise 0.046; word statistic 0.18; no meaningful completion |
| suspect names with one allowed slip | 0.001 | selection artifact: driven by names that entered the list because they had been fitted to Z13; 0 fits once they are excluded |
| Z32 pair placements (RADIANS + INCHES) | 0.02 | control pairs (HOUSE + GARDEN 0.03, PEOPLE + TOWN 0.02) do the same; geometry of Z32's repeats |
| Z32 held-out English fit under read order cols_tb_rl | 0.037 | 1 of 51 orders; chance expectation |
| Z32 radian grammar, read order skip19 | below 0.001 | artifact of the grammar's own lead words (BOMB..., SET S...) |
| Z32 radian grammar, one of 8 message forms | 0.05 | 1 of 8 forms; chance |
| Z32 THREE crib costlier than all nulls | robust over 4 seeds | solver and pair-geometry artifact; the crib test has no power |
| Lake Herman Road one radian, 3 inches | 0.003-0.09 (face-value precision) | 0.01-0.05 (narrow) to 0.12-0.33 (wider, still post-hoc families) at a realistic 0.25-mile tolerance; not on the mailed sheet; the angle was noted before (zodiackillerfacts.com, Hodel, Grinell, DMW) |
| map claim points near Zodiac sites | 0.05 | 2 of 44 points, one by construction |
| homophone-likelihood re-ranking gain (calibration) | 0.004 | a real but small method gain (about 1.9x in rank); singles out no candidate |
| cross-key vowel/consonant agreement below chance (key construction) | about 0.02 | not about Z13/Z32; predicts nothing |

## Appendix B. Main corrections made by the reviewers and the lead workflow

| task | original | corrected |
|---|---|---|
| keyprior | Z13/Z340 result "not significant after correction" | family-wise p 0.0051 (Z340), 0.0102 (both keys); partial-pin family-wise 0.026, not 0.129 |
| keyprior (lead workflow) | family-wise 0.0051 read as "an unexplained anomaly" | pre-registered replication 0.039 over 12 tests; Z408 negative control 0.026 on the same test; frequency-free 0.144; not significant at project scale; refuted as key reuse by three skeptics |
| keyprior | Z32 partial pins "worse than random" (pMean 0.95-1.00) | pseudo-replication; key-level p 0.67-0.93: unremarkable |
| keyprior | arrangement null p 0.0055 | 0.0028, best of 360 on the anneal objective only; under the replication's statistics the real arrangement ranks 28th (6-gram), 9th (word) and 29th (top-10) |
| keyprior (lead workflow) | the Z408 key "shows nothing" | true for the word statistic only (0.25-0.29); 0.026 and 0.022 on the 6-gram statistics |
| cyclemodel | simple vs Zodiac-size key, 10^3.3-10^3.8 | 10^2.7-10^3.8 (allocation model) |
| cyclemodel | circle letter "must be rare" | most likely E or O with a single symbol |
| cyclemodel | circle posteriors (distinct 0.59-0.91) | prior-dependent (same 0.06-0.91); only Bayes factors robust |
| cyclemodel | 13-letter calibration "not significant" | pooled n = 28: p = 0.004 (two-sided sign test), top-1 hits 1 to 4 |
| nullmodel | 13-letter simple-key recovery 1/12, "solver always beats truth" | 4/12 with a 6-gram likelihood objective; the claim holds for the default objective only |
| nullmodel | Z13 word-aligned expected fits 1.1e3 / 253 | 1.5e3 / 386 |
| nullmodel | 6-gram "posteriors" as probabilities | unnormalized relative scores |
| nullmodel | short Zodiac-style length-scan points as unicity data | degenerate (no repeats); uninformative |
| z13names | 37 persons | 36 persons |
| z13names | EDDIE RESENDES within-pattern share 0.93 | about 0.58 allowing for unlisted names |
| z13names | circles_distinct top posteriors (e.g. MARILYN STORMS 0.65) | 0.28 with exact denominators |
| z13phrases | "20 to 60 equally good" candidates | for generic English the truth would rank near the top (median rank 2); the bound does not cover names |
| z13phrases | theme hits 13 | 16 |
| z13phrases | full-vocabulary 3-word estimate 27M +/- 6M | at least 1.78M observed; the extrapolation is biased low |
| z32search | "RADIANS became unfavourable" and "read order was seed noise" | wrong reasoning; the right reason is that the tests have no power and these levels are ordinary |
| z32search | 10^19-10^20 compatible texts | 10^6-10^20 depending on the entropy rate (the nullmodel estimate used in §1 and §3.1 tops out at about 2 x 10^19) |
| z32search | 88 of 88 cribs fit everywhere; 1,065 fluent strings | 80 of 88; 1,065 all-dictionary strings, none grammatical |
| audit | Foxon fits with 0 conflicts under some order | 2 conflicts on his own order, exactly his declared misspellings; fair null 15.3% |
| audit | fluency rank as evidence against the Z32 proposals | not evidence: Zodiac's own text ranks similarly |
| audit | MARVIN MERRILL incompatible | refuted as reported (also 0 of 282,352 grid orders, and 0 of 423,922 2x7 box orders in the prior-art rerun); the audit's columnar family placed blanks only at the end of the last row, not anywhere; the test has low power (4-9% of random profile-matched names pass) |
| mapgeometry | drawn 0-arm 3.02 +/- 0.07 degrees | 1.9-3.2 degrees (freehand stroke) |
| mapgeometry | Lake Herman Road face-value p 0.003-0.09 | 0.01-0.05 (narrow) to 0.12-0.33 (wider) at a 0.25-mile tolerance; on the mailed sheet 0.92 rad and 2.69-2.75 in |
| mapgeometry | school rates "no excess" | uninformative (null not spatially matched) |
| synthesis draft (prior-art search) | map rotation and scale error listed as new | known: shaqmeister (forum, 2026-05-12) and others; an independent confirmation only |
| synthesis draft (lead workflow) | the Z340-key result listed as an open anomaly among the new findings | a negative result: a statistical curiosity, not key reuse |

## Appendix C. What was not done, and limits

**Runs cut short by machine contention.**
- Eight agents shared 20 threads, so several planned runs were cut or never got a slot.
- `circles_distinct` phrase enumeration at full scale, full-vocabulary 3-word searches beyond a sample, and homophonic slip and filler-letter phrase runs were not completed.
- The one-slip and name enumerations for the audit, the scrambled-isomorph dictionary comparison and the grammar null with 408 patterns were also not run.
- All of these could only enlarge the set of fits.

**Hypotheses not tested.**
- A homophonic name likelihood that respects Zodiac's cycling (it would remove most homophonic name fits).
- Fillers between name parts; foreign name lists.
- Subsets of the letters-literal pins.
- Insert/delete misspellings.
- Transpositions other than reversal for Z13.
- A key model combined with transposition for Z32.
- A converged joint Z13+Z32 key solver.
- Treating Z32's crosshair or omega as a null.
- Arc-length interpretations of "inches along the radians".
- A spatially matched school null.

**Model limits.**
- All language scores come from American fiction (1850-1945) letter n-grams and modern Web 1T word frequencies. Names, rare words and Zodiac's misspellings score low.
- The cycling model is fitted on only two ciphers whose habits differ.
- Map coordinates for crime sites come from Wikipedia's location map, and schools from 2026 OpenStreetMap.

**Prior art.**
- The prior-art search could not read YouTube transcripts, Reddit, Tapatalk, zodiackillersite.com, the Baber Colab notebook, Medium or SSRN (§7.5). Every "new" item in §7.1 is new only to our knowledge.

**Process.**
- Several single-thread commands ran longer than the 30-second guideline outside the slot runner. Each was disclosed by its agent, and none affects a number.
- Subagents could not write report files, so their summaries survive only in their structured outputs, copied to `results/synthesis/reports_and_reviews.json`.
- `results/summary.json` was written before the lead workflow finished; its `bottom_line`, `key_reuse`, `novel_findings` and `open_threads` fields were updated afterwards and carry a note. Where it differs, §4.4, §7 of this report and `results/lead/DECISION.md` govern.
- The Z408 and Z340 messages were handled only through files and scripts. `tools/synthesis_pvalues.js` confirms that no 20-letter slice of either appears in `results/synthesis/reports_and_reviews.json`.
