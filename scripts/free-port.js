'use strict';

// Runs before `npm run dev`: stops a server still listening on the dev port
// (for example an earlier `npm run dev` in another terminal) so the new one
// does not fail with EADDRINUSE. Needs no extra tools: reads /proc on Linux
// (SAP BAS), uses netstat on Windows and lsof on macOS.

const fs = require('fs');
const { execSync } = require('child_process');

const PORT = 4004;

function linuxPids(port) {
  const hex = ':' + port.toString(16).toUpperCase().padStart(4, '0');
  const inodes = new Set();
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let rows;
    try {
      rows = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1);
    } catch {
      continue;
    }
    for (const row of rows) {
      const cols = row.trim().split(/\s+/);
      if (cols[1].endsWith(hex) && cols[3] === '0A') inodes.add(cols[9]); // 0A = LISTEN
    }
  }
  const pids = new Set();
  if (!inodes.size) return pids;
  for (const pid of fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
    let fds;
    try {
      fds = fs.readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      try {
        const m = /^socket:\[(\d+)\]$/.exec(fs.readlinkSync(`/proc/${pid}/fd/${fd}`));
        if (m && inodes.has(m[1])) pids.add(Number(pid));
      } catch {
        /* fd closed meanwhile */
      }
    }
  }
  return pids;
}

function windowsPids(port) {
  const pids = new Set();
  const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' }) + execSync('netstat -ano -p tcpv6', { encoding: 'utf8' });
  for (const line of out.split(/\r?\n/)) {
    const m = /^\s*TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i.exec(line);
    if (m && Number(m[1]) === port) pids.add(Number(m[2]));
  }
  return pids;
}

function macPids(port) {
  const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
  return new Set(out.split(/\s+/).filter(Boolean).map(Number));
}

function listeners(port) {
  try {
    const pids =
      process.platform === 'linux' ? linuxPids(port) : process.platform === 'win32' ? windowsPids(port) : macPids(port);
    pids.delete(process.pid);
    pids.delete(0);
    return pids;
  } catch {
    return new Set(); // nothing listening, or the lookup tool is unavailable
  }
}

function kill(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      /* already gone, or not ours */
    }
  }
}

async function main() {
  let pids = listeners(PORT);
  if (!pids.size) return;
  console.log(`[free-port] port ${PORT} is in use by PID ${[...pids].join(', ')}; stopping it`);
  kill(pids, 'SIGTERM');
  for (let i = 0; i < 30 && pids.size; i++) {
    await new Promise((r) => setTimeout(r, 100));
    pids = listeners(PORT);
  }
  if (pids.size) kill(pids, 'SIGKILL');
}

main();
