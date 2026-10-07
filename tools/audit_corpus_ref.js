'use strict';
/**
 * tools/audit_corpus_ref.js - natural-English null for the proposal audit.
 *
 * Every word-aligned window of exactly L letters (whole words, inside one sentence)
 * of the corpus documents (data/lm/raw/gutenberg, sentence rules as tools/textsample.js)
 * is tested for consistency with each cipher variant.  The test reads the window's letters
 * in place (only the repeat positions are compared), so no strings are built except for
 * hits and for a uniform reservoir sample of all windows.
 *
 * The windows are scored only with lm.wordSegment, which uses Norvig's web word counts and
 * not the Gutenberg n-gram tables, so using the n-gram TRAINING documents here does not leak.
 * --docs heldout restricts to the held-out documents (manifest row % 50 == 25).
 *
 * Output: results/audit/corpus_ref.json
 *   per variant: windows tested, distinct consistent strings, rate, logP quantiles, the sorted
 *   logP list and the strings (same order), 10 best examples;
 *   per length: windows, reservoir logP quantiles, reservoir strings.
 *
 *   node tools/audit_corpus_ref.js [--docs all|heldout] [--stride 1] [--reservoir 20000] [--seed 7]
 */
const fs = require('fs');
const path = require('path');
const C = require('./cipher');
const lm = require('./lm');
const { makeRng } = require('./solvercore');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const RES = +opt('reservoir', 20000);
const SEED = +opt('seed', 7);
const DOCS = opt('docs', 'all');
const STRIDE = +opt('stride', 1);
const OUT = opt('out', path.join(ROOT, 'results/audit/corpus_ref.json'));
const GDIR = path.join(ROOT, 'data', 'lm', 'raw', 'gutenberg');

const V = (f) => C.loadCipher(path.join(ROOT, f)).text;
const variants = [
  // Z32: canonical, bar_is_serif_I, t2_is_perp, bar_I_and_t2_perp and tau_distinct share one isomorph
  { id: 'z32.canonical', text: V('data/ciphers/variants/z32.canonical.txt'), modes: ['homophonic', 'simple'] },
  { id: 'z32.triangles_merged', text: V('data/ciphers/variants/z32.triangles_merged.txt'), modes: ['homophonic'] },
  { id: 'z32.reversed', text: V('results/audit/ciphers/z32.reversed.txt'), modes: ['homophonic'] },
  { id: 'z13.canonical', text: V('data/ciphers/variants/z13.canonical.txt'), modes: ['homophonic', 'simple'] },
  { id: 'z13.crosshair_null', text: V('data/ciphers/variants/z13.crosshair_null.txt'), modes: ['homophonic', 'simple'] },
  { id: 'z13.circles_distinct', text: V('data/ciphers/variants/z13.circles_distinct.txt'), modes: ['homophonic'] },
];
for (const v of variants) {
  const g = {}; for (let i = 0; i < v.text.length; i++) (g[v.text[i]] = g[v.text[i]] || []).push(i);
  v.groups = Object.values(g);
  v.multi = v.groups.filter((x) => x.length > 1);
  v.firsts = v.groups.map((x) => x[0]);
}
const lengths = [...new Set(variants.map((v) => v.text.length))].sort((a, b) => a - b);

// documents
const man = fs.readFileSync(path.join(ROOT, 'data/lm/corpus_manifest.tsv'), 'utf8').split('\n').filter(Boolean);
const idc = man[0].split('\t').indexOf('pg_id');
const docs = [];
for (let i = 1; i < man.length; i++) {
  const row = i - 1;
  if (DOCS === 'heldout' && row % 50 !== 25) continue;
  if (row % STRIDE !== 0) continue;
  docs.push(man[i].split('\t')[idc]);
}
function bodyOf(text) {
  const s = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i.exec(text);
  const e = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i.exec(text);
  if (s) text = text.slice(s.index + s[0].length, e && e.index > s.index ? e.index : text.length);
  return text;
}

const t0 = Date.now();
const rng = makeRng(SEED, 0x61756474);
const stats = {}; for (const L of lengths) stats[L] = { windows: 0, reservoir: [] };
const found = {}; for (const v of variants) for (const m of v.modes) found[`${v.id}|${m}`] = new Map();
const buf = new Uint8Array(1 << 16);
let nDocs = 0, nSent = 0;
for (const id of docs) {
  const fp = path.join(GDIR, `${id}.txt`);
  if (!fs.existsSync(fp)) continue;
  nDocs++;
  let t = bodyOf(fs.readFileSync(fp, 'utf8'));
  t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const paras = t.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length > 60 && /[a-z]/.test(p));
  for (const p of paras) {
    if (/(gutenberg|transcriber|copyright|http|www\.)/i.test(p)) continue;
    for (const s of p.split(/(?<=[.!?]["'\u201d\u2019]?)\s+(?=["'\u201c\u2018]?[A-Z])/)) {
      if (/\d|[_*\[\]{}<>|#@=\\]/.test(s)) continue;
      const raw = (s.match(/[A-Za-z]+(?:['\u2019][A-Za-z]+)*/g) || []).map((w) => w.replace(/['\u2019]/g, ''));
      if (raw.length < 3) continue;
      const up = raw.filter((w) => w.length > 1 && w === w.toUpperCase()).length;
      if (up > raw.length / 2) continue;
      const words = raw.map((w) => w.toUpperCase());
      nSent++;
      const letters = words.join('');
      if (!/^[A-Z]+$/.test(letters) || letters.length > buf.length) continue;
      for (let i = 0; i < letters.length; i++) buf[i] = letters.charCodeAt(i);
      const ends = new Set(); let off = 0; const starts = [];
      for (const w of words) { starts.push(off); off += w.length; ends.add(off); }
      for (let si = 0; si < starts.length; si++) {
        const a = starts[si];
        for (const L of lengths) {
          if (!ends.has(a + L)) continue;
          const st = stats[L];
          st.windows++;
          if (st.reservoir.length < RES) st.reservoir.push(letters.substr(a, L));
          else { const j = rng.int(st.windows); if (j < RES) st.reservoir[j] = letters.substr(a, L); }
          for (const v of variants) {
            if (v.text.length !== L) continue;
            let ok = true;
            for (const g of v.multi) { const c = buf[a + g[0]]; for (let k = 1; k < g.length; k++) if (buf[a + g[k]] !== c) { ok = false; break; } if (!ok) break; }
            if (!ok) continue;
            for (const m of v.modes) {
              if (m === 'simple') { let mask = 0, inj = true; for (const p0 of v.firsts) { const b = 1 << (buf[a + p0] - 65); if (mask & b) { inj = false; break; } mask |= b; } if (!inj) continue; }
              const f = found[`${v.id}|${m}`]; const str = letters.substr(a, L);
              if (!f.has(str)) {
                let k = si, ln = 0; const ws = [];
                while (ln < L) { ws.push(words[k]); ln += words[k].length; k++; }
                f.set(str, ws.join(' '));
              }
            }
          }
        }
      }
    }
  }
}
// sanity: every hit is consistent by tools/cipher.js
for (const v of variants) for (const m of v.modes) for (const s of found[`${v.id}|${m}`].keys()) if (!C.consistent(v.text, s, m)) throw new Error(`checker mismatch ${v.id} ${m} ${s}`);

function quant(sorted, qs) { const o = {}; for (const q of qs) o[q] = sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(3) : null; return o; }
const Q = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];
const out = {
  tool: 'tools/audit_corpus_ref.js', created: new Date().toISOString(), seed: SEED, docs: DOCS, stride: STRIDE, documentsRead: nDocs, sentences: nSent,
  corpus: 'data/lm/raw/gutenberg (LM corpus documents); sentence rules as tools/textsample.js',
  window_rule: 'whole words inside one sentence, exactly L letters; every start word',
  lengths: {}, variants: {},
};
for (const L of lengths) {
  const lp = stats[L].reservoir.map((t) => lm.wordSegment(t).logp).sort((x, y) => x - y);
  out.lengths[L] = { windows: stats[L].windows, reservoirSize: lp.length, reservoirLogpQuantiles: quant(lp, Q), reservoirLogpSortedAsc: lp.map((x) => +x.toFixed(3)), reservoirStrings: stats[L].reservoir };
}
for (const v of variants) for (const m of v.modes) {
  const f = found[`${v.id}|${m}`];
  const rows = [...f].map(([t, w]) => ({ t, w, lp: lm.wordSegment(t).logp })).sort((x, y) => x.lp - y.lp);
  const L = v.text.length;
  out.variants[`${v.id}|${m}`] = {
    variant: v.id, mode: m, cipher: v.text, length: L, windowsTested: stats[L].windows,
    distinctConsistent: rows.length,
    rateConsistentPerWindow: rows.length / stats[L].windows,
    logpQuantiles: quant(rows.map((r) => r.lp), Q),
    logpSortedAsc: rows.map((r) => +r.lp.toFixed(3)),
    stringsSameOrder: rows.map((r) => r.t),
    bestExamples: rows.slice(-10).reverse().map((r) => ({ words: r.w, logp: +r.lp.toFixed(2) })),
  };
}
out.seconds = (Date.now() - t0) / 1000;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('docs', nDocs, 'sentences', nSent);
for (const [k, v] of Object.entries(out.variants)) console.log(k.padEnd(32), 'windows', v.windowsTested, 'consistent', v.distinctConsistent, 'median logp', v.logpQuantiles[0.5]);
for (const [L, s] of Object.entries(out.lengths)) console.log('L', L, 'windows', s.windows, 'reservoir median', s.reservoirLogpQuantiles[0.5]);
console.log('seconds', out.seconds);
