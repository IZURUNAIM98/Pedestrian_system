import { z } from "zod";

export const OPERATING_MODES = ["SIMULATION", "HARDWARE_IN_LOOP", "SHADOW", "SUPERVISED", "LIVE_RESTRICTED"] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

export const liveIntegrationConfigSchema = z.object({
  version: z.string().min(1),
  siteId: z.string().min(1),
  crossingType: z.enum(["NORMAL", "SCHOOL"]),
  operatingMode: z.enum(OPERATING_MODES).default("SIMULATION"),
  detectionZonesMeters: z.object({ eastbound: z.number().min(5).max(200), westbound: z.number().min(5).max(200) }),
  speedThresholdKmh: z.number().positive().max(120),
  queueThresholdVehicles: z.number().int().positive().max(100),
  phaseSeconds: z.object({ minimumGreen: z.number().int().min(3), maximumGreen: z.number().int().max(120), pedestrianClearance: z.number().int().min(5), maximumPedestrianWait: z.number().int().min(10) }),
  emergencyConfidenceThreshold: z.number().min(0.5).max(1),
  minimumDecisionConfidence: z.number().min(0.5).max(1),
  staleDataTimeoutMs: z.number().int().min(250).max(60_000),
  retentionDays: z.number().int().min(1).max(365),
  liveActuation: z.object({ enabled: z.boolean().default(false), deploymentGate: z.string().optional(), approvalId: z.string().optional() }),
}).superRefine((config, context) => {
  if (config.phaseSeconds.minimumGreen > config.phaseSeconds.maximumGreen) context.addIssue({ code: "custom", path: ["phaseSeconds"], message: "Minimum green must not exceed maximum green." });
  if (config.operatingMode === "LIVE_RESTRICTED" && (!config.liveActuation.enabled || !config.liveActuation.deploymentGate || !config.liveActuation.approvalId)) context.addIssue({ code: "custom", path: ["liveActuation"], message: "LIVE_RESTRICTED requires enabled actuation, a deployment safety gate and an approval ID." });
  if (config.operatingMode !== "LIVE_RESTRICTED" && config.liveActuation.enabled) context.addIssue({ code: "custom", path: ["liveActuation", "enabled"], message: "Actuation must remain disabled outside LIVE_RESTRICTED." });
});

export type LiveIntegrationConfig = z.infer<typeof liveIntegrationConfigSchema>;
export const DEFAULT_LIVE_INTEGRATION_CONFIG: LiveIntegrationConfig = liveIntegrationConfigSchema.parse({
  version: "WBS-SC-LIVE-001.1", siteId: "MPAJ-SMARTCROSS-UNCONFIRMED", crossingType: "NORMAL", operatingMode: "SIMULATION",
  detectionZonesMeters: { eastbound: 40, westbound: 40 }, speedThresholdKmh: 40, queueThresholdVehicles: 6,
  phaseSeconds: { minimumGreen: 8, maximumGreen: 20, pedestrianClearance: 15, maximumPedestrianWait: 40 },
  emergencyConfidenceThreshold: 0.9, minimumDecisionConfidence: 0.75, staleDataTimeoutMs: 2_000, retentionDays: 30,
  liveActuation: { enabled: false },
});

export function canIssuePhysicalSignalCommand(config: LiveIntegrationConfig): boolean {
  const checked = liveIntegrationConfigSchema.parse(config);
  return checked.operatingMode === "LIVE_RESTRICTED" && checked.liveActuation.enabled === true;
}
