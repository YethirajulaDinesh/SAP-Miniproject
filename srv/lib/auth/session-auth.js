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

function requestToken(req) {
  const h = req.headers || {};
  const fromHeader = String(h['x-re-session'] || h['x-re-token'] || '').trim();
  if (fromHeader) return fromHeader;
  const fromCookie = cookie(req, 're_session') || cookie(req, 're_token');
  if (fromCookie) return fromCookie;
  const q = String(req.query?.re_session || req.query?.access_token || '').trim();
  return q || null;
}

function applyUser(req, user) {
  req.user = user;
  const ctx = cds.context;
  if (!ctx) return;
  ctx.user = user;
  if (ctx._) ctx._.req = req;
  if (ctx.http) ctx.http.req = req;
}

function sessionAuth(_options) {
  return async function sessionAuthMiddleware(req, res, next) {
    try {
      const path = String(req.path || req.url || '').split('?')[0];
      if (req.method === 'OPTIONS' || PUBLIC.some((re) => re.test(path))) {
        applyUser(req, cds.User.anonymous);
        return next();
      }
      const token = requestToken(req);
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
    } catch (err) {
      console.error('[session-auth]', err.message);
      applyUser(req, cds.User.anonymous);
      return next();
    }
  };
}

module.exports = sessionAuth;
