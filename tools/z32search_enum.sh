#!/usr/bin/env bash
# tools/z32search_enum.sh - grammar-free count of theme-word sequences (tools/enumerate.js with the custom
# list results/z32search/enumerate/theme_words.tsv) that fit Z32 under homophonic substitution, and the
# same count for 20 Z32-shaped null ciphers (max 5 words) as the null.  Run through the slot runner:
#   node tools/run_slot.js --label z32search-enum -- bash tools/z32search_enum.sh
set -e
cd "$(dirname "$0")/.."
D=results/z32search/enumerate
node tools/z32search_themewords.js
node tools/z32search_enum_nulls.js 20
node tools/enumerate.js words --cipher data/ciphers/variants/z32.canonical.txt --mode homophonic --words-file $D/theme_words.tsv --top-words 0 --max-words 5 --no-score --threads 1 --stream $D/z32_m5_fits.tsv --quiet --out $D/z32_m5_stream.json > /dev/null 2>&1
for M in 5 6; do
  node tools/enumerate.js words --cipher data/ciphers/variants/z32.canonical.txt --mode homophonic --words-file $D/theme_words.tsv \
    --top-words 0 --max-words $M --no-score --threads 4 --max-seconds 1200 --top 1000 --quiet --out $D/z32_m$M.json > $D/z32_m$M.log 2>&1
done
for f in $D/null_ciphers/null*.txt; do
  b=$(basename $f .txt)
  node tools/enumerate.js words --cipher $f --mode homophonic --words-file $D/theme_words.tsv \
    --top-words 0 --max-words 5 --no-score --threads 4 --max-seconds 300 --top 10 --quiet --out $D/${b}_m5.json > $D/${b}_m5.log 2>&1
done
echo done
