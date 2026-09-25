import { describe, expect, it } from "vitest";
import { liveIntegrationConfigSchema, DEFAULT_LIVE_INTEGRATION_CONFIG } from "@/lib/live-integration/config";
import { HIL_ENTRY_CHECKS, type HilEntryEvidence } from "@/lib/live-integration/hil-gate";
import { runIsolatedHilReplay, type HilReplayFrame } from "@/lib/live-integration/hil-rehearsal";
import { AdapterIdentityRegistry, type DeviceKind, type FieldObservation } from "@/lib/live-integration/adapters";

const now = new Date("2026-09-22T08:00:00.000Z");
const config = liveIntegrationConfigSchema.parse({ ...DEFAULT_LIVE_INTEGRATION_CONFIG, operatingMode: "HARDWARE_IN_LOOP" });
const approvedEvidence: HilEntryEvidence[] = HIL_ENTRY_CHECKS.map((check) => ({ check, satisfied: true, evidenceReference: `test-only/${check.toLowerCase()}`, approvedBy: "test-fixture" }));

function observation(kind: DeviceKind, sourceId: string, sequence: number, value: unknown, observedAt = new Date(now.getTime() + sequence - 1).toISOString()): FieldObservation<unknown> {
  return { schemaVersion: "1.0", deviceId: `${sourceId}-DEVICE`, sourceId, kind, observedAt, receivedAt: observedAt, sequence, confidence: 0.98, health: "OPERATIONAL", value };
}

const identities = new AdapterIdentityRegistry([
  { deviceId: "PED-01-DEVICE", sourceId: "PED-01", kind: "PEDESTRIAN_SENSOR", interfaceId: "HIL-REPLAY-01" },
  { deviceId: "OCC-01-DEVICE", sourceId: "OCC-01", kind: "CROSSING_OCCUPANCY", interfaceId: "HIL-REPLAY-01" },
  { deviceId: "CTRL-01-DEVICE", sourceId: "CTRL-01", kind: "SIGNAL_CONTROLLER", interfaceId: "HIL-REPLAY-01" },
  { deviceId: "RADAR-EB-01-DEVICE", sourceId: "RADAR-EB-01", kind: "VEHICLE_RADAR", interfaceId: "HIL-REPLAY-01" },
]);

function frame(sequence: number, demand = true): HilReplayFrame {
  return { observations: [
    observation("PEDESTRIAN_SENSOR", "PED-01", sequence, { demand, crossingOccupied: false }),
    observation("CROSSING_OCCUPANCY", "OCC-01", sequence, { occupied: false, clearanceVerified: true }),
    observation("SIGNAL_CONTROLLER", "CTRL-01", sequence, { eastbound: "STOP", westbound: "STOP", pedestrian: "WAIT" }),
    observation("VEHICLE_RADAR", "RADAR-EB-01", sequence, { direction: "Eastbound", speedKmh: 31, vehiclePresent: false, queueVehicles: 0 }),
  ] };
}

describe("WBS-SC-LIVE-004-R1 trusted-payload software HIL replay", () => {
  it("does not execute when entry evidence is incomplete", () => {
    const result = runIsolatedHilReplay(config, approvedEvidence.slice(1), [frame(1)], identities, now);
    expect(result.status).toBe("BLOCKED");
    expect(result.frames).toHaveLength(0);
    expect(result.actuationAttempted).toBe(false);
  });

  it("derives a conflict-free WALK from validated payloads and records the source trace", () => {
    const result = runIsolatedHilReplay(config, approvedEvidence, [frame(1), frame(2)], identities, now);
    expect(result.status).toBe("COMPLETED_NON_ACTUATING");
    expect(result.auditChainValid).toBe(true);
    expect(result.frames[0].observationAccepted).toBe(true);
    expect(result.frames[0].decision.inputs.pedestrianDemand).toBe(true);
    expect(result.frames[0].decision.selectedResponse.pedestrian).toBe("WALK");
    expect(result.frames[0].decision.selectedResponse.vehicle).toEqual({ eastbound: "STOP", westbound: "STOP" });
    expect(result.frames[0].decision.inputTrace?.sources.map((item) => item.sourceId)).toContain("PED-01");
    expect(result.frames[1].decision.previousRecordHash).toBe(result.frames[0].decision.recordHash);
  });

  it("proves the payload, not a fixture assertion, determines the decision", () => {
    const result = runIsolatedHilReplay(config, approvedEvidence, [frame(1, false)], identities, now);
    expect(result.frames[0].decision.inputs.pedestrianDemand).toBe(false);
    expect(result.frames[0].decision.selectedResponse.pedestrian).toBe("WAIT");
    expect(result.frames[0].decision.selectedResponse.state).toBe("NORMAL_OPERATION");
  });

  it("rejects independent proposedInputs injection and holds STOP/WAIT", () => {
    const injected = { ...frame(1), proposedInputs: { mode: "NORMAL", pedestrianDemand: true, clearanceVerified: true, sensorState: "healthy" } };
    const result = runIsolatedHilReplay(config, approvedEvidence, [injected], identities, now);
    expect(result.frames[0].validationCode).toBe("PROPOSED_INPUTS_INJECTION");
    expect(result.frames[0].decision.selectedResponse.state).toBe("ALL_RED_CLEARANCE");
    expect(result.frames[0].decision.selectedResponse.vehicle).toEqual({ eastbound: "STOP", westbound: "STOP" });
    expect(result.frames[0].decision.selectedResponse.pedestrian).toBe("WAIT");
  });

  it("rejects missing observations with a reason-coded audit event", () => {
    const result = runIsolatedHilReplay(config, approvedEvidence, [{ observations: [observation("PEDESTRIAN_SENSOR", "PED-01", 1, { demand: true, crossingOccupied: false })] }], identities, now);
    expect(result.frames[0].validationCode).toBe("MISSING_REQUIRED_OBSERVATION");
    expect(result.frames[0].auditEvents.at(-1)?.code).toBe("MISSING_REQUIRED_OBSERVATION");
    expect(result.frames[0].decision.selectedResponse.pedestrian).toBe("WAIT");
  });

  it("rejects duplicate observations and holds safely", () => {
    const result = runIsolatedHilReplay(config, approvedEvidence, [frame(1), frame(1)], identities, now);
    expect(result.frames[1].validationCode).toBe("DUPLICATE_OR_OUT_OF_ORDER");
    expect(result.frames[1].decision.selectedResponse.pedestrian).toBe("WAIT");
  });

  it.each([
    ["missing device", { deviceId: undefined }],
    ["mismatched device", { deviceId: "PED-OTHER-DEVICE" }],
    ["unregistered source", { sourceId: "PED-UNREGISTERED", deviceId: "PED-UNREGISTERED-DEVICE" }],
  ])("rejects %s through the HIL identity boundary before fusion", (_name, override) => {
    const invalid = frame(1); invalid.observations = [{ ...invalid.observations[0], ...override } as FieldObservation<unknown>, ...invalid.observations.slice(1)];
    const result = runIsolatedHilReplay(config, approvedEvidence, [invalid], identities, now).frames[0];
    expect(result.validationCode).toBe("SOURCE_IDENTITY_MISMATCH");
    expect(result.decision.selectedResponse.vehicle).toEqual({ eastbound: "STOP", westbound: "STOP" });
    expect(result.decision.selectedResponse.pedestrian).toBe("WAIT");
    expect(result.auditEvents[0]).toMatchObject({ derivationRule: "ADAPTER_IDENTITY_BEFORE_FUSION", claimedIdentity: override });
    expect(result.auditEvents[0].identityRecordHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
