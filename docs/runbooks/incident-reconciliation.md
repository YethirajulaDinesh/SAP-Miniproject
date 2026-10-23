# Incident and reconciliation runbook

1. Inspect Integration Monitor for `RETRY` / `DEAD_LETTER` age.
2. Do not re-post blindly after timeout.
3. Call `reconcileMessage` to look up the mock/S/4 store by idempotency key.
4. Only then `retryMessage`.
5. RPO <1h / RTO <4h are platform targets — restore from HANA backup/object-store versioning in production. Local demo uses SQLite file copy.
