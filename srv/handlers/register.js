'use strict';

const crypto = require('crypto');
const {
  DomainError,
  assertTransition,
  RENTAL_TRANSITIONS,
  EQUIPMENT_TRANSITIONS,
  DAMAGE_TRANSITIONS,
  BILL_TRANSITIONS,
  computeRentalTotal,
  isOverdue,
  yardWorkerBlockedFromPrices,
  isReadOnlyRole,
  plantAllowed,
  assertEquipmentAvailableForPeriod,
  assertCanCloseRental,
} = require('../domain/lifecycle');
const { hashPassword } = require('../auth/passwords');
const { calculateCharge, applyApprovalPolicy, assertChargeable } = require('../domain/pricing');
const { idempotencyKey } = require('../domain/outbox');

function userRoles(req) {
  const r = [];
  for (const name of ['YardWorker', 'Dispatcher', 'Technician', 'BillingClerk', 'Manager', 'Admin', 'Auditor']) {
    try {
      if (req.user?.is?.(name)) r.push(name);
    } catch {
      /* ignore */
    }
  }
  if (Array.isArray(req.user?.roles)) r.push(...req.user.roles);
  return [...new Set(r)];
}

function userPlant(req) {
  return req.user?.attr?.plant || req.user?.plant || 'P1000';
}

function actor(req) {
  return req.user?.id || req.user?.id || 'anonymous';
}

function correlation(req) {
  return req.headers?.['x-correlation-id'] || crypto.randomUUID();
}

function fail(req, err) {
  if (err instanceof DomainError) return req.reject(err.httpStatus, err.message);
  return req.error(err);
}

async function audit(cds, req, action, entityType, entityID, reason, summary) {
  const { AuditEvents } = cds.entities('rental.equipment');
  await INSERT.into(AuditEvents).entries({
    ID: crypto.randomUUID(),
    actor: actor(req),
    role: userRoles(req).join(','),
    plant: userPlant(req),
    action,
    entityType,
    entityID,
    occurredAt: new Date().toISOString(),
    correlationID: correlation(req),
    reason,
    summary,
  });
}

function assertWritable(req) {
  if (isReadOnlyRole(userRoles(req))) {
    throw new DomainError('Auditor is read-only', 'READ_ONLY', 403);
  }
}

function assertPlant(req, plant) {
  if (!plantAllowed(userPlant(req), plant)) {
    throw new DomainError('Cross-plant access is not allowed', 'PLANT_SCOPE', 403);
  }
}

function requireAny(req, allowed) {
  const r = userRoles(req);
  if (!r.some((x) => allowed.includes(x))) {
    req.reject(403, `FORBIDDEN: Requires role: ${allowed.join('|')}`);
  }
}

function hidePrices(req, data) {
  if (!yardWorkerBlockedFromPrices(userRoles(req))) return data;
  const strip = (row) => {
    if (!row || typeof row !== 'object') return row;
    const clone = { ...row };
    for (const k of Object.keys(clone)) {
      if (/rate|amount|price|cost|tax|total/i.test(k)) clone[k] = null;
    }
    return clone;
  };
  return Array.isArray(data) ? data.map(strip) : strip(data);
}

function register(cds) {
  const db = cds.entities('rental.equipment');
  const rentalSrv = cds.services.RentalManagementService;
  const conditionSrv = cds.services.ConditionManagementService;
  const damageSrv = cds.services.DamageManagementService;
  const maintSrv = cds.services.MaintenanceManagementService;
  const integSrv = cds.services.IntegrationMonitorService;
  const analyticsSrv = cds.services.AnalyticsService;
  const identitySrv = cds.services.IdentityService;

  const guardReads = (srv, entityNames) => {
    for (const name of entityNames) {
      srv.after('READ', name, (data, req) => hidePrices(req, data));
    }
    srv.before(['CREATE', 'UPDATE', 'DELETE', 'PATCH'], '*', (req) => {
      assertWritable(req);
    });
    srv.before('UPDATE', '*', (req) => {
      const forbidden = ['status', 'currentStatus', 'billingStatus', 'damageState', 'liabilityState', 'totalRentalAmount', 'totalAmount', 'taxAmount', 'externalDocumentID', 'externalRequestID', 's4EquipmentID', 's4BusinessPartnerID'];
      for (const f of forbidden) {
        if (req.data && Object.prototype.hasOwnProperty.call(req.data, f) && !req._allowStatus) {
          req.reject(403, `GENERIC_PATCH_FORBIDDEN: ${f} can only change via named actions`);
        }
      }
    });
  };

  guardReads(rentalSrv, ['Customers', 'Rentals', 'RentalItems', 'Equipment']);
  guardReads(damageSrv, ['DamageRecords', 'RepairBills']);
  guardReads(conditionSrv, ['ConditionLogs']);
  guardReads(maintSrv, ['MaintenanceRecords']);
  guardReads(analyticsSrv, ['Equipment', 'Rentals', 'RepairBills']);
  integSrv.before(['CREATE', 'UPDATE', 'DELETE'], '*', (req) => {
    if (userRoles(req).includes('Auditor') && !userRoles(req).includes('Admin')) {
      req.reject(403, 'Auditor cannot mutate integration records');
    }
  });

  const plantScoped = new Set(['Customers', 'Rentals', 'Equipment', 'Locations', 'ConditionLogs', 'MaintenanceRecords']);
  rentalSrv.before('READ', '*', (req) => {
    const plant = userPlant(req);
    const name = String(req.entity || req.path || '').split('.').pop();
    if (plant && plant !== '*' && plantScoped.has(name)) req.query.where({ plant });
  });

  rentalSrv.before(['CREATE', 'UPDATE', 'DELETE'], 'Customers', (req) => {
    requireAny(req, ['Dispatcher', 'Manager', 'Admin']);
  });
  rentalSrv.before(['CREATE', 'UPDATE', 'DELETE'], 'Equipment', (req) => {
    requireAny(req, ['Dispatcher', 'Manager', 'Admin']);
  });
  rentalSrv.before(['CREATE', 'UPDATE', 'DELETE'], 'Locations', (req) => {
    requireAny(req, ['Admin', 'Manager']);
  });
  rentalSrv.before(['CREATE', 'UPDATE', 'DELETE'], 'Rentals', (req) => {
    req.reject(403, 'Use createRental / bookRental / closeRental actions');
  });

  rentalSrv.on('createRental', async (req) => {
    try {
      assertWritable(req);
      requireAny(req, ['Dispatcher', 'Manager', 'Admin']);
      const { customerID, rentalDate, expectedReturnDate, plant } = req.data;
      const customer = await SELECT.one.from(db.Customers).where({ ID: customerID });
      if (!customer) return req.error(404, 'CUSTOMER_NOT_FOUND');
      const usePlant = plant || customer.plant || userPlant(req);
      assertPlant(req, usePlant);
      if (expectedReturnDate < rentalDate) return req.error(400, 'INVALID_DATE_RANGE');
      const row = {
        ID: crypto.randomUUID(),
        customer_ID: customerID,
        rentalDate,
        expectedReturnDate,
        status: 'DRAFT',
        currency: 'USD',
        totalRentalAmount: 0,
        dayCountConvention: 'INCLUSIVE_END_DATE',
        plant: usePlant,
      };
      await INSERT.into(db.Rentals).entries(row);
      await audit(cds, req, 'createRental', 'Rentals', row.ID);
      return row;
    } catch (e) {
      return fail(req, e);
    }
  });

  rentalSrv.on('addRentalItem', async (req) => {
    try {
      assertWritable(req);
      requireAny(req, ['Dispatcher', 'Manager', 'Admin']);
      const { rentalID, equipmentID, startDate, endDate } = req.data;
      const rental = await SELECT.one.from(db.Rentals).where({ ID: rentalID });
      const eq = await SELECT.one.from(db.Equipment).where({ ID: equipmentID });
      if (!rental || !eq) return req.error(404, 'NOT_FOUND');
      assertPlant(req, rental.plant);
      assertPlant(req, eq.plant);
      if (!['DRAFT', 'BOOKED'].includes(rental.status)) {
        throw new DomainError('Can only add items to DRAFT or BOOKED rentals', 'INVALID_STATE_TRANSITION', 409);
      }
      if (!['AVAILABLE', 'RESERVED'].includes(eq.currentStatus)) {
        throw new DomainError('Equipment is not available', 'EQUIPMENT_NOT_AVAILABLE', 409);
      }
      const others = await SELECT.from(db.RentalItems).where({ equipment_ID: equipmentID });
      assertEquipmentAvailableForPeriod(others, equipmentID, startDate, endDate);
      const item = {
        ID: crypto.randomUUID(),
        rental_ID: rental.ID,
        equipment_ID: eq.ID,
        dailyRentalRate: eq.defaultDailyRate,
        currency: eq.currency,
        startDate: startDate || rental.rentalDate,
        endDate: endDate || rental.expectedReturnDate,
        status: 'DRAFT',
      };
      await INSERT.into(db.RentalItems).entries(item);
      const items = await SELECT.from(db.RentalItems).where({ rental_ID: rental.ID });
      await UPDATE(db.Rentals, rental.ID).with({ totalRentalAmount: computeRentalTotal(items) });
      await audit(cds, req, 'addRentalItem', 'RentalItems', item.ID);
      return item;
    } catch (e) {
      return fail(req, e);
    }
  });

  rentalSrv.on('bookRental', async (req) => {
    try {
      assertWritable(req);
      requireAny(req, ['Dispatcher', 'Manager', 'Admin']);
      const rental = await SELECT.one.from(db.Rentals).where({ ID: req.data.rentalID });
      if (!rental) return req.error(404, 'RENTAL_NOT_FOUND');
      assertPlant(req, rental.plant);
      assertTransition(RENTAL_TRANSITIONS, rental.status, 'BOOKED', 'Rental');
      const items = await SELECT.from(db.RentalItems).where({ rental_ID: rental.ID });
      const total = computeRentalTotal(items);
      await UPDATE(db.Rentals, rental.ID).with({ status: 'BOOKED', totalRentalAmount: total });
      for (const item of items) {
        const eq = await SELECT.one.from(db.Equipment).where({ ID: item.equipment_ID });
        assertTransition(EQUIPMENT_TRANSITIONS, eq.currentStatus, 'RESERVED', 'Equipment');
        await UPDATE(db.Equipment, eq.ID).with({ currentStatus: 'RESERVED' });
        await UPDATE(db.RentalItems, item.ID).with({ status: 'RESERVED' });
      }
      await audit(cds, req, 'bookRental', 'Rentals', rental.ID, null, `total=${total}`);
      return await SELECT.one.from(db.Rentals).where({ ID: rental.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  rentalSrv.on('cancelRental', async (req) => {
    try {
      assertWritable(req);
      if (!req.data.reason) return req.error(400, 'REASON_REQUIRED');
      const rental = await SELECT.one.from(db.Rentals).where({ ID: req.data.rentalID });
      assertPlant(req, rental.plant);
      assertTransition(RENTAL_TRANSITIONS, rental.status, 'CANCELLED', 'Rental');
      await UPDATE(db.Rentals, rental.ID).with({ status: 'CANCELLED' });
      const items = await SELECT.from(db.RentalItems).where({ rental_ID: rental.ID });
      for (const item of items) {
        await UPDATE(db.Equipment, item.equipment_ID).with({ currentStatus: 'AVAILABLE' });
        await UPDATE(db.RentalItems, item.ID).with({ status: 'CANCELLED' });
      }
      await audit(cds, req, 'cancelRental', 'Rentals', rental.ID, req.data.reason);
      return await SELECT.one.from(db.Rentals).where({ ID: rental.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  rentalSrv.on('closeRental', async (req) => {
    try {
      assertWritable(req);
      requireAny(req, ['Dispatcher', 'Manager', 'Admin']);
      const rental = await SELECT.one.from(db.Rentals).where({ ID: req.data.rentalID });
      const items = await SELECT.from(db.RentalItems).where({ rental_ID: rental.ID });
      const bills = await SELECT.from(db.RepairBills).where({ rental_ID: rental.ID });
      assertCanCloseRental(rental, items, bills);
      assertTransition(RENTAL_TRANSITIONS, rental.status, 'CLOSED', 'Rental');
      await UPDATE(db.Rentals, rental.ID).with({
        status: 'CLOSED',
        actualReturnDate: rental.actualReturnDate || new Date().toISOString().slice(0, 10),
      });
      await audit(cds, req, 'closeRental', 'Rentals', rental.ID);
      return await SELECT.one.from(db.Rentals).where({ ID: rental.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  rentalSrv.on('transferLocation', async (req) => {
    try {
      assertWritable(req);
      requireAny(req, ['YardWorker', 'Dispatcher', 'Manager', 'Admin']);
      const { equipmentID, toLocationID, reason, clientOperationID } = req.data;
      if (!reason) return req.error(400, 'REASON_REQUIRED');
      const key = clientOperationID || crypto.randomUUID();
      const existing = await SELECT.one.from(db.IdempotencyRecords).where({ callerKey: key, operation: 'transferLocation' });
      if (existing) return SELECT.one.from(db.Equipment).where({ ID: equipmentID });
      const eq = await SELECT.one.from(db.Equipment).where({ ID: equipmentID });
      const dest = await SELECT.one.from(db.Locations).where({ ID: toLocationID });
      if (!eq || !dest) return req.error(404, 'NOT_FOUND');
      assertPlant(req, eq.plant);
      if (dest.plant !== eq.plant && userPlant(req) !== '*') {
        throw new DomainError('Cannot transfer across plants', 'PLANT_SCOPE', 403);
      }
      await cds.tx(req).run(async () => {
        await INSERT.into(db.EquipmentLocationHistory).entries({
          ID: crypto.randomUUID(),
          equipment_ID: eq.ID,
          fromLocation_ID: eq.currentLocation_ID,
          toLocation_ID: dest.ID,
          movedAt: new Date().toISOString(),
          movedBy: actor(req),
          reason,
          clientOperationID: key,
          externalSyncStatus: 'LOCAL',
        });
        await UPDATE(db.Equipment, eq.ID).with({ currentLocation_ID: dest.ID, version: (eq.version || 1) + 1 });
        await INSERT.into(db.IdempotencyRecords).entries({
          ID: crypto.randomUUID(),
          callerKey: key,
          operation: 'transferLocation',
          createdAt: new Date().toISOString(),
        });
      });
      await audit(cds, req, 'transferLocation', 'Equipment', eq.ID, reason);
      return await SELECT.one.from(db.Equipment).where({ ID: equipmentID });
    } catch (e) {
      return fail(req, e);
    }
  });

  rentalSrv.after('READ', 'Rentals', (data) => {
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      if (row) row.overdue = isOverdue(row.expectedReturnDate, row.actualReturnDate);
    }
    return data;
  });

  conditionSrv.on('startInspection', async (req) => {
    try {
      assertWritable(req);
      requireAny(req, ['YardWorker', 'Dispatcher', 'Technician', 'Manager', 'Admin']);
      const { equipmentID, rentalItemID, inspectionType, clientOperationID } = req.data;
      const key = clientOperationID || crypto.randomUUID();
      const existing = await SELECT.one.from(db.IdempotencyRecords).where({ callerKey: key, operation: 'startInspection' });
      if (existing?.responseRef) return SELECT.one.from(db.ConditionLogs).where({ ID: existing.responseRef });
      const eq = await SELECT.one.from(db.Equipment).where({ ID: equipmentID });
      assertPlant(req, eq.plant);
      const item = rentalItemID ? await SELECT.one.from(db.RentalItems).where({ ID: rentalItemID }) : null;
      const checklist = await SELECT.one.from(db.InspectionChecklists).where({ inspectionType, active: true });
      const log = {
        ID: crypto.randomUUID(),
        equipment_ID: equipmentID,
        rental_ID: item?.rental_ID,
        rentalItem_ID: rentalItemID,
        inspectionDateTime: new Date().toISOString(),
        inspectionType,
        conditionGrade: 'A',
        inspectorID: actor(req),
        inspectorName: actor(req),
        submissionState: 'DRAFT',
        clientOperationID: key,
        plant: eq.plant,
        checklist_ID: checklist?.ID,
      };
      if (inspectionType === 'CHECK_IN' && item?.checkoutConditionLog_ID) {
        log.baselineConditionLog_ID = item.checkoutConditionLog_ID;
      }
      await INSERT.into(db.ConditionLogs).entries(log);
      await INSERT.into(db.IdempotencyRecords).entries({
        ID: crypto.randomUUID(),
        callerKey: key,
        operation: 'startInspection',
        responseRef: log.ID,
        createdAt: new Date().toISOString(),
      });
      return log;
    } catch (e) {
      return fail(req, e);
    }
  });

  conditionSrv.on('submitInspection', async (req) => {
    try {
      assertWritable(req);
      const { inspectionID, grade, meterReading, notes, signaturePresent, answersJson, clientOperationID } = req.data;
      const log = await SELECT.one.from(db.ConditionLogs).where({ ID: inspectionID });
      if (!log) return req.error(404, 'INSPECTION_NOT_FOUND');
      if (log.submissionState === 'SUBMITTED') {
        return log;
      }
      if (!['A', 'B', 'C', 'D'].includes(grade)) return req.error(400, 'INVALID_GRADE');
      const reqPhotos = await SELECT.one.from(db.PhotoRequirements).where({ inspectionType: log.inspectionType });
      const photos = await SELECT.from(db.MediaAssets).where({ conditionLog_ID: log.ID });
      const min = reqPhotos?.minPhotos || 1;
      if ((photos?.length || 0) < min) return req.error(422, 'PHOTO_REQUIREMENT_NOT_MET');
      const answers = answersJson ? JSON.parse(answersJson) : [];
      for (const a of answers) {
        await INSERT.into(db.InspectionAnswers).entries({
          ID: crypto.randomUUID(),
          conditionLog_ID: log.ID,
          item_ID: a.itemID,
          value: a.value,
        });
      }
      await UPDATE(db.ConditionLogs, log.ID).with({
        conditionGrade: grade,
        meterReading,
        notes,
        signaturePresent: !!signaturePresent,
        submissionState: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
      });
      if (log.inspectionType === 'CHECK_OUT' && log.rentalItem_ID) {
        await UPDATE(db.RentalItems, log.rentalItem_ID).with({ status: 'CHECKED_OUT', checkoutConditionLog_ID: log.ID });
        await UPDATE(db.Equipment, log.equipment_ID).with({ currentStatus: 'RENTED_OUT' });
        const item = await SELECT.one.from(db.RentalItems).where({ ID: log.rentalItem_ID });
        await UPDATE(db.Rentals, item.rental_ID).with({ status: 'CHECKED_OUT' });
      }
      if (log.inspectionType === 'CHECK_IN' && log.rentalItem_ID) {
        await UPDATE(db.RentalItems, log.rentalItem_ID).with({ status: 'RETURNED', checkinConditionLog_ID: log.ID });
        const nextStatus = grade === 'D' ? 'QUARANTINED' : 'INSPECTION_PENDING';
        await UPDATE(db.Equipment, log.equipment_ID).with({ currentStatus: nextStatus });
        const item = await SELECT.one.from(db.RentalItems).where({ ID: log.rentalItem_ID });
        const siblings = await SELECT.from(db.RentalItems).where({ rental_ID: item.rental_ID });
        const allBack = siblings.every((s) => s.ID === item.ID || s.status === 'RETURNED');
        await UPDATE(db.Rentals, item.rental_ID).with({
          status: allBack ? 'RETURNED' : 'PARTIALLY_RETURNED',
          actualReturnDate: allBack ? new Date().toISOString().slice(0, 10) : null,
        });
      }
      if (clientOperationID) {
        await INSERT.into(db.IdempotencyRecords).entries({
          ID: crypto.randomUUID(),
          callerKey: clientOperationID,
          operation: 'submitInspection',
          responseRef: log.ID,
          createdAt: new Date().toISOString(),
        });
      }
      await audit(cds, req, 'submitInspection', 'ConditionLogs', log.ID);
      return await SELECT.one.from(db.ConditionLogs).where({ ID: log.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  conditionSrv.on('recordDamage', async (req) => {
    try {
      assertWritable(req);
      requireAny(req, ['YardWorker', 'Dispatcher', 'Technician', 'Manager', 'Admin']);
      const log = await SELECT.one.from(db.ConditionLogs).where({ ID: req.data.inspectionID });
      if (!log) return req.error(404, 'INSPECTION_NOT_FOUND');
      const dmg = {
        ID: crypto.randomUUID(),
        conditionLog_ID: log.ID,
        damageType: req.data.damageType,
        description: req.data.description,
        severity: req.data.severity || 'MEDIUM',
        repairEstimate: req.data.repairEstimate,
        currency: 'USD',
        liabilityState: 'PENDING_REVIEW',
        damageState: 'OPEN',
        newDamageComparedToCheckout: !!req.data.newDamageComparedToCheckout,
      };
      await INSERT.into(db.DamageRecords).entries(dmg);
      await audit(cds, req, 'recordDamage', 'DamageRecords', dmg.ID);
      return dmg;
    } catch (e) {
      return fail(req, e);
    }
  });

  conditionSrv.on('compareWithBaseline', async (req) => {
    const log = await SELECT.one.from(db.ConditionLogs).where({ ID: req.data.inspectionID });
    if (!log?.baselineConditionLog_ID) return JSON.stringify({ hasBaseline: false });
    const baseline = await SELECT.one.from(db.ConditionLogs).where({ ID: log.baselineConditionLog_ID });
    const basePhotos = await SELECT.from(db.MediaAssets).where({ conditionLog_ID: baseline.ID });
    const nowPhotos = await SELECT.from(db.MediaAssets).where({ conditionLog_ID: log.ID });
    return JSON.stringify({
      hasBaseline: true,
      baselineGrade: baseline.conditionGrade,
      returnGrade: log.conditionGrade,
      baselinePhotos: basePhotos.map((p) => p.ID),
      returnPhotos: nowPhotos.map((p) => p.ID),
      requiresHumanConfirmation: true,
    });
  });

  conditionSrv.before('UPDATE', 'ConditionLogs', (req) => {
    req.reject(409, 'INSPECTION_IMMUTABLE: submitted inspections can only be corrected via addendum records');
  });

  damageSrv.on('confirmLiability', async (req) => {
    try {
      assertWritable(req);
      const { damageID, liabilityState, newDamageComparedToCheckout, reason } = req.data;
      const dmg = await SELECT.one.from(db.DamageRecords).where({ ID: damageID });
      if (!reason && ['NOT_CUSTOMER_LIABLE', 'WAIVED', 'DISPUTED'].includes(liabilityState)) {
        return req.error(400, 'REASON_REQUIRED');
      }
      assertTransition(DAMAGE_TRANSITIONS, dmg.damageState, 'UNDER_REVIEW', 'Damage');
      await UPDATE(db.DamageRecords, dmg.ID).with({
        liabilityState,
        customerLiable: liabilityState === 'CUSTOMER_LIABLE',
        newDamageComparedToCheckout: !!newDamageComparedToCheckout,
        newDamageConfirmedBy: actor(req),
        newDamageConfirmedAt: new Date().toISOString(),
        reviewReason: reason,
        damageState: 'UNDER_REVIEW',
      });
      await audit(cds, req, 'confirmLiability', 'DamageRecords', dmg.ID, reason);
      return await SELECT.one.from(db.DamageRecords).where({ ID: dmg.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  async function buildBill(req, damageID) {
    const dmg = await SELECT.one.from(db.DamageRecords).where({ ID: damageID });
    const photos = await SELECT.from(db.MediaAssets).where({ damage_ID: damageID });
    const lines = await SELECT.from(db.RepairWorkActuals).where({ damage_ID: damageID });
    const costLines = lines.length
      ? lines.map((l) => ({ kind: l.kind, amount: Number(l.amount), description: l.description }))
      : [{ kind: 'OTHER', amount: Number(dmg.repairEstimate || 0), description: 'Estimate snapshot' }];
    assertChargeable({
      newDamageComparedToCheckout: dmg.newDamageComparedToCheckout,
      liabilityState: dmg.liabilityState,
      evidenceCount: photos.length,
      minPhotos: 1,
      hasEstimate: dmg.repairEstimate != null,
    });
    const tax = await SELECT.one.from(db.TaxRules).where({ currency: dmg.currency, active: true });
    const approval = await SELECT.one.from(db.ApprovalRules).where({ currency: dmg.currency, active: true });
    const snapshot = applyApprovalPolicy(
      calculateCharge(costLines, { currency: dmg.currency, rate: tax?.rate, version: tax?.version, taxCode: tax?.taxCode }),
      approval,
    );
    return { dmg, snapshot, approval, tax, costLines };
  }

  damageSrv.on('requestApproval', async (req) => {
    try {
      assertWritable(req);
      const { dmg, snapshot, approval, costLines } = await buildBill(req, req.data.damageID);
      const posted = await SELECT.one.from(db.RepairBills).where({ damage_ID: dmg.ID, billingStatus: { in: ['POSTED', 'POSTING_PENDING', 'APPROVED'] } });
      if (posted) throw new DomainError('Active charge already exists for this damage', 'DUPLICATE_CHARGE', 409);
      const log = await SELECT.one.from(db.ConditionLogs).where({ ID: dmg.conditionLog_ID });
      const item = log.rentalItem_ID ? await SELECT.one.from(db.RentalItems).where({ ID: log.rentalItem_ID }) : null;
      const bill = {
        ID: crypto.randomUUID(),
        damage_ID: dmg.ID,
        rental_ID: item?.rental_ID,
        customer_ID: item ? (await SELECT.one.from(db.Rentals).where({ ID: item.rental_ID })).customer_ID : null,
        billDate: new Date().toISOString().slice(0, 10),
        repairAmount: snapshot.repairSubtotal,
        taxAmount: snapshot.taxAmount,
        totalAmount: snapshot.totalAmount,
        currency: snapshot.currency,
        billingStatus: snapshot.autoApproved ? 'APPROVED' : 'PENDING_APPROVAL',
        taxRuleVersion: snapshot.taxRuleVersion,
        approvalRuleVersion: approval?.version,
        calculationSnapshot: JSON.stringify(snapshot),
        idempotencyKey: idempotencyKey(['charge', dmg.ID]),
        simulated: true,
      };
      await INSERT.into(db.RepairBills).entries(bill);
      for (const line of costLines) {
        await INSERT.into(db.RepairBillLines).entries({
          ID: crypto.randomUUID(),
          bill_ID: bill.ID,
          kind: line.kind,
          description: line.description,
          amount: line.amount,
          currency: snapshot.currency,
        });
      }
      await audit(cds, req, 'requestApproval', 'RepairBills', bill.ID);
      return bill;
    } catch (e) {
      return fail(req, e);
    }
  });

  function requireFinance(req) {
    const r = userRoles(req);
    if (!r.some((x) => ['BillingClerk', 'Manager', 'Admin'].includes(x))) {
      throw new DomainError('Insufficient role for billing actions', 'FORBIDDEN', 403);
    }
  }

  damageSrv.on('approveCharge', async (req) => {
    try {
      assertWritable(req);
      requireFinance(req);
      if (!req.data.reason) return req.error(400, 'REASON_REQUIRED');
      const bill = await SELECT.one.from(db.RepairBills).where({ ID: req.data.billID });
      assertTransition(BILL_TRANSITIONS, bill.billingStatus, 'APPROVED', 'RepairBill');
      await UPDATE(db.RepairBills, bill.ID).with({ billingStatus: 'APPROVED', approvalReason: req.data.reason });
      await audit(cds, req, 'approveCharge', 'RepairBills', bill.ID, req.data.reason);
      return await SELECT.one.from(db.RepairBills).where({ ID: bill.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  damageSrv.on('adjustCharge', async (req) => {
    try {
      assertWritable(req);
      requireFinance(req);
      if (!req.data.reason) return req.error(400, 'REASON_REQUIRED');
      const bill = await SELECT.one.from(db.RepairBills).where({ ID: req.data.billID });
      assertTransition(BILL_TRANSITIONS, bill.billingStatus, 'ADJUSTMENT_REQUIRED', 'RepairBill');
      const lines = JSON.parse(req.data.linesJson || '[]');
      const tax = await SELECT.one.from(db.TaxRules).where({ currency: bill.currency, active: true });
      const snapshot = calculateCharge(lines, { currency: bill.currency, rate: tax?.rate, version: tax?.version });
      await UPDATE(db.RepairBills, bill.ID).with({
        billingStatus: 'PENDING_APPROVAL',
        repairAmount: snapshot.repairSubtotal,
        taxAmount: snapshot.taxAmount,
        totalAmount: snapshot.totalAmount,
        calculationSnapshot: JSON.stringify(snapshot),
        approvalReason: req.data.reason,
      });
      await audit(cds, req, 'adjustCharge', 'RepairBills', bill.ID, req.data.reason);
      return await SELECT.one.from(db.RepairBills).where({ ID: bill.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  damageSrv.on('rejectCharge', async (req) => {
    try {
      assertWritable(req);
      requireFinance(req);
      if (!req.data.reason) return req.error(400, 'REASON_REQUIRED');
      const bill = await SELECT.one.from(db.RepairBills).where({ ID: req.data.billID });
      assertTransition(BILL_TRANSITIONS, bill.billingStatus, 'REJECTED', 'RepairBill');
      await UPDATE(db.RepairBills, bill.ID).with({ billingStatus: 'REJECTED', rejectionReason: req.data.reason });
      await audit(cds, req, 'rejectCharge', 'RepairBills', bill.ID, req.data.reason);
      return await SELECT.one.from(db.RepairBills).where({ ID: bill.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  damageSrv.on('disputeCharge', async (req) => {
    try {
      assertWritable(req);
      requireFinance(req);
      if (!req.data.reason) return req.error(400, 'REASON_REQUIRED');
      const bill = await SELECT.one.from(db.RepairBills).where({ ID: req.data.billID });
      assertTransition(BILL_TRANSITIONS, bill.billingStatus, 'DISPUTED', 'RepairBill');
      await UPDATE(db.RepairBills, bill.ID).with({ billingStatus: 'DISPUTED', rejectionReason: req.data.reason });
      await UPDATE(db.DamageRecords, bill.damage_ID).with({ damageState: 'DISPUTED' });
      await audit(cds, req, 'disputeCharge', 'RepairBills', bill.ID, req.data.reason);
      return await SELECT.one.from(db.RepairBills).where({ ID: bill.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  damageSrv.on('postCharge', async (req) => {
    try {
      assertWritable(req);
      requireFinance(req);
      const bill = await SELECT.one.from(db.RepairBills).where({ ID: req.data.billID });
      if (bill.billingStatus !== 'APPROVED') {
        throw new DomainError('Charge must be approved before posting', 'NOT_APPROVED', 409);
      }
      await cds.tx(req).run(async () => {
        await UPDATE(db.RepairBills, bill.ID).with({ billingStatus: 'POSTING_PENDING' });
        await INSERT.into(db.IntegrationOutbox).entries({
          ID: crypto.randomUUID(),
          eventType: 'POST_REPAIR_CHARGE',
          aggregateID: bill.ID,
          targetSystem: 'S4',
          payload: JSON.stringify({ billID: bill.ID, amount: bill.totalAmount, currency: bill.currency, simulated: true }),
          idempotencyKey: bill.idempotencyKey,
          status: 'PENDING',
          simulated: true,
        });
      });
      await audit(cds, req, 'postCharge', 'RepairBills', bill.ID);
      return await SELECT.one.from(db.RepairBills).where({ ID: bill.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  maintSrv.on('createRepairJob', async (req) => {
    try {
      assertWritable(req);
      const eq = await SELECT.one.from(db.Equipment).where({ ID: req.data.equipmentID });
      assertPlant(req, eq.plant);
      if (!['QUARANTINED', 'DAMAGED', 'INSPECTION_PENDING'].includes(eq.currentStatus)) {
        assertTransition(EQUIPMENT_TRANSITIONS, eq.currentStatus, 'IN_REPAIR', 'Equipment');
      }
      const rec = {
        ID: crypto.randomUUID(),
        equipment_ID: eq.ID,
        maintenanceType: 'REPAIR',
        date: new Date().toISOString().slice(0, 10),
        description: req.data.description,
        status: 'OPEN',
        plant: eq.plant,
        currency: eq.currency,
      };
      await INSERT.into(db.MaintenanceRecords).entries(rec);
      await UPDATE(db.Equipment, eq.ID).with({ currentStatus: 'IN_REPAIR' });
      await INSERT.into(db.IntegrationOutbox).entries({
        ID: crypto.randomUUID(),
        eventType: 'CREATE_MAINT_NOTIFICATION',
        aggregateID: rec.ID,
        payload: JSON.stringify({ equipment: eq.s4EquipmentID || eq.ID, simulated: true }),
        idempotencyKey: idempotencyKey(['maint', rec.ID]),
        status: 'PENDING',
        simulated: true,
      });
      return rec;
    } catch (e) {
      return fail(req, e);
    }
  });

  maintSrv.on('assignTechnician', async (req) => {
    try {
      assertWritable(req);
      await UPDATE(db.MaintenanceRecords, req.data.maintenanceID).with({ assignedTechnician: req.data.technicianID, status: 'ASSIGNED' });
      return SELECT.one.from(db.MaintenanceRecords).where({ ID: req.data.maintenanceID });
    } catch (e) {
      return fail(req, e);
    }
  });

  maintSrv.on('recordActuals', async (req) => {
    try {
      assertWritable(req);
      await UPDATE(db.MaintenanceRecords, req.data.maintenanceID).with({
        cost: req.data.cost,
        currency: req.data.currency,
        description: req.data.notes,
      });
      return SELECT.one.from(db.MaintenanceRecords).where({ ID: req.data.maintenanceID });
    } catch (e) {
      return fail(req, e);
    }
  });

  maintSrv.on('completeRepair', async (req) => {
    try {
      assertWritable(req);
      const rec = await SELECT.one.from(db.MaintenanceRecords).where({ ID: req.data.maintenanceID });
      await UPDATE(db.MaintenanceRecords, rec.ID).with({ status: 'COMPLETED' });
      await UPDATE(db.Equipment, rec.equipment_ID).with({ currentStatus: 'INSPECTION_PENDING' });
      return SELECT.one.from(db.MaintenanceRecords).where({ ID: rec.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  maintSrv.on('releaseQuarantine', async (req) => {
    try {
      assertWritable(req);
      const r = userRoles(req);
      if (!r.some((x) => ['Technician', 'Manager', 'Admin'].includes(x))) {
        throw new DomainError('Technician or manager required to release quarantine', 'FORBIDDEN', 403);
      }
      const insp = await SELECT.one.from(db.ConditionLogs).where({ ID: req.data.inspectionID });
      if (insp?.submissionState !== 'SUBMITTED') throw new DomainError('Post-maintenance inspection required', 'INSPECTION_REQUIRED', 422);
      await UPDATE(db.Equipment, req.data.equipmentID).with({ currentStatus: 'AVAILABLE' });
      await audit(cds, req, 'releaseQuarantine', 'Equipment', req.data.equipmentID);
      return SELECT.one.from(db.Equipment).where({ ID: req.data.equipmentID });
    } catch (e) {
      return fail(req, e);
    }
  });

  integSrv.on('retryMessage', async (req) => {
    try {
      assertWritable(req);
      if (userRoles(req).includes('Auditor')) throw new DomainError('Auditor cannot retry', 'FORBIDDEN', 403);
      const row = await SELECT.one.from(db.IntegrationOutbox).where({ ID: req.data.outboxID });
      await UPDATE(db.IntegrationOutbox, row.ID).with({ status: 'RETRY', nextAttemptAt: new Date().toISOString() });
      const { processOne } = require('../workers/outbox-worker');
      await processOne(cds, { ...row, status: 'RETRY' });
      await audit(cds, req, 'retryMessage', 'IntegrationOutbox', row.ID);
      return SELECT.one.from(db.IntegrationOutbox).where({ ID: row.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  integSrv.on('reconcileMessage', async (req) => {
    try {
      const { billing } = require('../integrations/providers');
      const row = await SELECT.one.from(db.IntegrationOutbox).where({ ID: req.data.outboxID });
      const existing = await billing.reconcile(row.idempotencyKey);
      if (existing) {
        await UPDATE(db.IntegrationOutbox, row.ID).with({
          status: 'RECONCILED',
          externalID: existing.externalDocumentID,
          processedAt: new Date().toISOString(),
        });
        if (row.aggregateID) {
          await UPDATE(db.RepairBills, row.aggregateID).with({
            billingStatus: 'POSTED',
            externalDocumentID: existing.externalDocumentID,
            externalRequestID: existing.externalRequestID,
            postedAt: new Date().toISOString(),
          });
        }
      }
      await audit(cds, req, 'reconcileMessage', 'IntegrationOutbox', row.ID);
      return SELECT.one.from(db.IntegrationOutbox).where({ ID: row.ID });
    } catch (e) {
      return fail(req, e);
    }
  });

  if (identitySrv) {
    identitySrv.before(['CREATE', 'UPDATE', 'DELETE', 'READ'], 'AppUsers', (req) => {
      requireAny(req, ['Admin']);
      if (req.data && req.data.passwordHash) delete req.data.passwordHash;
    });
    identitySrv.on('createUser', async (req) => {
      try {
        requireAny(req, ['Admin']);
        const { username, displayName, password, role, plant, email } = req.data;
        const allowed = ['YardWorker', 'Dispatcher', 'Technician', 'BillingClerk', 'Manager', 'Admin', 'Auditor'];
        if (!allowed.includes(role)) return req.error(400, 'INVALID_ROLE');
        const exists = await SELECT.one.from(db.AppUsers).where({ username });
        if (exists) return req.error(409, 'USER_EXISTS');
        const row = {
          ID: crypto.randomUUID(),
          username,
          displayName,
          passwordHash: hashPassword(password),
          role,
          plant: plant || 'P1000',
          email,
          active: true,
        };
        await INSERT.into(db.AppUsers).entries(row);
        await audit(cds, req, 'createUser', 'AppUsers', row.ID);
        delete row.passwordHash;
        return row;
      } catch (e) {
        return fail(req, e);
      }
    });
    identitySrv.on('setUserActive', async (req) => {
      try {
        requireAny(req, ['Admin']);
        await UPDATE(db.AppUsers, req.data.userID).with({ active: !!req.data.active });
        const row = await SELECT.one.from(db.AppUsers).columns('ID', 'username', 'displayName', 'role', 'plant', 'active', 'email').where({ ID: req.data.userID });
        return row;
      } catch (e) {
        return fail(req, e);
      }
    });
  }

  integSrv.on('runMasterDataSync', async (req) => {
    const run = {
      ID: crypto.randomUUID(),
      syncType: req.data.syncType || 'ALL',
      startedAt: new Date().toISOString(),
      status: 'SIMULATED',
      triggeredBy: actor(req),
      correlationID: correlation(req),
      countSuccess: 0,
      countError: 0,
      cursor: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    };
    await INSERT.into(db.IntegrationSyncRuns).entries(run);
    return run;
  });

  return true;
}

module.exports = { register, userRoles, userPlant, actor };
