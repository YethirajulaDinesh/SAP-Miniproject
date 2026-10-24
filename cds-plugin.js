'use strict';

const cds = require('@sap/cds');

cds.env.features = cds.env.features || {};
cds.env.features.in_memory_db = false;

const creds = cds.env.requires?.db?.credentials || {};
cds.env.requires.db = {
  kind: 'hana',
  impl: '@cap-js/hana',
  credentials: creds,
};

module.exports = {};
