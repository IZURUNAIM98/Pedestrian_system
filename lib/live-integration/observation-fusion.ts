import type { SafetyInputs, SafetyMode } from "@/lib/safety-orchestrator";
import { AdapterIdentityRegistry, DEVICE_KINDS, ObservationGuard, type AdapterContext, type DeviceKind, type FieldObservation, type ObservationRejectionCode } from "./adapters";
import type { LiveIntegrationConfig } from "./config";

export type FusionRejectionCode = ObservationRejectionCode | "MISSING_REQUIRED_OBSERVATION" | "CROSS_SOURCE_DISAGREEMENT" | "IMPOSSIBLE_COMBINATION" | "PROPOSED_INPUTS_INJECTION";
export interface FusionAuditEvent { code: FusionRejectionCode; accepted: boolean; schemaVersion?: string; deviceId?: string; sourceId: string; kind: string; observedAt?: string; receivedAt?: string; sequence?: number; validationResult: "ACCEPTED" | "REJECTED"; rejectionReason?: string; derivationRule: string; resultingFields: string[]; detail: string; configuredIdentity?: unknown; claimedIdentity?: unknown; identityRecordHash?: string; }
export interface ObservationDerivationTrace { schemaVersion: string; sourceId: string; kind: DeviceKind; observedAt: string; receivedAt: string; sequence: number; validationResult: "ACCEPTED"; derivationRule: string; resultingFields: string[]; }
export interface ObservationFusionTrace { orderingRule: "observedAt,receivedAt,deviceKindPriority,sourceId,sequence,canonicalPayload"; mode: SafetyMode; sources: ObservationDerivationTrace[]; auditEvents: FusionAuditEvent[]; }
export interface ObservationFusionResult { accepted: boolean; inputs: SafetyInputs; reasonCode: "FUSED" | FusionRejectionCode; reason: string; trace: ObservationFusionTrace; }

const trustedResults = new WeakSet<ObservationFusionResult>();
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`; return JSON.stringify(value); }
function compareText(left: string | undefined, right: string | undefined): number { return (left ?? "").localeCompare(right ?? ""); }
export function canonicalObservationOrder(left: FieldObservation<unknown>, right: FieldObservation<unknown>): number {
  return compareText(left.observedAt, right.observedAt) || compareText(left.receivedAt, right.receivedAt) || DEVICE_KINDS.indexOf(left.kind) - DEVICE_KINDS.indexOf(right.kind) || compareText(left.sourceId, right.sourceId) || left.sequence - right.sequence || stable(left.value).localeCompare(stable(right.value));
}
export function isTrustedObservationFusionResult(value: ObservationFusionResult): boolean { return trustedResults.has(value); }
function finish(result: ObservationFusionResult): ObservationFusionResult { trustedResults.add(result); return result; }
function trace(mode: SafetyMode, sources: ObservationDerivationTrace[], auditEvents: FusionAuditEvent[]): ObservationFusionTrace { return { orderingRule: "observedAt,receivedAt,deviceKindPriority,sourceId,sequence,canonicalPayload", mode, sources, auditEvents }; }
function syntheticEvent(code: FusionRejectionCode, detail: string, kind = "FUSION"): FusionAuditEvent { return { code, accepted: false, sourceId: "FUSION", kind, validationResult: "REJECTED", rejectionReason: detail, derivationRule: "FAIL_CLOSED", resultingFields: ["sensorState", "clearanceVerified"], detail }; }
export function createFailClosedFusionResult(mode: SafetyMode, code: FusionRejectionCode, reason: string, auditEvents: FusionAuditEvent[] = [syntheticEvent(code, reason)]): ObservationFusionResult {
  return finish({ accepted: false, inputs: { mode, sensorState: "failed", clearanceVerified: false }, reasonCode: code, reason, trace: trace(mode, [], auditEvents) });
}

export function fuseValidatedObservations(config: LiveIntegrationConfig, observations: readonly FieldObservation<unknown>[], context: AdapterContext, identityRegistry: AdapterIdentityRegistry, guard = new ObservationGuard()): ObservationFusionResult {
  const mode = config.crossingType;
  const events: FusionAuditEvent[] = [];
  const sources: ObservationDerivationTrace[] = [];
  if (observations.length === 0) return createFailClosedFusionResult(mode, "MISSING_REQUIRED_OBSERVATION", "No observations were supplied.");
  for (const observation of observations) {
    const rejection = identityRegistry.rejectionFor(observation);
    if (rejection) return createFailClosedFusionResult(mode, "SOURCE_IDENTITY_MISMATCH", rejection.reason, [{ code: "SOURCE_IDENTITY_MISMATCH", accepted: false, schemaVersion: rejection.claimedIdentity.schemaVersion as string | undefined, deviceId: rejection.claimedIdentity.deviceId as string | undefined, sourceId: typeof rejection.claimedIdentity.sourceId === "string" ? rejection.claimedIdentity.sourceId : "UNKNOWN", kind: typeof rejection.claimedIdentity.kind === "string" ? rejection.claimedIdentity.kind : "UNKNOWN", validationResult: "REJECTED", rejectionReason: rejection.reason, derivationRule: "ADAPTER_IDENTITY_BEFORE_FUSION", resultingFields: ["sensorState", "clearanceVerified"], detail: rejection.reason, configuredIdentity: rejection.configuredIdentity, claimedIdentity: rejection.claimedIdentity, identityRecordHash: rejection.recordHash }]);
  }
  const canonical = [...observations].sort(canonicalObservationOrder);
  const validations = guard.acceptBatch(canonical, context);
  const accepted = new Map<DeviceKind, FieldObservation<unknown>[]>();
  for (let index = 0; index < validations.length; index++) {
    const observation = canonical[index];
    const validation = validations[index];
    const fields = DEVICE_KINDS.includes(observation?.kind) ? derivedFields(observation.kind) : [];
    events.push({ code: validation.code, accepted: validation.valid, schemaVersion: observation?.schemaVersion, deviceId: observation?.deviceId, sourceId: observation?.sourceId ?? "UNKNOWN", kind: observation?.kind ?? "UNKNOWN", observedAt: observation?.observedAt, receivedAt: observation?.receivedAt, sequence: observation?.sequence, validationResult: validation.valid ? "ACCEPTED" : "REJECTED", rejectionReason: validation.valid ? undefined : validation.reason, derivationRule: validation.valid ? "VALIDATE_THEN_FUSE" : "FAIL_CLOSED", resultingFields: validation.valid ? fields : ["sensorState", "clearanceVerified"], detail: validation.reason });
    if (!validation.valid) return finish({ accepted: false, inputs: { mode, sensorState: "failed", clearanceVerified: false }, reasonCode: validation.code, reason: validation.reason, trace: trace(mode, sources, events) });
    const list = accepted.get(observation.kind) ?? []; list.push(observation); accepted.set(observation.kind, list);
  }
  const required = ["PEDESTRIAN_SENSOR", "CROSSING_OCCUPANCY", "SIGNAL_CONTROLLER"] as const;
  const missing = required.filter((kind) => !accepted.has(kind));
  if (missing.length) return fail(mode, "MISSING_REQUIRED_OBSERVATION", `Missing required observations: ${missing.join(", ")}.`, events, sources);
  for (const kind of required) {
    const claims = accepted.get(kind)!;
    if (claims.length > 1 && new Set(claims.map((item) => stable(item.value))).size > 1) return fail(mode, "CROSS_SOURCE_DISAGREEMENT", `Cross-source ${kind} payloads disagree.`, events, sources, kind);
  }
  const one = <T>(kind: DeviceKind): T => accepted.get(kind)![0].value as T;
  const pedestrian = one<{ demand: boolean; crossingOccupied: boolean }>("PEDESTRIAN_SENSOR");
  const crossing = one<{ occupied: boolean; clearanceVerified: boolean }>("CROSSING_OCCUPANCY");
  const controller = one<{ eastbound: "GO" | "AMBER" | "STOP"; westbound: "GO" | "AMBER" | "STOP"; pedestrian: "WAIT" | "WALK" }>("SIGNAL_CONTROLLER");
  const occupancyClaims = [pedestrian.crossingOccupied, crossing.occupied, ...(accepted.get("CCTV_EASTBOUND") ?? []).map((item) => (item.value as { crossingOccupied: boolean }).crossingOccupied), ...(accepted.get("CCTV_WESTBOUND") ?? []).map((item) => (item.value as { crossingOccupied: boolean }).crossingOccupied)];
  if (new Set(occupancyClaims).size > 1) return fail(mode, "CROSS_SOURCE_DISAGREEMENT", "Cross-source crossing-occupancy observations disagree.", events, sources);
  for (const radar of accepted.get("VEHICLE_RADAR") ?? []) {
    const radarValue = radar.value as { direction: "Eastbound" | "Westbound"; vehiclePresent: boolean };
    const cameraKind = radarValue.direction === "Eastbound" ? "CCTV_EASTBOUND" : "CCTV_WESTBOUND";
    for (const camera of accepted.get(cameraKind) ?? []) if ((camera.value as { vehiclePresent: boolean }).vehiclePresent !== radarValue.vehiclePresent) return fail(mode, "CROSS_SOURCE_DISAGREEMENT", `Camera and radar vehicle-presence observations disagree for ${radarValue.direction}.`, events, sources);
  }
  if (controller.pedestrian === "WALK" && (controller.eastbound !== "STOP" || controller.westbound !== "STOP")) return fail(mode, "IMPOSSIBLE_COMBINATION", "Controller payload reports pedestrian WALK with conflicting vehicle movement.", events, sources, "SIGNAL_CONTROLLER");
  const demandClaims = [pedestrian.demand];
  for (const item of accepted.get("PUSH_BUTTON") ?? []) demandClaims.push((item.value as { pressed: boolean; authenticated: boolean }).pressed && (item.value as { authenticated: boolean }).authenticated);
  for (const item of accepted.get("ACCESSIBILITY_DEVICE") ?? []) demandClaims.push((item.value as { requestActive: boolean; authenticated: boolean }).requestActive && (item.value as { authenticated: boolean }).authenticated);
  if (new Set(demandClaims).size > 1) return fail(mode, "CROSS_SOURCE_DISAGREEMENT", "Cross-source pedestrian-demand observations disagree.", events, sources);
  const all = [...accepted.values()].flat().sort(canonicalObservationOrder);
  const stopLineIntrusion = all.filter((item) => item.kind === "CCTV_EASTBOUND" || item.kind === "CCTV_WESTBOUND").some((item) => (item.value as { stopLineIntrusion: boolean }).stopLineIntrusion);
  const congestionActive = all.filter((item) => item.kind === "VEHICLE_RADAR").some((item) => (item.value as { queueVehicles: number }).queueVehicles >= config.queueThresholdVehicles);
  const emergencyRequests = all.filter((item) => item.kind === "EMERGENCY_DETECTION" && (item.value as { detected: boolean }).detected).map((item) => { const value = item.value as { direction: "Eastbound" | "Westbound"; authenticated: boolean; confidence: number }; return { direction: value.direction, authenticated: value.authenticated, confidence: value.confidence }; });
  const operator = accepted.get("OPERATOR_ALERT")?.[0]?.value as { safeHold: boolean; resumeRequested: boolean } | undefined;
  const confidence = Math.min(...all.map((item) => item.confidence));
  const inputs: SafetyInputs = { mode, immediateCollisionRisk: stopLineIntrusion, pedestrianInCrossing: crossing.occupied, clearanceVerified: crossing.clearanceVerified && !crossing.occupied && controller.eastbound === "STOP" && controller.westbound === "STOP", emergencyRequests, congestionActive, pedestrianDemand: demandClaims[0], sensorState: all.some((item) => item.health === "DEGRADED") || confidence < config.minimumDecisionConfidence ? "degraded" : "healthy", aiConfidence: confidence, stopLineIntrusion, operatorOverride: operator?.safeHold ? "safe-hold" : "none", recoveryRequested: operator?.resumeRequested ?? false };
  for (const item of all) sources.push({ schemaVersion: item.schemaVersion, sourceId: item.sourceId, kind: item.kind, observedAt: item.observedAt, receivedAt: item.receivedAt, sequence: item.sequence, validationResult: "ACCEPTED", derivationRule: "VALIDATE_THEN_FUSE", resultingFields: derivedFields(item.kind) });
  return finish({ accepted: true, inputs, reasonCode: "FUSED", reason: "Safety inputs derived deterministically from validated device payloads.", trace: trace(mode, sources, events) });
}

function fail(mode: SafetyMode, code: FusionRejectionCode, reason: string, events: FusionAuditEvent[], sources: ObservationDerivationTrace[], kind = "FUSION"): ObservationFusionResult { events.push(syntheticEvent(code, reason, kind)); return finish({ accepted: false, inputs: { mode, sensorState: "failed", clearanceVerified: false }, reasonCode: code, reason, trace: trace(mode, sources, events) }); }
function derivedFields(kind: DeviceKind): string[] { const fields: Record<DeviceKind, string[]> = { CCTV_EASTBOUND: ["stopLineIntrusion", "crossingOccupancy"], CCTV_WESTBOUND: ["stopLineIntrusion", "crossingOccupancy"], VEHICLE_RADAR: ["congestionActive"], PEDESTRIAN_SENSOR: ["pedestrianDemand", "crossingOccupancy"], CROSSING_OCCUPANCY: ["pedestrianInCrossing", "clearanceVerified"], EMERGENCY_DETECTION: ["emergencyRequests"], PUSH_BUTTON: ["pedestrianDemand"], SIGNAL_CONTROLLER: ["clearanceVerified", "conflictInvariant"], ACCESSIBILITY_DEVICE: ["pedestrianDemand"], EDGE_GATEWAY: ["sensorState"], OPERATOR_ALERT: ["operatorOverride", "recoveryRequested"], ANPR: [] }; return fields[kind]; }
