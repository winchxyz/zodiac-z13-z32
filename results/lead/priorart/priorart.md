# Prior-art check for the Z13 / Z32 lead findings (task `priorart`)

Written 2026-10-07. For each candidate finding F1-F10 this file says whether it had already been
published, and by whom. Verdicts:

- **NOVEL**: nothing equivalent found.
- **PARTLY KNOWN**: the idea or a qualitative version was published; the quantitative result is ours.
- **KNOWN**: published before, with the same substance.

Every number below comes from a page we fetched (saved under `results/lead/priorart/pages/`;
those copies are not redistributed, and `pages_index.md` maps each file name to its URL) or
from a script run in this task. Quotations are avoided; sources are paraphrased.

Searched: zodiackillerciphers.com (blog, wiki, data files, forum topic index pages 1-5 and the
relevant threads), the descriptions of David Oranchak's *Let's Crack Zodiac* episodes (fetched for
episodes 6, 9, 11, 23, 24, 26, 27 parts 1-3 and the Aug 2026 news update), arXiv:2403.17350
(Oranchak, Blake and Van Eycke) and its §2.3 reference list, Cipher Mysteries (the Z32 page with
all its comments, the 2017 Z13 post with comments, and the 2017 post on Zodiac's cryptographic
head), zodiackillerfacts.com (radian, map and blog pages), Foxon's ePrint 2023/982 (landing
page; the PDF was blocked, so we used the project's earlier reading in
`research/z32_literature.md`), the Garlick material, Grinell's zodiacciphers.com, DMW's 2019 PDF,
Stampher (GitHub README, Zenodo, Cipher Mysteries and forum comments), Ziraoui, the Baber material
(Connelly's *Killer in the Code* chapter 4 transcript, Hodel 2026, 0xfab1, Oranchak's show notes,
TheDecipherist, Graveline, the Pantheon gist), stevehodel.com, Francesco Amicone's blog, Matthew
Dominik's Zenodo preprints, Raddum and Sýs (2010), and the arXiv API. Access problems are listed
at the end.

## Summary table

| # | Finding (short) | Verdict | What was already known | Key citations | What is new here |
|---|---|---|---|---|---|
| F1 | Z340 key pinned on Z13's six shared symbols gives completions more English-like than random keys (family-wise p 0.005-0.01, permuted, stratified and conditional nulls); Z408 key and Z32 show nothing | **PARTLY KNOWN** (the idea is known; the test is novel) | Reading Z13 with the Z340 key (DREA?A?O??EDO) and filling the two free symbols by hand: Garlick (DR EAT A TO[T/R]PEDO, circle T, hook P), Ziraoui, Marclean, T.C. Reading Z13 with the Z408 key: Oranchak 2013. Key carry-over on Z32: Ziraoui (Z340 key), Garlick (Z408 key). The 2024 paper names solid links to the solved ciphers as one way a short-cipher solution could be confirmed, but tests nothing. | Garlick: forum thread 2020-12-22; Ep. 23 (2025-04-08); Ep. 24 (2025-08-12). Marclean, forum 2020-12-21. Oranchak 2013-09-15 (update 9/18). T.C. blog 2025-07-14. arXiv:2403.17350 §8.2.1. | No significance test of key carry-over was found anywhere: no random, permuted, stratified or conditional key nulls, no exhaustive ranking of the free symbols, no Z408-vs-Z340 contrast, no Z32 null result. |
| F2 | Generative model of Zodiac's homophone choice, and Bayes factors (Z13's pattern favours a near-simple key by 10^2.7-10^3.8; distinct circles by 10^2-10^4.5) | **PARTLY KNOWN** (ingredients known; model and Bayes factors novel) | Z408 cycles unbroken until part 3 (Oranchak). Automatic cycle detection (King and Bahler 1993); cycle counts in Z340 (Raddum and Sýs 2010). Z340: weaker cycling, no repeats inside 17-wide windows, 9 repeat-free rows, symbols assigned in horizontal order (2024 paper §3). Row-sized non-repeating segments (Van Eycke). Homophones allotted roughly by letter frequency (textbook). Z13's many repeats suggest a monoalphabetic cipher (Pelling 2017, qualitative). | Oranchak, `408/key.html`; arXiv:2403.17350 §2.3, §3; Ep. 9 description (links Van Eycke's post); Pelling 2017-12-16. | The fitted model (cycle-follow rate, within-row avoidance, no row resets, homophone count proportional to frequency^0.88). The two Bayes factors. Nobody had quantified either comparison. |
| F3 | No 5-symbol window in the 748 solved symbols holds one symbol 3 times; Oranchak's 22/15 windows | **KNOWN** (22/15) plus **NOVEL** (5-window fact) | Oranchak 2012: the smallest window with as many repeats as Z13 is 22 symbols in Z408 and 15 in Z340. Related and known: Z340 avoids repeats within 17-wide windows. | Oranchak, "Gutenberg addendum: Small ciphers", 2012-08-11 | Reproduced here (`windows.json`). The 22/15 figures hold for Z13's exact profile: one symbol 3 times plus three symbols twice, in written order. A looser count of 5 extra occurrences needs only 18 (Z408) and 15 (Z340 written); Z340 in reading order needs 14. No 5-window holds a symbol 3 times: 0 in Z408, Z340 written and Z340 reading order. We did not find this published. |
| F4 | MARVIN MERRILL fails all columnar transpositions of width 2-8 | **PARTLY KNOWN** (direct-reading failure known; transposition test novel, but the wording needs correcting) | The direct reading fails the repeat pattern (Hodel; 0xfab1). The method described by Baber and Henry: a 2x7 grid with one null, the seven columns shuffled by the keyword (L)IZABETH. A public Colab notebook implements this box permutation; a summary of it says it yields a few dozen names, MARVINMERRILL among them. Stampher found the steps arbitrary; Oranchak's Ep. 27 part 1 covers the codebreaking. | Hodel 2026-02-23; *Killer in the Code* ch. 4 transcript (c. 2026-01-22); 0xfab1 Z13 page; Colab notebook (sign-in required, not read); Ep. 27 part 1 (2026-05-15); Stampher, Cipher Mysteries 2026-03-14 | Nobody had shown that the name fails every transposition of the described kind. Re-run here on the described scheme: 0 of 423,922 distinct 2x7 orders fit under the canonical, bracket_is_perp and reversed readings, simple or homophonic. The only fits are 91 homophonic ones under circles_distinct, and none uses the LIZABETH column order. Random names with the same letter profile pass 4% (box) and 8% (columnar) of the time. The audit's 92,464 columnar orders (92,323 distinct) put blanks only at the end of the last row, not anywhere. |
| F5 | Foxon's Z32 transposition family lets about 15-25% of random English windows fit; his order reproduces his two declared misspellings | **NOVEL** (Foxon's own caveats known) | Foxon himself calls the three repeats a weak restriction, calls his candidate unconvincing, and declares the two misspellings. The general point that Z32 is non-unique is known. | Foxon, IACR ePrint 2023/982 (2023-06-26); Oranchak 2014-02-07; arXiv:2403.17350 §8.2.1 | No critique quantifying the fit rate of his transposition family was found. Only Dominik's preprints cite the paper, and they do not engage with it. |
| F6 | The "radians and inches" grammar fits Z32 at exactly the null rate (P = 0.60); about 1 in 3,800-5,400 English windows fit | **PARTLY KNOWN** (non-uniqueness and grammar enumeration known; the null comparison is novel) | Non-uniqueness of Z32: Oranchak 2014, the 2024 paper, DMW, Foxon. Grammar enumeration: Stampher generated 2,044,224 phrases; 154,572 have 32 letters, 61 pass the three repeats (1 in 2,534) and 54 lie on the map. He made no null comparison. Dominik (2026-09-17) ran a 780,840-composition grammar search and found the constraints not unique. | Stampher GitHub README; Zenodo 18645227 (Feb 2026); Dominik, Zenodo 22817822 | Comparing the grammar's fit rate with random 3-pair repeat patterns: Z32's positions are no more grammar-friendly than chance. No published rate for random English windows was found; our earlier 1-in-3,500 estimate was internal. |
| F7 | Map facts: printed north about 4.6° west of true; scale bar about 9% too long (7.0-7.2 ground mi per paper inch); drawn 0-arm 2-3° from map-up, not magnetic north; Blue Rock Springs 0.5-1.1 mi beyond the top edge | **KNOWN** (except the Blue Rock Springs distance) | shaqmeister (forum, 2026-05-12): map north about 4.6° west of true north, scale about 7.02 mi/in rather than 6.4. He also checked that the 8-mile bar is 1.25 in on the exemplar, and gave 7.06 mi/in in Sept 2026. Marclean (2023-07-29): the map's inch scale is wrong. Amicone (2020-08-05): the drawn axis leans about 2° east, and the map scale is wrong. VT_Squire (2025-10-09): wrong north, no consistent scale. ZKF (2007-2011): Blue Rock Springs just above the top border. Hodel 2010, DMW 2019 and ZKF: the cross must be turned about 17° for magnetic north. | forum threads "Plotting your Z32 Solution using Google Maps (if you must)", "My z32 candidate", "Map escale error"; ostellovolante.com; Cipher Mysteries Z32 comments; zodiackillerfacts.com/radian.htm | Only an independent confirmation: a 7-landmark least-squares fit (rms 0.23 mi) with explicit uncertainty, and the Blue Rock Springs distance beyond the edge (0.5-1.1 mi). The headline numbers should be credited to shaqmeister. |
| F8 | Lake Herman Road is 1 radian counter-clockwise of 1970 magnetic north from the Mt. Diablo summit, 3 in at 6.4 mi/in, landing about 0.13 mi from the site | **PARTLY KNOWN** (the angle is known; the full construction and p-value are novel) | ZKF illustration (image dated 2011-03-09): from Mt. Diablo, magnetic north to Lake Herman Road is roughly one radian. Hodel 2010: about 60° from magnetic north toward Vallejo. Grinell (c. 2024): the 10 o'clock magnetic line passes over Lake Herman Road and Blue Rock Springs. DMW 2019: counter-clockwise, Allen's Vallejo address is about 1.05 rad from magnetic north at 3.36 map inches. Penn: one radian between the Blue Rock Springs and Stine legs, a different construction. | zodiackillerfacts.com "Radians & Inches" page and image; stevehodel.com 2010-08-29; zodiacciphers.com radians category; DMW PDF (2019-03-01) | The exact pairing of 1.000 rad with 3 in at the printed scale, the 0.13 mi miss distance, and the post-hoc p-value. Not found published. |
| F9 | Under strict substitution, the MAP reading of Z13 with a 6-gram model is IN THE DESERT IS, which counts against the fluent-phrase hypothesis | **PARTLY KNOWN** (the phrase is known; the MAP status and the argument are novel) | Oranchak 2012 lists "My name is: in the desert is" among his Project Gutenberg fits. In his data file it occurs 145 times, the 5th most frequent of 2,767 unique fits, and ranks 95th by zkdecrypto score. | Oranchak 2012-08-11; `zodiackillerciphers.com/data/constraint-search-13-data-uniq-sorted-by-zkscore.txt` | That it is the n-gram MAP. The argument that the best-scoring strict fit is nonsense after "My name is", which counts against the hypothesis. |
| F10 | No named suspect (36 people, 386 renderings) fits Z13 except under circles_distinct with forced filler, where suspects fit no more often than random names (p = 0.69) | **PARTLY KNOWN** (ad hoc checks known; the systematic suspect test is novel) | Oranchak 2013: about 0.5 billion name combinations from 100 million names gave 213 fits. Single-suspect checks: Oranchak on Lafferty's Grant (2012) and on Stewart's EARL VAN BEST JR (2014); Hodel and 0xfab1 on MARVIN MERRILL; Bauer on ALFRED E NEUMAN (one slip). Quicktrader (2021-05-27): about 30,000 real names, none fit. Stampher (Cipher Mysteries, Mar 2026): about 31,000 Vallejo 1968-69 directory names, none fit even with common transpositions, about 5 one character off. | Oranchak 2013-09-15; forum "All features present in the z13 cipher"; Cipher Mysteries 2017 Z13 post, comments of March 2026 | A systematic test of a named-suspect list across readings with a random-name null, and the one-slip analysis. |

## Details and citations

### F1: key carry-over from Z340 to Z13 (and Z32)

Published before:
- **Ryan Garlick.**
  - PDF (Dec 2020) discussed in the forum thread "Ryan Garlick's Z13 solution" (2020-12-22).
  - Video: *Let's Crack Zodiac #23* (2025-04-08, youtube.com/watch?v=tqwVEU5hapk).
  - Uses the Z340 key with circle = T and hooked T = P, giving DR EAT A TOTPEDO, read as "torpedo".
  - Wikipedia's Zodiac Killer article cites the video.
  - Marclean (forum, 2026-09-06) paraphrases Garlick as assigning P, R and T to the unmapped
    symbols, which would need a different circle at position 8. This is unverified: no transcript
    was available.
- **Marclean** (forum thread "Symbols and letters 340 Key", 2020-12-20/21). Applied the Z408 and
  Z340 keys to Z13 and Z32 and remarked on keyboard adjacency (WEEDSDREA). No statistics.
- **Fayçal Ziraoui** (forum, 2021-01-19). The Z340 key is step 1 of his multi-step Z13 and Z32
  decodes. Oranchak reviewed them in Ep. 11 (2021-11-28, chapter "The problem with existing keys
  and intermediate steps").
- **T.C. ("SDS")** (Tapatalk, May 2024; blog 2025-07-14). Applies the Z340 key, then gives the
  circles different letters by position.
- **Oranchak**, "My Name Is… Sarah The Horse?" (2013-09-15, updated 9/18). Applies the Z408 key
  to Z13: WEED_S_HREWH.
- **Z32 carry-over.**
  - Ziraoui (Z340 key, 2021).
  - Garlick, *Let's Crack Zodiac #24* (2025-08-12), chapter "Solutions using Z408's key".
    Oranchak's response chapter, "Alternative solutions using Ryan's method", argues
    non-uniqueness (from the description; no transcript).
  - AZdecrypt ships a "Zodiac 32 with 408 key" file.
- **arXiv:2403.17350 §8.2.1** names, among possible confirmations, solid connections between the
  solved ciphers and Z13 or Z32. It runs no test.
- **Adjacent work, not equivalent.**
  - Northkey (forum, 2026-10-05) uses the N→E mapping shared by both keys in a repeat-distance
    construction (HELLO), with a randomized-layout null. That is a different hypothesis and test.
  - Matthew Dominik's Zenodo preprints (2025-11-08 to 2026-09-17) relate Z13 to the Z340
    structure but report no key-carry-over significance test.

Not found anywhere: a permuted-key or random-key null for the English-likeness of key-pinned
completions, family-wise correction, conditional or glyph-stratified nulls, the result that the
real assignment beats all 360 rearrangements of its own letters, or the Z408 and Z32 null
results. **The core statistical claim of F1 appears new.** Caveats:
- Video transcripts of Ep. 23 and 24 could not be retrieved, so an informal on-camera enumeration
  of the free symbols cannot be ruled out.
- Reddit and the now-offline zodiackillersite.com could not be searched. The zodiackillersite
  thread "Z13 key has arrived!" (date unknown) is indexed with a summary saying Z13 combines the
  Z408 and Z340 keys. Its content could not be read.

### F2: homophone-selection model and Bayes factors

Known ingredients:
- Oranchak's annotated Z408 key (`zodiackillerciphers.com/408/key.html`, "Homophone cycles"):
  most cycles stay unbroken until part 3, and the H cycle repeats perfectly.
- King and Bahler (Cryptologia 1993) detected cyclic homophones automatically in Z408.
- Raddum and Sýs (Tatra Mt. Math. Publ. 45, 2010) counted cycles in Z340.
- arXiv:2403.17350 §3 (2024):
  - Z340's cycling is weaker than Z408's.
  - Symbols rarely repeat within a 17-wide window.
  - Nine rows have no repeated symbol.
  - The authors suggest symbols were assigned in horizontal order.
- Jarl Van Eycke's row-sized non-repeating segments: zodiackillersite p=50807, linked from the
  Ep. 9 description (2021-06-09).
- Allocating homophones in proportion to letter frequency is standard background (arXiv §1).
- Nick Pelling (Cipher Mysteries, 2017-12-16) argues qualitatively that Z13's many repeats point
  to a monoalphabetic cipher.
- **Distinct circles.** No prior author argued from Zodiac's own habits that the three circles
  are different symbols. Readings that implicitly treat them as different exist: T.C. 2025;
  Kelleher's wildcards (wiki); possibly Garlick's TORPEDO.

New: the fitted generative model and both Bayes factors.

### F3: windows

Oranchak, "Gutenberg addendum: Small ciphers" (2012-08-11): a 22-symbol window of Z408 and a
15-symbol window of Z340 are the smallest with as many repeats as Z13. **Confirmed here**
(`python tools/lead_priorart_windows.py`, output `windows.json`):

| text | smallest window, profile 3+2+2+2 | smallest window, 5 extra occurrences | 5-windows with one symbol 3 times |
|---|---|---|---|
| Z408 (408) | 22 (start 107) | 18 (start 383, which overlaps the 18-letter tail) | 0 |
| Z408, first 390 | 22 | 19 (start 314) | 0 |
| Z340, written order | 15 (start 279) | 15 | 0 |
| Z340, reading order | 14 (start 144) | 14 | 0 |

So Oranchak's figures match the exact-profile definition. The "no 5-window triple in 748
symbols" fact was not found in print.

### F4: MARVIN MERRILL under transposition

Known:
- **The described method.** Michael Connelly's *Killer in the Code*, chapter 4 transcript (PDF,
  version stamp 2026-01-22):
  - two rows of seven with a blank or null;
  - the columns shuffled first, then substitution;
  - the keyword (L)IZABETH, attributed to Patrick Henry.
- **Direct-reading failure.** Steve Hodel, "Z13 Reality Check" (2026-02-23), and the 0xfab1
  "Zodiac Z13" page (2026). The latter describes a public Colab notebook that implements the box
  permutation. A search-engine summary says it yields a few dozen names, MARVINMERRILL among them;
  the notebook itself needs a sign-in and was not read.
- **Other criticism.** Oranchak, *Sherlock or Charlatan?* part 1 (2026-05-15, description only);
  David Stampher (Cipher Mysteries comment, 2026-03-14) found the transposition steps arbitrary.

New, run in this task (`python tools/lead_priorart_boxperm.py --names 300 --seed 2026` via the
slot runner, output `boxperm.json`):

**The family tested:**
- the null at any of the 14 positions;
- all 5,040 column orders, including the reported LIZABETH numbering 6 5 1 2 3 7 4 and its
  inverse;
- row-major or column-major fill and read;
- optional row swap;
- both the encryption and decryption directions.

**Results:**
- The family has 423,922 distinct orders.
- MARVINMERRILL fits 0 of them, simple or homophonic, under the canonical, bracket_is_perp and
  reversed transcriptions.
- Under circles_distinct it fits 91 orders, homophonically only. None of the 91 uses the
  LIZABETH order.
- The audit's columnar family has 92,323 distinct orders and 0 fits.
- Null: of 300 random first+last names with Z13's letter-count profile, 4% fit at least one
  plain-box order and 8% at least one columnar order.

**Correction for the project's wording:**
- The audit placed blank cells only at the end of the last row, not at arbitrary positions.
- The stronger statement is the 2x7 result above.
- The notebook claim that MARVINMERRILL is among the names produced cannot be reproduced under any
  transcription we hold.

### F5: Foxon

Foxon, "On the 32-Character Zodiac Cipher", IACR ePrint 2023/982 (received 2023-06-23, posted
2023-06-26). As recorded in `research/z32_literature.md`, the paper itself:
- calls the repeats a weak restriction;
- calls its candidate not particularly convincing;
- declares the two misspellings.

No response paper, forum critique or blog quantifying how often English fits his transposition was
found. Citing works found: Dominik (Zenodo 18202334, 2026-01-09); it does not engage with the
transposition.

### F6: radians grammar

Known:
- Oranchak, "Swedes crack Zodiac's map code?" (2014-02-07): numerous solutions fit Z32.
- arXiv:2403.17350 §8.2.1: plausible Z32 plaintexts are almost trivial to generate.
- DMW (PDF, 2019-03-01) concedes non-uniqueness.
- **David Stampher** (GitHub `dstampher/zodiac-z32-cipher`; Zenodo 18645227, Feb 2026; SSRN
  6266638): generated 2,044,224 radians/inches phrases. Of these, 154,572 have 32 letters, 61 pass
  the three repeat constraints (61/154,572 = 1 in 2,534) and 54 lie inside the map. He makes no
  comparison with random repeat patterns.
- Dominik (Zenodo 22817822, 2026-09-17) reports a 780,840-composition grammar search whose
  constraints do not single out one plaintext.

New: the null comparison (P = 0.60) and the English-window rate.

### F7: map geometry

Known:
- **shaqmeister** (forum "Plotting your Z32 Solution using Google Maps (if you must)",
  2026-05-12):
  - He concluded the inset is misaligned about 4.6° west of true north.
  - He put the scale at about 7.02 mi per inch, against the printed 6.4.
  - He first checked that the 8-mile bar measures 1.25 in on Butterfield's exemplar photograph.
  - In "My z32 candidate" (Sept 2026) he gives 7.06 mi/in and a northing error of about 5°.
  - 7.02/6.4 = 1.097, i.e. the same "about 9-10% too long" bar as ours.
- **Marclean**, forum "Map escale error" (2023-07-29): the map's inch scale is wrong, by comparison
  with Google Earth. No magnitude given.
- **Francesco Amicone**, ostellovolante.com (2020-08-05; first version 2018-19):
  - the drawn compass axis is about 2° east of the map's vertical;
  - the map scale is wrong (about 16 real miles against about 14 at the printed scale).
- **VT_Squire** (Cipher Mysteries comment, 2025-10-09): the map does not show true north
  correctly and has no consistent unit of distance.
- **Mike Butterfield**, zodiackillerfacts.com (©2007-2011):
  - Lake Herman Road is visible at the top of the inset;
  - Blue Rock Springs Park would sit just above the northern border.
- That the drawn 0 is not magnetic north: Hodel 2010, DMW 2019 and ZKF each turn the cross about
  17°.

New: only our independent fit and its uncertainty, and the Blue Rock Springs offset (0.5-1.1 mi).

### F8: Lake Herman Road radian

Known:
- **zodiackillerfacts.com**, "Radians & Inches" page: a protractor illustration (EXIF date
  2011-03-09) captioned to say that, from Mt. Diablo, the distance from magnetic north to Lake
  Herman Road is about one radian.
- **Steve Hodel** (2010-08-29): about 60° from magnetic north to a line toward Vallejo.
- **Richard Grinell** (zodiacciphers.com, c. 2024-02-22): the 10 o'clock line from magnetic north
  passes over Lake Herman Road and Blue Rock Springs.
- **DMW** (2019): taken counter-clockwise, 32 Fresno St., Vallejo is about 1.05 rad from magnetic
  north, at 3.36 map inches.
- **Penn's radian** is a different construction: the angle between the Blue Rock Springs and
  Stine legs. ZKF has debunked it.

New: the 3-inch distance match and the probability estimate.

### F9: IN THE DESERT IS

Oranchak 2012-08-11 lists it as an example fit. Data file `constraint-search-13-data-uniq-sorted-by-zkscore.txt`
(2,767 rows; fetched and counted here): 145 occurrences in Project Gutenberg, the 5th most
frequent; zkdecrypto score 1276.0, 95th of 2,767.

### F10: suspect names

- Oranchak 2013-09-15: 213 fits among about 0.5 billion name combinations.
- Oranchak 2012-06-16 on Lafferty's Grant, and 2014-09-10 on Stewart's Earl Van Best Jr.
- Hodel 2026 and 0xfab1 2026 on MARVIN MERRILL.
- Bauer 2017 on ALFRED E NEUMAN.
- Quicktrader, forum "All features present in the z13 cipher", 2021-05-27: about 30,000 names,
  none fit.
- Stampher, Cipher Mysteries Z13 post comments, March 2026: Vallejo 1968-69 city directory, about
  31,000 names, none fit even after common transpositions, about 5 one character off.

## Scripts and outputs from this task

| command | output |
|---|---|
| `python tools/lead_priorart_yt.py <ids>` / `--search <words>` | `yt/<id>.json` (titles, dates, descriptions) |
| `python tools/lead_priorart_kwic.py FILES -- KEYWORDS` | `.txt` copies of saved pages |
| `node tools/run_slot.js --label priorart -- python tools/lead_priorart_boxperm.py --names 300 --seed 2026` | `boxperm.json`, `boxperm_log.txt` |
| `python tools/lead_priorart_windows.py` | `windows.json` |

Two scripts tried to fetch YouTube captions; both failed (HTTP 400, or empty bodies), and they
are not included in this repository.

## Gaps

- **YouTube.** No transcripts for any *Let's Crack Zodiac* episode, so only descriptions and
  chapter lists were read. Most important for F1 (Ep. 23, 24) and F4 (Ep. 27 part 1).
- **Reddit** (r/ZodiacKiller, r/codes): the search tool refuses the domain, and the JSON endpoint
  returned a block page. Per the NYT (2021), r/ZodiacKiller deletes Z13 solution posts.
- **Other sites that could not be read:**
  - Tapatalk (Voigt's forum): HTTP 403.
  - zodiackillersite.com: now returns 404, and the Wayback Machine refused requests (429).
  - zodiackiller.com: JavaScript challenge.
  - Medium and SSRN: 403.
  - The Colab notebook: needs a sign-in.
  - Foxon's PDF: blocked, so the project's earlier notes were used.
- **Scholarly search.** The arXiv API finds only arXiv:2403.17350 for "zodiac" AND "cipher".
  Semantic Scholar rate-limited us (429). Google Scholar was not queried directly; web searches
  restricted to tandfonline, ResearchGate and Semantic Scholar found nothing on Z13 or Z32 beyond
  Foxon.
