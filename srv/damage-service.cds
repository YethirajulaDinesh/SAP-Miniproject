using {rental.equipment as db} from '../db/schema';

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
