# Data dictionary

CAP UUID keys for app-owned entities. External SAP IDs stored separately. Decimal(15,2) + ISO 4217 currency on money. UTC timestamps for events; Date for business dates.

See `db/schema.cds` for fields. Extensions beyond the original ERD: EquipmentLocationHistory, InspectionChecklist*, RateCardRules, ApprovalRules, TaxRules, AuditEvents, IntegrationOutbox, IntegrationSyncRuns, IdempotencyRecords, NotificationRecords, ConfigurationVersions, RepairWorkActuals, MediaAssets (bytes out of DB).
