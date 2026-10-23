'use strict';

const crypto = require('crypto');
const { DomainError } = require('./lifecycle');

function classifyError(err) {
  const msg = String(err?.message || err || '');
  if (/timeout|TEMP|ECONN|429|503|unavailable/i.test(msg)) return 'TRANSIENT';
  if (/auth|401|403|validation|400|422/i.test(msg)) return 'PERMANENT';
  return 'TRANSIENT';
}

function backoffMs(attempts, base = 1000, cap = 300000) {
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempts - 1));
  const jitter = Math.floor(Math.random() * Math.min(1000, exp * 0.2));
  return exp + jitter;
}

function idempotencyKey(parts) {
  return crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex');
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function nextOutboxStatus(current, result) {
  if (result === 'SUCCESS') return 'SUCCEEDED';
  if (result === 'RECONCILED') return 'RECONCILED';
  if (result === 'AMBIGUOUS_TIMEOUT') return 'RETRY';
  if (result === 'PERMANENT_FAIL') return 'DEAD_LETTER';
  if (current === 'DEAD_LETTER') return 'DEAD_LETTER';
  return 'RETRY';
}

function assertNoBlindRetry(lastResult, existingExternalId) {
  if (lastResult === 'AMBIGUOUS_TIMEOUT' && !existingExternalId) {
    throw new DomainError(
      'Timeout occurred; reconcile the target system before creating another document',
      'RECONCILE_REQUIRED',
      409,
    );
  }
}

function maskPayload(payload) {
  const copy = typeof payload === 'string' ? JSON.parse(payload) : { ...payload };
  const secrets = ['password', 'token', 'authorization', 'secret', 'clientSecret'];
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      if (secrets.some((s) => k.toLowerCase().includes(s.toLowerCase()))) obj[k] = '***';
      else walk(obj[k]);
    }
  };
  walk(copy);
  return copy;
}

module.exports = {
  classifyError,
  backoffMs,
  idempotencyKey,
  sha256,
  nextOutboxStatus,
  assertNoBlindRetry,
  maskPayload,
};
