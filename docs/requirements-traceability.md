# Requirements traceability

| ID | Summary | Implementation | Tests |
|----|---------|----------------|-------|
| FR-001 | Customer master | `Customers` + rental service | domain/API |
| FR-002 | Rental contracts | `Rentals` + book/cancel/close | lifecycle tests |
| FR-003 | Multiple items | `RentalItems` | seed + computeRentalTotal |
| FR-004 | Equipment master | `Equipment` | fleet UI |
| FR-005 | Checkout/return inspections | start/submitInspection | acceptance 1 |
| FR-006 | Damage records | `DamageRecords` | pricing tests |
| FR-007 | Repair bills | calculateCharge + RepairBills | acceptance 2–3 |
| FR-008 | Rental lifecycle | named actions | transition tests |
| FR-009 | Return dates / overdue | derived `overdue` | isOverdue |
| FR-010 | Location assignment | Equipment.currentLocation | seed |
| FR-011 | Location transfer history | transferLocation + history | acceptance 8 |
| FR-012 | Maintenance records | MaintenanceRecords | repair actions |
| FR-013 | Next maintenance | nextMaintenanceDate | planner UI |
| FR-014 | Pre/post assessments | ConditionLogs types | inspection service |
| FR-015 | Grades A–D | enum + submit validation | grade tests |
| FR-016 | Liability | confirmLiability | assertChargeable |
| FR-017 | Damage workflow | DAMAGE_TRANSITIONS | lifecycle |
| FR-018 | Photos | MediaAssets + REST | hash tests |
| FR-019 | Photo metadata | schema fields | REST finalize |
| FR-020 | Damage history | asset object page | UI |
| FR-021 | Estimates | repairEstimate + actuals | pricing |
| FR-022 | Search/filter | OData $filter/$search | smoke |
| FR-023 | Utilization reporting | AnalyticsService + dashboard | UI |
| FR-024 | Maintenance cost reporting | Analytics MaintenanceRecords | UI |
| FR-025 | Billing reports | RepairBills analytics | UI |
| NFR-001 | Latency targets | measured later; not claimed | load script placeholder |
| NFR-002 | Volume targets | paging/indexes; not load-proven | |
| NFR-003 | Availability/RPO/RTO | runbook; not measured | |
| NFR-004 | 7-year retention | media legalHold/retentionUntil | |
| NFR-005 | Residency | open decision | |
| NFR-006 | CI | `.github/workflows/ci.yml` | |
| NFR-007 | Mobile OS floor | documented; Expo/SDK dependent | mobile tests |
| NFR-008 | Observability | /health /ready outbox | |
| NFR-009 | ≥80% business-logic coverage | vitest on `srv/lib/domain` | npm test |
