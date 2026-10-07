# Pre-registration: independent replication of the Z13 / Z340-key lead

Written 2026-10-07 17:35 UTC, before any test statistic was computed. Fresh code only
(`tools/lead_replicate_*`); nothing from `tools/keyprior_*` or `results/keyprior/review/*` is
imported. Allowed shared code: `tools/lm.js`, `tools/cipher.js`, `tools/enumerate.js`.
Outputs go to `results/lead/replicate/`. Anything done differently from this file is listed as a
deviation in the report, with the reason.

## Hypothesis

H1: Z13 was enciphered with a key that gives its six symbols shared with Z340 (`A E N z K M`)
their Z340 key letters (`A=D, E=R, N=E, z=A, K=A, M=O`). H0: those six letters are no better
than letters drawn by the null mechanisms below.

## Variants (from `data/ciphers/variants/`)

| id | string | pinned symbols (Z340 letters) | free symbols | completions |
|---|---|---|---|---|
| canonical | `AENz0K0M0[NAM` | A E N z K M | `0` (x3), `[` | 26^2 = 676 |
| circles_distinct | `AENz0K{M}[NAM` | A E N z K M | `0`, `{`, `}`, `[` | 26^4 = 456,976 |
| crosshair_null | `AEN0K0M0[NAM` (12) | A E N K M | `0` (x3), `[` | 676 |
| reversed | `MAN[0M0K0zNEA` | A E N z K M | `[`, `0` (x3) | 676 |

Completion rule (homophonic): every free symbol independently takes any of the 26 letters; free
letters may equal each other and any pinned letter. Every completion is evaluated (exhaustive).

## Statistics (per variant, for one assignment of letters to the pinned symbols)

- **T1 (markov6max)**: the maximum over completions of the 6-gram Markov log10 P of the
  completed text, i.e. `lm.ngramScore(text, 6).logp` = J6(first window) + sum of the conditional
  log10 P of each later letter (the `--score markov` semantics with n = 6).
- **T2 (wordmax)**: the maximum over completions of `lm.wordSegment(text).logp` (defaults:
  vocabulary `common`, no sentence-start term, maxUnknownLen 20).
- **T3 (markov6top10)**: the mean of the 10 largest T1-values (Markov log10 P) over the
  distinct completions.

Fast implementations must reproduce `lm.ngramScore(..., 6).logp` to 1e-6 and the brute-force
maximum of `lm.wordSegment(...).logp` to 1e-6 on a validation set (all 676 completions for 200
random assignments per 676-completion variant; 20 random assignments for circles_distinct,
checked against brute force over all 456,976 completions for T1/T3 and against at least 5
assignments for T2) before any real value is computed. If a fast T2 for circles_distinct cannot
be validated, T2 for that variant is computed by brute force with the draw rule below.

Larger is more English-like for all three. One-sided p-value: p = (1 + #{null >= real}) / (1 + N).

## Nulls (letters for the pinned symbols; the statistic is recomputed for every draw)

Z340 key = the `key` field of `data/ciphers/z340.json` (63 symbols). Visual classes of Z340
symbols by the ASCII convention (`data/ciphers/README.md`): capitals = upper-case ASCII letters
(normal-orientation letter glyphs); reversed/rotated letters = lower-case except `z`; non-letter
glyphs = the crosshair `z` plus digits and punctuation.

| id | mechanism | draws |
|---|---|---|
| N1 perm | permute the 63 Z340 key letters among the 63 Z340 symbols; read the six pins | 10,000 |
| N2 class | permute letters within the capital class (gives A E N K M) and within the non-letter class including the crosshair (gives z) | 10,000 |
| N3 class_fixz | as N2, but `z` keeps its real letter A | 10,000 |
| N4 iid | each pin i.i.d. from the letter distribution of the 63 Z340 key entries | 10,000 |
| N5 occ | six distinct Z340 symbols drawn without replacement with probability proportional to their Z340 occurrence counts; read their letters | 10,000 |
| N6 iso_uniform | "other ciphers": a random 13-symbol string with Z13's isomorph whose six Z340-keyed slots are six distinct symbols drawn uniformly from the symbols that occur in Z408 or Z32 and also in Z340; its two free slots stay free; decode with the Z340 key | 10,000 |
| N7 iso_weighted | as N6, symbols drawn without replacement with probability proportional to their occurrence counts in Z408 + Z32 | 10,000 |
| N8 windows | every 13-symbol window of Z408 and Z32 (written order); positions that are pinned in Z13 take the Z340-key letter of the window's symbol there, positions that are free in Z13 stay free (same overlap count: 9 known positions, 4 free positions in 2 free symbols); windows with a non-Z340 symbol at a pinned position are skipped. crosshair_null uses the first 12 symbols of the window with Z13's 12-symbol layout; reversed uses the reversed canonical layout. | all eligible windows |

Negative control (other key): the same tests with the Z408 key (`A=W, E=E, N=E, z=D, K=S, M=H`)
against N1' perm (54 Z408 entries), N2' class (Z408 capitals; non-letter class with the
crosshair) and N4' iid (54 entries), 10,000 draws each.

Positive control (power): real 13-letter windows of English that fit the variant's homophonic
pattern (canonical: letters equal at 0=11, 2=10, 4=6=8, 7=12; circles_distinct: 0=11, 2=10,
7=12), from the held-out Gutenberg documents of the LM corpus (manifest rows with index % 50 ==
25), supplemented for canonical (where held-out text has too few fits) by windows of the training
corpus `data/lm/raw/corpus_letters.txt` (flagged: the 6-gram model saw them; the word model is
from Web 1T and did not). A phrase is used only if its six pinned letters can be produced by a
permutation of the Z340 key (sub-multiset of the 63 key letters), i.e. the synthetic "known" key
is a random Zodiac-style key that shares those six letters with the true key; its null is then
exactly N1. For N2, the phrase must be realizable within the classes. Power = share of phrases
with p <= 0.05 (also <= 0.01 and <= the real p). Up to 2,000 phrases per variant (sampled with a
fixed seed). Also reported: the tail ratio P(stat >= real | phrases) / P(stat >= real | N1).

Draw rule: 10,000 draws everywhere. For circles_distinct, if one null would take more than
60 minutes of wall time on 4 threads, its draws are reduced to the largest round number that
fits (at least 2,000), and this is reported as a deviation. Seeds are fixed in the scripts.

## Multiplicity inside this replication

Within each null, Westfall-Young min-p over the 12 tests (4 variants x 3 statistics), using the
same draws for all 12 (each draw fixes the six pinned letters for all variants). Pre-declared
primary tests: (1) canonical x T1 x N1 (direct replication of the earlier headline number);
(2) canonical x T1 and canonical x T2 under N2 (the glyph-class confound null). The replication
counts as successful only if both (1) and (2) have p <= 0.05 and the Z408 negative control does
not reach p <= 0.05 on canonical.

## Project-level multiplicity

A script (`tools/lead_replicate_multiplicity.js`) walks `results/` (excluding `results/lead/`),
collects every p-value-like field in JSON (keys named p, pValue, p_value, p_*, *_p, fw, pFW and
similar, values in [0, 1]) and every "p = x" / "p=x" / "p < x" in Markdown and logs, de-duplicates
identical (file, path) entries, and counts distinct tests per task. The count is checked by hand
against the task reports. The lead's p is then corrected by Bonferroni (p x m) and Holm (the
lead's rank among all collected p-values). Reported both for all collected p-values and for
those about Z13/Z32 (calibration and self-test p-values excluded). The honest number is the
Holm/Bonferroni-corrected p at the project scale; the per-family p-values are reported but are
not the headline.
