# Result files left out of this repository

The working copy of `results/` held about 1.3 GB in about 2,950 files. This repository keeps the
summaries, tables, reviews and per-run JSON that the report and `results/lead/DECISION.md` rely on
(no file over 2 MB, about 53 MB in all). The groups below were left out. Every one of them can be
regenerated with the command given; most commands are also recorded, with their exact arguments,
in the task's `commands.log`, its queue/run shell script, or the `command`/`argv` field of the JSON
summary written next to the missing file. Heavy runs were started through
`node tools/run_slot.js --label <task> -- <command>`, which only limits how many jobs run at once.

Inputs that are not in the repository (language-model tables, name tables, scans, downloaded
sources) are described in `DATA.md`; most regenerations below need the language-model tables.

Enumerations stopped by a time limit (`--max-seconds`) or using random draws with a fixed seed
reproduce the same summary statistics, but a time-limited stream can end at a different row on a
different machine.

## Large candidate dumps

| Left out | Size | What | Regenerate |
|---|---|---|---|
| `cyclemodel/enum_z13_{canonical,circles_distinct,crosshair_null,reversed}_{simple,homophonic}.tsv` (8 files) | 1.0 GB | every word-string fit of each Z13 reading streamed by `enumerate.js` (the `.json` summaries are kept) | `node tools/cyclemodel_pipeline.js --steps enum` |
| `cyclemodel/names_z13_canonical_{simple,homophonic}.tsv` | 36 MB | every name fit (FL, FIL, FML patterns) | same command |
| `z13names/runs/*.tsv.gz` (48 files) | 42 MB | every 0-filler name fit per reading, mode and list (the `.json` cells are kept) | `node tools/z13names_run.js --threads 4` |
| `z13names/review/repro/*.tsv.gz` (2 files) | 3 MB | the reviewer's re-run of two of those cells | `node tools/z13names_run.js --only canonical --lists male --modes homophonic` and `--lists female --modes simple` (output then compared by `results/z13names/review/tools/review_compare_repro.js`) |
| `nullmodel/oranchak/names_{simple,homophonic}.tsv.gz` | 29 MB | every name fit for Oranchak's 24 name patterns | `bash tools/nullmodel_oranchak.sh` |
| `nullmodel/windows/fits_z32.*_train.tsv` (6 files) | 7 MB | every training-corpus window that fits a Z32 reading (the held-out files and `window_counts.json` are kept) | `python tools/nullmodel_windows.py --cache <dir> --scrambled13 100 --scrambled 300` (needs `data/lm/raw/`) |
| `lead/torpedo/null.jsonl` | 35 MB | the 20,000 random-key null draws of the TORPEDO test (summaries in `headline.json`, `summary.json`) | `node tools/lead_torpedo_null.js --n 10000 --kinds permute,stratified --threads 4 --out results/lead/torpedo/null.jsonl` |
| `lead/torpedo/real_circles_z340_top20000.tsv` | 1.3 MB | the top 20,000 completions under the three-circle reading | `node tools/lead_torpedo_real.js --out results/lead/torpedo/real.json --tsv results/lead/torpedo/real_circles_z340_top20000.tsv` |
| `z13phrases/name_tokens.tsv` | 1.7 MB | name-like token list built from the name tables | `node tools/z13phrases_lexicon.js` (needs `data/names/*.tsv`) |
| `z13phrases/runs/full2_circles_distinct_homophonic.tsv` | 1.3 MB | stream of one enumeration job (its `.json` is kept) | `node tools/z13phrases_batch.js` (the job's options are in its `.json`) |
| `z32search/enumerate/z32_m5_fits.tsv` | 1.4 MB | every theme-word string of up to 5 words that fits Z32 | `bash tools/z32search_enum.sh` |

## Binary null arrays

| Left out | Size | What | Regenerate |
|---|---|---|---|
| `lead/replicate/nulls_{z340,z408}_*.f64` (11 files) | 10 MB | raw Float64 null statistics behind `nulls_z340.json` / `nulls_z408.json` | `node tools/lead_replicate_run.js --key z340 --draws 10000 --threads 4 --out results/lead/replicate/nulls_z340.json` (and `--key z408`); see `lead/replicate/commands.log` |
| `lead/skeptic/stat/multiverse_*.f64` (10 files) | 27 MB | raw null statistics of the skeptic's multiverse runs (each `.json` summary is kept) | `node tools/lead_skeptic_stat_multiverse.js --key z340 --null perm` and the other key/null pairs in `lead/skeptic/stat/commands.log` |

## Third-party material

| Left out | Size | Why | Where to get it |
|---|---|---|---|
| `lead/priorart/pages/` (143 files) | 14 MB | saved web pages and papers | source URLs in `lead/priorart/pages_index.md` |
| `lead/priorart/yt/*.json` (10 files) | 40 KB | YouTube titles and descriptions | `python tools/lead_priorart_yt.py <ids>` (ids in `lead/priorart/pages_index.md`) |
| `mapgeometry/mapgeometry_figure.png`, `.svg` | 3.7 MB | the figure is drawn over a zodiackillerfacts.com scan of the map | `python tools/mapgeometry_figure.py` (needs the scans in `DATA.md`) |
| `mapgeometry/review/crop_*.png`, `figure_small.png` (5 files) | 3.5 MB | crops of the same scans made by the reviewer | `python tools/mapgeometry_crop.py <image> <cx> <cy> ...` |
| `mapgeometry/cache/http_cache.json` | 0.7 MB | cached Nominatim (OpenStreetMap) and Wikipedia API responses | recreated by `tools/mapgeometry_fetch.py` on the first online run of the map scripts |

## Console logs and markers

| Left out | What |
|---|---|
| about 1,020 `*.log` / `*_log.txt` files and the `logs/` folders (3 MB, 838 of them from `z13phrases`) | stdout and stderr of the runs; every run's results are in its JSON |
| `keyprior/review/queue*.done`, `z32search/logs/*.seen` | empty queue markers |

Kept on purpose: each task's `commands.log` (the run recipe) and the few logs that a key document
cites (`cyclemodel/calib.log`, `nullmodel/summary.log`, `z13phrases/review/brute.log`, and the
`mapgeometry` and `mapgeometry/review` logs).

## Superseded

`synthesis/REPORT_draft.md` is the draft that `results/lead/DECISION.md` asked to correct; the
final report (`REPORT.md`) replaces it.

## Paths in kept files

Absolute paths of the original machine were replaced: the repository root by repo-relative paths
(or by "the repository root" in prose), and session scratch files by `<scratch>/...`
(`$SCRATCH/...` inside shell scripts). Those scratch files, for example
`<scratch>/keyprior/z13_homo_fits.tsv` and `z13_homo_fits_top500k.tsv` used by the keyprior and
lead/skeptic runs, were intermediate streams and are not part of the repository; the keyprior
`commands.log` lists the commands that wrote them.
