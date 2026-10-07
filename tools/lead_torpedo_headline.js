'use strict';
/**
 * tools/lead_torpedo_headline.js - collects the headline numbers of the `torpedo` task from the result
 * files into results/lead/torpedo/headline.json (no new computation except ratios and the union
 * approximation across readings, both printed with their inputs).
 *
 *   node tools/lead_torpedo_headline.js
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'results', 'lead', 'torpedo');
const J = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

function main() {
  const real = J('real.json'), sum = J('summary.json'), fit = J('fit.json'), two = J('twocircle.json'), keys = J('keys.json'), counts = J('counts.json');
  const z = real.keys.z340;
  const h = { tool: 'tools/lead_torpedo_headline.js', created: new Date().toISOString() };
  h.step2_real_circles = {
    completions: z.circles.completions,
    targets: Object.fromEntries(Object.entries(z.circles.targets).map(([k, v]) => [k, { words: v.words, word: +v.word.toFixed(3), ng6: +v.ng6.toFixed(3), rankWord: v.rankWord, rankNg6: v.rankNg6, rankFastUnigram: v.rankWf, rankMeanOfWordAndNg6: v.rankMeanOfWordAndNg6 }])),
    top10: z.circles.topByWord.slice(0, 10).map((c) => `${c.rankWord} ${c.words} (${c.word})`),
    bombOrLetterWordCounts: counts.counts,
    bombWordsLen4InTop10000: z.circles.bombWordLen4InTop10000.distinctWords,
    themedTop10: z.circles.strata.top10.byCategory.bomb,
  };
  h.step4_real_canonical = {
    top5: z.canonical.topByWord.slice(0, 5).map((c) => `${c.rankWord} ${c.words} (${c.word})`),
    garlickTOTPEDO: z.canonical.garlickTOTPEDO,
    themed: z.canonical.themed.map((t) => `${t.rankWord} ${t.words} ${t.hits}`),
    keyExtensionBest: z.canonical.keyExtensionJKQXZ[0],
  };
  h.step3 = {};
  for (const kind of ['permute', 'stratified']) {
    const K = sum.byKind[kind];
    const fl = K.fluency.circles_any_ge_DREAM_A_TORPEDO.rate;
    const nar = K.circles.narrow['score>=DREAM_A_TORPEDO'].rate;
    const b7 = K.circles.bomb7['score>=DREAM_A_TORPEDO'].rate;
    h.step3[kind] = {
      N: K.n,
      P_fluent_ge_DREAM_A_TORPEDO: fl,
      P_fluent_and_bomb7: b7,
      P_fluent_and_narrowStriking: nar,
      P_fluent_and_broadStriking: K.circles.broad['score>=DREAM_A_TORPEDO'].rate,
      P_bomb7_rank_le_3: K.circles.bomb7['rank<=3'].rate,
      P_narrow_rank_le_3: K.circles.narrow['rank<=3'].rate,
      P_broad_rank_le_3: K.circles.broad['rank<=3'].rate,
      P_narrow_rank_le_10: K.circles.narrow['rank<=10'].rate,
      P_bomb7_score_ge_DR_EAT_A_TORPEDO: K.circles.bomb7['score>=DR_EAT_A_TORPEDO'].rate,
      P_narrow_score_ge_DR_EAT_A_TORPEDO: K.circles.narrow['score>=DR_EAT_A_TORPEDO'].rate,
      conditional_narrow_given_fluent: K.conditional.givenAnyCompletion_ge_DREAM_A_TORPEDO.narrow,
      conditional_bomb7_given_fluent: K.conditional.givenAnyCompletion_ge_DREAM_A_TORPEDO.bomb7,
      contentFactor_narrow: fl > 0 ? +(fl / Math.max(nar, 1e-9)).toFixed(2) : null,
      templateAdmitsBomb7_circles: fit.kinds[kind].bomb7.rates.circlesExact,
      templateAdmitsBomb7_canonical_le1sub: fit.kinds[kind].bomb7.rates.canonicalLe1,
      templateAdmitsNarrow_circles: fit.kinds[kind].narrow.rates.circlesExact,
      torpedoAmongBomb7Fits: fit.kinds[kind].bomb7.circlesExactWordCounts.slice(0, 5),
      canonical_bestMoreFluentThanReal: K.canonicalBestIsMoreFluent.rate,
      canonical_narrow_rank_le_3: K.canonical.narrow['rank<=3'].rate,
      canonical_broad_rank_le_3: K.canonical.broad['rank<=3'].rate,
      twoCircleP46: two.stats[kind].P46,
    };
    // union across the five circle readings (canonical, three two-circle partitions, all distinct), narrow at rank <= 3,
    // assuming independence (an over-estimate when the events are positively correlated)
    const ps = [K.canonical.narrow['rank<=3'].rate, K.circles.narrow['rank<=3'].rate, two.stats[kind].P46.narrow_rank3.rate, two.stats[kind].P48.narrow_rank3.rate, two.stats[kind].P68.narrow_rank3.rate];
    h.step3[kind].unionFiveReadings_narrowRank3 = { inputs: ps, union: +(1 - ps.reduce((a, p) => a * (1 - p), 1)).toFixed(4) };
    const pb = [K.canonical.bomb7['rank<=3'].rate, K.circles.bomb7['rank<=3'].rate, two.stats[kind].P46.bomb7_rank3.rate, two.stats[kind].P48.bomb7_rank3.rate, two.stats[kind].P68.bomb7_rank3.rate];
    h.step3[kind].unionFiveReadings_bomb7Rank3 = { inputs: pb, union: +(1 - pb.reduce((a, p) => a * (1 - p), 1)).toFixed(4) };
  }
  h.analystSpace = sum.analystSpace;
  h.step5 = { glyphClasses: keys.glyphClasses, z408_vs_z340: keys.z408_vs_z340, newGlyphLetters: keys.dreamATorpedoNewGlyphLetters, reuseHomophoneChoiceP: keys.reuseHomophoneChoice.probabilityOfObservedGlyphClassPattern_uniformHomophone, multiplicity: keys.multiplicity };
  fs.writeFileSync(path.join(DIR, 'headline.json'), JSON.stringify(h, null, 1));
  console.log(JSON.stringify(h, null, 1));
}

main();
