import type { EventLogEntry, OperatingConditions } from "@/lib/types";

export const CAMERA_DEGRADATION_THRESHOLD = 0.75;
export const DEGRADED_PROTECTED_WALK_SECONDS = 15;

export type FallbackRequestState = "idle" | "latched" | "safety-hold" | "complete";

export interface SecondarySafetyInputs {
  radarClear: boolean;
  lidarClear: boolean;
  stopLinesClear: boolean;
  vehiclePresenceClear: boolean;
  controllerAvailable: boolean;
}

export interface CameraFallbackAssessment {
  active: boolean;
  requestState: FallbackRequestState;
  protectedCrossingVerified: boolean;
  message: string;
}

export const DEFAULT_SECONDARY_SAFETY_INPUTS: SecondarySafetyInputs = Object.freeze({
  radarClear: true,
  lidarClear: true,
  stopLinesClear: true,
  vehiclePresenceClear: true,
  controllerAvailable: true,
});

export function isCameraDegraded(conditions: OperatingConditions): boolean {
  return conditions.sensorHealth === "degraded" || conditions.conditionQuality < CAMERA_DEGRADATION_THRESHOLD;
}

export function assessCameraFallback(
  conditions: OperatingConditions,
  requested: boolean,
  inputs: SecondarySafetyInputs = DEFAULT_SECONDARY_SAFETY_INPUTS,
): CameraFallbackAssessment {
  if (!isCameraDegraded(conditions)) return { active: false, requestState: "idle", protectedCrossingVerified: false, message: "Camera-driven SmartCross operation available." };
  if (!requested) return { active: true, requestState: "idle", protectedCrossingVerified: false, message: "CAMERA DEGRADED - PRESS BUTTON TO REQUEST CROSSING" };
  const protectedCrossingVerified = Object.values(inputs).every(Boolean);
  return protectedCrossingVerified
    ? { active: true, requestState: "latched", protectedCrossingVerified: true, message: "CROSSING REQUEST REGISTERED - PLEASE WAIT" }
    : { active: true, requestState: "safety-hold", protectedCrossingVerified: false, message: "SAFETY HOLD - REQUEST REGISTERED; WALK UNAVAILABLE" };
}

export function cameraFallbackEventLog(baseTime: Date, cameraHealth: number, assessment: CameraFallbackAssessment, duplicatePresses: number): EventLogEntry[] {
  const seconds = [0, 1, 2, 3, 4, 19, 20];
  const protectedResult = assessment.protectedCrossingVerified;
  const details = [
    `Approach: Camera health is ${Math.round(cameraHealth * 100)} percent; the pedestrian remains on WAIT.`,
    `Initiation: Manual pedestrian request latched at ${baseTime.toISOString()}; ${duplicatePresses} duplicate press${duplicatePresses === 1 ? "" : "es"} ignored.`,
    "Detected: Degraded fallback demand confirmed; camera-only detection is not used to authorise WALK.",
    "Escalation: Camera-Degradation Mode active; vehicle traffic transitions from GREEN through YELLOW to RED.",
    protectedResult
      ? "Conflict: Simulated radar, LiDAR, stop-line, vehicle-presence and controller checks agree that the protected route can be established."
      : "Conflict: Secondary safety inputs disagree or a critical controller input is unavailable.",
    protectedResult
      ? `Response: RED and minimum all-red clearance verified before WALK; conservative ${DEGRADED_PROTECTED_WALK_SECONDS}-second pedestrian interval issued.`
      : "Response: Safety Hold remains active; the pedestrian button cannot bypass the safety controller and WALK is unavailable.",
    protectedResult
      ? "Outcome: Pedestrian clearance completed, DON'T WALK restored, traffic returned to GREEN, request latch cleared, and degraded mode remains active until camera recovery."
      : "Outcome: Request remains acknowledged in Safety Hold for authorised review; no WALK or traffic release was issued.",
  ];
  const categories: EventLogEntry["category"][] = ["sensor", "sensor", "detection", "controller", "safety", "safety", "outcome"];
  return details.map((message, index) => ({ id: `camera-fallback-${index}`, timestamp: new Date(baseTime.getTime() + seconds[index] * 1_000).toISOString(), category: categories[index], message }));
}
