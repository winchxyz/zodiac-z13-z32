#!/usr/bin/env bash
# Reviewer's heavy runs for task cyclemodel (run inside ONE slot, threads <= 4):
#   node tools/run_slot.js --label cyclemodel-review -- bash results/cyclemodel/review/run_review.sh
# 1. rerun the model fit (deterministic seeds) into review/fit_rerun.json
# 2. end-to-end Monte Carlo check of the L(P) scorer
# 3. new 13-letter calibration with a different seed and a smaller vocabulary (5000 words)
#    so more enumerations complete; outputs under review/
set -u
cd "$(dirname "$0")/../../.."
R=results/cyclemodel/review
mkdir -p $R/calib
echo "== fit rerun $(date -u)"
node tools/cyclemodel_fit.js --boot 30 --sims 300 --out $R/fit_rerun.json > $R/fit_rerun.log 2>&1
echo "fit exit $?"
echo "== mc check $(date -u)"
node $R/review_mccheck.js --n 3000000 > $R/mccheck.log 2>&1
echo "mc exit $?"
echo "== c13 calibration (seed 2718, 5000 words, 90 s) $(date -u)"
node tools/cyclemodel_calib.js --parts c13 --n13 16 --n13simple 0 --enum-top-words 5000 --enum-seconds 90 \
  --seed 2718 --threads 4 --outdir $R --workdir $R/calib > $R/calib_c13_seed2718.log 2>&1
echo "calib exit $?"
echo "== done $(date -u)"
