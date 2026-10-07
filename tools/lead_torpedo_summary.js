'use strict';
/**
 * tools/lead_torpedo_summary.js - p-values and tables for the `torpedo` task from
 * results/lead/torpedo/null.jsonl (tools/lead_torpedo_null.js) and real.json (tools/lead_torpedo_real.js).
 *
 *   node tools/lead_torpedo_summary.js            # writes results/lead/torpedo/summary.json, prints the tables
 *
 * Definitions fixed before the null results were read (see the task notes in summary.json):
 *   S_STRICT = -12.1784  exact word score of DREAM A TORPEDO (rank 3 of 456,976 for the real key)
 *   S_LOOSE  = -15.1442  exact word score of DR EAT A TORPEDO (rank 348)
 *   "notable as TORPEDO": a bomb/explosive/weapon word of >= 7 letters (TORPEDO has 7).
 *   striking (narrow): bomb >= 5 letters, letter-vocabulary >= 6, insult >= 5, place >= 5, case >= 5, full name.
 *   striking (broad):  bomb >= 4, letter >= 5, insult >= 4, place >= 4, case >= 4, first name >= 5, full name, zodiac >= 5.
 *   any7 (added after the first summary run, as a sensitivity check): a word of >= 7 letters from any list except surnames.
 * Every event is evaluated per null key; p = (count + 1) / (N + 1) for the real key's event and the
 * plain rate count / N for "how often" questions (both reported).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'results', 'lead', 'torpedo');
const S_STRICT = -12.1784;
const S_LOOSE = -15.1442;
const EPS = 1e-4;

const NARROW = { bomb: 5, letter: 6, insult: 5, place: 5, case: 5, fullname: 3 };
const BROAD = { bomb: 4, letter: 5, insult: 4, place: 4, case: 4, firstname: 5, fullname: 3, zodiac: 5 };

function load() {
  const i = process.argv.indexOf('--in');
  const f = i > 0 ? process.argv[i + 1] : path.join(DIR, 'null.jsonl');
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return rows;
}

/** best [rank, score] over a set of (category, minLen) requirements for one variant record */
function bestOf(rec, req) {
  let rank = 0, score = null;
  for (const [cat, L] of Object.entries(req)) {
    const Lk = Math.min(7, Math.max(3, L));
    const v = rec.cat[cat] && rec.cat[cat][Lk];
    if (!v || !v[0]) continue;
    if (!rank || v[0] < rank) rank = v[0];
    if (score === null || v[1] > score) score = v[1];
  }
  return [rank, score];
}

function evt(rec, req, crit) {
  const [rank, score] = bestOf(rec, req);
  if (!rank) return false;
  if (crit.score != null) return score >= crit.score - EPS;
  if (crit.rank != null) return rank <= crit.rank;
  return true;
}

function rate(rows, f) {
  let c = 0;
  for (const r of rows) if (f(r)) c++;
  return { count: c, n: rows.length, rate: c / rows.length, p: (c + 1) / (rows.length + 1), se: Math.sqrt((c / rows.length) * (1 - c / rows.length) / rows.length) };
}

function fmt(x) { return `${x.count}/${x.n} = ${x.rate.toFixed(4)}`; }

function main() {
  const rows = load();
  const real = rows.find((r) => r.kind === 'real');
  const kinds = ['permute', 'stratified'];
  const out = { tool: 'tools/lead_torpedo_summary.js', created: new Date().toISOString(), S_STRICT, S_LOOSE, NARROW, BROAD, real: { circles: { s1: real.c.s1, w1: real.c.w1, nS: real.c.nS, nL: real.c.nL, wfBest: real.c.wfBest, bomb: real.c.cat.bomb, ex: real.c.ex }, canonical: { s1: real.k.s1, w1: real.k.w1, wfBest: real.k.wfBest, ex: real.k.ex } }, byKind: {} };

  const crits = {
    'score>=DREAM_A_TORPEDO': { score: S_STRICT },
    'rank<=3': { rank: 3 },
    'rank<=10': { rank: 10 },
    'score>=DR_EAT_A_TORPEDO': { score: S_LOOSE },
    'rank<=348': { rank: 348 },
  };
  const events = {
    bomb7: { bomb: 7 }, bomb6: { bomb: 6 }, bomb5: { bomb: 5 }, bomb4: { bomb: 4 }, bomb3: { bomb: 3 },
    narrow: NARROW, broad: BROAD,
    any7: { bomb: 7, letter: 7, zodiac: 7, insult: 7, place: 7, case: 7, firstname: 7, fullname: 7 },
  };
  const cats = ['bomb', 'letter', 'zodiac', 'insult', 'place', 'case', 'firstname', 'surname', 'fullname'];

  for (const kind of kinds) {
    const R = rows.filter((r) => r.kind === kind);
    const K = {};
    K.n = R.length;
    K.cappedKeys = R.filter((r) => r.c.capped).length;
    K.maxGapObserved = Math.max(...R.map((r) => r.c.maxGap));
    // ---- fluency (replication of keyprior)
    K.fluency = {
      circles_fastBest_ge_real: rate(R, (r) => r.c.wfBest >= real.c.wfBest - 1e-9),
      circles_exactBest_ge_real: rate(R, (r) => r.c.s1 >= real.c.s1 - 1e-9),
      circles_any_ge_DREAM_A_TORPEDO: rate(R, (r) => r.c.nS >= 1),
      circles_three_ge_DREAM_A_TORPEDO: rate(R, (r) => r.c.nS >= 3),
      circles_any_ge_DR_EAT_A_TORPEDO: rate(R, (r) => r.c.nL >= 1),
      circles_348_ge_DR_EAT_A_TORPEDO: rate(R, (r) => r.c.nL >= 348),
      canonical_fastBest_ge_real: rate(R, (r) => r.k.wfBest >= real.k.wfBest - 1e-9),
      canonical_exactBest_ge_real: rate(R, (r) => r.k.s1 >= real.k.s1 - 1e-9),
    };
    // ---- theme events, circles
    K.circles = {};
    for (const [en, req] of Object.entries(events)) {
      K.circles[en] = {};
      for (const [cn, cr] of Object.entries(crits)) K.circles[en][cn] = rate(R, (r) => evt(r.c, req, cr));
    }
    K.circlesByCategory = {};
    for (const c of cats) {
      K.circlesByCategory[c] = {};
      for (const L of [3, 4, 5, 6, 7]) {
        K.circlesByCategory[c][L] = {};
        for (const [cn, cr] of Object.entries(crits)) K.circlesByCategory[c][L][cn] = rate(R, (r) => evt(r.c, { [c]: L }, cr)).rate;
      }
    }
    // ---- conditional content: among keys at least as fluent as the real one
    const fl1 = R.filter((r) => r.c.nS >= 1);
    const fl3 = R.filter((r) => r.c.nS >= 3);
    const flL = R.filter((r) => r.c.nL >= 1);
    K.conditional = {
      givenAnyCompletion_ge_DREAM_A_TORPEDO: { n: fl1.length, bomb7: rate(fl1, (r) => evt(r.c, events.bomb7, crits['score>=DREAM_A_TORPEDO'])), bomb5: rate(fl1, (r) => evt(r.c, events.bomb5, crits['score>=DREAM_A_TORPEDO'])), narrow: rate(fl1, (r) => evt(r.c, NARROW, crits['score>=DREAM_A_TORPEDO'])), broad: rate(fl1, (r) => evt(r.c, BROAD, crits['score>=DREAM_A_TORPEDO'])), narrowTop3: rate(fl1, (r) => evt(r.c, NARROW, crits['rank<=3'])) },
      givenThreeCompletions_ge_DREAM_A_TORPEDO: { n: fl3.length, narrow: fl3.length ? rate(fl3, (r) => evt(r.c, NARROW, crits['score>=DREAM_A_TORPEDO'])) : null, bomb7: fl3.length ? rate(fl3, (r) => evt(r.c, events.bomb7, crits['score>=DREAM_A_TORPEDO'])) : null },
      givenAnyCompletion_ge_DR_EAT_A_TORPEDO: { n: flL.length, bomb7_loose: rate(flL, (r) => evt(r.c, events.bomb7, crits['score>=DR_EAT_A_TORPEDO'])), narrow_loose: rate(flL, (r) => evt(r.c, NARROW, crits['score>=DR_EAT_A_TORPEDO'])) },
    };
    // ---- canonical (step 4)
    K.canonical = {};
    for (const [en, req] of Object.entries(events)) {
      K.canonical[en] = {};
      for (const [cn, cr] of Object.entries({ 'rank<=1': { rank: 1 }, 'rank<=3': { rank: 3 }, 'rank<=10': { rank: 10 }, 'score>=real_best(-14.461)': { score: real.k.s1 }, 'score>=DR_EAT_A_TORPEDO': { score: S_LOOSE } })) K.canonical[en][cn] = rate(R, (r) => evt(r.k, req, cr));
    }
    K.canonicalBestIsMoreFluent = rate(R, (r) => r.k.s1 > real.k.s1 + 1e-9);
    // ---- examples
    const ex = (sel, n) => sel.slice(0, n).map((r) => ({ i: r.i, pins: r.pins, best: r.c.w1, s1: r.c.s1, nS: r.c.nS, hits: Object.fromEntries(Object.entries(r.c.ex).filter(([k]) => !k.startsWith('zodiac')).slice(0, 6)) }));
    K.examples = {
      bomb7_at_DREAM_A_TORPEDO_fluency: ex(R.filter((r) => evt(r.c, events.bomb7, crits['score>=DREAM_A_TORPEDO'])), 20),
      bomb7_at_rank_le_3: ex(R.filter((r) => evt(r.c, events.bomb7, crits['rank<=3'])), 20),
      narrow_at_DREAM_A_TORPEDO_fluency: ex(R.filter((r) => evt(r.c, NARROW, crits['score>=DREAM_A_TORPEDO'])).sort((a, b) => b.c.s1 - a.c.s1), 25),
      most_fluent_keys: ex(R.slice().sort((a, b) => b.c.s1 - a.c.s1), 15),
      canonical_most_fluent: R.slice().sort((a, b) => b.k.s1 - a.k.s1).slice(0, 15).map((r) => ({ i: r.i, pins: r.pins, best: r.k.w1, s1: r.k.s1 })),
      canonical_narrow_top3: R.filter((r) => evt(r.k, NARROW, { rank: 3 })).slice(0, 20).map((r) => ({ i: r.i, pins: r.pins, best: r.k.w1, ex: Object.fromEntries(Object.entries(r.k.ex).filter(([k]) => !k.startsWith('zodiac'))) })),
    };
    // distinct bomb words >= 5 letters seen at DREAM A TORPEDO fluency, with counts
    const words = {};
    for (const r of R) for (const [k, v] of Object.entries(r.c.ex)) if (k.startsWith('bomb') && (k.endsWith('7') || k.endsWith('5')) && v[1] >= S_LOOSE - EPS) {
      const hitWords = v[2].split(' ');
      for (const w of hitWords) if (w.length >= 5) words[w] = (words[w] || 0) + 1;
    }
    K.bombWordsLen5PlusAtLooseFluency_firstHitPerKey = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 40);
    out.byKind[kind] = K;
  }
  // pooled
  const P = rows.filter((r) => r.kind !== 'real');
  out.pooled = {
    n: P.length,
    bomb7_scoreStrict: rate(P, (r) => evt(r.c, events.bomb7, crits['score>=DREAM_A_TORPEDO'])),
    bomb7_rank3: rate(P, (r) => evt(r.c, events.bomb7, crits['rank<=3'])),
    narrow_scoreStrict: rate(P, (r) => evt(r.c, NARROW, crits['score>=DREAM_A_TORPEDO'])),
    narrow_rank3: rate(P, (r) => evt(r.c, NARROW, crits['rank<=3'])),
    broad_rank3: rate(P, (r) => evt(r.c, BROAD, crits['rank<=3'])),
    broad_rank10: rate(P, (r) => evt(r.c, BROAD, crits['rank<=10'])),
    narrow_rank10: rate(P, (r) => evt(r.c, NARROW, crits['rank<=10'])),
    fluency_any_ge_strict: rate(P, (r) => r.c.nS >= 1),
  };
  // real-key events (sanity)
  out.realEvents = {};
  for (const [en, req] of Object.entries(events)) {
    out.realEvents[en] = {};
    for (const [cn, cr] of Object.entries(crits)) out.realEvents[en][cn] = evt(real.c, req, cr);
    out.realEvents[en].canonical_rank3 = evt(real.k, req, { rank: 3 });
  }
  // analyst's space of "striking" words: number of list words that the word model can segment
  const th = JSON.parse(fs.readFileSync(path.join(DIR, 'theme_lists.json'), 'utf8'));
  const vocab = new Set(fs.readFileSync(path.join(ROOT, 'data', 'lm', 'words_common.tsv'), 'latin1').split('\n').map((l) => l.split('\t')[0]));
  const space = (req) => {
    const s = new Set();
    for (const [c, L] of Object.entries(req)) if (th.lists[c]) for (const w of th.lists[c]) if (w.length >= L && vocab.has(w)) s.add(w);
    return s.size;
  };
  out.analystSpace = { narrowWords: space(NARROW), broadWords: space(BROAD), bomb7Words: space({ bomb: 7 }), bomb5Words: space({ bomb: 5 }), note: 'plus full names (first-name top 1000 followed by surname top 5000)' };
  const io = process.argv.indexOf('--out');
  fs.writeFileSync(io > 0 ? process.argv[io + 1] : path.join(DIR, 'summary.json'), JSON.stringify(out, null, 1));

  // ---- print
  for (const kind of kinds) {
    const K = out.byKind[kind];
    console.log(`\n=== ${kind} (N = ${K.n}; capped keys ${K.cappedKeys}; max exact-fast gap ${K.maxGapObserved})`);
    for (const [k, v] of Object.entries(K.fluency)) console.log(`fluency ${k}: ${fmt(v)}  p=${v.p.toFixed(4)}`);
    for (const [en, o] of Object.entries(K.circles)) console.log(`circles ${en}: ` + Object.entries(o).map(([cn, v]) => `${cn} ${fmt(v)}`).join(' | '));
    console.log('conditional', JSON.stringify(Object.fromEntries(Object.entries(K.conditional).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, b && b.count != null ? `${b.count}/${b.n}` : b]))]))));
    for (const [en, o] of Object.entries(K.canonical)) console.log(`canonical ${en}: ` + Object.entries(o).map(([cn, v]) => `${cn} ${fmt(v)}`).join(' | '));
    console.log(`canonical best more fluent than real: ${fmt(K.canonicalBestIsMoreFluent)}`);
    console.log('by category rank<=3 (L=3..7): ' + cats.map((c) => c + ' ' + [3, 4, 5, 6, 7].map((L) => K.circlesByCategory[c][L]['rank<=3'].toFixed(4)).join('/')).join('; '));
    console.log('by category score>=strict (L=3..7): ' + cats.map((c) => c + ' ' + [3, 4, 5, 6, 7].map((L) => K.circlesByCategory[c][L]['score>=DREAM_A_TORPEDO'].toFixed(4)).join('/')).join('; '));
  }
  console.log('\npooled', JSON.stringify(Object.fromEntries(Object.entries(out.pooled).map(([k, v]) => [k, v.count != null ? fmt(v) : v]))));
  console.log('realEvents', JSON.stringify(out.realEvents));
  console.log('analystSpace', JSON.stringify(out.analystSpace));
}

main();
