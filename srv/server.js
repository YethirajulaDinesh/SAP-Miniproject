'use strict';

const cds = require('@sap/cds');

function forceHana() {
  cds.env.features = cds.env.features || {};
  cds.env.features.in_memory_db = false;
  cds.env.features.with_mocks = false;
  const prev = cds.env.requires.db || {};
  const credentials = { ...(prev.credentials || {}) };
  delete credentials.driver;
  cds.env.requires.db = {
    kind: 'hana',
    impl: '@cap-js/hana',
    credentials,
  };
  if (cds.env.requires.kinds) {
    cds.env.requires.kinds.sql = { kind: 'hana', impl: '@cap-js/hana' };
    cds.env.requires.kinds.sqlite = { kind: 'hana', impl: '@cap-js/hana' };
  }
}

forceHana();

const { register } = require('./handlers/register');
const { start } = require('./lib/workers/outbox-worker');
const { mountRest } = require('./lib/rest/api');

cds.on('bootstrap', (app) => {
  forceHana();
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
    const { ensureDemoUsers } = require('./lib/boot-seed');
    await ensureDemoUsers();
    console.log('[boot-seed] demo users ready (manager / manager)');
  } catch (err) {
    console.warn('[boot-seed]', err.message);
  }
});

module.exports = cds.server;
