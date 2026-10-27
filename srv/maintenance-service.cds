using {rental.equipment as db} from '../db/schema';

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
