import { describe, expect, it } from "vitest";
import { AdapterIdentityRegistry, InMemoryReplayAdapter, MockAdapter, ObservationGuard, validateObservation, type FieldObservation } from "@/lib/live-integration/adapters";
import { canIssuePhysicalSignalCommand, DEFAULT_LIVE_INTEGRATION_CONFIG, liveIntegrationConfigSchema } from "@/lib/live-integration/config";
import { evaluateTestOnlyShadowDecision, verifyShadowDecisionRecord } from "@/lib/live-integration/shadow-engine";

const now = new Date("2026-09-21T08:00:00.000Z");
const observation: FieldObservation<{ direction: "Eastbound"; speedKmh: number; vehiclePresent: boolean; queueVehicles: number }> = { schemaVersion: "1.0", deviceId: "RADAR-DEVICE-EB-01", sourceId: "RADAR-EB-01", kind: "VEHICLE_RADAR", observedAt: now.toISOString(), receivedAt: now.toISOString(), sequence: 1, confidence: 0.96, health: "OPERATIONAL", value: { direction: "Eastbound", speedKmh: 38, vehiclePresent: true, queueVehicles: 1 } };

describe("WBS-SC-LIVE-001 foundation", () => {
  it("defaults to a non-actuating simulation mode", () => {
    expect(DEFAULT_LIVE_INTEGRATION_CONFIG.operatingMode).toBe("SIMULATION");
    expect(canIssuePhysicalSignalCommand(DEFAULT_LIVE_INTEGRATION_CONFIG)).toBe(false);
  });

  it("rejects live actuation without all three gates", () => {
    expect(() => liveIntegrationConfigSchema.parse({ ...DEFAULT_LIVE_INTEGRATION_CONFIG, operatingMode: "LIVE_RESTRICTED" })).toThrow(/deployment safety gate/i);
    expect(() => liveIntegrationConfigSchema.parse({ ...DEFAULT_LIVE_INTEGRATION_CONFIG, liveActuation: { enabled: true } })).toThrow(/outside LIVE_RESTRICTED/i);
  });

  it("treats stale, future and failed observations as unsafe", () => {
    expect(validateObservation(observation, { now, staleAfterMs: 2_000 }).valid).toBe(true);
    expect(validateObservation({ ...observation, observedAt: new Date(now.getTime() - 2_001).toISOString() }, { now, staleAfterMs: 2_000 }).reason).toBe("Observation is stale.");
    expect(validateObservation({ ...observation, health: "FAILED" }, { now, staleAfterMs: 2_000 }).valid).toBe(false);
  });

  it("supports mock and replay input without a vendor protocol", async () => {
    const mock = new MockAdapter("RADAR-EB-01", "VEHICLE_RADAR", observation); await mock.connect();
    expect((await mock.read({ now, staleAfterMs: 2_000 })).value.speedKmh).toBe(38);
    const identities = new AdapterIdentityRegistry([{ deviceId: "RADAR-DEVICE-EB-01", sourceId: "RADAR-EB-01", kind: "VEHICLE_RADAR", interfaceId: "REPLAY-CHANNEL-01" }]);
    const replay = new InMemoryReplayAdapter(identities, "RADAR-EB-01", [observation]); await replay.connect();
    expect((await replay.read({ now, staleAfterMs: 2_000 })).sequence).toBe(1);
    await expect(replay.read({ now, staleAfterMs: 2_000 })).rejects.toThrow("Replay exhausted");
  });

  it("rejects duplicate and out-of-order device observations", () => {
    const guard = new ObservationGuard();
    expect(guard.accept(observation, { now, staleAfterMs: 2_000 }).valid).toBe(true);
    expect(guard.accept(observation, { now, staleAfterMs: 2_000 }).reason).toMatch(/out-of-order/);
    expect(guard.accept({ ...observation, sequence: 0 }, { now, staleAfterMs: 2_000 }).valid).toBe(false);
    expect(guard.accept({ ...observation, sequence: 2 }, { now, staleAfterMs: 2_000 }).valid).toBe(true);
  });

  it("produces identical deterministic shadow decisions and never actuates", () => {
    const inputs = { mode: "NORMAL" as const, pedestrianDemand: true, clearanceVerified: true, sensorState: "healthy" as const, aiConfidence: 0.95 };
    const first = evaluateTestOnlyShadowDecision(DEFAULT_LIVE_INTEGRATION_CONFIG, inputs, undefined, now);
    const second = evaluateTestOnlyShadowDecision(DEFAULT_LIVE_INTEGRATION_CONFIG, inputs, undefined, now);
    expect(first.correlationId).toBe(second.correlationId);
    expect(first.selectedResponse).toEqual(second.selectedResponse);
    expect(first.actuationAttempted).toBe(false);
    expect(verifyShadowDecisionRecord(first)).toBe(true);
    expect(verifyShadowDecisionRecord({ ...first, applicableRule: "NORMAL_OPERATION" })).toBe(false);
    expect(first.selectedResponse.pedestrian).toBe("WALK");
    expect(first.selectedResponse.vehicle).toEqual({ eastbound: "STOP", westbound: "STOP" });
  });

  it("protects a pedestrian already crossing from emergency pre-emption", () => {
    const record = evaluateTestOnlyShadowDecision(DEFAULT_LIVE_INTEGRATION_CONFIG, { mode: "SCHOOL", pedestrianInCrossing: true, emergencyRequests: [{ direction: "Eastbound", authenticated: true, confidence: 0.98 }] }, undefined, now);
    expect(record.selectedResponse.state).toBe("PEDESTRIAN_CLEARANCE");
    expect(record.selectedResponse.pedestrian).toBe("WALK");
    expect(record.selectedResponse.vehicle.eastbound).toBe("STOP");
  });
});
