using {rental.equipment as db} from '../db/schema';

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
