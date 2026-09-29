# WBS-SC-LIVE-001 Red Team and Closure Record

Assessment date: 2026-09-22. This is a software-only adversarial and closure pass; it is not an independent organisational safety certification or field acceptance.

## Findings register

| ID | Scenario and preconditions | Actual evidence | Impact / severity | Requirement | Recommended correction | Retest | Closure |
|---|---|---|---|---|---|---|---|
| RT-LIVE-001 | Degraded camera, authenticated pedestrian request, all independent fallback checks clear | Visual simulation issued protected WALK, but `safetyDecision` remained `DEGRADED_SAFE_HOLD` | Operator/audit inconsistency; High | AC 15, 19, 20 | Represent independently verified fixed-timing fallback in the authoritative resolver | Unit plus browser fallback test | CLOSED |
| RT-LIVE-002 | Same source observation repeated or reordered | Syntax/freshness validation accepted a repeated sequence number | Replay/spoofing exposure; High | AC 16, security foundation | Add per-source monotonic sequence guard | Duplicate, lower, and higher sequence tests | CLOSED |
| RT-LIVE-003 | Mobile operator interface | Operating-mode indicator was hidden by a later responsive stylesheet rule | Operator may misunderstand mode; Medium | AC 3, 20, 26 | Override the responsive rule for the operating-mode chip | Mobile browser visibility test | CLOSED |
| RT-LIVE-004 | Shadow audit record altered after evaluation | No integrity field on the in-memory record | Undetected record mutation; High | AC 19, audit integrity | Add canonical SHA-256 record hash and previous-hash field | Original/tampered record verification | PARTIALLY CLOSED |
| RT-LIVE-005 | Field controller/device integration | Vendor protocol, device identity and durable audit implementation unavailable | Cannot verify field safety or cyber controls; Critical | AC 5, 19, 27 | Obtain vendor/MPAJ inputs; implement and HIL-test outside this WBS increment | HIL and independent security assessment | NOT TESTABLE |

## Targeted remediation trace

- RT-LIVE-001: `lib/safety-orchestrator.ts`, `lib/simulation.ts`, `tests/live-integration-red-team.test.ts`, focused browser test.
- RT-LIVE-002: `lib/live-integration/adapters.ts`, `tests/live-integration.test.ts`.
- RT-LIVE-003: `app/enhancements.css`, `tests/e2e/simulator.spec.ts`.
- RT-LIVE-004: `lib/live-integration/shadow-engine.ts`, `tests/live-integration.test.ts`. Residual risk remains because no durable append-only store exists.
- RT-LIVE-005: no speculative field implementation was created.

## Cross-feature adversarial results

| Required interaction | Result |
|---|---|
| Pedestrian WALK + emergency approach | PASS — pedestrian clearance retains WALK; both vehicle directions STOP |
| Heavy traffic + emergency approach | PASS — one validated emergency route takes priority |
| Heavy traffic + pedestrian demand | PASS — demand retained and served with both directions STOP |
| Camera degradation + pedestrian request | PASS — verified fixed fallback and authoritative record now agree |
| Sensor disagreement + speeding/stop-line conflict | PASS — collision prevention STOP/WAIT |
| Vehicle/blockage in zebra + pedestrian demand | PASS — all-red clearance, no WALK |
| Manual safe-hold + controller loss | PASS — safe-hold remains authoritative |
| School mode + emergency approach | PASS — single protected approach; conflicting movement and pedestrian WAIT |

## Objective closure evidence

- TypeScript: PASS.
- ESLint: PASS.
- Unit/contract/red-team suite: 118 tests in 9 files, PASS.
- Direct Next.js production compilation: PASS.
- Desktop degraded-fallback and operating-mode tests: 2/2 PASS.
- Earlier desktop crossing-clearance and mode tests: 2/2 PASS.
- Mobile operating-mode test: 1/1 PASS.
- No physical device, HIL, roadside, durable storage, or external-agency test was performed.

## Closure recommendation

Critical and High software findings RT-LIVE-001 and RT-LIVE-002 are CLOSED. RT-LIVE-004 is PARTIALLY CLOSED with residual audit-storage risk. RT-LIVE-005 is NOT TESTABLE until external inputs and HIL facilities exist. Therefore WBS-SC-LIVE-001 remains **PARTIAL** and is suitable for project-owner review of the software foundation, not live deployment or WBS-SC-LIVE-002 execution.
