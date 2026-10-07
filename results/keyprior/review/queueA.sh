#!/bin/bash
# keyprior adversarial review, queue A (run from the repository root). Every heavy step goes through the slot runner.
cd "$(dirname "$0")/../../.."
R=results/keyprior/review
S="node tools/run_slot.js --label keyprior-review --"

# 1. Z13 full pin: reproduction (objective, same null keys as the attacker), word statistic on the SAME null keys,
#    family-wise min-p over 4 variants x 2 statistics, glyph-stratified null.
$S node $R/review_family.js --null 10000 --threads 4 --seed 1970 --out $R/family.json > $R/family.log 2>&1

# 2. Z32 canonical full pin reproduction: z340 and union exactly (1000 nulls, same streams), z408 real only here (4 free).
$S node tools/keyprior_fullpin.js --ciphers z32.canonical --keys z408,z340,union --null 1000 --null-kind permute --threads 4 --seed 1970 --max-free 3 --out $R/repro_fullpin_z32_canonical.json > $R/repro_fullpin_z32_canonical.log 2>&1

# 3. Z32 canonical, z408 key with 200 nulls (first 200 of the attacker's 1000 null keys, stream 1000 + 0).
$S node tools/keyprior_fullpin.js --ciphers z32.canonical --keys z408 --null 200 --null-kind permute --threads 4 --seed 1970 --max-free 4 --out $R/repro_fullpin_z32_canonical_z408_200.json > $R/repro_fullpin_z32_canonical_z408_200.log 2>&1

# 4. conditional nulls (reproduction)
$S node tools/keyprior_condnull.js --stat objective --null 3000 --seed 21 --out $R/repro_condnull_objective.json > $R/repro_condnull_objective.log 2>&1
echo QUEUE_A_DONE >> $R/queueA.done
