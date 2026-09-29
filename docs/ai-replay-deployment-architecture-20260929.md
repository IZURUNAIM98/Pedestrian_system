# SmartCross recorded-footage AI Replay deployment architecture

Status: **DESIGNED — DEPLOYMENT BLOCKED**  
Scope: offline recorded-footage replay only; no roadside control

## Decision

Use an authenticated, separately deployed inference service. Do not run OpenVINO inside the current SmartCross Vercel bundle.

### Why

| Option | Finding | Decision |
|---|---|---|
| Current Vercel web bundle | Compact Next.js bundle; no Python/OpenVINO runtime, model files, video decoder or service worker path | Reject for direct inference |
| Browser inference | Would require a browser-compatible converted model, WebAssembly/WebGPU runtime, client model delivery and browser-memory testing; none is approved or present | Not selected |
| Separate inference service | Supports pinned Python/OpenVINO runtime, model files, bounded uploads, server-side authentication, health checks and fail-closed errors | Selected |

The isolated feasibility environment proved OpenVINO 2026.4.0 and the FP32 model can run on CPU, but that is not evidence that the current Vercel bundle can execute them. The service must be deployed independently and bound to an exact service version and model hashes before the web candidate can call it.

## Required service boundary

`POST /v1/replay` accepts an authenticated multipart upload containing a permitted video and a versioned configuration. It returns only detection envelopes and processing metadata. It has no signal-controller, emergency-dispatch, enforcement or actuator route.

Required controls:

- authentication before upload acceptance;
- content type allowlist and hard byte/frame/time limits;
- source timestamp validation and deterministic frame ordering;
- model hash and service-version binding;
- bounded temporary storage with deletion after processing;
- no raw footage in ordinary application logs;
- `AI_UNAVAILABLE`, `INPUT_REJECTED`, `MODEL_MISMATCH`, `TIMEOUT` and `UNKNOWN` states;
- no inferred WALK output from the service;
- service failure produces no detections and no AI-derived WALK recommendation.

## Release binding

The web release record must bind:

```text
web commit SHA
inference service image/version
model XML SHA-256
model BIN SHA-256
fixture SHA-256
configuration hash
owner license approval reference
data-permission reference
```

## Current blockers

1. The project owner has not supplied a separate artifact-license approval reference.
2. No permitted Normal/School crossing video and independent annotations exist.
3. The current `dashboard.tsx` candidate is unrelated simulator drift and fails the approved lock.
4. No inference service deployment target, credentials, domain, retention policy or preview environment is configured.

Until these are resolved, deployment must remain blocked.
