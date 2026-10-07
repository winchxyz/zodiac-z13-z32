'use strict';
/**
 * tools/audit_make_ciphers.js - derived cipher files for the proposal audit
 * (results/audit/ciphers/*.txt).  Shared files in data/ciphers are not touched.
 *
 *   z13.circles_as_spaces.txt   AENzKM[NAM  (Quill: the three circles read as word spaces)
 *   z13.slip<i>.txt             canonical Z13 with position i replaced by a fresh symbol '~'
 *                               (one wrong symbol at i: the letter there is unconstrained)
 *   z32.reversed.txt            Z32 read right to left, bottom row first
 *
 *   node tools/audit_make_ciphers.js
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'results', 'audit', 'ciphers');
fs.mkdirSync(OUT, { recursive: true });

const z13 = C.loadCipher(path.join(ROOT, 'data/ciphers/variants/z13.canonical.txt')).text;
const z32 = C.loadCipher(path.join(ROOT, 'data/ciphers/variants/z32.canonical.txt')).text;
if (z13 !== 'AENz0K0M0[NAM') throw new Error('unexpected Z13 canonical text');
if (z32.length !== 32) throw new Error('unexpected Z32 canonical length');
if (z13.includes('~') || z32.includes('~')) throw new Error('slip symbol ~ already used');

const files = {};
files['z13.circles_as_spaces.txt'] = z13.replace(/0/g, '');
for (let i = 0; i < z13.length; i++) files[`z13.slip${String(i).padStart(2, '0')}.txt`] = z13.slice(0, i) + '~' + z13.slice(i + 1);
files['z32.reversed.txt'] = z32.split('').reverse().join('');
for (const [f, t] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, f), t + '\n', 'latin1');
  console.log(f.padEnd(28), t, C.isomorph(t));
}
