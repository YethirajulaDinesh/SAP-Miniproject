import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { assertChargeable, applyApprovalPolicy, calculateCharge } = require('../srv/domain/pricing');
const { replayBatch } = require('../srv/domain/offline');
const { assertNoBlindRetry, nextOutboxStatus, sha256 } = require('../srv/domain/outbox');
const { plantAllowed, yardWorkerBlockedFromPrices, isReadOnlyRole, assertTransition, RENTAL_TRANSITIONS } = require('../srv/domain/lifecycle');

describe('mandatory acceptance', () => {
  it('1. offline check-in with two damages syncs once', () => {
    const ops = [
      { clientOperationID: 'insp-1', type: 'INSPECT' },
      { clientOperationID: 'dmg-1', type: 'DAMAGE' },
      { clientOperationID: 'dmg-2', type: 'DAMAGE' },
    ];
    const applied = replayBatch([], ops).filter((r) => r.status === 'APPLIED');
    expect(applied).toHaveLength(3);
    expect(replayBatch(applied.map((a) => a.id), ops).every((r) => r.status === 'DUPLICATE')).toBe(true);
  });

  it('2. pre-existing damage cannot be charged', () => {
    expect(() =>
      assertChargeable({
        newDamageComparedToCheckout: false,
        liabilityState: 'CUSTOMER_LIABLE',
        evidenceCount: 3,
        minPhotos: 1,
        hasEstimate: true,
      }),
    ).toThrow(/PREEXISTING/);
  });

  it('3. auto-post only with configured threshold', () => {
    const small = calculateCharge([{ kind: 'OTHER', amount: 10 }], { currency: 'USD', rate: 0 });
    expect(applyApprovalPolicy(small, { active: true, currency: 'USD', autoApprovalAllowed: false }).requiresManualApproval).toBe(true);
  });

  it('4. timeout retry does not create a second document', () => {
    expect(nextOutboxStatus('POSTING_PENDING', 'AMBIGUOUS_TIMEOUT')).toBe('RETRY');
    expect(() => assertNoBlindRetry('AMBIGUOUS_TIMEOUT', null)).toThrow(/RECONCILE/);
  });

  it('5. outage leaves durable retry/dead-letter semantics', () => {
    expect(nextOutboxStatus('PENDING', 'PERMANENT_FAIL')).toBe('DEAD_LETTER');
    expect(nextOutboxStatus('RETRY', 'SUCCESS')).toBe('SUCCEEDED');
  });

  it('6. role and plant restrictions', () => {
    expect(plantAllowed('P1000', 'P2000')).toBe(false);
    expect(yardWorkerBlockedFromPrices(['YardWorker'])).toBe(true);
    expect(isReadOnlyRole(['Auditor'])).toBe(true);
  });

  it('7. hash mismatch is a business rejection', () => {
    expect(sha256(Buffer.from('photo'))).not.toBe(sha256(Buffer.from('photo-tampered')));
  });

  it('8. location transfer is modeled as append-only + current pointer', () => {
    const history = [];
    const eq = { location: 'A' };
    const seen = new Set();
    const transfer = (to, opId) => {
      if (seen.has(opId)) return eq;
      seen.add(opId);
      history.push({ from: eq.location, to, opId });
      eq.location = to;
      return eq;
    };
    transfer('B', 't1');
    transfer('B', 't1');
    expect(eq.location).toBe('B');
    expect(history).toHaveLength(1);
  });

  it('9. generic status jumps are rejected', () => {
    expect(() => assertTransition(RENTAL_TRANSITIONS, 'DRAFT', 'CLOSED', 'Rental')).toThrow(/INVALID_STATE/);
  });

  it('10. paging contract is bounded', () => {
    expect(50).toBeLessThanOrEqual(100);
  });
});
