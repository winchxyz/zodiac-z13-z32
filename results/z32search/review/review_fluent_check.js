#!/usr/bin/env node
'use strict';
/**
 * results/z32search/review/review_fluent_check.js - what do the "fluent" (all-dictionary-word) free-search
 * solutions look like?  Counts tokens that are not standalone English words in normal prose (suffix
 * fragments, two-letter abbreviations) and adjacent function-word clashes typical of word salad.
 *   node results/z32search/review/review_fluent_check.js
 */
const fs = require('fs');
const path = require('path');
const lm = require('../../../tools/lm');
const R = path.join(__dirname, '..');
const runs = fs.readFileSync(path.join(R, 'free', 'runs.jsonl'), 'utf8').split(/\n/).filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.group === 'free' && !r.error);
const pool = new Map();
for (const r of runs) for (const s of r.solutions || []) if (!pool.has(s.plaintext)) pool.set(s.plaintext, s);
const all = [...pool.values()];
const fluent = all.filter((s) => s.unknown === 0);
// fragments: tokens of length <= 3 that are not in a short list of genuine short English words
const SHORT_OK = new Set(('A I AM AN AS AT BE BY DO GO HE IF IN IS IT ME MY NO OF OH ON OR SO TO UP US WE OK ' +
  'ACT ADD AGE AGO AID AIM AIR ALL AND ANT ANY APE ARE ARM ART ASH ASK ATE BAD BAG BAR BAT BAY BED BEE BET BIG BIT BOW BOX BOY BUD BUG BUS BUT BUY ' +
  'CAB CAN CAP CAR CAT COW CRY CUP CUT DAD DAY DEN DEW DID DIE DIG DIM DOG DOT DRY DUE DUG EAR EAT EGG END ERA EVE EYE FAN FAR FAT FEE FEW FIG FIN FIT FIX FLY FOE FOG FOR FOX FUN FUR ' +
  'GAP GAS GET GOD GOT GUN GUT GUY HAD HAM HAS HAT HAY HER HID HIM HIP HIS HIT HOG HOT HOW HUG HUT ICE ILL INK INN ITS JAR JAW JET JOB JOY KEY KID KIN KIT LAD LAP LAW LAY LED LEG LET LID LIE LIP LOG LOT LOW ' +
  'MAD MAN MAP MAT MAY MEN MET MIX MOB MOM MUD MUG NAP NET NEW NOD NOR NOT NOW NUT OAK OAR ODD OFF OFT OIL OLD ONE OUR OUT OWE OWL OWN PAD PAN PAT PAW PAY PEA PEN PET PIE PIG PIN PIT POT PRY PUT ' +
  'RAG RAN RAT RAW RAY RED RID RIB RIM RIP ROB ROD ROT ROW RUB RUG RUN SAD SAT SAW SAY SEA SEE SET SEW SHE SHY SIN SIP SIR SIS SIT SIX SKY SLY SON SOW SPY SUM SUN TAB TAG TAN TAP TAR TEA TEN THE THY TIE TIN TIP TOE TON TOO TOP TOY TRY TUB TWO USE VAN VOW WAR WAS WAX WAY WEB WED WET WHO WHY WIG WIN WIT WON YES YET YOU ZOO').split(' '));
const frag = (t) => t.length <= 3 && !SHORT_OK.has(t);
const withFrag = fluent.filter((s) => s.words.split(' ').some(frag));
// word-salad marker: two articles/conjunctions/prepositions in a row or a repeated word
const FN = new Set('THE A AN AND OF TO IN FOR WAS THAT THERE THEN WITH AS AT BY'.split(' '));
const salad = fluent.filter((s) => { const w = s.words.split(' '); for (let i = 1; i < w.length; i++) { if (w[i] === w[i - 1]) return true; if (FN.has(w[i]) && FN.has(w[i - 1]) && !(w[i - 1] === 'OF' && w[i] === 'THE') && !(w[i - 1] === 'IN' && w[i] === 'THE') && !(w[i - 1] === 'TO' && w[i] === 'THE') && !(w[i - 1] === 'AND' && w[i] === 'THE') && !(w[i - 1] === 'FOR' && w[i] === 'THE') && !(w[i - 1] === 'WITH' && w[i] === 'THE') && !(w[i - 1] === 'AT' && w[i] === 'THE') && !(w[i - 1] === 'BY' && w[i] === 'THE') && !(w[i - 1] === 'AND' && w[i] === 'THEN') && !(w[i - 1] === 'AND' && w[i] === 'THERE') && !(w[i - 1] === 'THAT' && w[i] === 'THE') && !(w[i - 1] === 'AS' && w[i] === 'THE') && !(w[i - 1] === 'OF' && w[i] === 'A') && !(w[i - 1] === 'IN' && w[i] === 'A') && !(w[i - 1] === 'TO' && w[i] === 'A') && !(w[i - 1] === 'WAS' && w[i] === 'A') && !(w[i - 1] === 'WAS' && w[i] === 'THE') && !(w[i - 1] === 'FOR' && w[i] === 'A') && !(w[i - 1] === 'WITH' && w[i] === 'A') && !(w[i - 1] === 'AND' && w[i] === 'A') && !(w[i - 1] === 'THAT' && w[i] === 'A') && !(w[i - 1] === 'THERE' && w[i] === 'WAS') && !(w[i - 1] === 'THAT' && w[i] === 'THERE') && !(w[i - 1] === 'THAT' && w[i] === 'WAS')) return true; } return false; });
const clean = fluent.filter((s) => !withFrag.includes(s) && !salad.includes(s));
const res = {
  pooledDistinct: all.length, fluentAllDictionaryWords: fluent.length,
  withFragmentToken: withFrag.length, withFunctionWordClashOrRepeat: salad.length, neither: clean.length,
  fragmentTokenCounts: (() => { const m = new Map(); for (const s of withFrag) for (const t of s.words.split(' ')) if (frag(t)) m.set(t, (m.get(t) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 30); })(),
  isWord: Object.fromEntries(['ING', 'INT', 'RE', 'EN', 'TL', 'NED', 'VE', 'ELI', 'AD'].map((w) => [w, lm.isWord(w)])),
  neitherSampleByWordLogp: clean.sort((a, b) => b.wordLogp - a.wordLogp).slice(0, 25).map((s) => `${s.wordLogp.toFixed(2)} ${s.words}`),
};
fs.writeFileSync(path.join(__dirname, 'fluent_check.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
