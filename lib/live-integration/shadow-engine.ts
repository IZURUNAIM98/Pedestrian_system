import { createHash } from "node:crypto";
import { resolveSafetyDecision, type SafetyDecision, type SafetyInputs } from "@/lib/safety-orchestrator";
import { canIssuePhysicalSignalCommand, type LiveIntegrationConfig } from "@/lib/live-integration/config";
import { isTrustedObservationFusionResult, type ObservationFusionResult, type ObservationFusionTrace } from "@/lib/live-integration/observation-fusion";

export interface ShadowDecisionRecord {
  eventId: string; correlationId: string; timestamp: string; timeSource: "SYSTEM_UTC"; operatingMode: LiveIntegrationConfig["operatingMode"];
  configVersion: string; softwareVersion: string; inputs: SafetyInputs; applicableRule: string; selectedResponse: SafetyDecision;
  inputTrace?: ObservationFusionTrace;
  rejectedAlternatives: string[]; actualControllerState?: unknown; comparison: "MATCH" | "DIFFERENT" | "NOT_AVAILABLE"; actuationAttempted: false;
  previousRecordHash: string | null; recordHash: string;
}

function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`; return JSON.stringify(value); }

function evaluate(config: LiveIntegrationConfig, inputs: SafetyInputs, actualControllerState: unknown, now: Date, previousRecordHash: string | null, inputTrace?: ObservationFusionTrace): ShadowDecisionRecord {
  if (canIssuePhysicalSignalCommand(config)) throw new Error("Shadow evaluator refuses configurations capable of physical actuation.");
  const selectedResponse = resolveSafetyDecision(inputs);
  const digest = createHash("sha256").update(stable({ configVersion: config.version, inputs })).digest("hex").slice(0, 16);
  const expected = { vehicle: selectedResponse.vehicle, pedestrian: selectedResponse.pedestrian };
  const recordWithoutHash = {
    eventId: `SC-EVT-${now.getTime()}`, correlationId: `SC-${digest}`, timestamp: now.toISOString(), timeSource: "SYSTEM_UTC" as const,
    operatingMode: config.operatingMode, configVersion: config.version, softwareVersion: process.env.npm_package_version ?? "unknown",
    inputs, inputTrace, applicableRule: selectedResponse.state, selectedResponse, rejectedAlternatives: selectedResponse.rejectedCommands,
    actualControllerState, comparison: actualControllerState === undefined ? "NOT_AVAILABLE" as const : stable(actualControllerState) === stable(expected) ? "MATCH" as const : "DIFFERENT" as const, actuationAttempted: false as const, previousRecordHash,
  };
  return { ...recordWithoutHash, recordHash: createHash("sha256").update(stable(recordWithoutHash)).digest("hex") };
}

/** HIL/runtime boundary: accepts only an object issued by the validated observation-fusion module. */
export function evaluateShadowDecision(config: LiveIntegrationConfig, fusion: ObservationFusionResult, actualControllerState?: unknown, now = new Date(), previousRecordHash: string | null = null): ShadowDecisionRecord {
  if (!isTrustedObservationFusionResult(fusion)) throw new Error("Untrusted SafetyInputs rejected: use validated observation fusion.");
  return evaluate(config, fusion.inputs, actualControllerState, now, previousRecordHash, fusion.trace);
}

/** Test-only helper for unit-testing the deterministic resolver record outside production/HIL input paths. */
export function evaluateTestOnlyShadowDecision(config: LiveIntegrationConfig, inputs: SafetyInputs, actualControllerState?: unknown, now = new Date(), previousRecordHash: string | null = null): ShadowDecisionRecord {
  return evaluate(config, inputs, actualControllerState, now, previousRecordHash);
}

export function verifyShadowDecisionRecord(record: ShadowDecisionRecord): boolean {
  const { recordHash, ...content } = record;
  return createHash("sha256").update(stable(content)).digest("hex") === recordHash;
}
