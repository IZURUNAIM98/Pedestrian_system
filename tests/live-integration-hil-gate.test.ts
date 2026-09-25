import { describe, expect, it } from "vitest";
import { DEFAULT_LIVE_INTEGRATION_CONFIG, liveIntegrationConfigSchema } from "@/lib/live-integration/config";
import { assessHilReadiness, HIL_ENTRY_CHECKS, type HilEntryEvidence } from "@/lib/live-integration/hil-gate";

const completeEvidence: HilEntryEvidence[] = HIL_ENTRY_CHECKS.map((check) => ({
  check,
  satisfied: true,
  evidenceReference: `controlled-record/${check.toLowerCase()}`,
  approvedBy: "authorised-role",
}));

describe("WBS-SC-LIVE-002 isolated HIL entry gate", () => {
  it("fails closed while mandatory evidence is absent", () => {
    const config = liveIntegrationConfigSchema.parse({
      ...DEFAULT_LIVE_INTEGRATION_CONFIG,
      operatingMode: "HARDWARE_IN_LOOP",
    });
    const result = assessHilReadiness(config, []);
    expect(result.status).toBe("BLOCKED");
    expect(result.missing).toEqual(HIL_ENTRY_CHECKS);
    expect(result.actuationPermitted).toBe(false);
  });

  it("rejects readiness when the operating mode is not HARDWARE_IN_LOOP", () => {
    const result = assessHilReadiness(DEFAULT_LIVE_INTEGRATION_CONFIG, completeEvidence);
    expect(result.status).toBe("BLOCKED");
    expect(result.reasons).toContain("Configuration must explicitly select HARDWARE_IN_LOOP.");
  });

  it("allows only isolated non-actuating HIL readiness after every approval is evidenced", () => {
    const config = liveIntegrationConfigSchema.parse({
      ...DEFAULT_LIVE_INTEGRATION_CONFIG,
      operatingMode: "HARDWARE_IN_LOOP",
    });
    const result = assessHilReadiness(config, completeEvidence);
    expect(result.status).toBe("READY_FOR_ISOLATED_HIL");
    expect(result.missing).toHaveLength(0);
    expect(result.actuationPermitted).toBe(false);
  });

  it("treats an unapproved or unreferenced checklist item as missing", () => {
    const config = liveIntegrationConfigSchema.parse({
      ...DEFAULT_LIVE_INTEGRATION_CONFIG,
      operatingMode: "HARDWARE_IN_LOOP",
    });
    const incomplete = completeEvidence.map((item) =>
      item.check === "VENDOR_PROTOCOL_PACKAGE" ? { ...item, evidenceReference: "" } : item,
    );
    const result = assessHilReadiness(config, incomplete);
    expect(result.status).toBe("BLOCKED");
    expect(result.missing).toContain("VENDOR_PROTOCOL_PACKAGE");
  });
});
