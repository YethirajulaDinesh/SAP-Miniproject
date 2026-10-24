'use strict';

const crypto = require('crypto');
const { withPrivileged } = require('./db-user');

const SESSION_ENTITY = 'rental.equipment.AuthSessions';
const memory = new Map();

function memoryRow(user, token, expiresAt) {
  return {
    ID: crypto.randomUUID(),
    token,
    user_ID: user.ID,
    username: user.username,
    role: user.role,
    plant: user.plant,
    expiresAt,
    createdAt: new Date().toISOString(),
  };
}

async function lookupSession(token) {
  if (!token) return null;
  const mem = memory.get(token);
  if (mem) {
    if (new Date(mem.expiresAt).getTime() < Date.now()) {
      memory.delete(token);
      return null;
    }
    return mem;
  }
  try {
    const row = await withPrivileged((tx) => tx.run(SELECT.one.from(SESSION_ENTITY).where({ token })));
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await withPrivileged((tx) => tx.run(DELETE.from(SESSION_ENTITY).where({ ID: row.ID })));
      return null;
    }
    return row;
  } catch {
    return null;
  }
}

async function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const row = memoryRow(user, token, expiresAt);
  memory.set(token, row);
  try {
    await withPrivileged((tx) => tx.run(INSERT.into(SESSION_ENTITY).entries(row)));
  } catch (err) {
    console.warn('[session] HANA session insert failed; using in-memory session:', err.message);
  }
  return { token, expiresAt };
}

async function destroySession(token) {
  if (!token) return;
  memory.delete(token);
  try {
    await withPrivileged((tx) => tx.run(DELETE.from(SESSION_ENTITY).where({ token })));
  } catch {
    /* ignore */
  }
}

module.exports = { lookupSession, createSession, destroySession };
