# Decision on the Z13 / Z340-key lead, novelty, and publication

Written 2026-10-07. Inputs: the four lead tasks (`replicate`, `torpedo`, `priorart`, plus the
three skeptic reviews in `cipherexpert/` and `skeptic/`) and the eight main-attack reviews
(`results/synthesis/reports_and_reviews.json`; where a reviewer corrected a number, the corrected
number is used). Every number below was re-read from those files by
`node tools/lead_decision_numbers.js`, which writes `results/lead/decision/numbers.json`.

## Short answer to "any good news?"

No. The one lead (Zodiac reusing part of the Z340 key in Z13) does not hold up. It replicates
only as a weak statistical curiosity that an unrelated key also produces, and it disappears once
the project's many tests are counted. The TORPEDO readings add nothing. Some of the project's
methods and negative results have not been published before, but none of them is a new fact about
what Z13 or Z32 say. **Recommendation: do not publish this as new findings** (section 3).

---

## 1. The lead

### 1.1 What was claimed, and what is left of it

Claim: with the Z340 key, Z13's six shared symbols read D R E A A O (DREA?A?O??EDO), and filling
the two unknown symbols every possible way gives strings more English-like than random key letters
give.

| step | p-value | source |
|---|---|---|
| first report, anneal objective | 0.0008 | keyprior |
| same objective, fresh seed, pooled with the first run | 0.00105 | skeptic/family.json |
| keyprior review, family-wise over 4 readings x 2 statistics | 0.0051 | keyprior/review/family.json |
| over both known keys | 0.0102 | same |
| pre-registered replication, primary test (canonical, 6-gram) | 0.0147 | replicate/summary.json |
| pre-registered replication, word statistic | 0.0096 | same |
| pre-registered replication, family-wise over its 12 tests | 0.039 | same |
| frequency-free exact test (all 360 rearrangements of the real six letters), family-wise over the same 12 | 0.144 | skeptic/stat/summary.json |

The more principled the test, the weaker the result.

**What holds.** On the 8 null models of the replication (permuted key, glyph-class null with and
without the crosshair fixed, i.i.d. letters, occurrence-weighted, two other-cipher isomorph nulls,
real Z408/Z32 windows), canonical p stays in a narrow band: 0.0105-0.0246 for the 6-gram statistic
and 0.0052-0.0145 for the word statistic. No code bug was found; an independent brute-force
recomputation matched to the last digit. The glyph-class confound is real (capital glyphs in Z340
carry ETAOINSHR letters 75% of the time against 65% overall) but explains only a small part.

**What does not hold.**
- **Not specific to the Z340 key.** Zodiac's unrelated Z408 key reaches p = 0.026 (6-gram) and
  0.022 (top-10 6-gram) on the same Z13 test. The pre-registered negative-control criterion failed.
  Only the word statistic separates the keys (Z340 0.0096, Z408 0.29).
- **Mostly letter frequency and one shared letter.** The unigram-only p is 0.074. Freeing the one
  assignment both keys share (N=E) raises p to 0.15 (6-gram) and 0.08 (word). With N=E held fixed
  in the null, Z340 gives 0.036 / 0.020 / 0.046 and Z408 gives 0.049 / 0.50 / 0.050.
- **"Best of all 360 arrangements" holds for one statistic only.** Under the replication's
  statistics the real arrangement ranks 28th (6-gram), 9th (word) and 29th (top-10) of 360. The
  Z408 key's own arrangement ranks 16th on the 6-gram statistic, better than Z340's.
- **The key-specific part is small.** The word statistic's frequency-free version gives p = 0.025,
  a likelihood ratio of about 4.3-4.7 against real-English positive controls. Density likelihood
  ratios on the replication statistics are 5.8-9.1 (26.5 for one circles_distinct statistic).
- **The test would have found a fluent phrase, and found none.** If Z13 were a fluent phrase under
  this key, the best completion would score far higher: for the 2,000 most fluent dictionary fits
  of Z13's pattern, the best word score averages -11.18, and 0 of 2,000 fall as low as Z13's
  observed -14.46. The best real completion is DREAM A MOM WE DO.
- **Reuse does not match how Zodiac used the Z340 key.** Enciphering 12.4 million English windows
  with the real Z340 homophones, Z13's repeat profile appears 99 times less often under random
  homophone choice and about 48,700 times less often under cycling than under a simple key. No
  13-symbol window of Z340 has fewer than 9 distinct symbols (Z13 has 8). The two solved keys
  agree on 5 of 47 shared symbols, about chance (2.64 expected, p = 0.12).

### 1.2 The honest p-value

| accounting | 0.0051 (original, most favourable) | 0.039 (pre-registered replication) |
|---|---|---|
| Šidák over 24 key-carry-over tests | 0.12 | 0.62 |
| Šidák over the project's 51 analyses | 0.23 | 0.87 |
| Benjamini-Hochberg q over 1,862 distinct p-values | 0.12 | 0.23 |
| Bonferroni / Holm over 1,992 distinct p-values | 1.0 | 1.0 |

The Bonferroni row over-counts (1,806 of the 1,992 values come from keyprior itself), so it is
too harsh. The Šidák row over 51 analyses is the fairest single figure. **Honest project-level
p: about 0.2 at the most generous, about 0.9 for the replicated value; under no accounting below
0.05.** As a Bayes-factor bound (Sellke), 0.0051 is worth at most 13.7 and 0.039 at most 2.9; with
a 5% prior on reuse, the posterior is at most 0.42 and 0.13 respectively, and 0.065 for the
frequency-free test.

### 1.3 TORPEDO

**No weight.** Reasons:
- **It needs a contested transcription.** TORPEDO needs the three circles to be different symbols.
  Every published transcription reads one glyph. The repeat pattern alone favours distinct circles
  by 10^2.0-10^4.5, so the reading is not absurd, but the posterior depends entirely on the visual
  prior and the images cannot settle it.
- **It is not the top completion.** Under that reading DREAM A TORPEDO ranks 3rd of 456,976 by the
  word model, behind DREAM A HOUSE DO and DREAM A MOVIE DO, and 14th by the 6-gram model. Garlick's
  DR EAT A TORPEDO ranks 348th. His published letters (TOTPEDO) rank 174th of 676 under the
  standard one-circle reading.
- **Random keys do as well.** 1.5-2.0% of random keys are at least as fluent. Counting the content
  as well, the likelihood ratio is 10-18 within this one reading. It falls to 1.9-3.9 once the five
  circle readings and two keys an analyst would try are allowed for. The 7-letter cut that gives
  larger numbers was chosen after seeing TORPEDO, and its largest value rests on 3 random-key hits.
- **TORPEDO is the easiest weapon word to get.** It is the 7-letter weapon word random keys
  produce most often (137 per 100,000 templates), because its ending needs only the letters the
  key already pins.
- **The joint chance is ordinary at project scale.** A random key that is both this fluent and
  holds a word from the narrow list, after allowing for readings and keys, occurs with probability
  0.0051-0.0082. Over 51 analyses that is 0.23-0.34.
- **It needs new glyphs the key did not need.** The reading puts M, T, R and P on new glyphs,
  although the Z340 key already had symbols for all four.

The letter's context (the question about the last cipher just before Z13, the bomb paragraph just
after) makes TORPEDO an appealing story, but it is the story, not evidence: the theme lists were
built knowing the claim.

### 1.4 Fairest claim

> With the Z340 key's letters on Z13's six shared symbols, the best completions are slightly more
> English-like than with random key letters (pre-registered replication: p about 0.01-0.015 per
> test, 0.039 over its 12 tests). The effect is mostly letter frequency and the one letter both
> solved keys share; Zodiac's unrelated Z408 key does about as well on n-gram statistics, and a
> frequency-free test gives 0.144. It is not significant at project scale (Šidák over 51 analyses:
> 0.23 for the original 0.0051, 0.87 for the replicated 0.039), it requires an encipherment unlike
> Zodiac's own practice, and none of the 676 completions under the standard transcription means
> anything. It is a curiosity, not evidence of partial key reuse. The TORPEDO readings deserve no
> weight.

All three skeptics independently reached "refuted" for key reuse; the replication reached
"replicates only weakly, fails its negative control, not significant at project level".

---

## 2. Novelty table

Verified = by our adversarial reviews (main-attack reviewer, lead skeptics, or a lead task's own
recomputation). Novelty = from `results/lead/priorart/priorart.md`.

| id | finding (corrected) | verified | novelty | note |
|---|---|---|---|---|
| LEAD | Zodiac partly reused the Z340 key in Z13; DREAM A TORPEDO / DR EAT A TORPEDO | **no** (3 of 3 skeptics refuted; replication failed its negative control) | **known** (Garlick 2020 and 2025, Ziraoui 2021, Marclean 2020, T.C. 2024-25 read Z13 with the Z340 key; TORPEDO is Garlick's) | Report as a negative result only. |
| F1 | Permutation-null test of Z340-key carry-over to Z13: a weak excess (p about 0.01-0.015 per test, 0.039 family-wise); Z408 key alike on n-gram statistics; frequency-free test 0.144; Z32 shows no carry-over (p about 0.8) | **with corrections** (headline 0.0008 to 0.0051 became 0.039; "best of 360" and "Z408 shows nothing" hold for one statistic only) | **partly known** (idea known; no published significance test found) | The test is new; its answer is "no evidence of reuse". |
| F2 | Fitted model of Zodiac's homophone choice; Z13's pattern favours a near-simple key over a Zodiac-style key by 10^2.7-10^3.8; distinct circles favoured by 10^2.0-10^4.5 from the pattern alone | **with corrections** (10^3.3-3.8 lowered to 10^2.7-3.8; circle posteriors are prior-dependent, only the Bayes factors are robust). Direction confirmed independently: 99x (random choice) to about 48,700x (cycling) in 12.4M windows | **partly known** (Pelling 2017 qualitative; Oranchak 2012 windows; 2024 paper on cycling) | The numbers are new; the conclusion was suggested before. Strength is model-dependent. |
| F3 | Smallest windows with Z13's repeat profile: 22 (Z408), 15 (Z340); no 5-symbol window of Z408 or Z340 holds one symbol 3 times | **yes** (recomputed in priorart/windows.json; consistent with the 13-window counts of cipherexpert) | **known** (22/15, Oranchak 2012) plus **novel** (5-window fact) | The novel part is a small observation, not a finding. |
| F4 | MARVIN MERRILL fits none of 423,922 distinct 2x7 box orders under the canonical, bracket and reversed readings; 91 homophonic fits only under three distinct circles, none with the reported LIZABETH order | **with corrections** (audit's "blank anywhere" wording was wrong; 4-9% of random profile-matched names pass, so power is low) | **partly known** (direct-reading failure: Hodel 2026, 0xfab1) | The method was rebuilt from secondary descriptions; the Colab notebook could not be read. |
| F5 | On Foxon's own read order, 15.3% of random English windows fit Z32 with at most 2 slips, as his candidate does (his two declared misspellings) | **with corrections** (audit had claimed a 0-conflict order; corrected to his exact order, 2 conflicts) | **novel** (Foxon himself calls the fit weak; nobody measured it) | Quantifies the author's own caveat. Small. |
| F6 | Radians-and-inches grammar fits Z32 at the null rate (P = 0.60; 1 in 3,907 derivations); about 1 in 3,800-5,400 English windows fit Z32 | **yes** (z32search review; DP counter brute-force checked; nullmodel reviewer's own grammar: 1 in 2,365) | **partly known** (Stampher 2026: 61 of 154,572, 1 in 2,534; non-uniqueness widely known) | Only the comparison with random repeat patterns is new. Incremental. |
| F7 | Map: true north 4.6 degrees from map-up; scale bar about 9% too long (7.0-7.2 mi/in); drawn 0-arm 1.9-3.2 degrees from map-up; Blue Rock Springs 0.5-1.1 mi off the top edge | **yes** (independent geodesy agrees to 0.001 degrees; 0-arm corrected from 3.02) | **known** (shaqmeister, forum 2026-05-12: 4.6 degrees, 7.02 mi/in; Amicone, Marclean, VT_Squire; ZKF on Blue Rock Springs) | The synthesis draft lists this as new; it is not. Present only as an independent confirmation, credited. |
| F8 | Lake Herman Road at 1 radian from 1970 magnetic north and 3 in at 6.4 mi/in, 0.13 mi from the site | **with corrections** (post hoc; p 0.01-0.05 in narrow families, 0.12-0.33 in wider ones; on the mailed sheet 0.92 rad and 2.69-2.75 in; reads against the drawn labels) | **partly known** (the one-radian angle: ZKF illustration about 2011; Hodel 2010; Grinell; DMW) | A coincidence evaluated and found not significant. Negative result. |
| F9 | Under strict substitution the 6-gram MAP reading of Z13 is IN THE DESERT IS; a plain English phrase would rank near the top of the fits (real phrases: median rank 2; Zodiac's own windows: median 58 of 4.15M), so the hypothesis "ordinary English phrase, simple substitution, no slips" is disfavoured | **yes** (computed by the nullmodel and z13phrases reviewers themselves) | **partly known** (Oranchak 2012 listed the phrase) | The calibration argument is new; its last step ("the top fits are not a message") is a judgement. |
| F10 | 36 named suspects across six readings and both modes: none fits except under three distinct circles with forced fillers, at the random-name rate (p = 0.69) | **with corrections** (36 not 37; one-slip check added; under the canonical reading chance expects only 0.015 fits, so power is low) | **partly known** (Quicktrader 2021, about 30,000 names; Stampher 2026, about 31,000 Vallejo names; many single-suspect checks) | Negative result with low power. |

Prior-art gaps that matter: no YouTube transcripts (Ep. 23, 24, 27 part 1 are where an informal
version of F1 or F4 would be), Reddit, Tapatalk, the offline zodiackillersite.com, the Baber Colab
notebook, Medium, SSRN. F7 shows how fragile novelty is here: the draft report called those map
facts new, and the search found them on a forum five months earlier.

---

## 3. Publication recommendation

**No.** The bar is something genuinely new that nobody found before. The project does not have
that:
- **The lead fails.** The only candidate discovery is not significant at project scale, is not
  specific to the Z340 key, and gives no meaningful text.
- **The other new items are quantifications of points already made.** That covers F2 (Pelling,
  Oranchak), F6 (Stampher), F8 (ZKF), F9 (Oranchak) and F10 (Quicktrader, Stampher). The only items
  rated fully novel are a measured fit rate for a cipher whose author already calls it weak (F5) and
  a small window count (F3b).
- **The map facts, which the draft report presented as new, were already published** (F7).
- **The novelty claims cannot be checked where they are most likely to fail.** The search could not
  read the places where informal versions of these checks would live.

If the user nevertheless publishes a methods-and-negative-results repository (legitimate, but
below the stated bar), these are the only things that may be called new, in these words:

1. **F1 (new method, negative result).** "To our knowledge, the first permutation-null test of
   whether Zodiac reused the Z340 key in Z13. The six shared symbols decode to letters slightly
   more English-friendly than random key letters (p about 0.01 per test, 0.039 over 12
   pre-registered tests), but Zodiac's unrelated Z408 key does about as well on n-gram statistics,
   a frequency-free test gives 0.144, and the result is not significant once the project's other
   analyses are counted. We find no evidence of key reuse. Reading Z13 with the Z340 key is due to
   Garlick and others."
2. **F2 (quantification).** "A homophone-choice model fitted to Z408 and Z340 puts the evidence that
   Z13 was made with a key giving most letters a single symbol, rather than a Zodiac-style
   homophonic key, at roughly 10^2.7 to 10^3.8 (model-dependent). Pelling (2017) argued this
   qualitatively, and Oranchak (2012) showed no window of the solved ciphers is as repetitive."
3. **F3b (observation).** "No 5-symbol window of Z408 or Z340, in written or reading order,
   contains a symbol three times; Z13 does (positions 4, 6, 8)."
4. **F5 (quantification).** "On Foxon's own read order, 15.3% of random English 32-letter windows
   fit Z32 with at most two slips, the same standard his candidate meets."
5. **F4 (extension of a known refutation).** "Under the 2x7 box transposition as described in
   secondary sources, MARVIN MERRILL fits none of 423,922 orders under the standard transcription,
   and none using the reported keyword order under any transcription we tested. The test has low
   power (4-9% of random profile-matched names pass)." Credit Hodel and 0xfab1.
6. **F6, F9, F10** may each say "new comparison" or "new calibration", and only as one sentence
   beside the prior work they extend (Stampher; Oranchak; Quicktrader and Stampher).

Must be presented as **replication or confirmation, with credit**: F3a (Oranchak's 22/15
windows); F7 (shaqmeister's 4.6 degrees and 7.02 mi/in; ZKF on Blue Rock Springs); F8's angle
(ZKF); F9's phrase (Oranchak); Oranchak's 1-in-12-million and 213-name counts; Z340 cycling in
written order (Oranchak, Blake and Van Eycke 2024).

Must be presented as **negative results**: the lead and TORPEDO; Z408/Z340/union carry-over to Z32
(p about 0.8); every audited published proposal; the radian theories, including Lake Herman Road;
the suspect names; the ordinary-English-phrase hypothesis for Z13; all solver outputs for Z32.

**Must not be said anywhere:** solution, solved, decoded, reading or plaintext of Z13 or Z32; that
Zodiac reused a key; that TORPEDO or any name is supported; that the map facts are a discovery;
"best of all 360 arrangements" without naming the one statistic; "survives correction" for the
lead.

Before any publication, the draft report needs these corrections: §1 item 4 and §4.4 (use the
replication's numbers and the project-level figures above); §7 item 3 (map facts are known; credit
shaqmeister); §7 item 4 (the lead is a negative result, not an open anomaly).

---

## 4. Files

- Numbers: `results/lead/decision/numbers.json` (from `node tools/lead_decision_numbers.js`).
- Lead tasks: `results/lead/replicate/` (prereg.md, summary.json, tables.md),
  `results/lead/torpedo/` (headline.json, derived.json), `results/lead/priorart/priorart.md`,
  `results/lead/skeptic/` (check.json, homophones.json, family.json, stat/summary.json),
  `results/lead/cipherexpert/summary.json`.
- Main reviews: `results/synthesis/reports_and_reviews.json`; `results/keyprior/review/family.json`;
  `results/cyclemodel/review/hyp_k1fit.json`.
