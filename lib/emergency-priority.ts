import type { EmergencyDirection, EmergencyPriorityFrame, EmergencyPriorityRecord, EmergencyVehicleType, EventLogEntry, PedestrianState, SignalState } from "@/lib/types";

export const CCTV_DETECTION_RANGE_METERS = 40;

export const EMERGENCY_PRIORITY_SEQUENCE = [
  "NORMAL", "EMERGENCY_DETECTED", "VALIDATING", "DETERMINE_APPROACH", "CALCULATE_OCCUPANCY",
  "PEDESTRIAN_CLEARANCE", "STOP_NEW_ENTRY", "TRAFFIC_CLEARANCE", "EMERGENCY_PRIORITY",
  "EMERGENCY_PASSING", "CONFIRM_CROSSING_CLEAR", "RECOVERY", "NORMAL",
] as const;

export type EmergencyPriorityOptions = {
  vehicleType?: EmergencyVehicleType;
  direction?: EmergencyDirection;
  pedestrianAlreadyCrossing?: boolean;
  crossingBlocked?: boolean;
  validationStatus?: EmergencyPriorityRecord["validationStatus"];
};

const labels: Record<EmergencyPriorityFrame["state"], string> = {
  NORMAL: "Normal operation",
  EMERGENCY_DETECTED: "Emergency vehicle detected by CCTV + radar",
  VALIDATING: "Emergency priority validation in progress",
  DETERMINE_APPROACH: "Approach direction determined",
  CALCULATE_OCCUPANCY: "Crossing occupancy calculated",
  PEDESTRIAN_CLEARANCE: "Existing pedestrians protected until safe area",
  STOP_NEW_ENTRY: "New pedestrian entry stopped",
  TRAFFIC_CLEARANCE: "Conflicting traffic held at stop line",
  EMERGENCY_PRIORITY: "Emergency route established",
  EMERGENCY_PASSING: "Emergency vehicle passing crossing",
  CONFIRM_CROSSING_CLEAR: "Crossing clear confirmed",
  RECOVERY: "Controlled recovery to normal operation",
};

const eventDetails: Record<EmergencyPriorityFrame["state"], string> = {
  NORMAL: "Normal operation restored",
  EMERGENCY_DETECTED: "Emergency detected",
  VALIDATING: "Source/validation check",
  DETERMINE_APPROACH: "Approach direction determined",
  CALCULATE_OCCUPANCY: "Crossing occupancy calculated",
  PEDESTRIAN_CLEARANCE: "Pedestrian clearance protected",
  STOP_NEW_ENTRY: "New pedestrian entry stopped",
  TRAFFIC_CLEARANCE: "Conflicting traffic clearance",
  EMERGENCY_PRIORITY: "Emergency priority activated",
  EMERGENCY_PASSING: "Emergency vehicle passing",
  CONFIRM_CROSSING_CLEAR: "Crossing clear confirmed",
  RECOVERY: "Controlled recovery started",
};

export function createEmergencyPriorityRecord(options: EmergencyPriorityOptions = {}, baseTime = new Date()): EmergencyPriorityRecord {
  const vehicleType = options.vehicleType ?? "ambulance";
  const direction = options.direction ?? "Eastbound";
  const validationStatus = options.validationStatus ?? "validated";
  const valid = validationStatus === "validated" && !options.crossingBlocked;
  const eastbound = direction === "Eastbound";
  const start = eastbound ? 8 : 92;
  const end = eastbound ? 92 : 8;
  const pedestrianAlreadyCrossing = options.pedestrianAlreadyCrossing === true;
  const states = [...EMERGENCY_PRIORITY_SEQUENCE];
  const eventLog: EventLogEntry[] = states.map((state, index) => ({
    id: `EMG-${baseTime.getTime()}-${String(index + 1).padStart(2, "0")}`,
    timestamp: new Date(baseTime.getTime() + index * 1000).toISOString(),
    category: index < 3 ? "detection" : index < 9 ? "controller" : "safety",
    message: `${eventDetails[state]} - Vehicle Type: ${vehicleType}; Direction: ${direction}; Detection Source/Validation: CCTV + radar / ${validationStatus}; Detection Distance: ${CCTV_DETECTION_RANGE_METERS} m; Speed: 55 km/h; CCTV Detection Range: ${CCTV_DETECTION_RANGE_METERS} m.`,
  }));
  const frames: EmergencyPriorityFrame[] = states.map((state, index) => {
    const progress = index / (states.length - 1);
    const routeProgress = valid ? progress : Math.min(progress, 0.22);
    const emergencyX = start + (end - start) * routeProgress;
    // The responder keeps its approach lane: EB uses the lower lane (68%) and
    // WB uses the upper lane (32%). The opposite ordinary vehicle yields at
    // its own stop line (EB traffic: x=66, WB traffic: x=34).
    const conflictVehicleX = eastbound ? (index >= 7 ? 66 : 58) : (index >= 7 ? 34 : 42);
    const pedestrianProgress = pedestrianAlreadyCrossing ? Math.min(100, 45 + Math.max(0, index - 4) * 18) : 0;
    const crossingStatus: EmergencyPriorityFrame["crossingStatus"] =
      state === "EMERGENCY_PASSING" ? "emergency-passing" : pedestrianAlreadyCrossing && pedestrianProgress < 100 ? "occupied" : state === "NORMAL" || state === "RECOVERY" ? "clear" : "protected";
    const pedestrianSignal: PedestrianState = pedestrianAlreadyCrossing && pedestrianProgress < 100 ? "WALK" : "WAIT";
    const pedestrianClear = !pedestrianAlreadyCrossing || pedestrianProgress >= 100;
    const routeActive = valid && pedestrianClear && (state === "EMERGENCY_PRIORITY" || state === "EMERGENCY_PASSING");
    const vehicleSignal: SignalState = state === "NORMAL" || routeActive ? "GO" : "STOP";
    return {
      index, state, emergencyX, conflictVehicleX, pedestrianProgress, pedestrianSignal, vehicleSignal,
      conflictingVehicleSignal: state === "NORMAL" ? "GO" : "STOP",
      crossingStatus,
      action: validationStatus !== "validated" ? "Validation failed or sensor disagreement: all-red safety hold; no emergency priority granted." : options.crossingBlocked ? "Crossing blocked: maintain all-red safety hold until the route is verified clear." : `${labels[state]}. ${pedestrianAlreadyCrossing ? "Do not interrupt pedestrians already in the crossing." : "Do not admit new pedestrians after priority confirmation."}`,
    };
  });
  return {
    vehicleType, direction, detectionSource: "CCTV + radar", confidence: validationStatus === "validated" ? 0.96 : 0.52,
    validationStatus, detectionDistanceMeters: CCTV_DETECTION_RANGE_METERS, speedKmh: 55,
    priorityStatus: valid ? "active" : "safe-hold", cctvDetectionRangeMeters: CCTV_DETECTION_RANGE_METERS, frames, eventLog,
  };
}
