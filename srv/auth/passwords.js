'use strict';

const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(String(password), salt, 32).toString('hex');
  if (check.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(hash));
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.username,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    plant: row.plant,
    email: row.email,
    roles: [row.role],
  };
}

module.exports = { hashPassword, verifyPassword, publicUser };
