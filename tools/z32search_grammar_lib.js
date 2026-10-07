'use strict';
/**
 * tools/z32search_grammar_lib.js - the "structured radian/inch message" grammar of the z32search task.
 *
 * A message is LEAD PART1 SEP PART2 TAIL, where {PART1, PART2} = {radian part, inch part} in either
 * order, a radian part is NUM RUNIT or RUNIT NUM, and an inch part is NUM IUNIT or IUNIT NUM
 * (8 forms).  NUM = a cardinal 0..99 or 100 in words, optionally followed by a fraction (AND A HALF,
 * AND THREE EIGHTHS, AND n TENTHS, POINT d, ...), or a bare fraction (HALF, THREE QUARTERS, ...).
 * Letters only, spaces removed when matching the cipher.  All lists are below, in the open.
 */
const UNITS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
const TEENS = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
const DIGITS = ['ZERO', 'OH', ...UNITS];

function cardinals() {
  const c = [...UNITS, ...TEENS, ...TENS];
  for (const t of TENS) for (const u of UNITS) c.push(`${t} ${u}`);
  c.push('ZERO', 'A HUNDRED', 'ONE HUNDRED', 'HUNDRED');
  return c;
}

function fractionSuffixes() {
  const s = ['AND A HALF', 'AND ONE HALF', 'AND A QUARTER', 'AND ONE QUARTER', 'AND THREE QUARTERS', 'AND A THIRD', 'AND ONE THIRD', 'AND TWO THIRDS',
    'AND AN EIGHTH', 'AND ONE EIGHTH', 'AND THREE EIGHTHS', 'AND FIVE EIGHTHS', 'AND SEVEN EIGHTHS'];
  const sixteenths = ['ONE', 'THREE', 'FIVE', 'SEVEN', 'NINE', 'ELEVEN', 'THIRTEEN', 'FIFTEEN'];
  for (const k of sixteenths) s.push(`AND ${k} ${k === 'ONE' ? 'SIXTEENTH' : 'SIXTEENTHS'}`);
  for (const k of UNITS) s.push(`AND ${k} ${k === 'ONE' ? 'TENTH' : 'TENTHS'}`);
  for (const d of DIGITS) s.push(`POINT ${d}`);
  return s;
}

function bareFractions() {
  const b = ['HALF', 'A HALF', 'ONE HALF', 'A QUARTER', 'ONE QUARTER', 'THREE QUARTERS', 'A THIRD', 'ONE THIRD', 'TWO THIRDS',
    'AN EIGHTH', 'ONE EIGHTH', 'THREE EIGHTHS', 'FIVE EIGHTHS', 'SEVEN EIGHTHS'];
  for (const k of UNITS) b.push(`${k} ${k === 'ONE' ? 'TENTH' : 'TENTHS'}`);
  for (const d of DIGITS) b.push(`POINT ${d}`, `ZERO POINT ${d}`);
  return b;
}

function numbers() {
  const out = [];
  const suf = fractionSuffixes();
  for (const c of cardinals()) {
    out.push({ s: c, kind: 'cardinal' });
    for (const f of suf) out.push({ s: `${c} ${f}`, kind: f.startsWith('POINT') ? 'decimal' : 'mixed fraction' });
  }
  for (const b of bareFractions()) out.push({ s: b, kind: 'fraction' });
  return out;
}

const RUNITS = ['RADIAN', 'RADIANS', 'RAD', 'RADS'];
const IUNITS = ['INCH', 'INCHES', 'INCHS', 'IN', 'INS'];
const SEPS = ['', 'AND', 'THEN', 'BY', 'AT', 'PLUS', 'ALONG', 'ALONG THE RADIAN', 'OUT', 'GO', 'X', 'ON', 'TO', 'AND GO', 'THEN GO', 'AND THEN'];
const LEADS = ['', 'GO', 'SET', 'IS', 'IT IS', 'ITS', 'AT', 'BOMB', 'BOMB IS', 'BOMB AT', 'THE BOMB IS', 'BOMB IS AT', 'ESTIMATE', 'MEASURE',
  'DIG', 'DIG AT', 'FROM MAG N', 'FROM MAG NORTH', 'FROM ZERO', 'FROM DIABLO', 'FROM MT DIABLO', 'FROM PEAK', 'MAG N', 'CLOCKWISE', 'LOOK',
  'FIND IT', 'OK', 'OKAY', 'SET ZERO', 'TURN', 'MOVE', 'WALK', 'TRY', 'GO OUT', 'IN', 'FROM', 'BURIED', 'IT IS BURIED', 'THE CODE IS'];
const TAILS = ['', 'ALONG THE RADIAN', 'ALONG THE RADIANS', 'ALONG RADIAN', 'OUT', 'FROM MAG N', 'FROM MAG NORTH', 'FROM ZERO', 'FROM DIABLO',
  'FROM MT DIABLO', 'FROM PEAK', 'FROM TOP', 'FROM CENTER', 'CLOCKWISE', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'DIG', 'DIG IT UP', 'DEEP',
  'ON MAP', 'ON THE MAP', 'FROM CROSS', 'FROM ME', 'BOMB', 'THERE', 'HERE', 'DIG HERE', 'FROM MOUNT DIABLO', 'FROM SUMMIT'];

/** The 8 forms as slot lists: each slot is {name, items: [{s, kind?}]}. */
function forms() {
  const NUM = numbers();
  const mk = (arr) => arr.map((s) => ({ s }));
  const R = mk(RUNITS), I = mk(IUNITS);
  const res = [];
  for (const first of ['R', 'I']) for (const rOrd of ['NU', 'UN']) for (const iOrd of ['NU', 'UN']) {
    const part = (u, ord) => (ord === 'NU' ? [{ name: 'NUM', items: NUM }, { name: u === 'R' ? 'RUNIT' : 'IUNIT', items: u === 'R' ? R : I }]
      : [{ name: u === 'R' ? 'RUNIT' : 'IUNIT', items: u === 'R' ? R : I }, { name: 'NUM', items: NUM }]);
    const pr = part('R', rOrd), pi = part('I', iOrd);
    const slots = [{ name: 'LEAD', items: mk(LEADS) }, ...(first === 'R' ? pr : pi), { name: 'SEP', items: mk(SEPS) }, ...(first === 'R' ? pi : pr), { name: 'TAIL', items: mk(TAILS) }];
    const id = (first === 'R' ? `R:${rOrd === 'NU' ? 'num-unit' : 'unit-num'} I:${iOrd === 'NU' ? 'num-unit' : 'unit-num'}` : `I:${iOrd === 'NU' ? 'num-unit' : 'unit-num'} R:${rOrd === 'NU' ? 'num-unit' : 'unit-num'}`);
    res.push({ id: `LEAD ${id} TAIL`.replace(/:/g, '=').replace(/ /g, '_'), desc: `LEAD ${first === 'R' ? 'radian part' : 'inch part'} SEP ${first === 'R' ? 'inch part' : 'radian part'} TAIL; radian part ${rOrd === 'NU' ? 'NUM RUNIT' : 'RUNIT NUM'}, inch part ${iOrd === 'NU' ? 'NUM IUNIT' : 'IUNIT NUM'}`, slots });
  }
  return res;
}

const letters = (s) => s.replace(/[^A-Z]/g, '');

module.exports = { forms, numbers, cardinals, fractionSuffixes, bareFractions, RUNITS, IUNITS, SEPS, LEADS, TAILS, letters };
