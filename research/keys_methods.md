# Keys and methods of the solved Zodiac ciphers (Z408, Z340), as calibration for Z13 and Z32

Written 2026-10-07. Every number in this file comes from a script in `tools/` run on files in
`data/`, unless a citation says otherwise. The plaintexts are not reproduced here. They are in
`data/ciphers/z408.json` and `data/ciphers/z340.json`, which `tools/build_calibration.py` built
from downloaded files (URLs and SHA-256 hashes are in each JSON's `sources`).

| Command | What it does |
|---|---|
| `python tools/build_calibration.py` | builds `z408.json` and `z340.json` from `data/sources/` and checks them against the published sources |
| `node tools/verify_calibration.js` | checks both files independently with `tools/cipher.js` (25 checks; all pass) |
| `python tools/key_analysis.py` | key statistics, cycling, overlap and permutation tests, Z13/Z32 decodes, unicity arithmetic (seed 1969, about 2 minutes) |

Positions are 0-based. Rows and columns refer to the 17-column written grid. Symbols use the
Oranchak / AZdecrypt ASCII convention, the same one used in `z13.json` and `z32.json`.

---

## 0. What the two calibration files contain, and how they were verified

### 0.1 Z408 (`data/ciphers/z408.json`)

- **Transcription.** `ascii` is Oranchak's key-visualizer `z408.txt`. AZdecrypt's bundled `Zodiac 408.txt` differs at one position: 105 is `I` there and `!` here. Oranchak's annotated key, note 20, says that on closer inspection the symbol at 105 is the "funny I" `!` (key O) rather than a plain I (key T) ([key.html](http://zodiackillerciphers.com/408/key.html)).
- **`plaintext`.** The Hardens' solution as annotated by Oranchak: 408 letters, 1:1 with the ciphertext. Zodiac's misspellings are kept (Oranchak notes 6, 10 and 14 flag three of them). The 18-letter tail at positions 390-407 is the Hardens' reading.
- **`plaintext_key_decoded`.** The strict one-letter-per-symbol reading. It is identical to Oranchak's `z408-pt.txt`. Popular renderings such as [Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer) mix the two readings: they keep the key letter at positions 107 and 110, which produces two well-known "misspellings".
- **`key`.** 54 symbols. It equals the majority letter per symbol in the Harden key table on Oranchak's page, after moving the one O at position 105 from `I` to `!`. Every (symbol, letter) count in that table matches our counts.
- **Verification.** `key(ascii)` against `plaintext` differs at exactly 8 positions, the documented encoding slips. 8 of 390 is 2.05%.

| pos | row, col | symbol | key gives | plaintext has | cause (Oranchak's annotated key) |
|---|---|---|---|---|---|
| 97 | 5, 12 | `8` solid triangle | A | S | note 7: `8` stands for A 4x, S 3x and I 1x; triangle confusion |
| 107 | 6, 5 | `E` | E | S | notes 8 and 20: the S homophone `F` looks like `E` |
| 110 | 6, 8 | `8` | A | I | note 7: I is normally the open triangle `9` |
| 146 | 8, 10 | `8` | A | S | note 7 |
| 228 | 13, 7 | `8` | A | S | note 7 |
| 232 | 13, 11 | `N` | E | T | note 13: probably `N` written for the T homophone `H` |
| 264 | 15, 9 | `7` dotted triangle | S | A | note 15: `7` is S 2x and A 1x; A is normally `8` |
| 345 | 20, 5 | `9` open triangle | I | W | note 18: `9` is I 13x and W 1x; W is normally `A` |

- **Key variant.** AZdecrypt's `Zodiac 408 solved.txt` maps `7` to A, the minority reading. That is why it differs from our strict decoding at 41, 264 and 352, besides position 105.
- **Missing word.** A word seems to be missing at the part 2 / part 3 boundary (position 272, note 16). No mismatch shows it.

### 0.2 Z340 (`data/ciphers/z340.json`)

- **Transcription.** `ascii` (written order) is identical in Oranchak's visualizer and in AZdecrypt.
- **`plaintext`.** The published plaintext as enciphered, in reading order: AZdecrypt `Zodiac 340 solved.txt`, which is identical to Oranchak's `z340-untransposed-pt.txt`.
- **Other plaintext fields.** `plaintext_aligned` is the same text in written order (AZdecrypt `Zodiac 340 solved transposed.txt`). `plaintext_corrected` is the wiki's "with errors corrected" text ([Solution to the 340](http://zodiackillerciphers.com/wiki/index.php?title=Solution_to_the_340)).
- **`read_order`.** It satisfies `plaintext[k] = key[ascii[read_order[k]]]`. It is built from the published rules (arXiv:2403.17350, §5.4-5.5, Figure 41):
  - **Section 1** (rows 0-8, reading positions 0-152): the (1,2)-decimation. The k-th symbol is at row k mod 9, column 2k mod 17 (down one, right two, wrapping around).
  - **Section 2** (rows 9-17), the same decimation with two exceptions:
    - Row 14 (the 15th line) has a skipped symbol. Columns 3-16 are circularly shifted right by one: corrected[14][3] = written[14][16] (Van Eycke; the paper's footnote 8).
    - The 6 cells at row 9, columns 11-16 (written positions 164-169) were left untransposed. The decimation skips them, and they are read as a block at reading positions 300-305, as in the solvers' untransposed files.
  - **Section 3** (rows 18-19): read left to right. The six words that Zodiac wrote backwards are read right to left: written spans 306-309, 314-315, 316-317, 322-324, 325-326 and 327-334.
- **Verification** (`tools/verify_calibration.js`):
  - `read_order` is a permutation.
  - `ascii[read_order]` equals Oranchak's `z340-untransposed.txt` symbol for symbol. The plain decimation with straight last rows misses at 81 positions.
  - `key(ascii[read_order])` equals the published plaintext with 0 mismatches.
  - Against `plaintext_corrected` it differs at exactly the 8 documented encoding errors: 8 of 340, or 2.35%.
- **`read_order_paper_final`.** Moves the 6 untransposed letters to just before the last word, as in the paper's final text. Decoding in that order reproduces the paper's "as written" text letter for letter, all 340.
- **Repeating bigrams.** 25 in written order (the paper's figure) and 45 in our reading order.

| read pos | written pos (row, col) | symbol | key gives | intended | intended letter's homophones |
|---|---|---|---|---|---|
| 24 | 116 (6, 14) | `z` | A | U | `/ q @` |
| 75 | 65 (3, 14) | `R` | O | S | `- U J &` |
| 122 | 91 (5, 6) | `O` | A | U | `/ q @` |
| 144 | 16 (0, 16) | `d` | L | I | `< k y H P` |
| 156 | 210 (12, 6) | `+` | H | N | `. 9 > D Y` |
| 166 | 230 (13, 9) | `b` | E | I | `< k y H P` |
| 191 | 195 (11, 8) | `5` | V | K | none (the key has no K) |
| 287 | 227 (13, 6) | `5` | V | K | none |

Three more positions are bracketed in the paper as misspellings: reading positions 145, 243 and 333, where C is written for S. They are enciphered correctly, use the same spelling Zodiac used in Z408, and are kept in `plaintext_corrected` (`spelling_kept`).

---

## 1. How each key is built

### 1.1 Homophones per letter

**Z408**: 54 symbols for 23 letters. No symbol for J, Q or Z (`key_homophones`).

| letter | symbols | | letter | symbols | | letter | symbols |
|---|---|---|---|---|---|---|---|
| E (54x) | `Z p W + 6 N E` | | L (33x) | `B % #` | | M (16x) | `q` |
| I (44x) | `9 P U k` | | R (19x) | `r t \` | | G (12x) | `R` |
| T (34x) | `I 5 H L` | | H (16x) | `) M` | | C, U (10x) | `e`, `Y` |
| O (28x) | `X ! T d` | | F (11x) | `J Q` | | B (9x) | `V` |
| A (26x) | `8 G S l` | | D (7x) | `z f` | | W, Y (8x) | `A`, `_` |
| N (23x) | `O D ^ (` | | | | | P (7x) | `=` |
| S (20x) | `@ F K 7` | | | | | K, V (6x) | `/`, `c` |
| | | | | | | X (1x) | `j` |

**Z340**: 63 symbols for 21 letters. No symbol for J, K, Q, X or Z; the two intended Ks are encoding errors (§0.2).

| letter | symbols | | letter | symbols | | letter | symbols |
|---|---|---|---|---|---|---|---|
| E (46x) | `B c \| 4 N b` | | O (27x) | `R M V ^` | | H (24x) | `+` |
| T (25x) | `( G # ; % :` | | S (16x) | `- U J &` | | C (11x) | `p` |
| A (39x) | `O z K l *` | | L (12x) | `d t 7` | | F (10x) | `F` |
| I (23x) | `< k y H P` | | D (9x) | `S 6 A` | | M (9x) | `2` |
| N (22x) | `. 9 > D Y` | | U (6x) | `/ q @` | | V (7x) | `5` |
| R (17x) | `T Z 1 E X` | | W (11x) | `W )` | | G (6x) | `L` |
| | | | Y, B (7x) | `C 3`, `f _` | | | |
| | | | P (6x) | `8 j` | | | |

**Both keys follow letter frequency.** The number of symbols per letter correlates with English letter frequency: Spearman 0.90 for Z408 and 0.78 for Z340.

**The flattening is imperfect.**
- Z408 averages 7.8 occurrences per symbol (sd 3.0). M is the outlier: one symbol, 16 occurrences.
- Z340 averages 6.4 (sd 4.6). H is the outlier: a single symbol `+` covers all 24 Hs, and `+` is the most frequent symbol in Z340.

### 1.2 Sequential (cyclic) use of homophones

**Documented.**
- For Z408, Oranchak lists each letter's symbol sequence. Most cycles stay unbroken until part 3, and the H cycle `M )` repeats perfectly through the whole cipher ([key.html, "Homophone cycles"](http://zodiackillerciphers.com/408/key.html)).
- The paper's Figure 14 shows 14 Es enciphered as two identical seven-symbol sequences. It calls Z340's cycling "not as significant", perhaps disrupted by the encipherment method ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350), §3).
- King and Bahler (1993) partly detected cyclic homophones in Z408 automatically but could not confirm them in Z340. Raddum and Sýs (2010) found more orderly cycles in Z340 than in random sequences (both as summarised in the paper, §2.3).
- Before the solution, the paper noted that Z340 has nine rows with no repeated symbol. It speculated that symbols "were assigned in a normal horizontal reading order" (§3, Figure 16).

**Measured by us** (`tools/key_analysis.py`, section 2):
- **Statistic.** For every letter with two or more homophones, take its symbols in text order. Fix the cycle as the order of first use, and count how many consecutive uses move to the next symbol in that cycle.
- **Baseline.** Shuffle each letter's symbol sequence 20,000 times.

| text | follow cycle / transitions | rate | shuffled rate | z | p |
|---|---|---|---|---|---|
| Z408, all 408 (written = plaintext order) | 217 / 303 | 0.72 | 0.32 | 16.1 | < 1e-4 |
| Z408, first 390 (no tail) | 213 / 288 | 0.74 | 0.32 | 16.4 | < 1e-4 |
| Z408 part 1 / part 2 / part 3 | 84/93, 88/99, 37/87 | 0.90 / 0.89 / 0.43 | 0.43 / 0.42 / 0.42 | 10.7 / 11.0 / 0.1 | 2e-4 / 2e-4 / 0.51 |
| Z340, reading (plaintext) order | 89 / 258 | 0.34 | 0.31 | 1.4 | 0.10 |
| Z340, written (transposed) order | 130 / 258 | 0.50 | 0.31 | 7.6 | < 1e-4 |

Z408, per letter (cycle in order of first use, then following/transitions):
- Perfect or near-perfect: H `M )` 15/15, N `O ^ D (` 20/22, F `J Q` 9/10.
- Strong: I `9 P U k` 35/43, T `H I 5 L` 27/33, E `Z p W + 6 N E` 37/53.
- Not cycled: L `% B #` 11/32.

**Conclusions** (ours; the computation is reproducible):
1. **Z408.** Zodiac cycled homophones strictly in parts 1 and 2 (about 90% of transitions) and stopped in part 3, where the rate equals chance. This confirms Oranchak's observation.
2. **Z340.** Cycling is significant in the written (transposed) order and is not significant in reading order. Rows with no repeated symbol: 9 of 20 in written order (the paper's nine), against 1 of 20 in reading order. So Zodiac wrote the plaintext into the transposed layout first and then chose symbols row by row, avoiding repeats and partly cycling. That is the order of operations the paper had guessed. For any cipher suspected of transposition, look for cycling and repeat-avoidance in the written order, not the reading order.
3. **Near repeats.** In 748 solved symbols, no 5-symbol window holds the same symbol three times. The same symbol 2 apart occurs 3 times in Z408 and once in Z340 (written order). Of the 22 same-symbol pairs within 4 positions (Z408 + Z340 written), 14 belong to letters with a single homophone (Z408 M, G, K, P, U, B, Y; Z340 H, C). Z13's `0` at positions 4, 6 and 8 therefore has no precedent in the solved ciphers. If Z13 was made the same way, `0` is most likely a letter with one homophone, or not an ordinary homophone at all (a null or a separator). This is an inference from two ciphers, not a proof.

---

## 2. Key overlap (computed, strict ASCII identity of symbols)

### 2.1 Z408 against Z340

47 symbols occur in both ciphers (Z408 has 54, Z340 has 63). Letters are given as Z408/Z340, with counts in each cipher in brackets:

| sym | Z408/Z340 | | sym | Z408/Z340 | | sym | Z408/Z340 | | sym | Z408/Z340 |
|---|---|---|---|---|---|---|---|---|---|---|
| `8` | A/P (8/4) | | `W` | E/W (9/6) | | `/` | K/U (6/3) | | `X` | O/R (9/2) |
| `G` | A/T (7/6) | | `Z` | E/R (8/4) | | `#` | L/T (10/5) | | `d` | O/L (6/5) |
| `S` | A/D (6/4) | | `p` | E/C (6/11) | | `%` | L/T (11/2) | | `t` | R/L (7/4) |
| `l` | **A/A** (5/7) | | `J` | F/S (6/4) | | `B` | L/E (12/12) | | `7` | S/L (3/3) |
| `V` | B/O (9/6) | | `R` | G/O (12/8) | | `q` | M/U (16/2) | | `@` | S/U (6/1) |
| `f` | D/B (3/4) | | `)` | H/W (8/5) | | `(` | N/T (4/7) | | `F` | S/F (6/10) |
| `z` | D/A (4/9) | | `M` | H/O (8/7) | | `D` | **N/N** (6/4) | | `K` | S/A (5/7) |
| `+` | E/H (8/24) | | `9` | I/N (14/4) | | `O` | N/A (7/10) | | `5` | T/V (8/7) |
| `6` | E/D (8/3) | | `P` | **I/I** (11/3) | | `^` | N/O (6/6) | | `H` | T/I (8/4) |
| `E` | E/R (9/3) | | `U` | I/S (10/5) | | `T` | O/R (7/5) | | `L` | T/G (8/6) |
| `N` | **E/E** (6/5) | | `k` | **I/I** (9/5) | | `Y` | U/N (10/4) | | `c` | V/E (6/10) |
| `A` | W/D (8/2) | | `j` | X/P (1/2) | | `_` | Y/B (8/3) | | | |

**Result.**
- **Agreements.** 5 of 47 symbols carry the same letter in both keys: `l`=A, `N`=E, `P`=I, `k`=I, `D`=N.
- **Expected by chance.** Shuffling the Z340 letters among the 47 shared symbols, which keeps both letter distributions, gives 2.64 agreements on average (simulated mean 2.64, sd 1.56). One-sided p = 0.12 (100,000 permutations).
- **Second null.** Giving each shared symbol the letter of a random Z340 symbol yields a mean of 2.91 and p = 0.16.
- **By occurrences.** Only 10.3% of the Z408 occurrences of shared symbols keep their letter in Z340.
- **Letter-shaped glyphs.** Glyphs shaped like a capital letter decode to that same letter 1 time in 25 in Z408 (`E`) and 2 in 24 in Z340 (`F`, `W`). Chance is about 1 in each.
- **Conclusion.** There is no evidence that one key was derived from the other, or that Zodiac reused letter assignments. The agreement is what independent keys over the same symbol set would give.
- **Prior art.** Oranchak's combined-key image and visualizer show the same comparison ([image](http://zodiackillerciphers.com/images/z408-z340-combined-keys.png); [visualizer](https://doranchak.github.io/zodiac-cipher-key-visualizer/)).

### 2.2 Z13 under each key

Z13 is `AENz0K0M0[NAM`: 13 positions, 8 distinct symbols. 6 of the 8 occur in both Z408 and Z340. `0` and `[` occur in neither.

| symbol | positions | Z408 letter | Z340 letter |
|---|---|---|---|
| `A` | 0, 11 | W | D |
| `E` | 1 | E | R |
| `N` | 2, 10 | E | E |
| `z` | 3 | D | A |
| `0` | 4, 6, 8 | - | - |
| `K` | 5 | S | A |
| `M` | 7, 12 | H | O |
| `[` | 9 | - | - |

- With the Z408 key: `WEED?S?H??EWH`. With the Z340 key: `DREA?A?O??EDO`. Each covers 9 of 13 positions.
- Only `N`=E is the same in both keys.
- Given §2.1, nothing supports assuming that Z13 reuses either key.

### 2.3 Z32 under each key

Z32 is `C9J|#Ok[AMf8?ORTGX6FDVj%HCELzPW9`: 32 positions, 29 distinct symbols.

| sym | pos | Z408 | Z340 | | sym | pos | Z408 | Z340 | | sym | pos | Z408 | Z340 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `C` | 0, 25 | - | Y | | `f` | 10 | D | B | | `F` | 19 | S | F |
| `9` | 1, 31 | I | N | | `8` | 11 | A | P | | `D` | 20 | N | N |
| `J` | 2 | F | S | | `?` | 12 | - | - | | `V` | 21 | B | O |
| `\|` | 3 | - | E | | `R` | 14 | G | O | | `j` | 22 | X | P |
| `#` | 4 | L | T | | `T` | 15 | O | R | | `%` | 23 | L | T |
| `O` | 5, 13 | N | A | | `G` | 16 | A | T | | `H` | 24 | T | I |
| `k` | 6 | I | I | | `X` | 17 | O | R | | `E` | 26 | E | R |
| `[` | 7 | - | - | | `6` | 18 | E | D | | `L` | 27 | T | G |
| `A` | 8 | W | D | | | | | | | `z` | 28 | D | A |
| `M` | 9 | H | O | | | | | | | `P` | 29 | I | I |
| | | | | | | | | | | `W` | 30 | E | W |

- With the Z408 key: `?IF?LNI?WHDA?NGOAOESNBXLT?ETDIEI`, covering 27 of 32 positions.
- With the Z340 key: `YNSETAI?DOBP?AORTRDFNOPTIYRGAIWN`, covering 30 of 32 positions.
- 25 distinct symbols are in both keys, and 3 have the same letter: `D`=N, `P`=I, `k`=I.
- Neither decode is English. This agrees with `research/z32_literature.md`, which also discusses AZdecrypt's differing 408-key file at positions 3, 7 and 23.

---

## 3. The published methodology of the Z340 solution

All from Oranchak, Blake and Van Eycke, "The Solution of the Zodiac Killer's 340-Character Cipher" ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350)), unless noted.

1. **The transposition signal.** Z340 has too few repeating bigrams for a homophonic cipher of its type: 25 (§3, Figure 22). The forum user daikon and Jarl Van Eycke independently found a spike in bigram repeats at period 19 (§5.3).
   - Sam Blake noted that the usual "period 19" was really a pseudo-period (18 when wrapping vertically). He generalised it to doubly periodic proper decimations of the 20x17 grid. The pseudo-period-19, period-19 and (1,2)-decimation readings each give 37 repeating bigrams.
   - On May 17, 2020 Van Eycke proposed a transposition matrix close to the true one, which raised repeating bigrams from 25 to 42. It failed at the time because of Zodiac's enciphering errors.
2. **The search.**
   - Blake enumerated "billions" of candidate transposition schemes, applied them iteratively, and kept variants that passed thresholds on repeating bigrams.
   - Oranchak solved each variant in AZdecrypt. Blake ran ZKDecrypto on the University of Melbourne's Spartan supercomputer.
   - Because whole-cipher transpositions gave nothing, they split the grid into sections: one horizontal split, then one vertical split, then two and three horizontal and three vertical splits. Testing every transposition per section was intractable, so they first applied the same transposition to every section (§5.3).
3. **The solver.**
   - AZdecrypt (Van Eycke) is a hill-climbing homophonic solver. Its score combines language n-gram statistics with an entropy term that stops it converging on texts made of a few common letters, which the paper calls "n-gram spaghetti" (§2.4, §5.3, footnote 6).
   - For the final batch the solvers raised AZdecrypt's n-gram order from 5-grams (the default) to 6-grams.
   - A new feature inserted word spaces automatically, which made partial solutions readable (§5.4).
   - Repository: [github.com/doranchak/azdecrypt](https://github.com/doranchak/azdecrypt).
4. **The hit.** On December 2, 2020 Blake and Oranchak started 655,088 transposition variations through AZdecrypt. By the next day one variant showed three phrases that sounded like Zodiac. That variant split the grid into rows 1-9, rows 10-18, row 19 and row 20, and applied the (1,2)-decimation to each section (§5.4).
5. **Cribbing.**
   - Section 1 alone (153 symbols, multiplicity 63/153 = 0.41, against 0.13 for Z408) failed without cribs.
   - Oranchak fixed the three phrases in place as cribs. That set 27 of the 63 symbols and 83 of the 153 letters, and AZdecrypt's key search converged on the rest.
   - Footnote 7: AZdecrypt can solve the first 9 rows without cribs if it uses 7-grams or longer.
   - Every Z340 symbol occurs in section 1, so the key from section 1 decrypts everything (§5.5).
6. **Finishing.**
   - Section 2 was still partly garbled. Errors clustered on line 15, and Van Eycke found the skipped symbol there.
   - He also found that the 6 untransposed cells had to be left out of the transposition.
   - In the last two rows, the solvers noticed words written backwards (§5.5, Figures 40-43).
   - Kopal's [Zodiac-340 transposition reverser](https://github.com/n1k0m0/Zodiac-340-Transposition-Reverser) and AZdecrypt can undo the transposition.
   - The same layout can be produced by a knight's-move writing rule or by CRRU cryptanalyst Jeanne Anderson's triangle method (§7.1).
7. **Confirmation and timeline.** The solvers sent their report to the FBI's Cryptanalysis and Racketeering Records Unit on December 5, 2020. The solution was made public on December 11, and the FBI confirmed it independently (§5.5).
8. **Our checks.**
   - Our reconstructed read order (§0.2) raises repeating bigrams from 25 to 45.
   - Our homophone counts per letter match the paper's statement that no symbols exist for J, K, Q, X or Z.

---

## 4. Unicity distance, and how many solutions short ciphers admit

**Formula.** Shannon (1949, "Communication theory of secrecy systems", Bell System Technical Journal 28(4)):

U = H(K) / D, with D = log2(26) - H_L ≈ 4.70 - H_L bits per letter

- H(K) is the key entropy.
- H_L is the information per plaintext letter. For running English, about 1.0-1.5 bits gives D ≈ 3.2.
- The textbook example is simple substitution: H(K) = log2(26!) = 88.4 bits, so U ≈ 28 letters ([Wikipedia, Unicity distance](https://en.wikipedia.org/wiki/Unicity_distance), after the Handbook of Applied Cryptography).

**Homophonic substitution.** With s distinct cipher symbols, each mapped to any letter, H(K) = s · log2(26). Only the symbols that occur count; a key entry for an unused symbol is free.

For a very short text, the effective H_L is higher than 1.5. Shannon's 1951 estimates are about 4.14, 3.56 and 3.3 bits for the first, second and third letter of context ("Prediction and entropy of printed English", BSTJ 30). Names and unusual words make it higher still. The table therefore runs H_L from 1.0 to 3.0 (`tools/key_analysis.py`, section 5):

| cipher | length | distinct symbols | H(K), homophonic | U at D=3.7 | D=3.2 | D=2.7 | D=2.2 | D=1.7 |
|---|---|---|---|---|---|---|---|---|
| Z13 | 13 | 8 | 38 bits (36 if the symbols map to distinct letters) | 10 | 12 | 14 | 17 | 22 |
| Z32 | 32 | 29 | 136 bits | 37 | 43 | 50 | 62 | 80 |
| Z408 | 408 | 54 | 254 bits | 69 | 79 | 94 | 115 | 149 |
| Z340 (substitution only) | 340 | 63 | 296 bits | 80 | 93 | 110 | 135 | 174 |

What the table says:
- **Z32** is below unicity distance under every assumption: 32 letters against a U of 37-80.
- **Z13** is at the limit only under the most favourable assumption, long-text redundancy. With realistic short-text redundancy, U is 14-22 against 13 letters, so it is below too.
- These are averages over random keys. Each extra hypothesis Zodiac may have used adds to H(K) and raises U further: a transposition, nulls, misspellings or encoding errors.

**Published estimates.**
- **Z340.** J. von zur Gathen estimated the unicity distance of the full Z340 system at most 152 ([IACR ePrint 2021/1620](https://eprint.iacr.org/2021/1620); Cryptologia 2023; also HistoCrypt). The estimate adds entropy for the sections, the transposition and the irregular substitutions, and tests three base-language entropies: standard English, Z340's own text and Zodiac's whole corpus. The bound barely changed between them (paper §6). We could not extract the per-component numbers from the PDF here.
- **Z13 and Z32.** The paper states that under minimal assumptions such as simple substitution, they do not meet the unicity requirement. For Z32 it is "almost trivial" to generate plausible plaintexts, because 29 of its 32 symbols are unique (§8.2.1).
- **Z18,** the last 18 symbols of Z408 (15 distinct symbols), is in the same position (§8.2.2).
- **Z340 section 1.** This is a published data point on solvability: 153 symbols at multiplicity 0.41 needed cribs, or n-grams of length 7 or more (§5.4, footnote 7). Multiplicity is the ratio of distinct symbols to length (King and Bahler 1993). Z13 is 8/13 = 0.62 and Z32 is 29/32 = 0.91.

**Published experiments on the number of fits.**
- **Oranchak, 2013.** Only about 1 in 12,000,000 plaintexts fits Z13 without violating its constraints. A database of 100 million names gave 213 fits. A dictionary search gave 283 two-word and 1,283,443 three-word fits ([zodiackillerciphers.com, 2013-09-15](https://zodiackillerciphers.com/my-name-is-sarah-the-horse/)).
- **The wiki's "Z13 Solutions" page.** It lists, by our count, about 1,000 proposed strings that fit Z13 as written, with no anagramming. The paper says "thousands" can be generated ([wiki](http://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions)).
- **Oranchak, 2014, on Z32.** Numerous solutions fit, and none can be validated without an indisputable link to the map ([post](https://zodiackillerciphers.com/swedes-crack-zodiacs-map-code/)).
- **Ours.** About 1 in 3,500 random English 32-letter strings satisfies Z32's three repeats (`research/z32_literature.md`, section 4).

---

## 5. Zodiac's documented error habits

**Z408: wrong symbol for the right letter** (§0.1; Oranchak's notes):
- 8 slips in 390 symbols, 2.05%.
- 5 of the 8 involve the three triangle symbols: `7` dotted, `8` solid and `9` open.
- The other 3 are look-alike glyphs: `N` for `H`, `E` for `F`, and `!` read as `I`. The last is a confusion for readers, not for Zodiac.
- Oranchak concludes that Zodiac confused his own similar-looking symbols when he finalised the cipher, or did so on purpose.
- Homophone discipline broke down in part 3 (§1.2).
- One word is apparently missing at the part 2 / part 3 boundary.
- The last 18 symbols do not decode to text.

**Z340: wrong homophone row** (§0.2):
- 8 errors in 340 symbols, 2.35%.
- Two Ks are enciphered with `5`, the V symbol. The Z340 key has no K symbol at all.
- **Our observation, not a published claim:** the other six substitute U→A twice, S→O, I→L, N→H and I→E. Most of these pairs look alike in handwritten lower case (a/u, l/i, h/n, e/i). That would fit Zodiac misreading a handwritten plaintext draft, which differs from the glyph confusions of Z408.

**Z340 transposition irregularities** (§3 above; paper §5.5):
- One symbol was skipped on line 15 and put back at the end of that line. On the wiki's timeline Van Eycke reads it as a slip noticed only on the next line.
- 6 cells in row 10 were left untransposed.
- Six words in the last two rows were written backwards.
- These are why the plain (1,2)-decimation fails at 81 positions.

**Spelling.**
- PARADICE-type spelling (c for s) appears in both ciphers. It is correctly enciphered three times in Z340 (`spelling_kept`).
- Oranchak flags three misspellings in Z408 (notes 6, 10 and 14).
- In his letters Zodiac writes "frunt" and "though" for "thought" on the Z340 card (paper §1.4, with [sic]).
- Oranchak's vocabulary list of Zodiac's writings (`zodiacWords` in Cipher Explorer's [zodiac.js](https://zodiackillerciphers.com/cipher-explorer/zodiac.js?v=3)) shows recurring patterns:
  - a silent e kept before -ing: closeing, fireing, raceing, useing, wipeing, waveing, lyeing, cruzeing;
  - doubled or undoubled consonants: christmass, xmass, untill, allways, coupple, dificult, posibly, controol;
  - vowel slips: victom, pencel, comidy, idiout.

**What this implies for Z13 and Z32** (our arithmetic, `tools/key_analysis.py` section 6):
- The pooled wrong-symbol rate is 16/730 = 2.19%.
- If it carries over, Z13 has about a 25% chance of containing at least one wrong symbol (0.28 expected), and Z32 about 51% (0.70 expected).
- Spelling errors and transposition irregularities would come on top.
- A strict search for Z13/Z32 plaintexts that requires every symbol to be exactly right will miss a correct answer with roughly these probabilities. Allowing errors, however, multiplies the already huge number of fits (§4).

---

## Sources

- Oranchak, D., Blake, S., Van Eycke, J. "The Solution of the Zodiac Killer's 340-Character Cipher." [arXiv:2403.17350](https://arxiv.org/abs/2403.17350) (HTML version read 2026-10-07; saved as `data/sources/arxiv_2403.17350.html`).
- Oranchak, D. "Annotated solution to the 408 cipher, based on the Harden worksheets." [zodiackillerciphers.com/408/key.html](http://zodiackillerciphers.com/408/key.html).
- Zodiac Killer Ciphers Wiki: [Solution to the 340](http://zodiackillerciphers.com/wiki/index.php?title=Solution_to_the_340); [Z13 Solutions](http://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions).
- Oranchak, D. [zodiac-cipher-key-visualizer](https://github.com/doranchak/zodiac-cipher-key-visualizer) (z408.txt, z408-pt.txt, z340.txt, z340-pt.txt, z340-untransposed*.txt).
- Van Eycke, J., Oranchak, D. [AZdecrypt](https://github.com/doranchak/azdecrypt) (bundled Zodiac cipher files).
- Oranchak, D. Cipher Explorer [zodiac.js](https://zodiackillerciphers.com/cipher-explorer/zodiac.js?v=3) (glyph names, Zodiac vocabulary list).
- von zur Gathen, J. "Unicity distance of the Zodiac-340 cipher." [IACR ePrint 2021/1620](https://eprint.iacr.org/2021/1620); Cryptologia (2023).
- Shannon, C. "Communication theory of secrecy systems." Bell System Technical Journal 28(4), 1949, pp. 656-715. Shannon, C. "Prediction and entropy of printed English." Bell System Technical Journal 30(1), 1951.
- [Wikipedia, "Unicity distance"](https://en.wikipedia.org/wiki/Unicity_distance); [Wikipedia, "Zodiac Killer"](https://en.wikipedia.org/wiki/Zodiac_Killer).
- Oranchak, D. "My name is Sarah the horse?" [zodiackillerciphers.com, 2013](https://zodiackillerciphers.com/my-name-is-sarah-the-horse/); "Swedes crack Zodiac's map code?" [zodiackillerciphers.com, 2014](https://zodiackillerciphers.com/swedes-crack-zodiacs-map-code/).
- King, J., Bahler, D. "A framework for the study of homophonic ciphers in classical encryption and genetic systems", Cryptologia 17(1), 1993; "An algorithmic solution of sequential homophonic ciphers", Cryptologia 17(2), 1993. Raddum, H., Sýs, M. "The zodiac killer ciphers", Tatra Mountains Math. Publ. 45, 2010. (Both as cited in arXiv:2403.17350.)
- Kopal, N. [Zodiac-340-Transposition-Reverser](https://github.com/n1k0m0/Zodiac-340-Transposition-Reverser).
