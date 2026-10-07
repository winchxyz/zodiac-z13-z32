# Zodiac Z13 and Z32: an exhaustive, reproducible attempt

This repository is an exhaustive, reproducible computational attempt on the two unsolved Zodiac ciphers, Z13 and Z32, made by Claude (Anthropic's AI) working as an orchestrated team of agents, with adversarial reviewers re-running the key computations. Neither cipher is solved and no proposed text for either beats a fair null model, because 13 and 32 symbols do not carry enough information to single out one answer: the limit is information, not computing power.

**Read next:** [full report](REPORT.md) · [verdict on the one lead][decision] · [data sources](DATA.md) · [third-party material and credits](NOTICE.md). Completed 7 October 2026.

> **What this is.** A release of methods and negative results: the code, the outputs, the adversarial reviews and an audit of 43 published proposals, so that anyone can rerun every number and check every verdict.
>
> **What this is not.** It is not a solution of Z13 or Z32. It does not identify the Zodiac, supports no suspect's name, and does not locate a bomb or any other site. It finds no evidence that Zodiac carried a key over from his solved ciphers. Most of what it measures puts numbers on points that others made first; they are credited below.

## The ciphers

Z13 is the "My name is" cipher in the letter postmarked 20 April 1970. Z32 is the cipher in the letter postmarked 26 June 1970, mailed with a marked map of Mt. Diablo. The solved ciphers were used only as calibration: Z408 (solved in 1969 by Donald and Bettye Harden) and Z340 (solved in 2020 by David Oranchak, Sam Blake and Jarl Van Eycke).

```
Z13  AENz0K0M0[NAM        13 symbols, 8 distinct, pattern abcdefegehcag
Z32  C9J|#Ok[AMf8?ORTG    row 1, 17 symbols
     X6FDVj%HCELzPW9      row 2, 15 symbols; 29 distinct
```

- **Repeats** (0-based positions). Z13: `0` at 4, 6, 8; `A` at 0, 11; `N` at 2, 10; `M` at 7, 12. Z32: `C` at 0, 25; `9` at 1, 31; `O` at 5, 13; every other Z32 symbol occurs once.
- **Transcription convention: David Oranchak's** ASCII scheme ([webtoy transcription scheme][webtoy]), the one used by his zodiackillerciphers.com webtoy, his Cipher Explorer and the cipher files of [AZdecrypt][azdecrypt]. Upper case means a letter as written. Lower case means a mirrored letter, except `z` (crosshairs) and `t` (upside-down T). `0` is Z13's circled glyph, `[` an upside-down T whose base hooks up, `?` an omega, `|` a plain bar, and `8` / `9` the filled / open triangle.
- **Verified** glyph by glyph against magnified scans: three images for Z13 and three independent images for Z32. No published source disagrees on Z13's symbols or their order. The best Z13 scan we found is a binarized 640x829 image.
- **Open transcription questions**, each run as its own [variant file][variants]: are Z13's three circles one symbol (`circles_distinct`)? Is `[` the plain upside-down T (`bracket_is_perp`)? Is the crosshair a null (`crosshair_null`)? Do the letter glyphs stand for themselves (`letters_literal`)? What if Z13 is read right to left (`reversed`)? Z32 has five more glyph-identity variants. Details: [data/ciphers/README.md][ciphers].

## Key results

All numbers are the reviewer-corrected ones, and no claim is rated higher than its reviewer rated it. Full tables are in [REPORT.md](REPORT.md) and [DECISION.md][decision].

| Question | Result | Task |
|---|---|---|
| **How much do the symbols constrain?** | Z13: 1 English 13-letter window in 2.1 million fits its repeat pattern. The pattern removes about 21 bits from a text that carries about 34, which leaves about 1,500 fitting English strings (word-aligned; range 420-4,000). Z32: 1 window in 3,800-5,400 fits, and 10^6 to 10^19 English texts fit, depending on how predictable the text is assumed to be. | [nullmodel][r-nullmodel] |
| **Is Z13 a name?** | Too many names fit: for example, 72 male and 321 female FIRST LAST names (homophonic, no filler letters), and millions once filler letters are allowed. None of 36 named suspects (386 renderings) fits the standard transcription. The only fits need three distinct circles plus forced filler letters, and they occur at the random-name rate (p = 0.69). The test has low power, because chance expects only 0.015 suspect fits. | [z13names][r-names] |
| **Is Z13 an English phrase?** | 25.8 million strings of up to 5 common words fit under simple substitution. The most fluent are fragments: A DEFINITIVE AT, ON THE DEFEAT OF, IN THE DESERT IS (the last was already on Oranchak's 2012 list). In calibration, a real phrase with Z13's profile has median rank 2, and Zodiac's own 13-letter windows have median rank 58 of 4.15 million. So the hypothesis "ordinary English phrase, simple substitution, no slips" is disfavoured (the last step is a judgement). | [z13phrases][r-phrases] |
| **Key carry-over (the one lead)** | Z340 key on Z13's six shared symbols: first p = 0.0008, family-wise 0.0051 within its task. The pre-registered replication gave 0.0147 (primary) and 0.039 over its 12 tests, and it failed its negative control: Zodiac's unrelated Z408 key does about as well on n-gram statistics (0.026; only the word statistic separates the two keys, 0.0096 against 0.29). A frequency-free test gives 0.144. Over the project's 51 analyses the values become 0.23 (original) and 0.87 (replicated). All three skeptics concluded "refuted". None of the 676 completions under the standard transcription means anything; the best is DREAM A MOM WE DO. Garlick's TORPEDO completion needs the three circles to be different symbols, and 1.5-2.0% of random keys are at least as fluent, so it carries no weight. Z32 shows no carry-over from the Z408 key, the Z340 key or their union (p about 0.8). | [keyprior][r-keyprior], [lead][r-lead] |
| **Zodiac's homophone habits** | A choice model was fitted to Z408 and Z340. Z13's pattern favours a key with mostly one symbol per letter by 10^2.7 to 10^3.8 (model-dependent). 0 of 20,000 phrases enciphered with Zodiac-style 54- or 63-symbol cycled keys reproduce Z13's 8-symbol profile (24% do under simple substitution). The pattern alone favours three distinct circles by 10^2.0 to 10^4.5, but the posterior depends on what the images say. | [cyclemodel][r-cycle] |
| **Free search of Z32** | 2,980 annealing restarts were run, and almost every one ended at a different optimum. The best score is ordinary for the pattern (z = 0.14 against null ciphers). On null ciphers the solver outscored the true text 12 times out of 12. None of the 51 read orders tested stands out. | [z32search][r-z32] |
| **Radians-and-inches messages** | 376,072 of 1.47 billion grammar derivations fit Z32 (1 in 3,907), which is the null rate for random repeat patterns (P = 0.60). A reviewer's own grammar gives 1 in 2,365, and Stampher's published funnel gives 1 in 2,534. | [z32search][r-z32] |
| **Mt. Diablo map** | On the mailed inset, true north is 4.6° clockwise of map-up and the scale bar is about 9% too long (7.0-7.2 ground miles per inch). shaqmeister published these figures first (forum, May 2026); this is an independent confirmation. Zodiac's drawn 0-arm is 1.9-3.2° from map-up, not magnetic north. Penn's "one radian" is 60.28°. Lake Herman Road at 1 radian (an angle noted before by zodiackillerfacts.com, Hodel, Grinell and DMW) and 3 inches is a post-hoc coincidence: p 0.01-0.05 in narrow families and 0.12-0.33 in wider ones, and on the mailed sheet it measures 0.92 rad and 2.69-2.75 in. | [mapgeometry][r-map] |
| **Published proposals** | Tested: 43 named proposals (18 for Z13, 25 for Z32) and all 1,153 strings on the zodiackillerciphers.com wiki's Z13 list. Z13: 10 compatible but indistinguishable from chance, 5 incompatible, 3 untestable. Z32: 13, 4 and 8. None is supported by independent evidence. | [audit][r-audit] |

## What is new here, and what was already known

Novelty is judged against a [prior-art search][priorart]. That search could not read YouTube transcripts, Reddit, Tapatalk, the offline zodiackillersite.com, Medium, SSRN or a sign-in-only Colab notebook, so "new" below means "not found in the sources we could read". This matters. Our draft report first listed the map figures as new, and the search then found them on a forum five months earlier.

| Item | Finding (verified, corrected) | Status | Prior work and credit |
|---|---|---|---|
| LEAD | The Z340 key carried over to Z13, giving DREAM A TORPEDO / DR EAT A TORPEDO | **Not supported**: 3 of 3 skeptics refuted it, and the replication failed its negative control. Reported as a negative result only | Known idea: Garlick 2020 and 2025 (TORPEDO is his), Ziraoui 2021, Marclean 2020, T.C. 2024-25. Z408 key applied to Z13: Oranchak 2013 |
| F1 | Permutation-null test of that carry-over. Weak excess (p about 0.01-0.015 per test, 0.039 over 12); the Z408 key does about as well on n-gram statistics; the frequency-free test gives 0.144. Z32 shows none (p about 0.8) | New test whose answer is "no evidence of reuse" | The idea is due to Garlick and others. No published significance test was found |
| F2 | Fitted model of Zodiac's homophone choice. Z13's pattern favours a near-simple key over a Zodiac-style key by 10^2.7-10^3.8, and distinct circles by 10^2.0-10^4.5 from the pattern alone | New numbers (model-dependent); the conclusion had been suggested before | Pelling 2017 (qualitative); Oranchak 2012 (windows); Oranchak, Blake and Van Eycke 2024 (cycling in Z340); King and Bahler 1993; Raddum and Sýs 2010; Van Eycke (non-repeating row segments) |
| F3a | Smallest windows of the solved ciphers with Z13's repeat profile: 22 symbols (Z408) and 15 (Z340) | Known; reproduced here | Oranchak 2012 |
| F3b | No 5-symbol window of Z408 or Z340 holds one symbol three times | New, but only a small observation | None found |
| F4 | MARVIN MERRILL fits none of 423,922 distinct 2x7 box orders under the standard, bracket and reversed transcriptions. There are 91 homophonic fits only if the three circles differ, and none uses the reported LIZABETH order. Low power: 4-9% of random profile-matched names pass | Extension of a known refutation | Direct-reading failure: Hodel 2026, 0xfab1. The method was rebuilt from Connelly's *Killer in the Code* account (Baber, Henry); Stampher 2026 found the steps arbitrary |
| F5 | On Foxon's own read order, 15.3% of random English windows fit Z32 with at most 2 slips, as his candidate does | New measurement of the author's own caveat | Foxon 2023, who himself calls the fit weak and declares the two misspellings |
| F6 | The radians-and-inches grammar fits Z32 at the null rate (P = 0.60; 1 in 3,907 derivations) | New comparison only | Stampher 2026 (61 of 154,572, 1 in 2,534). Non-uniqueness: Oranchak 2014; Oranchak, Blake and Van Eycke 2024; DMW 2019; Foxon 2023; Dominik 2026 |
| F7 | Map: true north 4.6° from map-up; scale bar about 9% too long (7.0-7.2 mi/in); Blue Rock Springs 0.5-1.1 mi beyond the top edge | **Known.** Independent confirmation only | shaqmeister 2026 (4.6°, 7.02 mi/in); Amicone 2020; Marclean 2023; VT_Squire 2025; ZKF (Mike Butterfield) on Blue Rock Springs |
| F8 | Lake Herman Road at 1 radian from 1970 magnetic north and 3 in, 0.13 mi from the site | Coincidence evaluated; not significant | The one-radian angle: ZKF illustration (about 2011), Hodel 2010, Grinell, DMW 2019 |
| F9 | A plain English phrase would rank near the top of Z13's fits (median rank 2; Zodiac's own windows have median rank 58 of 4.15 million). The highest-scoring strict fit under the 6-gram model is IN THE DESERT IS | New calibration; the phrase itself is known | Oranchak 2012 listed the phrase |
| F10 | 36 named suspects: none fits except with three distinct circles and forced fillers, and then at the random-name rate (p = 0.69) | New comparison; negative result with low power | Quicktrader 2021 (about 30,000 names); Stampher 2026 (about 31,000 Vallejo names); Oranchak 2013 (213 fits); single-name checks by Oranchak, Hodel, 0xfab1 and Bauer |

These are the only items this project calls new, in these words:

1. **F1 (new method, negative result).** "To our knowledge, the first permutation-null test of whether Zodiac reused the Z340 key in Z13. The six shared symbols decode to letters slightly more English-friendly than random key letters (p about 0.01 per test, 0.039 over 12 pre-registered tests), but Zodiac's unrelated Z408 key does about as well on n-gram statistics, a frequency-free test gives 0.144, and the result is not significant once the project's other analyses are counted. We find no evidence of key reuse. Reading Z13 with the Z340 key is due to Garlick and others."
2. **F2 (quantification).** "A homophone-choice model fitted to Z408 and Z340 puts the evidence that Z13 was made with a key giving most letters a single symbol, rather than a Zodiac-style homophonic key, at roughly 10^2.7 to 10^3.8 (model-dependent). Pelling (2017) argued this qualitatively, and Oranchak (2012) showed no window of the solved ciphers is as repetitive."
3. **F3b (observation).** "No 5-symbol window of Z408 or Z340, in written or reading order, contains a symbol three times; Z13 does (positions 4, 6, 8)."
4. **F5 (quantification).** "On Foxon's own read order, 15.3% of random English 32-letter windows fit Z32 with at most two slips, the same standard his candidate meets."
5. **F4 (extension of a known refutation, credit Hodel and 0xfab1).** "Under the 2x7 box transposition as described in secondary sources, MARVIN MERRILL fits none of 423,922 orders under the standard transcription, and none using the reported keyword order under any transcription we tested. The test has low power (4-9% of random profile-matched names pass)."

F6, F9 and F10 are new comparisons or calibrations beside the work they extend (Stampher; Oranchak; Quicktrader and Stampher), and nothing more.

**Reproduced, with credit:**
- Oranchak's 22- and 15-symbol windows.
- His "about 1 in 12 million". It reproduces as 26^-5, the chance that 13 uniformly random letters fit the homophonic pattern; real English fits about 1 in 2.1 million.
- His 213 name fits in about 0.5 billion tests.
- His 2012 listing of IN THE DESERT IS among Z13's fits.
- shaqmeister's map figures.
- The ZKF one-radian angle.
- Z340's homophone cycling in written (transposed) order, as the 2024 solution paper by Oranchak, Blake and Van Eycke proposed.

## How it was done

The work was orchestrated in four stages, and every stage left its files in this repository:

1. **Research.** Literature reviews of Z13, Z32, the map and the methods ([research/][research]). The transcriptions were certified against the scans.
2. **Toolkit.** The toolkit has three parts:
   - A letter 1- to 6-gram language model, word and name frequencies, and a cipher loader that handles every transcription variant.
   - A simulated-annealing solver for simple and homophonic substitution (`tools/anneal.js`) and an exhaustive dictionary enumerator (`tools/enumerate.js`).
   - A self-test. From a random start with no cribs, the solver re-solves Z408 in seconds (96.3% of letters; 98.0% is the ceiling for any single key because of Zodiac's own enciphering slips). It also re-solves Z340 once its published transposition is undone (97.1%).
3. **Eight attack teams, each with an adversarial reviewer.** The teams covered information and null models, names, phrases, key carry-over, the homophone-choice model, Z32 search and grammars, map geometry, and the audit of published claims. Each reviewer re-ran the key computations independently. Where a reviewer corrected a number, the corrected number is used; REPORT.md lists every correction.
4. **Focused investigation of the one lead** (the Z340 key on Z13). It had four parts:
   - A [pre-registered][prereg] replication with fresh code. The protocol was hashed before any statistic was computed, and the Z408 key served as the negative control.
   - A look-elsewhere analysis of TORPEDO.
   - Three independent skeptic reviews, among them a statistician and a cipher expert.
   - A prior-art search.

   The outcome and the wording rules this README follows are in [DECISION.md][decision].

**Language data** is rebuilt by scripts from public sources and is not redistributed here (see [DATA.md](DATA.md)):
- Letter n-grams from 870 Project Gutenberg texts of American fiction (authors born 1850-1945, about 114 million letters).
- Word frequencies from Peter Norvig's counts of the Google Web 1T corpus.
- Name frequencies from US Social Security births 1900-1955 and the 1990 and 2010 US Census.

## Repository layout

| Path | Contents |
|---|---|
| [REPORT.md](REPORT.md) | The full report: methods, tables, corrections, limits |
| [results/lead/DECISION.md][decision] | Verdict on the lead, the novelty table, and what may and may not be claimed |
| [results/][results] | One folder per task with outputs, reviews and command logs |
| [tools/][tools] | All code (Node and Python, about 180 scripts) |
| [data/ciphers/][ciphers] | Certified cipher files, transcription variants and notes |
| [DATA.md](DATA.md), [NOTICE.md](NOTICE.md) | Data sources, and third-party material and credits |

## Reproduce

**Requirements:**
- Node 24 (tested with 24.16). Only built-in modules are used, so no `npm install` is needed.
- Python 3.13 with numpy (tested with 2.4), plus Pillow and matplotlib for the image crops and the map figure.
- Tested on Windows 11 in Git Bash; the commands are POSIX shell.
- Hardware used: one laptop with an Intel i7-13700H (20 threads) and 32 GB of RAM.

Heavy jobs go through `tools/run_slot.js`, which queues them into at most 4 slots of 4 threads each. Always pass cipher files, not raw cipher strings, on the command line: on Windows `node` may run through cmd.exe, which mangles `|`, `%`, `^` and `&`.

**1. Rebuild the language and name data** (the sources are listed in [DATA.md](DATA.md)). `--download` selects texts from the current Gutenberg catalog with a fixed seed. The catalog grows over time, so a fresh selection can differ from the 870 texts used here, and `--download` overwrites their list in `data/lm/corpus_manifest.tsv`. To rebuild from exactly those 870 texts, use the manifest-based fetch in [DATA.md](DATA.md) section 1 in place of the `lm_build_corpus.py` line below.

```sh
mkdir -p data/lm/raw data/names/raw
curl -L -o data/lm/raw/pg_catalog.csv https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv
python tools/lm_build_corpus.py --download --build   # about 25 min of rate-limited downloads, then about 4 min
python tools/lm_build_ngrams.py                      # about 1 min; needs several GB of RAM
curl -L -o data/lm/raw/count_1w.txt https://raw.githubusercontent.com/norvig/pytudes/main/data/text/count_1w.txt
curl -L -o data/lm/raw/count_2w.txt https://raw.githubusercontent.com/norvig/pytudes/main/data/text/count_2w.txt
python tools/lm_build_words.py
for f in dist.male.first dist.female.first dist.all.last; do
  curl -L -o data/names/raw/$f https://www2.census.gov/topics/genealogy/1990surnames/$f
done
curl -L -o data/names/raw/names2010.zip https://www2.census.gov/topics/genealogy/2010surnames/names.zip
curl -L -o data/names/raw/ssa_name-counts_jsvine.csv https://raw.githubusercontent.com/jsvine/babynames/master/data/name-counts.csv
python tools/lm_build_names.py
node tools/lm_build_meta.js                          # benchmarks and sanity checks -> data/lm/meta.json
```

**2. Check the ciphers and the solvers:**

```sh
python tools/fetch_sources.py      # third-party cipher sources -> data/sources/ (needed by the next two)
python tools/certify_ciphers.py    # transcriptions, derived fields, variant files (exit 0 = all current)
node tools/verify_calibration.js   # 25 checks on the Z408/Z340 calibration files
node tools/run_slot.js --label selftest -- node tools/selftest.js --only z408,z340 --threads 4
```

**3. Key analyses:**

```sh
CACHE=/tmp/zodiac_nullmodel_cache   # numpy copy of the corpus; rebuildable
# information budget
node tools/run_slot.js --label nullmodel -- python tools/nullmodel_windows.py --cache $CACHE --scrambled13 100 --scrambled 300
node tools/nullmodel_info.js --samples 40000 --cache $CACHE --out results/nullmodel/information.json
# key carry-over: original test, pre-registered replication (Z340 about 26 min, Z408 negative control about 12 min)
node tools/run_slot.js --label keyprior -- node tools/keyprior_fullpin.js --ciphers z13.canonical,z13.bracket_is_perp,z13.crosshair_null,z13.reversed --keys z408,z340,union --null 10000 --null-kind permute --threads 4 --seed 1970 --out results/keyprior/fullpin_z13_permute.json
node tools/run_slot.js --label replicate -- node tools/lead_replicate_run.js --key z340 --draws 10000 --threads 4 --out results/lead/replicate/nulls_z340.json
node tools/run_slot.js --label replicate -- node tools/lead_replicate_run.js --key z408 --draws 10000 --threads 4 --out results/lead/replicate/nulls_z408.json
node tools/lead_replicate_multiplicity.js --lead 0.0051 --lead 0.0102 --lead 0.0096 --lead 0.0147 --lead 0.0392 --out results/lead/replicate/multiplicity.json
node tools/lead_replicate_report.js
node tools/lead_decision_numbers.js  # re-reads every number quoted in DECISION.md -> results/lead/decision/numbers.json
# homophone-choice model (the enum step writes about 1 GB of tables)
node tools/run_slot.js --label cyclemodel -- node tools/cyclemodel_pipeline.js --steps fit,compat,win13,win32,enum,score
# windows of the solved ciphers (Oranchak's 22/15 and the 5-window fact)
python tools/lead_priorart_windows.py
# map geometry (needs the two map scans listed in DATA.md section 4)
python tools/mapgeometry_core.py && python tools/mapgeometry_radian.py --trials 20000 && python tools/mapgeometry_figure.py
```

Every other command, with its parameters and seeds, is in the Reproducibility section of [REPORT.md](REPORT.md) and in the `commands.log` files under [results/][results].

## What would settle it

More computation on the existing 45 symbols will not settle it, because every further search only enlarges the set of fits. These would help:

1. **More ciphertext under the same key.** Another cipher, a draft or an unmailed sheet using Z13's or Z32's symbols would multiply the constraints. Even 50-100 more symbols under a small key could make Z13's key recoverable.
2. **Zodiac's worksheets or key sheets, or an identified source text.** The Z340 team named these as the kind of evidence that could confirm a proposed answer for Z13 or Z32.
3. **Higher-resolution images of the originals, above all the 20 April 1970 letter.** Whether the three circles are one symbol carries a Bayes factor of 10^2 to 10^4.5, and only the images can answer it. They would also show whether the hook on `[` is deliberate, which matters for key carry-over. For Z32, the print code on the map inset would date the map edition.
4. **A pre-registered test on data not yet seen.** Re-testing the same 13 symbols can only re-describe the Z340-key curiosity.
5. **For the map, documentary or physical evidence.** Geometry alone cannot validate a geometric theory. A 1970 USGS quad for Mt. Diablo would at least fix the magnetic declination Zodiac could have used.

## Corrections and credit

Every claim tested here belongs to someone who put real work into these ciphers, and several of those authors stated the same limits about their own proposals. The tables report what the tests measured, not judgements of people. If we have described anyone's work wrongly, or a number is wrong, please open an issue and we will correct it. Full credits and third-party material are listed in [NOTICE.md](NOTICE.md) and in the [prior-art notes][priorart].

## License

Code (`tools/` and the helper scripts under `results/`) is MIT-licensed ([LICENSE](LICENSE)). The report, notes, documentation and result tables are CC BY 4.0. The cipher files follow David Oranchak's transcription convention. [NOTICE.md](NOTICE.md) gives the details and lists what is not redistributed.

[decision]: https://github.com/winchxyz/zodiac-z13-z32/blob/HEAD/results/lead/DECISION.md
[priorart]: https://github.com/winchxyz/zodiac-z13-z32/blob/HEAD/results/lead/priorart/priorart.md
[prereg]: https://github.com/winchxyz/zodiac-z13-z32/blob/HEAD/results/lead/replicate/prereg.md
[ciphers]: https://github.com/winchxyz/zodiac-z13-z32/blob/HEAD/data/ciphers/README.md
[variants]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/data/ciphers/variants
[results]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results
[tools]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/tools
[research]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/research
[r-nullmodel]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/nullmodel
[r-names]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/z13names
[r-phrases]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/z13phrases
[r-keyprior]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/keyprior
[r-lead]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/lead
[r-cycle]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/cyclemodel
[r-z32]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/z32search
[r-map]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/mapgeometry
[r-audit]: https://github.com/winchxyz/zodiac-z13-z32/tree/HEAD/results/audit
[webtoy]: http://zodiackillerciphers.com/wiki/index.php?title=Webtoy%27s_transcription_scheme
[azdecrypt]: https://github.com/doranchak/azdecrypt
