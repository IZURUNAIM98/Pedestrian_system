# WBS-SC-LIVE-004-R1 Remediation Record

Finding: RT-HIL-001  
Status: **REMEDIATION IMPLEMENTED — CLOSURE REVIEW PENDING**  
Execution date: 2026-09-22  
Boundary: local software and non-actuating HIL replay only

## Finding and threat scenario

The assessment found that replay observations were checked only at the envelope level while a fixture-owned `proposedInputs` object could independently determine the safety decision. A malformed, contradictory or benign-looking observation could therefore accompany safety inputs that were not derived from the device payload.

Threat scenario: a replay fixture supplies a valid radar observation but injects `pedestrianDemand`, clearance or other decision fields through `proposedInputs`. The prior path could issue a decision based on the injected object rather than `observation.value`.

## Remediation mapping

| Changed file | RT-HIL-001 control |
|---|---|
| `lib/live-integration/adapters.ts` | Strict runtime schemas for all 12 supported device kinds; envelope, timestamp, range, payload and metadata-contradiction reason codes |
| `lib/live-integration/observation-fusion.ts` | Deterministic payload-to-`SafetyInputs` boundary; required-source coverage; disagreement and impossible-combination rejection; provenance and audit events |
| `lib/live-integration/hil-rehearsal.ts` | Removes fixture inputs from the decision path; detects legacy `proposedInputs` as an injection attempt and forces fail-closed inputs |
| `lib/live-integration/shadow-engine.ts` | Includes observation-fusion trace in the hash-protected shadow decision record |
| `tests/observation-fusion.test.ts` | Schema matrix and targeted negative tests for malformed, unsupported, contradictory, missing, disagreeing and impossible inputs |
| `tests/live-integration-hil-rehearsal.test.ts` | Demonstrates payload-controlled WALK/WAIT, injection rejection, missing-source rejection, sequence rejection and hash-linked traceability |
| `tests/live-integration.test.ts` | Updates the affected radar fixture to the explicit runtime payload contract |
| `docs/WBS-SC-LIVE-004-R1-implementation-plan.md` | Pre-change state, overlap record, AIM plan, scope and authority boundary |
| `smartcross-2.2.lock.json` | Integrity coverage for the RT-HIL-001 runtime, tests and records |

No change was required in `lib/safety-orchestrator.ts`: its conflict assertion and STOP/WAIT fail-safe decisions remain authoritative.

## Fail-closed behaviour

Unknown kinds, malformed envelopes/payloads, missing fields, extra fields, invalid ranges, stale/unavailable sources, payload-metadata contradictions, duplicate/out-of-order sequences, missing required observations, cross-source disagreement, impossible WALK/vehicle movement and `proposedInputs` injection produce a reason-coded rejection. The fusion result sets `sensorState: failed` and `clearanceVerified: false`; the resolver therefore returns vehicle STOP and pedestrian WAIT. No unsafe value is silently coerced.

The minimum decision evidence is one valid pedestrian sensor observation, one valid crossing-occupancy observation and one valid signal-controller observation. Controller payload state is part of clearance derivation, so pedestrian WALK is withheld until both conflicting vehicle approaches report STOP.

## Tests and exact results

| Verification | Command | Result |
|---|---|---|
| Targeted RT-HIL-001 and affected safety tests | `npm.cmd exec vitest run tests/observation-fusion.test.ts tests/live-integration-hil-rehearsal.test.ts tests/live-integration.test.ts tests/safety-orchestrator.test.ts` | PASS — 4 files, 54 tests |
| Complete regression suite | `npm.cmd test` | PASS — 13 files, 150 tests |
| TypeScript | `npm.cmd run typecheck` | PASS |
| ESLint | `npm.cmd run lint` | PASS |
| Text standard | `npm.cmd run validate:text` | PASS — 204 files in the final wrapper run |
| Direct production compilation | `next build` | PASS — Next.js 16.3.1 compiled, typechecked and generated 9/9 static pages |
| Integrity verification | `npm.cmd run verify:smartcross-2.2-lock` | PASS — 53 files |
| Production build with integrity and text prechecks | `npm.cmd run build` | PASS — lock and text prechecks passed; Next.js compiled, typechecked and generated 9/9 static pages |

Key enforcement evidence:

- A validated demand payload derives `pedestrianDemand: true`, then produces pedestrian WALK with eastbound and westbound STOP.
- Changing only that payload to `demand: false` derives WAIT and normal vehicle operation.
- Supplying `proposedInputs` creates `PROPOSED_INPUTS_INJECTION`; injected values do not enter `decision.inputs`, and the response is STOP/WAIT.
- Malformed, unsupported, contradictory, missing and cross-source-disagreeing cases produce their specific audit code and fail-closed inputs.

## Residual risks and closure boundary

- Payload schemas are software contracts, not proof that a vendor device, clock, identity, transport or calibration is trustworthy.
- The required-source set and semantic mappings need independent review against the approved vendor/MPAJ interface package before physical HIL.
- In-memory sequence state and hash-linked records are not durable append-only storage.
- Source authentication, cryptographic device identity, clock synchronisation and transport security are outside RT-HIL-001.
- No physical device, controller, roadside network, public-road system, external agency, deployment, commit or push was used.
- Two wrapper-build attempts encountered `EPERM` on a read-only OneDrive reparse directory under generated `.next/static`. After verifying the exact target was inside `.next`, that generated directory alone was removed and regenerated; the next complete wrapper build passed.
- SK Taman Melawati 2 remains only a proposed pilot candidate; this record authorises no site activity.
- RT-HIL-002 through RT-HIL-008 were not remediated or reassessed.

An independent closure reviewer must confirm the threat model, mappings, test adequacy and integrity evidence. This implementation record does not close RT-HIL-001.
