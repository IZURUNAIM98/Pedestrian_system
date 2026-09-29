# Proposed AI Replay adapter handoff

This is a handoff specification, not an implementation approval. The isolated feasibility runner is `tools/isolated-openvino-feasibility.py`; its raw output is `.artifact_runtime/openvino-20260929/evidence/raw-inference.json`.

## Interface

```text
loadModel({ modelXml, modelBin, runtimeVersion, sha256 })
decodeFrames(videoPath) -> ReplayFrame { frameId, timestampMs, width, height, bytes }
infer(frame) -> PedestrianDetection[]
run(frame, detections, previousTracks, config) -> ReplayPipelineTrace
```

`infer` must populate the existing detection envelope with the pinned model version and must preserve frame timestamp and source provenance. Model outputs are the only permitted source for inference detections. Annotation files, fixtures and scripted scenarios are never valid detector inputs.

## Failure behavior

- Missing or mismatched model hash: `AI Replay unavailable`; stop before inference.
- Runtime/load failure: `AI Replay unavailable`; retain no fabricated detections.
- Decoder failure, corrupt frame, future frame or stale frame: reject the frame and emit a failure event.
- Low confidence or brief occlusion: occupancy `UNKNOWN`; deterministic safety layer returns `WAIT`/safe hold.
- Vehicle conflict or invalid signal state: deterministic safety layer withholds WALK.
- No physical controller adapter is permitted; output is a simulated recommendation only.

## Acceptance criteria

- Real model output is visible and linked to frame ID, timestamp, model version and latency.
- Empty, entering, occupied, leaving and partly occluded annotated samples are replayed.
- Identical model, fixture and configuration produce the same ordered detection/track/occupancy/decision trace.
- Existing 21 scripted scenarios remain in Scripted Demo and unchanged.
- Targeted replay tests, full scenario tests, typecheck, lint, lock validation and production build pass from a clean checkout.
- Owner approval record is completed before adding the runtime/artifact to SmartCross.

## Feasibility evidence status

The official FP32 artifact was loaded and executed outside SmartCross. XML SHA-256 is `bb0cf8c9e4c1b4de5204ccb7490c419aee0a8108ce6c775531b54cd254f7175b`; BIN SHA-256 is `95484b917605776d7f17ce133d7f44c3a10ca9c708924262da6a87550ce647c9`. The official indoor demo clip ran at 12 fps with 4.4528 ms mean CPU inference latency. This is technical feasibility evidence only. The fixture lacks a documented SmartCross crossing polygon and independent annotations, and exact artifact/runtime/data licensing remains subject to owner review.
