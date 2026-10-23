# Final build report

Date: 2026-10-23

Workspace `D:\MiniProject` was **read-only** for the agent (Users have RX only). The runnable project was created at:

`C:\Users\HP\MiniProject\rental-equipment-tracking`

## Implemented

- CAP 10 / Node 24 TypeScript-capable repo with JS domain services, CDS model, OData V4 services, REST media/sync/health
- SQLite local persistence, deterministic seed (Gulf Construction, excavator CAT320-001 rented out, generator available)
- Lifecycle, pricing (fail-closed tax), liability, outbox/idempotency, plant/role rules
- Fiori-style back-office launchpad (10 screens) consuming OData
- React Native mobile skeleton + offline queue tests (NFC flagged off)
- Mock S/4 adapters; live APIs BLOCKED
- CI, MTA, xs-security, docs, ADRs, traceability FR-001–025 / NFR-001–009

## Local commands (verified)

```
cd C:\Users\HP\MiniProject\rental-equipment-tracking
npm install
npx cds deploy --to sqlite:db.sqlite
node scripts/seed.js
npx cds-serve
```

- App: http://127.0.0.1:4004/app/launchpad/index.html
- OData: http://127.0.0.1:4004/odata/v4/rental/
- Health: http://127.0.0.1:4004/health
- Users: manager/manager, billing/billing, yard/yard, tech/tech, auditor/auditor, admin/admin

```
npx vitest run --coverage   # 23 passed, ~90% lines on srv/domain
npx cds build --production  # wrote gen/
node mobile/__tests__/offline.test.js  # 2 passed
```

## Acceptance

| # | Result |
|---|--------|
| 1 Offline two damages once | PASS (unit) |
| 2 Pre-existing not charged | PASS (unit) |
| 3 Auto-post only if configured | PASS (unit; demo auto-approval off) |
| 4 Timeout reconcile | PASS (unit) |
| 5 Outage durable outbox | PASS (unit/worker) |
| 6 Role/plant | PASS (unit + service guards) |
| 7 Hash mismatch / signed URL | PASS (unit + REST) |
| 8 Location transfer consistency | PASS (unit + action) |
| 9 PATCH cannot jump status | PASS (unit + UPDATE forbid list) |
| 10 Search/filter UI | PASS (fleet UI + OData $count) |

Fiori Elements ALP/Object Page **annotations exist**; local demo UI is a Fiori-style launchpad because a full FE runtime (Launchpad/HTML5 repo) is not provisioned.

Native Android/iOS **SDK build not executed** (Expo/SDK optional). Mobile logic is unit-tested.

## External blockers

- S/4 edition/release `$metadata`, destinations, credentials
- Billing document type / G/L / tax / auto-approval threshold (Finance)
- Rental contract API
- Cloud Connector / BTP subaccount / XSUAA / HANA Cloud / Object Store / DIM
- Device fleet, MDM, NFC labels
- Data residency

Live S/4 posting and BTP deploy: **not claimed**.

## Known defects / decisions

- Demo tax rate 0.0 pending Finance
- `cds.requires.queue` not used; custom outbox worker
- Project not written into `D:\MiniProject` due to ACLs
