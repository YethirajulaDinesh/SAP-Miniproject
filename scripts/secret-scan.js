'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const banned = [/AKIA[0-9A-Z]{16}/, /-----BEGIN PRIVATE KEY-----/, /clientsecret\s*[:=]\s*['"][^'"]+['"]/i];
const skip = new Set(['node_modules', '.git', 'coverage', 'gen', '.media', 'test']);
let hits = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(js|ts|json|yml|yaml|md|cds|env)$/.test(ent.name) && !ent.name.endsWith('.example')) {
      const txt = fs.readFileSync(p, 'utf8');
      for (const re of banned) {
        if (re.test(txt) && !p.endsWith('secret-scan.js')) {
          console.error('possible secret', p);
          hits++;
        }
      }
    }
  }
}

walk(root);
if (hits) process.exit(1);
console.log('secret-scan: clean');
