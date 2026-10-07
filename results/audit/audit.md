# Audit of published Z13 and Z32 proposals

Task `audit`, 2026-10-07. Every number below comes from a script in `tools/` run on files in this
repository; logs and JSON are in `results/audit/`. Positions are 0-based. The cipher strings and
transcription variants are those of `data/ciphers/README.md` (nothing here contradicts it).

## Bottom line

- **No published Z13 or Z32 proposal is supported by independent evidence.** Every one is
  incompatible with the cipher as published, untestable (no plaintext was ever given), or fits
  but is indistinguishable from chance: many other strings fit equally well or better.
- **Incompatible (9 named):**
  - MARVIN MERRILL (Baber 2025) puts 5 positions in conflict when read directly, and fails all
    92,464 columnar transpositions of width 2-8 we tried.
  - EARL VAN BEST JR cannot fit in any reading order, because no letter in it occurs three times.
  - T.C.'s ANDREA J ODELL, Oswell, Dragallas, and four Z32 readings of the wrong length or with
    conflicts.
  - ALFRED E NEUMAN is not counted here: it fits only with the one wrong symbol its proponents
    admit, and no reading order can make it fit without that slip.
- **Fits as claimed, but indistinguishable from chance.** The 1:1 Z32 "radians and inches"
  sentences (DMW / Stampher, Grinell / InStepWithTheStars, Cragle) and Garlick's DR EAT A TOTPEDO
  are in this group.
  - For each Z32 sentence, 70-89% of the natural-English 32-letter phrases that also fit Z32 read
    better, and the method that produced it would produce millions of alternatives.
  - Garlick's reading ranks 174th of the 676 completions of its own Z340-key premise.
- **New mechanical findings:**
  - Ziraoui's Z32 chain reproduces his digits exactly, but needs a letter change and a free
    anagram of 20 letters.
  - Foxon's kind of transposition makes one in four random English phrases fit Z32 exactly.
  - Stampher's three "homophonic locks" passed phrases at about the chance rate.

## What was audited

- **43 named entries** in `results/audit/proposals.json`: 18 for Z13 and 25 for Z32, including
  two demonstrations (Oranchak's SARAH THE HORSE, Pelling's nonsense Z32 fit) and Oranchak's
  EARL / FRED rebuttal.
  - Sources: `research/z13_literature.md` and `research/z32_literature.md`.
  - **Found in this task, not in the literature notes:**
    - Z32 comments on Cipher Mysteries: Hassan Boyouk (2022), "NoName" (2024), "Shaqmeister"
      (2022, Telugu).
    - The Chicago officer Lewison's unpublished claim.
    - The exact pre-reordering string of T.C.'s Z13 reading, DREAJALORNEDO.
    - Garlick's intended Z13 reading DREATATORPEDO, alongside the fitted TOTPEDO.
    - Praetorian's glyph relabelling and parameter counts.
    - Stampher's candidate funnel.
- **All 1,153 strings on the Z13 Solutions wiki page**, parsed from the saved copy
  `data/sources/wiki_z13_solutions.html` by `tools/audit_wiki_parse.py` into
  `results/audit/wiki_z13_entries.tsv`:
  - 1,027 listed as fitting "as is", 122 anagram readings, and 4 "relaxed" entries (THE BIG
    SECRETE, NAME GRANT, ED SHAW, and DEBBIE FARADAY with a name part split and reversed).
  - Meta-entries were skipped: links to lists, counts, "Male, Initial: M.T.", and the "Other
    interpretations" notes.
- **Not obtainable, so untestable (11 entries):**
  - Garlick's Z32 solution (video only).
  - Baber's Z32 plaintext.
  - Kobek's Hobbitalia-linked Z13 answer.
  - The Case Breakers.
  - Lewison.
  - pi1 (lost).
  - Cobb (structure only).
  - Dominik's two Zenodo notes, which give no plaintext.
  - Penn's radian theory and Voigt's ANETHEKE comparison, which are not decipherments.
- **Search scope:** the web searches covered Cipher Mysteries, zodiackillerciphers.com, the
  Zodiac Killer Ciphers Wiki, news, GitHub, Zenodo and blogs.
  - The Tapatalk forum (HTTP 403) and zodiacrevisited.com (bot check) refused automated access.
  - No Reddit page came up in the searches.
  - Claims posted only on those sites, or only in videos, are not covered.

## Method

Per proposal (`tools/audit_check.js`; cross-checked with `tools/cipher.js` checkCandidate in
`results/audit/cipherjs_checks.txt`, which agrees on every conflict):

- **Consistency.**
  - *Homophonic conflicts* is the fewest positions that would have to be enciphering slips. For
    each symbol it is the number of occurrences minus the occurrences of its most common letter.
  - *Simple* means the reading also maps different symbols to different letters. *Injectivity
    violations* counts the extra symbols per letter.
- **Implied key against Zodiac's keys.**
  - Symbols per letter is listed as `letter:symbols/occurrences`.
  - *Excess* counts symbols beyond the larger of the Z408 and Z340 homophone counts for that
    letter. The keys come from `data/ciphers/z408.json` and `z340.json`.
  - Letters for which neither key has a symbol (J, Q, Z) are listed separately.
- **Homophone cycling.**
  - Calibration:
    - Letters with at least 2 homophones in both solved keys are A D E I L N O R S T.
    - In the solved ciphers (key-decoded, written order), consecutive occurrences of such a
      letter reuse the same symbol in 16/303 cases in Z408, 3/204 in Z408 parts 1-2, and 22/258
      in Z340. Pooled, that is 38/561 = 6.8%.
  - *Cycle breaks* counts such reuses in a candidate. *cycle_p* is the binomial tail at 6.8%.
- **Language score.** `lm.wordSegment` log10 P, on the common vocabulary with the word-bigram
  model.
- **Reference distributions.** The rank of a claim among its references is the number of
  reference strings with a strictly higher log P.
  - **Z13 word fits** (`tools/enumerate.js`, `tools/audit_enum.sh`):
    - Every distinct 13-letter string of at most 4 words from the top 20,000 common words that
      fits the variant.
    - Canonical, simple: 625,218 fits (complete).
    - Canonical, homophonic: 4,151,724 fits (complete count, `z13_canon_homo_count.json`;
      the word-scored run did not run, see "Not run").
    - crosshair_null, simple: 211,018 fits.
    - Simple fits are a subset of homophonic fits, so "simple fits scoring higher" is a lower
      bound for the homophonic case.
  - **Natural English** (`tools/audit_corpus_ref.js`):
    - Every whole-word window of exactly 32 (or 13, 12) letters inside one sentence of the 870
      corpus books: 3,317,390 windows of 32 letters and 4,861,484 of 13.
    - 743 distinct 32-letter windows fit canonical Z32 (1 in 4,465). Only 2 fit canonical Z13 and
      649 fit the circles_distinct variant.
    - wordSegment is built from web word counts, not from these books, so no information leaks.
  - **Radians-and-inches grammar** (`tools/audit_z32_theme.js`):
    - Sentences of the form *glue, ANGLE, glue, DISTANCE, glue* (either order).
      - ANGLE is a quantity with RADIAN(S) or RAD(S).
      - DISTANCE is a quantity with INCH(ES) or IN(S).
      - Quantities run from ZERO to TWELVE, with fractions such as THREE EIGHTHS, A HALF, or
        POINT n.
      - Glue is at most 3 words from 39 map words (ALONG, THE, FROM, MOUNT, DIABLO, NORTH, MAG,
        ESTIMATE, ...).
    - There are 1.464e10 such 32-letter token sequences.
    - A uniform Monte Carlo sample of 3,000,000 found 1,046 that fit canonical Z32, an estimated
      **5.10 million** (95% CI 4.80-5.42 million). For triangles_merged the estimate is 0.42
      million.
    - DMW's, Grinell's and both Foxon sentences belong to the grammar; Cragle's does not (three
      glue words in a row).
  - **Solver fits.** The 8 best distinct keys from the 40-restart homophonic anneal run of
    `results/certify_smoke_z32.json` (3.7 s). Every one of them scores higher than every published
    Z32 claim; the best is "SESSION OF THE MORE THAT WOULD STRANGE" (-18.28).
- **Verdicts.**
  - *Incompatible:*
    - Wrong length.
    - More conflicts than the claimant declares.
    - No reading order can fit.
    - A claimed transposition that our tests reject.
  - *Compatible but indistinguishable from chance:* the reading fits (with its declared slips or
    steps), but the references show many equal or better alternatives, or the extra steps are
    free choices that can produce other outputs.
  - *Supported by independent evidence:* this would need a check the claimant did not fit to,
    such as key reuse that beats a null, a verified prediction, or worksheets. Nothing qualified.
  - *Untestable:* no plaintext.

## Z13: named proposals

| id | who | claim | fit (canonical unless noted) | key / cycling | language rank | verdict |
|---|---|---|---|---|---|---|
| Z13-01 | Graysmith 2002; Bauer 2017 | ALFRED E NEUMAN | 1 conflict (N = F and M), declared by Bauer; **no reading order fits** (0 anagram fits: 9 distinct letters for 8 symbols) | within keys; 4/4 cycle breaks | log P -15.90; 46,999 of 625,218 simple fits score higher | incompatible without the slip; with it, indistinguishable from chance |
| Z13-02 | Garlick 2020/2025 (as fitted) | DREATATOTPEDO | homophonic fit; not simple (z and K both A) | 5/6 cycle breaks (T thrice on one symbol) | -18.62; 352,069 of 625,218 simple fits higher; 173 of the 676 Z340-key completions higher | compatible, indistinguishable from chance |
| Z13-03 | Garlick (intended) | DREATATORPEDO | 1 conflict (circle = T and R) | 4/6 | -15.14; 22,053 simple fits higher | needs a slip; indistinguishable from chance |
| Z13-04 | T.C. 2024/2025 | DREAJALORNEDO, reordered to ANDREA J ODELL | 2 conflicts (circle = J, L, R); final 12 letters are not a permutation of the 13 | J has no Zodiac symbol | -20.30 | incompatible |
| Z13-05 | Ziraoui 2021 | KAYR (for KAYE) | no 1:1 reading; 6 extra steps | - | - | indistinguishable from chance (Oranchak's EARL/FRED rebuttal, Z13-06) |
| Z13-07 | Baber 2025 | MARVIN MERRILL | 5 conflicts direct; letter profile matches; 0 of 92,464 columnar orders fit | - | - | incompatible |
| Z13-08 | Stewart 2014 | EARL VAN BEST JR | 5 conflicts; **no reading order fits** | - | - | incompatible |
| Z13-09 | Lafferty 2012 | NAME (IS) GRANT | multi-step (shifts, anagram, Aries) | - | - | indistinguishable from chance (Oranchak 2012: same steps give hundreds of names) |
| Z13-10 | Kobek 2022 | (not given) | - | - | - | untestable |
| Z13-11 | Oswell | FROM TED KACZYNSKI | 16 letters for 13 symbols | - | - | incompatible |
| Z13-12 | Dragallas 2017 | LAWRENCE KANE | 5 conflicts even with the crosshair removed | - | - | incompatible |
| Z13-13 | TheDecipherist 2026 | AENDLSLMLCNAM ("ALLEN") | simple fit, with A E N M literal and z, K from Z408 | 4/4 | -20.46; 595,614 simple fits higher; 253 of 676 completions higher | compatible, indistinguishable from chance; ALLEN is not in the string |
| Z13-14 | Rembrandt | ED SHAW | Z408 key plus 7 nulls | - | - | indistinguishable from chance |
| Z13-15 | Kelleher | THE BIG SECRETE | fits only if the circles are 3 different symbols (circles_distinct, low plausibility) | 1/4 | -11.06; 418 of 649 natural-English fits higher | compatible, indistinguishable from chance |
| Z13-16, -17 | Dominik 2025; Voigt | (no plaintext) | - | - | - | untestable |
| Z13-18 | Oranchak 2013 (demonstration) | SARAH THE HORSE | homophonic fit | 3/4 | -9.65; 13 simple fits higher | demonstration of the null |

The full columns are in `audit.csv`, and the generated tables are in `tables.md`.

### Claim-specific checks (Z13)

- **Key-reuse readings.** We fixed the six shared symbols from the Z340 key and enumerated all
  26 x 26 = 676 choices for the circle and `[` (homophonic). Garlick's DREATATOTPEDO ranks 174th
  by wordSegment. The top completion is DREAMAMOMWEDO, "DREAM A MOM WE DO" (-14.46). The premise
  itself is unsupported: the Z408 and Z340 keys agree on 5 of 47 shared symbols, against 2.64
  expected by chance (p ~ 0.12, phase 1). TheDecipherist's pinning (A E N M literal, z = D,
  K = S) ranks 254th of 676.
- **ALFRED E NEUMAN.**
  - The letters A2 E3 N2 and six singles make 9 distinct letters for 8 symbols. Z13 needs one
    letter three times plus three letters twice, so no reordering and no homophonic key fits.
    Only the admitted slip makes it fit.
  - With one slip allowed, the reference space grows. The slip enumeration did not run in this
    task (see "Not run"), so we give no count for it.
- **MARVIN MERRILL.**
  - Its letter counts R3 M2 I2 L2 + 4 singles equal Z13's symbol counts. So 144 orderings of
    these letters fit Z13 by simple substitution (3! x 4!), and the direct reading does not.
  - Among 15,073,589 thirteen-letter FIRST+LAST combinations (top 3,000 first names x top 30,000
    surnames from `data/names`), **1,224,045 share that profile**. Any of them "solves" Z13 under
    a free transposition.
  - Baber's reported grid transposition is not published. We tried every columnar transposition
    of width 2-8, writing in rows and reading columns in any order, and also the inverse:
    92,464 orders, of which **0 make MARVIN MERRILL fit**.
  - Of 300 random profile-matching names, 9.7% fit under at least one of those orders. Passing
    this test would therefore not have been evidence either.
  - Only 3 of the 15 million combinations fit Z13 directly (homophonic), and 0 fit by simple
    substitution.
- **Anagram readings on the wiki** (Voigt's KNICKERBOCKER and AINTGONNATELL; Silva's BOB
  BEAUSOLEIL; JIMMY PHILLIPS; FRANK FRAZETTA; GRANT SANTIAGO; DEBBIE FARADAY; Oranchak's
  13-letter words and surnames):
  - All 123 (with DEBBIE FARADAY) have exactly Z13's letter profile, which is how they were chosen.
  - Each therefore has 144 fitting orderings. Our name list alone gives 1.2 million more.
- **Cycling.** The 0 x 3 triple and the A, N, M pairs force cycle breaks on almost every reading:
  - Among the 625,218 simple fits, only 57 have none; 497,424 have 4 or 5.
  - So the 4-6 breaks of Garlick's, TheDecipherist's and the NEUMAN readings are typical of fits
    in general and do not separate claims.
  - What they do say is about Z13 itself. Read as Zodiac's usual cycled homophonic cipher, every
    candidate needs him to reuse symbols that he reused only 6.8% of the time in Z408 and Z340.
    This agrees with phase 1: the repeated symbols are more likely single-homophone letters,
    nulls or separators.

### The Z13 Solutions wiki list (1,153 strings)

- **Fit "as is":** there are 1,028 direct readings (the 1,027 "as is" entries plus THE BIG
  SECRETE on the circles_distinct variant). Of these, 1,023 fit homophonically and 243 by simple
  substitution.
- **Do not fit as listed:**
  - Two have 12 letters: "Training Neat" and "Regan Adalard", probably copying slips on the wiki.
  - Three have conflicts: "Extras Adopted" (circle = A and O; the list also has the fitting
    "Extras Adapted"), "I Was a Canadian", and "Frank X. LeLoafe".
- **Anagram entries:** all 123 (the 122 anagrams plus DEBBIE FARADAY's split reading) have the
  right letter profile.
- **Language scores:** the best-scoring as-is entries are Lebanon Enable (-8.77), of These Newton
  (-8.90) and Chief of Africa (-9.22). Even these have 3-5 simple word fits above them. The
  enumeration's best is A DEFINITIVE AT (-8.31).
- **No entry carries any external support,** and most were posted as demonstrations of the null.
- **Verdicts:** 1,148 indistinguishable from chance, 5 incompatible (per-row reasons in
  `audit.csv`, ids W13-0001 to W13-1153).

## Z32: proposals

| id | who | claim | fit | key vs Zodiac | natural-English fits scoring higher (of 743) | verdict |
|---|---|---|---|---|---|---|
| Z32-04 | Roberts 2014 | IS IN FRONT LEFT CORNER ... I DIE | 62 letters for 32 symbols | - | - | incompatible |
| Z32-06 | Grinell 2018 | RADIANS AND 5 INCHES ALONG THE RADIANS | 2 conflicts (open triangle = A and S; O = N and C) | - | - | incompatible |
| Z32-07 / -21 | DMW 2019; Stampher 2026 | IN THREE AND THREE EIGHTHS RADIANS TEN | homophonic fit | H needs 4 symbols (Zodiac's keys had at most 2) | 646 (87%); log P -27.19 | compatible, indistinguishable from chance |
| Z32-08 | Burke 2019 | OKAY I SEVEN INS SOUTH OF DIABLO MT PEAK | fit | within | 735 (99%); -35.06 | compatible, indistinguishable from chance |
| Z32-09 | Grinell 2020; InStepWithTheStars | ESTIMATE FOUR RADIANS AND FIVE INCHES | fit | within | 521 (70%); -24.35 | compatible, indistinguishable from chance |
| Z32-10 | Ziraoui 2021 | LABOR DAY FIND 45.609 NORT 58.719 WEST | no 1:1 reading; checked step by step (below) | - | - | indistinguishable from chance |
| Z32-12 | Boyouk 2022 | IF ONLY YOU WOULD ARRIVE BY RESIDENCE CELO I AM | 38 letters | - | - | incompatible |
| Z32-14 | Cragle 2022 | THREE RADIANS FROM MOUNT AREA TWO INCH | fit | M needs 2 symbols (keys had 1) | 662 (89%); -27.74 | compatible, indistinguishable from chance |
| Z32-15 | Foxon 2023 (a) | TWELVE INCHES ALONG THE THREE RADIANS | 3 conflicts direct; 0 under some order of a two-row decimation family | H 3 > 2 | - | indistinguishable from chance |
| Z32-16 | Foxon 2023 (b) | THREE RADIANS AND TWELVE INCHES ALONG | 3 direct; best order 1 conflict | within | - | indistinguishable from chance |
| Z32-17 | "NoName" 2024 | I AM BACK HERE UP NORTH OF ROAD BLACKHAWK | 33 letters | - | - | incompatible |
| Z32-24 | Pelling (demonstration) | DSBELISHOURTWICHTHEKINGMADEARSES | fit | H 3 > 2 | 742; -42.00 | demonstration of the null |
| Z32-03, -13, -22, -23 | Sundberg & Thelin; Shaqmeister; Dickinson; Praetorian | glyph chemistry; Telugu; counts as inches; trigram waypoints | not substitution readings | - | - | indistinguishable from chance (free parameters) |
| Z32-01, -02, -05, -11, -18, -19, -20, -25 | Penn; pi1; Cobb; Case Breakers; Garlick 2025; Baber; Dominik; Lewison | no plaintext | - | - | - | untestable |

Every one of the 8 solver fits from a 3.7-second anneal run scores higher than each of the four
direct fits: DMW / Stampher, Burke, Grinell and Cragle. The natural-English windows that fit Z32 read far better than any claim. The best are
ALMOST IMMEDIATELY AFTER HIS ARRIVAL (-12.29), A FEW MONTHS BEFORE THE DECLARATION OF (-12.64)
and AND THIS IS THE FIRST TIME YOU HAVE BEEN (-13.81). Their median is -22.30; every published
fit scores below it.

### Claim-specific checks (Z32)

- **Ziraoui** (checked mechanically):
  - The Z340 key gives YNSETAI?DOBP?AORTRDFNOPTIYRGAIWN.
  - The units digits of A1Z26 at positions 20-24 and 25-29 give 45609 and 58719, exactly his
    numbers.
  - The other 20 letters must be anagrammed into LABOR DAY FIND NORT WEST. They lack an L, have a
    spare P (PABOR to LABOR), and two symbols are dropped.
  - Each step (key reuse, which positions become digits, the digit rule, a free anagram of 20
    letters, a letter change, geomagnetic coordinates) is a free choice. Oranchak showed the Z13
    half of the same method yields other suspects.
- **Foxon** (transposition):
  - We built a family of 3,264 read orders: the 17 + 15 layout with line 2 offset by 0-2, then a
    two-row decimation with column step 1-16, any start column and start row, forwards and
    backwards.
  - Candidate a fits exactly under at least one order, and 594 orders leave at most 2 conflicts.
    Candidate b's best order leaves 1 conflict.
  - Of 1,000 random natural-English 32-letter windows, **256 fit exactly** under some order in
    the same family, and all 1,000 reach at most 1 conflict.
  - Foxon's exact order is not reproduced here, and he also needed two misspellings. With this
    much freedom a fit carries no information; he himself called it not convincing.
- **Stampher** (same plaintext as DMW):
  - His funnel passed 61 of 154,572 32-letter phrases through the three repeat "locks"
    (1 in 2,534), then 54 through the map bounds.
  - Natural-English windows pass the locks at 1 in 4,465. The locks selected at roughly the
    chance rate for phrase-like text.
  - The 54 map-plausible survivors were not narrowed down by anything independent of the choice.
- **The radians-and-inches family.**
  - About 5.1 million sentences of our small grammar fit Z32.
  - DMW's sentence: 19 of the 1,045 sampled fitting grammar sentences score higher, an estimated
    ~93,000 in the whole family.
  - Grinell's and Foxon's: 1 of 1,045 sampled scores higher, so roughly 5,000 in the family.
    That estimate rests on a single sample and has a wide margin.
  - The grammar is crude and most of its sentences are word salad. The point is only that
    "it mentions radians and inches" picks out millions of fits, not a handful.
  - The DMW / Stampher reading needs H to take 4 different symbols. Both of Zodiac's keys had at
    most 2 for H, but 605 of the 743 natural-English fits have an excess this small or smaller.
    So this is weak evidence against that reading, not a refutation.
- **Praetorian 2026** depends on two low-plausibility transcription choices: open and filled
  triangles merged (z32.triangles_merged), and position 3 read as the letter I
  (z32.bar_is_serif_I). It also relabels several glyphs and brute-forces 22,500 + 1,476 parameter
  combinations.

## What would count as evidence

None of the following exists for any proposal. Each one names a test the plaintext was not
fitted to:

- a carried-over key that beats a key-reuse null;
- a reading whose implied key cycles the way Zodiac's keys did;
- a prediction checked afterwards, such as an object at the map point;
- a source text or worksheet.

For Z32 every 1:1 claim also has to beat the 743 natural-English fits and the solver output on
fluency. None comes close.

## Caveats

- The word fits are bounded searches: at most 4 words from the top 20,000. Counts of "fits
  scoring higher" are lower bounds on the true number of alternatives.
- The language model is a web-count word model. A name scores by its frequency as a word, so
  name claims are better judged by the name counts (Baber section) than by log P.
- The Z13 natural-English null has only 2 fits in 4.86 million windows. Z13 ranks therefore rest
  on the word enumeration.
- The grammar null and the Foxon family are our constructions. Different glue lists or
  transposition families change the counts, though not their order of magnitude in the tests we
  ran.
- Reported but unverified claims (Baber's grid, Garlick's Z32) were tested only where they had
  been described.
- Only 8 solver fits from an existing run were used. A dedicated 400-restart solver run was
  queued but cancelled because the shared machine's slots were full.

## Not run

The second half of `tools/audit_enum.sh` waited about 100 minutes in the shared slot runner and
never got a slot, so it was cancelled. It held:

- the word-scored homophonic Z13 enumeration (its complete count, 4,151,724, is in
  `z13_canon_homo_count.json`);
- the one-slip enumerations;
- the FIRST INITIAL LAST name enumerations.

The homophonic, one-slip and name columns of `audit.csv` are therefore empty. Homophonic ranks
are given as lower bounds from the simple-substitution subset. Every verdict above stands without
these runs, because they could only add alternatives. The runner skips finished parts, so
`bash tools/audit_enum.sh <scratch>` in a slot, followed by `audit_check.js`, fills them in.

## Files

| file | what |
|---|---|
| `audit.csv` | one row per proposal: 43 named + 1,153 wiki strings; all columns described in Method |
| `audit_details.json` | calibration, references, every special analysis, wiki summary |
| `tables.md` | generated tables and the full verdict reasons (`node tools/audit_tables.js`) |
| `proposals.json` | hand-compiled named proposals with sources |
| `wiki_z13_entries.tsv` | parsed wiki list |
| `cipherjs_checks.txt` | `tools/cipher.js` checkCandidate cross-check |
| `corpus_ref.json`, `z32_theme.json` | natural-English and grammar nulls |
| `enum/*.json` | enumeration summaries (streams in the session scratchpad, not kept) |
| `ciphers/` | derived variants: circles_as_spaces, one-slip variants, Z32 reversed |
| `special_cache.json` | cached name and transposition nulls (the slowest step, about 3 minutes) |
| `corpus_ref_heldout.json` | the same natural-English null on the 17 held-out books only (11 Z32 fits); superseded by `corpus_ref.json` |
| `z13_canon_homo_count.json` | complete count of homophonic Z13 word fits (no scores) |
| `*_log.txt` | console logs of the runs |

To reproduce, run `python tools/audit_wiki_parse.py`, then `node tools/audit_make_ciphers.js`,
`node tools/audit_corpus_ref.js --docs all --reservoir 3000` and
`node tools/audit_z32_theme.js --samples 3000000`. Then, in a slot, run
`bash tools/audit_enum.sh <scratch>`. Finally run
`node tools/audit_check.js --scratch <scratch> --null-names 300 --null-phrases 1000`, then
`node tools/audit_tables.js > results/audit/tables.md` and `node tools/audit_cipherjs_check.js`.
