'use strict';
/**
 * tools/audit_review_missing.js - mechanical check of Z13 claims the audit did not list
 * (found by the reviewer's web search): Steve Hodel's DR GEORGE HODEL / GEORGE HODEL MD.
 *   node tools/audit_review_missing.js
 */
const path = require('path');
const C = require('./cipher');
const lm = require('./lm');
const ROOT = path.join(__dirname, '..');
const z13 = C.loadCipher(path.join(ROOT, 'data/ciphers/variants/z13.canonical.txt')).text;
const prof = (s) => { const c = {}; for (const x of s) c[x] = (c[x] || 0) + 1; return Object.values(c).sort((a, b) => b - a).join(','); };
for (const p of ['DRGEORGEHODEL', 'GEORGEHODELMD']) {
  const r = C.checkCandidate(z13, p, { mode: 'homophonic' });
  let pos = 0; for (const c of r.conflicts) { const v = Object.values(c.letters).map((x) => x.length); pos += v.reduce((a, b) => a + b, 0) - Math.max(...v); }
  const distinct = new Set(p).size;
  console.log(p, 'len', p.length, 'conflictSymbols', r.conflicts.map((c) => `${c.symbol}=${Object.keys(c.letters).join('/')}`).join(' '), 'positions', pos,
    'distinctLetters', distinct, 'profile', prof(p), 'z13profile', prof(z13), 'logp', lm.wordSegment(p).logp.toFixed(2));
}
