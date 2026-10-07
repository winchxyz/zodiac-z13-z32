#!/usr/bin/env node
'use strict';
/**
 * tools/z32search_grammar.js - exhaustive count / listing of structured "number RADIANS number INCHES"
 * messages (grammar in tools/z32search_grammar_lib.js) that fit Z32 under homophonic substitution,
 * with a null model.
 *
 * Under homophonic substitution a 32-letter string fits Z32 iff it satisfies the equalities of the
 * repeated symbols (written order: p0=p25, p1=p31, p5=p13).  For every grammar form we count the
 * derivations (token sequences) of exactly 32 letters (a) in total, (b) satisfying Z32's equalities,
 * (c) satisfying each read order's equalities, and (d) satisfying uniformly random 3-pair patterns
 * (the null; worker threads).  Counting is an exact dynamic programme (tools/z32search_grammar_count.js);
 * Z32's fits are also listed (distinct letter strings) and scored with lm.wordSegment.
 *
 *   node tools/run_slot.js --label z32search -- node tools/z32search_grammar.js [--null 408] [--threads 4]
 *        [--seed 9] [--detail-orders skip19] [--out results/z32search/grammar/grammar.json]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const G = require('./z32search_grammar_lib');
const E = require('./z32search_grammar_count');

if (!isMainThread) {
  const F = E.prepForms(G.forms());
  const out = workerData.patterns.map((p) => F.map((f) => E.countForm(f, p)));
  parentPort.postMessage(out);
  return;
}

const Z = require('./z32search_lib');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const NNULL = +opt('null', 408);
const SEED = +opt('seed', 9);
const THREADS = +opt('threads', 4);
const OUT = opt('out', path.join(Z.ROOT, 'results', 'z32search', 'grammar', 'grammar.json'));

function countParallel(patterns) {
  const chunks = [];
  const per = Math.ceil(patterns.length / THREADS);
  for (let i = 0; i < patterns.length; i += per) chunks.push(patterns.slice(i, i + per));
  return Promise.all(chunks.map((ch) => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { patterns: ch } });
    w.on('message', res); w.on('error', rej);
  }))).then((parts) => parts.flat());
}

async function main() {
  const t0 = Date.now();
  const FORMS = E.prepForms(G.forms());
  const z32 = Z.z32Text('canonical');
  const z32pairs = Z.pairsOf(z32);
  const ordSel = opt('orders', '');
  const ORD = ordSel ? Z.readOrders().filter((o) => ordSel.split(',').includes(o.id)) : Z.readOrders();
  const rng = Z.makeRng(SEED, 4242);
  const nullPatterns = [];
  for (let t = 0; t < NNULL; t++) nullPatterns.push(Z.randomPairs(rng));
  const ordPatterns = ORD.map((o) => Z.pairsOf(Z.applyOrder(z32, o.order)));
  const all = [[], z32pairs, ...ordPatterns, ...nullPatterns];
  const counts = await countParallel(all);
  const totalPerForm = counts[0], z32PerForm = counts[1];
  const ordCounts = counts.slice(2, 2 + ORD.length);
  const nullCounts = counts.slice(2 + ORD.length);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const nullTotals = nullCounts.map(sum);
  const res = {
    tool: 'tools/z32search_grammar.js', created: new Date().toISOString(),
    grammar: { leads: G.LEADS, seps: G.SEPS, tails: G.TAILS, radianUnits: G.RUNITS, inchUnits: G.IUNITS, numberPhrases: G.numbers().length, fractionSuffixes: G.fractionSuffixes(), bareFractions: G.bareFractions(), note: 'counts are derivations (token sequences of exactly 32 letters); distinct letter strings are counted separately for Z32' },
    forms: [], orders: [], null: {},
  };
  FORMS.forEach((f, i) => {
    const nulls = nullCounts.map((c) => c[i]);
    const fit = z32PerForm[i];
    res.forms.push({ id: f.id, desc: f.desc, derivationsOfLength32: totalPerForm[i], fitZ32: fit, oneIn: totalPerForm[i] / fit, nullQuantiles: Z.quantiles(nulls), nullMeanSd: Z.meanSd(nulls), nullPgeZ32: nulls.filter((c) => c >= fit).length / NNULL });
  });
  const allTotal = sum(totalPerForm), z32Total = sum(z32PerForm);
  res.totals = { derivationsOfLength32: allTotal, fitZ32: z32Total, oneIn: allTotal / z32Total };
  res.null = { patterns: NNULL, kind: 'uniformly random 3 disjoint position pairs', totalQuantiles: Z.quantiles(nullTotals), totalMeanSd: Z.meanSd(nullTotals), PgeZ32: nullTotals.filter((c) => c >= z32Total).length / NNULL };
  for (const f of res.forms) console.log(`${f.id.padEnd(40)} total ${String(f.derivationsOfLength32).padStart(11)}  Z32 ${String(f.fitZ32).padStart(8)}  null median ${f.nullQuantiles[0.5]}  P(null>=Z32) ${f.nullPgeZ32.toFixed(3)}`);
  console.log(`ALL forms: ${allTotal} derivations; Z32 ${z32Total} (1 in ${res.totals.oneIn.toFixed(0)}); null quantiles ${JSON.stringify(res.null.totalQuantiles)}; P(null>=Z32) ${res.null.PgeZ32.toFixed(3)}  [${((Date.now() - t0) / 1000).toFixed(1)} s]`);
  ORD.forEach((o, i) => {
    const c = sum(ordCounts[i]);
    res.orders.push({ id: o.id, family: o.family, pairs: ordPatterns[i], fits: c, perForm: ordCounts[i], PnullGe: nullTotals.filter((x) => x >= c).length / NNULL });
  });
  res.orders.sort((a, b) => b.fits - a.fits);
  const nOrd = ORD.length;
  const maxes = [];
  for (let b = 0; b + nOrd <= NNULL; b += nOrd) maxes.push(Math.max(...nullTotals.slice(b, b + nOrd)));
  res.lookElsewhere = { orders: nOrd, bestOrder: res.orders[0].id, bestFits: res.orders[0].fits, nullMaxOfBlock: maxes, PmaxGe: maxes.length ? maxes.filter((m) => m >= res.orders[0].fits).length / maxes.length : null, note: `each null value is the maximum over a block of ${nOrd} random 3-pair patterns (as many as read orders tested)` };
  console.log('read orders by grammar fits:');
  for (const o of res.orders) console.log(`  ${o.id.padEnd(22)} ${String(o.fits).padStart(9)}  P(null>=) ${o.PnullGe.toFixed(3)}  ${JSON.stringify(o.pairs)}`);
  console.log(`look-elsewhere: best ${res.orders[0].id} ${res.orders[0].fits}; max over blocks of ${nOrd} random patterns: ${JSON.stringify(maxes)}`);

  // list Z32's fits and score them
  const lm = require('./lm');
  const fits = new Map();
  let derivs = 0;
  // --list-integers: list only derivations whose numbers are plain cardinals (a much smaller grammar)
  const LF = args.includes('--list-integers') ? E.prepForms(G.forms().map((fm) => Object.assign({}, fm, { slots: fm.slots.map((sl) => (sl.name === 'NUM' ? Object.assign({}, sl, { items: sl.items.filter((it) => it.kind === 'cardinal') }) : sl)) }))) : FORMS;
  const perForm = +opt('list-per-form', 5000000);
  for (const f of LF) derivs += E.listFits(f, z32pairs, fits, fits.size + perForm);
  const scored = [];
  for (const [s, ex] of fits) {
    const ws = lm.wordSegment(s, { vocab: 'common' });
    scored.push({ letters: s, tokens: ex.tokens, form: ex.form, wordLogp: ws.logp });
  }
  scored.sort((a, b) => b.wordLogp - a.wordLogp);
  const isInt = (t) => !/(HALF|QUARTER|THIRD|EIGHTH|SIXTEENTH|TENTH|POINT)/.test(t);
  const intOnly = scored.filter((x) => isInt(x.tokens));
  const plainUnits = intOnly.filter((x) => / (RADIANS?|INCH|INCHES)( |$)/.test(' ' + x.tokens + ' ') && /RADIAN/.test(x.tokens) && /INCH/.test(x.tokens));
  res.z32List = { listing: perForm < 5000000 ? `partial: first ${perForm} distinct strings per form in depth-first order${args.includes('--list-integers') ? ', cardinal numbers only' : ''}` : 'complete', derivations: derivs, distinctStrings: fits.size, integerOnly: intOnly.length, integerOnlyFullUnitWords: plainUnits.length, top: scored.slice(0, 150), integerOnlyTop: intOnly.slice(0, 150), integerOnlyFullUnitWordsTop: plainUnits.slice(0, 150) };
  console.log(`Z32: ${derivs} derivations, ${fits.size} distinct strings; integer numbers only ${intOnly.length}; integer and full unit words (RADIAN(S), INCH(ES)) ${plainUnits.length}`);
  for (const x of plainUnits.slice(0, 30)) console.log(`  ${x.wordLogp.toFixed(2)}  ${x.tokens}`);
  // detail for selected orders
  const detailIds = String(opt('detail-orders', '')).split(',').filter(Boolean);
  res.orderDetail = {};
  for (const id of detailIds) {
    const o = ORD.find((x) => x.id === id);
    if (!o) continue;
    const pairs = Z.pairsOf(Z.applyOrder(z32, o.order));
    const m = new Map();
    for (const f of FORMS) E.listFits(f, pairs, m, 3000000);
    const firstTok = new Map();
    for (const [, ex] of m) { const ft = ex.tokens.split(' ').slice(0, 2).join(' '); firstTok.set(ft, (firstTok.get(ft) || 0) + 1); }
    const top = [...firstTok].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const sample = [...m].filter(([, ex]) => isInt(ex.tokens)).slice(0, 4000).map(([s, ex]) => ({ tokens: ex.tokens, wordLogp: lm.wordSegment(s).logp })).sort((a, b) => b.wordLogp - a.wordLogp).slice(0, 30);
    res.orderDetail[id] = { pairs, distinctStrings: m.size, topFirstTwoTokens: top, integerOnlySampleTop: sample };
    console.log(`detail ${id} ${JSON.stringify(pairs)}: ${m.size} distinct; leading tokens ${JSON.stringify(top.slice(0, 8))}`);
  }
  const pub = {
    'Grinell 2020 / InStepWithTheStars': 'ESTIMATE FOUR RADIANS AND FIVE INCHES',
    'DMW 2019 / Stampher 2026': 'IN THREE AND THREE EIGHTHS RADIANS TEN',
    'Cragle 2022': 'THREE RADIANS FROM MOUNT AREA TWO INCH',
    'Foxon 2023 candidate (needs his transposition)': 'TWELVE INCHES ALONG THE THREE RADIANS',
  };
  res.published = {};
  for (const [who, p] of Object.entries(pub)) {
    const s = G.letters(p);
    res.published[who] = { text: p, length: s.length, fitsZ32: s.length === 32 && Z.satisfies(s, z32pairs), generatedByGrammar: fits.has(s) };
  }
  console.log('published:', JSON.stringify(res.published));
  res.timeSeconds = (Date.now() - t0) / 1000;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log(`wrote ${path.relative(Z.ROOT, OUT)} in ${res.timeSeconds.toFixed(1)} s`);
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
