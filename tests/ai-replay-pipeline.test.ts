import { describe, expect, it } from "vitest";
import { buildReplayTrace, orderReplayFrames, type PedestrianDetection, type ReplayFrame } from "@/lib/ai-replay-pipeline";

const frame = (frameId: string, timestampMs: number): ReplayFrame => ({ frameId, timestampMs, width: 640, height: 480, bytes: 10 });
const detection = (frameId: string, timestampMs: number, x = 0.4, confidence = 0.95): PedestrianDetection => ({ detectionId: `d-${frameId}`, frameId, timestampMs, x, y: 0.4, width: 0.1, height: 0.2, confidence, modelVersion: "detector-test-v1" });

describe("offline replay pipeline", () => {
  it("orders frames deterministically and derives occupied then clear", () => {
    const frames = orderReplayFrames([frame("f-2", 2_000), frame("f-1", 1_000)], 3_000);
    const occupied = buildReplayTrace(frames[0], [detection("f-1", 1_000)]);
    const clear = buildReplayTrace(frames[1], [], occupied.tracks);
    expect(occupied.occupancy.state).toBe("OCCUPIED");
    expect(clear.occupancy.state).toBe("UNKNOWN");
    expect(clear.decision.pedestrian).toBe("WAIT");
  });

  it("holds when confidence is low or vehicle conflict exists", () => {
    const low = buildReplayTrace(frame("f-1", 1_000), [detection("f-1", 1_000, 0.4, 0.2)]);
    const conflict = buildReplayTrace(frame("f-2", 2_000), [detection("f-2", 2_000)], [], "NORMAL", true);
    expect(low.occupancy.state).toBe("UNKNOWN");
    expect(low.decision.pedestrian).toBe("WAIT");
    expect(conflict.decision.pedestrian).toBe("WAIT");
    expect(conflict.decision.vehicle.eastbound).toBe("STOP");
  });

  it("rejects stale and corrupt footage before processing", () => {
    expect(() => orderReplayFrames([{ frameId: "bad" }], 1_000)).toThrow("Corrupt");
    expect(() => orderReplayFrames([frame("old", 1)], 40_000)).toThrow("stale");
  });
});
