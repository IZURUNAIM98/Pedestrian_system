# WBS-SC-LIVE-002 Hardware-in-the-Loop Preparation Plan

Prepared: 2026-09-22

Status: `SOFTWARE REHEARSAL PASSED - PHYSICAL HIL BLOCKED PENDING EXTERNAL APPROVALS`

The controlled physical-HIL readiness package is maintained under `docs/WBS-SC-LIVE-002-physical-hil/`. Its current readiness decision is `BLOCKED`; the milestone is Ready for Isolated Physical HIL, not go-live.

## AIM statement

- **Actor:** SmartCross project owner, MPAJ representatives, qualified traffic-signal engineer, device vendors, cybersecurity/privacy owners, and the software verification team.
- **Input:** WBS-SC-LIVE-001 conditional gate, deterministic SmartCross baseline, proposed vendor protocols, isolated equipment, approved safety case, and controlled test evidence.
- **Mission:** Demonstrate in an isolated laboratory that timestamped field-device inputs can be consumed safely and deterministically without any path to a public-road signal or external operational service.

## Owner direction record

The owner directed the team to carry on with the next steps. This authorises preparation under the conditions in the WBS-SC-LIVE-001 integrated gate. It does not represent authority approval, vendor acceptance, integrity-lock refresh, field installation, production deployment, or physical actuation.

## Scope

Included:

1. Define the HIL entry checklist and evidence register.
2. Prepare device-contract, replay, time-synchronisation, stale-data, recovery, and rollback tests.
3. Use an isolated bench controller or approved emulator with outputs physically and logically separated from public infrastructure.
4. Compare deterministic SmartCross proposals with bench feedback while retaining STOP-before-WALK.
5. Preserve correlation IDs and hash-verifiable test records.

Excluded:

- Public-road connection or signal actuation.
- Unapproved vendor protocol implementation.
- Live ANPR, identity processing, enforcement, or emergency-service notification.
- Production deployment or integrity-lock refresh.

## Entry evidence matrix

| Check | Required evidence | Approval owner | Current state |
|---|---|---|---|
| Owner classification | Owner direction to proceed under the documented conditions | Project owner | RECEIVED FOR PREPARATION |
| Authority safety approval | Approved HIL scope and safety plan | MPAJ and traffic-signal engineer | PENDING |
| Vendor protocol package | Interface, electrical, timing, identity and failure-mode documents | Device/controller vendors | PENDING |
| Isolated bench | Network and wiring diagram proving no public-road output | Test facility owner | PENDING |
| Cybersecurity controls | Device identity, signed messages, replay protection, secrets, RBAC, patch/rollback plan | Cybersecurity owner | PENDING |
| Privacy approval | Approved treatment of imagery, ANPR and evidence retention | Privacy/legal owner | PENDING |
| Durable audit store | Append-only encrypted record, backup and restore design | System owner | PENDING |
| Rollback plan | Approved rollback drill and recovery acceptance criteria | Engineering owner | PENDING |

The executable `assessHilReadiness` gate treats a missing approval, approver, or evidence reference as `BLOCKED`. Even a complete checklist permits only isolated HIL; `actuationPermitted` remains `false`.

## Test sequence

1. **Remember:** identify every device, data field, unit, clock source and safe state.
2. **Understand:** map vendor states to SmartCross observations without weakening confidence or freshness rules.
3. **Apply:** replay nominal Normal and School inputs through bilateral sensors and the bench controller.
4. **Analyse:** inject stale, future, duplicate, reordered, contradictory and failed-device observations.
5. **Evaluate:** verify STOP-before-WALK, bounded pedestrian wait, emergency authentication, recovery and complete audit chronology.
6. **Create:** issue a controlled HIL evidence pack with test hashes, deviations, rollback results and an owner decision record.

## Minimum acceptance tests

| Area | Acceptance requirement |
|---|---|
| Isolation | No electrical, radio, network or credential path to a public-road controller |
| Signal invariant | Pedestrian WALK is impossible unless all conflicting vehicle channels are confirmed STOP |
| Freshness | Stale, future, duplicate and reordered input fails closed and is logged |
| Device loss | Disconnect or contradiction produces bounded STOP/WAIT or approved fixed fallback |
| Timing | Amber, all-red, pedestrian clearance and maximum-wait rules remain deterministic |
| Emergency priority | Only authenticated, fresh, corroborated input may enter the proposal path |
| Audit | Every input, decision, proposal, rejection and operator action is correlated and tamper-evident |
| Recovery | Restart and rollback return the bench to a known non-actuating safe state |
| Human control | Roles, overrides, acknowledgements and stop-work authority are tested |

## Exit decision

WBS-SC-LIVE-002 may be marked complete only after all entry evidence and tests are independently reviewed. Any conflict possibility, unintended output, unknown controller state, unauthenticated priority, lost audit chain, or unbounded wait is a stop-work condition. Completion would support a separate supervised-pilot proposal; it would not itself authorise a field pilot.
