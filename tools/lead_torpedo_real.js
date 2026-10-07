'use strict';
/**
 * tools/lead_torpedo_real.js - step 2 and step 4 of the `torpedo` task for the REAL keys.
 *
 * For the Z340 key (and the Z408 key as a side comparison) scores EVERY completion of Z13:
 *   circles   (z13.circles_distinct): 26^4 = 456,976 completions, letters at 4, 6, 8, 9 free;
 *   canonical (one circle symbol):    26^2 = 676 completions.
 * Scores: lm.wordSegment logp (word bigram model, common vocabulary), lm.ngram6Score logp (6-gram
 * Markov), and the fast unigram word score of tools/wordfast.js (the prefilter used by the null runs).
 * Reports the ranks of DREAM A TORPEDO, DR EAT A TORPEDO and Garlick's DR EAT A TOTPEDO, the top lists,
 * theme-word counts by fluency stratum, the prefilter calibration and the "key extension" check
 * (new glyphs restricted to letters the Z340 key has no symbol for: J K Q X Z).
 *
 *   node tools/lead_torpedo_real.js --out results/lead/torpedo/real.json [--tsv results/lead/torpedo/real_circles_z340_top20000.tsv]
 */
const fs = require('fs');
const path = require('path');
const T = require('./lead_torpedo_core');
const K = require('./keyprior_lib');
const WF = require('./wordfast');
const lm = require('./lm');

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }

function rankBy(arr, key) {
  const order = Array.from(arr.keys()).sort((a, b) => arr[b][key] - arr[a][key]);
  const r = new Int32Array(arr.length);
  order.forEach((i, k) => { r[i] = k + 1; });
  return { order, r };
}

function stratCounts(all, wordRank, th) {
  // counts of completions whose segmentation contains a theme word (any length / len >= 5 / len >= 7), by stratum
  const strata = [['top10', 10], ['top100', 100], ['top1000', 1000], ['top10000', 10000], ['all', Infinity]];
  const out = {};
  for (const [name, R] of strata) {
    const c = {};
    for (const cat of T.CATS) c[cat] = { any: 0, len5: 0, len7: 0, examples: [] };
    let nIn = 0;
    for (let i = 0; i < all.length; i++) {
      if (wordRank[i] > R) continue;
      nIn++;
      const hits = T.hitsOf(all[i].words, th);
      const seen = new Set();
      for (const h of hits) {
        const k = h.cat;
        const cc = c[k];
        if (!seen.has(k)) { cc.any++; seen.add(k); }
        if (h.len >= 5 && !seen.has(k + '5')) { cc.len5++; seen.add(k + '5'); }
        if (h.len >= 7 && !seen.has(k + '7')) { cc.len7++; seen.add(k + '7'); }
      }
    }
    for (const cat of T.CATS) delete c[cat].examples;
    out[name] = { completions: nIn, byCategory: c };
  }
  return out;
}

function substringCounts(all, words) {
  const res = {};
  for (const w of words) {
    let n = 0;
    for (const c of all) if (c.str.includes(w)) n++;
    if (n) res[w] = n;
  }
  return res;
}

function main() {
  const t0 = Date.now();
  const F = WF.build('common');
  const th = T.themes();
  const out = { tool: 'tools/lead_torpedo_real.js', created: new Date().toISOString(), keys: {} };
  const targets = { DREAMATORPEDO: 'DREAM A TORPEDO', DREATATORPEDO: 'DR EAT A TORPEDO (circles: 4=T 6=T 8=R 9=P)', DREATATOTPEDO: "Garlick's published letters DR EAT A TOTPEDO (circle=T, '['=P)" };
  for (const kn of ['z340', 'z408']) {
    const km = K.key(kn);
    const pins = T.pinsFromKey(km);
    const res = { pins: T.pinString(pins) };
    // ---------------- circles: every completion
    const all = [];
    const codes = new Uint8Array(13);
    for (let i = 0; i < 13; i++) codes[i] = pins[i] === 255 ? 0 : pins[i];
    for (let a = 0; a < 26; a++) for (let b = 0; b < 26; b++) for (let c = 0; c < 26; c++) for (let d = 0; d < 26; d++) {
      codes[4] = a; codes[6] = b; codes[8] = c; codes[9] = d;
      const str = T.codesToString(codes);
      const ex = T.exact(str, true);
      all.push({ str, word: ex.word, ng6: ex.ng6, wf: WF.logpCodes(F, codes, 13), words: ex.words, unknown: ex.unknown.length });
    }
    const rw = rankBy(all, 'word'), rn = rankBy(all, 'ng6'), rf = rankBy(all, 'wf');
    const meanRank = all.map((_, i) => (rw.r[i] + rn.r[i]) / 2);
    const rm = Array.from(all.keys()).sort((x, y) => meanRank[x] - meanRank[y]);
    const rmR = new Int32Array(all.length); rm.forEach((i, k) => { rmR[i] = k + 1; });
    const idxOf = new Map(all.map((c, i) => [c.str, i]));
    const tgt = {};
    for (const [s, label] of Object.entries(targets)) {
      if (kn !== 'z340') break;
      const i = idxOf.get(s);
      const c = all[i];
      tgt[s] = { label, words: c.words.join(' '), word: c.word, ng6: c.ng6, wf: c.wf, rankWord: rw.r[i], rankNg6: rn.r[i], rankWf: rf.r[i], rankMeanOfWordAndNg6: rmR[i],
        completionsWithHigherWordScore: rw.r[i] - 1, fractionWordAtLeast: rw.r[i] / all.length, hits: T.hitsOf(c.words, th) };
    }
    const fmt = (i) => ({ str: all[i].str, words: all[i].words.join(' '), word: +all[i].word.toFixed(3), ng6: +all[i].ng6.toFixed(3), rankWord: rw.r[i], rankNg6: rn.r[i] });
    res.circles = {
      completions: all.length,
      targets: tgt,
      topByWord: rw.order.slice(0, 60).map(fmt),
      topByNg6: rn.order.slice(0, 30).map(fmt),
      topByMeanRank: rm.slice(0, 30).map(fmt),
      wordScoreQuantiles: [1, 10, 100, 1000, 10000, 100000].map((r) => ({ rank: r, word: +all[rw.order[r - 1]].word.toFixed(3) })),
      strata: stratCounts(all, rw.r, th),
      bombSubstringCounts: substringCounts(all, th.lists.bomb.filter((w) => w.length >= 4)),
      letterSubstringCounts: substringCounts(all, th.lists.letter.filter((w) => w.length >= 4)),
    };
    // theme hits among the top 200 by word score, listed
    const themed = [];
    for (let k = 0; k < all.length && themed.length < 400; k++) {
      const i = rw.order[k];
      if (k >= 2000) break;
      const h = T.hitsOf(all[i].words, th).filter((x) => x.cat !== 'zodiac');
      if (h.length) themed.push(Object.assign(fmt(i), { hits: h.map((x) => x.cat + ':' + x.word).join(',') }));
    }
    res.circles.themedInTop2000 = themed;
    // bomb-word hits (any length >= 4) in the top 10000 by word score
    const bombTop = [];
    for (let k = 0; k < 10000; k++) {
      const i = rw.order[k];
      const h = T.hitsOf(all[i].words, th).filter((x) => x.cat === 'bomb' && x.len >= 4);
      if (h.length) bombTop.push(Object.assign(fmt(i), { bomb: h.map((x) => x.word).join(',') }));
    }
    res.circles.bombWordLen4InTop10000 = { n: bombTop.length, first50: bombTop.slice(0, 50), distinctWords: [...new Set(bombTop.map((b) => b.bomb))] };
    // prefilter calibration: is the exact top-N inside the fast-unigram top 4000?
    const calib = {};
    for (const N of [10, 100, 500, 1000, 2000]) {
      let worst = 0;
      for (let k = 0; k < N; k++) worst = Math.max(worst, rf.r[rw.order[k]]);
      calib['exactTop' + N] = { worstFastRank: worst, insideTop4000: worst <= 4000 };
    }
    // largest exact-word rank captured completely by the fast top 4000
    let full = 0;
    for (let k = 0; k < all.length; k++) { if (rf.r[rw.order[k]] > 4000) break; full = k + 1; }
    calib.exactRanksFullyCoveredByFastTop4000 = full;
    calib.exactScoreAtThatRank = +all[rw.order[Math.max(0, full - 1)]].word.toFixed(3);
    calib.fastScoreOf4000th = +all[rf.order[3999]].wf.toFixed(3);
    res.circles.prefilterCalibration = calib;
    // key extension: free letters restricted to J K Q X Z (letters with no Z340 symbol)
    if (kn === 'z340') {
      const ext = all.filter((c) => [4, 6, 8, 9].every((p) => 'JKQXZ'.includes(c.str[p]))).sort((a, b) => b.word - a.word);
      res.circles.keyExtensionJKQXZ = { completions: ext.length, top10: ext.slice(0, 10).map((c) => ({ str: c.str, words: c.words.join(' '), word: +c.word.toFixed(3), rankWord: rw.r[idxOf.get(c.str)] })) };
    }
    const tsv = arg('tsv');
    if (tsv && kn === 'z340') {
      const lines = ['rank_word\tstring\tsegmentation\tword_logp\tng6_logp\tfast_unigram\trank_ng6'];
      for (let k = 0; k < 20000; k++) { const i = rw.order[k]; lines.push([k + 1, all[i].str, all[i].words.join(' '), all[i].word.toFixed(4), all[i].ng6.toFixed(4), all[i].wf.toFixed(4), rn.r[i]].join('\t')); }
      fs.writeFileSync(path.join(T.ROOT, tsv), lines.join('\n') + '\n');
    }
    // ---------------- canonical: 676 completions
    const can = [];
    for (let x = 0; x < 26; x++) for (let y = 0; y < 26; y++) {
      const str = T.canonicalString(pins, x, y);
      const ex = T.exact(str, true);
      can.push({ str, word: ex.word, ng6: ex.ng6, words: ex.words, circle: T.LETTERS[x], hook: T.LETTERS[y] });
    }
    const cw = rankBy(can, 'word'), cn = rankBy(can, 'ng6');
    const cfmt = (i) => ({ str: can[i].str, circle: can[i].circle, hook: can[i].hook, words: can[i].words.join(' '), word: +can[i].word.toFixed(3), ng6: +can[i].ng6.toFixed(3), rankWord: cw.r[i], rankNg6: cn.r[i] });
    const canThemed = [];
    for (let k = 0; k < can.length; k++) {
      const i = cw.order[k];
      const h = T.hitsOf(can[i].words, th).filter((x) => x.cat !== 'zodiac');
      if (h.length) canThemed.push(Object.assign(cfmt(i), { hits: h.map((x) => x.cat + ':' + x.word).join(',') }));
    }
    res.canonical = {
      completions: can.length,
      topByWord: cw.order.slice(0, 40).map(cfmt),
      topByNg6: cn.order.slice(0, 20).map(cfmt),
      themed: canThemed,
      garlickTOTPEDO: kn === 'z340' ? cfmt(can.findIndex((c) => c.str === 'DREATATOTPEDO')) : undefined,
      keyExtensionJKQXZ: kn === 'z340' ? can.filter((c) => 'JKQXZ'.includes(c.circle) && 'JKQXZ'.includes(c.hook)).sort((a, b) => b.word - a.word).slice(0, 5).map((c) => cfmt(can.indexOf(c))) : undefined,
    };
    out.keys[kn] = res;
    console.error(`${kn}: done at ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  out.seconds = (Date.now() - t0) / 1000;
  K.writeJSON(arg('out', 'results/lead/torpedo/real.json'), out);
  const z = out.keys.z340;
  console.log('targets', JSON.stringify(z.circles.targets, null, 1));
  console.log('top by word', z.circles.topByWord.slice(0, 25).map((c) => `${c.rankWord} ${c.words} ${c.word} ng6r=${c.rankNg6}`).join('\n'));
  console.log('calib', JSON.stringify(z.circles.prefilterCalibration));
  console.log('canonical top', z.canonical.topByWord.slice(0, 15).map((c) => `${c.rankWord} ${c.words} ${c.word} ng6r=${c.rankNg6}`).join('\n'));
  console.log('canonical TOTPEDO', JSON.stringify(z.canonical.garlickTOTPEDO));
}

main();
