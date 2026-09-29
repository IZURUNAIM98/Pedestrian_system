# SmartCross Physical HIL Three-Gate Readiness Summary

Assessment date: 2026-09-22

Current decision: **BLOCKED**

## 1. Prerequisites for READY FOR INDEPENDENT ENTRY-GATE REVIEW

These are review-package prerequisites, not physical test outcomes:

1. Controlled master plan, registers and three-gate classification are complete and mutually consistent.
2. Every entry blocker has a responsible role, prerequisite, target-date placeholder, acceptance authority and closure reference.
3. Existing internal evidence is clearly separated from externally supplied or witnessed evidence.
4. APP-01 through APP-09 requests are issued to named candidate authorities with scope and evidence expectations.
5. Vendor questionnaire, bench-inspection checklist, test procedures, expected results, timing tolerances, stop conditions and pass/fail rules are ready for review.
6. Proposed equipment, interface, wiring, network, audit and rollback evidence locations are identified.
7. An independent reviewer and review method are identified.
8. No physical result, repeatability result, emergency-stop timing or executed rollback is treated as an entry prerequisite.

## 2. Prerequisites for READY FOR ISOLATED PHYSICAL HIL

These require genuine external or independently witnessed entry evidence:

1. Signed, scoped and current APP-01 through APP-09 authorisations.
2. Vendor-certified interface, protocol, electrical, firmware, device-identity, timing and failure-mode information matching the selected assets.
3. Approved electrical and network isolation design proving no roadside, production or external-agency path.
4. Complete bench inventory, asset identifiers, firmware and current calibration status.
5. Approved emergency-stop design and pre-energisation inspection method.
6. Approved cybersecurity controls for identities, certificates, secrets, network policy, logging, vulnerabilities, patching and rollback.
7. Approved privacy plan and synthetic test-data declaration.
8. Approved physical-HIL test procedures, traceability, expected results, witnesses, timing tolerances, stop-work arrangements and evidence-capture plan.
9. Provisioned durable audit service with approved capacity, access, tamper-detection, backup and restore design.
10. Approved rollback procedure and available restorable baseline.
11. Independent entry-gate review closes every applicable entry blocker and releases only the isolated bench hold point.

## 3. Evidence required to declare PHYSICAL HIL PASSED

These records are created only during or after authorised isolated physical HIL:

1. Completed PHIL-TC-001 through PHIL-TC-018 results with time-correlated physical inputs, commanded states and independent electrical/controller read-back.
2. Measured proof that pedestrian WALK never coexists with conflicting vehicle release and that an occupied crossing retains protected clearance.
3. Deterministic repeat evidence for identical initial state, configuration and inputs.
4. Simultaneous-feature evidence producing exactly one authoritative safe decision with rejected alternatives recorded.
5. Physical outcomes for violations, heavy traffic, emergency priority, sensor disagreement, stale/duplicate/reordered frames, network loss, power recovery and manual override.
6. Measured emergency-stop response, de-energised safe state and controlled restart.
7. Executed rollback, credential revocation, network teardown, baseline hash restoration and regression results.
8. Campaign audit-chain integrity, access-denial, capacity, backup and restore results.
9. Deviations, hazards and failed cases closed by corrective action and witnessed retest.
10. Independent QA and traffic-signal safety disposition confirming the isolated physical-HIL scope passed.

Physical HIL Passed does not imply field-pilot approval or go-live readiness.

## Unresolved entry evidence

The current status remains `BLOCKED` because signed approvals, vendor dossiers, selected bench inventory/calibration, approved isolation design, cybersecurity/privacy approval, provisioned durable audit service, approved rollback package and independent readiness assessment are not yet present in the repository.
