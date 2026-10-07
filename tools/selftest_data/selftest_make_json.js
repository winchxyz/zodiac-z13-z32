'use strict';
// Build tools/selftest_data/z408_selftest.json and z340_untransposed_selftest.json
// from the files fetched from github.com/doranchak (URLs in sources.json in this folder).
const fs = require('fs');
const path = require('path');
const D = __dirname;
const rows = (f) => fs.readFileSync(path.join(D, f), 'latin1').replace(/\r/g, '').split('\n').filter(Boolean);
const z408 = {
  id: 'Z408-selftest',
  note: 'Self-test copy, not canonical. Ciphertext and aligned plaintext from github.com/doranchak/zodiac-cipher-key-visualizer (z408.txt, z408-pt.txt); index 105 is "!" as in the webtoy/CipherExplorer.',
  source_urls: [
    'https://raw.githubusercontent.com/doranchak/zodiac-cipher-key-visualizer/HEAD/z408.txt',
    'https://raw.githubusercontent.com/doranchak/zodiac-cipher-key-visualizer/HEAD/z408-pt.txt',
  ],
  rows: rows('viz_z408.txt'),
  ascii: rows('viz_z408.txt').join(''),
  plaintext_aligned: rows('viz_z408-pt.txt').join(''),
  plaintext_alt_azdecrypt: rows('az_Zodiac_408_solved.txt').join(''),
};
fs.writeFileSync(path.join(D, 'z408_selftest.json'), JSON.stringify(z408, null, 1));
const z340u = {
  id: 'Z340-untransposed-selftest',
  note: 'Self-test copy, not canonical: Z340 already put in reading order by Oranchak (z340-untransposed.txt) with its aligned plaintext (z340-untransposed-pt.txt), github.com/doranchak/zodiac-cipher-key-visualizer.',
  source_urls: [
    'https://raw.githubusercontent.com/doranchak/zodiac-cipher-key-visualizer/HEAD/z340-untransposed.txt',
    'https://raw.githubusercontent.com/doranchak/zodiac-cipher-key-visualizer/HEAD/z340-untransposed-pt.txt',
  ],
  rows: rows('viz_z340-untransposed.txt'),
  ascii: rows('viz_z340-untransposed.txt').join(''),
  plaintext_aligned: rows('viz_z340-untransposed-pt.txt').join(''),
};
fs.writeFileSync(path.join(D, 'z340_untransposed_selftest.json'), JSON.stringify(z340u, null, 1));
console.log('wrote', z408.ascii.length, z340u.ascii.length);
