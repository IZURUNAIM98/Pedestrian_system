# Physical HIL Independent Entry-Gate Review Candidate

Candidate date: 2026-09-22

Target milestone: **Ready for Independent Entry-Gate Review**

## Independent gate statuses

- Gate 1 - Independent entry-gate review readiness: `BLOCKED` - issued request and named independent reviewer evidence missing.
- Gate 2 - Isolated physical-HIL readiness: `BLOCKED - EXTERNAL EVIDENCE PENDING`.
- Gate 3 - Physical-HIL completion: `NOT STARTED - HIL EXIT`.

Gate 2 and Gate 3 status do not determine Gate 1. See `gate-1-document-control-assessment.md`.

## Evidence separation

### Existing internal evidence

- Physical HIL master plan and 18-row requirements-to-test matrix.
- Equipment, approval and evidence register templates.
- Software-only HIL rehearsal record.
- TypeScript, ESLint and production-build success previously recorded.
- 129/129 automated tests previously recorded.
- Software replay evidence for stale, duplicate and reordered inputs reaching STOP/WAIT.
- Hash-linked in-memory audit record verification.
- Non-actuating HIL entry gate and explicit roadside prohibition.

These records support planning and software assurance. They do not prove physical equipment, vendor conformance, durable storage or external approval.

### Evidence required externally or from a witnessed physical bench

- Signed APP-01 through APP-09 approvals.
- Completed vendor questionnaire and certified protocol/electrical/firmware dossiers.
- Completed equipment inventory and calibration certificates.
- Issued-for-test and as-built wiring, continuity/polarity and isolation records.
- Network isolation, device identity, security and privacy approvals.
- Provisioned durable audit service and approved evidence-storage design; campaign results are reserved for HIL exit.
- Approved emergency-stop and rollback designs/procedures; executed results are reserved for HIL exit.
- Independent readiness review, named witnesses and planned run-specific evidence locations.

## Current action status

`BCA-001` through `BCA-013`: **BLOCKED** pending the evidence identified in `blocker-closure-action-register.csv`.

## Reassessment rule

The coordinator may prepare a new candidate after Gate A preparation actions are closed and each Gate B candidate evidence reference is available for independent assessment. File existence alone is insufficient; contents, authority, scope, version and chain of custody must be verified. Physical test results, deterministic repeat evidence and executed rollback proof are not required until HIL exit.

## Candidate decision

Decision: **BLOCKED**

Exact unresolved references:

- `blocker-closure-action-register.csv`: BCA-001 through BCA-013.
- `approval-and-evidence-register.csv`: APP-01 through APP-09 and EVD-001 remain PENDING.
- `equipment-and-interface-register.csv`: EQ-001 through EQ-012 remain PENDING/TBD.
- `vendor-technical-questionnaire.md`: unanswered.
- `bench-inspection-checklist.md`: unexecuted.
- `independent-entry-gate-checklist.md`: mandatory evidence boxes unchecked.
- `requirements-to-test-traceability.csv`: PHIL-TC-001 through PHIL-TC-018 are HIL exit criteria and remain not executed; this is expected before physical HIL.

The documentation set is ready to coordinate evidence collection. Gate 1 is **not yet Ready for Independent Entry-Gate Review** because request-issuance and independent-reviewer appointment evidence are missing. Gate 2 remains separately blocked, and Gate 3 has not started. SmartCross is not Physical HIL Passed or Ready for Go-Live.
