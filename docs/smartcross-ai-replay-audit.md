# SmartCross AI/replay audit

Date: 2026-09-29  
Scope: this checkout, simulation-only application

## Evidence table

| Claimed capability | Actual implementation | Classification | Evidence |
|---|---|---|---|
| 21 crossing conditions | Fixed scenario catalogue and motion frames | Scripted scenario | `lib/simulation.ts`, `lib/motion.ts` |
| Detection confidence | Scenario/environment-derived confidence and conservative override | Deterministic rule / sensor-derived computation | `lib/simulation.ts`, `lib/camera-fallback.ts` |
| CCTV and plate evidence | Synthetic local records; no camera or database call | Scripted scenario | `lib/types.ts`, `lib/simulation.ts`, `components/dashboard.tsx` |
| Heavy traffic and emergency priority | Local deterministic state machines | Deterministic rule | `lib/heavy-traffic.ts`, `lib/emergency-priority.ts` |
| Field observation input | Validated envelopes, identity registry, stale/duplicate/conflict rejection | Sensor-derived computation interface | `lib/live-integration/adapters.ts`, `lib/live-integration/observation-fusion.ts` |
| Physical signal actuation | Explicitly unavailable; simulation uses proposed state only | Not implemented | `lib/live-integration/config.ts`, `lib/live-integration/adapters.ts` |
| AI Replay | Explicit unavailable state; no detector or model result is claimed | Model unavailable | `lib/ai-replay.ts` |

## Mode contract

- `SCRIPTED_DEMO` retains the existing scenarios and labels their provenance as a deterministic scenario engine.
- `AI_REPLAY` accepts a versioned observation envelope shape, but currently returns `MODEL_UNAVAILABLE`; it never fabricates detections or grants WALK.
- `LIVE_OBSERVATION` is a future integration boundary and remains unavailable without separate approval, identity, deployment, and hardware evidence.

## Safety and limitations

The existing safety layer remains authoritative for simulated decisions. The AI/replay boundary cannot authorize a signal state. Missing, malformed, stale, conflicting, or unavailable observations must remain fail-closed. No independent labelled video fixture, detector weights, measured precision/recall, or latency benchmark was present in this checkout, so those metrics are **not measured** and are not reported as targets achieved.

## Verification

`npm test -- --run tests/ai-replay.test.ts` covers provenance separation, model-unavailable fail-closed behavior, and malformed input rejection. Full lint, typecheck, build, and browser verification remain separate repository checks and do not constitute evidence of real model inference or physical HIL.
