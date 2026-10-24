'use strict';

const cds = require('@sap/cds');
const { seed } = require('../db/seed/data');

function entityName(name) {
  return `rental.equipment.${name}`;
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

async function main() {
  if (!cds.model) await cds.load('*');
  if (!cds.db) await cds.connect.to('db');

  const data = seed();
  const privileged =
    cds.User?.privileged ||
    (typeof cds.User?.Privileged === 'function' ? new cds.User.Privileged() : new cds.User({ id: 'privileged' }));

  await cds.tx({ user: privileged }, async (tx) => {
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
  if (!cds.model) await cds.load('*');
  if (!cds.db) {
    const kind = cds.env.requires?.db?.kind;
    if (kind === 'hana') await cds.connect.to('db');
    else await cds.deploy('*');
  }
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
