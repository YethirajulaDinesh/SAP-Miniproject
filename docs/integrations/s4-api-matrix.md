# S/4HANA API matrix

Target edition/release: **unverified**. Live calls remain **BLOCKED**. Official catalogue: https://api.sap.com/

| ID | Adapter | FRD name | Protocol | Official notes | Status |
|----|---------|----------|----------|----------------|--------|
| INT-01 | EquipmentProvider | API_EQUIPMENT | OData (V2 commonly; V4 RAP variants exist by release) | Confirm `$metadata` on destination | BLOCKED |
| INT-02 | BusinessPartnerProvider | API_BUSINESS_PARTNER | OData V2 A2X | Confirm communication arrangement | BLOCKED |
| INT-03 | RentalContractProvider | Sales contract/order (TBC) | unknown | Do not fabricate a live service | BLOCKED |
| INT-04 | MaintenanceNotificationProvider | API_MAINTNOTIFICATION | OData | Version/entity set unverified | BLOCKED |
| INT-05 | MaintenanceOrderProvider | API_MAINTENANCEORDER | OData | Version unverified | BLOCKED |
| INT-06 | BillingPostingProvider | API_DEBIT_MEMO_REQUEST_SRV or API_SALES_ORDER_SRV | OData | Finance must pick billing type | BLOCKED |
| INT-07 | BillingStatusProvider | API_BILLING_DOCUMENT_SRV | OData V2 | **Read** of billing documents. Must **not** be used to create the source billing request. | BLOCKED (readback) |
| INT-08 | AttachmentProvider | API_CV_ATTACHMENT_SRV | OData | Optional | BLOCKED |
| INT-09 | DocumentRepositoryProvider | DIM / former Cloudinary mention | REST | Not used; single media provider | N/A local |
| INT-10 | MediaStorageProvider | S3-compatible Object Store | S3 | Local adapter for demo | LOCAL PASS / S3 BLOCKED |
| INT-11 | NotificationProvider | SAP Notification / email | REST | Mock send | MOCK |

Auth: Destination + OAuth2SAMLBearerAssertion / technical user. No hardcoded hosts. Idempotency key required on writes. After timeout, reconcile before retry.
