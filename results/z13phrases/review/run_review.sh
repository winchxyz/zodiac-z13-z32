#!/bin/bash
# Reviewer slot job for z13phrases: reproduction runs, calibration, brute-force cross-checks.
# Run through: node tools/run_slot.js --label z13phrases-review -- bash results/z13phrases/review/run_review.sh
cd "$(dirname "$0")/../../.." || exit 1
R=results/z13phrases/review
NULLF=results/z13phrases/null_real_phrases.json
V=data/ciphers/variants
echo "start $(date -u +%FT%TZ)"

echo "== 1 repro w60k5 canonical simple $(date -u +%T)"
node tools/z13phrases_enum.js --cipher $V/z13.canonical.txt --mode simple --null $NULLF --tlow -16 --top-words 60006 --max-words 5 --stream-min p10 --threads 4 --max-seconds 900 --out $R/repro_w60k5_canonical_simple.json --stream $R/repro_w60k5_canonical_simple.tsv --top 5000 > $R/repro_w60k5_canonical_simple.log 2>&1
echo "exit $?"

echo "== 2 repro slip06 simple 20k/4 $(date -u +%T)"
node tools/z13phrases_enum.js --cipher $V/z13.canonical.txt --mode simple --null $NULLF --tlow p10 --top-words 20000 --max-words 4 --slip 6 --stream-min p25 --threads 4 --max-seconds 900 --out $R/repro_slip06_simple.json --top 2000 > $R/repro_slip06_simple.log 2>&1
echo "exit $?"

echo "== 3 calibration: scrambled Z13 and same-profile English, 20k/4 simple $(date -u +%T)"
node tools/z13phrases_review_calib.js --n-scr 25 --n-eng 25 --top-words 20000 --max-words 4 --threads 4 --cap 60 --seed 9001 --out $R/calib_profile.json > $R/calib_profile.log 2>&1
echo "exit $?"

echo "== 4 repro w60k5 canonical homophonic $(date -u +%T)"
node tools/z13phrases_enum.js --cipher $V/z13.canonical.txt --mode homophonic --null $NULLF --tlow p25 --top-words 60006 --max-words 5 --stream-min p25 --threads 4 --max-seconds 900 --out $R/repro_w60k5_canonical_homophonic.json --top 5000 > $R/repro_w60k5_canonical_homophonic.log 2>&1
echo "exit $?"

echo "== 5 brute-force cross-checks (single thread) $(date -u +%T)"
for spec in "simple 5000 3 -" "homophonic 3000 3 -" "simple 5000 3 6" "simple 2000 4 -"; do
  set -- $spec
  extra=""; [ "$4" != "-" ] && extra="--slip $4"
  node tools/z13phrases_review_brute.js --cipher $V/z13.canonical.txt --mode $1 --top-words $2 --max-words $3 $extra >> $R/brute.log 2>&1
  node tools/z13phrases_enum.js --cipher $V/z13.canonical.txt --mode $1 --top-words $2 --max-words $3 $extra --threads 1 --quiet --out $R/brute_enum_$1_$2_$3_$4.json > /dev/null 2>&1
  node -e "const r=require('./$R/brute_enum_$1_$2_$3_$4.json');console.log('enum',r.options.mode,r.options.topWords,r.options.maxWords,JSON.stringify(r.cipher.slips),r.counts.consistentStrings)" >> $R/brute.log 2>&1
done
node tools/z13phrases_review_brute.js --cipher $V/z13.canonical.txt --mode simple --top-words 5000 --max-words 3 --range 1:12 >> $R/brute.log 2>&1
node tools/z13phrases_enum.js --cipher $V/z13.canonical.txt --mode simple --top-words 5000 --max-words 3 --range 1:12 --threads 1 --quiet --out $R/brute_enum_range.json > /dev/null 2>&1
node -e "const r=require('./$R/brute_enum_range.json');console.log('enum range',r.cipher.text,r.counts.consistentStrings)" >> $R/brute.log 2>&1
echo "done $(date -u +%FT%TZ)"
