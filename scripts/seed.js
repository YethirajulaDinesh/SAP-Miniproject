'use strict';

if (!process.env.CDS_ENV) process.env.CDS_ENV = 'hybrid';

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
  const db = cds.env.requires.db || (cds.env.requires.db = {});
  db.kind = 'hana';
  db.impl = '@cap-js/hana';
  if (!cds.db) await cds.connect.to('db');
  if (!cds.model) await cds.load('*');

  const data = seed();
  const privileged =
    cds.User?.privileged ||
    (typeof cds.User?.Privileged === 'function' ? new cds.User.Privileged() : new cds.User({ id: 'privileged' }));

  await cds.db.tx({ user: privileged }, async (tx) => {
    for (const [name, rows] of Object.entries(data)) {
      if (!rows?.length) continue;
      try {
        await upsertRows(tx, name, rows);
      } catch (err) {
        console.warn('seed skipped', name, err.message);
      }
    }
  });

  console.log('database kind:', cds.db?.kind || 'hana');
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };
