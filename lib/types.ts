export const TIMELINE_STAGES = ["Approach", "Initiation", "Detected", "Escalation", "Conflict", "Response", "Outcome"] as const;

export type TimelineStageName = (typeof TIMELINE_STAGES)[number];
export type CrossingMode = "normal" | "school";
export type ScenarioId = string;
export type Severity = "routine" | "low" | "medium" | "high" | "critical";
export type RoadUserType = "car" | "motorcycle" | "van" | "bus";
export type SignalState = "GO" | "AMBER" | "STOP";
export type PedestrianState = "WAIT" | "WALK";
export type ViolationCategory = "none" | "yield" | "speed" | "signal" | "obstruction" | "motorcycle" | "direction" | "driver-behaviour" | "vulnerable-user" | "collision" | "fire";
export type WeatherCondition = "dry" | "rain";
export type LightingCondition = "day" | "night";
export type VisibilityCondition = "clear" | "haze" | "dense-haze";
export type SensorHealth = "operational" | "constrained" | "degraded";
export type ConfidenceBand = "usable" | "limited" | "non-usable" | "failed";
export type EmergencyVehicleType = "ambulance" | "police" | "fire-rescue";
export type EmergencyDirection = "Eastbound" | "Westbound";
export type EmergencyPriorityState = "NORMAL" | "EMERGENCY_DETECTED" | "VALIDATING" | "DETERMINE_APPROACH" | "CALCULATE_OCCUPANCY" | "PEDESTRIAN_CLEARANCE" | "STOP_NEW_ENTRY" | "TRAFFIC_CLEARANCE" | "EMERGENCY_PRIORITY" | "EMERGENCY_PASSING" | "CONFIRM_CROSSING_CLEAR" | "RECOVERY";

export interface EmergencyPriorityFrame {
  index: number;
  state: EmergencyPriorityState;
  emergencyX: number;
  conflictVehicleX: number;
  pedestrianProgress: number;
    pedestrianSignal: PedestrianState;
    vehicleSignal: SignalState;
    conflictingVehicleSignal: SignalState;
  crossingStatus: "clear" | "occupied" | "protected" | "emergency-passing";
  action: string;
}

export interface EmergencyPriorityRecord {
  vehicleType: EmergencyVehicleType;
  direction: EmergencyDirection;
  detectionSource: "CCTV + radar";
  confidence: number;
  validationStatus: "validated" | "unvalidated" | "sensor-disagreement";
  detectionDistanceMeters: number;
  speedKmh: number;
  priorityStatus: "active" | "complete" | "safe-hold";
  cctvDetectionRangeMeters: number;
  frames: EmergencyPriorityFrame[];
  eventLog: EventLogEntry[];
}

export interface OperatingConditions {
  weather: WeatherCondition;
  lighting: LightingCondition;
  visibility: VisibilityCondition;
  sensorHealth: SensorHealth;
  conditionQuality: number;
}

export interface ConfidenceAssessment {
  band: ConfidenceBand;
  label: "USABLE" | "LIMITED CONFIDENCE" | "SYSTEM DEGRADED" | "SENSOR FAILURE";
  action: string;
  walkPermitted: boolean;
  conclusionPermitted: boolean;
  humanReviewRequired: boolean;
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  summary: string;
  supportedModes: CrossingMode[];
  detection: string;
  verification: string;
  systemResponse: string;
  finalOutcome: string;
  severity: Severity;
  confidence: number;
  vehicleCount: number;
  pedestrianCount: number;
  motorcycleCount: number;
  violation: boolean;
  violationCategory: ViolationCategory;
  severityRationale: string;
  roadUser: RoadUserType | "mixed";
}

export interface TimelineStage {
  name: TimelineStageName;
  timestamp: string;
  detail: string;
  status: "complete";
}

export interface SignalResponse {
  vehicle: SignalState;
  pedestrian: PedestrianState;
  action: string;
  reason: string;
}

export interface EventLogEntry {
  id: string;
  timestamp: string;
  category: "sensor" | "detection" | "controller" | "safety" | "outcome";
  message: string;
}

export interface CctvEvidence {
  cameraId: string;
  capturedAt: string;
  plateNumber: string;
  vehicleDirection: "Eastbound" | "Westbound";
  detectedCondition: string;
  recognitionConfidence: number;
  captureStage: "Detected";
  activationReason: string;
  status: "SIMULATED_CAPTURE";
}

export interface MockNotificationRecipient {
  name: string;
  purpose: string;
  status: "LOCAL_MOCK_QUEUE_ONLY";
}

export interface SimulationResult {
  sessionId: string;
  scenario: Scenario;
  mode: CrossingMode;
  completedAt: string;
  operatingConditions: OperatingConditions;
  detectionConfidence: number;
  confidenceAssessment: ConfidenceAssessment;
  timeline: TimelineStage[];
  signal: SignalResponse;
  incident: boolean;
  emergencyReviewRequired: boolean;
  safetyDecision: import("@/lib/safety-orchestrator").SafetyDecision;
  cctvEvidence: CctvEvidence | null;
  notificationRecipients: MockNotificationRecipient[];
  countermeasures: string[];
  eventLog: EventLogEntry[];
  cameraFallback?: {
    active: boolean;
    requestState: "idle" | "latched" | "safety-hold" | "complete";
    protectedCrossingVerified: boolean;
    duplicatePresses: number;
  };
  emergencyPriority?: EmergencyPriorityRecord;
}
