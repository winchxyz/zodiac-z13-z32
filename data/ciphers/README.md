# Canonical cipher files

Certified 2026-10-07 by the `certify` task, the reconciliation step before the attack phase.

| File | Cipher | Length | Distinct | Isomorph (letters by first appearance) | Status |
|---|---|---|---|---|---|
| `z13.json` | Z13, "My name is", letter postmarked 1970-04-20 | 13 | 8 | `abcdefegehcag` | unsolved; transcription confirmed on 3 images |
| `z32.json` | Z32, Mt. Diablo / "button letter" code, letter postmarked 1970-06-26 | 32 | 29 | `abcdefghijklmfnopqrstuvwxayzABCb` | unsolved; transcription confirmed on 3 independent images |
| `z408.json` | Z408, mailed 1969-07-31, solved 1969 by D. and B. Harden | 408 | 54 | (in file) | solved; calibration |
| `z340.json` | Z340, mailed 1969-11-08, solved 2020 by Oranchak, Blake and Van Eycke | 340 | 63 | (in file) | solved; calibration; has `read_order` |

Canonical strings:

```
Z13  AENz0K0M0[NAM
Z32  C9J|#Ok[AMf8?ORTG
     X6FDVj%HCELzPW9
```

Positions everywhere are 0-based, in written order unless a field says otherwise.

## Re-checking

```
python tools/certify_ciphers.py            # report; exit 0 = all derived fields current, no problems
python tools/certify_ciphers.py --write    # rewrite derived fields from ascii (only files that change)
python tools/certify_ciphers.py --verbose  # also list every shared character with each file's description
python tools/certify_ciphers.py --table    # raw alphabet table
python tools/certify_ciphers.py --export-variants   # one-line files in data/ciphers/variants/
```

The script checks that `ascii` equals the joined `rows`, recomputes `length`, `isomorph`, and each
symbol's `count`, `positions` and cross-cipher flags (`in_z13`, `in_z32`, `in_z408`, `in_z340`;
a file has no flag for itself), checks the `transcription_variants` entries, recomputes the
Z13/Z32 key carry-over from the `key` fields of `z408.json` and `z340.json`, and compares
`z408.json` / `z340.json` with the downloaded source files in `data/sources/`.

Loader caveat for anyone adding fields: `tools/cipher.js` looks for `ascii`, `rows`,
`read_order`, `plaintext`, `solution` and similar keys in nested objects too (not inside
arrays). Do not add a nested object containing one of those keys to `z13.json` or `z32.json`,
or the solvers will pick it up as the cipher's text, read order or known plaintext.

## ASCII convention

All four files use David Oranchak's transcription convention, the one used by the
zodiackillerciphers.com webtoy, his Cipher Explorer and the cipher files bundled with AZdecrypt
([webtoy symbol map](https://zodiackillerciphers.com/webtoy/zodiac.js?v=1),
[Cipher Explorer](https://zodiackillerciphers.com/cipher-explorer/zodiac.js?v=3),
[AZdecrypt ciphers](https://github.com/doranchak/azdecrypt/tree/main/AZdecrypt/Ciphers/Zodiac%20ciphers),
[wiki: Webtoy's transcription scheme](http://zodiackillerciphers.com/wiki/index.php?title=Webtoy%27s_transcription_scheme)).

- Upper-case letters are letters in normal orientation.
- Lower-case letters are mirror-reversed letters, with two exceptions: `z` is the crosshairs
  and `t` is the upside-down T.
- Digits and punctuation are shapes. In particular `8` is the filled triangle, not a circled 8,
  and `0` is the Z13 circled glyph.
- The webtoy marks `0`, `[` and `?` as "symbols unique to 13- and 32-character ciphers".

One character means one glyph in every file. No two visually different glyphs share a character,
and every glyph that occurs in more than one cipher has the same character everywhere. This was
checked by eye against the scans (see Certification below) and is re-checked mechanically for
consistent descriptions by `--verbose`. The canonical files contain no invented characters: every
Z13/Z32 code, including `0`, `[` and `?`, comes from Oranchak's own symbol map. Variant-only codes
are listed under Open questions.

## Shared alphabet

Counts per cipher. "Z408 key" and "Z340 key" are the letters in the `key` fields (one letter per
symbol, as enciphered). Where the Hardens' Z408 plaintext reads a symbol as more than one letter
(Zodiac's enciphering slips), the counts are given in brackets. `-` means the symbol is not in that
cipher. The Cipher Explorer name is the name of the glyph image Oranchak's tools use for the code.

| ASCII | glyph | Cipher Explorer name | Z13 | Z32 | Z408 | Z340 | Z408 key | Z340 key |
|---|---|---|---|---|---|---|---|---|
| `A` | A | a | 2 | 1 | 8 | 2 | W | D |
| `B` | B | b |  |  | 12 | 12 | L | E |
| `C` | C | c |  | 2 |  | 5 | - | Y |
| `D` | D | d |  | 1 | 6 | 4 | N | N |
| `E` | E | e | 1 | 1 | 9 | 3 | E (Harden plaintext: E 8, S 1) | R |
| `F` | F | f |  | 1 | 6 | 10 | S | F |
| `G` | G (curled, looks like a 6) | g |  | 1 | 7 | 6 | A | T |
| `H` | H | h |  | 1 | 8 | 4 | T | I |
| `I` | I with serifs | i |  |  | 10 |  | T | - |
| `J` | J with top bar | j |  | 1 | 6 | 4 | F | S |
| `K` | K | k | 1 |  | 5 | 7 | S | A |
| `L` | L | l |  | 1 | 8 | 6 | T | G |
| `M` | M | m | 2 | 1 | 8 | 7 | H | O |
| `N` | N | n | 2 |  | 6 | 5 | E (Harden plaintext: E 5, T 1) | E |
| `O` | O | o |  | 2 | 7 | 10 | N | A |
| `P` | P | p |  | 1 | 11 | 3 | I | I |
| `Q` | Q | q |  |  | 5 |  | F | - |
| `R` | R | r |  | 1 | 12 | 8 | G | O |
| `S` | S | s |  |  | 6 | 4 | A | D |
| `T` | T | t |  | 1 | 7 | 5 | O | R |
| `U` | U | u |  |  | 10 | 5 | I | S |
| `V` | V | v |  | 1 | 9 | 6 | B | O |
| `W` | W | w |  | 1 | 9 | 6 | E | W |
| `X` | X | x |  | 1 | 9 | 2 | O | R |
| `Y` | Y | y |  |  | 10 | 4 | U | N |
| `Z` | Z | z |  |  | 8 | 4 | E | R |
| `b` | reversed B | bb |  |  |  | 3 | - | E |
| `c` | reversed C | bc |  |  | 6 | 10 | V | E |
| `d` | reversed D | bd |  |  | 6 | 5 | O | L |
| `e` | reversed E | be |  |  | 10 |  | C | - |
| `f` | reversed F | bf |  | 1 | 3 | 4 | D | B |
| `j` | reversed J with top bar (looks like a tau) | bj |  | 1 | 1 | 2 | X | P |
| `k` | reversed K | bk |  | 1 | 9 | 5 | I | I |
| `l` | reversed L | bl |  |  | 5 | 7 | A | A |
| `p` | reversed P | bp |  |  | 6 | 11 | E | C |
| `q` | reversed Q | bq |  |  | 16 | 2 | M | U |
| `r` | reversed R | br |  |  | 7 |  | R | - |
| `t` | upside-down T, plain base | perp |  |  | 7 | 4 | R | L |
| `y` | reversed Y | by |  |  |  | 5 | - | I |
| `z` | crosshairs (Zodiac signature sign) | zodiac | 1 | 1 | 4 | 9 | D | A |
| `!` | "funny I" (serifed I, broken stem) | funnyi |  |  | 6 |  | O | - |
| `#` | filled square | sq |  | 1 | 10 | 5 | L | T |
| `%` | square, filled except an open triangle at upper left | sqr |  | 1 | 11 | 2 | L | T |
| `&` | P with filled bowl | pf |  |  |  | 2 | - | S |
| `(` | circle on a vertical stroke | theta |  |  | 4 | 7 | N | T |
| `)` | ellipse on a horizontal stroke | phi |  |  | 8 | 5 | H | W |
| `*` | square, filled except an open triangle at upper right | sql |  |  |  | 6 | - | A |
| `+` | plus sign | plus |  |  | 8 | 24 | E | H |
| `-` | dash | dash |  |  |  | 5 | - | S |
| `.` | dot | dot |  |  |  | 6 | - | N |
| `/` | slash | slash |  |  | 6 | 3 | K | U |
| `0` | heavy circle with an 8-like or Taurus-like interior | taurus | 3 |  |  |  | - | - |
| `1` | filled circle, open at top | n1 |  |  |  | 3 | - | R |
| `2` | filled circle, open at bottom | n2 |  |  |  | 9 | - | M |
| `3` | filled circle, open at left | n3 |  |  |  | 2 | - | Y |
| `4` | filled circle, open at right | n4 |  |  |  | 6 | - | E |
| `5` | filled circle | n5 |  |  | 8 | 7 | T | V |
| `6` | circle with centre dot | n6 |  | 1 | 8 | 3 | E | D |
| `7` | triangle with small inner triangle | n7 |  |  | 3 | 3 | S (Harden plaintext: S 2, A 1) | L |
| `8` | filled triangle | n8 |  | 1 | 8 | 4 | A (Harden plaintext: A 4, S 3, I 1) | P |
| `9` | open triangle | n9 |  | 2 | 14 | 4 | I (Harden plaintext: I 13, W 1) | N |
| `:` | serifed I, dot at right | idr |  |  |  | 2 | - | T |
| `;` | serifed I, dot at left | idl |  |  |  | 3 | - | T |
| `<` | less-than sign | lt |  |  |  | 6 | - | I |
| `=` | "sideways K" | sidek |  |  | 7 |  | P | - |
| `>` | greater-than sign | gt |  |  |  | 4 | - | N |
| `?` | omega | omega |  | 1 |  |  | - | - |
| `@` | open square with centre dot | sqd |  |  | 6 | 1 | S | U |
| `[` | upside-down T whose base hooks up at the right | t2 | 1 | 1 |  |  | - | - |
| `\` | backslash | backslash |  |  | 5 |  | R | - |
| `^` | caret | caret |  |  | 6 | 6 | N | O |
| `_` | open square | sqe |  |  | 8 | 3 | Y | B |
| `\|` | plain vertical bar, no serifs | bar |  | 1 |  | 10 | - | E |

73 codes in all. Printable ASCII characters used by none of the four files: the lower-case
letters a, g, h, i, m, n, o, s, u, v, w, x, and the punctuation `"` `$` `'` `,` `]` `{` `}` `~`
and the backtick. The convention reserves lower-case letters for mirrored letters, so the
variant-only codes (`{`, `}`, `$`) are taken from the punctuation.

### What Z13 and Z32 share with the solved ciphers

- Z13 (8 symbols): `A E N z K M` are in both Z408 and Z340; `0` is in no other cipher; `[` is
  only in Z32. Shared with Z32: `A E M z [`.
- Z32 (29 symbols): 25 are in both Z408 and Z340; `C` and `|` only in Z340; `[` only in Z13;
  `?` (omega) in no other cipher.
- Key carry-over, recomputed from `z408.json` / `z340.json` (`?` = no value):

| cipher | Z408 key | Z340 key |
|---|---|---|
| Z13 | `WEED?S?H??EWH` | `DREA?A?O??EDO` |
| Z32 | `?IF?LNI?WHDA?NGOAOESNBXLT?ETDIEI` | `YNSETAI?DOBP?AORTRDFNOPTIYRGAIWN` |

Neither is English. Both solved keys are homophonic, so a carried-over string is a weak
hypothesis by construction.

## Certification

Done by looking at the scans, magnified with PIL crops (the crops are scratch files, not kept).

**Z13**, against `data/images/z13_letter_1970-04-20_p1_commons.gif` (binarized 640x829;
[Commons File:Zodiac-name.gif](https://commons.wikimedia.org/wiki/File:Zodiac-name.gif)),
`z13_glyphs_magnified_from_commons.png` (per-glyph crops of the same scan),
`z13_letter_1970-04-20_p1_zkf.jpg` (colour, 407x576) and `z13_letter_top_zodiackillerciphers.jpg`
(colour, 657x262). All show the same 13 glyphs on one row: A, E, N, crosshairs, circled glyph, K,
circled glyph, M, circled glyph, hooked upside-down T, N, A, M. The string matches glyph for
glyph. A, E, N, K and M are normal (not mirrored) capitals. The three circled glyphs look alike at
this resolution. No published source disagrees on symbol identity or order
(`research/z13_literature.md` section 2).

**Z32**, against three independent images: the colour scan `z32_letter_1970-06-26_color_commons.jpg`
([Commons File:Zodiac-Colour-SFC.jpg](https://commons.wikimedia.org/wiki/File:Zodiac-Colour-SFC.jpg)),
the black-and-white scan `z32_letter_1970-06-26_zodiackiller.png`
([zodiackiller.com](https://zodiackiller.com/ZButtonLetter.html)) and the SFPD photograph
`z32_letter_1970-06-26_police_photo_zkc.jpg` (5100x7014,
[wiki image](http://zodiackillerciphers.com/wiki/images/7/7d/Button_Letter_with_32_code_large.jpg)).
All show 17 + 15 symbols, identical to the string.

Cross-cipher glyph identities, checked against the Commons colour photo of the Z340
([File:4abc ... 340 Cipher COLOR.jpg](https://commons.wikimedia.org/wiki/File:4abc_-_San_Francisco_Chronicle_Dripping_Pen_Card_November_8_1969_340_Cipher_COLOR.jpg))
and Oranchak's combined Z408/Z340 key image
([z408-z340-combined-keys.png](http://zodiackillerciphers.com/images/z408-z340-combined-keys.png)):

- Z32 position 23 is a square filled except for an open triangle at the upper left. Z340 has both
  orientations in its 0-based row 1: `%` at column 7 (open upper left) and `*` at column 13 (open
  upper right). The Z32 glyph is `%`, which the combined key lists as Z408 L / Z340 T.
- Z32 position 22 is a backwards J with a top bar that looks like a tau. The two Z340 `j` glyphs
  (0-based rows 4 and 7) are drawn the same way, and the combined key shows this shape for
  Z408 X / Z340 P.
- Z13 position 9 and Z32 position 7 are the same glyph, an upside-down T whose base turns up at the
  right end (`[`). The Z340 `t` glyphs (0-based rows 4 and 10) and the combined key's Z408 R /
  Z340 L sign are plain upside-down Ts without the hook, so the convention's separate code is kept.
- Z32 position 3 is a plain stroke without serifs, the Z340 bar `|`, not the serifed Z408 `I`.
- The crosshairs in Z13 and Z32 are the same sign as Z408/Z340 `z` (circle with both strokes
  extending beyond it).

Each file also carries a `certification` block with the images and findings, and a
`transcription_variants` array (below).

## Open transcription questions

Each alternative that changes the symbol string has a ready-made entry in the file's
`transcription_variants` array (`id`, `ascii`, `length`, `distinct`, `isomorph`, `change`,
`plausibility`, `basis`). Plausibility is our judgement from the images: default, medium or low.

### Z13

| # | Question | Default | Alternatives (variant id) | Evidence |
|---|---|---|---|---|
| 13.1 | Are the three circled glyphs (4, 6, 8) one symbol? | one symbol `0` | three symbols: `AENz0K{M}[NAM` (`z13.circles_distinct`, low; `{` `}` are variant-only codes) | Inner strokes differ slightly between copies; no scan resolves them. Every published transcription treats them as one. Read as a circled 8, Taurus, Cancer or "8-ball" (`research/z13_literature.md` 2.3). |
| 13.2 | Is `[` the Z408/Z340 upside-down T `t`? | distinct `[` | `AENz0K0M0tNAM` (`z13.bracket_is_perp`, medium): Z408 key gives R, Z340 key L | As drawn it has an upturned hook that the Z340 `t` lacks. Equated by Oranchak's 2012 Lafferty critique (as a possibility) and T.C. 2025; read as Aries (Lafferty, Ziraoui), P (Garlick) or T by others. |
| 13.3 | Is the crosshair a cipher symbol? | cipher symbol `z` | removed: `AEN0K0M0[NAM`, 12 symbols (`z13.crosshair_null`, low) | It is a cipher symbol in Z408 (D) and Z340 (A), but also the signature, and appears in the score line on page 2 of this letter. Lafferty read it as Z. |
| 13.4 | Are the letter glyphs plaintext? | cipher symbols | same string, pins `A=A,E=E,N=N,K=K,M=M` or a subset (`z13.letters_literal`, low) | Voigt's Greek-inscription comparison; TheDecipherist (2026). |
| 13.5 | Reading order | left to right | right to left `MAN[0M0K0zNEA` (`z13.reversed`, low, with an `order` list); any transposition | Nothing in the letter suggests transposition; Z340 used one (arXiv:2403.17350 section 8.2.1). |
| 13.6 | Image quality | - | - | Best scan is binarized 640x829; no high-resolution colour scan found. This is the main limit on 13.1. |

### Z32

| # | Question | Default | Alternatives (variant id) | Evidence |
|---|---|---|---|---|
| 32.1 | Position 3: bar or serifed I? | `\|` (Z340 E) | `I` (Z408 T): `C9JI#Ok[...` (`z32.bar_is_serif_I`, low) | No serifs in any image. The wiki's alphabet comparison mentions treating bar and serifed I as one symbol. |
| 32.2 | Ring under position 3 in the SFPD photo | not part of the glyph | read as a dot (no convention code exists for a bar with a dot below; `:` and `;` have the dot at the side) | Only in the photograph, not in either scan; looks like a defect. No variant generated. |
| 32.3 | Position 7: is `[` the plain `t`? | distinct `[` | `t` (Z408 R, Z340 L): `C9J\|#OktAMf8...` (`z32.t2_is_perp`, medium) | Same glyph question as 13.2. |
| 32.4 | Positions 3 and 7 together | - | `C9JI#OktAMf8...` (`z32.bar_I_and_t2_perp`, low) | Gives the largest overlap with the Z408 key; only `C` and the omega stay unmatched. |
| 32.5 | Is the tau-like glyph at 22 the backwards J `j`? | `j` (Z408 X, Z340 P) | separate symbol `$` (`z32.tau_distinct`, low) | Same shape as the Z340 `j` glyphs. Oranchak's webtoy keeps a commented-out code `$` for a "tao" glyph, so a separate tau was once considered. Matters only for key carry-over. |
| 32.6 | Open triangles (1, 31) vs filled triangle (11) | distinct `9` / `8` | merged: `...AMf9?ORTG...` (`z32.triangles_merged`, low) | Clearly outline vs solid in every image; Praetorian (2026) merged them. Z408/Z340 treat them as different symbols. |
| 32.7 | Omega at 12 | `?`, unique | none in the convention | No counterpart in Z408 or Z340. |
| 32.8 | `C` pair (0, 25) and `O` pair (5, 13) | same symbol | - | The two copies differ slightly in size and roundness; every source treats them as the same. |
| 32.9 | AZdecrypt's `Zodiac 32 with 408 key.txt` | not adopted | it decodes 3 as E, 7 as O and leaves 23 undecoded | Differs from a strict decode under the convention at those three positions; its reasoning is undocumented ([file](https://raw.githubusercontent.com/doranchak/azdecrypt/master/AZdecrypt/Ciphers/Zodiac%20ciphers/Zodiac%2032%20with%20408%20key.txt)). Our image check puts 23 with the Z408 `%`. |
| 32.10 | Reading order | row 1 then row 2, left to right | any transposition | Rows are 17 + 15, both starting at the left margin. |
| 32.11 | Z408 value of the filled triangle `8` | A (key) | S or I (Harden plaintext slips) | Affects only the carried-over Z408 reading at position 11. |

Carry-over for the variants:

| variant | ascii | Z408 key | Z340 key |
|---|---|---|---|
| z13.canonical | `AENz0K0M0[NAM` | `WEED?S?H??EWH` | `DREA?A?O??EDO` |
| z13.bracket_is_perp | `AENz0K0M0tNAM` | `WEED?S?H?REWH` | `DREA?A?O?LEDO` |
| z13.crosshair_null | `AEN0K0M0[NAM` | `WEE?S?H??EWH` | `DRE?A?O??EDO` |
| z32.canonical | `C9J\|#Ok[AMf8?ORTGX6FDVj%HCELzPW9` | `?IF?LNI?WHDA?NGOAOESNBXLT?ETDIEI` | `YNSETAI?DOBP?AORTRDFNOPTIYRGAIWN` |
| z32.bar_is_serif_I | `C9JI#Ok[AMf8?ORTGX6FDVj%HCELzPW9` | `?IFTLNI?WHDA?NGOAOESNBXLT?ETDIEI` | `YNS?TAI?DOBP?AORTRDFNOPTIYRGAIWN` |
| z32.t2_is_perp | `C9J\|#OktAMf8?ORTGX6FDVj%HCELzPW9` | `?IF?LNIRWHDA?NGOAOESNBXLT?ETDIEI` | `YNSETAILDOBP?AORTRDFNOPTIYRGAIWN` |
| z32.bar_I_and_t2_perp | `C9JI#OktAMf8?ORTGX6FDVj%HCELzPW9` | `?IFTLNIRWHDA?NGOAOESNBXLT?ETDIEI` | `YNS?TAILDOBP?AORTRDFNOPTIYRGAIWN` |
| z32.triangles_merged | `C9J\|#Ok[AMf9?ORTGX6FDVj%HCELzPW9` | `?IF?LNI?WHDI?NGOAOESNBXLT?ETDIEI` | `YNSETAI?DOBN?AORTRDFNOPTIYRGAIWN` |
| z32.tau_distinct | `C9J\|#Ok[AMf8?ORTGX6FDV$%HCELzPW9` | `?IF?LNI?WHDA?NGOAOESNB?LT?ETDIEI` | `YNSETAI?DOBP?AORTRDFNO?TIYRGAIWN` |

(If `|` and `I` were truly one symbol, it would carry T from Z408 and E from Z340; the table shows
the strict decode of the substituted character, so the Z340 column has `?` there.)

### Z408 and Z340 (calibration files)

- Z408 position 105: `!` ("funny I", key O) in `z408.json`, following Oranchak's visualizer file
  and his annotated key (note 20); AZdecrypt's `Zodiac 408.txt` and the wiki's transcription page
  have the plain serifed `I` (key T). See `z408.json` `transcription_variants`.
- Z340: `z340.json` matches both Oranchak's visualizer file and AZdecrypt's `Zodiac 340.txt`
  exactly; no open transcription question. Two read orders are stored: `read_order` (the solvers'
  files) and `read_order_paper_final` (the paper's placement of the 6 untransposed letters).

## Running variants

Every distinct variant string is exported as a one-line text file in `data/ciphers/variants/`
(`<variant id>.txt`; Z32 loses its 17/15 row layout there, which the solvers do not use). Pass
the file, not the raw string: `node` here is a Volta shim that sends its arguments through
cmd.exe, which mangles `|`, `%`, `^` and `&`. A raw `--cipher 'C9J|#Ok...'` fails with
"is not recognized as an internal or external command".

```
python tools/certify_ciphers.py --export-variants      # (re)writes data/ciphers/variants/*.txt
node tools/anneal.js --cipher data/ciphers/variants/z32.t2_is_perp.txt --mode homophonic --restarts 200 --wordweight 1 --top 50 --out results/<name>.json
node tools/enumerate.js words --cipher data/ciphers/variants/z13.bracket_is_perp.txt --mode simple --top-words 20000 --max-words 4 --out results/<name>.json
node tools/anneal.js --cipher data/ciphers/z13.json --mode simple --pin "A=A,E=E,N=N,K=K,M=M" --restarts 200 --wordweight 1
```

Files: `z13.canonical`, `z13.bracket_is_perp`, `z13.circles_distinct`, `z13.crosshair_null`,
`z13.reversed`, `z32.canonical`, `z32.bar_is_serif_I`, `z32.t2_is_perp`, `z32.bar_I_and_t2_perp`,
`z32.triangles_merged`, `z32.tau_distinct` (`z13.letters_literal` has the canonical string and is
run with `--pin`).

## Smoke tests (2026-10-07)

Full summary: `results/certify_smoke.json`.

| test | result |
|---|---|
| `certify_ciphers.py` | 0 problems. The only derived-field change was adding the `in_z32` flags to `z13.json` and `in_z13` to `z32.json`; all stored counts, positions, isomorphs and `in_z408`/`in_z340` flags were already correct. |
| anneal Z408 from scratch, 36 restarts | Solved: 96.3% of letters match the Hardens' plaintext (ceiling 98.0% for any single key, because of 8 enciphering slips); 29 of 36 restarts reach the best key. 144 s on a loaded machine (the self-test recorded 7-34 s). `results/certify_smoke_z408.json` |
| anneal Z340 with `read_order`, 36 restarts | Solved: 97.1%; 26 of 36 restarts; 6.8 s. `results/certify_smoke_z340.json` |
| enumerate Z13, 20k words, up to 4 words, simple substitution | Complete in 3.9 s: 625,218 consistent strings, 356,547 of them all vocabulary words (top: A DEFINITIVE AT, ON THE DEFEAT OF, IN THE DESERT IS). `results/certify_smoke_z13_words.json` |
| anneal Z32, 40 restarts, word term on | Plumbing check only: 79 distinct English-looking keys from 40 restarts, best SESSION OF THE MORE THAT WOULD STRANGE. `results/certify_smoke_z32.json` |
| published proposals vs the canonical files | DMW, Burke, Grinell/InStepWithTheStars and Cragle Z32 phrases fit; Garlick's DREATATOTPEDO fits homophonically; ALFREDENEUMAN fails on `N`; MARVINMERRILL fails on 4 symbols. |

## Change log

- 2026-10-07 (certify): added `in_z32` to every `z13.json` symbol and `in_z13` to every `z32.json`
  symbol; added `certification` and `transcription_variants` to both; exported the variant
  strings to `data/ciphers/variants/`; `z32.json` line endings normalised to LF. No symbol, position or ASCII code changed in any of the four files. Corrected
  one count in `research/z32_literature.md` (Z408 covers 25 of 29 Z32 symbols and 27 of 32
  positions, not 26 and 29).
