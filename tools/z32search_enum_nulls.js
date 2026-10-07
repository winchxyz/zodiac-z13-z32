#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_enum_nulls.js - writes Z32-shaped null cipher files (29 symbols, 3 repeated pairs,
 * built from held-out English phrases; tools/z32search_lib.js nullSet) for the enumerate.js theme-word
 * comparison: results/z32search/enumerate/null_ciphers/nullNN.txt and index.json.
 *   node tools/z32search_enum_nulls.js [count=20]
 */
const fs = require('fs');
const path = require('path');
const Z = require('./z32search_lib');
const n = +(process.argv[2] || 20);
const dir = path.join(Z.ROOT, 'results', 'z32search', 'enumerate', 'null_ciphers');
fs.mkdirSync(dir, { recursive: true });
const set = Z.nullSet(n, 2032);
for (const s of set) fs.writeFileSync(path.join(dir, `${s.id}.txt`), s.cipher + '\n');
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(set, null, 1));
console.log(`wrote ${set.length} null ciphers to ${path.relative(Z.ROOT, dir)}`);
