using {rental.equipment as db} from '../db/schema';

@path    : '/odata/v4/rental'
@requires: 'authenticated-user'
service RentalManagementService {
  entity Customers               as projection on db.Customers;
  entity Rentals                 as projection on db.Rentals;
  entity RentalItems             as projection on db.RentalItems;
  entity Equipment               as projection on db.Equipment;
  entity Locations               as projection on db.Locations;
  @readonly
  entity ConditionLogs           as projection on db.ConditionLogs;
  @readonly
  entity MaintenanceRecords      as projection on db.MaintenanceRecords;
  @readonly
  entity EquipmentLocationHistory as projection on db.EquipmentLocationHistory;

  action createRental(
    customerID: UUID,
    rentalDate: Date,
    expectedReturnDate: Date,
    plant: String
  ) returns Rentals;

  action addRentalItem(
    rentalID: UUID,
    equipmentID: UUID,
    startDate: Date,
    endDate: Date
  ) returns RentalItems;

  action bookRental(rentalID: UUID) returns Rentals;
  action cancelRental(rentalID: UUID, reason: String) returns Rentals;
  action closeRental(rentalID: UUID) returns Rentals;
  action transferLocation(
    equipmentID: UUID,
    toLocationID: UUID,
    reason: String,
    clientOperationID: UUID
  ) returns Equipment;
}

@path    : '/odata/v4/condition'
@requires: 'authenticated-user'
service ConditionManagementService {
  entity ConditionLogs            as projection on db.ConditionLogs;
  entity InspectionChecklists     as projection on db.InspectionChecklists;
  entity InspectionChecklistItems as projection on db.InspectionChecklistItems;
  entity InspectionAnswers        as projection on db.InspectionAnswers;
  entity DamageRecords            as projection on db.DamageRecords;

  action startInspection(
    equipmentID: UUID,
    rentalItemID: UUID,
    inspectionType: String,
    clientOperationID: UUID
  ) returns ConditionLogs;

  action submitInspection(
    inspectionID: UUID,
    grade: String,
    meterReading: Decimal,
    notes: String,
    signaturePresent: Boolean,
    answersJson: String,
    clientOperationID: UUID
  ) returns ConditionLogs;

  action recordDamage(
    inspectionID: UUID,
    damageType: String,
    description: String,
    severity: String,
    repairEstimate: Decimal,
    newDamageComparedToCheckout: Boolean
  ) returns DamageRecords;

  function compareWithBaseline(inspectionID: UUID) returns String;
}

@path    : '/odata/v4/damage'
@requires: 'authenticated-user'
service DamageManagementService {
  entity DamageRecords     as projection on db.DamageRecords;
  entity MediaAssets       as projection on db.MediaAssets;
  entity RepairBills       as projection on db.RepairBills;
  entity RepairBillLines   as projection on db.RepairBillLines;
  entity RepairWorkActuals as projection on db.RepairWorkActuals;
  entity DamageCatalogue   as projection on db.DamageCatalogue;

  action confirmLiability(
    damageID: UUID,
    liabilityState: String,
    newDamageComparedToCheckout: Boolean,
    reason: String
  ) returns DamageRecords;

  action requestApproval(damageID: UUID) returns RepairBills;
  action approveCharge(billID: UUID, reason: String) returns RepairBills;
  action adjustCharge(billID: UUID, reason: String, linesJson: String) returns RepairBills;
  action rejectCharge(billID: UUID, reason: String) returns RepairBills;
  action disputeCharge(billID: UUID, reason: String) returns RepairBills;
  action postCharge(billID: UUID) returns RepairBills;
}

@path    : '/odata/v4/maintenance'
@requires: 'authenticated-user'
service MaintenanceManagementService {
  entity MaintenanceRecords as projection on db.MaintenanceRecords;

  action createRepairJob(equipmentID: UUID, damageID: UUID, description: String) returns MaintenanceRecords;
  action assignTechnician(maintenanceID: UUID, technicianID: String) returns MaintenanceRecords;
  action recordActuals(maintenanceID: UUID, cost: Decimal, currency: String, notes: String) returns MaintenanceRecords;
  action completeRepair(maintenanceID: UUID) returns MaintenanceRecords;
  action releaseQuarantine(equipmentID: UUID, inspectionID: UUID) returns String;
}

@path    : '/odata/v4/analytics'
@requires: 'authenticated-user'
service AnalyticsService {
  @readonly
  entity Equipment          as projection on db.Equipment;
  @readonly
  entity Rentals            as projection on db.Rentals;
  @readonly
  entity RepairBills        as projection on db.RepairBills;
  @readonly
  entity MaintenanceRecords as projection on db.MaintenanceRecords;
  @readonly
  entity DamageRecords      as projection on db.DamageRecords;
}

@path    : '/odata/v4/integration'
@requires: 'authenticated-user'
service IntegrationMonitorService {
  @readonly
  entity IntegrationOutbox     as projection on db.IntegrationOutbox;
  @readonly
  entity IntegrationSyncRuns   as projection on db.IntegrationSyncRuns;
  @readonly
  entity AuditEvents           as projection on db.AuditEvents;
  @readonly
  entity NotificationRecords   as projection on db.NotificationRecords;
  entity ApprovalRules         as projection on db.ApprovalRules;
  entity RateCardRules         as projection on db.RateCardRules;
  entity TaxRules              as projection on db.TaxRules;
  entity PhotoRequirements     as projection on db.PhotoRequirements;
  entity ConfigurationVersions as projection on db.ConfigurationVersions;

  action retryMessage(outboxID: UUID) returns IntegrationOutbox;
  action reconcileMessage(outboxID: UUID) returns IntegrationOutbox;
  action runMasterDataSync(syncType: String) returns IntegrationSyncRuns;
}

@path    : '/odata/v4/identity'
@requires: 'authenticated-user'
service IdentityService {
  entity AppUsers as projection on db.AppUsers excluding {
    passwordHash
  };

  action createUser(
    username: String,
    displayName: String,
    password: String,
    role: String,
    plant: String,
    email: String
  ) returns AppUsers;

  action setUserActive(userID: UUID, active: Boolean) returns AppUsers;
}
