'use strict';

const { execSync } = require('child_process');
try {
  execSync('fuser -k 4004/tcp', { stdio: 'ignore' });
} catch {
  /* port was free, or fuser is unavailable */
}
