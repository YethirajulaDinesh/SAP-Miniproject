'use strict';

const crypto = require('crypto');
const cds = require('@sap/cds');

async function lookupSession(token) {
  if (!token) return null;
  try {
    const { AuthSessions } = cds.entities('rental.equipment');
    const row = await SELECT.one.from(AuthSessions).where({ token });
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await DELETE.from(AuthSessions).where({ ID: row.ID });
      return null;
    }
    return row;
  } catch {
    return null;
  }
}

async function createSession(user) {
  const { AuthSessions } = cds.entities('rental.equipment');
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  await INSERT.into(AuthSessions).entries({
    ID: crypto.randomUUID(),
    token,
    user_ID: user.ID,
    username: user.username,
    role: user.role,
    plant: user.plant,
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  return { token, expiresAt };
}

async function destroySession(token) {
  if (!token) return;
  const { AuthSessions } = cds.entities('rental.equipment');
  await DELETE.from(AuthSessions).where({ token });
}

module.exports = { lookupSession, createSession, destroySession };
