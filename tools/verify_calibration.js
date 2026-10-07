'use strict';
/**
 * tools/verify_calibration.js - independent check of data/ciphers/z408.json and z340.json
 * (built by tools/build_calibration.py) using the helpers in tools/cipher.js.
 *
 *   node tools/verify_calibration.js
 *
 * Prints only lengths, hashes, positions and single letters (never plaintext runs).
 * Exit code 1 if any check fails.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./cipher');

const ROOT = path.join(__dirname, '..');
const COLS = 17;
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ciphers', f), 'utf8'));
const src = (f) => fs.readFileSync(path.join(ROOT, 'data', 'sources', f), 'latin1').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const mism = (a, b) => { const o = []; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) o.push(i); return o; };
let fails = 0;
function check(cond, msg) { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; }

const z13 = load('z13.json').ascii;
const z32 = load('z32.json').ascii;

function common(j, nrows) {
  const t = j.ascii;
  check(t.length === j.length && j.rows.length === nrows && j.rows.every((r) => r.length === COLS) && j.rows.join('') === t,
    `${j.id}: ascii length ${t.length}, ${j.rows.length} rows x ${COLS}`);
  check(j.isomorph === C.isomorph(t), `${j.id}: isomorph matches cipher.js`);
  const counts = C.symbolCounts(t);
  const bySym = new Map(j.symbols.map((s) => [s.ascii, s]));
  let ok = counts.length === j.symbols.length;
  for (const c of counts) {
    const s = bySym.get(c.symbol);
    if (!s || s.count !== c.count || JSON.stringify(s.positions) !== JSON.stringify(c.positions)) ok = false;
    if (s && (s.in_z13 !== z13.includes(c.symbol) || s.in_z32 !== z32.includes(c.symbol))) ok = false;
    if (s && s.letter !== j.key[c.symbol]) ok = false;
  }
  check(ok, `${j.id}: ${counts.length} symbols; counts, positions, in_z13, in_z32, letter consistent`);
  check(counts.every((c) => /^[A-Z]$/.test(j.key[c.symbol] || '')) && Object.keys(j.key).length === counts.length,
    `${j.id}: key maps every symbol to one letter (${Object.keys(j.key).length} entries)`);
  check(/^[A-Z]+$/.test(j.plaintext) && j.plaintext.length === t.length, `${j.id}: plaintext is ${j.plaintext.length} upper-case letters, sha256 ${sha(j.plaintext)}`);
  for (const s of j.sources) {
    if (!s.local_file) continue;
    const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, s.local_file))).digest('hex');
    if (h !== s.sha256) check(false, `${j.id}: source file changed since build: ${s.local_file}`);
  }
}

/* ------------------------------------------------------------------ Z408 */
{
  const j = load('z408.json');
  console.log('== Z408');
  common(j, 24);
  const dec = C.applyKey(j.ascii, j.key);
  const mm = mism(dec, j.plaintext);
  console.log('     key(ascii) vs plaintext mismatches (pos symbol key->plaintext):',
    mm.map((i) => `${i} ${j.ascii[i]} ${dec[i]}->${j.plaintext[i]}`).join(', '));
  check(JSON.stringify(mm) === JSON.stringify(j.encoding_slips.map((s) => s.position)), `Z408: ${mm.length} mismatches, all listed in encoding_slips`);
  check(dec === j.plaintext_key_decoded, 'Z408: key(ascii) equals plaintext_key_decoded');
  check(dec === src('viz_z408-pt.txt'), "Z408: key(ascii) equals Oranchak's z408-pt.txt");
  check(j.ascii === src('viz_z408.txt'), "Z408: ascii equals Oranchak's z408.txt");
  const az = src('az_z408.txt');
  console.log('     ascii vs AZdecrypt Zodiac 408.txt differs at', mism(j.ascii, az).map((i) => `${i} ${j.ascii[i]}/${az[i]}`).join(', '));
  const azp = src('az_z408_solved.txt');
  console.log('     key(ascii) vs AZdecrypt Zodiac 408 solved.txt differs at', mism(dec, azp).map((i) => `${i} ${dec[i]}/${azp[i]}`).join(', '));
  const cons = C.consistent(j.ascii, j.plaintext);
  console.log('     plaintext vs ascii homophonic consistency (expected false because of the slips):', typeof cons === 'object' ? JSON.stringify(cons).slice(0, 80) : cons);
  const ci = C.loadCipher(path.join(ROOT, 'data', 'ciphers', 'z408.json'));
  check(ci.text === j.ascii && ci.plaintext === j.plaintext && ci.readOrder === null, 'Z408: cipher.js loadCipher reads text and aligned plaintext');
  const homo = C.symbolsPerLetter(C.parseKey(j.key));
  console.log('     homophones per letter:', Object.keys(homo).sort().map((l) => `${l}${homo[l].length}`).join(' '));
}

/* ------------------------------------------------------------------ Z340 */
{
  const j = load('z340.json');
  console.log('== Z340');
  common(j, 20);
  const ro = j.read_order;
  const info = C.orderInfo(ro, 340);
  check(info.permutation, 'Z340: read_order is a permutation of 0..339');
  // Rebuild the order from the rules stated in the JSON and compare.
  const tr = j.transposition;
  const life = tr.untransposed_cells.written_positions;
  const fix = (idx) => {
    const r = Math.floor(idx / COLS), c = idx % COLS;
    if (r === tr.line15_shift.row && c >= tr.line15_shift.cols[0]) return r * COLS + (c === tr.line15_shift.cols[0] ? tr.line15_shift.cols[1] : c - 1);
    return idx;
  };
  const dec12 = (r0) => Array.from({ length: 153 }, (_, k) => (r0 + (k % 9)) * COLS + (2 * k) % COLS);
  const s1 = dec12(0);
  const s2 = dec12(9).filter((i) => !life.includes(i)).map(fix).concat(life);
  const s3 = [];
  let p = 306;
  const spans = tr.reversed_spans.slice();
  while (p < 340) {
    const sp = spans.find((s) => s[0] === p);
    if (sp) { for (let i = sp[1]; i >= sp[0]; i--) s3.push(i); p = sp[1] + 1; } else { s3.push(p); p++; }
  }
  const rebuilt = s1.concat(s2, s3);
  check(JSON.stringify(rebuilt) === JSON.stringify(ro), 'Z340: read_order equals the rules in transposition (decimation, line-15 shift, untransposed cells, reversed spans)');
  check(JSON.stringify(ro.slice(0, 153)) === JSON.stringify(s1), 'Z340: section 1 is the plain (1,2)-decimation');
  const reading = C.applyReadOrder(j.ascii, ro);
  check(reading === src('viz_z340-untransposed.txt'), "Z340: ascii[read_order] equals Oranchak's z340-untransposed.txt");
  const dec = C.applyKey(reading, j.key);
  const m1 = mism(dec, j.plaintext);
  check(m1.length === 0, `Z340: key(ascii[read_order]) vs plaintext: ${m1.length} mismatches`);
  check(dec === src('az_z340_solved.txt'), "Z340: decoding equals AZdecrypt 'Zodiac 340 solved.txt'");
  const m2 = mism(dec, j.plaintext_corrected);
  console.log('     decoding vs plaintext_corrected mismatches (read pos, written pos, symbol, key->intended):',
    m2.map((k) => `${k} ${ro[k]} ${j.ascii[ro[k]]} ${dec[k]}->${j.plaintext_corrected[k]}`).join(', '));
  check(JSON.stringify(m2) === JSON.stringify(j.encoding_errors.map((e) => e.read_position)), `Z340: ${m2.length} mismatches vs corrected text, all listed in encoding_errors`);
  check(C.applyKey(j.ascii, j.key) === j.plaintext_aligned, 'Z340: key(ascii) equals plaintext_aligned (written order)');
  const ci = C.loadCipher(path.join(ROOT, 'data', 'ciphers', 'z340.json'));
  check(ci.text === j.ascii && JSON.stringify(ci.readOrder) === JSON.stringify(ro) && ci.plaintextReadOrder === j.plaintext && ci.plaintext === j.plaintext_aligned,
    'Z340: cipher.js loadCipher gives read order, aligned and reading-order plaintext');
  const alt = j.read_order_paper_final;
  check(C.orderInfo(alt, 340).permutation, 'Z340: read_order_paper_final is a permutation');
  const moved = mism(alt, ro);
  console.log(`     read_order_paper_final differs from read_order at ${moved.length} reading positions (${moved[0]}..${moved[moved.length - 1]})`);
  // Bigram repeats, the statistic that pointed to the transposition (paper section 5.3).
  const bigrams = (s) => { const m = new Map(); for (let i = 0; i + 1 < s.length; i++) { const b = s.slice(i, i + 2); m.set(b, (m.get(b) || 0) + 1); } let r = 0; for (const v of m.values()) r += v - 1; return r; };
  console.log(`     repeating bigrams: written order ${bigrams(j.ascii)}, reading order ${bigrams(reading)}`);
  const homo = C.symbolsPerLetter(C.parseKey(j.key));
  console.log('     homophones per letter:', Object.keys(homo).sort().map((l) => `${l}${homo[l].length}`).join(' '));
}

console.log(fails ? `\n${fails} check(s) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
