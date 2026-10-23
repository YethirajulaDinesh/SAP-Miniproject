'use strict';

const cds = require('@sap/cds');
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

cds.on('served', () => {
  register(cds);
  start(cds);
});

module.exports = cds.server;
