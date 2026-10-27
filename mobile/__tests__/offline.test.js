'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { EncryptedQueue } = require('../src/offline/queue');
const { nextStep } = require('../src/domain/inspectionWizard');
const { replayBatch } = require('../../srv/lib/domain/offline');

describe('mobile offline queue', () => {
  it('replays idempotently and never claims S/4 success', () => {
    const q = new EncryptedQueue();
    q.enqueue({ clientOperationID: 'm1', type: 'INSPECT' });
    q.enqueue({ clientOperationID: 'm2', type: 'DAMAGE' });
    const results = replayBatch([], q.snapshot());
    assert.equal(results.length, 2);
    const again = replayBatch(results.map((r) => r.id), q.snapshot());
    assert.ok(again.every((r) => r.status === 'DUPLICATE'));
    const billing = replayBatch([], [{ clientOperationID: 'm3', type: 'POST_BILLING', deviceOnly: true }]);
    assert.equal(billing[0].code, 'DEVICE_CANNOT_CLAIM_POSTING');
  });

  it('blocks wizard submit without photos', () => {
    const s = nextStep({ step: 'photos', photos: [], minPhotos: 2 }, 'next');
    assert.equal(s.error, 'PHOTO_REQUIREMENT_NOT_MET');
  });
});
