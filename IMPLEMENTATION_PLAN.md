# Implementation plan

Compared current app (`C:\Users\HP\MiniProject\rental-equipment-tracking` on :4004) with FRD/blueprint and reference CAP project (`Sep2026-SAP-CAPM`: OData V4, `cds.tx`, named actions, Fiori LR/OP, XSUAA in production). Reference was not modified.

## Gaps addressed

1. **Auth** — DB `AppUsers` + hashed passwords + HttpOnly session + `/api/auth/login|logout|me`. Backend `requireAny` / plant checks. Production still XSUAA.
2. **CRUD / lifecycle** — `createRental`, `addRentalItem` (overlap), `closeRental` gates, customer CREATE role-restricted.
3. **UI** — login + role-specific nav; data from CAP/REST (not hardcoded arrays).
4. **Photos** — inspection screen uploads via `/api/media/*`.
5. **SAP** — mock adapters only; UI banner MOCK/SIMULATED.

## Progress

- [x] Analyse current vs reference vs FRD
- [x] Session auth + AppUsers + role restrictions
- [x] Customer/equipment/rental CRUD + overlap + close gates
- [x] Inspection/damage/billing/maintenance screens per role
- [x] Photo upload from inspection UI
- [x] Tests (25 passed) + README

## Still blocked

Live S/4 destinations, tax/auto-approval threshold, billing document type, BTP XSUAA tenant.
