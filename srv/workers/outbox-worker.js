'use strict';

const { classifyError, backoffMs, nextOutboxStatus } = require('../domain/outbox');
const { billing, MaintenanceNotificationProvider, MaintenanceOrderProvider } = require('../integrations/providers');

const notif = new MaintenanceNotificationProvider();
const order = new MaintenanceOrderProvider();

async function processOne(cds, row) {
  const { IntegrationOutbox } = cds.entities('rental.equipment');
  try {
    const payload = JSON.parse(row.payload || '{}');
    if (row.status === 'RETRY' && !payload.reconciled && /charge|bill/i.test(row.eventType)) {
      const existing = await billing.reconcile(row.idempotencyKey);
      if (existing) {
        await UPDATE(IntegrationOutbox, row.ID).with({
          status: 'RECONCILED',
          externalID: existing.externalDocumentID,
          processedAt: new Date().toISOString(),
          lastError: null,
        });
        return { status: 'RECONCILED', existing };
      }
    }
    let result;
    if (row.eventType === 'POST_REPAIR_CHARGE') {
      result = await billing.post({ ...payload, idempotencyKey: row.idempotencyKey });
    } else if (row.eventType === 'CREATE_MAINT_NOTIFICATION') {
      result = await notif.create(payload);
    } else if (row.eventType === 'CREATE_MAINT_ORDER') {
      result = await order.create(payload);
    } else {
      result = { simulated: true, externalID: 'MOCK-SKIP' };
    }
    const externalID = result.externalDocumentID || result.externalID || result.externalRequestID;
    await UPDATE(IntegrationOutbox, row.ID).with({
      status: nextOutboxStatus(row.status, 'SUCCESS'),
      externalID,
      processedAt: new Date().toISOString(),
      attempts: (row.attempts || 0) + 1,
      lastError: null,
    });
    return { status: 'SUCCEEDED', result };
  } catch (err) {
    const kind = classifyError(err);
    const attempts = (row.attempts || 0) + 1;
    const status = kind === 'PERMANENT' || attempts >= 8 ? 'DEAD_LETTER' : 'RETRY';
    await UPDATE(IntegrationOutbox, row.ID).with({
      status,
      attempts,
      lastError: String(err.message || err).slice(0, 1000),
      nextAttemptAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
    });
    return { status, error: err.message };
  }
}

async function drain(cds, limit = 10) {
  const { IntegrationOutbox } = cds.entities('rental.equipment');
  const due = await SELECT.from(IntegrationOutbox)
    .where({ status: { in: ['PENDING', 'RETRY'] } })
    .limit(limit);
  const results = [];
  for (const row of due) {
    if (row.nextAttemptAt && new Date(row.nextAttemptAt).getTime() > Date.now()) continue;
    results.push(await processOne(cds, row));
  }
  return results;
}

function start(cds) {
  const ms = Number(process.env.OUTBOX_POLL_MS || 5000);
  const timer = setInterval(() => {
    drain(cds).catch((err) => console.error('[outbox]', err.message));
  }, ms);
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { processOne, drain, start };
