# AI Replay vertical-slice status

Status: **INCOMPLETE — model dependency missing**  
Baseline commit inspected: `b0938e7c47302585837e34a10f0298255c732d4d`

## Implemented boundary

`lib/ai-replay-pipeline.ts` now provides the offline pipeline contract for:

1. timestamped frame validation, deterministic ordering, duplicate/future/stale rejection;
2. versioned pedestrian detection envelopes;
3. tracked occupancy with `CLEAR`, `OCCUPIED`, and conservative `UNKNOWN` occlusion state;
4. deterministic safety decisions through `resolveSafetyDecision`;
5. an operator event string that distinguishes model inference, track occupancy, rule decision, and simulated recommendation.

`lib/ai-replay.ts` remains the model gate. The current repository has no detector package, ONNX/TensorFlow runtime, model weights, permitted video fixture, or preprocessing contract. Therefore this change does **not** claim actual inference and does not label scripted scenario frames as AI output.

## Required model dependency

To complete the slice, provide a locally runnable pedestrian detector with a pinned artifact, checksum, license, preprocessing specification, runtime installation, and a permitted labelled or user-supplied video. The adapter must emit `PedestrianDetection` records with the actual model version and measured latency. Until then the UI must show `AI Replay unavailable`, and no AI-derived result may authorize WALK.

## Evidence and metrics

The tests cover deterministic frame ordering, occupied/occluded state, low-confidence handling, vehicle conflict, and stale/corrupt input. Accuracy is **NOT MEASURED** because no independent ground truth or real detector output is available. Physical HIL, live roadside integration, and signal actuation remain outside scope.
