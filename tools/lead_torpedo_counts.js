'use strict';
/**
 * tools/lead_torpedo_counts.js - step 2 counts for the real Z340 key, z13.circles_distinct reading:
 * how many of the 456,976 completions contain a bomb/explosive/weapon word or a word of the letter's own
 * vocabulary, counted two ways:
 *   seg: the word appears in the lm.wordSegment segmentation (what a reader would see);
 *   sub: the word appears anywhere as a substring.
 * by minimum word length (3, 4, 5, 7), for the bomb list, the letter list and their union.
 *
 *   node tools/lead_torpedo_counts.js > results/lead/torpedo/counts.json
 */
const T = require('./lead_torpedo_core');
const K = require('./keyprior_lib');

function main() {
  const th = T.themes();
  const pins = T.pinsFromKey(K.key('z340'));
  const bomb = th.lists.bomb, letter = th.lists.letter;
  const bombSet = new Set(bomb), letterSet = new Set(letter);
  const Ls = [3, 4, 5, 7];
  const c = {};
  for (const way of ['seg', 'sub']) for (const grp of ['bomb', 'letter', 'union']) for (const L of Ls) c[`${way}_${grp}_len${L}`] = 0;
  const codes = new Uint8Array(13);
  for (let i = 0; i < 13; i++) codes[i] = pins[i] === 255 ? 0 : pins[i];
  let n = 0;
  for (let a = 0; a < 26; a++) for (let b = 0; b < 26; b++) for (let x = 0; x < 26; x++) for (let d = 0; d < 26; d++) {
    codes[4] = a; codes[6] = b; codes[8] = x; codes[9] = d;
    const s = T.codesToString(codes);
    n++;
    const words = T.exact(s, false).words;
    for (const L of Ls) {
      const sb = words.some((w) => w.length >= L && bombSet.has(w));
      const sl = words.some((w) => w.length >= L && letterSet.has(w));
      if (sb) c[`seg_bomb_len${L}`]++;
      if (sl) c[`seg_letter_len${L}`]++;
      if (sb || sl) c[`seg_union_len${L}`]++;
      const ub = bomb.some((w) => w.length >= L && s.includes(w));
      const ul = letter.some((w) => w.length >= L && s.includes(w));
      if (ub) c[`sub_bomb_len${L}`]++;
      if (ul) c[`sub_letter_len${L}`]++;
      if (ub || ul) c[`sub_union_len${L}`]++;
    }
  }
  console.log(JSON.stringify({ tool: 'tools/lead_torpedo_counts.js', key: 'z340', variant: 'z13.circles_distinct', template: T.pinString(pins), completions: n, counts: c }, null, 1));
}

main();
