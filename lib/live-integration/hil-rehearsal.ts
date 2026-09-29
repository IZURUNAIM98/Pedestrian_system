import { AdapterIdentityRegistry, ObservationGuard, type FieldObservation } from "./adapters";
import type { LiveIntegrationConfig } from "./config";
import { assessHilReadiness, type HilEntryEvidence, type HilReadinessAssessment } from "./hil-gate";
import { canonicalObservationOrder, createFailClosedFusionResult, fuseValidatedObservations, type FusionAuditEvent, type ObservationFusionTrace } from "./observation-fusion";
import { evaluateShadowDecision, verifyShadowDecisionRecord, type ShadowDecisionRecord } from "./shadow-engine";

export interface HilReplayFrame {
  observations: readonly FieldObservation<unknown>[];
  /** @deprecated Test-fixture injection sentinel. Any supplied value is rejected and never reaches the decision path. */
  proposedInputs?: unknown;
  actualControllerState?: unknown;
}

function containsInjectionKey(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return true;
  for (const [key, item] of Object.entries(value)) {
    if (["proposedinputs", "__proto__", "prototype", "constructor"].includes(key.toLowerCase())) return true;
    if (containsInjectionKey(item, seen)) return true;
  }
  return false;
}

export interface HilReplayFrameResult {
  sourceIds: string[];
  sequences: number[];
  observationAccepted: boolean;
  validationCode: string;
  validationReason: string;
  fusionTrace: ObservationFusionTrace;
  auditEvents: FusionAuditEvent[];
  decision: ShadowDecisionRecord;
}

export interface HilReplayResult {
  readiness: HilReadinessAssessment;
  status: "COMPLETED_NON_ACTUATING" | "BLOCKED";
  frames: HilReplayFrameResult[];
  auditChainValid: boolean;
  actuationAttempted: false;
}

export function runIsolatedHilReplay(
  config: LiveIntegrationConfig,
  evidence: readonly HilEntryEvidence[],
  frames: readonly HilReplayFrame[],
  identityRegistry: AdapterIdentityRegistry,
  now = new Date(),
): HilReplayResult {
  const readiness = assessHilReadiness(config, evidence);
  if (readiness.status === "BLOCKED") {
    return { readiness, status: "BLOCKED", frames: [], auditChainValid: true, actuationAttempted: false };
  }

  const guard = new ObservationGuard();
  const results: HilReplayFrameResult[] = [];
  let previousRecordHash: string | null = null;

  frames.forEach((frame, index) => {
    const frameNow = new Date(now.getTime() + index);
    const injectionAttempted = containsInjectionKey(frame);
    const fusion = injectionAttempted
      ? createFailClosedFusionResult(config.crossingType, "PROPOSED_INPUTS_INJECTION", "Independent proposedInputs or prototype-shaped properties are rejected from the HIL decision path.")
      : fuseValidatedObservations(config, frame.observations, {
      now: frameNow,
      staleAfterMs: config.staleDataTimeoutMs,
    }, identityRegistry, guard);
    const decision = evaluateShadowDecision(
      config,
      fusion,
      frame.actualControllerState,
      frameNow,
      previousRecordHash,
    );
    previousRecordHash = decision.recordHash;
    const canonicalObservations = [...frame.observations].sort(canonicalObservationOrder);
    results.push({
      sourceIds: canonicalObservations.map((item) => item.sourceId),
      sequences: canonicalObservations.map((item) => item.sequence),
      observationAccepted: fusion.accepted,
      validationCode: fusion.reasonCode,
      validationReason: fusion.reason,
      fusionTrace: fusion.trace,
      auditEvents: fusion.trace.auditEvents,
      decision,
    });
  });

  const auditChainValid = results.every((result, index) =>
    verifyShadowDecisionRecord(result.decision)
    && result.decision.previousRecordHash === (index === 0 ? null : results[index - 1].decision.recordHash),
  );

  return {
    readiness,
    status: "COMPLETED_NON_ACTUATING",
    frames: results,
    auditChainValid,
    actuationAttempted: false,
  };
}
