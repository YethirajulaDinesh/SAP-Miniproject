'use strict';

const cds = require('@sap/cds');

const db = cds.env.requires?.db;
if (db) {
  const creds = db.credentials || {};
  const sqlite = db.kind === 'sqlite' || String(db.impl || '').includes('sqlite');
  if (sqlite && !creds.url && !creds.database) {
    db.credentials = { ...creds, url: 'db.sqlite' };
  }
}

module.exports = {};
