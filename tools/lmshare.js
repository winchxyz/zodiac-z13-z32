'use strict';
/**
 * tools/lmshare.js - put the tools/lm.js letter n-gram tables on
 * SharedArrayBuffers so that worker_threads can score windows without each
 * worker loading its own copy (the 5-gram table alone is 47 MB; the dense
 * 6-gram byte table is 309 MB).
 *
 * The values are byte-identical to what tools/lm.js loads (same files, same
 * formulas); tools/selftest.js checks shared j6 against lm.j6 on random indices.
 *
 *   main:   const sh = lmshare.build({orders:[5], markov:false, six:'dense'});  // plain object of typed arrays
 *           new Worker(file, {workerData: {lm: sh}})
 *   worker: const T = lmshare.attach(workerData.lm);  // {J:{n:Float32Array}, C:{n}, j6(idx), q6, ...}
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');

const P26 = [1, 26, 676, 17576, 456976, 11881376, 308915776];

function readShared(file, Ctor) {
  const fp = path.join(lm.LM_DIR, file);
  const size = fs.statSync(fp).size;
  const sab = new SharedArrayBuffer(size);
  const buf = Buffer.from(sab);
  const fd = fs.openSync(fp, 'r');
  let off = 0;
  while (off < size) {
    const n = fs.readSync(fd, buf, off, Math.min(size - off, 1 << 26), off);
    if (n <= 0) throw new Error(`short read of ${fp}`);
    off += n;
  }
  fs.closeSync(fd);
  return new Ctor(sab);
}

function sharedLike(Ctor, len) {
  return new Ctor(new SharedArrayBuffer(len * Ctor.BYTES_PER_ELEMENT));
}

const _cache = { J: {}, C: {}, six: null, q6: null };

/** Shared dense joint table J_n (n = 1..5). */
function sharedJ(n) {
  if (!_cache.J[n]) _cache.J[n] = readShared(`ngram${n}.bin`, Float32Array);
  return _cache.J[n];
}

/** Shared conditional table C_n = J_n - J_{n-1}[idx/26] (n = 1..5; C_1 = J_1). */
function sharedC(n) {
  if (_cache.C[n]) return _cache.C[n];
  const J = sharedJ(n);
  if (n === 1) return (_cache.C[1] = J);
  const Jp = sharedJ(n - 1);
  const out = sharedLike(Float32Array, J.length);
  for (let i = 0; i < J.length; i++) out[i] = J[i] - Jp[(i / 26) | 0];
  return (_cache.C[n] = out);
}

/** Exact 6-gram structures (same bucket layout as lm.js six()). */
function sharedSix() {
  if (_cache.six) return _cache.six;
  const keys = readShared('ngram6.keys.bin', Uint32Array);
  const vals = readShared('ngram6.vals.bin', Float32Array);
  const gamma = readShared('ngram6.gamma.bin', Float32Array);
  const NB = P26[4];
  const off = sharedLike(Uint32Array, NB + 1);
  const lo = sharedLike(Uint16Array, keys.length);
  let b = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const kb = (k / 676) | 0;
    while (b <= kb) off[b++] = i;
    lo[i] = k - kb * 676;
  }
  while (b <= NB) off[b++] = keys.length;
  _cache.six = { vals, gamma, off, lo };
  return _cache.six;
}

/** Dense byte-quantised 6-gram table from lm.dense6 on a SharedArrayBuffer. */
function sharedQ6() {
  if (_cache.q6) return _cache.q6;
  const D = lm.dense6({ shared: true });
  if (!(D.buffer instanceof SharedArrayBuffer)) {
    // lm.dense6 was already built unshared by someone else: copy once.
    const q = sharedLike(Uint8Array, D.q.length);
    q.set(D.q);
    _cache.q6 = { q, min: D.min, step: D.step };
  } else _cache.q6 = { q: D.q, min: D.min, step: D.step };
  return _cache.q6;
}

/**
 * Build the shared tables a solver needs.
 *   spec.orders: array of n (1..6)
 *   spec.markov: also build conditional tables
 *   spec.six:    'dense' (default) | 'exact'  - how order 6 is looked up
 * Returns a plain object (structured-cloneable; the typed arrays share memory).
 */
function build(spec = {}) {
  const orders = spec.orders || [5];
  const sixMode = spec.six || 'dense';
  const out = { J: {}, C: {}, sixMode, six: null, q6: null };
  for (const n of orders) {
    if (n < 1 || n > 6) throw new RangeError('lmshare: orders must be 1..6');
    if (n <= 5) {
      out.J[n] = sharedJ(n);
      if (spec.markov && n > 1) out.C[n] = sharedC(n);
      if (spec.markov && n > 1) out.J[n - 1] = sharedJ(n - 1);
    } else {
      out.J[5] = sharedJ(5);
      out.J[4] = sharedJ(4);
      if (sixMode === 'exact') out.six = sharedSix();
      else out.q6 = sharedQ6();
    }
  }
  return out;
}

/** Worker side: wrap a build() result and add a j6(idx) lookup. */
function attach(sh) {
  const T = { J: sh.J, C: sh.C, sixMode: sh.sixMode, q6: sh.q6, six: sh.six };
  if (sh.six) {
    const { vals, gamma, off, lo } = sh.six;
    const J5 = sh.J[5], J4 = sh.J[4];
    T.j6 = function j6(idx) {
      const kb = (idx / 676) | 0;
      const l = idx - kb * 676;
      let a = off[kb], z = off[kb + 1];
      while (a < z) {
        const m = (a + z) >>> 1;
        const v = lo[m];
        if (v < l) a = m + 1;
        else if (v > l) z = m;
        else return vals[m];
      }
      const h = (idx / 26) | 0;
      return J5[h] + gamma[h] + J5[idx % 11881376] - J4[h % 456976];
    };
  } else if (sh.q6) {
    const { q, min, step } = sh.q6;
    T.j6 = function j6q(idx) { return min + q[idx] * step; };
  }
  return T;
}

module.exports = { build, attach, sharedJ, sharedC, sharedSix, sharedQ6, P26 };
