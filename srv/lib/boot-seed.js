'use strict';

const { USER_ENTITY } = require('./auth/db-user');

async function ensureDemoUsers() {
  const { seed } = require('../../db/seed/data');
  const users = seed().AppUsers || [];
  const db = cds.db;
  if (!db) throw new Error('HANA db is not connected');
  for (const u of users) {
    const existing = await db.run(
      SELECT.one.from(USER_ENTITY).columns('ID', 'username').where({ username: u.username }),
    );
    if (!existing) {
      await db.run(INSERT.into(USER_ENTITY).entries(u));
      console.log('[boot-seed] created user', u.username);
    } else {
      await db.run(
        UPDATE(USER_ENTITY)
          .set({
            passwordHash: u.passwordHash,
            active: true,
            role: u.role,
            displayName: u.displayName,
            plant: u.plant,
            email: u.email,
          })
          .where({ ID: existing.ID }),
      );
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
