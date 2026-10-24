'use strict';

const cds = require('@sap/cds');
const { lookupSession } = require('./sessions');

const PUBLIC = [
  /^\/health$/,
  /^\/ready$/,
  /^\/app\//,
  /^\/favicon/,
  /^\/api\/auth\/login$/,
  /^\/$/,
];

function cookie(req, name) {
  const raw = req.headers.cookie || '';
  const part = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

function bearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

function applyUser(req, user) {
  req.user = user;
  if (cds.context) cds.context.user = user;
}

module.exports = async function sessionAuth(req, res, next) {
  const path = String(req.path || req.url || '').split('?')[0];
  if (req.method === 'OPTIONS' || PUBLIC.some((re) => re.test(path))) {
    applyUser(req, cds.User.anonymous);
    return next();
  }
  const token = bearer(req) || cookie(req, 're_session');
  const sess = token ? await lookupSession(token) : null;
  if (!sess) {
    applyUser(req, cds.User.anonymous);
    return next();
  }
  const user = new cds.User({
    id: sess.username,
    roles: [sess.role, 'authenticated-user'],
    attr: { plant: sess.plant || 'P1000' },
  });
  user.plant = sess.plant;
  applyUser(req, user);
  return next();
};
