import { describe, expect, it } from "vitest";
import { AdapterIdentityRegistry, MockAdapter, ObservationGuard, validateObservation, type DeviceKind, type FieldObservation } from "@/lib/live-integration/adapters";
import { DEFAULT_LIVE_INTEGRATION_CONFIG, liveIntegrationConfigSchema } from "@/lib/live-integration/config";
import { HIL_ENTRY_CHECKS, type HilEntryEvidence } from "@/lib/live-integration/hil-gate";
import { runIsolatedHilReplay, type HilReplayFrame } from "@/lib/live-integration/hil-rehearsal";
import { fuseValidatedObservations, type ObservationFusionResult } from "@/lib/live-integration/observation-fusion";
import { evaluateShadowDecision, verifyShadowDecisionRecord } from "@/lib/live-integration/shadow-engine";

const now = new Date("2026-09-24T04:00:00.000Z");
const context = { now, staleAfterMs: 2_000 };
const hilConfig = liveIntegrationConfigSchema.parse({ ...DEFAULT_LIVE_INTEGRATION_CONFIG, operatingMode: "HARDWARE_IN_LOOP" });
const evidence: HilEntryEvidence[] = HIL_ENTRY_CHECKS.map((check) => ({ check, satisfied: true, evidenceReference: `closure-test/${check}`, approvedBy: "test-fixture" }));
function obs(kind: DeviceKind, sourceId: string, value: unknown, overrides: Partial<FieldObservation<unknown>> = {}): FieldObservation<unknown> { return { schemaVersion: "1.0", deviceId: `${sourceId}-DEVICE`, sourceId, kind, observedAt: now.toISOString(), receivedAt: now.toISOString(), sequence: 1, confidence: 0.98, health: "OPERATIONAL", value, ...overrides } as FieldObservation<unknown>; }
function complete(): FieldObservation<unknown>[] { return [obs("PEDESTRIAN_SENSOR", "PED-01", { demand: true, crossingOccupied: false }), obs("CROSSING_OCCUPANCY", "OCC-01", { occupied: false, clearanceVerified: true }), obs("SIGNAL_CONTROLLER", "CTRL-01", { eastbound: "STOP", westbound: "STOP", pedestrian: "WAIT" }), obs("CCTV_EASTBOUND", "CCTV-EB-01", { vehiclePresent: false, stopLineIntrusion: false, crossingOccupied: false }), obs("VEHICLE_RADAR", "RADAR-01", { direction: "Eastbound", speedKmh: 0, vehiclePresent: false, queueVehicles: 0 })]; }
const identityRegistry = new AdapterIdentityRegistry(complete().map((item) => ({ deviceId: item.deviceId, sourceId: item.sourceId, kind: item.kind, interfaceId: "HIL-REPLAY-01" })));
function assertStopWait(fusion: ObservationFusionResult, code: string) { expect(fusion.reasonCode).toBe(code); const record = evaluateShadowDecision(DEFAULT_LIVE_INTEGRATION_CONFIG, fusion, undefined, now); expect(record.selectedResponse.vehicle).toEqual({ eastbound: "STOP", westbound: "STOP" }); expect(record.selectedResponse.pedestrian).toBe("WAIT"); expect(record.inputTrace?.auditEvents.some((event) => event.validationResult === "REJECTED")).toBe(true); expect(verifyShadowDecisionRecord(record)).toBe(true); }

describe("RT-HIL-001 Stage 16 closure-deficiency remediation", () => {
  it("canonicalises equivalent permitted arrival orders", () => {
    const base = complete();
    const orders = [base, [...base].reverse(), [base[2], base[4], base[0], base[3], base[1]], [base[4], base[1], base[3], base[0], base[2]]];
    const results = orders.map((items) => fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, items, context, identityRegistry));
    for (const result of results) { expect(result.inputs).toEqual(results[0].inputs); expect(result.reasonCode).toBe("FUSED"); expect(result.trace).toEqual(results[0].trace); }
    const records = results.map((result) => evaluateShadowDecision(DEFAULT_LIVE_INTEGRATION_CONFIG, result, undefined, now));
    expect(new Set(records.map((record) => record.recordHash)).size).toBe(1);
  });

  it("canonicalises equal and near-equal timestamps using documented tie breakers", () => {
    const items = complete().map((item, index) => ({ ...item, receivedAt: new Date(now.getTime() + (index % 2)).toISOString() }));
    const first = fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, items, { now: new Date(now.getTime() + 1), staleAfterMs: 2_000 }, identityRegistry);
    const second = fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, [...items].reverse(), { now: new Date(now.getTime() + 1), staleAfterMs: 2_000 }, identityRegistry);
    expect(second).toEqual(first);
  });

  it("hash-protects receivedAt and all fusion provenance", () => {
    const fusion = fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, complete(), context, identityRegistry);
    const record = evaluateShadowDecision(DEFAULT_LIVE_INTEGRATION_CONFIG, fusion, undefined, now);
    expect(record.inputTrace?.sources[0].receivedAt).toBeDefined();
    const changed = structuredClone(record); changed.inputTrace!.sources[0].receivedAt = new Date(now.getTime() + 1).toISOString();
    expect(verifyShadowDecisionRecord(changed)).toBe(false);
    const changedRule = structuredClone(record); changedRule.inputTrace!.sources[0].derivationRule = "ALTERED";
    expect(verifyShadowDecisionRecord(changedRule)).toBe(false);
  });

  it.each([
    ["missing schema version", { schemaVersion: undefined }, "SOURCE_IDENTITY_MISMATCH"],
    ["unsupported schema version", { schemaVersion: "2.0" }, "SOURCE_IDENTITY_MISMATCH"],
    ["NaN confidence", { confidence: Number.NaN }, "MALFORMED_ENVELOPE"],
    ["positive infinity confidence", { confidence: Number.POSITIVE_INFINITY }, "MALFORMED_ENVELOPE"],
    ["negative infinity confidence", { confidence: Number.NEGATIVE_INFINITY }, "MALFORMED_ENVELOPE"],
    ["empty source", { sourceId: "" }, "SOURCE_IDENTITY_MISMATCH"],
    ["oversized source", { sourceId: `PED-${"A".repeat(65)}` }, "SOURCE_IDENTITY_MISMATCH"],
    ["invalid source characters", { sourceId: "PED_01" }, "SOURCE_IDENTITY_MISMATCH"],
  ])("rejects %s", (_name, override, code) => {
    const invalid = { ...complete()[0], ...override } as FieldObservation<unknown>;
    assertStopWait(fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, [invalid, ...complete().slice(1)], context, identityRegistry), code);
  });

  it("rejects unknown top-level and nested fields", () => {
    const top = { ...complete()[0], extra: true } as FieldObservation<unknown>;
    assertStopWait(fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, [top, ...complete().slice(1)], context, identityRegistry), "MALFORMED_ENVELOPE");
    const nested = obs("PEDESTRIAN_SENSOR", "PED-01", { demand: true, crossingOccupied: false, extra: true });
    assertStopWait(fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, [nested, ...complete().slice(1)], context, identityRegistry), "MALFORMED_PAYLOAD");
  });

  it("rejects source/device-kind mismatch and camera/radar disagreement", () => {
    const mismatch = obs("VEHICLE_RADAR", "PED-01", { direction: "Eastbound", speedKmh: 0, vehiclePresent: false, queueVehicles: 0 });
    expect(validateObservation(mismatch, context).code).toBe("SOURCE_KIND_MISMATCH");
    const disagreement = complete(); disagreement[3] = obs("CCTV_EASTBOUND", "CCTV-EB-01", { vehiclePresent: true, stopLineIntrusion: false, crossingOccupied: false });
    assertStopWait(fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, disagreement, context, identityRegistry), "CROSS_SOURCE_DISAGREEMENT");
  });

  it("rejects duplicate, reordered, late and invalid receipt timing", () => {
    const duplicate = [...complete(), { ...complete()[0] }];
    assertStopWait(fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, duplicate, context, identityRegistry), "DUPLICATE_OR_OUT_OF_ORDER");
    const guard = new ObservationGuard(); expect(guard.accept({ ...complete()[0], sequence: 2 }, context).valid).toBe(true); expect(guard.accept({ ...complete()[0], sequence: 1 }, context).code).toBe("DUPLICATE_OR_OUT_OF_ORDER");
    const late = { ...complete()[0], observedAt: new Date(now.getTime() - 2_001).toISOString(), receivedAt: new Date(now.getTime() - 2_000).toISOString() };
    assertStopWait(fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, [late, ...complete().slice(1)], context, identityRegistry), "STALE_OBSERVATION");
    const reversedTime = { ...complete()[0], receivedAt: new Date(now.getTime() - 1).toISOString() };
    assertStopWait(fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, [reversedTime, ...complete().slice(1)], context, identityRegistry), "INVALID_TIMESTAMP");
  });

  it("rejects direct, nested, prototype and constructor-shaped injection", () => {
    const base: HilReplayFrame = { observations: complete() };
    const frames: HilReplayFrame[] = [
      { ...base, proposedInputs: { pedestrianDemand: true } },
      { ...base, metadata: { proposedInputs: { pedestrianDemand: true } } } as unknown as HilReplayFrame,
      Object.assign(Object.create({ proposedInputs: { pedestrianDemand: true } }), base) as HilReplayFrame,
      { ...base, constructor: { proposedInputs: true } } as unknown as HilReplayFrame,
    ];
    for (const frame of frames) { const result = runIsolatedHilReplay(hilConfig, evidence, [frame], identityRegistry, now).frames[0]; expect(result.validationCode).toBe("PROPOSED_INPUTS_INJECTION"); expect(result.decision.selectedResponse.vehicle).toEqual({ eastbound: "STOP", westbound: "STOP" }); expect(result.decision.selectedResponse.pedestrian).toBe("WAIT"); }
  });

  it("rejects forged alternate shadow entry and adapter identity bypass", async () => {
    const forged = { accepted: true, inputs: { mode: "NORMAL", pedestrianDemand: true }, reasonCode: "FUSED", reason: "forged", trace: { orderingRule: "observedAt,receivedAt,deviceKindPriority,sourceId,sequence,canonicalPayload", mode: "NORMAL", sources: [], auditEvents: [] } } as unknown as ObservationFusionResult;
    expect(() => evaluateShadowDecision(DEFAULT_LIVE_INTEGRATION_CONFIG, forged)).toThrow(/Untrusted SafetyInputs/);
    const adapter = new MockAdapter("RADAR-OTHER", "VEHICLE_RADAR", complete()[4]); await adapter.connect(); await expect(adapter.read(context)).rejects.toThrow(/identity/);
  });

  it("fails a partial valid plus malformed set, then accepts valid input after rejection", () => {
    const guard = new ObservationGuard();
    const malformed = obs("PEDESTRIAN_SENSOR", "PED-01", { demand: "yes", crossingOccupied: false });
    assertStopWait(fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, [malformed, ...complete().slice(1)], context, identityRegistry, guard), "MALFORMED_PAYLOAD");
    const valid = fuseValidatedObservations(DEFAULT_LIVE_INTEGRATION_CONFIG, complete(), context, identityRegistry, guard);
    expect(valid.accepted).toBe(true); expect(evaluateShadowDecision(DEFAULT_LIVE_INTEGRATION_CONFIG, valid, undefined, now).selectedResponse.pedestrian).toBe("WALK");
  });
});
