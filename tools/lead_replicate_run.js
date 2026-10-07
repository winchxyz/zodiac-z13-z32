'use strict';
/**
 * tools/lead_replicate_run.js - the pre-registered null tests of the Z13 / Z340-key lead
 * (results/lead/replicate/prereg.md).  Fresh code: tools/lead_replicate_lib.js + tools/lm.js only.
 *
 *   node tools/lead_replicate_run.js --key z340 --nulls perm,class,class_fixz,iid,occ,iso_uniform,iso_weighted,windows
 *        [--draws 10000] [--threads 4] [--out results/lead/replicate/nulls_z340.json]
 *   node tools/lead_replicate_run.js --key z408 --nulls perm,class,iid   (negative control)
 *
 * For every null: the six pinned letters (A E N z K M) are drawn as the prereg says, and all 4
 * variants x 3 statistics are recomputed on the same draw.  Output: per test the real value, the
 * null summary, the add-one p-value and the Westfall-Young min-p adjusted p within that null.
 * Raw null values: <out without .json>_<null>.f64 (Float64, [draw][variant][stat]) and the
 * draws (slot letters) in the JSON.
 */
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const R = require('./lead_replicate_lib');

const NV = R.VARIANT_IDS.length, NS = R.STATS.length, NT = NV * NS;
const SEEDS = { perm: 1301, class: 1302, class_fixz: 1303, iid: 1304, occ: 1305, iso_uniform: 1306, iso_weighted: 1307, windows: 1308 };

/* ------------------------------------------------------------------ worker */
if (!isMainThread) {
  const lays = R.VARIANT_IDS.map((id) => R.layout(id));
  const engines = lays.map((l) => R.engine(l));
  parentPort.on('message', (msg) => {
    if (msg.type === 'stop') { process.exit(0); }
    // msg.items: [{idx, pls: [Int8Array|null per variant]}]
    const out = new Float64Array(msg.items.length * NT).fill(NaN);
    msg.items.forEach((it, k) => {
      for (let v = 0; v < NV; v++) {
        const pl = it.pls[v];
        if (!pl) continue;
        const s = engines[v].stats(Int8Array.from(pl));
        out[k * NT + v * NS + 0] = s.t1;
        out[k * NT + v * NS + 1] = s.t2;
        out[k * NT + v * NS + 2] = s.t3;
      }
    });
    parentPort.postMessage({ idx: msg.items.map((it) => it.idx), vals: out }, [out.buffer]);
  });
  return;
}

/* -------------------------------------------------------------------- main */
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const KEY = opt('--key', 'z340');
const NULLS = opt('--nulls', KEY === 'z340' ? 'perm,class,class_fixz,iid,occ,iso_uniform,iso_weighted,windows' : 'perm,class,iid').split(',');
const DRAWS = +opt('--draws', 10000);
const THREADS = +opt('--threads', 4);
const OUT = opt('--out', `results/lead/replicate/nulls_${KEY}.json`);
const CHUNK = +opt('--chunk', 200);

const keys = R.loadKeys();
const K = keys[KEY];
const code = (l) => l.charCodeAt(0) - 65;
const lays = R.VARIANT_IDS.map((id) => R.layout(id));
const realSlots = R.SLOTS.map((s) => code(K.key[s]));

function slotsToPls(slots) { return lays.map((l) => R.slotLetters(l, slots)); }

/** Draws for one null: [{slots?:[6 codes], pls:[per variant], label}] */
function makeDraws(name) {
  const rng = R.makeRng(SEEDS[name] + (KEY === 'z408' ? 4080000 : 0));
  const syms = Object.keys(K.key);
  const letterOf = (s) => code(K.key[s]);
  const draws = [];
  const push = (slots) => draws.push({ slots, pls: slotsToPls(slots) });
  if (name === 'perm') {
    const L = syms.map(letterOf);
    for (let d = 0; d < DRAWS; d++) push(R.shuffle(L.slice(), rng).slice(0, 6));
  } else if (name === 'class' || name === 'class_fixz') {
    const cap = syms.filter((s) => R.glyphClass(s) === 'capital').map(letterOf);
    const non = syms.filter((s) => R.glyphClass(s) === 'nonletter').map(letterOf);
    for (let d = 0; d < DRAWS; d++) {
      const c = R.shuffle(cap.slice(), rng).slice(0, 5);
      const z = name === 'class_fixz' ? realSlots[3] : non[rng.int(non.length)];
      push([c[0], c[1], c[2], z, c[3], c[4]]);           // slot order A E N z K M
    }
  } else if (name === 'iid') {
    const L = syms.map(letterOf);
    for (let d = 0; d < DRAWS; d++) push(R.SLOTS.map(() => L[rng.int(L.length)]));
  } else if (name === 'occ') {
    const w = syms.map((s) => K.counts[s]);
    for (let d = 0; d < DRAWS; d++) push(R.weightedDistinct(syms, w, 6, rng).map(letterOf));
  } else if (name === 'iso_uniform' || name === 'iso_weighted') {
    if (KEY !== 'z340') throw new Error('iso nulls are defined for the Z340 key only');
    const other = keys.z408.ascii + keys.z32.ascii;
    const pool = syms.filter((s) => other.includes(s));
    const occ = pool.map((s) => [...other].filter((c) => c === s).length);
    for (let d = 0; d < DRAWS; d++) {
      const pick = name === 'iso_uniform' ? R.shuffle(pool.slice(), rng).slice(0, 6) : R.weightedDistinct(pool, occ, 6, rng);
      push(pick.map(letterOf));
    }
    draws.pool = pool.join('');
  } else if (name === 'windows') {
    if (KEY !== 'z340') throw new Error('windows null is defined for the Z340 key only');
    for (const [src, txt] of [['z408', keys.z408.ascii], ['z32', keys.z32.ascii]]) {
      for (let st = 0; st + 13 <= txt.length; st++) {
        const win = txt.slice(st, st + 13);
        draws.push({ label: `${src}@${st}`, pls: lays.map((l) => R.windowLetters(l, win, K.key)) });
      }
    }
  } else throw new Error('unknown null ' + name);
  return draws;
}

function runPool(draws) {
  return new Promise((resolve, reject) => {
    const res = new Float64Array(draws.length * NT).fill(NaN);
    // sort by pinned letters so the per-term table cache in the Markov engine hits (K, M, N, A first)
    const order = draws.map((d, i) => i);
    const sk = (d) => d.pls.map((pl) => (pl ? Array.from(pl, (x) => (x < 0 ? '?' : R.LET[x])).join('') : '-')).join('|');
    const keysS = draws.map((d) => { const p = d.pls[1] || d.pls[0]; return p ? [5, 7, 10, 11, 0, 1, 2, 3].map((q) => (p[q] < 0 ? '?' : R.LET[p[q]])).join('') + sk(d) : sk(d); });
    order.sort((a, b) => (keysS[a] < keysS[b] ? -1 : keysS[a] > keysS[b] ? 1 : a - b));
    const chunks = [];
    for (let i = 0; i < order.length; i += CHUNK) chunks.push(order.slice(i, i + CHUNK));
    let next = 0, done = 0;
    const nW = Math.min(THREADS, chunks.length) || 1;
    const workers = [];
    const t0 = Date.now();
    const give = (w) => {
      if (next >= chunks.length) { w.postMessage({ type: 'stop' }); return; }
      const ch = chunks[next++];
      w.postMessage({ items: ch.map((i) => ({ idx: i, pls: draws[i].pls.map((p) => (p ? Array.from(p) : null)) })) });
    };
    for (let k = 0; k < nW; k++) {
      const w = new Worker(__filename);
      w.on('message', (m) => {
        m.idx.forEach((i, k2) => { for (let t = 0; t < NT; t++) res[i * NT + t] = m.vals[k2 * NT + t]; });
        done++;
        if (done % 10 === 0 || done === chunks.length) process.stdout.write(`  chunks ${done}/${chunks.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
        if (done === chunks.length) { resolve(res); }
        give(w);
      });
      w.on('error', reject);
      workers.push(w);
      give(w);
    }
    if (chunks.length === 0) resolve(res);
  });
}

function summary(vals) {
  const v = vals.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { n: 0 };
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  const q = (f) => v[Math.min(n - 1, Math.max(0, Math.round(f * (n - 1))))];
  return { n, mean, sd, min: v[0], q05: q(0.05), q50: q(0.5), q95: q(0.95), q99: q(0.99), max: v[n - 1] };
}

/** Westfall-Young min-p over the tests in `tests` using the rows (draws) in `rows`. */
function westfallYoung(res, rows, real, tests) {
  const N = rows.length;
  const sorted = tests.map((t) => rows.map((r) => res[r * NT + t]).sort((a, b) => a - b));
  const tail = (ti, x) => {            // #{v >= x} / N
    const a = sorted[ti];
    let lo = 0, hi = a.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; }
    return (a.length - lo) / N;
  };
  const minP = rows.map((r) => Math.min(...tests.map((t, ti) => tail(ti, res[r * NT + t]))));
  const rawTail = tests.map((t, ti) => tail(ti, real[t]));
  const adj = rawTail.map((p) => (1 + minP.filter((m) => m <= p).length) / (1 + N));
  return { N, rawTail, adj };
}

(async () => {
  const t0 = Date.now();
  const outAbs = path.join(R.ROOT, OUT);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  // real values (fast engine) + brute-force check and best texts
  const engines = lays.map((l) => R.engine(l));
  const realPls = slotsToPls(realSlots);
  const real = new Float64Array(NT);
  const realInfo = {};
  lays.forEach((l, v) => {
    const s = engines[v].stats(realPls[v]);
    real[v * NS] = s.t1; real[v * NS + 1] = s.t2; real[v * NS + 2] = s.t3;
    const b = R.bruteStats(l, realPls[v], { word: true });
    const pinned = Array.from(realPls[v], (x) => (x < 0 ? '?' : R.LET[x])).join('');
    realInfo[l.id] = { pinned, t1: s.t1, t2: s.t2, t3: s.t3, bruteT1: b.t1, bruteT2: b.t2, bruteT3: b.t3, best1: b.best1, best2: b.best2,
      bestWords: require('./lm').wordSegment(b.best2).words.join(' ') };
    if (Math.abs(b.t1 - s.t1) > 1e-6 || Math.abs(b.t2 - s.t2) > 1e-6 || Math.abs(b.t3 - s.t3) > 1e-6) throw new Error('real value mismatch in ' + l.id);
    console.log(`real ${KEY} ${l.id}: pinned ${pinned} t1 ${s.t1.toFixed(3)} (${b.best1}) t2 ${s.t2.toFixed(3)} (${realInfo[l.id].bestWords}) t3 ${s.t3.toFixed(3)}`);
  });
  const out = { key: KEY, realSlots: realSlots.map((x) => R.LET[x]).join(''), variants: R.VARIANT_IDS, stats: R.STATS, real: realInfo,
    started: new Date(t0).toISOString(), draws: DRAWS, threads: THREADS, nulls: {} };
  for (const name of NULLS) {
    const t1 = Date.now();
    const draws = makeDraws(name);
    console.log(`null ${name}: ${draws.length} draws`);
    const res = await runPool(draws);
    const binPath = outAbs.replace(/\.json$/, `_${name}.f64`);
    fs.writeFileSync(binPath, Buffer.from(res.buffer));
    const tests = [...Array(NT).keys()];
    const rec = { seconds: (Date.now() - t1) / 1000, nDraws: draws.length, raw: path.relative(R.ROOT, binPath).replace(/\\/g, '/'), tests: {} };
    if (draws.pool) rec.pool = draws.pool;
    // rows usable for all tests (windows: eligible for every layout)
    const rowsAll = [];
    for (let r = 0; r < draws.length; r++) if (tests.every((t) => Number.isFinite(res[r * NT + t]))) rowsAll.push(r);
    const wy = westfallYoung(res, rowsAll, real, tests);
    for (let v = 0; v < NV; v++) {
      for (let s = 0; s < NS; s++) {
        const t = v * NS + s;
        const col = [];
        for (let r = 0; r < draws.length; r++) if (Number.isFinite(res[r * NT + t])) col.push(res[r * NT + t]);
        const p = R.pUpper(real[t], col);
        const sm = summary(col);
        rec.tests[`${R.VARIANT_IDS[v]}.${R.STATS[s]}`] = {
          real: real[t], p, nNull: col.length, ge: col.filter((x) => x >= real[t]).length,
          z: sm.sd ? (real[t] - sm.mean) / sm.sd : null, null: sm, pWY: wy.adj[t],
        };
      }
    }
    rec.wyRows = rowsAll.length;
    rec.wyMin = Math.min(...wy.adj);
    if (name === 'windows') {
      rec.labels = draws.map((d) => d.label);
      // the most English-like windows under canonical t2, for inspection
      const order = [...Array(draws.length).keys()].filter((r) => Number.isFinite(res[r * NT + 1])).sort((a, b) => res[b * NT + 1] - res[a * NT + 1]);
      rec.topCanonicalT2 = order.slice(0, 10).map((r) => ({ label: draws[r].label, t2: res[r * NT + 1], pinned: Array.from(draws[r].pls[0], (x) => (x < 0 ? '?' : R.LET[x])).join('') }));
    } else {
      rec.drawsSlots = draws.map((d) => d.slots.map((x) => R.LET[x]).join(''));
      rec.realAmongDraws = rec.drawsSlots.filter((s) => s === out.realSlots).length;
    }
    out.nulls[name] = rec;
    const line = R.VARIANT_IDS.map((vid) => `${vid} ` + R.STATS.map((st) => `${st} p=${rec.tests[`${vid}.${st}`].p.toFixed(4)}`).join(' ')).join(' | ');
    console.log(`null ${name} done in ${rec.seconds.toFixed(0)} s; WY min ${rec.wyMin.toFixed(4)}; ${line}`);
    fs.writeFileSync(outAbs, JSON.stringify(out, null, 1));
  }
  out.finished = new Date().toISOString();
  fs.writeFileSync(outAbs, JSON.stringify(out, null, 1));
  console.log(`wrote ${OUT} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
