'use strict';

const RENTAL_TRANSITIONS = {
  DRAFT: ['BOOKED', 'CANCELLED'],
  BOOKED: ['CHECKED_OUT', 'CANCELLED'],
  CHECKED_OUT: ['PARTIALLY_RETURNED', 'RETURNED', 'CANCELLED'],
  PARTIALLY_RETURNED: ['RETURNED', 'CANCELLED'],
  RETURNED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

const EQUIPMENT_TRANSITIONS = {
  AVAILABLE: ['RESERVED', 'RETIRED', 'QUARANTINED'],
  RESERVED: ['RENTED_OUT', 'AVAILABLE', 'RETIRED'],
  RENTED_OUT: ['INSPECTION_PENDING', 'QUARANTINED', 'DAMAGED'],
  INSPECTION_PENDING: ['AVAILABLE', 'QUARANTINED', 'DAMAGED', 'IN_REPAIR'],
  QUARANTINED: ['IN_REPAIR', 'INSPECTION_PENDING'],
  DAMAGED: ['IN_REPAIR', 'QUARANTINED'],
  IN_REPAIR: ['INSPECTION_PENDING'],
  RETIRED: [],
};

const DAMAGE_TRANSITIONS = {
  OPEN: ['UNDER_REVIEW', 'DISPUTED', 'CLOSED'],
  UNDER_REVIEW: ['APPROVED_FOR_REPAIR', 'DISPUTED', 'CLOSED'],
  APPROVED_FOR_REPAIR: ['IN_REPAIR', 'DISPUTED'],
  IN_REPAIR: ['REPAIRED'],
  REPAIRED: ['CLOSED'],
  DISPUTED: ['UNDER_REVIEW', 'CLOSED'],
  CLOSED: [],
};

const BILL_TRANSITIONS = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'ADJUSTMENT_REQUIRED', 'REJECTED', 'DISPUTED', 'WAIVED'],
  ADJUSTMENT_REQUIRED: ['PENDING_APPROVAL', 'REJECTED'],
  APPROVED: ['POSTING_PENDING'],
  POSTING_PENDING: ['POSTED', 'POSTING_FAILED', 'POSTING_PENDING'],
  POSTING_FAILED: ['POSTING_PENDING', 'REJECTED'],
  REJECTED: [],
  DISPUTED: ['PENDING_APPROVAL', 'WAIVED'],
  WAIVED: [],
  POSTED: [],
};

class DomainError extends Error {
  constructor(message, code, httpStatus = 400) {
    super(`${code}: ${message}`);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function assertTransition(map, from, to, entity) {
  const allowed = map[from] || [];
  if (!allowed.includes(to)) {
    throw new DomainError(`${entity} cannot move from ${from} to ${to}`, 'INVALID_STATE_TRANSITION', 409);
  }
}

function isOverdue(expectedReturnDate, actualReturnDate, now = new Date()) {
  if (actualReturnDate) return false;
  const expected = new Date(`${expectedReturnDate}T23:59:59.000Z`);
  return now.getTime() > expected.getTime();
}

function inclusiveDayCount(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    throw new DomainError('Invalid rental period', 'INVALID_DATE_RANGE');
  }
  return Math.floor((end - start) / 86400000) + 1;
}

function computeRentalTotal(items) {
  return items.reduce((sum, item) => {
    const days = inclusiveDayCount(item.startDate, item.endDate);
    return sum + Number(item.dailyRentalRate) * days;
  }, 0);
}

function roundCurrency(amount, currency = 'USD') {
  const digits = currency === 'JPY' ? 0 : 2;
  const factor = 10 ** digits;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

function canSeePrices(roles = []) {
  return !roles.includes('YardWorker') || roles.some((r) => ['BillingClerk', 'Manager', 'Admin', 'Dispatcher', 'Technician', 'Auditor'].includes(r) && r !== 'YardWorker');
}

function yardWorkerBlockedFromPrices(roles = []) {
  return roles.includes('YardWorker') && !roles.some((r) => ['BillingClerk', 'Manager', 'Admin'].includes(r));
}

function isReadOnlyRole(roles = []) {
  return roles.includes('Auditor') && roles.length === 1;
}

function datesOverlap(aStart, aEnd, bStart, bEnd) {
  return String(aStart) <= String(bEnd) && String(bStart) <= String(aEnd);
}

function assertEquipmentAvailableForPeriod(existingItems, equipmentID, startDate, endDate) {
  const blocking = ['RESERVED', 'CHECKED_OUT'];
  const clash = (existingItems || []).find(
    (i) => i.equipment_ID === equipmentID && blocking.includes(i.status) && datesOverlap(i.startDate, i.endDate, startDate, endDate),
  );
  if (clash) {
    throw new DomainError('Equipment is already allocated for overlapping dates', 'EQUIPMENT_CONFLICT', 409);
  }
}

function assertCanCloseRental(rental, items, pendingBills) {
  if (!['RETURNED'].includes(rental.status)) {
    throw new DomainError('Rental can close only after all items are returned', 'RENTAL_NOT_RETURNED', 409);
  }
  if (!(items || []).length) {
    throw new DomainError('Rental has no items', 'RENTAL_EMPTY', 422);
  }
  const incomplete = items.find((i) => i.status !== 'RETURNED' || !i.checkinConditionLog_ID);
  if (incomplete) {
    throw new DomainError('Every item needs a submitted check-in inspection before closure', 'INSPECTION_INCOMPLETE', 422);
  }
  const blockingBill = (pendingBills || []).find((b) =>
    ['DRAFT', 'PENDING_APPROVAL', 'POSTING_PENDING'].includes(b.billingStatus),
  );
  if (blockingBill) {
    throw new DomainError('Resolve outstanding repair-charge approvals before closure', 'BILLING_PENDING', 422);
  }
}

function plantAllowed(userPlant, recordPlant) {
  if (!userPlant || userPlant === '*') return true;
  return userPlant === recordPlant;
}

module.exports = {
  RENTAL_TRANSITIONS,
  EQUIPMENT_TRANSITIONS,
  DAMAGE_TRANSITIONS,
  BILL_TRANSITIONS,
  DomainError,
  assertTransition,
  isOverdue,
  inclusiveDayCount,
  computeRentalTotal,
  roundCurrency,
  canSeePrices,
  yardWorkerBlockedFromPrices,
  isReadOnlyRole,
  plantAllowed,
  datesOverlap,
  assertEquipmentAvailableForPeriod,
  assertCanCloseRental,
};
