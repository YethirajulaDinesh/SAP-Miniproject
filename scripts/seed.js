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
}

if (require.main === module) {
  cds
    .deploy('*')
    .then(main)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };
