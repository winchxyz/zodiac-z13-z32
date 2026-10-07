#!/usr/bin/env bash
# tools/nullmodel_oranchak_tuples.sh - exact 1/2/3-word tuple counts for Z13 with four word lists,
# junk entries (three identical letters in a row) removed, homophonic and simple mode.
# Single-threaded; run under the slot runner:
#   node tools/run_slot.js --label nullmodel-tuples -- bash tools/nullmodel_oranchak_tuples.sh
set -u
cd "$(dirname "$0")/.."
OUT=results/nullmodel/oranchak
mkdir -p "$OUT"
CIPHER=data/ciphers/variants/z13.canonical.txt
run () {  # label words-file extra-args...
  local LABEL=$1; shift
  local WF=$1; shift
  echo "== tuples $LABEL $(date +%T)"
  node --max-old-space-size=4000 tools/nullmodel_tuplejoin.js --cipher $CIPHER --words-file "$WF" "$@" --k 1,2,3 --mode both --no-triples --max-distinct 3000000 --sample 40 --label "$LABEL" --out "$OUT/tuples_clean_${LABEL}.json"
}
run common60k data/lm/words_common.tsv
run gutenberg_all data/lm/raw/corpus_words.tsv
run norvig150k data/lm/words.tsv --top 150000
run norvig333k data/lm/words.tsv
echo "== done $(date +%T)"
# chained in the same slot (added while running): solver null, then the remaining length-scan points
echo "== solvernull $(date +%T)"
node tools/nullmodel_solvernull.js --which z13,z32 --n-exact 20 --n-scrambled 20 --threads 4 --out results/nullmodel/solvernull.json > results/nullmodel/solvernull_chained.log 2>&1
echo "== lengthscan b $(date +%T)"
node tools/nullmodel_lengthscan.js --lengths 150,200,340 --n 10 --threads 4 --restarts-long 24 --max-seconds 900 --out results/nullmodel/lengthscan_b > results/nullmodel/lengthscan_b_chained.log 2>&1
echo "== lengthscan a $(date +%T)"
node tools/nullmodel_lengthscan.js --lengths 50,75,100 --n 10 --threads 4 --restarts-long 24 --max-seconds 900 --out results/nullmodel/lengthscan > results/nullmodel/lengthscan_a_chained.log 2>&1
echo "== chained done $(date +%T)"
