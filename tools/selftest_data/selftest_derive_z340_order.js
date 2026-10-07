'use strict';
// Derive the Z340 read order of the published solution and check it against
// Oranchak's z340-untransposed.txt (github.com/doranchak/zodiac-cipher-key-visualizer).
// Sections 1 and 2 (rows 1-9 and 10-18 of the 17-column grid) are read along
// the period-19 diagonal (one row down, two columns right, wrapping toroidally
// inside the 9x17 block); rows 19-20 are read straight.
const fs = require('fs');
const path = require('path');
const D = __dirname;
const rd = (f) => fs.readFileSync(path.join(D, f), 'latin1').replace(/\r/g, '').split('\n').filter(Boolean).join('');
const ct = rd('viz_z340.txt');
const un = rd('viz_z340-untransposed.txt');
const order = [];
for (const start of [0, 153]) for (let k = 0; k < 153; k++) order.push(start + (k % 9) * 17 + ((2 * k) % 17));
for (let i = 306; i < 340; i++) order.push(i);
const mism = [];
for (let k = 0; k < 340; k++) if (ct[order[k]] !== un[k]) mism.push(k);
console.log('mismatches', mism.length);
for (const k of mism) {
  const where = [];
  for (let i = 0; i < 340; i++) if (ct[i] === un[k]) where.push(i);
  console.log(k, 'order', order[k], 'ct', ct[order[k]], 'un', un[k], 'un-char at', where.join(','));
}
const seen = new Set(order);
console.log('bijection', seen.size === 340);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(order));
