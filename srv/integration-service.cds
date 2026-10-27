using {rental.equipment as db} from '../db/schema';

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
