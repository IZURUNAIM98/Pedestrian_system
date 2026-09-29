import { describe, expect, it } from "vitest";
import { SCENARIOS, runSimulation } from "@/lib/simulation";
import { assertConflictFree } from "@/lib/safety-orchestrator";
import { DEFAULT_LIVE_INTEGRATION_CONFIG, liveIntegrationConfigSchema } from "@/lib/live-integration/config";
import { evaluateTestOnlyShadowDecision, verifyShadowDecisionRecord } from "@/lib/live-integration/shadow-engine";

describe("WBS-SC-LIVE-001 integrated software gate", () => {
  it("preserves 20 Normal and 21 School selectable conditions in established order", () => {
    const normal = SCENARIOS.filter((scenario) => scenario.supportedModes.includes("normal"));
    const school = SCENARIOS.filter((scenario) => scenario.supportedModes.includes("school"));
    expect(normal).toHaveLength(20);
    expect(school).toHaveLength(21);
    expect(normal[0].id).toBe("normal-no-violation");
    expect(school[0].id).toBe("school-no-violation");
  });

  it("keeps every established condition conflict-free and seven-stage traceable", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        const result = runSimulation({ mode, scenarioId: scenario.id }, new Date("2026-09-22T00:00:00.000Z"));
        expect(result.timeline.map((stage) => stage.name), scenario.id).toEqual(["Approach", "Initiation", "Detected", "Escalation", "Conflict", "Response", "Outcome"]);
        expect(result.eventLog, scenario.id).toHaveLength(7);
        expect(() => assertConflictFree(result.safetyDecision), scenario.id).not.toThrow();
      }
    }
  });

  it("keeps all pre-live modes non-actuating", () => {
    for (const operatingMode of ["SIMULATION", "HARDWARE_IN_LOOP", "SHADOW", "SUPERVISED"] as const) {
      const config = liveIntegrationConfigSchema.parse({ ...DEFAULT_LIVE_INTEGRATION_CONFIG, operatingMode });
      const record = evaluateTestOnlyShadowDecision(config, { mode: "NORMAL", pedestrianDemand: true, clearanceVerified: true }, undefined, new Date("2026-09-22T00:00:00.000Z"));
      expect(record.operatingMode).toBe(operatingMode);
      expect(record.actuationAttempted).toBe(false);
      expect(verifyShadowDecisionRecord(record)).toBe(true);
    }
  });

  it("rejects an ungated LIVE_RESTRICTED configuration", () => {
    expect(() => liveIntegrationConfigSchema.parse({ ...DEFAULT_LIVE_INTEGRATION_CONFIG, operatingMode: "LIVE_RESTRICTED" })).toThrow();
  });
});
