# SmartCross deterministic safety verification

## Decision and assurance boundary

SmartCross remains a simulation. It does not connect to traffic signals, cameras, emergency services, ANPR databases, or enforcement systems. The deterministic resolver in `lib/safety-orchestrator.ts` produces one explainable decision from simultaneous simulated inputs. AI confidence can restrict a decision but cannot authorise pedestrian WALK.

Priority is fixed: immediate collision prevention; pedestrians already inside the crossing; all-red clearance; verified emergency passage; queue stabilisation; stored pedestrian demand; normal operation. `assertConflictFree` rejects any result that combines pedestrian WALK with a conflicting vehicle movement.

## Requirements-to-test-to-evidence matrix

| Requirement | Implementation | Verification evidence | Expected result |
| --- | --- | --- | --- |
| No WALK with conflicting GREEN | `assertConflictFree` | `tests/safety-orchestrator.test.ts` invariant test | Unsafe output throws and cannot be returned |
| Pedestrian already crossing outranks emergency priority | `PEDESTRIAN_CLEARANCE` | Normal and School combination tests | Traffic STOP; existing WALK retained |
| Opposing emergency requests | `EMERGENCY_VALIDATION_HOLD` | Normal and School combination tests | All-red hold and human review |
| False/unverified emergency | Authenticated request and 0.90 confidence threshold | Normal and School combination tests | Priority rejected; no passage |
| Congestion plus pedestrian demand | `QUEUE_STABILISATION` with stored-demand rejection record | Normal and School combination tests | Bounded traffic phase; demand not discarded |
| Failed, stale, or contradictory sensing | `DEGRADED_SAFE_HOLD` | Sensor fault matrix and existing fallback tests | STOP/WAIT; human review |
| Stop-line intrusion/collision risk | `COLLISION_PREVENTION` | Normal and School combination tests | All movements held |
| Controlled restoration | `CONTROLLED_RECOVERY` | Recovery combination tests | All-red recovery buffer before release |
| Sequential timers | Existing single controller clock in crossing/heavy-traffic engines | Timer boundary and browser tests | WAIT, transition, WALK, clearance never jump silently |
| Evidence consistency | `SimulationResult.safetyDecision`, UI and PDF rows | unit/build/browser inspection | Same state and rejected commands are visible and reportable |
| Secure login fallback | Native `method=post`, POST route accepts form or JSON | auth/API/browser tests | Credentials never appear in URL when JavaScript is unavailable |
| Approved catalogue count | UI derives options from `SCENARIOS` | simulation catalogue regression tests | 20 Normal, 21 School including V0 baseline |

The V0-V20 naming in the governing prompt conflicts with the approved mode-specific catalogue: Normal has V0 plus 19 applicable violations (20 conditions), while School has V0 plus 20 violations (21 conditions). The interface continues to state these exact approved counts rather than claiming identical catalogues.

## Residual-risk register

| Risk | Status | Control / justification |
| --- | --- | --- |
| Browser refresh loses in-memory run history | Accepted for prototype | UI is explicitly session-local; no operational command is issued |
| Mock sensor/AI values do not represent field performance | Accepted for simulation | Values are labelled simulated; field validation is required before deployment |
| Operator identity is a shared demonstration credential | Accepted for controlled demo | Signed HTTP-only session and generic errors; not production IAM |
| Emergency authentication is modelled, not connected | Accepted for simulation | Unauthenticated inputs are rejected and no dispatch can occur |
| Real controller timing, electrical interlocks, and standards compliance | Unresolved outside prototype | Requires certified hardware, authority design approval, independent SIL assessment and field testing |
| ANPR accuracy/privacy governance | Unresolved outside prototype | Synthetic plates only; no live lookup or personal identification |

## Independent verification classification

- Remediated: deterministic conflict resolution, crossing-occupancy priority, opposing/false emergency handling, sensor fail-safe decisions, controlled recovery, explicit rejected-command evidence, native secure POST login fallback.
- Accepted with justification: session-local persistence, simulated sensor confidence, shared demonstration login, mock emergency and ANPR evidence.
- Unresolved for any real installation: controller certification, field geometry, communications resilience, cybersecurity accreditation, legal/privacy approval, emergency-agency integration, and live performance validation.

Release classification is **PASS CANDIDATE for the simulation only** when lock verification, lint, typecheck, the complete automated test suite, production build, browser checks, authenticated API checks, and post-deployment runtime checks all pass. It is not approval for a live traffic controller.
