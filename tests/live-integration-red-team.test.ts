import { describe, expect, it } from "vitest";
import { runSimulation } from "@/lib/simulation";
import { resolveSafetyDecision } from "@/lib/safety-orchestrator";
import { createHeavyTrafficState, HEAVY_TRAFFIC_DEFAULTS, heavyTrafficSignals, registerHeavyTrafficRequest, stepHeavyTraffic } from "@/lib/heavy-traffic";

describe("WBS-SC-LIVE-001 Red Team cross-feature matrix", () => {
  it("protects an active WALK from an emergency approach", () => {
    const result = resolveSafetyDecision({ mode: "NORMAL", pedestrianInCrossing: true, emergencyRequests: [{ direction: "Eastbound", authenticated: true, confidence: 0.99 }] });
    expect(result.state).toBe("PEDESTRIAN_CLEARANCE"); expect(result.pedestrian).toBe("WALK"); expect(result.vehicle).toEqual({ eastbound: "STOP", westbound: "STOP" });
  });

  it("gives a single verified emergency precedence over heavy traffic", () => {
    const result = resolveSafetyDecision({ mode: "NORMAL", congestionActive: true, emergencyRequests: [{ direction: "Westbound", authenticated: true, confidence: 0.99 }] });
    expect(result.state).toBe("EMERGENCY_PASSAGE"); expect(result.vehicle).toEqual({ eastbound: "STOP", westbound: "GO" }); expect(result.pedestrian).toBe("WAIT");
  });

  it("retains pedestrian demand during heavy traffic and serves it conflict-free", () => {
    let state = registerHeavyTrafficRequest(createHeavyTrafficState({ ...HEAVY_TRAFFIC_DEFAULTS, initialQueue: 8 })); let walked = false;
    for (let tick = 0; tick < 100; tick++) { state = stepHeavyTraffic(state); const signals = heavyTrafficSignals(state); if (signals.pedestrian === "WALK") { walked = true; expect(signals.eastbound).toBe("STOP"); expect(signals.westbound).toBe("STOP"); } }
    expect(walked).toBe(true);
  });

  it("aligns degraded-camera fallback WALK with the authoritative decision", () => {
    const result = runSimulation({ mode: "normal", scenarioId: "normal-no-violation", operatingConditions: { weather: "rain", lighting: "night", visibility: "dense-haze" }, manualCrossingRequest: true });
    expect(result.cameraFallback?.protectedCrossingVerified).toBe(true); expect(result.signal.pedestrian).toBe("WALK"); expect(result.safetyDecision.state).toBe("PEDESTRIAN_SERVICE"); expect(result.safetyDecision.pedestrian).toBe("WALK");
  });

  it("holds sensor disagreement even when a speeding conflict is reported", () => {
    const result = resolveSafetyDecision({ mode: "NORMAL", sensorState: "contradictory", stopLineIntrusion: true, pedestrianDemand: true });
    expect(result.state).toBe("COLLISION_PREVENTION"); expect(result.vehicle.eastbound).toBe("STOP"); expect(result.pedestrian).toBe("WAIT");
  });

  it("holds a blocked zebra crossing with pedestrian demand", () => {
    const result = resolveSafetyDecision({ mode: "NORMAL", clearanceVerified: false, pedestrianDemand: true });
    expect(result.state).toBe("ALL_RED_CLEARANCE"); expect(result.pedestrian).toBe("WAIT");
  });

  it("manual safe-hold remains authoritative during controller communication loss", () => {
    const result = resolveSafetyDecision({ mode: "NORMAL", operatorOverride: "safe-hold", sensorState: "failed", recoveryRequested: true });
    expect(result.state).toBe("COLLISION_PREVENTION"); expect(result.recoveryState).toBe("awaiting-clearance");
  });

  it("applies the same protected emergency hierarchy in School mode", () => {
    const result = resolveSafetyDecision({ mode: "SCHOOL", emergencyRequests: [{ direction: "Eastbound", authenticated: true, confidence: 0.99 }], pedestrianDemand: true });
    expect(result.state).toBe("EMERGENCY_PASSAGE"); expect(result.vehicle).toEqual({ eastbound: "GO", westbound: "STOP" }); expect(result.pedestrian).toBe("WAIT");
  });
});
