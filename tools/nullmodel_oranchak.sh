#!/usr/bin/env bash
# tools/nullmodel_oranchak.sh - reproduce Oranchak's 2013 Z13 counts as far as our data allow.
#   (1) names: FIRST/MIDDLE/LAST in any order, any part as an initial, homophonic and simple mode
#   (2) words: ordered tuples of exactly 2 and exactly 3 words, four word lists, both modes
# Run under the slot runner:
#   node tools/run_slot.js --label nullmodel-oranchak -- bash tools/nullmodel_oranchak.sh
set -u
cd "$(dirname "$0")/.."
OUT=results/nullmodel/oranchak
mkdir -p "$OUT"
CIPHER=data/ciphers/variants/z13.canonical.txt
T=4
PATS=FL,LF,IL,LI,FI,IF,FML,FLM,LFM,FIL,FLI,IFL,ILF,LFI,LIF,IIL,ILI,LII,FMI,FIM,IFM,FII,IFI,IIF
for MODE in homophonic simple; do
  echo "== names $MODE $(date +%T)"
  node tools/enumerate.js names --cipher $CIPHER --mode $MODE --patterns $PATS --threads $T --max-seconds 1200 \
    --top 300 --stream "$OUT/names_${MODE}.tsv" --out "$OUT/names_${MODE}.json" > "$OUT/names_${MODE}.log" 2>&1
  tail -1 "$OUT/names_${MODE}.log"
done
run_tuples () {  # label words-file extra-args...
  local LABEL=$1; shift
  local WF=$1; shift
  echo "== tuples $LABEL $(date +%T)"
  node --max-old-space-size=6000 tools/nullmodel_tuplejoin.js --cipher $CIPHER --words-file "$WF" "$@" --mode both     --sample 40 --label "$LABEL" --out "$OUT/tuples_${LABEL}.json"
}
run_tuples common60k data/lm/words_common.tsv --k 1,2,3,4
run_tuples gutenberg_all data/lm/raw/corpus_words.tsv --k 1,2,3 --max-distinct 3000000
run_tuples norvig150k data/lm/words.tsv --top 150000 --k 1,2,3 --max-distinct 3000000
run_tuples norvig333k data/lm/words.tsv --k 1,2,3 --max-distinct 3000000
echo "== done $(date +%T)"
