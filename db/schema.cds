namespace rental.equipment;

using {
  cuid,
  managed,
  sap.common.CodeList
} from '@sap/cds/common';

type CurrencyCode : String(3);
type PlantCode    : String(10);
type ExternalID   : String(50);
type Checksum     : String(64);

type RentalStatus : String enum {
  DRAFT;
  BOOKED;
  CHECKED_OUT;
  PARTIALLY_RETURNED;
  RETURNED;
  CLOSED;
  CANCELLED;
}

type RentalItemStatus : String enum {
  DRAFT;
  RESERVED;
  CHECKED_OUT;
  RETURNED;
  CANCELLED;
}

type EquipmentStatus : String enum {
  AVAILABLE;
  RESERVED;
  RENTED_OUT;
  INSPECTION_PENDING;
  QUARANTINED;
  DAMAGED;
  IN_REPAIR;
  RETIRED;
}

type InspectionType : String enum {
  CHECK_OUT;
  CHECK_IN;
  PERIODIC;
  POST_MAINTENANCE;
}

type ConditionGrade : String enum {
  A;
  B;
  C;
  D;
}

type InspectionState : String enum {
  DRAFT;
  SUBMITTED;
  CORRECTED;
}

type DamageSeverity : String enum {
  LOW;
  MEDIUM;
  HIGH;
  CRITICAL;
}

type LiabilityState : String enum {
  PENDING_REVIEW;
  CUSTOMER_LIABLE;
  NOT_CUSTOMER_LIABLE;
  DISPUTED;
  WAIVED;
}

type DamageState : String enum {
  OPEN;
  UNDER_REVIEW;
  APPROVED_FOR_REPAIR;
  IN_REPAIR;
  REPAIRED;
  DISPUTED;
  CLOSED;
}

type BillingStatus : String enum {
  DRAFT;
  PENDING_APPROVAL;
  APPROVED;
  ADJUSTMENT_REQUIRED;
  REJECTED;
  DISPUTED;
  WAIVED;
  POSTING_PENDING;
  POSTED;
  POSTING_FAILED;
}

type OutboxStatus : String enum {
  PENDING;
  IN_PROGRESS;
  SUCCEEDED;
  RETRY;
  DEAD_LETTER;
  RECONCILED;
}

type PhotoCategory : String enum {
  OVERALL;
  DETAIL;
  BEFORE;
  AFTER;
  CHECKLIST;
}

type LocationType : String enum {
  YARD;
  PLANT;
  CUSTOMER_SITE;
  WORKSHOP;
  WAREHOUSE;
}

type SourceOfTruth : String enum {
  LOCAL;
  S4_READ;
  S4_WRITE;
}

entity Customers : cuid, managed {
  companyName          : String(100) not null;
  contactPerson        : String(100);
  email                : String(100);
  phone                : String(20);
  address              : String(255);
  s4BusinessPartnerID  : ExternalID;
  sourceSystem         : String(20) default 'LOCAL';
  sourceOfTruth        : SourceOfTruth default 'LOCAL';
  plant                : PlantCode;
  active               : Boolean default true;
  rentals              : Association to many Rentals
                           on rentals.customer = $self;
  repairBills          : Association to many RepairBills
                           on repairBills.customer = $self;
}

entity Locations : cuid, managed {
  name      : String(100) not null;
  type      : LocationType default 'YARD';
  address   : String(255);
  city      : String(80);
  latitude  : Decimal(9, 6);
  longitude : Decimal(9, 6);
  plant     : PlantCode not null;
  active    : Boolean default true;
  equipment : Association to many Equipment
                on equipment.currentLocation = $self;
}

entity Equipment : cuid, managed {
  name                 : String(120) not null;
  type                 : String(60);
  manufacturer         : String(80);
  model                : String(80);
  serialNumber         : String(80);
  purchaseDate         : Date;
  defaultDailyRate     : Decimal(15, 2);
  currency             : CurrencyCode default 'USD';
  currentStatus        : EquipmentStatus default 'AVAILABLE';
  currentLocation      : Association to Locations;
  s4EquipmentID        : ExternalID;
  sourceSystem         : String(20) default 'LOCAL';
  plant                : PlantCode not null;
  version              : Integer default 1;
  nextMaintenanceDate  : Date;
  rentalItems          : Association to many RentalItems
                           on rentalItems.equipment = $self;
  conditionLogs        : Association to many ConditionLogs
                           on conditionLogs.equipment = $self;
  maintenanceRecords   : Association to many MaintenanceRecords
                           on maintenanceRecords.equipment = $self;
  locationHistory      : Association to many EquipmentLocationHistory
                           on locationHistory.equipment = $self;
}

entity Rentals : cuid, managed {
  customer             : Association to Customers not null;
  rentalDate           : Date not null;
  expectedReturnDate   : Date not null;
  actualReturnDate     : Date;
  status               : RentalStatus default 'DRAFT';
  currency             : CurrencyCode default 'USD';
  totalRentalAmount    : Decimal(15, 2) default 0;
  dayCountConvention   : String(30) default 'INCLUSIVE_END_DATE';
  externalContractID   : ExternalID;
  externalSalesDocID   : ExternalID;
  plant                : PlantCode not null;
  items                : Composition of many RentalItems
                           on items.rental = $self;
  conditionLogs        : Association to many ConditionLogs
                           on conditionLogs.rental = $self;
  repairBills          : Association to many RepairBills
                           on repairBills.rental = $self;
  overdue              : Boolean default false;
}

entity RentalItems : cuid, managed {
  rental                 : Association to Rentals not null;
  equipment              : Association to Equipment not null;
  dailyRentalRate        : Decimal(15, 2) not null;
  currency               : CurrencyCode default 'USD';
  startDate              : Date not null;
  endDate                : Date not null;
  status                 : RentalItemStatus default 'RESERVED';
  checkoutConditionLog   : Association to ConditionLogs;
  checkinConditionLog    : Association to ConditionLogs;
}

entity EquipmentLocationHistory : cuid, managed {
  equipment          : Association to Equipment not null;
  fromLocation       : Association to Locations;
  toLocation         : Association to Locations not null;
  movedAt            : Timestamp not null;
  movedBy            : String(80);
  reason             : String(255);
  deviceID           : String(80);
  clientOperationID  : UUID;
  externalSyncStatus : String(20) default 'LOCAL';
}

entity InspectionChecklists : cuid, managed {
  name            : String(120) not null;
  version         : Integer not null;
  inspectionType  : InspectionType not null;
  plant           : PlantCode;
  active          : Boolean default true;
  items           : Composition of many InspectionChecklistItems
                      on items.checklist = $self;
}

entity InspectionChecklistItems : cuid {
  checklist    : Association to InspectionChecklists not null;
  sequence     : Integer not null;
  prompt       : String(255) not null;
  required     : Boolean default true;
  answerType   : String(20) default 'BOOLEAN';
  failAction   : String(40);
  photoRequired: Boolean default false;
}

entity ConditionLogs : cuid, managed {
  equipment            : Association to Equipment not null;
  rental               : Association to Rentals;
  rentalItem           : Association to RentalItems;
  inspectionDateTime   : Timestamp not null;
  inspectionType       : InspectionType not null;
  conditionGrade       : ConditionGrade not null;
  inspectorID          : String(80);
  inspectorName        : String(120);
  meterReading         : Decimal(15, 2);
  notes                : String(1000);
  baselineConditionLog : Association to ConditionLogs;
  deviceID             : String(80);
  clientOperationID    : UUID;
  schemaVersion        : Integer default 1;
  submissionState      : InspectionState default 'DRAFT';
  submittedAt          : Timestamp;
  signaturePresent     : Boolean default false;
  signatureObjectKey   : String(255);
  checklist            : Association to InspectionChecklists;
  plant                : PlantCode;
  damages              : Composition of many DamageRecords
                           on damages.conditionLog = $self;
  answers              : Composition of many InspectionAnswers
                           on answers.conditionLog = $self;
}

entity InspectionAnswers : cuid {
  conditionLog : Association to ConditionLogs not null;
  item         : Association to InspectionChecklistItems not null;
  value        : String(255);
}

entity DamageRecords : cuid, managed {
  conditionLog               : Association to ConditionLogs not null;
  damageType                 : String(80) not null;
  description                : String(1000);
  severity                   : DamageSeverity default 'MEDIUM';
  repairEstimate             : Decimal(15, 2);
  actualRepairCost           : Decimal(15, 2);
  currency                   : CurrencyCode default 'USD';
  liabilityState             : LiabilityState default 'PENDING_REVIEW';
  customerLiable             : Boolean;
  damageState                : DamageState default 'OPEN';
  newDamageComparedToCheckout: Boolean default false;
  newDamageConfirmedBy       : String(80);
  newDamageConfirmedAt       : Timestamp;
  reviewReason               : String(500);
  resolvedAt                 : Timestamp;
  photos                     : Composition of many MediaAssets
                                 on photos.damage = $self;
  repairBills                : Association to many RepairBills
                                 on repairBills.damage = $self;
  workActuals                : Composition of many RepairWorkActuals
                                 on workActuals.damage = $self;
}

entity MediaAssets : cuid, managed {
  damage           : Association to DamageRecords;
  conditionLog     : Association to ConditionLogs;
  storageProvider  : String(40) default 'local';
  objectKey        : String(255) not null;
  originalFileName : String(255);
  mimeType         : String(100);
  byteSize         : Integer;
  sha256           : Checksum;
  thumbnailKey     : String(255);
  photoCategory    : PhotoCategory default 'DETAIL';
  capturedAt       : Timestamp;
  uploadedAt       : Timestamp;
  uploadedBy       : String(80);
  uploadState      : String(20) default 'COMPLETE';
  version          : Integer default 1;
  legalHold        : Boolean default false;
  retentionUntil   : Date;
}

entity RepairWorkActuals : cuid, managed {
  damage     : Association to DamageRecords not null;
  kind       : String(20) not null; // LABOR | PARTS | OTHER
  description: String(255);
  quantity   : Decimal(15, 2) default 1;
  amount     : Decimal(15, 2) not null;
  currency   : CurrencyCode default 'USD';
  enteredBy  : String(80);
}

entity RepairBills : cuid, managed {
  rental               : Association to Rentals;
  customer             : Association to Customers;
  damage               : Association to DamageRecords not null;
  billDate             : Date not null;
  repairAmount         : Decimal(15, 2) default 0;
  taxAmount            : Decimal(15, 2) default 0;
  totalAmount          : Decimal(15, 2) default 0;
  currency             : CurrencyCode default 'USD';
  billingStatus        : BillingStatus default 'DRAFT';
  rateCardVersion      : Integer;
  taxRuleVersion       : Integer;
  approvalRuleVersion  : Integer;
  calculationSnapshot  : LargeString;
  approvalReason       : String(500);
  rejectionReason      : String(500);
  idempotencyKey       : String(120);
  externalRequestID    : ExternalID;
  externalDocumentID   : ExternalID;
  postedAt             : Timestamp;
  simulated            : Boolean default true;
  workLines            : Composition of many RepairBillLines
                           on workLines.bill = $self;
}

entity RepairBillLines : cuid {
  bill        : Association to RepairBills not null;
  kind        : String(20);
  description : String(255);
  amount      : Decimal(15, 2);
  currency    : CurrencyCode;
}

entity MaintenanceRecords : cuid, managed {
  equipment                  : Association to Equipment not null;
  maintenanceType            : String(80) not null;
  date                       : Date not null;
  description                : String(1000);
  serviceProvider            : String(120);
  cost                       : Decimal(15, 2);
  currency                   : CurrencyCode default 'USD';
  nextMaintenanceDate        : Date;
  status                     : String(30) default 'OPEN';
  assignedTechnician         : String(80);
  externalMaintenanceOrderID : ExternalID;
  externalNotificationID     : ExternalID;
  plant                      : PlantCode;
}

entity RateCardRules : cuid, managed {
  name         : String(80) not null;
  version      : Integer not null;
  plant        : PlantCode;
  damageType   : String(80);
  currency     : CurrencyCode not null;
  laborRate    : Decimal(15, 2);
  partsMarkup  : Decimal(7, 4);
  minimumCharge: Decimal(15, 2);
  validFrom    : Date;
  validTo      : Date;
  active       : Boolean default true;
}

entity ApprovalRules : cuid, managed {
  name               : String(80) not null;
  version            : Integer not null;
  plant              : PlantCode;
  currency           : CurrencyCode not null;
  minAmount          : Decimal(15, 2) default 0;
  maxAmount          : Decimal(15, 2);
  damageCategory     : String(80);
  approverRole       : String(40);
  autoApprovalAllowed: Boolean default false;
  autoApprovalThreshold : Decimal(15, 2);
  validFrom          : Date;
  validTo            : Date;
  active             : Boolean default true;
}

entity TaxRules : cuid, managed {
  name      : String(80) not null;
  version   : Integer not null;
  plant     : PlantCode;
  currency  : CurrencyCode not null;
  taxCode   : String(20);
  rate      : Decimal(7, 4) not null;
  active    : Boolean default true;
}

entity ConfigurationVersions : cuid, managed {
  configType : String(40) not null;
  version    : Integer not null;
  validFrom  : Timestamp;
  validTo    : Timestamp;
  author     : String(80);
  payload    : LargeString;
}

entity AuditEvents : cuid {
  actor         : String(80);
  role          : String(40);
  plant         : PlantCode;
  action        : String(80) not null;
  entityType    : String(80);
  entityID      : UUID;
  occurredAt    : Timestamp not null;
  correlationID : String(64);
  reason        : String(500);
  summary       : String(1000);
}

entity IntegrationOutbox : cuid, managed {
  eventType        : String(80) not null;
  aggregateID      : UUID;
  targetSystem     : String(20) default 'S4';
  payloadVersion   : Integer default 1;
  payload          : LargeString;
  idempotencyKey   : String(120) not null;
  status           : OutboxStatus default 'PENDING';
  attempts         : Integer default 0;
  nextAttemptAt    : Timestamp;
  lastError        : String(1000);
  sapCorrelationID : String(80);
  externalID       : ExternalID;
  processedAt      : Timestamp;
  simulated        : Boolean default true;
}

entity IntegrationSyncRuns : cuid {
  syncType      : String(40) not null;
  startedAt     : Timestamp not null;
  endedAt       : Timestamp;
  cursor        : String(80);
  countSuccess  : Integer default 0;
  countError    : Integer default 0;
  errorSummary  : String(1000);
  status        : String(20);
  triggeredBy   : String(80);
  correlationID : String(64);
}

entity IdempotencyRecords : cuid {
  callerKey    : String(160) not null;
  operation    : String(80) not null;
  requestHash  : String(64);
  responseRef  : String(255);
  createdAt    : Timestamp not null;
  expiresAt    : Timestamp;
}

entity NotificationRecords : cuid, managed {
  recipient : String(120);
  reference : String(120);
  channel   : String(20);
  template  : String(80);
  status    : String(20) default 'PENDING';
  failure   : String(500);
}

entity DamageCatalogue : cuid, managed {
  code        : String(40) not null;
  name        : String(120) not null;
  severityHint: DamageSeverity;
  photoMin    : Integer default 1;
  active      : Boolean default true;
}

entity PhotoRequirements : cuid, managed {
  inspectionType : InspectionType not null;
  minPhotos      : Integer default 2;
  blurCheck      : Boolean default true;
}

entity AppUsers : cuid, managed {
  username     : String(80) not null;
  displayName  : String(120);
  passwordHash : String(255) not null;
  role         : String(40) not null;
  plant        : PlantCode;
  active       : Boolean default true;
  email        : String(120);
}

entity AuthSessions : cuid {
  token     : String(64) not null;
  user      : Association to AppUsers;
  username  : String(80);
  role      : String(40);
  plant     : PlantCode;
  expiresAt : Timestamp not null;
  createdAt : Timestamp;
}