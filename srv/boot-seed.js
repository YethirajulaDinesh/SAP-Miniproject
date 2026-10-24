'use strict';

async function ensureDemoUsers() {
  const cds = require('@sap/cds');
  const { AppUsers } = cds.entities('rental.equipment');
  const { seed } = require('../db/seed/data');
  const users = seed().AppUsers || [];
  for (const u of users) {
    const existing = await SELECT.one.from(AppUsers).columns('ID', 'username').where({ username: u.username });
    if (!existing) {
      await INSERT.into(AppUsers).entries(u);
      console.log('[boot-seed] created user', u.username);
    } else {
      await UPDATE(AppUsers, existing.ID).with({
        passwordHash: u.passwordHash,
        active: true,
        role: u.role,
        displayName: u.displayName,
        plant: u.plant,
      });
      console.log('[boot-seed] refreshed demo password for', u.username);
    }
  }
}

async function ensureDemoData() {
  try {
    await ensureDemoUsers();
  } catch (err) {
    console.warn('[boot-seed] failed:', err.message);
    throw err;
  }
}

module.exports = { ensureDemoData, ensureDemoUsers };
