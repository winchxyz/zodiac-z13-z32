# Notice

## Licences

| What | Licence |
|---|---|
| Code: everything under `tools/`, plus the `.js`, `.py` and `.sh` helper scripts inside `results/` | MIT, see `LICENSE` (Copyright (c) 2026 winchxyz) |
| The report, the research notes (`research/`), the documentation (`*.md`), and the result summaries and tables under `results/` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (Copyright (c) 2026 winchxyz) |

## Cipher transcriptions

The cipher files in `data/ciphers/` (and the two self-test files in `tools/selftest_data/`) use
**David Oranchak's ASCII transcription convention**: the one used by his zodiackillerciphers.com
webtoy and Cipher Explorer and by the cipher files bundled with AZdecrypt (Jarl Van Eycke). The
convention and the base transcriptions are his work. We checked every Z13 and Z32 symbol against
the scans ourselves (see `data/ciphers/README.md`), but the transcription scheme should be
credited to Oranchak.

- Z408 plaintext: solved in 1969 by Donald and Bettye Harden. The aligned plaintext comes from
  Oranchak's [zodiac-cipher-key-visualizer](https://github.com/doranchak/zodiac-cipher-key-visualizer)
  and the AZdecrypt cipher files.
- Z340 plaintext and read order: solved in 2020 by David Oranchak, Sam Blake and Jarl Van Eycke
  ([arXiv:2403.17350](https://arxiv.org/abs/2403.17350)).

## What is not redistributed

This repository contains **no third-party scans, papers, web pages or text corpora**:

- no images of the Zodiac letters, envelopes or the Phillips 66 map (links to Wikimedia Commons,
  zodiackiller.com, zodiackillerfacts.com and zodiackillerciphers.com are in `DATA.md`);
- no saved web pages, papers or YouTube metadata from the prior-art search (index of sources:
  `results/lead/priorart/pages_index.md`);
- no Project Gutenberg texts, no copy of Peter Norvig's word-count files or anything derived from
  them one-to-one, and no US Census / SSA name files (the scripts that rebuild all of these are
  listed in `DATA.md`);
- no cached OpenStreetMap (Nominatim) or Wikipedia API responses.

## Small third-party facts that are included

- `results/audit/wiki_z13_entries.tsv` lists the Z13 proposals (claimed plaintext and the
  contributor's handle, one line each) parsed from the
  [Zodiac Killer Ciphers Wiki page "Z13 Solutions"](https://zodiackillerciphers.com/wiki/index.php?title=Z13_Solutions)
  by `tools/audit_wiki_parse.py`; it is needed to reproduce the audit of published proposals.
- Several result tables contain short letter strings (13 to 32 letters) taken from public-domain
  Project Gutenberg texts, as examples of English windows that fit a cipher's repeat pattern.
- Name weights in the results come from the 1990 and 2010 US Census name files and the SSA
  baby-name counts (US government data).
- Prior work is credited in `research/*.md` and `results/lead/priorart/priorart.md`.
