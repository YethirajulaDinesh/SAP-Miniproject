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

module.exports = async function sessionAuth(req, res, next) {
  const path = req.path || req.url || '';
  if (req.method === 'OPTIONS' || PUBLIC.some((re) => re.test(path))) {
    req.user = new cds.User();
    return next();
  }
  const token = bearer(req) || cookie(req, 're_session');
  const sess = token ? await lookupSession(token) : null;
  if (!sess) {
    req.user = new cds.User();
    return next();
  }
  req.user = new cds.User({
    id: sess.username,
    roles: [sess.role, 'authenticated-user'],
    attr: { plant: sess.plant || 'P1000' },
  });
  req.user.plant = sess.plant;
  return next();
};
