# Z32: the 32-symbol "Mt. Diablo" / "button letter" cipher (literature notes)

Status: **unsolved**. Neither the FBI nor the solvers of Z340 accept any proposed plaintext.
Canonical transcription: `data/ciphers/z32.json`. Map details and radian geometry: `research/z32_map.md`.

These notes keep three kinds of statement apart:

- **Fact**: verified from a primary scan or from more than one reputable source, with a citation.
- **Claim**: something a named person asserts, attributed to them.
- **Ours**: our own measurement or calculation, with the method stated.

Quotations from the Zodiac's letters are kept short.

---

## 1. Transcription

### 1.1 Sequence and layout

```
C9J|#Ok[AMf8?ORTG      (line 1, 17 symbols)
X6FDVj%HCELzPW9        (line 2, 15 symbols)
```

This uses David Oranchak's ASCII convention, the one in the zodiackillerciphers.com webtoy and Cipher Explorer and in AZdecrypt's bundled files. Three sources give it character for character:

| # | Source | Text as given |
|---|---|---|
| 1 | Zodiac Killer Ciphers Wiki, page "Unsolved 32-character 'map code' cipher" ([link](http://zodiackillerciphers.com/wiki/index.php?title=Unsolved_32-character_%22map_code%22_cipher)) | `C9J\|#Ok[AMf8?ORTG<br>X6FDVj%HCELzPW9` |
| 2 | AZdecrypt `Ciphers/Zodiac ciphers/Zodiac 32.txt` ([raw](https://raw.githubusercontent.com/doranchak/azdecrypt/master/AZdecrypt/Ciphers/Zodiac%20ciphers/Zodiac%2032.txt)) | same, two lines |
| 3 | Cipher Explorer `zodiac.js` ([link](https://zodiackillerciphers.com/cipher-explorer/zodiac.js?v=3)), entry `//z32` | same, one line. It also defines the two Z13/Z32-only symbols: `?` = "omega", `[` = "t2" (and `0` = "taurus" for Z13) |

All three come from the same circle (Oranchak and Van Eycke), so they are not independent. **We checked every symbol ourselves** against four separate images:

- (a) the color scan, `data/images/z32_letter_1970-06-26_color_commons.jpg`. It is Commons `Zodiac-Colour-SFC.jpg`, which is byte-identical to zodiackiller.com `images/phillips66letter.jpg`, so it counts as one image.
- (b) the zodiackiller.com black-and-white scan, `z32_letter_1970-06-26_zodiackiller.png`.
- (c) the high-resolution SFPD photograph, `z32_letter_1970-06-26_police_photo_zkc.jpg`, 5100x7014. Deborah Silva bought it from Tom Voigt and Oranchak posted it on 2013-09-28 ([post](https://zodiackillerciphers.com/high-resolution-map-cipher/)).
- (d) the wiki's separate color photo with a "June 26, 1970" label, `z32_letter_1970-06-26_color_hires_zkc.jpg` ([link](http://zodiackillerciphers.com/wiki/images/3/31/9a_-_San_Francisco_Chronicle_Map_Code_letter_June_26_1970_Color_High_Res.jpg)).

All of these images show the same 32 symbols in the same 17 + 15 layout, with both lines starting at the left margin. Wikipedia and Wikisource show the cipher only as an image (`File:Zodiac-Colour-SFC-Cipher-Black-Clean.png`), which also agrees. Foxon (2023) describes the layout the same way: 17 + 15 rows, a 29-symbol alphabet, and repeats at positions 1/26, 2/32 and 6/14 counting from 1 ([ePrint 2023/982](https://eprint.iacr.org/2023/982)). Oranchak, Blake and Van Eycke (2024) state that 29 of the 32 symbols are unique ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350), section 8.2.1).

### 1.2 Symbols and key carry-over

Positions are 0-based. The keys were computed by us from AZdecrypt's `Zodiac 408.txt` / `Zodiac 408 solved.txt` and `Zodiac 340.txt` / `Zodiac 340 solved transposed.txt` (as-enciphered plaintext); every symbol has a single value in both keys. Oranchak's combined key image ([link](http://zodiackillerciphers.com/images/z408-z340-combined-keys.png)) gives the same values, and we used it to confirm that symbols match by shape.

| pos | ascii | what it looks like | in Z408 → letter | in Z340 → letter |
|---|---|---|---|---|
| 0, 25 | `C` | capital C | no | yes → Y |
| 1, 31 | `9` | open (outline) triangle | yes → I | yes → N |
| 2 | `J` | J with top bar | yes → F | yes → S |
| 3 | `\|` | plain vertical stroke, no serifs | no (Z408 has only the serifed `I`, which decodes to T) | yes → E |
| 4 | `#` | solid square | yes → L | yes → T |
| 5, 13 | `O` | O | yes → N | yes → A |
| 6 | `k` | mirror-reversed K | yes → I | yes → I |
| 7 | `[` | inverted T with hooked base ("t2") | no | no |
| 8 | `A` | A | yes → W | yes → D |
| 9 | `M` | M | yes → H | yes → O |
| 10 | `f` | mirror-reversed F | yes → D | yes → B |
| 11 | `8` | solid triangle | yes → A (the Hardens read some occurrences as S) | yes → P |
| 12 | `?` | Greek capital omega | no | no |
| 14 | `R` | R | yes → G | yes → O |
| 15 | `T` | T | yes → O | yes → R |
| 16 | `G` | G with inward curl | yes → A | yes → T |
| 17 | `X` | X | yes → O | yes → R |
| 18 | `6` | circle with central dot | yes → E | yes → D |
| 19 | `F` | F | yes → S | yes → F |
| 20 | `D` | D | yes → N | yes → N |
| 21 | `V` | V | yes → B | yes → O |
| 22 | `j` | mirror-reversed J with top bar (tau-like) | yes → X | yes → P |
| 23 | `%` | square, lower-right half filled | yes → L | yes → T |
| 24 | `H` | H | yes → T | yes → I |
| 26 | `E` | E | yes → E | yes → R |
| 27 | `L` | L | yes → T | yes → G |
| 28 | `z` | Zodiac crosshair (arms extend past the circle) | yes → D | yes → A |
| 29 | `P` | P | yes → I | yes → I |
| 30 | `W` | W | yes → E | yes → W |

Coverage: 25 of the 29 distinct symbols (27 of 32 positions) occur in Z408 under strict ASCII identity (`C`, `|`, `[` and the omega do not; corrected 2026-10-07 by the certify task, the earlier text said 26 of 29 and 29 of 32), and 27 of 29 (30 of 32 positions) occur in Z340. The Z340 coverage matches Foxon's remark that two Z32 symbols are missing from the Z340 key ([ePrint 2023/982](https://eprint.iacr.org/2023/982)).

**Z32 decoded with carried-over keys** (`?` = no value in that key):

| key | line 1 | line 2 |
|---|---|---|
| Z408 (strict) | `?IF?LNI?WHDA?NGOA` | `OESNBXLT?ETDIEI` |
| Z408, with `\|`=`I` and `[`=`t` | `?IFTLNIRWHDA?NGOA` | `OESNBXLT?ETDIEI` |
| Z340 (strict) | `YNSETAI?DOBP?AORT` | `RDFNOPTIYRGAIWN` |
| Z340, with `[`=`t` | `YNSETAILDOBP?AORT` | `RDFNOPTIYRGAIWN` |
| AZdecrypt `Zodiac 32 with 340 key.txt` | `YNSETAI1DOBP2AORT` | `RDFNOPTIYRGAIWN` (identical to ours; digits mark absent symbols) |
| AZdecrypt `Zodiac 32 with 408 key.txt` | `1IFELNIOWHDA2NGOA` | `OESNBX3T1ETDIEI` (differs at positions 3, 7, 23; see 1.3) |

Neither key gives English. Applying the Z340 key is the first step of Ziraoui's 2021 claim (section 4).

### 1.3 Disagreements and uncertain readings

1. **Position 3, bar or I.** The stroke has no serifs in every image, so the convention writes `|`, the Z340 bar. The wiki's alphabet comparison notes that some people treat the Z340 bar and the serifed Z408 `I` as one symbol ([link](http://zodiackillerciphers.com/wiki/index.php?title=Comparison_of_cipher_alphabets)). If they are one symbol, the Z408 key gives T here. AZdecrypt's `Zodiac 32 with 408 key.txt` decodes this position as **E**, which matches no Z408 symbol under the convention; that file's reasoning is undocumented.
2. **A ring below position 3 in the SFPD photo.** The photograph shows a tiny grey ring under the stroke, so it looks like "!". The color scan does not show it. We read it as a paper or photo defect, not ink.
3. **Position 7 `[`.** This is a perpendicular sign whose base hooks upward at the right; the left end is rounded and slightly upturned. Cipher Explorer calls it `t2` and keeps it distinct from the Z408/Z340 `t` (plain ⊥: Z408 R, Z340 L). The same glyph appears in Z13 (`AENz0K0M0[NAM`, AZdecrypt). AZdecrypt's Z408-key file decodes it as **O**, as if it were equated with the Z408 "funny I" `!`; this is undocumented.
4. **Position 23 `%`.** On the color scan we checked the orientation: the lower-right half is filled and a small open triangle is left at the upper left. That is the same as the Z340 `%` (row 2, column 8 of the Z340 scan) and as the half-square that the combined-key image lists as Z408 L / Z340 T. AZdecrypt's Z408-key file nevertheless leaves it undecoded.
5. **Positions 1/31 vs 11.** The open and the solid triangle are clearly different. A 2026 blog analysis by Praetorian counted all three as one "TRIANGLE" ([link](https://www.praetorian.com/blog/a-possible-solution-to-the-zodiac-killer-z32-cipher/)); we do not.
6. **Position 12, omega.** No counterpart in Z408 or Z340. Position 22 (`j`) can also be seen as a tau; the convention equates it with the Z408/Z340 backwards J.
7. **The repeated symbols** (0/25 C, 5/13 O, 1/31 triangle) differ slightly in size and roundness between their two copies. Every source treats each pair as one symbol.

---

## 2. The letter of June 26, 1970 (the "button letter")

**Fact.** Mailed and postmarked in San Francisco on June 26, 1970, to the San Francisco Chronicle ([zodiackiller.com](https://zodiackiller.com/ZButtonLetter.html); [Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)). The envelope reads "S.F. Chronicle / San Fran. / Calif." (`data/images/z32_envelope_1970-06-26_zodiackiller.png`). One handwritten page, with a cut piece of a Phillips 66 road map enclosed (see `z32_map.md`).

**Paraphrase** (read from the scans; Wikisource text at [link](https://en.wikisource.org/wiki/Zodiac_Killer_letter,_June_26th_1970)):

- It opens "This is the Zodiac speaking."
- The writer is upset with the people of the San Francisco Bay Area because they have **not** (underlined) complied with his wish that they wear "some nice ⊕ buttons". This continues the demand in his April 28, 1970 card ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)).
- He had promised to punish them by "anilating a full School Buss". Because school is out for the summer, he says he punished them "in an another way" (so on the original; Wikisource normalises this to "in another way"): he shot a man sitting in a parked car with a .38.
- Score line: a crosshair with "-12" and "SFPD-0", i.e. 12 victims claimed against 0 for the police ([Wikisource header note](https://en.wikisource.org/wiki/Zodiac_Killer_letter,_June_26th_1970)).
- Bomb clue: the map, coupled with the code, will tell where the bomb is set; "You have untill next Fall to dig it up." Signed with a crosshair.
- The two cipher lines close the page.

The spelling is the Zodiac's own (promiced, anilating, Buss, untill). "didnot" is written as one word.

**The Radetich claim.** On June 19, 1970, at about 5:25 a.m., SFPD Sergeant Richard Radetich (25) was shot three times with a .38 revolver through the driver's window of his patrol car. One passage in Wikipedia says he was writing a parking ticket in Haight-Ashbury, another says it was a routine traffic stop. The case is unsolved and SFPD denies that the Zodiac is a suspect. SFPD reopened the investigation in 2004 ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer), citing [SFGate 2007](https://www.sfgate.com/news/article/1967-71-a-bloody-period-for-S-F-police-2654263.php) and [ODMP](https://www.odmp.org/officer/10956-officer-richard-radetich)). The Chronicle's 1970 story on the letter was Paul Avery's "Zodiac Says He Killed S.F. Officer" ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350), ref. 1182).

**Claim (Gareth Penn, *Times 17*, 1987, p. 3).** Penn says police suppressed the letter and that local papers printed only a brief paraphrase, with neither the radian hint nor the cipher ([PDF](http://zodiackillerciphers.com/images/times-17-full.pdf)). We have not verified this against 1970 newspapers.

## 3. Other Zodiac statements about this code

- **July 26, 1970, "Little List" letter** to the Chronicle, 5 pages ([Wikisource](https://en.wikisource.org/wiki/Zodiac_Killer_letter,_July_26th_1970); scans at [zodiackiller.com](https://www.zodiackiller.com/Mikado1.html)). It complains again that nobody wears ⊕ buttons, threatens to torture "all 13 of my slaves" in Paradice, and parodies "I've got a little list" from *The Mikado*. Page 2 has a large crosshair with "SFPD=" and a heavily inked 0 inside the lower-left quadrant, and "=13" at the right. Page 5 ends with a large crosshair and the postscript (Wikisource): **"PS. The Mt. Diablo Code concerns Radians & # inches along the radians"**.
  - The character between "Radians" and "#" is ambiguous in the scan (`data/images/z32_little_list_letter_1970-07-26_p5_zodiackiller.png`). Wikisource and zodiackillerfacts read "&", Wikipedia and Cipher Mysteries read "+" ([link](https://ciphermysteries.com/other-ciphers/zodiac-killer-ciphers/zodiac-killer-z32)), and Pelling notes it is not a "4".
  - **Ours:** the "#" is written small and raised, with a caret (insertion mark) under it. It was added afterwards, so the line first read "Radians & inches along the radians".
- **July 24, 1970 letter** (Kathleen Johns letter): complains about the buttons again and announces "a little list" ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)). It says nothing about the map.
- **Earlier bomb threats that the June letter builds on:** the November 9, 1969 letter (school bus bomb diagram) and the April 20, 1970 letter (a second bus bomb diagram, score "⊕ = 10, SFPD = 0", and the Z13 cipher). The April 28, 1970 card threatened the bus bomb unless the Chronicle wrote about it and people wore Zodiac buttons ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)).
- We found no other authenticated Zodiac statement about the Mt. Diablo code or the buried bomb. No bomb was ever found ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)).
- **Misquotation to watch for.** Penn (*Times 17*, p. 3) writes that the June letter said one must go "four inches along the radian". The June letter says nothing of the kind (scans checked).

---

## 4. Proposed solutions and readings

"Respects repeats" means the plaintext satisfies p[0]=p[25], p[1]=p[31] and p[5]=p[13], the only constraint a homophonic substitution imposes. **Ours:** with standard English letter frequencies, a random 32-letter English string satisfies all three with probability of about 0.066³ ≈ 1/3,500. Passing this test is therefore close to worthless as evidence.

| Who (year) | Claimed plaintext / reading | Method | Respects repeats? | Source |
|---|---|---|---|---|
| Gareth Penn (1980/81; book 1987) | No plaintext. "Radian theory": Mt. Diablo is the apex of a ~57-58° (one radian) angle whose legs pass through Blue Rock Springs and Presidio Heights (Stine) | Geometry on a Bay Area map | n/a | *Times 17* pp. 3-4 and frontispiece ([PDF](http://zodiackillerciphers.com/images/times-17-full.pdf)); California Magazine, Nov. 1981, per [Foxon](https://eprint.iacr.org/2023/982) |
| "pi1" (c. 2012) | Phrase permutation search (details lost) | Exhaustive phrase fitting | ? | [wiki, link broken](http://zodiackillerciphers.com/wiki/index.php?title=Z32_Solutions) |
| Henrik Sundberg & David Thelin (Jan. 2014) | Reads chemical formulas from the glyphs (C3H3, octane, HClO3); location on the 11:00 radial of a 24-h bezel rotated by 15°, one inch west | Glyph "resemblance", atom counting | n/a (not a substitution) | [Cipher Mysteries 2014-01-30](http://www.ciphermysteries.com/2014/01/30/swedish-zodiac-killer-z32-theory); Oranchak calls it "ridiculously convoluted" ([post](https://zodiackillerciphers.com/swedes-crack-zodiacs-map-code/)) |
| Rick A. Roberts (Feb. 2014) | `IS IN FRONT LEFT CORNER NEAR WOODS END AND GO ACROSS SAND BOX LIGHTS SET I DIE` and another 43-letter reading | Not 1:1 (62 letters for 32 symbols) | n/a | comments on [Cipher Mysteries Z32 page](https://ciphermysteries.com/other-ciphers/zodiac-killer-ciphers/zodiac-killer-z32) (not independently checked) |
| David Cobb (Jan. 2018) | Structure "CALI [lat] NORTH / X [long] WEST" | Symbols as delimiters and digits | n/a | same comments (not checked) |
| Richard Grinell (Sept. 2018) | `RADIANS AND 5 INCHES ALONG THE RADIANS` | Map polar coordinates, 4 rad + 17° = 246.2°, 5 in | **No** (open triangle would be both A and S) | [Foxon](https://eprint.iacr.org/2023/982), citing zodiacciphers.com |
| DMW (PDF dated 2019-03-01) | `IN THREE AND THREE EIGHTHS RADIANS TEN` ("IN: 3 3/8, RADIANS: 10", ten o'clock = 300° magnetic = 317° true) | Homophonic substitution; polar coordinates from the summit; 6.4 mi/in; 17° declination. Points it at Arthur Leigh Allen's Vallejo home; author admits non-uniqueness | **Yes** | [PDF](https://zodiackillerciphers.com/zks-attachments/8025.pdf) |
| Chad Burke (July 2019) | `OKAY I SEVEN INS SOUTH OF DIABLO MT PEAK` | Homophonic | **Yes** | Cipher Mysteries comments (not checked) |
| Richard Grinell (June 2020); also YouTube user "InStepWithTheStars" (comment on Let's Crack Zodiac ep. 11, listed on the wiki 2021-11-30) | `ESTIMATE FOUR RADIANS AND FIVE INCHES` | 4 rad clockwise from magnetic N (17°) = 246.2° true, 5 in → near Ingleside police station, SF; also matches the angle of the bold "0" in the July 26 doodle | **Yes** | [Foxon](https://eprint.iacr.org/2023/982); [wiki InStepWithTheStars](http://zodiackillerciphers.com/wiki/index.php?title=InStepWithTheStars); [zodiacciphers.com 2021-12-16](https://www.zodiacciphers.com/zodiac-news/solving-the-phillips-66-map-without-the-little-list-letter) |
| Fayçal Ziraoui (forum post Jan. 2021; press June 2021) | `LABOR DAY FIND 45.609 NORT 58.719 WEST`. Press reports print "45.069". Read as *geomagnetic* coordinates near South Tahoe Middle School | **Z340 key** applied to Z32 (the 2 non-Z340 symbols ignored), then A1Z26 digits keeping only the units digit, characters 21-30 taken as coordinates, the rest anagrammed (PABOR → LABOR, NORT for NORTH) | n/a (not 1:1) | [forum](https://forum.zodiackillerciphers.com/community/zodiac-cipher-mailings-discussion/detailed-solution-to-z13-and-z32/); [Foxon](https://eprint.iacr.org/2023/982) §2.4; [IFLScience](https://www.iflscience.com/zodiac-killers-final-two-messages-may-have-been-decoded-and-his-identity-finally-revealed-once-and-for-all-60141); [Oxygen](https://www.oxygen.com/crime-news/faycal-ziraoui-says-he-cracked-remaining-zodiac-ciphers); Oranchak's video review "Did someone solve Zodiac's last 2 ciphers?" ([post](https://zodiackillerciphers.com/did-someone-solve-zodiacs-last-2-ciphers/)) |
| The Case Breakers (Oct. 2021) | Claimed Z13 and Z32 solutions naming a suspect | Remove the suspect's name letters from a letter, anagram the rest | n/a | [Foxon](https://eprint.iacr.org/2023/982) §2.5 |
| "Cragle" (listed 2022-03-08) | `THREE RADIANS FROM MOUNT AREA TWO INCH` | Homophonic | **Yes** | [wiki Z32 Solutions](http://zodiackillerciphers.com/wiki/index.php?title=Z32_Solutions) |
| Floe Foxon (June 2023) | Coordinates (r=12 in, θ=3 rad) from watch hands set to the 16.9° declination (12:03). Candidate `TWELVE INCHES ALONG THE THREE RADIANS` (or `THREE RADIANS AND TWELVE INCHES ALONG`) | Homophonic plus the **Z340 transposition**: the second line shifted two places, then the Z340 knight-move reading; needs two misspellings (TWELVT/EWELVE, RNDIANS/RADIAAS). The author calls it "not particularly convincing" | Direct reading: **No**; only after his transposition | [ePrint 2023/982](https://eprint.iacr.org/2023/982) |
| Ryan Garlick (Aug. 2025) | Presents "a possible solution" in Oranchak's *Let's Crack Zodiac #24: Bomb Code Defused?* | Video only; we could not read the details | ? | [post](https://zodiackillerciphers.com/zodiacs-mysterious-and-bizarre-32-character-cipher/) (video nM1CM1QPI3E). For Z13 Garlick used the Z340 key ("Dr. Eat a Torpedo", [Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)) |
| Alex Baber (Dec. 2025) | Claims Z13 and Z32 solutions naming Marvin Margolis / "Marvin Merrill" (Black Dahlia suspect); Z32 plaintext not found in our sources | "AI, census records and cryptanalysis" (press) | ? | [letsdatascience](https://letsdatascience.com/news/investigator-links-zodiac-killer-to-black-dahlia-03c905f6); Oranchak's 3-part critique ([post](https://zodiackillerciphers.com/zodiac-and-black-dahlia-solved-by-sherlock-or-charlatan/)) |
| Matthew Dominik (Jan. 2026, Zenodo, not peer reviewed) | Argues Z32 is a structural "anti-cipher" with no determinate decoding | Theoretical | n/a | [Zenodo 18202334](https://zenodo.org/records/18202334) |
| David Stampher (Feb. 2026) | Same plaintext as DMW, `IN THREE AND THREE EIGHTHS RADIANS TEN`, at 38.10995 N, 122.18535 W. Says 2,044,224 candidates were filtered to 54 survivors | Exhaustive phrase generation plus geographic filters | **Yes** | [GitHub dstampher/zodiac-z32-cipher](https://github.com/dstampher/zodiac-z32-cipher) |
| Grant Dickinson (Mar. 2026) | Directions: true north 17 in, then east 15 in → Lake Spaulding (Sierra); links to Donna Lass | Symbol counts as distances | n/a | Cipher Mysteries comment; [Medium](https://medium.com/@grantdi/diablo-to-devil-a-z32-journey-514d1e01e04f) (returned 403 to us) |
| Nathan Sportsman / Praetorian (Apr. 1, 2026) | Three "trigrams" as waypoints; centre of a triangle ~1 mi south of the summit (37.867 N, 121.914 W) | 15° or π/8 bearings, 16.88° declination, brute-forced scale factors; merges open and solid triangles | n/a | [Praetorian blog](https://www.praetorian.com/blog/a-possible-solution-to-the-zodiac-killer-z32-cipher/) |
| Nick Pelling (Cipher Mysteries) | Not a solution. A "newspaper cryptogram" style fit, `DSBELISHOURTWICHTHEKINGMADEARSES`, to show that nonsense fits too | Demonstration | Yes | [Cipher Mysteries](https://ciphermysteries.com/other-ciphers/zodiac-killer-ciphers/zodiac-killer-z32) |

**Corey Starliper.** His July 2011 claim, covered by Foster City Patch and Gizmodo, concerned **Z340**: Caesar shifts plus edits, producing "My name is Leigh Allen" text. We found no Starliper claim about Z32 ([Cipher Mysteries](https://ciphermysteries.com/?p=3763); [zodiackillerfacts 2011/07](https://zodiackillerfacts.com/2011/07/); [Gizmodo](https://gizmodo.com/total-amateur-says-he-cracked-zodiac-killers-impossible-5825654)). Oranchak, Blake and Van Eycke cite it as an example of a media-covered claim, in their discussion of solutions that fail basic tests of correctness such as unicity distance and uniqueness ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350), §2).

**Lyndon Lafferty** (retired Vallejo officer, 2012 book) says he solved the unsolved ciphers but published no details. Oranchak's analysis of his Z13 method sets out a test: can the same procedure generate other, equally reasonable solutions? ([post](https://zodiackillerciphers.com/lafferty-vs-the-ciphers/)).

**Using the Z340 key or the Z340 transposition:**

- Ziraoui (2021) applied the Z340 key.
- Foxon (2023) applied the Z340 knight-move transposition. He also notes that the Z340 transposition triangle has rows of 17 and 15 (and 13), the same shape as Z32's two lines.
- Garlick applied the Z340 key to Z13; whether he did so for Z32 is unverified.
- AZdecrypt ships the plain Z340-key decode of Z32 (table in 1.2).

## 5. How many solutions can a 32-symbol cipher have?

- **Oranchak, 2014.** The map code is the hardest of the Zodiac's ciphers because only three symbols repeat. Numerous solutions fit, and a solution cannot be validated on its own unless some indisputable link to the map is found ([post](https://zodiackillerciphers.com/swedes-crack-zodiacs-map-code/)).
- **Oranchak, Blake and Van Eycke, 2024.**
  - Under minimal assumptions (simple substitution), Z13 and Z32 are below the unicity distance.
  - For Z32 it is "almost trivial to generate plausible plaintexts" because 29 of the 32 symbols are unique.
  - No known test can scientifically falsify or validate a candidate.
  - Because Z340 turned out to have extra complications, Z13 and Z32 may have them too, which enlarges the space further.
  - What they would accept: connections to the solved ciphers, a known source text, or the Zodiac's worksheets.

  They also define multiplicity as symbols ÷ length (Z408 0.13; Z340 section 1, 63/153 = 0.41). Z32's multiplicity is 29/32 = 0.91 ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350), §§5.4, 8.2.1).
- **Oranchak in the NYT, 2021.** Hundreds of Z13/Z32 solutions have been proposed and it is "practically impossible to determine if any of them are correct" ([NYT via Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)).
- **Sam Blake.** Secondary summaries say he was doubtful about the January 2021 French (Ziraoui) claim, but we could not find the primary statement. Treat this as unverified. His published position is the joint 2024 paper above.
- **Jarl Van Eycke**: his views here appear only through the joint 2024 paper above.
- **Foxon (2023)** treats the three repeats as a "weak restriction". **DMW (2019)** concedes that 29 unique symbols allow many solutions.
- **Ours.** About 1 in 3,500 random English 32-letter strings passes the repeat test (section 4). Grinell's 2020 phrase, Cragle's, DMW's, Burke's and Pelling's nonsense string all pass. The test separates nothing.

## 6. Pointers for later work

- Any solver needs the symbol identity decisions that are open here: `|` vs `I`, `[` vs `t`, and the omega. The carried-over key values are in the table in 1.2.
- The map geometry (summit centring, axis orientation, true and magnetic north, printed versus actual scale) is measured in `z32_map.md`. That file also lists bearings and distances from the summit to every crime scene, for checking "radians and inches" claims.
