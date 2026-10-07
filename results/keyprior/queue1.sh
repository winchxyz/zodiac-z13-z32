#!/bin/bash
# keyprior queue 1: calibration on solved ciphers, then Z32 full-pin tests (each command through the slot runner)
cd "$(dirname "$0")/../.."
run() { local name=$1; shift; echo "node tools/run_slot.js --label keyprior -- $*" >> results/keyprior/commands.log; node tools/run_slot.js --label keyprior -- "$@" > results/keyprior/$name.log 2>&1; }
run calib_z340w13_z408key node tools/keyprior_calibrate.js --cipher z340 --key other --len 13 --free 2 --windows 100 --null 1000 --null-kind permute --threads 4 --seed 77 --out results/keyprior/calib_z340w13_z408key.json
run calib_z408w13_z340key node tools/keyprior_calibrate.js --cipher z408 --key other --len 13 --free 2 --windows 100 --null 1000 --null-kind permute --threads 4 --seed 78 --out results/keyprior/calib_z408w13_z340key.json
run calib_z408w13_ownkey node tools/keyprior_calibrate.js --cipher z408 --key own --len 13 --free 0 --unpin 2 --windows 40 --null 1000 --null-kind permute --threads 4 --seed 79 --out results/keyprior/calib_z408w13_ownkey.json
run calib_z340w13_ownkey node tools/keyprior_calibrate.js --cipher z340 --key own --len 13 --free 0 --unpin 2 --windows 40 --null 1000 --null-kind permute --threads 4 --seed 80 --out results/keyprior/calib_z340w13_ownkey.json
run fullpin_z32_permute node tools/keyprior_fullpin.js --ciphers z32.canonical,z32.t2_is_perp,z32.bar_is_serif_I,z32.bar_I_and_t2_perp,z32.triangles_merged,z32.tau_distinct,z32.reversed --keys z408,z340,union --null 1000 --null-kind permute --threads 4 --seed 1970 --max-free 4 --out results/keyprior/fullpin_z32_permute.json
run calib_z408w32_z340key node tools/keyprior_calibrate.js --cipher z408 --key other --len 32 --free 2 --windows 60 --null 1000 --null-kind permute --threads 4 --seed 81 --out results/keyprior/calib_z408w32_z340key.json
run calib_z408w32_ownkey node tools/keyprior_calibrate.js --cipher z408 --key own --len 32 --free 0 --unpin 2 --windows 30 --null 1000 --null-kind permute --threads 4 --seed 82 --out results/keyprior/calib_z408w32_ownkey.json
echo queue1 done
