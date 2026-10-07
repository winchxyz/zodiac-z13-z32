#!/bin/bash
# keyprior adversarial review, queue C: the three-distinct-circles variant (z13.circles_distinct), which the attacker
# tested only with the objective statistic (1000 nulls) and never enumerated or scored with the word statistic.
cd "$(dirname "$0")/../../.."
R=results/keyprior/review
S="node tools/run_slot.js --label keyprior-review --"
$S node tools/keyprior_fullpin.js --ciphers z13.circles_distinct --keys z408,z340 --null 2000 --null-kind permute --threads 4 --seed 1970 --max-free 4 --stat word --out $R/fullpin_z13_circles_word_n2000.json > $R/fullpin_z13_circles_word_n2000.log 2>&1
$S node tools/keyprior_fullpin.js --ciphers z13.circles_distinct --keys z408,z340 --null 2000 --null-kind permute --threads 4 --seed 1970 --max-free 4 --stat objective --out $R/fullpin_z13_circles_objective_n2000.json > $R/fullpin_z13_circles_objective_n2000.log 2>&1
$S node tools/enumerate.js words --cipher data/ciphers/variants/z13.circles_distinct.txt --mode homophonic --top-words 100000 --vocab full --max-words 5 --pin A=D,E=R,N=E,z=A,K=A,M=O --threads 4 --max-seconds 900 --top 5000 --out $R/enum_z13_circles_distinct_words_pin_z340_full.json > $R/enum_z13_circles_distinct_words_pin_z340_full.log 2>&1
echo QUEUE_C_DONE >> $R/queueC.done
