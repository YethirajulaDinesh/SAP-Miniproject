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

Standard SAP CAP layout (same organisation as a SAP BAS / Fiori tools generated CAP project):

```
app/                          UI content
  services.cds                  entry point for UI annotations (extended by the BAS Fiori generator)
  annotations.cds               Fiori UI annotations (LineItem, HeaderInfo, Facets, ...)
  launchpad/                    back-office UI: index.html, launchpad.css, launchpad.js
  fleet-overview/               Fiori elements List Report / Object Page on Equipment
    webapp/                       Component.js, index.html, manifest.json, i18n/
    package.json, ui5.yaml
db/
  schema.cds                    domain model (namespace rental.equipment)
  seed/data.js                  demo users and master data (npm run seed)
srv/                          one .cds file per OData service
  rental-service.cds            /odata/v4/rental
  condition-service.cds         /odata/v4/condition
  damage-service.cds            /odata/v4/damage
  maintenance-service.cds       /odata/v4/maintenance
  analytics-service.cds         /odata/v4/analytics
  integration-service.cds       /odata/v4/integration
  identity-service.cds          /odata/v4/identity
  server.js                     bootstrap: HANA driver, static app/, REST API, handlers
  handlers/register.js          service implementations (actions, validations)
  lib/                          auth/, domain/, integrations/, rest/, workers/, boot-seed.js
  requests.http                 sample requests (REST Client)
test/                         Vitest unit and acceptance tests
scripts/                      seed, build copy, smoke, secret scan
mobile/                       React Native offline inspection client (not served by CAP)
docs/                         architecture, ADRs, runbooks (HANA / BAS), security, testing
.vscode/                      BAS / VS Code run configuration and tasks
.cdsrc.js, cds-plugin.js      force the SAP HANA database driver
mta.yaml, xs-security.json    Cloud Foundry deployment (HDI, XSUAA, Destination)
```

UIs after `npm run dev` (sign in on the launchpad first; the session cookie is shared):

- Launchpad: `/app/launchpad/index.html`
- Fleet Overview (Fiori elements): `/app/fleet-overview/webapp/index.html`

## Deployment

`mta.yaml` and `xs-security.json` target Cloud Foundry + HANA HDI + XSUAA. Live S/4 posting is still mock until destinations exist.
