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
