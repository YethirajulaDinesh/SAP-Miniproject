# Status and workflows

## Rental
DRAFT → BOOKED → CHECKED_OUT → PARTIALLY_RETURNED → RETURNED → CLOSED. CANCELLED terminal. OVERDUE is derived.

## Equipment
AVAILABLE → RESERVED → RENTED_OUT → INSPECTION_PENDING → AVAILABLE.
Damage: QUARANTINED/DAMAGED → IN_REPAIR → INSPECTION_PENDING → AVAILABLE. RETIRED terminal.

## Damage
OPEN → UNDER_REVIEW → APPROVED_FOR_REPAIR → IN_REPAIR → REPAIRED → CLOSED. DISPUTED allowed.

## Liability
PENDING_REVIEW, CUSTOMER_LIABLE, NOT_CUSTOMER_LIABLE, DISPUTED, WAIVED.

## Bills
DRAFT → PENDING_APPROVAL → APPROVED → POSTING_PENDING → POSTED.
Reject/adjust/dispute/waive from pending. Timeout requires reconcile before reissue.

Day-count convention default: inclusive end date, stored on the rental.
