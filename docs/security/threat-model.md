# Threat model (ASVS L2 / MASVS oriented)

| Threat | Control |
|--------|---------|
| IDOR across plants | plant filter + action checks |
| Role escalation | mocked/XSUAA roles; Auditor write denied; YardWorker prices stripped |
| Public media | private keys + HMAC signed URLs with expiry |
| Tampered evidence | server SHA-256, hash mismatch rejects |
| Secret leakage | .env.example placeholders, secret-scan, masked outbox payloads |
| Replay billing | idempotency keys + reconcile |
| Generic PATCH bypass | forbidden field list on UPDATE |
| Offline data theft | encrypted queue adapter + OS token store interfaces |

Jurisdiction-specific GDPR deletion vs financial retention is an **external decision**.
