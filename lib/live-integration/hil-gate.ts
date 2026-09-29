import type { LiveIntegrationConfig } from "./config";

export const HIL_ENTRY_CHECKS = [
  "OWNER_CLASSIFICATION",
  "AUTHORITY_SAFETY_APPROVAL",
  "VENDOR_PROTOCOL_PACKAGE",
  "ISOLATED_BENCH",
  "CYBERSECURITY_CONTROLS",
  "PRIVACY_APPROVAL",
  "DURABLE_AUDIT_STORE",
  "ROLLBACK_PLAN",
] as const;

export type HilEntryCheck = (typeof HIL_ENTRY_CHECKS)[number];

export interface HilEntryEvidence {
  check: HilEntryCheck;
  satisfied: boolean;
  evidenceReference?: string;
  approvedBy?: string;
}

export interface HilReadinessAssessment {
  status: "READY_FOR_ISOLATED_HIL" | "BLOCKED";
  missing: HilEntryCheck[];
  reasons: string[];
  actuationPermitted: false;
}

export function assessHilReadiness(
  config: LiveIntegrationConfig,
  evidence: readonly HilEntryEvidence[],
): HilReadinessAssessment {
  const reasons: string[] = [];
  const evidenceByCheck = new Map(evidence.map((item) => [item.check, item]));
  const missing = HIL_ENTRY_CHECKS.filter((check) => {
    const item = evidenceByCheck.get(check);
    return !item?.satisfied || !item.evidenceReference?.trim() || !item.approvedBy?.trim();
  });

  if (config.operatingMode !== "HARDWARE_IN_LOOP") {
    reasons.push("Configuration must explicitly select HARDWARE_IN_LOOP.");
  }
  if (config.liveActuation.enabled) {
    reasons.push("Physical actuation must remain disabled for isolated HIL.");
  }
  if (missing.length > 0) {
    reasons.push(`Missing approved evidence: ${missing.join(", ")}.`);
  }

  return {
    status: reasons.length === 0 ? "READY_FOR_ISOLATED_HIL" : "BLOCKED",
    missing,
    reasons,
    actuationPermitted: false,
  };
}
