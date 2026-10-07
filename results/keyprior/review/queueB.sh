#!/bin/bash
# keyprior adversarial review, queue B (run from the repository root). Every heavy step goes through the slot runner.
cd "$(dirname "$0")/../../.."
R=results/keyprior/review
S="node tools/run_slot.js --label keyprior-review --"
FITS=$SCRATCH/keyprior/z13_homo_fits_top500k.tsv

# 1. Z13 partial pins: the attacker's own tool, unchanged, with 20,000 instead of 1,000 null keys.
#    With 127 subsets and rank p-values the family-wise p cannot fall much below ~(number of subsets)/(N+1);
#    this run checks whether the reported family-wise p = 0.129 is a resolution floor.
$S node tools/keyprior_z13subsets.js --fits $FITS --kind words --keys z340 --null 20000 --with-t2 --threads 4 --seed 13 --out $R/z13subsets_top500k_z340_n20000.json > $R/z13subsets_top500k_z340_n20000.log 2>&1
$S node tools/keyprior_z13subsets.js --fits $FITS --kind words --keys z408 --null 20000 --with-t2 --threads 4 --seed 13 --out $R/z13subsets_top500k_z408_n20000.json > $R/z13subsets_top500k_z408_n20000.log 2>&1

# 2. Z32 partial pins at the key level (fixes pseudo-replication in pMean).
$S node $R/review_z32keylevel.js --key z408 --ks 8,16 --subsets 10 --null 60 --restarts 2 --iters-per-k 8:50000,16:25000 --threads 4 --seed 77 --out $R/z32keylevel_z408.json > $R/z32keylevel_z408.log 2>&1
$S node $R/review_z32keylevel.js --key z340 --ks 8,16 --subsets 10 --null 60 --restarts 2 --iters-per-k 8:50000,16:25000 --threads 4 --seed 78 --out $R/z32keylevel_z340.json > $R/z32keylevel_z340.log 2>&1

# 3. Joint-solver convergence: the independent and real-link solves with 16 restarts instead of 4.
$S node tools/keyprior_joint.js --a z13.canonical --b z32.canonical --null 1 --restarts 16 --iters 120000 --threads 4 --seed 1332 --out $R/joint_convergence.json > $R/joint_convergence.log 2>&1
echo QUEUE_B_DONE >> $R/queueB.done
