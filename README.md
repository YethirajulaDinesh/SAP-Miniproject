# Rental Equipment Tracking & Condition Logging

Local/demo implementation of the SAP BTP CAP + Fiori + React Native solution described in the FRD (v1.0, 08-Oct-2026) and Antigravity build blueprint. Live S/4HANA posting is **not** claimed.

## What runs locally

- CAP Node.js OData V4 services on **http://127.0.0.1:4004**
- Back-office UI: **http://127.0.0.1:4004/app/launchpad/index.html**
- Health: `/health` · Ready: `/ready`
- SQLite file `db.sqlite` · media in `.media/`
- `INTEGRATION_MODE=mock` (default). Mock documents are labelled `MOCK` / `SIMULATED`.

## Commands

```bash
npm install
npx cds deploy --to sqlite:db.sqlite
node scripts/seed.js
npx cds-serve
```

Sign in at the launchpad (session cookie). Dev users (hashed in DB):

| Username | Password | Role |
|----------|----------|------|
| manager | manager | Manager |
| maria.yard | Yard#maria | YardWorker |
| dan.dispatch | Disp#dan | Dispatcher |
| tom.tech | Tech#tom | Technician |
| bella.billing | Bill#bella | BillingClerk |
| avi.admin | Admin#avi | Admin |
| omar.audit | Audit#omar | Auditor |

Production profile uses XSUAA (`xs-security.json`). Live S/4 calls stay mock until destinations exist.

```bash
npm test
npm run lint
npm run secret-scan
npm run smoke   # while server is running
```

## Out of scope (Release 1)

AI photo damage detection, live telematics/IoT, customer self-service portal.

## SAP BAS and HANA

This project is compatible with SAP Business Application Studio. Full steps (clone, run, HANA Database Explorer, `cds bind`, MTA deploy) are in **[SAP_BAS_AND_HANA.md](SAP_BAS_AND_HANA.md)**.

## Deployment

`mta.yaml` and `xs-security.json` target Cloud Foundry + HANA HDI + XSUAA. Live S/4 posting is still mock until destinations exist.
