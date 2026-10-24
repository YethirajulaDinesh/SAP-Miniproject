'use strict';

if (!process.env.CDS_ENV && (process.env.VCAP_SERVICES || '').includes('hana')) {
  process.env.CDS_ENV = 'hybrid';
}

const cds = require('@sap/cds');
const { seed } = require('../db/seed/data');

function entityName(name) {
  return `rental.equipment.${name}`;
}

function dbCreds() {
  return cds.env.requires?.db?.credentials || {};
}

function isHana() {
  const db = cds.env.requires?.db || {};
  const creds = dbCreds();
  return (
    db.kind === 'hana' ||
    db.kind === 'hana-cloud' ||
    String(db.impl || '').includes('hana') ||
    !!(creds.host || creds.certificate || creds.hdi_user || creds.schema)
  );
}

function ensureSqliteUrl() {
  const db = cds.env.requires.db || (cds.env.requires.db = {});
  db.kind = 'sqlite';
  db.impl = '@cap-js/sqlite';
  db.credentials = { url: db.credentials?.url || db.credentials?.database || 'db.sqlite' };
}

async function upsertRows(tx, name, rows) {
  const entity = entityName(name);
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const existing = row.ID
      ? await tx.run(SELECT.one.from(entity).columns('ID').where({ ID: row.ID }))
      : null;
    if (existing) {
      const { ID, ...patch } = row;
      await tx.run(UPDATE(entity).set(patch).where({ ID }));
      updated += 1;
    } else {
      await tx.run(INSERT.into(entity).entries(row));
      inserted += 1;
    }
  }
  console.log('seeded', name, `${inserted} inserted, ${updated} updated`);
}

async function connectDb() {
  const db = cds.env.requires.db || (cds.env.requires.db = {});
  if (isHana()) {
    db.kind = 'hana';
    db.impl = '@cap-js/hana';
  } else {
    ensureSqliteUrl();
  }
  if (!cds.db) await cds.connect.to('db');
}

async function main() {
  await connectDb();
  if (!cds.model) await cds.load('*');

  const data = seed();
  const privileged =
    cds.User?.privileged ||
    (typeof cds.User?.Privileged === 'function' ? new cds.User.Privileged() : new cds.User({ id: 'privileged' }));

  const dbc = cds.db;
  await dbc.tx({ user: privileged }, async (tx) => {
    for (const [name, rows] of Object.entries(data)) {
      if (!rows?.length) continue;
      try {
        await upsertRows(tx, name, rows);
      } catch (err) {
        console.warn('seed skipped', name, err.message);
      }
    }
  });

  console.log('database kind:', cds.db?.kind || cds.env.requires?.db?.kind || 'unknown');
}

async function boot() {
  if (!isHana() && cds.env.profiles?.includes?.('hybrid')) {
    throw new Error(
      'Hybrid/HANA profile has no HANA credentials. In BAS run:\n  npx cds bind -2 rental-db\n  npx cds bind --exec -- node scripts/seed.js',
    );
  }
  await connectDb();
  await main();
}

if (require.main === module) {
  boot()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };
