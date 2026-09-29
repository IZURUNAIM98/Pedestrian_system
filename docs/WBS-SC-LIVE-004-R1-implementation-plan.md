# WBS-SC-LIVE-004-R1 — Trusted Device Payload and Deterministic Observation Fusion

Plan and pre-change configuration-control record: 2026-09-22 (Asia/Kuala_Lumpur)

## AIM

- Actor: SmartCross safety-critical remediation engineer and runtime-validation/configuration-control function; not the independent closure reviewer.
- Input: the RT-HIL-001 assessment finding supplied with the remediation instruction, the local working tree, integrity lock, replay/fusion path and affected tests. No separate RT-HIL assessment artifact was present in the repository at inspection time.
- Mission: ensure HIL decisions are derived only from validated observation payloads, fail closed on untrusted or contradictory data, preserve STOP-before-WALK, and leave closure to independent review.

## Pre-change repository state

- Branch: `main`
- HEAD: `b0938e7c47302585837e34a10f0298255c732d4d`
- Working tree: dirty before remediation, with tracked modifications, tracked deletions and untracked files.
- Integrity manifest: `smartcross-2.2.lock.json`, SHA-256 `bcb9e38d56e74b65bc50e7ad05588ea5562d90ec840b21b1620d120cb3db90ad`.
- Existing baseline claim from the assessment: TypeScript, ESLint, production build and 129 tests passed. This plan does not recast that supplied claim as a newly executed result.

### Direct overlap with pre-existing user work

| Path | Pre-change state | Pre-change SHA-256 | Handling |
|---|---|---|---|
| `lib/live-integration/hil-rehearsal.ts` | untracked | `9920cf940dc8bf84ead75f2feb68eeb9ceda975df4916d412ca6067b6ec7942e` | Narrow in-place remediation; preserve non-actuation and readiness gate |
| `lib/live-integration/adapters.ts` | untracked | `4ed9aa7750d28e1ed35df2145a119494b690d5bfdf22b2384e8efe5fbc750074` | Extend existing adapter boundary with strict schemas and reason codes |
| `lib/safety-orchestrator.ts` | untracked | `be18c89ec3afcb97ad58420c9d3ed51be9846e7c024008defe6c339fc88e6465` | Inspect only unless a minimal interface change becomes essential |
| `tests/live-integration-hil-rehearsal.test.ts` | untracked | `111bb6c53a13036143a4ed3455c222d821b0135a256021945ee91165b37d88e1` | Replace fixture-input assertion path with payload-derived tests |
| `tests/live-integration.test.ts` | untracked | `a8415f60b08010c9caa841dafba7373a73417fcd3047fb5b37e231330229e133` | Update affected radar fixture to the new runtime contract |
| `tests/safety-orchestrator.test.ts` | untracked | `c2014162d849805b3255383fc654d085cb12d4318e53f3c9d7fb07b5412bb96f` | Preserve existing invariant coverage |
| `lib/types.ts` | tracked and modified | `474a6bc2f902853e579eb33d952f96bf4a391474e8b9f6cf610c4f817bdbaa71` | No remediation edit planned |
| `smartcross-2.2.lock.json` | tracked and modified | `bcb9e38d56e74b65bc50e7ad05588ea5562d90ec840b21b1620d120cb3db90ad` | Refresh only for final scoped files after verification |

All other modified, deleted and untracked paths shown by the pre-change `git status --short` are unrelated user work and are excluded from this remediation. No reset, deletion, bulk formatting, deployment, commit or push is authorised.

## Focused implementation plan

1. Define strict runtime payload schemas for every supported `DeviceKind`; reject unknown kinds, missing fields, extra fields, invalid ranges and impossible same-payload combinations.
2. Add deterministic batch fusion requiring pedestrian, occupancy and controller evidence; derive `SafetyInputs` only from accepted payload values.
3. Detect cross-source disagreement and controller WALK/movement conflicts; return `sensorState: failed` and `clearanceVerified: false` on every rejection.
4. Preserve `proposedInputs` only as a deprecated injection sentinel. Its presence must create `PROPOSED_INPUTS_INJECTION`, never influence a decision, and produce STOP/WAIT.
5. Attach source ID, kind, observed timestamp, sequence, validation outcome, derived fields and reason-coded audit events to the hash-protected shadow record.
6. Add negative and positive tests at Bloom levels apply/analyse/evaluate: schema cases, malformed payloads, metadata contradiction, unsupported kinds, missing coverage, disagreement, impossible combinations, injection, and payload-controlled decisions.
7. Run focused tests, full regression, TypeScript, ESLint, production build, integrity verification and text-standard validation. Refresh the integrity manifest only after these checks and rerun its verifier.
8. Issue a remediation record with results and residual risks. Status may be only `REMEDIATION IMPLEMENTED — CLOSURE REVIEW PENDING`.

## Explicit boundary

This is software-only remediation for RT-HIL-001. SK Taman Melawati 2 remains a proposed candidate only. No equipment, roadside network, agency system or physical signal output is connected or authorised. RT-HIL-002 through RT-HIL-008 are out of scope except for a minimal trace interface required by RT-HIL-001.
