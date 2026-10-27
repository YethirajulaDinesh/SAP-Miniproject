using RentalManagementService as rental from '../srv/services';
using DamageManagementService as damage from '../srv/services';
using MaintenanceManagementService as maint from '../srv/services';
using AnalyticsService as analytics from '../srv/services';
using IntegrationMonitorService as integ from '../srv/services';
using ConditionManagementService as condition from '../srv/services';

annotate rental.Equipment with @(
  title: 'Fleet Equipment',
  UI: {
    HeaderInfo: {
      TypeName: 'Asset',
      TypeNamePlural: 'Assets',
      Title: { Value: name },
      Description: { Value: serialNumber }
    },
    SelectionFields: [ currentStatus, plant, type, serialNumber ],
    LineItem: [
      { Value: serialNumber, Label: 'Serial' },
      { Value: name },
      { Value: type },
      { Value: currentStatus },
      { Value: plant },
      { Value: nextMaintenanceDate }
    ],
    Facets: [
      { $Type: 'UI.ReferenceFacet', Label: 'General', Target: '@UI.FieldGroup#General' },
      { $Type: 'UI.ReferenceFacet', Label: 'Inspections', Target: 'conditionLogs/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', Label: 'Maintenance', Target: 'maintenanceRecords/@UI.LineItem' },
      { $Type: 'UI.ReferenceFacet', Label: 'Location History', Target: 'locationHistory/@UI.LineItem' }
    ],
    FieldGroup #General: {
      Data: [
        { Value: manufacturer },
        { Value: model },
        { Value: serialNumber },
        { Value: currentStatus },
        { Value: plant }
      ]
    }
  },
  Capabilities: { FilterRestrictions: { Filterable: true } }
);

annotate rental.Rentals with @(
  UI: {
    HeaderInfo: { TypeName: 'Rental', TypeNamePlural: 'Rentals', Title: { Value: ID } },
    SelectionFields: [ status, plant, expectedReturnDate ],
    LineItem: [
      { Value: rentalDate },
      { Value: expectedReturnDate },
      { Value: status },
      { Value: overdue },
      { Value: plant }
    ]
  }
);

annotate damage.RepairBills with @(
  UI: {
    HeaderInfo: { TypeName: 'Repair Bill', TypeNamePlural: 'Repair Bills', Title: { Value: ID } },
    SelectionFields: [ billingStatus, currency ],
    LineItem: [
      { Value: billDate },
      { Value: billingStatus },
      { Value: totalAmount },
      { Value: currency },
      { Value: externalDocumentID },
      { Value: simulated }
    ]
  }
);

annotate damage.DamageRecords with @(
  UI: {
    LineItem: [
      { Value: damageType },
      { Value: severity },
      { Value: liabilityState },
      { Value: damageState }
    ]
  }
);

annotate maint.MaintenanceRecords with @(
  UI: {
    LineItem: [
      { Value: maintenanceType },
      { Value: date },
      { Value: status },
      { Value: nextMaintenanceDate }
    ]
  }
);

annotate integ.IntegrationOutbox with @(
  UI: {
    LineItem: [
      { Value: eventType },
      { Value: status },
      { Value: attempts },
      { Value: lastError },
      { Value: externalID },
      { Value: simulated }
    ]
  }
);

annotate analytics.Equipment with @(
  Aggregation.ApplySupported: {
    Transformations: ['aggregate', 'groupby', 'filter'],
    GroupableProperties: [currentStatus, plant, type],
    AggregatableProperties: [{ Property: ID }]
  }
);

annotate condition.ConditionLogs with @(
  UI: {
    LineItem: [
      { Value: inspectionType },
      { Value: conditionGrade },
      { Value: inspectionDateTime },
      { Value: submissionState }
    ]
  }
);
