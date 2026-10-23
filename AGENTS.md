# Agent notes

- Execute builds; do not stop at a plan.
- Default `INTEGRATION_MODE=mock`. Never present mock postings as live S/4 success.
- Do not hard-code production tax, currency, auto-approval threshold or G/L accounts.
- Named CAP actions own lifecycle. Generic PATCH must not change status, totals or external IDs.
- Submitted inspections are immutable.
- Secrets stay in environment/bindings. `.env.example` is placeholders only.
- Verify current SAP API metadata before enabling `INTEGRATION_MODE=s4`.
- YardWorker cannot see prices. Auditor is read-only. Plant scope is mandatory.
