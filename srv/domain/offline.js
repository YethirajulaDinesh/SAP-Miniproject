'use strict';

const { DomainError } = require('./lifecycle');

function replayBatch(existingKeys, operations) {
  const results = [];
  const seen = new Set(existingKeys);
  for (const op of operations) {
    if (!op.clientOperationID) {
      results.push({ id: op.clientOperationID, status: 'ERROR', code: 'MISSING_OPERATION_ID' });
      continue;
    }
    if (seen.has(op.clientOperationID)) {
      results.push({
        id: op.clientOperationID,
        status: 'DUPLICATE',
        code: 'IDEMPOTENT_REPLAY',
        message: 'Already applied; no additional business document created',
      });
      continue;
    }
    if (op.type === 'POST_BILLING' && op.deviceOnly) {
      results.push({
        id: op.clientOperationID,
        status: 'REJECTED',
        code: 'DEVICE_CANNOT_CLAIM_POSTING',
        message: 'Device-only state cannot claim S/4 posting success',
      });
      continue;
    }
    seen.add(op.clientOperationID);
    results.push({ id: op.clientOperationID, status: 'APPLIED', entityID: op.entityID || op.clientOperationID });
  }
  return results;
}

function conflict(server, client) {
  if (server.version && client.baseVersion && Number(server.version) !== Number(client.baseVersion)) {
    throw new DomainError('Sync conflict: server version differs', 'SYNC_CONFLICT', 409);
  }
  return { winner: 'SERVER', server };
}

module.exports = { replayBatch, conflict };
