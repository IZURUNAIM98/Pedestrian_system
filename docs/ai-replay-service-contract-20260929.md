# AI Replay inference-service contract

Status: proposed, not deployed

## Request

```http
POST /v1/replay
Authorization: Bearer <short-lived service token>
Content-Type: multipart/form-data
```

Fields:

```text
footage: permitted video file
mode: NORMAL | SCHOOL
crossingPolygon: normalized polygon JSON
modelVersion: exact approved model identifier
modelSha256: exact approved artifact binding
requestId: caller-generated replay identifier
```

The service must reject missing authentication, unsupported media, files exceeding the configured byte limit, excessive duration/frame count, malformed polygons, stale/out-of-order timestamps, unknown model versions and hash mismatches.

## Response

```json
{
  "schemaVersion": "1.0",
  "requestId": "replay-...",
  "status": "COMPLETED",
  "model": {"version": "person-detection-0200-fp32", "xmlSha256": "...", "binSha256": "..."},
  "frames": [{
    "frameId": "f-0001",
    "sourceTimestampMs": 0,
    "detections": [{
      "detectionId": "f-0001-d000",
      "x": 0.1, "y": 0.2, "width": 0.2, "height": 0.5,
      "confidence": 0.91,
      "modelVersion": "person-detection-0200-fp32"
    }],
    "inferenceLatencyMs": 4.2
  }]
}
```

Failure responses expose a stable code and safe explanation, never a fabricated detection:

```text
AI_UNAVAILABLE | INPUT_REJECTED | MODEL_MISMATCH | TIMEOUT | INTERNAL_FAILURE
```

## Web integration rule

The web client passes only service detections into `lib/ai-replay-pipeline.ts`. The pipeline derives tracks, occupancy and deterministic simulated recommendations. `UNKNOWN`, stale, low-confidence, conflicting or missing observations remain `WAIT`/safe hold. The service cannot issue traffic-signal commands.

## Acceptance test contract

- authenticated success with permitted fixture;
- unauthenticated request rejected before storing footage;
- oversize, wrong-type, corrupt and timeout inputs rejected;
- model hash mismatch rejected;
- service unavailable renders `AI unavailable`;
- real model output reaches the displayed trace;
- no controller URL is contacted;
- raw footage is deleted according to the approved retention policy.
