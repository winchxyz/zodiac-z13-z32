'use strict';
/**
 * results/nullmodel/review/review_z32_radians.js - reviewer check: a topic-matched null for Z32.
 *
 * The nullmodel report scores published Z32 "radians" readings with a generic fiction 6-gram prior
 * (posterior 1e-20 .. 1e-25).  That number mostly measures how rare RADIANS is in fiction, not how
 * special the fit is.  The fair question for a reading built around the July 26, 1970 hint
 * ("radians" and "inches along the radians") is: how many radian/inch phrases of exactly 32
 * letters, built from a small fixed grammar, satisfy Z32's three homophonic equalities
 * (written positions 0=25, 5=13, 1=31)?
 *
 * Grammar (letters only, words concatenated):
 *   LEAD NUM UNIT_A CONN NUM UNIT_B TAIL   with {UNIT_A, UNIT_B} = {radian word, inch word} in either order
 * Usage: node results/nullmodel/review/review_z32_radians.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const z32 = fs.readFileSync(path.join(ROOT, 'data/ciphers/variants/z32.canonical.txt'), 'latin1').trim();
if (z32.length !== 32) throw new Error('bad z32');
// equalities from the cipher itself
const eq = [];
const first = new Map();
for (let i = 0; i < 32; i++) { if (first.has(z32[i])) eq.push([first.get(z32[i]), i]); else first.set(z32[i], i); }

const LEAD = ['', 'ESTIMATE', 'MEASURE', 'GO', 'TURN', 'TAKE', 'SET', 'ROTATE', 'SWING', 'MOVE', 'PACE', 'COUNT', 'DRAW',
  'USE', 'FOLLOW', 'PLACE', 'PUT', 'MARK', 'AIM', 'POINT', 'WALK', 'DIG', 'LOOK', 'IT IS', 'ITS', 'ANGLE', 'FROM', 'AT',
  'ALONG', 'START', 'GO OUT', 'THEN', 'TRY', 'SEEK', 'FIND', 'ADD', 'HEAD', 'STEP', 'BURY', 'DIG AT'];
const NUM = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN',
  'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'A', 'HALF', 'A HALF', 'ONE HALF', 'ZERO', 'PI',
  'TWO PI', 'HALF PI', 'ONE AND A HALF', 'TWO AND A HALF', 'THREE AND A HALF', 'FOUR AND A HALF', 'SIX AND A HALF',
  'ONE POINT FIVE', 'TWO POINT FIVE', 'THREE POINT FIVE', 'A HUNDRED', 'ONE HUNDRED', 'NINETY', 'EIGHTY'];
const RAD = ['RADIAN', 'RADIANS', 'RADS'];
const INCH = ['INCH', 'INCHES', 'IN'];
const CONN = ['', 'AND', 'THEN', 'PLUS', 'BY', 'ALONG', 'OUT', 'OVER', 'UP', 'DOWN', 'AT', 'FROM', 'WITH', 'NORTH', 'SOUTH',
  'EAST', 'WEST', 'TO', 'ON', 'AND GO', 'THEN GO', 'AND DIG', 'AND WALK', 'OUT ALONG', 'AND THEN', 'GO', 'DIG', 'WALK'];
const TAIL = ['', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'OUT', 'UP', 'DOWN', 'AWAY', 'HERE', 'THERE', 'FROM IT', 'FROM THE PEAK',
  'FROM DIABLO', 'ON THE MAP', 'DEEP', 'LEFT', 'RIGHT', 'CLOCKWISE', 'DOWN DEEP', 'FROM ZERO', 'FROM NORTH', 'TO IT', 'TO THE BOMB',
  'NOW', 'ALONG IT', 'FROM THE TOP', 'OF THE MAP'];
const strip = (s) => s.replace(/ /g, '');
const TAIL_BY_LEN = new Map();
for (const t of TAIL) { const k = strip(t).length; if (!TAIL_BY_LEN.has(k)) TAIL_BY_LEN.set(k, []); TAIL_BY_LEN.get(k).push(t); }

let total = 0, fits = 0;
const cleanFits = []; // lead word and connector present, full words RADIANS and INCHES
const fitSet = new Map();
const examples = [];
const L = 32;
for (const order of [['RAD', 'INCH'], ['INCH', 'RAD']]) {
  const UA = order[0] === 'RAD' ? RAD : INCH, UB = order[0] === 'RAD' ? INCH : RAD;
  for (const a of LEAD) for (const n1 of NUM) for (const ua of UA) {
    const p1 = strip(a + n1 + ua);
    if (p1.length >= L) continue;
    for (const c of CONN) for (const n2 of NUM) for (const ub of UB) {
      const p2 = p1 + strip(c + n2 + ub);
      if (p2.length > L) continue;
      for (const t of (TAIL_BY_LEN.get(L - p2.length) || [])) {
        const s = p2 + strip(t);
        total++;
        let ok = true;
        for (const [p, q] of eq) if (s[p] !== s[q]) { ok = false; break; }
        if (!ok) continue;
        fits++;
        const words = [a, n1, ua, c, n2, ub, t].filter(Boolean).join(' ');
        if (!fitSet.has(s)) { fitSet.set(s, words); if (examples.length < 30) examples.push(words); }
        if (a && c && (ua === 'RADIANS' || ub === 'RADIANS') && (ua === 'INCHES' || ub === 'INCHES')) cleanFits.push(words);
      }
    }
  }
}
const distinctTotal = null;
const res = {
  tool: 'results/nullmodel/review/review_z32_radians.js', equalities: eq, grammarSizes: { LEAD: LEAD.length, NUM: NUM.length, RAD: RAD.length, INCH: INCH.length, CONN: CONN.length, TAIL: TAIL.length },
  phrases32: total, fittingPhrases: fits, fittingDistinctStrings: fitSet.size, fraction: fits / total, oneIn: total / fits,
  containsGrinell: fitSet.has('ESTIMATEFOURRADIANSANDFIVEINCHES'), examples,
  fitsWithLeadConnRadiansInches: cleanFits.length,
  examplesWithLeadConnRadiansInches: cleanFits.filter((_, i) => i % Math.max(1, Math.floor(cleanFits.length / 25)) === 0).slice(0, 25),
};
fs.writeFileSync(path.join(__dirname, 'z32_radians_grammar.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(Object.assign({}, res, { examples: examples.slice(0, 15) }), null, 1));
