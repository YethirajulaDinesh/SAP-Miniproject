using {rental.equipment as db} from '../db/schema';

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
