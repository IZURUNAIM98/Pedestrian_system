import { describe, expect, it } from "vitest";
import { runReplay } from "@/lib/ai-replay";

describe("explicit replay provenance", () => {
  it("does not label scripted scenarios as AI inference", () => {
    const result = runReplay("SCRIPTED_DEMO");
    expect(result.status).toBe("REJECTED");
    expect(result.provenance.algorithm).toBe("deterministic-scenario-engine");
    expect(result.provenance.modelVersion).toBeNull();
  });

  it("fails closed when the AI replay model is unavailable", () => {
    const result = runReplay("AI_REPLAY", [{ timestampMs: 1, sourceId: "fixture-camera", frameId: "f-001", payload: {} }]);
    expect(result.status).toBe("MODEL_UNAVAILABLE");
    expect(result.accepted).toBe(false);
    expect(result.observationsProcessed).toBe(1);
    expect(result.provenance.input).toBe("recorded-observation");
  });

  it("rejects malformed observations before processing", () => {
    const result = runReplay("AI_REPLAY", [{ timestampMs: "now" }]);
    expect(result.status).toBe("REJECTED");
    expect(result.observationsProcessed).toBe(0);
  });
});
