#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_themewords.js - writes the custom word list used with tools/enumerate.js for the
 * grammar-free count of theme-word sequences that fit Z32:
 *   results/z32search/enumerate/theme_words.tsv  (word <TAB> weight; weight = 1 for every word)
 * Number words, fractions, units and a few connectors / map words.
 *   node tools/z32search_themewords.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const words = [
  'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN',
  'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY', 'HUNDRED',
  'HALF', 'QUARTER', 'QUARTERS', 'THIRD', 'THIRDS', 'EIGHTH', 'EIGHTHS', 'SIXTEENTH', 'SIXTEENTHS', 'TENTH', 'TENTHS', 'POINT',
  'RADIAN', 'RADIANS', 'RAD', 'RADS', 'INCH', 'INCHES', 'INS',
  'AND', 'A', 'AN', 'THE', 'ALONG', 'FROM', 'AT', 'BY', 'TO', 'IS', 'IN', 'IT', 'ITS', 'SET', 'GO', 'ON', 'OF', 'OUT', 'THEN',
  'MAG', 'NORTH', 'MT', 'MOUNT', 'DIABLO', 'BOMB', 'DIG', 'CLOCKWISE', 'ESTIMATE',
];
const out = path.join(ROOT, 'results', 'z32search', 'enumerate', 'theme_words.tsv');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, words.map((w) => `${w}\t1`).join('\n') + '\n');
console.log(`wrote ${path.relative(ROOT, out)}: ${words.length} words`);
