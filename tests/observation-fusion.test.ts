import { describe, expect, it } from "vitest";
import { AdapterIdentityRegistry, validateObservation, type DeviceKind, type FieldObservation } from "@/lib/live-integration/adapters";
import { DEFAULT_LIVE_INTEGRATION_CONFIG } from "@/lib/live-integration/config";
import { fuseValidatedObservations } from "@/lib/live-integration/observation-fusion";

const now = new Date("2026-09-22T09:00:00.000Z");
const context = { now, staleAfterMs: 2_000 };
function obs(kind: DeviceKind, sourceId: string, value: unknown, overrides: Partial<FieldObservation<unknown>> = {}): FieldObservation<unknown> {
  return { schemaVersion: "1.0", deviceId: `${sourceId}-DEVICE`, sourceId, kind, observedAt: now.toISOString(), receivedAt: now.toISOString(), sequence: 1, confidence: 0.98, health: "OPERATIONAL", value, ...overrides } as FieldObservation<unknown>;
}
function core(): FieldObservation<unknown>[] {
  return [
    obs("PEDESTRIAN_SENSOR", "PED-01", { demand: true, crossingOccupied: false }),
    obs("CROSSING_OCCUPANCY", "OCC-01", { occupied: false, clearanceVerified: true }),
    obs("SIGNAL_CONTROLLER", "CTRL-01", { eastbound: "STOP", westbound: "STOP", pedestrian: "WAIT" }),
  ];
}
function expectSafeRejection(observations: FieldObservation<unknown>[], code: string) {
  const identities = new AdapterIdentityRegistry([...new Map(observations.map((item) => [item.sourceId, { deviceId: item.deviceId, sourceId: item.sourceId, kind: item.kind, interfaceId: "TEST-FUSION-01" }])).values()]);
  const result = fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, observations, context, identities);
  expect(result.accepted).toBe(false);
  expect(result.reasonCode).toBe(code);
  expect(result.inputs).toMatchObject({ sensorState: "failed", clearanceVerified: false });
}

describe("RT-HIL-001 deterministic observation fusion", () => {
  it.each([
    ["CCTV_EASTBOUND", { vehiclePresent: false, stopLineIntrusion: false, crossingOccupied: false }],
    ["CCTV_WESTBOUND", { vehiclePresent: false, stopLineIntrusion: false, crossingOccupied: false }],
    ["VEHICLE_RADAR", { direction: "Eastbound", speedKmh: 20, vehiclePresent: true, queueVehicles: 1 }],
    ["PEDESTRIAN_SENSOR", { demand: false, crossingOccupied: false }],
    ["CROSSING_OCCUPANCY", { occupied: false, clearanceVerified: true }],
    ["EMERGENCY_DETECTION", { detected: false }],
    ["PUSH_BUTTON", { pressed: false, authenticated: true }],
    ["SIGNAL_CONTROLLER", { eastbound: "STOP", westbound: "STOP", pedestrian: "WAIT" }],
    ["ACCESSIBILITY_DEVICE", { requestActive: false, authenticated: true }],
    ["EDGE_GATEWAY", { connected: true, upstreamHealthy: true }],
    ["OPERATOR_ALERT", { safeHold: false, resumeRequested: false }],
    ["ANPR", { vehicleDetected: false }],
  ] as const)("validates the %s runtime payload schema", (kind, value) => {
    const ids: Record<DeviceKind, string> = { CCTV_EASTBOUND: "CCTV-EB-01", CCTV_WESTBOUND: "CCTV-WB-01", VEHICLE_RADAR: "RADAR-01", PEDESTRIAN_SENSOR: "PED-01", CROSSING_OCCUPANCY: "OCC-01", EMERGENCY_DETECTION: "EM-01", PUSH_BUTTON: "BTN-01", SIGNAL_CONTROLLER: "CTRL-01", ACCESSIBILITY_DEVICE: "ACCESS-01", EDGE_GATEWAY: "EDGE-01", OPERATOR_ALERT: "OP-01", ANPR: "ANPR-01" };
    expect(validateObservation(obs(kind, ids[kind], value), context).valid).toBe(true);
  });

  it("rejects malformed and out-of-range payloads", () => {
    expect(validateObservation(obs("VEHICLE_RADAR", "RADAR-01", { direction: "Eastbound", speedKmh: 999, vehiclePresent: true, queueVehicles: 1 }), context).code).toBe("MALFORMED_PAYLOAD");
    expect(validateObservation(obs("PEDESTRIAN_SENSOR", "PED-01", { demand: "yes", crossingOccupied: false }), context).code).toBe("MALFORMED_PAYLOAD");
    expect(validateObservation(obs("CROSSING_OCCUPANCY", "OCC-01", { occupied: true, clearanceVerified: true }), context).code).toBe("MALFORMED_PAYLOAD");
    expect(validateObservation({ ...obs("PEDESTRIAN_SENSOR", "PED-01", { demand: true, crossingOccupied: false }), health: undefined } as unknown as FieldObservation<unknown>, context).code).toBe("MALFORMED_ENVELOPE");
  });

  it("rejects an unsupported device kind", () => {
    const unknown = { ...obs("ANPR", "UNKNOWN-01", { vehicleDetected: false }), kind: "MAGIC_SENSOR" } as unknown as FieldObservation<unknown>;
    const observations = core();
    const identities = new AdapterIdentityRegistry(observations.map((item) => ({ deviceId: item.deviceId, sourceId: item.sourceId, kind: item.kind, interfaceId: "TEST-FUSION-01" })));
    const result = fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, [...observations, unknown], context, identities);
    expect(result.reasonCode).toBe("SOURCE_IDENTITY_MISMATCH");
  });

  it("rejects payload-versus-metadata contradiction", () => {
    const emergency = obs("EMERGENCY_DETECTION", "EM-01", { detected: true, direction: "Eastbound", authenticated: true, confidence: 0.9 }, { confidence: 0.98 });
    expectSafeRejection([...core(), emergency], "PAYLOAD_METADATA_CONTRADICTION");
  });

  it("rejects cross-source occupancy disagreement", () => {
    const observations = core();
    observations[1] = obs("CROSSING_OCCUPANCY", "OCC-01", { occupied: true, clearanceVerified: false });
    expectSafeRejection(observations, "CROSS_SOURCE_DISAGREEMENT");
  });

  it("rejects impossible WALK plus vehicle movement", () => {
    const observations = core();
    observations[2] = obs("SIGNAL_CONTROLLER", "CTRL-01", { eastbound: "GO", westbound: "STOP", pedestrian: "WALK" });
    expectSafeRejection(observations, "IMPOSSIBLE_COMBINATION");
  });

  it("uses controller payload to withhold WALK until conflicting approaches are stopped", () => {
    const observations = core();
    observations[2] = obs("SIGNAL_CONTROLLER", "CTRL-01", { eastbound: "AMBER", westbound: "STOP", pedestrian: "WAIT" });
    const identities = new AdapterIdentityRegistry(observations.map((item) => ({ deviceId: item.deviceId, sourceId: item.sourceId, kind: item.kind, interfaceId: "TEST-FUSION-01" })));
    const result = fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, observations, context, identities);
    expect(result.accepted).toBe(true);
    expect(result.inputs.clearanceVerified).toBe(false);
  });
});
