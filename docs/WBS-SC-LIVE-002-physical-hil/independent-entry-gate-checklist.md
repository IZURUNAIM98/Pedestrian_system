# Independent Entry-Gate Checklist

Target disposition: `READY FOR INDEPENDENT ENTRY-GATE REVIEW` or `BLOCKED`.

This checklist assesses readiness to begin the independent review. It does not declare Physical HIL Passed and does not authorise go-live.

## Evidence completeness

- [ ] APP-01 through APP-09 are signed, scoped, current and independently attributable.
- [ ] All Gate A review-preparation actions are closed and every Gate B action has verifiable candidate evidence for independent assessment.
- [ ] All EQ-001 through EQ-012 assets/interfaces are complete and approved.
- [ ] Vendor dossier applies exactly to inventoried models and firmware.
- [ ] Wiring, isolation, topology and as-built evidence are consistent.
- [ ] Cybersecurity and privacy assessments contain no unresolved critical/high entry issue.
- [ ] Durable audit service design, access controls and test-evidence storage plan are approved; campaign backup/restore results are correctly reserved for HIL exit.
- [ ] Rollback procedure and restorable baseline are approved; executed rollback proof is correctly reserved for HIL exit.
- [ ] Every PHIL-REQ/PHIL-TC row has an approved procedure, expected result, planned evidence path and witness; no physical result is required yet.

## Safety and independence

- [ ] STOP-before-WALK and protected pedestrian clearance remain frozen requirements.
- [ ] Simultaneous-feature case PHIL-TC-012 expects exactly one deterministic safe decision.
- [ ] All uncertain, conflicting or unauthorised states map to approved safe behavior.
- [ ] Isolation hold-point release requires independent safety, electrical, QA and configuration approval.
- [ ] Implementers do not self-approve their safety, cyber or QA evidence.
- [ ] Stop-work authority, contacts and evidence-preservation steps are documented.
- [ ] Physical test results, deterministic repeats, emergency-stop performance and executed rollback are classified as HIL exit evidence rather than entry prerequisites.

## Configuration control

- [ ] Baseline manifests and SHA-256 digests are reproducible.
- [ ] Any change after evidence collection is assessed and re-approved.
- [ ] Credentials remain server-side and are absent from evidence exports.
- [ ] No deployment, production infrastructure or roadside configuration is included.

## Independent reviewer disposition

- Decision: READY FOR INDEPENDENT ENTRY-GATE REVIEW / BLOCKED
- Unresolved item IDs and exact files: TBD
- Reviewer name/organisation: TBD
- Independence declaration: TBD
- UTC review date: TBD
- Evidence-register reference: TBD

If any mandatory checkbox lacks verifiable evidence, the only valid decision is `BLOCKED`.
