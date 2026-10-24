'use strict';

const crypto = require('crypto');
const express = require('express');
const { mediaProvider } = require('../integrations/providers');
const { sha256 } = require('../domain/outbox');
const { replayBatch } = require('../domain/offline');
const { DomainError } = require('../domain/lifecycle');
const { verifyPassword, publicUser, matchDemoPassword } = require('../auth/passwords');
const { createSession, destroySession, lookupSession } = require('../auth/sessions');
const { findUserByUsername } = require('../auth/db-user');

function cookieToken(req) {
  const raw = req.headers.cookie || '';
  const part = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith('re_session='));
  if (part) return decodeURIComponent(part.slice('re_session='.length));
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

async function currentUser(req) {
  const sess = await lookupSession(cookieToken(req));
  if (!sess) return { id: 'anonymous', roles: [], plant: 'P1000' };
  return { id: sess.username, roles: [sess.role], plant: sess.plant, role: sess.role };
}

function mountRest(app) {
  const media = mediaProvider();
  const uploads = new Map();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'rental-equipment-tracking', ts: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    res.json({
      status: 'ready',
      db: 'sqlite-local',
      integrationMode: process.env.INTEGRATION_MODE || 'mock',
      media: process.env.MEDIA_PROVIDER || 'local',
    });
  });

  app.use('/api', express.json({ limit: '2mb' }));

  app.post('/api/auth/login', async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      if (!username || !password) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
      }
      const { ensureDemoUsers } = require('../boot-seed');
      try {
        await ensureDemoUsers();
      } catch (seedErr) {
        console.warn('[login] demo user seed failed:', seedErr.message);
      }
      let user = await findUserByUsername(username);
      const hashOk = user && verifyPassword(password, user.passwordHash);
      const demoOk = matchDemoPassword(username, password);
      if (!hashOk && !demoOk) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
      }
      if (!user && demoOk) {
        try {
          await ensureDemoUsers();
          user = await findUserByUsername(username);
        } catch (seedErr) {
          console.warn('[login] could not persist demo user:', seedErr.message);
        }
        if (!user) {
          const { seed } = require('../../db/seed/data');
          user = (seed().AppUsers || []).find((u) => u.username === username);
        }
      }
      if (!user) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
      }
      if (user.active === false || user.active === 0) {
        return res.status(401).json({ error: { code: 'USER_INACTIVE', message: 'User is inactive' } });
      }
      const { token, expiresAt } = await createSession(user);
      res.setHeader('Set-Cookie', `re_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200`);
      res.json({ user: publicUser(user), expiresAt, token });
    } catch (err) {
      console.error('[login]', err);
      res.status(500).json({ error: { code: 'LOGIN_FAILED', message: err.message } });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    await destroySession(cookieToken(req));
    res.setHeader('Set-Cookie', 're_session=; HttpOnly; Path=/; Max-Age=0');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', async (req, res) => {
    const sess = await lookupSession(cookieToken(req));
    if (!sess) return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });
    res.json({
      user: {
        id: sess.username,
        username: sess.username,
        role: sess.role,
        plant: sess.plant,
        roles: [sess.role],
      },
    });
  });

  app.post('/api/media/initiate', async (req, res) => {
    const user = await currentUser(req);
    if (user.roles.includes('Auditor')) return res.status(403).json({ error: { code: 'READ_ONLY' } });
    const { fileName, mimeType, byteSize, sha256: clientHash, damageID, conditionLogID, photoCategory } = req.body || {};
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimeType)) return res.status(415).json({ error: { code: 'MIME_NOT_ALLOWED' } });
    if (byteSize > 15 * 1024 * 1024) return res.status(413).json({ error: { code: 'FILE_TOO_LARGE' } });
    const id = crypto.randomUUID();
    const key = `media/${id}/${fileName || 'photo.bin'}`;
    uploads.set(id, { key, mimeType, byteSize, clientHash, damageID, conditionLogID, photoCategory, user: user.id });
    res.json({ uploadID: id, objectKey: key, simulated: false });
  });

  app.put('/api/media/upload/:uploadID', express.raw({ type: '*/*', limit: '16mb' }), async (req, res) => {
    const meta = uploads.get(req.params.uploadID);
    if (!meta) return res.status(404).json({ error: { code: 'UPLOAD_NOT_FOUND' } });
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const hash = sha256(buf);
    if (meta.clientHash && meta.clientHash !== hash) {
      return res.status(422).json({ error: { code: 'HASH_MISMATCH', message: 'Altered photo rejected' } });
    }
    await media.put(meta.key, buf);
    meta.hash = hash;
    meta.byteSize = buf.length;
    res.json({ status: 'STORED', sha256: hash });
  });

  app.post('/api/media/finalize', async (req, res) => {
    const cds = require('@sap/cds');
    const { MediaAssets } = cds.entities('rental.equipment');
    const meta = uploads.get(req.body.uploadID);
    if (!meta?.hash) return res.status(400).json({ error: { code: 'UPLOAD_INCOMPLETE' } });
    const row = {
      ID: crypto.randomUUID(),
      damage_ID: req.body.damageID || meta.damageID,
      conditionLog_ID: req.body.conditionLogID || meta.conditionLogID,
      storageProvider: 'local',
      objectKey: meta.key,
      originalFileName: req.body.fileName || 'photo.jpg',
      mimeType: meta.mimeType,
      byteSize: meta.byteSize,
      sha256: meta.hash,
      photoCategory: req.body.photoCategory || meta.photoCategory || 'DETAIL',
      capturedAt: req.body.capturedAt || new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      uploadedBy: (await currentUser(req)).id,
      uploadState: 'COMPLETE',
      version: 1,
      legalHold: true,
    };
    await INSERT.into(MediaAssets).entries(row);
    res.json({ ...row, readUrl: media.signedUrl(meta.key, 300) });
  });

  app.get('/api/media/object', async (req, res) => {
    const { key, exp, sig } = req.query;
    if (!media.verifySigned(String(key), exp, String(sig))) {
      return res.status(403).json({ error: { code: 'SIGNED_URL_EXPIRED_OR_INVALID' } });
    }
    try {
      const buf = await media.get(String(key));
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(buf);
    } catch {
      res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
  });

  app.post('/api/mobile/sync', async (req, res) => {
    try {
      const cds = require('@sap/cds');
      const { IdempotencyRecords } = cds.entities('rental.equipment');
      const ops = req.body?.operations || [];
      const existing = await SELECT.from(IdempotencyRecords);
      const keys = existing.map((e) => e.callerKey);
      const results = replayBatch(keys, ops);
      for (const r of results.filter((x) => x.status === 'APPLIED')) {
        await INSERT.into(IdempotencyRecords).entries({
          ID: crypto.randomUUID(),
          callerKey: r.id,
          operation: 'mobile-sync',
          responseRef: r.entityID,
          createdAt: new Date().toISOString(),
        });
      }
      res.json({
        cursor: new Date().toISOString(),
        results,
        warning: 'Device cannot claim live S/4 posting success',
      });
    } catch (err) {
      const status = err instanceof DomainError ? err.httpStatus : 500;
      res.status(status).json({ error: { code: err.code || 'SYNC_FAILED', message: err.message } });
    }
  });
}

module.exports = { mountRest };
