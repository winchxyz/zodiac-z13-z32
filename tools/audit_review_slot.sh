#!/usr/bin/env bash
# tools/audit_review_slot.sh - heavy re-runs for the adversarial review of task "audit".
# Run inside ONE slot:  node tools/run_slot.js --label audit-review -- bash tools/audit_review_slot.sh <scratchdir>
# Outputs: results/audit/review/*.json ; big TSV streams go to <scratchdir>.
set -u
SC="${1:?scratch dir}"
cd "$(dirname "$0")/.."
R=results/audit/review
mkdir -p "$SC" "$R"
V=data/ciphers/variants
echo "=== start $(date +%T)"
# 1. Z13 simple word fits (expected 625,218), with scores streamed
node tools/enumerate.js words --cipher $V/z13.canonical.txt --mode simple --top-words 20000 --max-words 4 --threads 4 --top 30 \
  --max-seconds 600 --stream "$SC/z13.canonical.simple.tsv" --out "$R/enum_z13_canonical_simple.json" > /dev/null 2>&1
echo "=== simple done $(date +%T)"
# 2. Z13 homophonic word fits WITH scores (the audit only counted them: 4,151,724)
node tools/enumerate.js words --cipher $V/z13.canonical.txt --mode homophonic --top-words 20000 --max-words 4 --threads 4 --top 30 \
  --max-seconds 1200 --stream "$SC/z13.canonical.homophonic.tsv" --out "$R/enum_z13_canonical_homophonic.json" > /dev/null 2>&1
echo "=== homophonic done $(date +%T)"
# 3. natural-English null, rerun (expected 743 Z32 fits in 3,317,390 windows)
node tools/audit_corpus_ref.js --docs all --reservoir 3000 --out "$R/corpus_ref_rerun.json" > "$R/corpus_ref_rerun_log.txt" 2>&1
echo "=== corpus done $(date +%T)"
# 4. radians grammar null with a different seed (expected ~5.1e6)
node tools/audit_z32_theme.js --samples 3000000 --seed 99 --out "$R/z32_theme_seed99.json" > "$R/z32_theme_seed99_log.txt" 2>&1
echo "=== theme done $(date +%T)"
# 5. review checks with the streams and the Baber re-run
node tools/audit_review_checks.js --simple-stream "$SC/z13.canonical.simple.tsv" --homo-stream "$SC/z13.canonical.homophonic.tsv" \
  --corpus "$R/corpus_ref_rerun.json" --baber --out "$R/review_checks.json" > "$R/review_checks_log.txt" 2>&1
echo "=== checks done $(date +%T)"
