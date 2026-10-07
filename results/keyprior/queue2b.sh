#!/bin/bash
# keyprior queue 2b: joint Z13+Z32 key test and its synthetic positive control
cd "$(dirname "$0")/../.."
run() { local name=$1; shift; echo "node tools/run_slot.js --label keyprior -- $*" >> results/keyprior/commands.log; node tools/run_slot.js --label keyprior -- "$@" > results/keyprior/$name.log 2>&1; }
run joint_z13_z32 node tools/keyprior_joint.js --a z13.canonical --b z32.canonical --null 300 --restarts 4 --iters 120000 --threads 4 --seed 1332 --out results/keyprior/joint_z13_z32.json
run joint_synthetic node tools/keyprior_joint.js --synthetic 5 --null 30 --restarts 4 --iters 120000 --threads 4 --seed 2026 --out results/keyprior/joint_synthetic.json
echo queue2b done
