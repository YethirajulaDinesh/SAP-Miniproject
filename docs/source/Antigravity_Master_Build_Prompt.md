# Antigravity Master Build Prompt — Rental Equipment Tracking & Condition Logging

> Attach the supplied ER diagram and the Functional Requirement Document (FRD v1.0, 08-Oct-2026), and keep the detailed `Rental_Equipment_Antigravity_Build_Blueprint.docx` in `docs/`. Paste the entire prompt below into Google Antigravity. **Execute the build; do not stop at a plan.**

## Your role and objective

You are the lead solution architect, senior full-stack engineer, SAP CAP engineer, SAP integration engineer, Fiori/UI5 engineer, React Native engineer, QA engineer, and security reviewer for **Rental Equipment Tracking & Condition Logging with Automated Repair Billing in SAP S/4HANA**.

Read the ERD image, FRD and detailed blueprint fully before modifying code. Inspect the existing repository first and preserve any valid work. Build a complete, maintainable project with backend, database model, business rules, Fiori back office, mobile app, integration seams, tests, docs, local demo and deployment artifacts. Do not return only a design, pseudocode, generated scaffolding, static dashboard or nonfunctional buttons.

You must execute sequentially through discovery, implementation, tests, UI verification, fixes and final reporting in this task. Use available Antigravity tools and subagents only where supported. Do not ask routine clarification questions; use the safe defaults below and record open business decisions. If external SAP systems/credentials are unavailable, continue with working mock adapters and clearly flag only the live operation as blocked.

## Source and scope

Implement all functional requirements FR-001 through FR-025 and nonfunctional requirements NFR-001 through NFR-009 from the supplied FRD, preserving their original IDs and acceptance criteria in `docs/requirements-traceability.md`.

Release 1 scope: customer/rental/rental item/equipment/location management; asset current status and location transfer; checkout, return and periodic inspections; grades A–D; damage catalogue, evidence photos and liability review; repair estimate/actuals; maintenance records and schedule; damage charge calculation/approval; outbox-based S/4 integration and billing-status readback; reports/dashboards; role/plant restrictions; audit; offline mobile; photo/media storage; notifications; tests; CI/CD; deployment/runbooks.

Explicitly out of scope for Release 1: AI-based photo damage detection, live telematics/IoT tracking, and customer self-service portal. Do not add these just because a coding agent can generate them.

## Required technology baseline

- Backend: SAP Cloud Application Programming Model (CAP), Node.js, TypeScript, CDS entities/services, OData V4. Use REST only for explicitly scoped mobile batch sync/media endpoints.
- Production persistence: SAP HANA Cloud. Local development must boot with a supported local persistence profile and deterministic mock data. Keep domain logic independent of SQL implementation.
- Web back-office: SAP Fiori Elements for OData V4 / SAPUI5, using standard List Report, Object Page and Analytical List Page floorplans first. Use narrow custom UI5 extensions for photo comparison, map or other requirements that standard floorplans cannot provide.
- Mobile: React Native + TypeScript targeting Android 10+ and iOS 15+ per FRD. Use an encrypted local persistence adapter, secure OS token storage, native camera and QR/barcode scan. Put NFC and signature capture behind platform interfaces and verify current compatible packages before choosing them.
- Media: `MediaStorageProvider` interface. Default production target is private S3-compatible object storage with signed URLs, versions, lifecycle retention and SHA-256. Use a local storage adapter for demo. Keep binary files outside the HANA data model; persist metadata and references only.
- Documents: PDF generation plus a `DocumentRepositoryProvider` adapter; DIM integration if provisioned. Do not duplicate all media in Cloudinary and Object Store. No external service should block local demo.
- Integration: `INTEGRATION_MODE=mock|s4`, default `mock` locally. Real S/4 calls use SAP BTP Destination Service and SAP Connectivity/Cloud Connector where needed. Use supported public/business APIs only. Never write directly to S/4HANA application database tables.
- Reliability: transactional outbox, idempotency records, audit events, structured logs, correlation IDs, safe retries, dead-letter status, reconciliation and operational alerts.

Before selecting dependency versions, commands, native plugins or SAP APIs, verify current official documentation and compatibility with the installed toolchain. Pin a lockfile. Do not assume old API routes remain correct across S/4 editions/releases.

## Required architectural constraints

1. CAP owns operational data: condition logs, submitted inspection evidence metadata, damage decisions, approval workflow, location history, app audit, integration outbox and configuration snapshots.
2. Where S/4 is configured as source of truth, equipment/business partner/rental contract data are synchronized/mirrored read models unless approved APIs and a confirmed business process explicitly allow writes. Local demo can create local master records.
3. Never call S/4 with raw SQL. Use the configured remote API adapter through destinations and least-privilege credentials supplied via service bindings/secret manager.
4. No credentials/secrets in source, committed `.env`, mobile bundle, test fixtures, screenshots or logs. Provide `.env.example` with placeholder values only.
5. No simulated response may be presented as a real S/4 posting. Demo objects must be labelled `MOCK`/`SIMULATED` in the UI and API response.
6. Never charge damage that existed at checkout. Check-in damage requires baseline comparison, human confirmation, evidence, liability decision, price/tax configuration and required approval.
7. Never automatically infer customer liability from an image. Human inspector/reviewer records the decision; AI damage classification remains out of scope.
8. Every posting uses stable idempotency/business reference. After a timeout, reconcile/query the target system first; never blindly create a second external document.
9. Submitted inspections/evidence are immutable. Correct them by append-only correction/addendum records with actor, timestamp and reason.
10. State transitions are explicit server-side actions; generic updates must not bypass lifecycle, plant scope, authorization or required evidence.
11. Missing tax, currency, auto-approval threshold, billing document type or verified API configuration must fail closed. Do not hard-code a production monetary threshold, tax rate, ledger account, loss-of-use rule or currency.
12. The media bytes must be stored in private object storage. Database records contain provider, key, file name, MIME, size, checksum, captured/uploaded timestamps, uploader, version and legal-hold/retention metadata.

## Resolve source contradictions safely

- The ERD omits EquipmentLocationHistory although FR-011 requires location transfer history. Add it and update current equipment location plus history in one transaction.
- The ERD omits audit, outbox, sync run, idempotency, checklist, rate-card and approval-rule entities. Add them.
- The FRD names both Cloudinary and S3-compatible Object Store. Use one authoritative storage provider by default; expose a provider interface. Keep DIM/document repository as a separate optional adapter. Do not add duplicate storage without a clear decision.
- Customer CRUD conflicts with S/4 Business Partner sync. Local demo allows CRUD; live mode obeys a configurable source-of-truth policy; do not write back to S/4 until the exact business process/API is approved.
- Rental contracts API is unconfirmed. Implement a `RentalContractProvider` contract and a mock provider; do not fabricate a live service.
- Maintenance notification API technical names/version may differ by release; billing-document read APIs must not be assumed to create billable documents. Verify the target S/4 edition/release, exact metadata, communication setup, auth, entity sets and permitted actions. Document all unverified calls as BLOCKED.
- “HANA integration” means using S/4HANA supported business APIs through BTP—not direct writes into S/4 DB tables.

## Domain model

Use UUID keys for CAP-owned entities, stable external IDs for SAP entities, `Decimal` for currency/measure fields, ISO 4217 currency code on each monetary transaction, date-only types for business dates, and UTC instants for event timestamps. Use explicit enums and indexes. Build migrations/schema artifacts appropriate to CAP/HANA.

Core entities from the ERD:
- `Customers`: company/contact/email/phone/address, external S/4 Business Partner ID, source system, active and scope metadata.
- `Rentals`: customer association, rental/expected/actual return dates, enum status, currency, computed/snapshotted total, external contract/order ID, plant.
- `RentalItems`: rental and equipment associations, snapshotted daily rate/currency, start/end dates, item state, checkout/check-in inspection references.
- `Equipment`: name/type/manufacturer/model/serial/purchase date, current location, default rate/currency, explicit current status, external S/4 equipment ID, plant and version metadata.
- `Locations`: name/type/address/city/optional coordinates/plant/active.
- `MaintenanceRecords`: equipment, type/date/description/provider/cost/currency/next date/status/external order ID and actuals.
- `ConditionLogs`: equipment/rental/rental item, UTC inspection time, CHECK_OUT/CHECK_IN/PERIODIC/POST_MAINTENANCE, grade A-D, inspector, meter reading, notes, baseline reference, device/client operation ID, signature metadata and submission state.
- `DamageRecords`: condition log, type/description/severity, estimate and actual cost/currency, new-damage comparison, liability state, damage state, review reason and dates.
- `DamagePhotos`/`MediaAssets`: damage link, private provider/key, original filename, MIME, byte size, SHA-256, thumbnail, photo category (overall/detail/before/after), capture/upload time/uploader, upload state, version and legal hold.
- `RepairBills`: rental/customer/damage associations, date, subtotal/tax/total/currency, status, pricing/tax/approval snapshot, reasons, idempotency key, external request/document IDs and posted time.

Supporting entities required:
- `EquipmentLocationHistory` (append-only from/to, movedAt, actor, reason, device/client operation ID, external sync status).
- `InspectionChecklist`, versioned checklist items and inspection answers.
- `RateCardRules`, `ApprovalRules`, and versioned `ConfigurationVersion`.
- `AuditEvents`, `IntegrationOutbox`, `IntegrationSyncRuns`, `IdempotencyRecords`, `NotificationRecords`.
- Optional repair work actuals child records for labor/parts/other costs.

Relationships: Customer 1:M Rentals; Rental 1:M RentalItems; Equipment 1:M RentalItems over time; Location 1:M current Equipment; Equipment 1:M ConditionLogs; Rental/RentalItem 1:M ConditionLogs; ConditionLog 1:M DamageRecords; DamageRecord 1:M media; Equipment 1:M MaintenanceRecords and LocationHistory. One active/posted successful customer charge per chargeable damage/business event; failed/rejected attempts remain auditable without causing duplicate posting.

## Business logic and workflows

### Rental and equipment lifecycle
Use controlled transitions: `DRAFT → BOOKED → CHECKED_OUT → PARTIALLY_RETURNED → RETURNED → CLOSED`; `CANCELLED` may be terminal. Overdue is derived from date/open items. Equipment transitions include `AVAILABLE → RESERVED → RENTED_OUT → INSPECTION_PENDING → AVAILABLE`, with `QUARANTINED/DAMAGED → IN_REPAIR → INSPECTION_PENDING → AVAILABLE` and `RETIRED`. Adjust exact policy only via documented configuration/ADR.

### Inspection
- Yard worker selects checkout/check-in/periodic inspection, scans asset, verifies rental item, loads the correct checklist version and captures grade, meter, notes, required photos and optional/required customer signature.
- A submitted inspection is immutable. Enforce photo requirements server-side, not only on mobile.
- On return, find checkout baseline for the same equipment and rental item; show visual side-by-side/slider but require human confirmation of new damage.
- Offline records have stable UUIDs/device/client-operation IDs, timestamps, schema version and idempotency keys.

### Damage/liability
Use liability states `PENDING_REVIEW`, `CUSTOMER_LIABLE`, `NOT_CUSTOMER_LIABLE`, `DISPUTED`, `WAIVED`; damage states such as `OPEN`, `UNDER_REVIEW`, `APPROVED_FOR_REPAIR`, `IN_REPAIR`, `REPAIRED`, `DISPUTED`, `CLOSED`. Validate allowed transitions. Customer billing is blocked for pre-existing or unconfirmed damage.

### Pricing and charge approval
Calculate money server-side using decimal arithmetic. Persist the exact rate/tax/approval rule version and line-item snapshot. `repairSubtotal = approved parts + labor + other allowed lines`; calculate tax via configurable provider/rule; `total = currency-rounded subtotal + tax`. No browser/mobile client-provided total is trusted. Require known currency/tax config. Auto-approval requires a valid configured threshold and policy; until Finance provides it, manual approval only. Reject/adjust/dispute/override actions require a reason.

### Outbound posting
On approved charges and eligible maintenance work, write CAP business state plus outbox command in the same transaction. Worker uses bounded concurrency, lease/lock, exponential backoff+jitter, retry classification, correlation ID, masked logging and dead-letter status. For ambiguous timeout, reconcile against external reference before retry. Persist S/4 document/request number only after actual confirmation. Update billing status from supported readback API/event/polling.

### Location transfer and maintenance
Transfer action checks role/plant scope, target location and equipment state; insert immutable history and update current location transactionally. Repair workflow assigns technician, records work actuals/photos and only releases quarantine after required completion/inspection and authorized action.

## Required back-office screens

1. Fleet Overview — Fiori Elements Analytical List Page with Available/Rented Out/Overdue/Damaged KPIs, filters and asset drill-down.
2. Asset Detail — Object Page with General, Timeline, Inspection, Damage, Repairs, Documents, Location History and Media facets.
3. Inspection Review — checklist/evidence, checkout-vs-return photo comparison, new damage decision, audit trail and evidence export.
4. Damage Charge Approval — list/object page, cost lines, Approve/Adjust/Reject/Dispute, required reason, history and S/4 status.
5. Repair Jobs — worklist, assignment, actuals, before/after photos.
6. Maintenance Planner — scheduled/overdue maintenance and equipment drill-down.
7. Configuration — damage catalogue, checklists, rate cards, approval rules, photo requirements and notifications; version/audit changes.
8. Integration Monitor — sync runs/outbox/status/age/attempts/masked payload/error/retry/reconcile.
9. Management Dashboard — billing leakage, estimated vs billed, utilization, maintenance costs, evidence compliance and top damage categories.
10. Repair Bill details — snapshot, approval, posting attempts, external document reference and PDF if available.

Use standard Fiori floorplans first; custom SAPUI5 only for specific interactions. Implement meaningful loading/empty/error/permission states, responsive layouts, keyboard access and i18n. No dead buttons.

## Required mobile features

- Login/session and secure token handling, home/task list, scanner, checkout/check-in/periodic inspection wizard, photo capture and previews, grade/meter/notes/checklist, signature interface, new-damage comparison, location transfer, offline queue/sync progress/conflict details, last sync and settings.
- Encrypted local data/file storage and OS secure token store. Work offline on allowed inspections and media. Do not claim external billing/posting success from a device-only state.
- Use QR/barcode as baseline; NFC is behind a feature flag until the devices/labels are confirmed. Keep camera/scanner/signature/storage behind platform interfaces.
- Sync in bounded batches; per-operation success/error/conflict results; server cursor; retries for transient failures; no auto-retry of auth/validation errors; media upload resumable where provider supports it.
- On reconnect/app restart, replay operations idempotently; server decides authoritative equipment status/location/billing state. Preserve unsynced data carefully and warn before cache wipe/logout.

## OData/REST services

Create services equivalent to `RentalManagementService`, `ConditionManagementService`, `DamageManagementService`, `MaintenanceManagementService`, `AnalyticsService`, and `IntegrationMonitorService`. Expose typed actions for start/submit inspection, compare baseline, confirm liability, request/approve/adjust/reject/dispute charge, post charge, assign/complete repair, release quarantine, transfer location, retry/reconcile outbox message. REST endpoints should include mobile batch sync, media initiation/finalization/checksum verification, `/health` and `/ready`.

Use CAP-generated OData V4 metadata; test filters, counts, paging and search. Add stable error codes, correlation IDs, ETag/optimistic concurrency where appropriate, bounded page sizes, server-side search and indexes. Never expose arbitrary unrestricted writes to status, prices, approval fields or external IDs.

## SAP S/4HANA/BTP integration work

Create adapter interfaces for equipment, business partner, rental contract, maintenance notification, maintenance order, repair charge posting, billing-status readback, attachments/documents, media storage and notification. A mock implementation must be complete and deterministic.

Write `docs/integrations/s4-api-matrix.md` including target edition/release, official doc URL, API technical name/version/protocol, base path/entity sets/actions, auth, mandatory properties, paging/watermark, error mapping, idempotency/reconciliation and test status. Do not assert API support solely because the FRD names it. Specifically verify equipment API, business partner API, rental contract API, maintenance notification/order APIs and the actual billing-request creation process. `API_BILLING_DOCUMENT_SRV` must not be assumed to create a source billing request merely because it can read a billing document. Real API implementation is BLOCKED until verified target metadata and destination credentials are available; local mock flows must still pass.

Schedule configurable 15-minute sync and support on-demand sync. Log sync cursors/counts/durations. Use destinations and Connectivity/Cloud Connector as applicable. Do not hardcode API roots or credentials. Event Mesh is optional; polling fallback must work for billing status if no event service is provisioned.

## Security and privacy

Use XSUAA/IAS per configured BTP landscape and role/plant-based authorization on server. Roles: YardWorker, Dispatcher, Technician, BillingClerk, Manager, Admin, Auditor. YardWorker cannot see prices; Technician cannot approve billing by default; Auditor is read-only. Test cross-plant IDOR and role escalation. Use private signed media URLs with short expirations, byte-level MIME/size validation, server-computed SHA-256, versioning/legal hold metadata, audit of all write/approval/retry/config/posting actions, TLS, secret scanning, rate limits and dependency scanning. No sensitive values in logs. Address OWASP ASVS L2 and MASVS requirements and document jurisdiction-specific controls as external decisions.

## Non-functional targets

Preserve FRD targets: ALP initial load <3s p95; API reads <500ms; charge calculation <2s; peak 500 users; 100,000 assets; 5 million media files; 99.5% business-hours availability; RPO <1h; RTO <4h; 7-year configurable retention and cold storage after 12 months; Android 10+/iOS 15+; capture-to-thumbnail <1s; structured logs/metrics/tracing/alerts; >=80% business-logic unit test coverage. Treat performance/availability/recovery as measured/deployment targets, not claims. Include load-test scripts/results and platform dependency notes.

## Repository deliverables

At minimum include:
- `AGENTS.md`, `README.md`, lockfiles, scripts and `.env.example` (placeholders only)
- `db/schema.cds`, seed scripts and database profile/deploy artifacts
- `srv/services.cds`, typed handlers/domain services, adapters, outbox/sync workers
- Fiori Elements apps and custom UI5 components
- `mobile/` React Native project and platform build notes
- `test/` unit/integration/API/contract/e2e suites
- `docs/architecture.md`, `docs/data-dictionary.md`, `docs/status-and-workflows.md`, `docs/requirements-traceability.md`, `docs/integrations/s4-api-matrix.md`, `docs/security/threat-model.md`, `docs/testing/test-plan.md`, deployment and incident/reconciliation runbooks, and ADRs
- CI workflow for lint, typecheck, tests, coverage, production build and scans
- `mta.yaml`/BTP descriptors that match the implemented architecture; do not generate broken placeholders and claim deployment succeeded
- deterministic seed scenario, local mock mode and smoke test
- screenshots/walkthroughs for fleet, asset, inspection comparison, charge approval, integration monitor and mobile offline flow
- `docs/final-build-report.md` with test evidence and external blockers

Suggested structure:

```text
rental-equipment-tracking/
  AGENTS.md README.md .env.example package.json
  docs/ (architecture, traceability, data dictionary, ADRs, integrations, runbooks, security, testing)
  db/schema.cds db/seed/
  srv/services.cds srv/handlers/ srv/integrations/ srv/workers/ srv/test/
  app/fleet-overview/ app/asset-management/ app/damage-approval/
  app/maintenance/ app/integration-monitor/ app/shared/
  mobile/src/screens/ mobile/src/domain/ mobile/src/offline/ mobile/src/media/ mobile/src/platform/ mobile/__tests__/
  test/ scripts/ mta.yaml xs-security.json CI workflow
```

## Required execution sequence

**Phase 0 — Inspect**: read all source files, inspect repository and installed toolchain, write ADRs/traceability and plan. Continue to code.

**Phase 1 — Bootstrap**: CAP/TypeScript setup, lint/format/test, local DB and mock config, AGENTS.md, README, CI. Verify clean install and local app startup.

**Phase 2 — Data/services**: implement core plus helper entities, associations, validation, indexes, OData services and seeds. Compile CDS and test metadata.

**Phase 3 — Domain workflows**: implement state machines, checklists, baseline comparison, liability, pricing/tax config, approval, maintenance and location transfer. Unit test both valid and forbidden cases.

**Phase 4 — Media/offline**: implement local media adapter and production interface, upload/checksum flow, encrypted local mobile store, sync endpoints, conflict logic and idempotent replay. Demonstrate no duplicates after retry.

**Phase 5 — Integration**: complete mock adapters and outbox worker, scheduling, retries, dead-letter and reconciliation UI; create verified API matrix and gated S/4 adapters.

**Phase 6 — Fiori**: build required ALP/list/object pages/actions/custom comparison; test with browser and capture screenshots; remove all dead controls.

**Phase 7 — Mobile**: implement scan/camera/inspection/photos/offline/sync/conflict/transfer and settings; build supported platform targets where SDK/devices permit.

**Phase 8 — Quality**: run automated tests, coverage, security checks, performance scenarios, a11y checks and outage/retry tests. Fix failures and rerun.

**Phase 9 — Delivery**: verify production build, MTA/deployment config, local clean run, runbooks, screenshots, final build report and all unresolved external blockers.

## Mandatory tests/acceptance

1. Offline check-in with photos and two damages syncs later exactly once.
2. Pre-existing damage cannot be charged; new damage can be charged only after liability/evidence/policy checks.
3. Below-threshold auto-post only when configured and eligible; above-threshold requires approval; successful external reference appears in timeline.
4. Timeout plus retry must create one external business document at most; reconcile before reissue.
5. Two-hour external outage leaves durable outbox, raises alert and drains after recovery.
6. Role/plant access restrictions work; YardWorker cannot access pricing; Auditor cannot write; wrong-plant access fails.
7. Altered photo/hash mismatch is rejected; signed URLs expire; media never becomes public.
8. Location transfer history and current location remain consistent through retries.
9. Generic PATCH cannot bypass state machines or modify server-owned total/status/external-ID fields.
10. Search/filter/paging work for large asset lists; all primary UI actions work.

## Commands and verification

Derive actual commands from the created project and verify them before documenting. At minimum execute clean dependency install, lint/format check, typecheck, all tests, business-logic coverage, CDS/schema compile, production build, API smoke tests, web UI test, mobile build/test where available, security/dependency scan and repository secret scan. Start the app locally and walk through the demo. Do not remove a failing test to make the build green; fix the cause.

Search for and eliminate: committed secrets, S/4 direct database access, hard-coded thresholds/tax/currency, fake live-success responses, unrestricted PATCH status, public media URLs, non-idempotent outbox retry, raw exception payloads in UI, dead buttons, `TODO` in acceptance-critical paths, broken imports, inaccessible controls and claimed test results without output.

## Final response from the agent

Return a concise but evidence-backed completion report with:
- implemented modules/features and exact repository tree summary
- exact local run/test/build commands and verified app URLs/ports
- tests executed with pass/fail counts and coverage output
- list of screenshots/walkthrough artifacts
- acceptance matrix marked PASS/FAIL/BLOCKED per requirement group
- external prerequisites still missing (SAP system metadata, destinations, credentials, BTP services, tax/approval decisions, mobile device/MDM), with the exact blocked live capability
- known defects and decision-register items
- deployment status stated truthfully

**Do not stop after a plan. Do not claim live SAP deployment or invoice posting without real system confirmation. Build everything possible now, verify it, and isolate only the genuinely external blockers.**
