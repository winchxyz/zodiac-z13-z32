'use strict';
/**
 * tools/lead_skeptic_homophones.js - does Z13's repeat structure fit "enciphered with the Z340 key"?
 *
 * Takes 13-letter windows of the LM corpus (data/lm/raw/corpus_letters.txt, first --chars letters,
 * windows at stride --stride), and enciphers each with the real Z340 key (`key` field only; the Z340
 * text is never decoded) in three ways:
 *   simple  one fixed homophone per letter (equivalent to the plaintext's own letter pattern)
 *   random  each occurrence takes one of the letter's Z340 homophones uniformly at random
 *   cycle   each letter cycles through its Z340 homophones from a random start (Z340/Z408 habit)
 * Windows containing a letter the Z340 key lacks are skipped. Counts windows whose symbol-count
 * profile equals Z13's (3,2,2,2,1,1,1,1) and whose isomorph equals Z13's exactly (abcdefegehcag).
 *
 *   node tools/lead_skeptic_homophones.js --chars 20000000 --stride 3 --seed 99 --out results/lead/skeptic/homophones.json
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function args() {
  const o = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { o[a[i].slice(2)] = a[i + 1]; i++; }
  return o;
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function isoOf(arr) {
  const m = new Map();
  let s = '';
  for (const x of arr) { if (!m.has(x)) m.set(x, String.fromCharCode(97 + m.size)); s += m.get(x); }
  return s;
}
function profileOf(arr) {
  const c = new Map();
  for (const x of arr) c.set(x, (c.get(x) || 0) + 1);
  return [...c.values()].sort((a, b) => b - a).join(',');
}

function main() {
  const o = args();
  const chars = +(o.chars || 20000000), stride = +(o.stride || 3), seed = +(o.seed || 99);
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ciphers', 'z340.json'), 'utf8'));
  const homs = {};
  for (const [s, l] of Object.entries(j.key)) { const L = String(l).toUpperCase(); (homs[L] = homs[L] || []).push(s); }
  const fd = fs.openSync(path.join(ROOT, 'data', 'lm', 'raw', 'corpus_letters.txt'), 'r');
  const buf = Buffer.alloc(chars);
  const got = fs.readSync(fd, buf, 0, chars, 0);
  fs.closeSync(fd);
  const txt = buf.toString('latin1', 0, got).replace(/[^A-Z]/g, '');
  const rng = mulberry32(seed);
  const Z13ISO = 'abcdefegehcag', Z13PROF = '3,2,2,2,1,1,1,1';
  const res = { simple: { prof: 0, iso: 0 }, random: { prof: 0, iso: 0 }, cycle: { prof: 0, iso: 0 } };
  let used = 0, skipped = 0;
  for (let i = 0; i + 13 <= txt.length; i += stride) {
    const w = txt.slice(i, i + 13);
    let ok = true;
    for (const ch of w) if (!homs[ch]) { ok = false; break; }
    if (!ok) { skipped++; continue; }
    used++;
    const simple = w.split('');
    const random = simple.map((ch) => { const h = homs[ch]; return h[Math.floor(rng() * h.length)]; });
    const start = {}, cnt = {};
    const cycle = simple.map((ch) => {
      const h = homs[ch];
      if (!(ch in start)) { start[ch] = Math.floor(rng() * h.length); cnt[ch] = 0; }
      return h[(start[ch] + cnt[ch]++) % h.length];
    });
    for (const [nm, arr] of [['simple', simple], ['random', random], ['cycle', cycle]]) {
      if (profileOf(arr) === Z13PROF) res[nm].prof++;
      if (isoOf(arr) === Z13ISO) res[nm].iso++;
    }
  }
  const out = { tool: 'tools/lead_skeptic_homophones.js', created: new Date().toISOString(), chars: got, stride, seed, windowsUsed: used, windowsSkipped: skipped,
    homophonesPerLetter: Object.fromEntries(Object.entries(homs).map(([l, h]) => [l, h.length]).sort()), counts: res };
  for (const nm of Object.keys(res)) { res[nm].profRate = res[nm].prof / used; res[nm].isoRate = res[nm].iso / used; }
  out.ratioSimpleOverRandom = { prof: res.simple.prof / Math.max(1, res.random.prof), iso: res.simple.iso / Math.max(1, res.random.iso) };
  out.ratioSimpleOverCycle = { prof: res.simple.prof / Math.max(1, res.cycle.prof), iso: res.simple.iso / Math.max(1, res.cycle.iso) };
  fs.mkdirSync(path.dirname(path.join(ROOT, o.out)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, o.out), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
}
main();
