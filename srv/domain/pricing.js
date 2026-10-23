'use strict';

const { DomainError, roundCurrency } = require('./lifecycle');

function calculateCharge(lines, tax) {
  if (!tax?.currency || String(tax.currency).length !== 3) {
    throw new DomainError('Currency is required for charge calculation', 'CURRENCY_REQUIRED', 422);
  }
  if (tax.rate == null) {
    throw new DomainError('Tax configuration is missing; fail closed', 'TAX_CONFIG_MISSING', 422);
  }
  const repairSubtotal = roundCurrency(
    (lines || []).reduce((s, l) => s + Number(l.amount || 0), 0),
    tax.currency,
  );
  const taxAmount = roundCurrency(repairSubtotal * Number(tax.rate), tax.currency);
  const totalAmount = roundCurrency(repairSubtotal + taxAmount, tax.currency);
  return {
    repairSubtotal,
    taxAmount,
    totalAmount,
    currency: tax.currency,
    taxRate: Number(tax.rate),
    taxRuleVersion: tax.version ?? null,
    autoApproved: false,
    requiresManualApproval: true,
    lines,
  };
}

function applyApprovalPolicy(snapshot, rule) {
  if (!rule || !rule.active) {
    return { ...snapshot, autoApproved: false, requiresManualApproval: true };
  }
  if (rule.currency !== snapshot.currency) {
    throw new DomainError('Approval rule currency mismatch', 'APPROVAL_CURRENCY_MISMATCH', 422);
  }
  const threshold = rule.autoApprovalThreshold;
  const auto =
    !!rule.autoApprovalAllowed &&
    threshold != null &&
    Number.isFinite(Number(threshold)) &&
    snapshot.totalAmount <= Number(threshold);
  return {
    ...snapshot,
    autoApproved: auto,
    requiresManualApproval: !auto,
  };
}

function assertChargeable(input) {
  if (!input.newDamageComparedToCheckout) {
    throw new DomainError('Pre-existing or unconfirmed damage cannot be charged', 'PREEXISTING_DAMAGE', 422);
  }
  if (input.liabilityState !== 'CUSTOMER_LIABLE') {
    throw new DomainError('Customer liability must be confirmed before charging', 'LIABILITY_NOT_CONFIRMED', 422);
  }
  if (input.evidenceCount < (input.minPhotos || 1)) {
    throw new DomainError('Required photographic evidence is missing', 'EVIDENCE_INCOMPLETE', 422);
  }
  if (!input.hasEstimate) {
    throw new DomainError('Repair estimate is required', 'ESTIMATE_REQUIRED', 422);
  }
}

module.exports = { calculateCharge, applyApprovalPolicy, assertChargeable };
