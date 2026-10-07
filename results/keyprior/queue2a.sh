#!/bin/bash
# keyprior queue 2a: Z13 enumerate with full pins (words, names), name fits, Z13 subset projection, Z32 subset anneal
cd "$(dirname "$0")/../.."
SP=$SCRATCH/keyprior
run() { local name=$1; shift; echo "node tools/run_slot.js --label keyprior -- $*" >> results/keyprior/commands.log; node tools/run_slot.js --label keyprior -- "$@" > results/keyprior/$name.log 2>&1; }
# full pins, exhaustive dictionary and name search (simple mode impossible: N=E and E=E share a letter, so homophonic)
run enum_z13_words_pin_z408 node tools/enumerate.js words --cipher data/ciphers/z13.json --mode homophonic --top-words 100000 --vocab full --max-words 5 --pin A=W,E=E,N=E,z=D,K=S,M=H --threads 4 --max-seconds 600 --out results/keyprior/enum_z13_words_pin_z408.json
run enum_z13_words_pin_z340 node tools/enumerate.js words --cipher data/ciphers/z13.json --mode homophonic --top-words 100000 --vocab full --max-words 5 --pin A=D,E=R,N=E,z=A,K=A,M=O --threads 4 --max-seconds 600 --out results/keyprior/enum_z13_words_pin_z340.json
run enum_z13_words_pin_z408_t2 node tools/enumerate.js words --cipher data/ciphers/variants/z13.bracket_is_perp.txt --mode homophonic --top-words 100000 --vocab full --max-words 5 --pin A=W,E=E,N=E,z=D,K=S,M=H,t=R --threads 4 --max-seconds 600 --out results/keyprior/enum_z13_words_pin_z408_t2.json
run enum_z13_words_pin_z340_t2 node tools/enumerate.js words --cipher data/ciphers/variants/z13.bracket_is_perp.txt --mode homophonic --top-words 100000 --vocab full --max-words 5 --pin A=D,E=R,N=E,z=A,K=A,M=O,t=L --threads 4 --max-seconds 600 --out results/keyprior/enum_z13_words_pin_z340_t2.json
run enum_z13_names_pin_z408 node tools/enumerate.js names --cipher data/ciphers/z13.json --mode homophonic --patterns FL,FIL,FML --fillers 1 --pin A=W,E=E,N=E,z=D,K=S,M=H --threads 4 --max-seconds 600 --out results/keyprior/enum_z13_names_pin_z408.json
run enum_z13_names_pin_z340 node tools/enumerate.js names --cipher data/ciphers/z13.json --mode homophonic --patterns FL,FIL,FML --fillers 1 --pin A=D,E=R,N=E,z=A,K=A,M=O --threads 4 --max-seconds 600 --out results/keyprior/enum_z13_names_pin_z340.json
# all homophonic name fits (no pins) for the subset projection
run enum_z13_names_all node tools/enumerate.js names --cipher data/ciphers/z13.json --mode homophonic --patterns FL,FIL,FML --threads 4 --max-seconds 900 --stream $SP/z13_homo_names.tsv --out results/keyprior/enum_z13_names_all.json
run z13subsets_words node tools/keyprior_z13subsets.js --fits $SP/z13_homo_fits.tsv --kind words --keys z408,z340,union --null 5000 --with-t2 --threads 4 --seed 13 --out results/keyprior/z13subsets_words.json
run z13subsets_names node tools/keyprior_z13subsets.js --fits $SP/z13_homo_names.tsv --kind names --keys z408,z340,union --null 5000 --with-t2 --threads 4 --seed 14 --out results/keyprior/z13subsets_names.json
run z32subsets_z408 node tools/keyprior_z32subsets.js --cipher z32.canonical --key z408 --ks 8,16,22 --iters-per-k 8:60000,16:30000,22:15000 --real-subsets 40 --null 1000 --restarts 2 --threads 4 --seed 32 --out results/keyprior/z32subsets_z408.json
run z32subsets_z340 node tools/keyprior_z32subsets.js --cipher z32.canonical --key z340 --ks 8,16,24 --iters-per-k 8:60000,16:30000,24:15000 --real-subsets 40 --null 1000 --restarts 2 --threads 4 --seed 33 --out results/keyprior/z32subsets_z340.json
echo queue2a done
