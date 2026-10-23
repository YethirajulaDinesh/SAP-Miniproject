import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const lc = require('../srv/domain/lifecycle');
const { calculateCharge, applyApprovalPolicy, assertChargeable } = require('../srv/domain/pricing');
const { replayBatch } = require('../srv/domain/offline');
const { nextOutboxStatus, assertNoBlindRetry, classifyError, maskPayload, sha256, idempotencyKey } = require('../srv/domain/outbox');

describe('lifecycle', () => {
  it('allows booked to checked out and rejects closed to booked', () => {
    lc.assertTransition(lc.RENTAL_TRANSITIONS, 'BOOKED', 'CHECKED_OUT', 'Rental');
    expect(() => lc.assertTransition(lc.RENTAL_TRANSITIONS, 'CLOSED', 'BOOKED', 'Rental')).toThrow(lc.DomainError);
  });
  it('computes inclusive rental totals', () => {
    expect(lc.computeRentalTotal([{ dailyRentalRate: 850, startDate: '2026-10-20', endDate: '2026-10-22' }])).toBe(2550);
  });
  it('derives overdue from expected return date', () => {
    expect(lc.isOverdue('2026-10-22', null, new Date('2026-10-23T00:00:00Z'))).toBe(true);
    expect(lc.isOverdue('2026-10-22', '2026-10-22', new Date('2026-10-23T00:00:00Z'))).toBe(false);
  });
  it('rejects overlapping equipment allocations', () => {
    const items = [{ equipment_ID: 'e1', status: 'CHECKED_OUT', startDate: '2026-10-20', endDate: '2026-10-25' }];
    expect(() => lc.assertEquipmentAvailableForPeriod(items, 'e1', '2026-10-22', '2026-10-28')).toThrow(/EQUIPMENT_CONFLICT/);
    lc.assertEquipmentAvailableForPeriod(items, 'e1', '2026-10-26', '2026-10-30');
  });
  it('blocks rental close until return inspections complete', () => {
    expect(() =>
      lc.assertCanCloseRental({ status: 'CHECKED_OUT' }, [{ status: 'CHECKED_OUT' }], []),
    ).toThrow(/RENTAL_NOT_RETURNED/);
    expect(() =>
      lc.assertCanCloseRental({ status: 'RETURNED' }, [{ status: 'RETURNED' }], [{ billingStatus: 'PENDING_APPROVAL' }]),
    ).toThrow(/INSPECTION_INCOMPLETE|BILLING_PENDING/);
    lc.assertCanCloseRental(
      { status: 'RETURNED' },
      [{ status: 'RETURNED', checkinConditionLog_ID: 'x' }],
      [{ billingStatus: 'POSTED' }],
    );
  });
  it('enforces plant scope and yard price hiding', () => {
    expect(lc.plantAllowed('P1000', 'P2000')).toBe(false);
    expect(lc.yardWorkerBlockedFromPrices(['YardWorker'])).toBe(true);
    expect(lc.isReadOnlyRole(['Auditor'])).toBe(true);
    expect(() => lc.assertTransition(lc.EQUIPMENT_TRANSITIONS, 'AVAILABLE', 'RENTED_OUT', 'Equipment')).toThrow();
  });
});

describe('pricing and liability', () => {
  it('fails closed without tax config', () => {
    expect(() => calculateCharge([{ kind: 'LABOR', amount: 100 }], { currency: 'USD' })).toThrow(/TAX_CONFIG/);
  });
  it('never trusts client totals and rounds', () => {
    const snap = calculateCharge(
      [
        { kind: 'LABOR', amount: 100 },
        { kind: 'PARTS', amount: 50.555 },
      ],
      { currency: 'USD', rate: 0.1, version: 1 },
    );
    expect(snap.repairSubtotal).toBe(150.56);
    expect(snap.taxAmount).toBe(15.06);
    expect(snap.totalAmount).toBe(165.62);
  });
  it('blocks pre-existing damage charges', () => {
    expect(() =>
      assertChargeable({
        newDamageComparedToCheckout: false,
        liabilityState: 'CUSTOMER_LIABLE',
        evidenceCount: 2,
        minPhotos: 1,
        hasEstimate: true,
      }),
    ).toThrow(/PREEXISTING/);
  });
  it('requires liability, evidence and estimate for new damage', () => {
    assertChargeable({
      newDamageComparedToCheckout: true,
      liabilityState: 'CUSTOMER_LIABLE',
      evidenceCount: 2,
      minPhotos: 1,
      hasEstimate: true,
    });
  });
  it('keeps auto-approval off until threshold is configured', () => {
    const snap = calculateCharge([{ kind: 'OTHER', amount: 20 }], { currency: 'USD', rate: 0 });
    const manual = applyApprovalPolicy(snap, { active: true, currency: 'USD', autoApprovalAllowed: false });
    expect(manual.requiresManualApproval).toBe(true);
    const auto = applyApprovalPolicy(snap, {
      active: true,
      currency: 'USD',
      autoApprovalAllowed: true,
      autoApprovalThreshold: 50,
    });
    expect(auto.autoApproved).toBe(true);
  });
});

describe('offline replay and outbox', () => {
  it('syncs two damages exactly once on retry', () => {
    const ops = [
      { clientOperationID: 'op-1', type: 'INSPECT' },
      { clientOperationID: 'op-2', type: 'DAMAGE' },
      { clientOperationID: 'op-3', type: 'DAMAGE' },
    ];
    const first = replayBatch([], ops);
    expect(first.filter((r) => r.status === 'APPLIED')).toHaveLength(3);
    const second = replayBatch(first.map((r) => r.id), ops);
    expect(second.every((r) => r.status === 'DUPLICATE')).toBe(true);
  });
  it('refuses device-only billing success claims', () => {
    const r = replayBatch([], [{ clientOperationID: 'b1', type: 'POST_BILLING', deviceOnly: true }]);
    expect(r[0].code).toBe('DEVICE_CANNOT_CLAIM_POSTING');
  });
  it('requires reconcile after timeout before another document', () => {
    expect(nextOutboxStatus('POSTING_PENDING', 'AMBIGUOUS_TIMEOUT')).toBe('RETRY');
    expect(() => assertNoBlindRetry('AMBIGUOUS_TIMEOUT', null)).toThrow(/RECONCILE/);
    expect(classifyError(new Error('TEMP timeout'))).toBe('TRANSIENT');
  });
  it('masks secrets and hashes media bytes', () => {
    const masked = maskPayload({ token: 'super', nested: { clientSecret: 'x' }, ok: 1 });
    expect(masked.token).toBe('***');
    expect(masked.nested.clientSecret).toBe('***');
    expect(sha256(Buffer.from('abc'))).toHaveLength(64);
    expect(idempotencyKey(['a', 'b'])).toBe(idempotencyKey(['a', 'b']));
  });
});
