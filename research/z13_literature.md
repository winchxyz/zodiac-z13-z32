# Z13: the "My name is" cipher (literature notes)

Compiled 2026-10-07 for the Z13/Z32 attack project. The canonical data file is
`data/ciphers/z13.json`. Every non-obvious claim has a URL. **Verified** means I checked it myself
against a primary scan or by computation. Other statements are attributed to their source.

---

## 1. Status in one paragraph

Z13 is 13 symbols on one line, written after the words "My name is" in a letter to the
*San Francisco Chronicle* postmarked April 20, 1970
([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)). It is unsolved. The Z340 solvers
(Oranchak, Blake, Van Eycke) write that under minimal assumptions Z13 is below the unicity
distance, that thousands of fitting solutions can be generated, and that no known test can
falsify or validate a candidate ([arXiv:2403.17350, §8.2.1](https://arxiv.org/abs/2403.17350)).
Oranchak told the *New York Times* it is "practically impossible to determine if any of them are
correct" ([NYT, 2021-06-22](https://www.nytimes.com/2021/06/22/world/europe/france-zodiac-killer-cipher.html),
quoted in [Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)).

---

## 2. Transcription

### 2.1 Canonical ASCII (Oranchak / AZdecrypt convention)

```
AENz0K0M0[NAM        isomorph: abcdefegehcag     length 13, 8 distinct symbols
```

| Source | As given | Independent? |
|---|---|---|
| Zodiac Killer Ciphers Wiki, ["Unsolved 13-character 'My name is' cipher"](https://zodiackillerciphers.com/wiki/index.php?title=Unsolved_13-character_%22My_name_is%22_cipher) | `AENz0K0M0[NAM` | Oranchak |
| Oranchak's Cipher Explorer, [`zodiac.js`](https://zodiackillerciphers.com/cipher-explorer/zodiac.js?v=3) (entry `//z13`) | `AENz0K0M0[NAM` | Oranchak |
| AZdecrypt bundled file [`Zodiac 13.txt`](https://github.com/doranchak/azdecrypt/blob/main/AZdecrypt/Ciphers/Zodiac%20ciphers/Zodiac%2013.txt) | `AENz0K0M0[NAM` | same convention |
| Webtoy symbol map, [`webtoy/zodiac.js`](https://zodiackillerciphers.com/webtoy/zodiac.js?v=1), `getName()` | `z`=zodiac, `0`=taurus, `[`=t2; `0`, `[` and `?` are commented as "symbols unique to 13- and 32-character ciphers" | defines the codes |
| Wikipedia, [Zodiac Killer](https://en.wikipedia.org/wiki/Zodiac_Killer) | image only (a 2017 redrawing, [Commons file](https://commons.wikimedia.org/wiki/File:My_Name_Is....Zodiac_Cipher_(cropped).jpg)) | yes |
| Tom Voigt, [zodiackiller.com/MyNameIs.html](https://www.zodiackiller.com/MyNameIs.html) | image only (redrawn GIF); calls the circled glyphs Taurus symbols | yes |
| Wikisource, [letter of April 20, 1970](https://en.wikisource.org/wiki/Zodiac_Killer_letter,_April_20th_1970) | cipher shown as an image cut from the scan; the rest of the letter is transcribed | yes |
| Craig Bauer, *Unsolved!* (2017), [p.182](http://assets.press.princeton.edu/chapters/s10949.pdf) | image aligned under ALFREDENEUMAN | yes |
| "Bad Bob", comment (2012-11-04) on [Oranchak's blog](https://zodiackillerciphers.com/gutenberg-addendum-small-ciphers/) | `A E N @ 8 K 8 M 8 + N A M` (informal) | yes |
| T.C. ("SDS"), [Zodiac Research blog](https://zodiacresearch.blogspot.com/2025/07/canonical-cipher-3-z13-vol1-entropy.html) (2025-07-14) | `A E N ZODIAC HBALL K HBALL M HBALL _I_ N A M` | yes |

**No source disagrees on symbol identity or order.** Every typed or drawn version has the same
13 glyphs in the same order. The differences are only in how the non-letter glyphs are named.
Caution: in this ASCII convention the digit `8` is the *filled triangle* of Z408/Z340, so the
informal "8"s for the circled glyph must be mapped to `0`, never to `8`.

### 2.2 Visual check of the original (verified)

Scans downloaded to `data/images/`:

- `z13_letter_1970-04-20_p1_commons.gif`: 640x829, binarized. This is the best scan found
  ([Commons File:Zodiac-name.gif](https://commons.wikimedia.org/wiki/File:Zodiac-name.gif), credited
  to zodiackiller.com via Wikisource; public domain).
- `z13_letter_1970-04-20_p1_zkf.jpg` (407x576, colour), `z13_letter_1970-04-20_p2_bomb_zkf.jpg`
  and `z13_envelope_1970-04-20_zkf.jpg`, from
  [zodiackillerfacts.com album 11](https://zodiackillerfacts.com/gallery/thumbnails.php?album=11).
- `z13_letter_top_zodiackillerciphers.jpg`, a crop from
  [Oranchak's 2013 article](https://zodiackillerciphers.com/my-name-is-sarah-the-horse/).
- `z13_glyphs_magnified_from_commons.png`: my 8x magnification of the 13 glyphs, made from the
  Commons scan.
- Redrawings (not primary evidence): `z13_redrawn_zodiackiller-com.gif`,
  `z13_redrawn_wikimedia_cropped.jpg`, `z13_redrawn_wikimedia_with_kane_reading.jpg`. Also
  `z13_voigt_greek_inscription_comparison.gif` (Voigt's "ANETHEKE" comparison image).

Segmenting the cipher line of the Commons scan by column gaps gives exactly 13 glyphs on one line.
Glyph by glyph (0-based):

| Pos | ASCII | What the scan shows |
|---|---|---|
| 0 | `A` | Capital A, normal orientation, with crossbar, slightly slanted. |
| 1 | `E` | Capital E, normal (not reversed). |
| 2 | `N` | Capital N, normal (diagonal runs top-left to bottom-right). |
| 3 | `z` | Crosshairs/gunsight: a small circle crossed by a vertical and a horizontal stroke, both extending well past the circle. This is the same sign the Zodiac signs with, drawn large on page 2 in "⊕=10". |
| 4 | `0` | Heavy closed circle with an inner figure: a small loop or arc in the upper half above two small lower compartments. It reads like a circled "8" or a circled ♉. |
| 5 | `K` | Capital K, normal. |
| 6 | `0` | Same type of circle. The inner strokes look more diagonal in this copy. |
| 7 | `M` | Capital M, normal. |
| 8 | `0` | Same type of circle. The inner strokes look like a horizontal bar between upper and lower openings. |
| 9 | `[` | Vertical stroke onto a short base whose right end curls upward into a hook: an upside-down T with the right arm turned up. |
| 10 | `N` | Capital N, normal. |
| 11 | `A` | Capital A, normal. |
| 12 | `M` | Capital M, normal. |

No letter in Z13 is reversed or rotated, unlike the many reversed letters in Z408/Z340.

### 2.3 Uncertainties

1. **Are the three circles the same symbol?** All transcriptions assume so. The inner strokes
   differ slightly between copies, which is plausibly just handwriting, but no scan resolves the
   interiors with certainty. Interpretations in the literature:
   - circled 8: Oranchak; Kelleher ([Z13 Solutions wiki](https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions));
   - Taurus ♉: [Voigt](https://www.zodiackiller.com/MyNameIs.html), and commenter H. Davis on
     [Oranchak's Lafferty post](https://zodiackillerciphers.com/lafferty-vs-the-ciphers/) (2012),
     who argued the tops are open "horns";
   - Cancer ♋: Ziraoui ([forum, 2021](https://forum.zodiackillerciphers.com/community/zodiac-cipher-mailings-discussion/detailed-solution-to-z13-and-z32/));
   - "8-ball" / "anchor" naming: [T.C. 2025](https://zodiacresearch.blogspot.com/2025/07/canonical-cipher-3-z13-vol1-entropy.html).
2. **Is `[` a new symbol or the Z408/Z340 upside-down T (`t`)?** Oranchak codes it separately
   (`t2`). In his
   [2012 Lafferty critique](https://zodiackillerciphers.com/lafferty-vs-the-ciphers/) he notes a
   "similar symbol" in Z408 that decodes to R, and lists T (its look) as another option. T.C.
   (2025) maps it to the Z340 `t`, which decodes to L. Lafferty and Ziraoui read it as Aries ♈.
   Garlick assigns P.
3. **Is the crosshair (`z`) cipher or signature?** It is a cipher symbol in Z408 (D) and Z340 (A),
   but it is also the Zodiac's signature, and it appears in the score line of this same letter.
   Lafferty replaced it with "Z"; T.C. treats it as punctuation.
4. **Are the letter glyphs plaintext?** Some readings keep A, E, N, K, M as literal letters: Voigt's
   Greek-inscription idea and [TheDecipherist (2026)](https://thedecipherist.com/articles/the_zodiac_solved/z13-cipher/).
5. **Reading order.** Z13 is written as one left-to-right line, but Z340 was transposed, so a
   non-linear order cannot be excluded ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350), §8.2.1).
6. **Date.** The postmark is given as April 20, 1970 by
   [Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer) and
   [Wikisource](https://en.wikisource.org/wiki/Zodiac_Killer_letter,_April_20th_1970). On the ZKF
   envelope scan I read "AM / 2? APR / 1970": blurry, but consistent.

### 2.4 Structure (verified by computation)

- Repeats: `0` x3 at positions 4, 6, 8 (symmetric about the centre, position 6); `A` x2 (0, 11);
  `N` x2 (2, 10); `M` x2 (7, 12). `E`, `z`, `K`, `[` occur once each.
- The letter-glyph (L) versus non-letter-glyph (S) pattern is `LLLSSLSLSSLLL`, a palindrome.
  Oranchak (2013) asks whether the symmetry is intentional, and whether "N, M, N, M" and "NAM" + "E"
  (NAME) are deliberate
  ([source](https://zodiackillerciphers.com/my-name-is-sarah-the-horse/)).
- Oranchak (2012) says no 13-symbol window of Z408 or Z340 has as many repeats. Z408 needs 22
  symbols and Z340 15 to match
  ([source](https://zodiackillerciphers.com/gutenberg-addendum-small-ciphers/)).
- Fit rarity under strict 1:1 substitution: about 1 random 13-letter string in 12 million fits.
  Oranchak scanned about 0.5 billion name combinations and found 213 that fit
  ([2013 article](https://zodiackillerciphers.com/my-name-is-sarah-the-horse/)).

---

## 3. The letter (paraphrased)

**Page 1** ([scan](https://zodiackillerfacts.com/gallery/thumbnails.php?album=11);
[transcription](https://en.wikisource.org/wiki/Zodiac_Killer_letter,_April_20th_1970)):
- The writer opens with "This is the Zodiac speaking" and asks whether the last cipher he sent has
  been cracked (Z340, mailed November 8, 1969).
- He writes "My name is" and a dash, followed by the 13 symbols on their own line.
- He says he is curious how much reward money is on his head.
- He denies killing the "blue meannie" (a police officer) with a bomb at the cop station. This is
  the February 16, 1970 bombing of SFPD's Park Station, which killed Sgt. Brian McDonnell
  ([Wikipedia](https://en.wikipedia.org/wiki/1970_San_Francisco_Police_Department_Park_Station_bombing)).
  Wikisource glosses "blue meanie" as a *Yellow Submarine* reference.
- Even though he had talked of bombing school children, he would not intrude on someone else's
  "territory". Killing a cop carries more glory than killing a child, because a cop can shoot back.
- He claims ten victims to date, and says there would have been more but his bus bomb was a dud,
  swamped by rain.

**Page 2:**
- Under "The new bomb is set up like this", a diagram shows a bus and a road with early-morning
  sunlight. Photoelectric switches A and B, a car battery, a timer and a "string of bombs" are
  wired so that interrupting the sunbeam triggers it; B acts as a "cloudy day disconnect" against
  accidental detonation.
- PS: he hopes they have fun working out whom he killed.
- Score line: the crosshair sign "=10", "SFPD=0".
  ([Wikisource page 2](https://en.wikisource.org/w/index.php?title=Page:Zodiac-name-and-bomb.djvu/2);
  scan `z13_letter_1970-04-20_p2_bomb_zkf.jpg`; the SFPD evidence stamp is visible.)

**Envelope:** addressed to the Editor, San Fran. Chronicle, with two stamps and a morning postmark;
a second "Editor" appears inverted near the bottom of the scan (`z13_envelope_1970-04-20_zkf.jpg`).

### Hints about content or method

- "My name is" frames the cipher as a name. But the Z408 plaintext had explicitly refused to give his
  name, and the arXiv authors see no reason to think he would simply give it up
  ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350)).
- The question about "the last cipher" right before Z13 links it to Z340. This is the main motive
  for applying the Z340 key (Garlick, Ziraoui, T.C.).
- Six months earlier, on October 22, 1969, the *SF Examiner* ran a dare from D.C.B. Marsh, president
  of the American Cryptogram Association, for the Zodiac to put his real name in a cipher
  ([Pelling 2017](https://ciphermysteries.com/2017/12/16/zodiac-killers-z13-cipher-meets-z340-cipher);
  [Oranchak Ep. 11](https://www.youtube.com/watch?v=ekbur_b8F3M)). Garlick reads Z13 as the reply.
- The claimed count of ten victims: Graysmith filled victims 9-10 with Kathleen Johns (abducted
  March 22, 1970, survived) and Marie Antoinette Anstey (Bauer, *Unsolved!*,
  [p.181](http://assets.press.princeton.edu/chapters/s10949.pdf)). The July 26, 1970 letter raised
  the score to 13 ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)).
- Voigt suggests the first seven glyphs mimic the Greek dedicatory word ANETHEKE (from a temple of
  Poseidon inscription), with Taurus replacing a Greek E
  ([zodiackiller.com](https://www.zodiackiller.com/MyNameIs.html)). This is unverified speculation.

---

## 4. Proposed solutions

Fit legend, computed with `z13task_fit.py` (scratch) against the pattern `abcdefegehcag`:
- **strict**: identical symbols decode to identical letters AND different symbols to different
  letters (simple substitution).
- **weak**: identical symbols decode to identical letters, but different symbols may share a letter
  (homophonic, as in Z408/Z340).
- **violates**: identical symbols would need different letters.
- **n/a**: not a substitution reading (anagram, multi-step, transposition).

### 4.1 Named proposals and suspect claims

| Who (year) | Claimed plaintext | Method | Fit | Source |
|---|---|---|---|---|
| Robert Graysmith (*Zodiac Unmasked*, 2002, p.128, as an old suggestion); endorsed by Craig Bauer (*Unsolved!*, 2017) | ALFRED E NEUMAN (Mad mascot) | Direct letter alignment. Bauer admits N must be both F (pos 2) and M (pos 10), i.e. one mis-enciphered letter. | **violates** (one conflict) | [Bauer p.182](http://assets.press.princeton.edu/chapters/s10949.pdf); [Pelling 2017](https://ciphermysteries.com/2017/12/16/zodiac-killers-z13-cipher-meets-z340-cipher); [Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer) |
| Ryan Garlick, UNT (PDF Dec 2020; video Apr 8, 2025) | DR EAT A TOTPEDO, read as "Dr. eat a torpedo", an insult to Dr. D.C.B. Marsh | Z340 key gives DREA?A?O??EDO. Circled glyph = T and `[` = P (reasons for these two assignments not verified here; the PDF is offline). Requires accepting TOTPEDO as a misspelling. | **weak** (z, K both A; D, O, E reused). TORPEDO itself **violates**. | [forum 2020-12-22](https://forum.zodiackillerciphers.com/community/zodiac-cipher-mailings-discussion/ryan-garlicks-z13-solution/); [Oranchak Ep. 23](https://www.youtube.com/watch?v=tqwVEU5hapk); [Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer) |
| Fayçal Ziraoui (Jan 2021) | KAYR, taken as a slip for KAYE (Lawrence Kane alias "Lawrence Kaye") | Four steps: Z340 key; circles = Cancer, `[` = Aries; zodiac-dial numbers; last digit of A1Z26; NRZI-style differences; Delastelle trifid. Then assumes Zodiac made errors. | n/a | [Ziraoui forum post 2021-01-19](https://forum.zodiackillerciphers.com/community/zodiac-cipher-mailings-discussion/detailed-solution-to-z13-and-z32/); [Wikipedia suspects](https://en.wikipedia.org/wiki/Zodiac_Killer_suspects) |
| Oranchak's rebuttal of Ziraoui (Nov 2021) | EARL (Earl Van Best Jr.), FRED (Fred Manalli) | Small changes to Ziraoui's steps give other suspects. | n/a | [Ep. 11](https://www.youtube.com/watch?v=ekbur_b8F3M) |
| Alex Baber (reported Dec 23, 2025) | MARVIN MERRILL (alias of Black Dahlia suspect Marvin Margolis) | Reported: AI-generated list of about 71 million 13-letter names filtered against records. Secondary reports describe transposition + substitution in a 2x7 grid with keyword ELIZABETH (attributed to ex-NSA Patrick Henry); not verified. Endorsed by ex-NSA Ed Giorgio, Patrick Henry, Rich Wisniewski. | **violates** as plain substitution (5 conflicts) | [Newsweek](https://www.newsweek.com/were-zodiac-killer-black-dahlia-murderer-same-man-marvin-margolis-11259702); [LA Times](https://www.latimes.com/california/story/2025-12-23/black-dahlia-zodiac-killings-connected-one-killer-theory); critiques: [Hodel 2026-02-23](https://stevehodel.com/2026/02/23/z13-reality-check-the-marvin-margolis-aka-marvin-merrill-claim-examined/), [Oranchak Ep. 27 (May 2026)](https://www.youtube.com/watch?v=XARYxQVGziU) |
| Gary L. Stewart (*The Most Dangerous Animal of All*, 2014) | EARL VAN BEST JR (his father) | Only that "Earl Van Best Jr" has 13 letters; no symbol mapping. | **violates** | [Oranchak 2014-09-10](https://zodiackillerciphers.com/the-most-pattern-seeking-animal-of-all/) |
| Lyndon Lafferty (2012) | NAME GRANT (suspect William Joseph Grant) | Crosshair = Z; circled glyphs shift the preceding letters (Z, K, M to G, R, T); anagram; `[` = Aries = "ARE/IS/RAM". Oranchak shows the same steps yield hundreds of names. | n/a | [Oranchak 2012-06-16](https://zodiackillerciphers.com/lafferty-vs-the-ciphers/) |
| Jarett Kobek (*How to Find Zodiac*, 2022), suspect Paul Doerr | (the *Hobbitalia* #1 Cirth cipher's plaintext; not recovered here) | Argues that cipher, published 3 days after Z13, has a solution that is one of only three possible Z13 solutions. | unknown | [Wikipedia suspects](https://en.wikipedia.org/wiki/Zodiac_Killer_suspects); [File770 2024](https://file770.com/well-never-know-for-sure/) |
| Doug Oswell (Kaczynski theory) | FROM TED KACZYNS[K]I | "Set addition" interpretation | n/a (16 letters) | [Z13 Solutions wiki](https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions) |
| Commons user "Dragallas"/LK (2017) | LAWRENCE KANE + Zodiac sign | Visual re-reading and rearranging of glyphs (rotated `[` as L, letters overlaid on circles) | n/a | [Commons file](https://commons.wikimedia.org/wiki/File:My_Name_Is_............._Lawrence_Kane,_ZODIAC.jpg); `data/images/z13_redrawn_wikimedia_with_kane_reading.jpg` |
| TheDecipherist (2026-02-08) | AENDLSLMLCNAM, with ALLEN claimed via a "checksum" | A, E, N, M literal; z = D, K = S (Z408 values); circle = L; `[` = C | **strict**, but not readable | [page](https://thedecipherist.com/articles/the_zodiac_solved/z13-cipher/) |
| T.C. "SDS" (Tapatalk May 2024; blog July 2025) | ANDREA J ODELL | Z340 key; circles given J, L, N by position; then reordered | **violates** (one symbol, three letters) | [blog](https://zodiacresearch.blogspot.com/2025/07/canonical-cipher-3-z13-vol1-entropy.html) |
| "Rembrandt" | ED SHAW | Z408 key plus some symbols treated as nulls | n/a | [wiki](https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions) |
| Michael Kelleher | THEBIGSECRETE | Circled glyphs treated as wildcards | violates unless wildcards | [wiki](https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions) |
| Matthew Dominik (Zenodo preprint, 2025-11-08) | (not verified) | "408 alphabet overlap" constraint mapping; not peer reviewed | unknown | [Zenodo](https://zenodo.org/records/17561378) |

**Suspects with no Z13 decipherment found:**
- **Arthur Leigh Allen.** ARTLEIGHALLEN has 13 letters but violates the pattern (my check). The only
  link found is TheDecipherist above.
- **Richard Gaikowski.** The "GYKE" claim concerns Z408 row 20 transplanted onto Z340, not Z13
  ([zodiacciphers.com](https://www.zodiacciphers.com/richard-gaikowski.html)).
- **Kathleen Johns.** KATHLEENJOHNS has 13 letters but violates the pattern. Her link to this letter
  is only Graysmith counting her among the ten claimed victims (§3).
- **Gareth Penn.** His radian theory concerns the Z32 map
  ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)). *Times 17*
  ([PDF](http://zodiackillerciphers.com/images/times-17-full.pdf)) is a 386-page image scan with no
  text layer, so I could not search it for a Z13 reading. **Gap.**
- **Case Breakers / Gary Poste (2021).** Their anagram claim concerns Z340, not Z13
  ([Schmeh](https://scienceblogs.de/klausis-krypto-kolumne/is-the-identity-of-the-zodiac-killer-revealed/)).

### 4.2 Community and corpus results

These all come from the [Z13 Solutions wiki](https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions)
unless noted.

- **Oranchak's dictionary and name searches (2012-2013).** 2,700+ Gutenberg fits, then 283 two-word and
  1,283,443 three-word fits. Examples: SARAH THE HORSE (weak), LAURA CATAPULT (weak), ACHIEVE LETHAL,
  OF THESE MEN TOM (strict), CHASTITY TRACY (strict)
  ([2012](https://zodiackillerciphers.com/gutenberg-addendum-small-ciphers/),
  [2013](https://zodiackillerciphers.com/my-name-is-sarah-the-horse/)).
  Pelling notes that many of these are homophonic, i.e. weak, fits
  ([2017](https://ciphermysteries.com/2017/12/16/zodiac-killers-z13-cipher-meets-z340-cipher)).
- **glurk.** Hundreds of homophonic and non-homophonic name fits, e.g. GARY LYLE LARGE (weak).
- **Quill.** EDDIE PENERDEN (weak).
- **MickCal.** OL STEVE NELSON (weak).
- **Strict fits, recent:** "Toad" AMIGO COLONIAL; "Jasper" HOPE IT IS IN PHS; @samuelpotts5143
  SAM JR DR FROM SF; "CipherS0luti0ns" ON TV A WAR ACTOR (all strict). The same user's
  SOLVE REVEALS V is weak.
- **"granny101".** ILL NEVE TELL IT, i.e. "I'll never tell it" with the R missing (weak).
- **Anagram readings** (not falsifiable):
  - Tom Voigt: KNICKERBOCKER and AINTGONNATELL;
  - Deb Silva: Bob Beausoleil;
  - others: Jimmy Phillips, Frank Frazetta, Debbie Faraday;
  - Oranchak: 69,607 first/last name combinations matching the letter-count profile, plus 13-letter
    words such as "international".
- **Reddit r/ZodiacKiller.** According to the NYT, moderators deleted Ziraoui's January 3, 2021 post
  "Z13 — My Name is KAYE" under a standing policy against Z13 solution posts
  ([NYT 2021-06-22](https://www.nytimes.com/2021/06/22/world/europe/france-zodiac-killer-cipher.html);
  [Boston Globe syndication](https://www.bostonglobe.com/2021/06/23/world/ive-cracked-zodiac-french-engineer-says-online-sleuths-are-skeptical)).
  This is from secondary summaries; I could not open the article myself.
- **Z340 solvers.**
  - Sam Blake said in December 2020 that Z13 and Z32 were a side project he hoped to pursue
    ([Salon](https://salon.com/2020/12/20/zodiac-killer-code-cipher-340-sam-blake)).
  - The 2024 paper lists what could confirm a solution: solid links to the solved ciphers, a source
    with a known solution, or Zodiac's worksheets ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350)).
  - Jarl Van Eycke: no separate Z13 analysis found beyond co-authoring that paper.

---

## 5. Key carry-over (verified by computation)

Decodings counted from position-aligned files:
- Z408: [AZdecrypt](https://github.com/doranchak/azdecrypt/tree/main/AZdecrypt/Ciphers/Zodiac%20ciphers)
  `Zodiac 408.txt` + `Zodiac 408 solved.txt`, and
  [zodiac-cipher-key-visualizer](https://github.com/doranchak/zodiac-cipher-key-visualizer)
  `z408.txt` + `z408-pt.txt`.
- Z340: the visualizer's `z340-untransposed.txt` + `z340-untransposed-pt.txt`, cross-checked against
  [Oranchak's combined key image](http://zodiackillerciphers.com/images/z408-z340-combined-keys.png).

| Z13 symbol | in Z408 | Z408 decodes to | in Z340 | Z340 decodes to |
|---|---|---|---|---|
| `A` | yes (8x) | W | yes (2x) | D |
| `E` | yes (9x) | E (one occurrence is an enciphering slip for S, per [Oranchak's annotated Harden key](http://zodiackillerciphers.com/408/key.html) note 8) | yes (3x) | R |
| `N` | yes (6x) | E (Harden's worksheet reads one occurrence as T, [note 13](http://zodiackillerciphers.com/408/key.html)) | yes (5x) | E |
| `z` crosshair | yes (4x) | D | yes (9x) | A |
| `0` circle | no | ? | no | ? |
| `K` | yes (5x) | S | yes (7x) | A |
| `M` | yes (8x) | H | yes (7x) | O |
| `[` | no (the similar `t` decodes to R) | ? | no (the similar `t` decodes to L) | ? |

- Z13 under the Z408 key: **`WEED?S?H??EWH`**. If `[` equals `t`: `WEED?S?H?REWH`.
- Z13 under the Z340 key: **`DREA?A?O??EDO`**. If `[` equals `t`: `DREA?A?O?LEDO`.

Both are weak fits by construction, because the keys are homophonic (Z408: E and N are both E;
Z340: z and K are both A). Neither reading is English without inventing letters for `0` and `[`.
For the Z408 file author: the AZdecrypt and visualizer Z408 transcriptions differ only at 0-based
index 105 (`I` vs `!`).

---

## 6. Takeaways for our attack

1. Treat `AENz0K0M0[NAM` as settled. The open questions are the identity of `0` and `[` and the
   cipher model, not the transcription.
2. Under strict substitution there are far too many fits (Oranchak: about 1 in 12 million random
   strings fit, and the space is huge). Any claim needs an external constraint: a Z340/Z408 key link,
   a source text, or a prediction we can check.
3. A key-reuse hypothesis is testable as a scoring problem. Fix the 6 known symbols from the Z408 or
   Z340 key and search only `0` and `[`; that is 26² = 676 combinations per key. Then check whether
   any result is English or a name. The Z340 baseline gives DREA?A?O??EDO. Garlick's T/P choice is
   one point in this tiny space and should be ranked against the other 675.
4. Weak versus strict fit matters. Zodiac used homophonic keys, so for Z13 a weak fit cannot be
   ruled out.
