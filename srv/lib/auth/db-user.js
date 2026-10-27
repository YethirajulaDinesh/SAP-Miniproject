'use strict';

const cds = require('@sap/cds');

const USER_ENTITY = 'rental.equipment.AppUsers';
const USER_COLS = ['ID', 'username', 'displayName', 'passwordHash', 'role', 'plant', 'active', 'email'];

function privilegedUser() {
  if (cds.User?.privileged) return cds.User.privileged;
  if (typeof cds.User?.Privileged === 'function') return new cds.User.Privileged();
  return new cds.User({ id: 'privileged', roles: ['Admin'] });
}

async function withPrivileged(fn) {
  if (!cds.db) throw new Error('HANA db is not connected');
  return fn(cds.db);
}

async function findUserByUsername(username) {
  return withPrivileged((tx) =>
    tx.run(SELECT.one.from(USER_ENTITY).columns(USER_COLS).where({ username })),
  );
}

module.exports = { USER_ENTITY, USER_COLS, privilegedUser, withPrivileged, findUserByUsername };
