'use strict';

const cds = require('@sap/cds');

function looksLikeHana(creds = {}) {
  return !!(
    creds.host ||
    creds.hdi_user ||
    creds.certificate ||
    creds.schema ||
    String(creds.url || '').startsWith('jdbc:sap')
  );
}

const db = cds.env.requires?.db;
if (db) {
  const creds = db.credentials || {};
  if (looksLikeHana(creds) || db.kind === 'hana' || db.kind === 'hana-cloud') {
    db.kind = 'hana';
    db.impl = '@cap-js/hana';
  } else if (db.kind === 'sqlite' || String(db.impl || '').includes('sqlite')) {
    db.kind = 'sqlite';
    db.impl = '@cap-js/sqlite';
    if (!creds.url && !creds.database) db.credentials = { ...creds, url: 'db.sqlite' };
  }
}

module.exports = { looksLikeHana };
