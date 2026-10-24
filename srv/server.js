'use strict';

const cds = require('@sap/cds');

cds.env.features = cds.env.features || {};
cds.env.features.in_memory_db = false;
for (const name of Object.keys(cds.env.requires || {})) {
  const r = cds.env.requires[name];
  if (r && (r.kind === 'sqlite' || String(r.impl || '').includes('sqlite'))) {
    delete cds.env.requires[name];
  }
}
cds.env.requires.db = {
  kind: 'hana',
  impl: '@cap-js/hana',
  credentials: cds.env.requires.db?.credentials || {},
};

const { register } = require('./handlers/register');
const { start } = require('./workers/outbox-worker');
const { mountRest } = require('./rest/api');

cds.on('bootstrap', (app) => {
  const fs = require('fs');
  const path = require('path');
  const express = require('express');
  const appDirs = [
    path.join(__dirname, '..', 'app'),
    path.join(__dirname, 'app'),
    path.join(process.cwd(), 'app'),
  ].filter((d) => fs.existsSync(d));
  if (appDirs[0]) app.use('/app', express.static(appDirs[0]));
  app.get('/', (_req, res) => res.redirect('/app/launchpad/index.html'));
  mountRest(app, cds);
});

cds.on('served', async () => {
  register(cds);
  start(cds);
  try {
    const { ensureDemoUsers } = require('./boot-seed');
    await ensureDemoUsers();
    console.log('[boot-seed] demo users ready (manager / manager)');
  } catch (err) {
    console.warn('[boot-seed]', err.message);
  }
});

module.exports = cds.server;
