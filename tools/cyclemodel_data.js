'use strict';
/**
 * tools/cyclemodel_data.js - calibration data for the homophone-selection model
 * (task cyclemodel).  Loads Z408 and Z340 in WRITTEN (= enciphering) order and
 * returns, per text segment, the sequence of (letter, symbol, row, position)
 * events with the documented enciphering slips removed.
 *
 * Never prints plaintext.  Letters are the key letters of the written symbols
 * (what Zodiac enciphered), so a slip position is dropped from every sequence.
 *
 *   const D = require('./cyclemodel_data');
 *   const segs = D.segments();   // [{id, cipher, part, events:[{i, row, col, letter, sym}], rows}]
 *   D.keys()                     // {z408: {letter: [symbols]}, z340: {...}}
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const W = 17; // written row width of both ciphers

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ciphers', name + '.json'), 'utf8'));
}

function keyHomophones(key) {
  const h = {};
  for (const [s, l] of Object.entries(key)) (h[l] = h[l] || []).push(s);
  return h;
}

/**
 * Segments:
 *   z408.p1, z408.p2, z408.p3  (rows 0-7, 8-15, 16-23 incl. the unsolved 18-symbol tail? no: tail dropped)
 *   z340.s1, z340.s2, z340.s3  (rows 0-8, 9-17, 18-19; written order)
 * opts.keepTail: keep Z408 positions 390-407 (default false).
 */
function segments(opts = {}) {
  const z408 = load('z408'), z340 = load('z340');
  const out = [];
  const slip408 = new Set(z408.encoding_slips.map((x) => x.position));
  const tail0 = z408.unsolved_tail.positions[0];
  for (const part of z408.parts) {
    const [p0, p1] = part.positions;
    const ev = [];
    for (let i = p0; i <= p1; i++) {
      if (slip408.has(i)) continue;
      if (!opts.keepTail && i >= tail0) continue;
      const sym = z408.ascii[i];
      ev.push({ i, row: Math.floor(i / W), col: i % W, letter: z408.key[sym], sym });
    }
    out.push({ id: 'z408.p' + part.part, cipher: 'z408', part: part.part, events: ev, rows: [part.rows[0], part.rows[1]] });
  }
  const err340 = new Set(z340.encoding_errors.map((x) => x.written_position));
  for (const sec of z340.transposition.sections) {
    const [p0, p1] = sec.written_positions;
    const ev = [];
    for (let i = p0; i <= p1; i++) {
      if (err340.has(i)) continue;
      const sym = z340.ascii[i];
      ev.push({ i, row: Math.floor(i / W), col: i % W, letter: z340.key[sym], sym });
    }
    out.push({ id: 'z340.s' + sec.section, cipher: 'z340', part: sec.section, events: ev, rows: sec.rows });
  }
  return out;
}

function keys() {
  const z408 = load('z408'), z340 = load('z340');
  return { z408: keyHomophones(z408.key), z340: keyHomophones(z340.key) };
}

/** Raw written-order symbol strings (for repeat statistics; no plaintext). */
function texts() {
  const z408 = load('z408'), z340 = load('z340');
  return { z408: z408.ascii, z340: z340.ascii };
}

/** Written-order key letters (as enciphered) for simulation; callers must not print them. */
function letterStrings() {
  const z408 = load('z408'), z340 = load('z340');
  const a = [...z408.ascii].map((s) => z408.key[s]).join('');
  const b = [...z340.ascii].map((s) => z340.key[s]).join('');
  return { z408: a, z340: b, z408parts: z408.parts.map((p) => p.positions), z408tail: z408.unsolved_tail.positions[0] };
}

module.exports = { segments, keys, texts, letterStrings, W };
