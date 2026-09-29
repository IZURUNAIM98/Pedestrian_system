# Physical HIL Approval Request Template

This template records a requested decision. An incomplete or unsigned copy is not approval.

## Request

- Approval ID: APP-0X
- Requested authority/role: TBD
- Named signatory: TBD
- Organisation: TBD
- Request date: TBD
- Required decision date: TBD
- Scope/version: WBS-SC-LIVE-002-PHIL / TBD
- Related action IDs: TBD
- Related requirements/tests: TBD

## Decision requested

Describe the exact controlled decision. State whether it covers scope, signal safety, MPAJ authority, vendor conformance, bench isolation, cybersecurity, privacy, QA or configuration control.

## Evidence supplied

| Evidence ID | File/reference | Version/date | SHA-256 | Custodian |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

## Mandatory boundary acknowledgement

- No public-road or roadside connection is authorised.
- No production deployment or go-live is authorised.
- Physical output remains prohibited until the isolated-bench hold point is independently released.
- Uncertain, conflicting or unauthorised state defaults to the approved safe condition.
- Approval applies only to the identified versions, assets and conditions.
- Approval of entry readiness does not assert that physical tests, deterministic repeats, emergency-stop performance or rollback execution have passed; those are HIL exit evidence.

## Authority response

- Decision: APPROVED / APPROVED WITH CONDITIONS / REJECTED / DEFERRED
- Conditions: TBD
- Expiry/review date: TBD
- Signatory name and role: TBD
- Signature or approved digital-signature reference: TBD
- UTC decision date: TBD
- Closure evidence reference: TBD

The configuration manager must verify completeness and enter the result in `approval-and-evidence-register.csv`. Do not mark the associated blocker closed until the independent reviewer verifies the evidence.
