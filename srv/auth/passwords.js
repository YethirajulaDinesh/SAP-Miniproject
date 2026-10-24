'use strict';

const crypto = require('crypto');

const DEMO_PASSWORDS = Object.freeze({
  manager: 'manager',
  'maria.yard': 'Yard#maria',
  'dan.dispatch': 'Disp#dan',
  'tom.tech': 'Tech#tom',
  'bella.billing': 'Bill#bella',
  'avi.admin': 'Admin#avi',
  'omar.audit': 'Audit#omar',
});

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function storedHash(stored) {
  if (!stored) return '';
  if (Buffer.isBuffer(stored)) return stored.toString('utf8').trim();
  return String(stored).trim();
}

function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const [salt, hash] = storedHash(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(String(password), salt, 32).toString('hex');
  if (check.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(hash));
}

function matchDemoPassword(username, password) {
  return DEMO_PASSWORDS[String(username || '').trim()] === String(password || '');
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

module.exports = { hashPassword, verifyPassword, publicUser, matchDemoPassword, DEMO_PASSWORDS };
