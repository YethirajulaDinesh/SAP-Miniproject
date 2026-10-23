# Architecture

CAP owns operational data: inspections, damage decisions, approvals, location history, audit, outbox, configuration snapshots.

S/4HANA is accessed only through destination-backed adapters (`INTEGRATION_MODE=mock|s4`). Direct SQL against S/4 tables is forbidden.

```text
Mobile (RN) ─┐
Fiori UI    ─┼─► CAP OData V4 + REST ─► SQLite / HANA Cloud
             │              │
             │              ├─ MediaStorageProvider (local | S3)
             │              └─ Outbox worker ─► S/4 adapters (blocked until verified)
```

Source-of-truth policy: local CRUD in demo; S/4-owned masters are read-only when `SOURCE_OF_TRUTH=S4_READ`.
