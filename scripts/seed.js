'use strict';

const cds = require('@sap/cds');
const { seed } = require('../db/seed/data');

async function main() {
  await cds.connect.to('db');
  const entities = cds.entities('rental.equipment');
  const data = seed();
  for (const [name, rows] of Object.entries(data)) {
    if (!rows?.length) continue;
    const entity = entities[name];
    if (!entity) {
      console.warn('skip unknown entity', name);
      continue;
    }
    try {
      await DELETE.from(entity);
    } catch {
      /* first run */
    }
    await INSERT.into(entity).entries(rows);
    console.log('seeded', name, rows.length);
  }
  console.log('database kind:', cds.env.requires?.db?.kind || 'unknown');
}

async function boot() {
  const kind = cds.env.requires?.db?.kind;
  if (kind === 'hana') {
    await cds.connect.to('db');
  } else {
    await cds.deploy('*');
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
