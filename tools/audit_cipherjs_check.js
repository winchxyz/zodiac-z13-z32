'use strict';
/**
 * tools/audit_cipherjs_check.js - runs tools/cipher.js checkCandidate (the function behind
 * `node tools/cipher.js check`) on every named proposal with an aligned plaintext, in both
 * modes, as an independent cross-check of tools/audit_check.js.  Output:
 * results/audit/cipherjs_checks.txt
 *
 *   node tools/audit_cipherjs_check.js
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');
const ROOT = path.join(__dirname, '..');
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/audit/proposals.json'), 'utf8')).proposals;
const file = (v) => {
  const a = path.join(ROOT, 'data/ciphers/variants', `${v === 'z13.letters_literal' ? 'z13.canonical' : v}.txt`);
  return fs.existsSync(a) ? a : path.join(ROOT, 'results/audit/ciphers', `${v}.txt`);
};
const lines = [];
for (const p of P) {
  if (!p.aligned) continue;
  const ci = C.loadCipher(file(p.variant));
  for (const mode of ['homophonic', 'simple']) {
    const r = C.checkCandidate(ci.text, p.aligned, { mode });
    lines.push([p.id, p.aligned, p.variant, mode, `ok=${r.ok}`, `lengthMatch=${r.lengthMatch}`,
      `conflicts=${r.conflicts.map((c) => `${c.symbol}=${Object.keys(c.letters).join('/')}`).join(' ') || '-'}`,
      `injectivity=${r.injectivityConflicts.map((c) => `${c.letter}:${c.symbols.join('')}`).join(' ') || '-'}`].join('\t'));
  }
}
fs.writeFileSync(path.join(ROOT, 'results/audit/cipherjs_checks.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
