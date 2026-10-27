# Rental Equipment Tracking & Condition Logging

Local/demo implementation of the SAP BTP CAP + Fiori + React Native solution described in the FRD (v1.0, 08-Oct-2026) and Antigravity build blueprint. Live S/4HANA posting is **not** claimed.

## What runs locally

- CAP Node.js OData V4 services on **http://127.0.0.1:4004**
- Back-office UI: **http://127.0.0.1:4004/app/launchpad/index.html**
- Health: `/health` · Ready: `/ready`
- SAP HANA Cloud HDI container `rental-db` (`hybrid` profile via `cds bind`) · media in `.media/`
- `INTEGRATION_MODE=mock` (default). Mock documents are labelled `MOCK` / `SIMULATED`.

## Commands

**HANA (required for BAS / BTP):** follow **[docs/runbooks/run-hana.md](docs/runbooks/run-hana.md)**. Short path:

```bash
git pull origin main
npm install
cf login
cf create-service hana hdi-shared rental-db
npx cds bind -2 rental-db
npx cds deploy --to hana
npx cds bind --exec -- node scripts/seed.js
npm run dev
```

Open the port **4004** URL + `/app/launchpad/index.html`. Login `manager` / `manager`.

`npm run dev` is **HANA hybrid**. SQLite is not supported: the project is SAP HANA only (`postinstall` removes `@cap-js/sqlite`).

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

This project is compatible with SAP Business Application Studio. Full steps (clone, run, HANA Database Explorer, `cds bind`, MTA deploy) are in **[docs/runbooks/sap-bas-and-hana.md](docs/runbooks/sap-bas-and-hana.md)**.

## Project structure

Standard SAP CAP layout:

| Folder or file | Purpose |
|----------------|---------|
| `app/` | UI content: `launchpad/` (back-office UI served at `/app/launchpad/index.html`), `fleet-overview/` (Fiori elements descriptor), `services.cds` + `annotations.cds` (Fiori UI annotations) |
| `db/` | Domain model (`schema.cds`) and demo seed data (`seed/data.js`) |
| `srv/` | Service definitions (`services.cds`) and Node.js implementation (`server.js`, `handlers/`, `domain/`, `auth/`, `integrations/`, `rest/`, `workers/`) |
| `test/` | Vitest unit and acceptance tests |
| `scripts/` | Seed, build, smoke and secret-scan helpers |
| `mobile/` | React Native offline inspection client (not served by CAP) |
| `docs/` | Architecture, ADRs, runbooks (HANA / BAS), security, testing |
| `.cdsrc.js`, `cds-plugin.js` | Force the SAP HANA database driver |
| `mta.yaml`, `xs-security.json` | Cloud Foundry deployment (HDI, XSUAA, Destination) |

## Deployment

`mta.yaml` and `xs-security.json` target Cloud Foundry + HANA HDI + XSUAA. Live S/4 posting is still mock until destinations exist.
