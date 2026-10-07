#!/bin/bash
# keyprior queue 3: Z13 subset projection (words), Z32 subset anneal (reduced after slot contention)
cd "$(dirname "$0")/../.."
SP=$SCRATCH/keyprior
run() { local name=$1; shift; echo "node tools/run_slot.js --label keyprior -- $*" >> results/keyprior/commands.log; node tools/run_slot.js --label keyprior -- "$@" > results/keyprior/$name.log 2>&1; }
run z13subsets_words node tools/keyprior_z13subsets.js --fits $SP/z13_homo_fits.tsv --kind words --keys z408,z340,union --null 5000 --with-t2 --threads 4 --seed 13 --out results/keyprior/z13subsets_words.json
run z32subsets_z408 node tools/keyprior_z32subsets.js --cipher z32.canonical --key z408 --ks 8,16,22 --iters-per-k 8:50000,16:25000,22:12000 --real-subsets 30 --null 500 --restarts 2 --threads 4 --seed 32 --out results/keyprior/z32subsets_z408.json
run z32subsets_z340 node tools/keyprior_z32subsets.js --cipher z32.canonical --key z340 --ks 8,16,24 --iters-per-k 8:50000,16:25000,24:12000 --real-subsets 30 --null 500 --restarts 2 --threads 4 --seed 33 --out results/keyprior/z32subsets_z340.json
echo queue3 done
