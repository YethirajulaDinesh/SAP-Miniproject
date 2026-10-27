# Test plan

- Unit: `test/domain.test.js`, `test/acceptance.test.js` (vitest + coverage on `srv/lib/domain`)
- Mobile queue: `mobile/__tests__/offline.test.js`
- API smoke: `scripts/smoke.js` against running cds-serve
- UI: browser walkthrough of `/app/launchpad/index.html`
- Security: `scripts/secret-scan.js`
- Performance: `scripts/load-k6.js` is a scenario stub; not executed as a pass claim

Mandatory acceptance IDs 1–10 are encoded in `test/acceptance.test.js`.
