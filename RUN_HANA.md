# Deploy and run on SAP HANA (not SQLite)

Use these commands in **SAP BAS**. Default scripts now target HANA (`hybrid` profile).

## 0. Pull latest code

```sh
git pull origin main
npm install
```

## 1. HANA Cloud must be Running

BTP cockpit → **SAP HANA Cloud** → instance status **Running**.

## 2. Log in to Cloud Foundry (once per session)

```sh
cf login
```

Enter your CF API, org, and space when asked.

## 3. Create HDI container (once)

```sh
cf create-service hana hdi-shared rental-db
cf service rental-db
```

Wait until the service shows **create succeeded**. If `hdi-shared` is not offered, use the HANA hdi plan your subaccount has (`cf marketplace -e hana`).

## 4. Bind HANA into this CAP project (once)

```sh
npx cds bind -2 rental-db
```

This writes local bind files. Do not commit them.

## 5. Deploy CDS tables to HANA

```sh
npx cds deploy --to hana
```

## 6. Load demo users/data into HANA

```sh
npx cds bind --exec -- node scripts/seed.js
```

## 7. Start the app against HANA

```sh
npm run dev
```

That runs `cds watch --profile hybrid` (HANA, not SQLite).

Open the **port 4004** URL:

`/app/launchpad/index.html`

Login: `manager` / `manager`

## 8. Check tables in HANA Database Explorer

BAS → **SAP HANA Database Explorer** → add the **HDI container** bound as `rental-db` → browse tables after deploy.

## Cloud Foundry deploy (optional)

```sh
npm run build
npx mbt build
cf deploy mta_archives/*.mtar
```

That creates HDI + XSUAA from `mta.yaml`. After CF deploy, login uses XSUAA role collections, not the local session users.

## SQLite fallback (only if HANA is unavailable)

```sh
npm run setup:sqlite
npx cds-serve
```
