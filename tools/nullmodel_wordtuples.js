'use strict';
/**
 * tools/nullmodel_wordtuples.js - count ORDERED k-word sequences (exactly k
 * words, repetition allowed) whose concatenation fits a cipher, as in
 * Oranchak's 2013 Z13 dictionary search ("283 solutions, each containing
 * exactly two words"; "1,283,443 ... exactly three words").
 *
 * Unlike tools/enumerate.js (which counts distinct letter STRINGS that split
 * into AT MOST M words), this counts word TUPLES: AB+C and A+BC are two
 * tuples if both splits are in the list.  It also reports the number of
 * distinct strings among them.
 *
 * Usage:
 *   node tools/nullmodel_wordtuples.js --cipher data/ciphers/variants/z13.canonical.txt
 *        --words-file data/lm/words_common.tsv [--top N] [--k 2,3] [--mode homophonic|simple|both]
 *        [--single-letters AI] [--min-count C] [--filter-corpus data/lm/raw/corpus_words.tsv:2]
 *        [--threads 4] [--max-seconds 1800] [--stream-sample 50] [--out results/x.json]
 *
 * --single-letters: which one-letter words to keep (default "AI"; "ALL" keeps every one in the list)
 * --filter-corpus F:c keeps only words that occur at least c times in word-count file F
 * Work is split over worker threads by the first two letters of the first word.
 */
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const C = require('./cipher');

function readWords(o) {
  const lines = fs.readFileSync(o.wordsFile, 'utf8').split('\n');
  let filt = null;
  if (o.filterCorpus) {
    const [f, c] = o.filterCorpus.split(/:(?=\d+$)/);
    const minc = +c || 1;
    filt = new Set();
    for (const ln of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = ln.split('\t');
      if (t.length >= 2 && +t[1] >= minc) filt.add(t[0].trim().toUpperCase());
    }
  }
  const singles = o.singleLetters === 'ALL' ? null : new Set(o.singleLetters.split(''));
  const out = [];
  const seen = new Set();
  for (const ln of lines) {
    if (!ln.trim()) continue;
    const w = ln.split('\t')[0].trim().toUpperCase();
    if (!/^[A-Z]+$/.test(w)) continue;
    if (w.length === 1 && singles && !singles.has(w)) continue;
    if (filt && !filt.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (o.top && out.length >= o.top) break;
  }
  return out;
}

function buildTrie(words, maxLen) {
  // children: Int32Array(26 * cap); end flag; maxDepthBelow (longest word suffix from this node)
  let cap = 1 << 16;
  let ch = new Int32Array(26 * cap);
  let end = new Uint8Array(cap);
  let n = 1;
  for (const w of words) {
    if (w.length > maxLen) continue;
    let node = 0;
    for (let i = 0; i < w.length; i++) {
      const c = w.charCodeAt(i) - 65;
      let nx = ch[node * 26 + c];
      if (!nx) {
        if (n >= cap) {
          const ch2 = new Int32Array(26 * cap * 2); ch2.set(ch); ch = ch2;
          const e2 = new Uint8Array(cap * 2); e2.set(end); end = e2;
          cap *= 2;
        }
        nx = n++;
        ch[node * 26 + c] = nx;
      }
      node = nx;
    }
    end[node] = 1;
  }
  // max / min remaining word length below each node (post-order via reverse creation order works since children > parent)
  const maxBelow = new Int16Array(n).fill(-1);
  const minBelow = new Int16Array(n).fill(32767);
  for (let v = n - 1; v >= 0; v--) {
    if (end[v]) { maxBelow[v] = Math.max(maxBelow[v], 0); minBelow[v] = 0; }
    for (let c = 0; c < 26; c++) {
      const u = ch[v * 26 + c];
      if (u && maxBelow[u] >= 0) {
        if (maxBelow[u] + 1 > maxBelow[v]) maxBelow[v] = maxBelow[u] + 1;
        if (minBelow[u] + 1 < minBelow[v]) minBelow[v] = minBelow[u] + 1;
      }
    }
  }
  return { ch: ch.slice(0, 26 * n), end: end.slice(0, n), maxBelow, minBelow, nodes: n };
}

/** Count k-word tuples for one task (first word starts with letters prefix). */
function countTask(T, ids, S, L, k, simple, prefix, deadline, sampleMax) {
  const { ch, end, maxBelow, minBelow } = T;
  const key = new Int8Array(S).fill(-1);
  const used = new Int16Array(26);
  const buf = new Uint8Array(L);
  let tuples = 0;
  const strings = new Set();
  let stopped = false;
  let steps = 0;
  const sample = [];
  const wordsAt = new Int8Array(L + 1); // word boundary markers for sampling
  function rec(p, node, done) {
    if (stopped) return;
    if ((++steps & 0xfffff) === 0 && Date.now() > deadline) { stopped = true; return; }
    const rem = L - p; // letters still to place, including position p
    // the current word plus (k - done - 1) further words must fill rem letters
    const wordsLeft = k - done - 1;
    if (maxBelow[node] < 1) return;
    if (wordsLeft === 0) { if (maxBelow[node] < rem || minBelow[node] > rem) { /* the last word must end exactly at L */ if (maxBelow[node] < rem) return; } }
    const sym = ids[p];
    const prev = key[sym];
    const lo = (p === 0 && prefix) ? prefix[0] : 0;
    const hi = (p === 0 && prefix) ? prefix[0] : 25;
    for (let c = lo; c <= hi; c++) {
      if (p === 1 && prefix && prefix.length > 1 && done === 0 && c !== prefix[1]) continue;
      const u = ch[node * 26 + c];
      if (!u) continue;
      if (prev >= 0) { if (prev !== c) continue; } else if (simple && used[c]) continue;
      if (prev < 0) { key[sym] = c; used[c]++; }
      buf[p] = c;
      if (end[u]) {
        if (p + 1 === L) {
          if (done + 1 === k) {
            tuples++;
            wordsAt[p + 1] = 1;
            const s = String.fromCharCode(...Array.from(buf, (x) => x + 65));
            strings.add(s);
            if (sample.length < sampleMax) {
              let w = '';
              for (let i = 0; i < L; i++) { if (i && wordsAt[i]) w += ' '; w += String.fromCharCode(buf[i] + 65); }
              sample.push(w);
            }
            wordsAt[p + 1] = 0;
          }
        } else if (done + 1 < k && L - (p + 1) >= k - done - 1) {
          wordsAt[p + 1] = 1;
          rec(p + 1, 0, done + 1);
          wordsAt[p + 1] = 0;
        }
      }
      if (p + 1 < L) rec(p + 1, u, done);
      if (prev < 0) { key[sym] = -1; used[c]--; }
    }
  }
  rec(0, 0, 0);
  return { tuples, strings: [...strings], stopped, sample };
}

if (!isMainThread) {
  const d = workerData;
  const T = d.trie;
  parentPort.on('message', (m) => {
    if (m.cmd === 'stop') { process.exit(0); }
    const r = countTask(T, d.ids, d.S, d.L, m.k, m.simple, m.prefix, d.deadline, d.sampleMax);
    parentPort.postMessage(Object.assign({ id: m.id }, r));
  });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}

function parse() {
  const a = process.argv.slice(2);
  const o = { k: '2,3', mode: 'both', singleLetters: 'AI', threads: 4, maxSeconds: 1800, top: 0, sampleMax: 30 };
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    const v = () => a[++i];
    if (t === '--cipher') o.cipher = v();
    else if (t === '--words-file') o.wordsFile = v();
    else if (t === '--top') o.top = +v();
    else if (t === '--k') o.k = v();
    else if (t === '--mode') o.mode = v();
    else if (t === '--single-letters') o.singleLetters = v();
    else if (t === '--filter-corpus') o.filterCorpus = v();
    else if (t === '--threads') o.threads = +v();
    else if (t === '--max-seconds') o.maxSeconds = +v();
    else if (t === '--stream-sample') o.sampleMax = +v();
    else if (t === '--out') o.out = v();
    else if (t === '--label') o.label = v();
    else { console.error('unknown option ' + t); process.exit(2); }
  }
  return o;
}

async function main() {
  const o = parse();
  const ci = C.loadCipher(o.cipher);
  const text = ci.text;
  const L = text.length;
  const symMap = new Map();
  const ids = Array.from(text, (s) => { if (!symMap.has(s)) symMap.set(s, symMap.size); return symMap.get(s); });
  const S = symMap.size;
  const t0 = Date.now();
  const words = readWords(o);
  const T = buildTrie(words, L);
  const lenHist = {};
  for (const w of words) if (w.length <= L) lenHist[w.length] = (lenHist[w.length] || 0) + 1;
  const deadline = Date.now() + o.maxSeconds * 1000;
  const modes = o.mode === 'both' ? ['homophonic', 'simple'] : [o.mode];
  const ks = o.k.split(',').map(Number);
  // number of ordered k-tuples of total length L (all candidates, before the fit test)
  function tupleTotal(k) {
    const hist = new Array(L + 1).fill(0);
    for (const [len, c] of Object.entries(lenHist)) hist[+len] = c;
    let dp = new Array(L + 1).fill(0); dp[0] = 1;
    for (let j = 0; j < k; j++) {
      const nd = new Array(L + 1).fill(0);
      for (let s = 0; s <= L; s++) if (dp[s]) for (let l = 1; s + l <= L; l++) nd[s + l] += dp[s] * hist[l];
      dp = nd;
    }
    return dp[L];
  }
  const workers = [];
  const nW = Math.max(1, o.threads);
  for (let i = 0; i < nW; i++) workers.push(new Worker(__filename, { workerData: { trie: T, ids, S, L, deadline, sampleMax: o.sampleMax } }));
  const results = [];
  for (const mode of modes) {
    for (const k of ks) {
      const tasks = [];
      for (let a = 0; a < 26; a++) {
        tasks.push({ prefix: [a], single: true });
      }
      // split the busiest first letters further? keep it simple: 26 tasks by first letter
      let next = 0;
      let tuples = 0, stopped = false;
      const strings = new Set();
      const sample = [];
      await new Promise((resolve) => {
        let active = 0;
        const launch = (w) => {
          if (next >= tasks.length) { if (active === 0) resolve(); return; }
          const id = next++;
          active++;
          w.once('message', (r) => {
            active--;
            tuples += r.tuples; if (r.stopped) stopped = true;
            for (const s of r.strings) strings.add(s);
            for (const s of r.sample) if (sample.length < o.sampleMax) sample.push(s);
            launch(w);
            if (active === 0 && next >= tasks.length) resolve();
          });
          w.postMessage({ id, k, simple: mode === 'simple', prefix: tasks[id].prefix });
        };
        for (const w of workers) launch(w);
      });
      const tot = tupleTotal(k);
      const r = { mode, k, tuples, distinctStrings: strings.size, candidateTuplesOfLengthL: tot, fitRate: tot ? tuples / tot : null, complete: !stopped, sample };
      results.push(r);
      console.log(`${o.label || ''} ${mode} k=${k}: ${tuples} tuples, ${strings.size} distinct strings, ${tot.toExponential(3)} candidate tuples (rate ${(tuples / tot).toExponential(3)})${stopped ? ' (TIME CAP: lower bound)' : ''} [${((Date.now() - t0) / 1000).toFixed(1)} s]`);
    }
  }
  for (const w of workers) w.terminate();
  const rep = {
    tool: 'tools/nullmodel_wordtuples.js', created: new Date().toISOString(), command: 'node ' + process.argv.slice(1).join(' '),
    cipher: { source: o.cipher, text, length: L, symbols: S }, wordList: { file: o.wordsFile, top: o.top || null, filterCorpus: o.filterCorpus || null, singleLetters: o.singleLetters, words: words.length, wordsUpToL: Object.values(lenHist).reduce((x, y) => x + y, 0), trieNodes: T.nodes, lengthHistogram: lenHist },
    results, seconds: (Date.now() - t0) / 1000,
  };
  if (o.out) {
    fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
    fs.writeFileSync(o.out, JSON.stringify(rep, null, 1));
  }
}
