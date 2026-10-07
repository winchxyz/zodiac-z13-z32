#!/usr/bin/env node
/**
 * tools/run_slot.js - run a heavy command only when one of N shared machine
 * slots is free, so parallel agents do not oversubscribe CPU and RAM.
 *
 * Usage:
 *   node tools/run_slot.js [--slots 4] [--max-wait-min 120] [--label name] -- <command> [args...]
 *
 * A slot is the directory .locks/slot-<k> (mkdir is atomic). It holds owner.json
 * with the pid; a slot whose pid is no longer alive is reclaimed. The child
 * inherits stdio; the slot is released when it exits. Exit code = child's.
 * Pass the same --threads budget to every heavy tool (4 by default per slot).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0 || sep === argv.length - 1) {
  console.error('usage: node tools/run_slot.js [--slots 4] [--max-wait-min 120] [--label name] -- <command> [args...]');
  process.exit(2);
}
const opts = { slots: 4, maxWaitMin: 120, label: '' };
for (let i = 0; i < sep; i++) {
  const a = argv[i];
  if (a === '--slots') opts.slots = parseInt(argv[++i], 10);
  else if (a === '--max-wait-min') opts.maxWaitMin = parseFloat(argv[++i]);
  else if (a === '--label') opts.label = argv[++i];
  else { console.error('unknown option ' + a); process.exit(2); }
}
const cmd = argv[sep + 1];
const cmdArgs = argv.slice(sep + 2);
const lockRoot = path.join(__dirname, '..', '.locks');
fs.mkdirSync(lockRoot, { recursive: true });

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function tryAcquire() {
  for (let k = 1; k <= opts.slots; k++) {
    const dir = path.join(lockRoot, 'slot-' + k);
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({
        pid: process.pid, label: opts.label, cmd: [cmd, ...cmdArgs].join(' ').slice(0, 300), since: new Date().toISOString(),
      }));
      return dir;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // reclaim a stale slot
      try {
        const own = JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8'));
        if (own.pid && !alive(own.pid)) fs.rmSync(dir, { recursive: true, force: true });
      } catch (_) {
        // owner.json missing: the owner may be between mkdir and write; reclaim only if old
        try {
          const st = fs.statSync(dir);
          if (Date.now() - st.mtimeMs > 60000) fs.rmSync(dir, { recursive: true, force: true });
        } catch (__) { /* gone already */ }
      }
    }
  }
  return null;
}

const t0 = Date.now();
let slotDir = null;
function release() {
  if (slotDir) { try { fs.rmSync(slotDir, { recursive: true, force: true }); } catch (_) {} slotDir = null; }
}

function start() {
  const waited = ((Date.now() - t0) / 1000).toFixed(0);
  process.stderr.write(`[run_slot] ${path.basename(slotDir)} acquired after ${waited}s: ${cmd} ${cmdArgs.join(' ')}\n`);
  const child = spawn(cmd, cmdArgs, { stdio: 'inherit', shell: false });
  const forward = (sig) => { try { child.kill(sig); } catch (_) {} };
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));
  child.on('error', (e) => { console.error('[run_slot] spawn failed: ' + e.message); release(); process.exit(127); });
  child.on('exit', (code, signal) => { release(); process.exit(code === null ? 1 : code); });
}

function poll() {
  slotDir = tryAcquire();
  if (slotDir) return start();
  if ((Date.now() - t0) / 60000 > opts.maxWaitMin) {
    console.error(`[run_slot] no free slot after ${opts.maxWaitMin} min; giving up`);
    process.exit(75);
  }
  setTimeout(poll, 5000);
}
process.on('exit', release);
poll();
