import { describe, expect, it } from "vitest";
import { assertConflictFree, resolveSafetyDecision, type SafetyInputs } from "@/lib/safety-orchestrator";

const modes = ["NORMAL", "SCHOOL"] as const;
const combinations: Array<{ name: string; input: Partial<SafetyInputs>; state: string }> = [
  { name: "collision risk", input: { immediateCollisionRisk: true, pedestrianDemand: true }, state: "COLLISION_PREVENTION" },
  { name: "occupied crossing with emergency", input: { pedestrianInCrossing: true, emergencyRequests: [{ direction: "Eastbound", authenticated: true, confidence: 0.99 }] }, state: "PEDESTRIAN_CLEARANCE" },
  { name: "opposing emergencies", input: { emergencyRequests: [{ direction: "Eastbound", authenticated: true, confidence: 0.99 }, { direction: "Westbound", authenticated: true, confidence: 0.99 }] }, state: "EMERGENCY_VALIDATION_HOLD" },
  { name: "false emergency", input: { emergencyRequests: [{ direction: "Eastbound", authenticated: false, confidence: 0.99 }] }, state: "EMERGENCY_VALIDATION_HOLD" },
  { name: "stale sensors", input: { sensorState: "stale", pedestrianDemand: true }, state: "DEGRADED_SAFE_HOLD" },
  { name: "contradictory sensors", input: { sensorState: "contradictory", congestionActive: true }, state: "DEGRADED_SAFE_HOLD" },
  { name: "stop-line intrusion", input: { stopLineIntrusion: true, pedestrianDemand: true }, state: "COLLISION_PREVENTION" },
  { name: "congestion and demand", input: { congestionActive: true, pedestrianDemand: true }, state: "QUEUE_STABILISATION" },
  { name: "safe pedestrian demand", input: { pedestrianDemand: true, clearanceVerified: true }, state: "PEDESTRIAN_SERVICE" },
  { name: "operator hold", input: { operatorOverride: "safe-hold" }, state: "COLLISION_PREVENTION" },
  { name: "controlled recovery", input: { recoveryRequested: true }, state: "CONTROLLED_RECOVERY" },
];

describe("authoritative SmartCross safety resolver", () => {
  for (const mode of modes) for (const testCase of combinations) {
    it(`${mode}: ${testCase.name} resolves to one conflict-free decision`, () => {
      const first = resolveSafetyDecision({ mode, clearanceVerified: true, ...testCase.input });
      const second = resolveSafetyDecision({ mode, clearanceVerified: true, ...testCase.input });
      expect(first).toEqual(second);
      expect(first.state).toBe(testCase.state);
      expect(() => assertConflictFree(first)).not.toThrow();
    });
  }

  it("technically rejects WALK with any conflicting GREEN", () => {
    expect(() => assertConflictFree({ pedestrian: "WALK", vehicle: { eastbound: "GO", westbound: "STOP" } })).toThrow(/cannot coexist/);
  });
});
