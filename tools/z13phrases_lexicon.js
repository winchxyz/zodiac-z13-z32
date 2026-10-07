'use strict';
/**
 * tools/z13phrases_lexicon.js - word lists for categorising Z13 fits:
 *   results/z13phrases/theme_words.txt  Zodiac-themed words: a curated hand list of topical words
 *       (killing, death, weapons, bombs, police, the crime sites, the letters' specific references).
 *   results/z13phrases/plaintext_vocab.txt  every word of 4+ letters in the Z408 and Z340 plaintexts
 *       (segmented with lm.wordSegment; sorted alphabetically, the plaintexts are never printed)
 *       that is not among the 300 most common English words; a weaker, generic-heavy list.
 *   results/z13phrases/name_tokens.tsv  name-like tokens: first names (SSA, data/names/first_all.tsv)
 *       and surnames (top 50,000 of data/names/surnames.tsv) of 3+ letters that are NOT among the
 *       5,000 most common words of data/lm/words_common.tsv.
 *   node tools/z13phrases_lexicon.js
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');
const C = require('./cipher');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'results', 'z13phrases');

const HAND = `
ZODIAC CIPHER CIPHERS CRYPTOGRAM
KILL KILLS KILLED KILLER KILLERS KILLING KILLINGS MURDER MURDERS MURDERED MURDERER DEATH DEATHS DEAD DIE DIED DIES DYING
SLAVE SLAVES SLAVERY PARADISE PARADICE AFTERLIFE VICTIM VICTIMS
GUN GUNS KNIFE KNIVES BLOOD BLOODY SHOOT BULLET BULLETS PISTOL RIFLE
BOMB BOMBS BOMBING DYNAMITE TORPEDO
COP COPS POLICE PIG PIGS MEANIE MEANIES SFPD DETECTIVE TOSCHI ARMSTRONG
HUNT HUNTER HUNTING ANIMAL ANIMALS DANGEROUS
HELL DEVIL SATAN DEMON EVIL HATE FEAR TERROR SCREAM SKULL
CHRONICLE EXAMINER REWARD MARSH HARDEN
VALLEJO BENICIA BERRYESSA NAPA RIVERSIDE PRESIDIO HERMAN DIABLO RADIAN RADIANS
MIKADO TITWILLOW EXORCIST STINE CABBIE
`;

function main() {
  const theme = new Set(HAND.split(/\s+/).filter(Boolean));
  const V = lm.vocab('common');
  const common300 = new Set(V.words.slice(0, 300));
  let fromPlain = 0;
  const plainVocab = new Set();
  for (const f of ['z408.json', 'z340.json']) {
    const ci = C.loadCipher(path.join(ROOT, 'data', 'ciphers', f));
    const pt = (ci.plaintextReadOrder || ci.plaintext || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!pt) { console.log(`${f}: no plaintext found`); continue; }
    // segment in chunks of 60 letters with 20 letters of overlap handled by segmenting whole text
    const ws = lm.wordSegment(pt, { vocab: 'common', maxUnknownLen: 20 });
    for (const w of ws.words) if (w.length >= 4 && !common300.has(w) && V.map.has(w)) { if (!theme.has(w) && !plainVocab.has(w)) fromPlain++; plainVocab.add(w); }
  }
  const list = Array.from(theme).sort();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'theme_words.txt'), list.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'plaintext_vocab.txt'), Array.from(plainVocab).sort().join('\n') + '\n');
  // names
  const rankOf = new Map(V.words.map((w, i) => [w, i]));
  const readNames = (file, top) => {
    const lines = fs.readFileSync(file, 'latin1').split('\n').filter(Boolean).slice(0, top || undefined);
    return lines.map((l) => { const [w, v] = l.split('\t'); return [w.trim().toUpperCase(), +v]; });
  };
  const first = readNames(path.join(ROOT, 'data', 'names', 'first_all.tsv'));
  const sur = readNames(path.join(ROOT, 'data', 'names', 'surnames.tsv'), 50000);
  const names = new Map();
  for (const [w, v] of first) if (w.length >= 3 && /^[A-Z]+$/.test(w) && !((rankOf.get(w) ?? 1e9) < 5000)) names.set(w, { first: v, sur: 0 });
  for (const [w, v] of sur) if (w.length >= 3 && /^[A-Z]+$/.test(w) && !((rankOf.get(w) ?? 1e9) < 5000)) { const e = names.get(w) || { first: 0, sur: 0 }; e.sur = v; names.set(w, e); }
  const rows = ['token\tfirstWeight\tsurnameWeight\tcommonRank'];
  for (const [w, e] of Array.from(names).sort()) rows.push(`${w}\t${e.first}\t${e.sur}\t${rankOf.has(w) ? rankOf.get(w) : ''}`);
  fs.writeFileSync(path.join(OUT, 'name_tokens.tsv'), rows.join('\n') + '\n');
  console.log(JSON.stringify({ themeWords: list.length, handList: HAND.split(/\s+/).filter(Boolean).length, plaintextVocab: plainVocab.size, nameTokens: names.size }));
}

main();
