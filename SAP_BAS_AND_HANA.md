# SAP Business Application Studio and HANA

This CAP Node.js project is compatible with SAP Business Application Studio (BAS). Local development uses SQLite. Cloud Foundry / BAS deploy uses SAP HANA Cloud (HDI) and XSUAA.

Official CAP database guide: [Using SAP HANA Cloud](https://cap.cloud.sap/docs/guides/databases-hana)

## Compatibility (confirmed)

| Area | Status |
|------|--------|
| CAP Node.js + CDS + OData V4 | Supported in BAS |
| `cds watch` / `cds-serve` | Supported |
| SQLite for first run in BAS | Supported (`@cap-js/sqlite`) |
| HANA Cloud via HDI (`mta.yaml` `hdi-shared`) | Supported (`@cap-js/hana`) |
| XSUAA (`xs-security.json`) | Production profile |
| Custom HTML back office served by CAP | Works in BAS; not a Fiori Tools generator app |
| Session login (`/api/auth/login`) | **Development only** |
| Native mobile / live S/4 posting | Not required to start in BAS |

**Requirement:** Node.js **22+** (CAP 10). In BAS, set the Node version before `npm install` (`.nvmrc` is `22`).

## What you need in BTP / BAS

1. SAP BTP subaccount with Cloud Foundry
2. SAP Business Application Studio subscription (dev space type **SAP Cloud Business Application** or Full Stack Cloud Application)
3. **SAP HANA Cloud** instance (started)
4. Entitlements: HANA HDI shared, XSUAA application, Destination
5. GitHub access to clone this repo
6. Optional: Cloud Connector / destinations later for S/4HANA (not required for first run)

## Work in SAP BAS — steps

1. Open BAS → **Create Dev Space** → SAP Cloud Business Application → start it.
2. **Clone from Git:** `https://github.com/YethirajulaDinesh/SAP-Miniproject.git`
3. Terminal in the project root (`rental-equipment-tracking` if that is the folder, otherwise repo root):
   ```sh
   node -v          # must be 22+
   npm install
   npx cds deploy --to sqlite:db.sqlite
   node scripts/seed.js
   npm start
   # or: npx cds watch
   ```
4. Open the application URL BAS prints (port **4004**).
   - UI: `/app/launchpad/index.html`
   - Health: `/health`
5. Sign in with a seeded user, for example `manager` / `manager`.

BAS `cds watch` uses the **development** profile (SQLite + session login). That is enough to develop screens and CAP services.

## Connect to SAP HANA Cloud and Database Explorer

Do this when you want real HANA persistence, not SQLite.

### A. Create / start HANA Cloud

In BTP cockpit: **SAP HANA Cloud** → ensure the instance is **Running**. Copy the SQL endpoint (host:port).

### B. Open Database Explorer from BAS

1. BAS left bar: **SAP HANA Database Explorer** (or Command Palette → *SAP HANA: Open Database Explorer*).
2. **Add instance** → choose:
   - **HANA Cloud** (admin / DBADMIN) for cockpit-style SQL, or
   - **HDI container** after the app is deployed / bound (this is the schema CAP uses).

3. Authenticate with the DBADMIN user (HANA Cloud) or the HDI runtime user from the service key (application schema).

4. You can then run SQL, inspect tables generated from CDS (`rental.equipment::*` / HDI names), and confirm seed data after deploy.

### C. Bind HANA to the CAP app in BAS (hybrid)

After `cds build` artifacts exist:

```sh
cds add hana          # already configured in package.json / mta.yaml
cf login
cf create-service hana hdi-shared rental-db
npx cds bind -2 rental-db
npx cds watch --profile hybrid
```

`cds bind` writes connection data locally (do **not** commit `default-env.json`). Hybrid profile uses HANA instead of SQLite.

Deploy schema to the bound HDI container:

```sh
npx cds deploy --to hana
node scripts/seed.js
```

Seed is for demo users/master data. Do not run production financial seed against a live customer tenant without review.

### D. Deploy from BAS to Cloud Foundry (HDI created by MTA)

```sh
cf login -a <cf-api> -o <org> -s <space>
npm run build
npx mbt build
cf deploy mta_archives/rental-equipment-tracking_1.0.0.mtar
```

The MTA creates:

- `rental-db` — HANA HDI container  
- `rental-uaa` — XSUAA  
- `rental-destination` — Destination service  
- `rental-equipment-srv` — CAP Node app  

After deploy, in Database Explorer add the **HDI container** bound to `rental-equipment-srv` and browse tables.

On Cloud Foundry, authentication is **XSUAA**, not the local session users. Assign role collections (`Rental_Manager`, …) to your BTP user in the cockpit.

## Run checklist

| Goal | Command / place |
|------|-----------------|
| BAS first run (SQLite) | `npm install` → `npx cds deploy --to sqlite:db.sqlite` → `node scripts/seed.js` → `npm start` |
| Open UI | `/app/launchpad/index.html` |
| Open HANA SQL | BAS → SAP HANA Database Explorer → add HANA Cloud or HDI |
| App against HANA in BAS | `cds bind` + `cds watch --profile hybrid` |
| Cloud deploy | `mbt build` + `cf deploy` |

## What is not live yet

S/4HANA equipment, business partner, contract, maintenance, and billing APIs stay on the **mock** adapter until you create destinations and verify `$metadata`. Database Explorer shows **CAP HANA tables**, not S/4 application tables. Never write SQL into S/4 business schemas.
