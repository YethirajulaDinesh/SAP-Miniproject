'use strict';

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'app');
const dest = path.join(__dirname, '..', 'gen', 'srv', 'app');
if (!fs.existsSync(src)) {
  console.warn('app/ missing; skip copy');
  process.exit(0);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('copied app -> gen/srv/app');
