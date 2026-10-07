#!/usr/bin/env bash
# tools/audit_enum.sh - reference enumerations for the proposal audit (task "audit").
# Run inside ONE slot:  node tools/run_slot.js --label audit -- bash tools/audit_enum.sh <scratchdir>
# Big TSV streams go to <scratchdir>; JSON summaries to results/audit/enum/.
# Every run is exhaustive for its search space (top 20,000 common words, <= 4 words) unless its
# JSON says counts.complete = false.  Runs whose JSON already exists are skipped.
# Order = importance, because the machine is shared and the slot may be short.
set -u
SC="${1:?scratch dir}"
cd "$(dirname "$0")/.."
mkdir -p "$SC" results/audit/enum
V=data/ciphers/variants
D=results/audit/ciphers
E="node tools/enumerate.js words --top-words 20000 --max-words 4 --threads 4 --top 30"

run() { # name cipher mode maxsec [extra...]
  local name="$1" ci="$2" mode="$3" ms="$4"; shift 4
  if [ -s "results/audit/enum/$name.$mode.json" ]; then echo "=== $name ($mode) done already"; return; fi
  echo "=== $name ($mode) $(date +%T)"
  $E --max-seconds "$ms" --cipher "$ci" --mode "$mode" --stream "$SC/$name.$mode.tsv" --out "results/audit/enum/$name.$mode.json" "$@" > /dev/null 2>&1
}

# 1. canonical Z13, both modes (simple was finished in the first attempt)
run z13.canonical         $V/z13.canonical.txt         simple     900
run z13.canonical         $V/z13.canonical.txt         homophonic 900
# 2. small variants used by individual claims
run z13.crosshair_null    $V/z13.crosshair_null.txt    simple     300
run z13.crosshair_null    $V/z13.crosshair_null.txt    homophonic 300
run z13.letters_literal   $V/z13.canonical.txt         simple     300 --pin "A=A,E=E,N=N,K=K,M=M"
run z13.letters_literal   $V/z13.canonical.txt         homophonic 300 --pin "A=A,E=E,N=N,K=K,M=M"
run z13.circles_as_spaces $D/z13.circles_as_spaces.txt simple     300
run z13.circles_as_spaces $D/z13.circles_as_spaces.txt homophonic 300

# 3. name fits (FIRST LAST, FIRST INITIAL LAST, FIRST MIDDLE LAST); names mode does not score words
N="node tools/enumerate.js names --patterns FL,FIL,FML --threads 4 --top 30 --max-seconds 600"
for m in simple homophonic; do
  if [ -s "results/audit/enum/names.z13.canonical.$m.json" ]; then continue; fi
  echo "=== names z13.canonical ($m) $(date +%T)"
  $N --cipher $V/z13.canonical.txt --mode $m --stream "$SC/names.z13.canonical.$m.tsv" --out "results/audit/enum/names.z13.canonical.$m.json" > /dev/null 2>&1
done
for i in 00 02 04 06 07 08 10 11 12; do
  if [ -s "results/audit/enum/names.z13.slip$i.homophonic.json" ]; then continue; fi
  echo "=== names FIL z13.slip$i (homophonic) $(date +%T)"
  node tools/enumerate.js names --patterns FIL --threads 4 --top 5 --max-seconds 300 --cipher $D/z13.slip$i.txt --mode homophonic \
    --stream "$SC/names.z13.slip$i.homophonic.tsv" --out "results/audit/enum/names.z13.slip$i.homophonic.json" > /dev/null 2>&1
done

# 4. one wrong symbol (slip) at a repeated-symbol position, simple mode only (homophonic slip spaces
#    are too large to score on a shared machine); only fits at least as good as the best 1-conflict
#    claim (ALFREDENEUMAN -15.90, DREATATORPEDO -15.14) are streamed; capped at 240 s each
for i in 00 02 04 06 07 08 10 11 12; do
  run z13.slip$i $D/z13.slip$i.txt simple 240 --min-logp -15.9
done
# circles_distinct (Kelleher) is covered by the natural-English null (tools/audit_corpus_ref.js):
# its word-fit space is tens of millions of strings and is not enumerated here.
echo "=== done $(date +%T)"
