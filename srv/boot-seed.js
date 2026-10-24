'use strict';

async function ensureDemoData(cds) {
  const { AppUsers } = cds.entities('rental.equipment');
  let count = 0;
  try {
    const rows = await SELECT.from(AppUsers).columns('ID').limit(1);
    count = rows?.length || 0;
  } catch (err) {
    console.warn('[boot-seed] AppUsers not readable yet:', err.message);
    return;
  }
  if (count > 0) {
    console.log('[boot-seed] users already present');
    return;
  }
  console.log('[boot-seed] no users found — loading demo seed');
  const { main } = require('../scripts/seed');
  await main();
}

module.exports = { ensureDemoData };
