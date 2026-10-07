'use strict';
/**
 * tools/z13names_run.js - driver for the z13names enumeration grid.
 *
 * For every Z13 transcription variant x substitution mode x name list it runs
 * tools/z13names_enumerate.js names (0-2 filler letters at the ends of the
 * name, --filler-at ends --fillers 2; 0 fillers for circles_distinct and bracket_is_perp, see
 * VARIANTS) in --agg mode and writes
 *   results/z13names/runs/<variant>.<mode>.<list>.json   (counts and per-cell aggregates for 0-2 fillers,
 *                                                         top 1000 0-filler fits by weight)
 *   results/z13names/runs/<variant>.<mode>.<list>.tsv.gz (every 0-filler fit: plaintext, weight, pattern, parts, fillers)
 * For z13.crosshair_null the cells also count fits with a name-part boundary at position 3
 * (the crosshair read as a word divider: AEN | 0K0M0[NAM).
 *
 * Usage (inside a slot):
 *   node tools/run_slot.js --label z13names -- node tools/z13names_run.js [--threads 4] [--only canonical] [--lists male,female,nick_male,nick_female] [--modes simple,homophonic] [--force]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'results', 'z13names', 'runs');

const VARIANTS = [
  { id: 'z13.canonical', file: 'data/ciphers/variants/z13.canonical.txt', fillers: 2 },
  // circles_distinct has ~190x (homophonic) / ~60x (simple) more fits per name than canonical, so
  // its 1-2 filler cells (billions of fits) are estimated by Monte Carlo (tools/z13names_mc.js)
  // and its full 0-filler enumeration is also too large (a 2-thread FL+FIL+LF test did not finish in
  // 2 minutes), so only fits with prior weight >= 1e-10 are enumerated (exact heavy tail for the
  // posterior); fractions come from the Monte Carlo
  { id: 'z13.circles_distinct', file: 'data/ciphers/variants/z13.circles_distinct.txt', fillers: 0, minWeight: 1e-10 },
  { id: 'z13.crosshair_null', file: 'data/ciphers/variants/z13.crosshair_null.txt', boundary: 3, fillers: 2 },
  // same isomorph as canonical and no pins: the search is identical by construction; run with
  // 0 fillers to confirm the identity, the 1-2 filler cells equal canonical's
  { id: 'z13.bracket_is_perp', file: 'data/ciphers/variants/z13.bracket_is_perp.txt', fillers: 0 },
  { id: 'z13.reversed', file: 'data/ciphers/variants/z13.reversed.txt', fillers: 2 },
  { id: 'z13.letters_literal', file: 'data/ciphers/variants/z13.canonical.txt', pin: 'A=A,E=E,N=N,K=K,M=M', fillers: 2 },
];
const LISTS = {
  male: { first: 'data/names/first_male.tsv', patterns: 'FL,FIL,FML,FIIL,IIL,LF' },
  female: { first: 'data/names/first_female.tsv', patterns: 'FL,FIL,FML,FIIL,IIL,LF' },
  nick_male: { first: 'results/z13names/lists/nick_male.tsv', init: 'data/names/first_male.tsv', patterns: 'FL,FIL' },
  nick_female: { first: 'results/z13names/lists/nick_female.tsv', init: 'data/names/first_female.tsv', patterns: 'FL,FIL' },
};

function opts(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') o.force = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
  }
  return o;
}

function main() {
  const o = opts(process.argv.slice(2));
  const threads = +o.threads || 4;
  const only = o.only ? o.only.split(',') : null;
  const lists = (o.lists || 'male,female,nick_male,nick_female').split(',');
  const modes = (o.modes || 'simple,homophonic').split(',');
  fs.mkdirSync(OUT, { recursive: true });
  const log = [];
  for (const v of VARIANTS) {
    if (only && !only.some((s) => v.id.endsWith(s))) continue;
    for (const mode of modes) for (const ln of lists) {
      const L = LISTS[ln];
      const tag = `${v.id}.${mode}.${ln}`;
      const json = path.join(OUT, tag + '.json');
      const tsv = path.join(OUT, tag + '.tsv');
      if (!o.force && fs.existsSync(json) && (v.noStream || fs.existsSync(tsv + '.gz'))) { console.log(`skip ${tag} (exists)`); continue; }
      const args = [path.join(ROOT, 'tools', 'z13names_enumerate.js'), 'names', '--cipher', v.file, '--mode', mode,
        '--patterns', L.patterns, '--first-file', L.first, '--fillers', String(v.fillers), '--filler-at', 'ends',
        '--threads', String(threads), '--max-seconds', '1500', '--top', '1000', '--show', '0', '--out', json,
        '--agg', '--agg-top', '20'];
      if (v.noStream) args.push('--stream-max-fillers', '-1'); else args.push('--stream', tsv, '--stream-max-fillers', '0');
      if (v.minWeight) args.push('--min-weight', String(v.minWeight));
      if (v.boundary != null) args.push('--boundary', String(v.boundary));
      if (L.init) args.push('--init-file', L.init);
      if (v.pin) args.push('--pin', v.pin);
      const t0 = Date.now();
      const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
      if (r.status !== 0) { console.error(`FAILED ${tag}\n${r.stderr}`); process.exitCode = 1; continue; }
      const res = JSON.parse(fs.readFileSync(json, 'utf8'));
      // gzip the TSV
      let raw = Buffer.alloc(0);
      if (!v.noStream) {
        raw = fs.readFileSync(tsv);
        fs.writeFileSync(tsv + '.gz', zlib.gzipSync(raw, { level: 6 }));
        fs.unlinkSync(tsv);
      }
      const line = { tag, variant: v.id, mode, list: ln, fits: res.counts.fits, complete: res.counts.complete, perPattern: res.counts.perPattern, seconds: (Date.now() - t0) / 1000, tsvBytes: raw.length };
      log.push(line);
      console.log(JSON.stringify(line));
    }
  }
  fs.appendFileSync(path.join(OUT, 'run_log.jsonl'), log.map((l) => JSON.stringify(Object.assign({ at: new Date().toISOString() }, l))).join('\n') + (log.length ? '\n' : ''));
}

main();
