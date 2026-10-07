# Data that is not in this repository

Some inputs are left out because they are third-party material (scans, web pages, papers,
corpora) or because they are large and can be rebuilt. This page says where each one comes from,
which script fetches or builds it, and what needs it. Everything below goes into paths that
`.gitignore` already covers.

What works with a fresh clone and nothing else: `node tools/cipher.js info data/ciphers/z13.json`
and the other cipher-file utilities, and reading every result file. Almost every solver and
statistic (`anneal.js`, `enumerate.js`, the null models) needs the language-model tables of
section 1, and the name searches also need the tables of section 2.

Requirements: the project was run with Node.js 24 and Python 3.13. The Node tools use only
built-in modules (no `npm install`); the Python tools need `numpy`, and the map scripts also
need `Pillow` and `matplotlib`.

## 1. English language model (`data/lm/`)

| Left out | Size | Why |
|---|---|---|
| `data/lm/ngram{1..5}.bin`, `ngram6.keys.bin`, `ngram6.vals.bin`, `ngram6.gamma.bin` | 125 MB | binary tables, rebuildable |
| `data/lm/words.tsv`, `bigrams.tsv`, `words_common.tsv` | 11 MB | derived from Peter Norvig's count files |
| `data/lm/raw/` (880 Project Gutenberg texts, Norvig's `count_1w.txt` / `count_2w.txt`, the letter stream and build logs) | 299 MB | third-party texts and intermediates |

Kept in the repository: `data/lm/README.md` (file formats and the `tools/lm.js` API),
`data/lm/meta.json` (sources, formulas, held-out evaluation, sanity checks),
`data/lm/corpus_manifest.tsv` (the exact list of Gutenberg texts used), and the two stats files.

Sources:

- **Project Gutenberg** plain-text e-books: catalog <https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv>,
  downloaded from the robot mirror <http://aleph.gutenberg.org> (as linked from
  <https://www.gutenberg.org/robot/harvest>). Selection: English, Library of Congress class PS
  (American literature), not poetry or plays, authors born 1850-1945. The 870 texts actually used
  are listed in `data/lm/corpus_manifest.tsv`; the Gutenberg catalog changes over time, so a
  rebuild may select slightly different texts.
- **Peter Norvig's word counts** (<https://norvig.com/ngrams/>, derived from the Google Web 1T
  corpus, LDC2006T13): `count_1w.txt` (md5 `1710e1aa36917a32ba8cee42acf8af4f`) and `count_2w.txt`
  (md5 `44766e613c3750f952b7861ca54a3e49`), taken from
  <https://github.com/norvig/pytudes/tree/main/data/text> because norvig.com serves a bot check to
  scripts. No script downloads them; put them in `data/lm/raw/` by hand, for example
  `curl -L -o data/lm/raw/count_1w.txt https://raw.githubusercontent.com/norvig/pytudes/main/data/text/count_1w.txt`
  (and the same for `count_2w.txt`).

Rebuild (from the repository root):

```
mkdir -p data/lm/raw
curl -L -o data/lm/raw/pg_catalog.csv https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv   # --download reads it, does not fetch it
python tools/lm_build_corpus.py --download --build   # about 25 min of polite downloading, then about 4 min
python tools/lm_build_ngrams.py                      # about 1 min; needs numpy and several GB of RAM
python tools/lm_build_words.py                       # needs count_1w.txt / count_2w.txt in data/lm/raw/
python tools/lm_build_names.py                       # section 2
node tools/lm_build_meta.js                          # benchmarks and sanity checks; rewrites data/lm/meta.json
```

Each script prints its usage with `--help`.

`--download` selects texts afresh from the current catalog and overwrites
`data/lm/corpus_manifest.tsv`. To rebuild from exactly the 870 texts this project used, skip
`--download`: fetch the texts the kept manifest lists, then run `--build` alone (it reads the
manifest and updates only its letter counts):

```
python -c "import csv, os, sys; sys.path.insert(0, 'tools'); import lm_build_corpus as c; os.makedirs(c.GDIR, exist_ok=True); [c.download_one(int(r['pg_id'])) for r in csv.DictReader(open(c.MANIFEST, encoding='utf-8'), delimiter='\t')]"
python tools/lm_build_corpus.py --build
```

Gutenberg revises its files now and then, so a few letter counts may differ slightly from the
manifest.

## 2. Name-frequency tables (`data/names/`)

| Left out | Size | Why |
|---|---|---|
| `data/names/first_male.tsv`, `first_female.tsv`, `first_all.tsv`, `surnames.tsv` | 4.7 MB | rebuildable |
| `data/names/raw/` | 46 MB | downloaded government data |

Sources (US government data), saved in `data/names/raw/`:

- 1990 US Census name files `dist.male.first`, `dist.female.first`, `dist.all.last`:
  <https://www2.census.gov/topics/genealogy/1990surnames/>
- 2010 US Census surnames: <https://www2.census.gov/topics/genealogy/2010surnames/names.zip>,
  saved as `names2010.zip`
- SSA national baby-name counts. ssa.gov refused scripted downloads (HTTP 403), so the project
  used the verbatim concatenation in <https://github.com/jsvine/babynames> (`data/name-counts.csv`),
  saved as `ssa_name-counts_jsvine.csv`.

Build: `python tools/lm_build_names.py` (the weighting formula is in `data/names/README.md`).
The nickname lists in `results/z13names/lists/` are in the repository; they were built from
these tables by `python tools/z13names_nicknames.py`.

## 3. Cipher source files (`data/sources/`)

The canonical cipher files in `data/ciphers/` are in the repository. The downloaded files they
were built and checked from are not:

| File | Source |
|---|---|
| `viz_z408.txt`, `viz_z408-pt.txt`, `viz_z340.txt`, `viz_z340-pt.txt`, `viz_z340-untransposed.txt`, `viz_z340-untransposed-pt.txt` | David Oranchak, <https://github.com/doranchak/zodiac-cipher-key-visualizer> |
| `az_z408.txt`, `az_z408_solved.txt`, `az_z340.txt`, `az_z340_solved.txt`, `az_z340_solved_transposed.txt` | AZdecrypt cipher files, <https://github.com/doranchak/azdecrypt/tree/main/AZdecrypt/Ciphers/Zodiac%20ciphers> |
| `oranchak_408_key.html` | <http://zodiackillerciphers.com/408/key.html> |
| `cipherexplorer_zodiac.js` | <https://zodiackillerciphers.com/cipher-explorer/zodiac.js?v=3> |
| `arxiv_2403.17350.html` | <https://arxiv.org/html/2403.17350> (Oranchak, Blake and Van Eycke) |
| `wiki_solution_to_the_340.html` | <http://zodiackillerciphers.com/wiki/index.php?title=Solution_to_the_340> |
| `wiki_z13_solutions.html` | <https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions> |
| `wp_unicity_distance.wiki`, `wp_zodiac_killer.wiki` | Wikipedia wikitext of "Unicity distance" and "Zodiac Killer" (reference only) |

Fetch: `python tools/fetch_sources.py` (it also compares SHA-256 with the values recorded in
`data/ciphers/z408.json` and `z340.json`; web pages change, so a mismatch is reported, not
fatal). Needed by `tools/build_calibration.py`, `tools/verify_calibration.js` (which stops with
a missing-file error without them), check 5 of `tools/certify_ciphers.py`, and
`tools/audit_wiki_parse.py` (which rebuilds `results/audit/wiki_z13_entries.tsv`).

`python tools/fetch_sources.py --selftest-only` fetches the raw transcriptions behind
`tools/selftest_data/*_selftest.json` (URLs in `tools/selftest_data/sources.json`); they are only
needed to rebuild those two files with `node tools/selftest_data/selftest_make_json.js`.

## 4. Scans of the letters and the map (`data/images/`)

The images are copyrighted or of unclear status and are not redistributed. The project used these
copies (file names as the notes and scripts refer to them); download them by hand from the pages
below. Only the map scripts read images: `tools/mapgeometry_core.py`,
`tools/mapgeometry_annotate.py` and `tools/mapgeometry_figure.py` need
`z32_map_1970-06-26_large_zkf.jpg` and `z32_map_phillips66_inset_unmarked_zkf.jpg`. The others
were used for the visual checks described in `data/ciphers/README.md` and `research/`.

| File | What | Source page |
|---|---|---|
| `z13_letter_1970-04-20_p1_commons.gif` | Z13 letter, page 1 (best scan, binarized) | Wikimedia Commons, <https://commons.wikimedia.org/wiki/File:Zodiac-name.gif> |
| `z13_letter_1970-04-20_p1_zkf.jpg`, `z13_letter_1970-04-20_p2_bomb_zkf.jpg`, `z13_envelope_1970-04-20_zkf.jpg` | Z13 letter pages 1-2 and envelope, colour | zodiackillerfacts.com, <https://zodiackillerfacts.com/gallery/thumbnails.php?album=11> |
| `z13_letter_top_zodiackillerciphers.jpg` | top of the Z13 letter | zodiackillerciphers.com, <https://zodiackillerciphers.com/my-name-is-sarah-the-horse/> |
| `z13_glyphs_magnified_from_commons.png` | 8x magnification of the 13 glyphs | made by us from the Commons scan above |
| `z13_redrawn_zodiackiller-com.gif`, `z13_voigt_greek_inscription_comparison.gif` | redrawn Z13; Tom Voigt's comparison with a Greek inscription | zodiackiller.com, <https://www.zodiackiller.com/MyNameIs.html> |
| `z13_redrawn_wikimedia_with_kane_reading.jpg`, `z13_redrawn_wikimedia_cropped.jpg` | redrawings on Wikimedia Commons (not primary evidence) | <https://commons.wikimedia.org/wiki/File:My_Name_Is_............._Lawrence_Kane,_ZODIAC.jpg> |
| `z32_letter_1970-06-26_color_commons.jpg` | Z32 letter, colour | <https://commons.wikimedia.org/wiki/File:Zodiac-Colour-SFC.jpg> |
| `z32_cipher_clean_commons.png` | the Z32 cipher line, cleaned | Wikimedia Commons, `File:Zodiac-Colour-SFC-Cipher-Black-Clean.png` |
| `z32_letter_1970-06-26_zodiackiller.png`, `z32_envelope_1970-06-26_zodiackiller.png` | Z32 letter and envelope, black and white | zodiackiller.com, <https://zodiackiller.com/ZButtonLetter.html> |
| `z32_letter_1970-06-26_police_photo_zkc.jpg` | high-resolution SFPD photograph (5100x7014) | zodiackillerciphers.com, <https://zodiackillerciphers.com/high-resolution-map-cipher/> |
| `z32_letter_1970-06-26_color_hires_zkc.jpg` | colour photograph labelled "June 26, 1970" | <http://zodiackillerciphers.com/wiki/images/3/31/9a_-_San_Francisco_Chronicle_Map_Code_letter_June_26_1970_Color_High_Res.jpg> |
| `z32_letter_and_map_1970-06-26_commons.jpg` | letter and map piece side by side | <https://commons.wikimedia.org/wiki/File:June_26_1970_Zodiac_letter.jpg> |
| `z32_map_1970-06-26_large_zkf.jpg` | the Zodiac's map piece, colour | zodiackillerfacts.com, <https://zodiackillerfacts.com/The%20Mt.%20Diablo%20Map.htm> |
| `z32_map_phillips66_inset_unmarked_zkf.jpg`, `z32_map_phillips66_front_zkf.jpg`, `z32_map_phillips66_cover_legend_zkf.jpg` | an unmarked exemplar of the same Phillips 66 map (the sheet photo is by Ed Neil) | same page |
| `z32_map_crossed_circle_zkf.jpg`, `z32_map_magnetic_north_note_zkf.jpg` | close-ups of the marking | zodiackillerfacts.com, <https://zodiackillerfacts.com/The%20Mysteries%20of%20the%20Mt.%20Diablo%20Map.htm> |
| `z32_map_1970-06-26_zodiackiller.png` | the map piece, black and white | zodiackiller.com, <https://zodiackiller.com/ZMap.html> |
| `z32_little_list_letter_1970-07-26_p2_zodiackiller.png`, `_p5_zodiackiller.png` | July 26, 1970 letter, pages 2 and 5 | zodiackiller.com, <https://www.zodiackiller.com/Mikado1.html> |
| `glyphs/*.jpg` (45 files) | small glyph thumbnails | Oranchak's tools on zodiackillerciphers.com (exact page not recorded) |

## 5. Prior-art pages and YouTube metadata (`results/lead/priorart/pages/`, `yt/`)

About 140 saved web pages, two papers and the descriptions of ten YouTube videos that
`results/lead/priorart/priorart.md` was written from. They are third-party material. Each saved
file name is mapped to its source URL in `results/lead/priorart/pages_index.md`. The pages were
saved by hand; the YouTube metadata is fetched by `python tools/lead_priorart_yt.py <ids>`, and
`tools/lead_priorart_kwic.py` makes the text extracts the search used.

## 6. Map geocoding cache (`results/mapgeometry/cache/http_cache.json`)

Cached Nominatim (OpenStreetMap) and Wikipedia API responses for the map geometry task (data
copyright OpenStreetMap contributors, ODbL, and Wikipedia contributors). `tools/mapgeometry_fetch.py`
recreates the cache on the first run of the map scripts with network access, at one Nominatim
request per 1.1 s. The places and roads are 2026 data, not 1970 data.

## 7. Large result files

Candidate dumps, binary null arrays and console logs are listed in `results/EXCLUDED.md`, with
the command that regenerates each group.
