import { z } from "zod";
import { assessCameraFallback, cameraFallbackEventLog, DEGRADED_PROTECTED_WALK_SECONDS, DEFAULT_SECONDARY_SAFETY_INPUTS, type SecondarySafetyInputs } from "@/lib/camera-fallback";
import { motionFramesFor, motionTimingsFor, type MotionFrame } from "@/lib/motion";
import { normaliseDisplayText, normaliseTextPayload } from "@/lib/text-standard";
import { resolveSafetyDecision } from "@/lib/safety-orchestrator";
import { TIMELINE_STAGES, type ConfidenceAssessment, type CrossingMode, type EventLogEntry, type MockNotificationRecipient, type OperatingConditions, type Scenario, type ScenarioId, type Severity, type SignalResponse, type SimulationResult, type TimelineStage, type ViolationCategory } from "@/lib/types";

type OperatingConditionInput = Pick<OperatingConditions, "weather" | "lighting" | "visibility">;

const DEFAULT_OPERATING_INPUT: OperatingConditionInput = Object.freeze({
  weather: "dry",
  lighting: "day",
  visibility: "clear",
});

export function conditionQualityFor(conditions: OperatingConditionInput): number {
  const factors = [
    conditions.weather === "rain" ? 0.91 : 1,
    conditions.lighting === "night" ? 0.93 : 1,
    conditions.visibility === "haze" ? 0.94 : conditions.visibility === "dense-haze" ? 0.84 : 1,
  ];
  const hazePresent = conditions.visibility !== "clear";
  const adverseCount = factors.filter((factor) => factor < 1).length;
  const interactionPenalty = (conditions.weather === "rain" && conditions.lighting === "night" ? 0.03 : 0)
    + (conditions.weather === "rain" && hazePresent ? 0.03 : 0)
    + (conditions.lighting === "night" && hazePresent ? 0.02 : 0)
    + (adverseCount >= 3 ? 0.03 : 0);
  return Math.max(0, Number((factors.reduce((combined, factor) => combined * factor, 1) - interactionPenalty).toFixed(2)));
}

export function deriveSensorHealth(conditions: OperatingConditionInput): OperatingConditions["sensorHealth"] {
  const quality = conditionQualityFor(conditions);
  if (quality >= 0.9) return "operational";
  if (quality >= 0.75) return "constrained";
  return "degraded";
}

export function deriveOperatingConditions(conditions: OperatingConditionInput): OperatingConditions {
  return { ...conditions, sensorHealth: deriveSensorHealth(conditions), conditionQuality: conditionQualityFor(conditions) };
}

export const DEFAULT_OPERATING_CONDITIONS: OperatingConditions = Object.freeze(deriveOperatingConditions(DEFAULT_OPERATING_INPUT));

export const simulationInputSchema = z.object({
  mode: z.enum(["normal", "school"]),
  scenarioId: z.string().min(1),
  operatingConditions: z.object({
    weather: z.enum(["dry", "rain"]),
    lighting: z.enum(["day", "night"]),
    visibility: z.enum(["clear", "haze", "dense-haze"]).default("clear"),
  }).default(DEFAULT_OPERATING_INPUT).transform(deriveOperatingConditions),
});

type ViolationTemplate = Pick<Scenario, "label" | "severity" | "roadUser" | "detection" | "verification" | "systemResponse" | "finalOutcome"> & { slug: string };

const TOP_VIOLATIONS: ViolationTemplate[] = [
  { slug: "failure-to-stop-or-give-way", label: "Failure to stop or give way", severity: "high", roadUser: "car", detection: "A vehicle continues into the pedestrian path without slowing or yielding", verification: "Compare its path with pedestrian intent and confirm occupancy of the conflict zone", systemResponse: "Hold pedestrian WALK, issue a conflict warning, and highlight both movement paths", finalOutcome: "Near miss or failure-to-yield event recorded for authorised review" },
  { slug: "crossing-zone-speeding", label: "Crossing-zone speeding", severity: "medium", roadUser: "car", detection: "A vehicle accelerates inside the crossing zone above the configured limit", verification: "Validate the estimated speed, zone position, and threshold duration", systemResponse: "Display the estimated speed and issue a crossing-zone speeding warning", finalOutcome: "Speed, location, and duration are recorded as a simulated speeding event" },
  { slug: "red-signal-violation", label: "Red-signal violation", severity: "high", roadUser: "car", detection: "A vehicle crosses the stop line and enters the crossing during the red phase", verification: "Correlate the controller's red state, timestamp, stop-line position, and vehicle path", systemResponse: "Hold pedestrian WALK and issue a red-signal warning", finalOutcome: "Red-signal event recorded for authorised review" },
  { slug: "stopped-or-parked-on-crossing", label: "Stopped or parked on the crossing", severity: "medium", roadUser: "car", detection: "A stationary vehicle partially or fully blocks the marked pedestrian route", verification: "Confirm crossing occupancy and stationary duration", systemResponse: "Mark the crossing as obstructed, withhold WALK, and notify the local operator panel", finalOutcome: "Pedestrian route obstruction recorded" },
  { slug: "accessible-route-blocked", label: "Accessible route blocked", severity: "medium", roadUser: "van", detection: "A vehicle or object blocks the tactile path, ramp, or accessible route", verification: "Confirm that the obstruction blocks the route of an approaching wheelchair user or person with impaired mobility", systemResponse: "Issue a priority accessibility alert and display the blocked route", finalOutcome: "The accessible crossing route is recorded as unavailable" },
  { slug: "motorcycle-filtering-at-crossing", label: "Motorcycle filtering at the crossing", severity: "medium", roadUser: "motorcycle", detection: "A motorcycle filters between queued vehicles towards an occupied crossing", verification: "Track its filtering path and proximity to pedestrians", systemResponse: "Hold WALK and issue an unsafe-movement warning", finalOutcome: "Motorcycle filtering event recorded" },
  { slug: "motorcycle-in-pedestrian-area", label: "Motorcycle in the pedestrian area", severity: "high", roadUser: "motorcycle", detection: "A motorcycle leaves the traffic lane and enters the walkway or crossing", verification: "Confirm pedestrian-area intrusion and avoidance movement by pedestrians", systemResponse: "Activate an intrusion warning and highlight the motorcycle trajectory", finalOutcome: "High-risk pedestrian-area intrusion recorded" },
  { slug: "overtook-yielding-vehicle", label: "Overtaking a yielding vehicle", severity: "high", roadUser: "car", detection: "A second vehicle overtakes a vehicle that has yielded for a pedestrian", verification: "Compare both vehicle paths with the pedestrian position and crossing boundary", systemResponse: "Hold WALK and issue a dangerous-overtaking warning", finalOutcome: "Overtaking conflict or near miss recorded" },
  { slug: "driving-wrong-direction", label: "Driving in the wrong direction", severity: "high", roadUser: "car", detection: "A vehicle travels against the configured lane direction towards the crossing", verification: "Confirm the lane assignment, direction vector, and predicted crossing path", systemResponse: "Issue an urgent wrong-way warning and notify the simulated operator panel", finalOutcome: "Wrong-direction event recorded" },
  { slug: "opposing-lane-queue-bypass", label: "Opposing-lane queue bypass", severity: "high", roadUser: "car", detection: "A vehicle enters the opposing lane to bypass a queue beside the crossing", verification: "Assess lane departure against opposing traffic and pedestrian conflict paths", systemResponse: "Hold WALK, issue a queue-bypass warning and display the vehicle path", finalOutcome: "Opposing-lane queue-bypass event recorded" },
  { slug: "unsafe-lane-change-near-crossing", label: "Unsafe lane change near the crossing", severity: "low", roadUser: "car", detection: "A vehicle changes lane inside the configured crossing danger zone", verification: "Measure the lane position, speed, and clearance from nearby road users", systemResponse: "Issue a caution and retain the tracked lane-change path", finalOutcome: "Unsafe lane-change event recorded" },
  { slug: "possible-distracted-driving", label: "Possible distracted driving or phone use", severity: "medium", roadUser: "car", detection: "Privacy-filtered vision analysis indicates possible handheld phone use after a vehicle responds late or wanders", verification: "Treat the classification as unverified and require an authorised human reviewer before reaching any conclusion", systemResponse: "Hold WALK, monitor the stop line, and preserve the uncertain anonymous trajectory", finalOutcome: "Possible-distraction record retained as suspected, not confirmed" },
  { slug: "tailgating-near-stop-line", label: "Tailgating near the stop line", severity: "medium", roadUser: "car", detection: "A following vehicle closes below the configured safe distance near the stop line", verification: "Estimate both vehicles' positions, speeds, and available stopping distance", systemResponse: "Issue a tailgating warning and hold the protected crossing sequence", finalOutcome: "Tailgating and stopping-risk event recorded" },
  { slug: "aggressive-acceleration-or-braking", label: "Aggressive acceleration or braking", severity: "low", roadUser: "car", detection: "A vehicle accelerates or brakes beyond the configured comfort and safety threshold", verification: "Validate the speed change, location, and nearby road users", systemResponse: "Issue a movement-risk warning and retain the speed-change trace", finalOutcome: "Aggressive acceleration or braking event recorded" },
  { slug: "unsafe-u-turn-near-crossing", label: "Unsafe U-turn near the crossing", severity: "high", roadUser: "car", detection: "A vehicle begins a U-turn inside the crossing approach zone", verification: "Confirm the turning trajectory and conflicts with pedestrians, cyclists, or opposing traffic", systemResponse: "Hold WALK, issue an unsafe U-turn warning, and highlight conflict points", finalOutcome: "Unsafe U-turn event recorded" },
  { slug: "failed-to-yield-vulnerable-pedestrian", label: "Failure to yield to a vulnerable pedestrian", severity: "high", roadUser: "car", detection: "A vehicle fails to provide clearance to a child, elderly person or wheelchair user", verification: "Apply privacy-limited vulnerable-user priority logic and confirm the conflict path", systemResponse: "Issue an immediate priority safety warning and hold pedestrian release", finalOutcome: "Vulnerable-pedestrian near miss or failure-to-yield event recorded" },
  { slug: "exceeded-school-zone-speed-limit", label: "Exceeded school-zone speed limit", severity: "high", roadUser: "car", detection: "A vehicle exceeds the configured school-zone speed threshold while school users are nearby", verification: "Confirm the speed, active crossing context, and presence of children or school users", systemResponse: "Activate a school-zone warning and increase simulated review priority", finalOutcome: "School-zone speeding event recorded" },
  { slug: "parking-obstructed-sight-distance", label: "Parking obstructing sight distance", severity: "medium", roadUser: "van", detection: "A parked vehicle blocks sightlines between approaching pedestrians and traffic", verification: "Map the affected visibility area and confirm the presence of an approaching road user", systemResponse: "Mark the obscured sightline and flag a simulated safety or infrastructure hazard", finalOutcome: "Sight-distance obstruction recorded" },
  { slug: "collision-road-user-infrastructure", label: "Collision with a road user or infrastructure", severity: "critical", roadUser: "car", detection: "Impact, abrupt motion, or a trajectory change indicates a simulated collision", verification: "Confirm the impact path and the affected road user, vehicle, or roadside object", systemResponse: "Enter simulated emergency mode, preserve evidence, and show simulated notifications; no external dispatch occurs", finalOutcome: "Collision emergency activated in the simulation for authorised review" },
  { slug: "vehicle-fire-smoke-explosion", label: "Vehicle fire, smoke, or explosion", severity: "critical", roadUser: "car", detection: "Smoke, flame, heat, or explosion indicators appear near the crossing", verification: "Confirm the affected vehicle and simulated danger-zone occupancy", systemResponse: "Close the crossing, display an exclusion zone, and show simulated emergency notifications; no external dispatch occurs", finalOutcome: "Fire, smoke, or explosion emergency activated in the simulation" },
];

type SchoolRefinement = Pick<ViolationTemplate, "slug" | "label" | "detection" | "verification" | "systemResponse" | "finalOutcome">;

function classificationFor(slug: string): { category: ViolationCategory; severity: Severity; rationale: string } {
  if (slug === "collision-road-user-infrastructure") return { category: "collision", severity: "critical", rationale: "A simulated impact requires the crossing to remain closed and a human-led emergency review." };
  if (slug === "vehicle-fire-smoke-explosion") return { category: "fire", severity: "critical", rationale: "Fire or smoke creates an immediate exclusion-zone hazard and requires a human-led emergency review." };
  if (slug.includes("speed")) return { category: "speed", severity: slug === "exceeded-school-zone-speed-limit" ? "high" : "medium", rationale: slug === "exceeded-school-zone-speed-limit" ? "A school-zone threshold breach exposes nearby pupils to elevated risk." : "A speed-threshold breach requires operator review but no simulated impact has occurred." };
  if (slug === "red-signal-violation") return { category: "signal", severity: "high", rationale: "Crossing a stop line during RED creates a direct conflict with the protected route." };
  if (slug.includes("yield")) return { category: "yield", severity: "high", rationale: "Failure to yield creates a direct pedestrian conflict requiring priority review." };
  if (slug.includes("blocked") || slug.includes("parked") || slug.includes("parking")) return { category: "obstruction", severity: "medium", rationale: "The route or sight line is obstructed, so WALK remains withheld until the obstruction clears." };
  if (slug.includes("motorcycle")) return { category: "motorcycle", severity: slug.includes("pedestrian-area") ? "high" : "medium", rationale: slug.includes("pedestrian-area") ? "Motorcycle intrusion into pedestrian space creates a direct conflict." : "Filtering near the stop line increases crossing risk and requires review." };
  if (slug.includes("wrong-direction") || slug.includes("opposing-lane")) return { category: "direction", severity: "high", rationale: "Travel against the expected lane direction creates a direct and unpredictable conflict path." };
  if (slug.includes("vulnerable")) return { category: "vulnerable-user", severity: "high", rationale: "A conflict involving a vulnerable pedestrian requires priority human review." };
  return { category: "driver-behaviour", severity: slug.includes("u-turn") ? "high" : "medium", rationale: slug.includes("u-turn") ? "A turning vehicle enters the crossing approach conflict area." : "Observable unsafe movement requires review, without evidence of an impact or emergency." };
}

const SCHOOL_REFINEMENTS: SchoolRefinement[] = [
  { slug: "crossing-zone-speeding", label: "Crossing-zone speeding", detection: "A vehicle exceeds the active school-zone speed threshold while pupils wait at the school crossing", verification: "Confirm the school control is active, validate the approach speed, and verify that pupils remain inside the safe waiting area", systemResponse: "Display SCHOOL-ZONE SPEED, keep pupils at WAIT, extend the vehicle stopping phase, and release WALK only after a safe stop", finalOutcome: "School-zone speed event and protected pupil hold recorded for authorised review" },
  { slug: "red-signal-violation", label: "Red-signal violation", detection: "A vehicle crosses the stop line during RED while an active pupil crossing request is held", verification: "Correlate the RED phase, stop-line breach, pupil request, and vehicle path until the conflict area clears", systemResponse: "Keep pupils at WAIT, sound a priority warning, highlight the vehicle, and restore a protected phase only after the conflict clears", finalOutcome: "Red-signal breach recorded; pupil movement remained inhibited" },
  { slug: "failure-to-stop-or-give-way", label: "Failure to yield", detection: "A vehicle approaches a pupil group at the zebra crossing and fails to yield", verification: "Confirm the pupil group, both conflicting approaches, and whether each vehicle reaches its marked stopping point", systemResponse: "Command both conflicting vehicles to stop and release WALK only after both are stationary; otherwise retain WAIT", finalOutcome: "Failure-to-yield event and two-approach stop confirmation recorded" },
  { slug: "stopped-or-parked-on-crossing", label: "Vehicle stopped on the zebra crossing", detection: "A vehicle stops on the zebra and blocks the direct route between the school gate and opposite footway", verification: "Confirm crossing occupancy, a stationary vehicle, and that it does not reverse into the pupil route", systemResponse: "Withhold WALK, mark the zebra as obstructed, and keep pupils inside the safe waiting area until the route is clear", finalOutcome: "School crossing obstruction recorded and pupil route kept closed" },
  { slug: "accessible-route-blocked", label: "Accessibility obstruction", detection: "A vehicle blocks the kerb ramp, tactile paving, or accessible route from the school gate", verification: "Confirm the blocked route affects a pupil using a mobility aid or requiring accessible guidance", systemResponse: "Display ACCESSIBLE ROUTE BLOCKED and prevent WALK until the kerb ramp and tactile route are clear", finalOutcome: "Accessible school route obstruction recorded" },
  { slug: "motorcycle-filtering-at-crossing", label: "Motorcycle filtering", detection: "A motorcycle filters forwards beside a school drop-off queue towards the stop line", verification: "Track its continuous forward path and confirm whether it stops or clears the pupil conflict area", systemResponse: "Display MOTORCYCLE FILTERING IN SCHOOL ZONE and keep pupils at WAIT until the motorcycle stops or clears", finalOutcome: "School-zone motorcycle filtering event recorded" },
  { slug: "motorcycle-in-pedestrian-area", label: "Premature pedestrian movement", detection: "A pupil moves towards the crossing edge before WALK but remains within the protected waiting area", verification: "Confirm the pupil does not enter the zebra during WAIT or STOP and verify both conflicting vehicles are stopped before release", systemResponse: "Apply the signal interlock, provide a visible WAIT reminder, and begin pupil movement only during protected WALK", finalOutcome: "Premature pupil movement safely contained within the waiting area" },
  { slug: "overtook-yielding-vehicle", label: "Unsafe overtaking", detection: "Vehicle B overtakes Vehicle A after Vehicle A yields beside the school crossing or drop-off queue", verification: "Confirm the overtaking trajectory and keep pupils outside the zebra until Vehicle B stops or clears", systemResponse: "Display OVERTAKING AT SCHOOL CROSSING and retain pupil WAIT until the overtaking conflict is removed", finalOutcome: "Unsafe school-crossing overtake recorded" },
  { slug: "driving-wrong-direction", label: "Wrong-way approach", detection: "A vehicle travels against the school arrival or departure circulation direction towards the crossing", verification: "Confirm the direction conflict and predicted path through the pupil crossing", systemResponse: "Trigger a wrong-way warning, freeze the pupil request at WAIT, and stop all conflicting vehicle movement", finalOutcome: "Wrong-way school approach recorded" },
  { slug: "opposing-lane-queue-bypass", label: "Opposing-lane bypass", detection: "A vehicle uses the opposing lane to pass school arrival or collection traffic near a screened pupil group", verification: "Monitor the opposing lane and confirm the vehicle has stopped or left the crossing conflict zone", systemResponse: "Warn pupils and the controller, withhold WALK, and extend the clearance period", finalOutcome: "Opposing-lane school queue bypass recorded" },
  { slug: "unsafe-lane-change-near-crossing", label: "Unsafe lane change", detection: "A vehicle changes lane beside the school drop-off area and reduces visibility between the driver and pupils", verification: "Confirm the lateral movement, approach occupancy, and restoration of a stable clear lane", systemResponse: "Display UNSAFE LANE CHANGE - PUPILS WAIT and restart the protected sequence only after the approach is clear", finalOutcome: "Unsafe school-approach lane change recorded" },
  { slug: "tailgating-near-stop-line", label: "Tailgating", detection: "Vehicle B closes an unsafe gap behind Vehicle A while Vehicle A stops for pupils", verification: "Measure the following gap and confirm Vehicle B stops behind Vehicle A with sufficient separation", systemResponse: "Hold pupils at WAIT and release WALK only when both vehicles are stationary with safe separation", finalOutcome: "School-zone tailgating and stopping gap recorded" },
  { slug: "possible-distracted-driving", label: "Distracted or delayed driver response", detection: "A vehicle shows an observable delayed response while pupils remain visible at the school crossing", verification: "Measure the late response without inferring or identifying private activity inside the vehicle", systemResponse: "Issue an early attention alert, extend approach monitoring, and keep pupils at WAIT until the vehicle stops", finalOutcome: "Observable delayed-response event retained as suspected and subject to human review" },
  { slug: "aggressive-acceleration-or-braking", label: "Emergency braking", detection: "Vehicle A approaches the school crossing, detects a hazard, and brakes sharply", verification: "Confirm zero speed and a complete stop before the crossing line before considering WALK", systemResponse: "Keep pupils at WAIT through approach and braking; retain WAIT if the vehicle cannot stop safely", finalOutcome: "Emergency braking and final safe-stop position recorded" },
  { slug: "unsafe-u-turn-near-crossing", label: "U-turn at the crossing", detection: "Vehicle A begins a slow U-turn immediately outside the school gate or drop-off area", verification: "Track the complete smooth turning path until the vehicle leaves the pupil conflict area", systemResponse: "Display U-TURN AT SCHOOL GATE and prevent pupils entering until the turn is complete", finalOutcome: "School-gate U-turn event recorded" },
  { slug: "failed-to-yield-vulnerable-pedestrian", label: "Vulnerable pedestrian conflict", detection: "A vehicle creates a conflict with a young child, disabled pupil, or pupil group needing longer clearance", verification: "Confirm any emergency stop occurs before the crossing line and that the pupil reaches the safe footway", systemResponse: "Apply child-sensitive detection, a longer WALK and clearance period, and hold traffic until the pupil is fully clear", finalOutcome: "Vulnerable pupil conflict and extended clearance recorded" },
  { slug: "exceeded-school-zone-speed-limit", label: "School-zone violation", detection: "A vehicle disregards an active school-zone rule, frontage control, or school crossing warning", verification: "Confirm the school control is active and the simulated rule breach occurs inside the school-only boundary", systemResponse: "Activate the school-zone warning state, keep pupils at WAIT, and enforce the configured school operating rule", finalOutcome: "School-zone-specific violation recorded" },
  { slug: "parking-obstructed-sight-distance", label: "Parking-related obstruction", detection: "A parked vehicle near the school gate or zebra blocks pupil visibility, access, or the waiting area", verification: "Confirm occupancy of the keep-clear or visibility zone and map the concealed pupil route", systemResponse: "Display SCHOOL CROSSING VIEW OBSTRUCTED and withhold WALK until the sight line and route are clear", finalOutcome: "School visibility or access obstruction recorded" },
  { slug: "collision-road-user-infrastructure", label: "Collision event", detection: "A vehicle and pupil or crossing asset reach the same simulated impact point near the school crossing", verification: "Confirm contact occurs before showing the impact marker and identify the affected road user or infrastructure", systemResponse: "Set every signal to STOP, sound the simulated alarm, freeze actors, identify the impact point, and begin the local emergency workflow", finalOutcome: "School collision emergency activated after simulated contact" },
  { slug: "vehicle-fire-smoke-explosion", label: "Vehicle fire event", detection: "Smoke, fire, or explosion indicators appear near the school frontage while pupils remain in a safe area", verification: "Confirm the affected vehicle and keep the waiting or evacuation area outside the simulated danger zone", systemResponse: "Set every indication to STOP, display FIRE / EVACUATION, and begin the simulated notification and safe-area sequence", finalOutcome: "School-frontage fire emergency activated as an emergency outcome" },
];

function safeScenario(mode: CrossingMode): Scenario {
  const school = mode === "school";
  return {
    id: `${mode}-no-violation`,
    label: `${school ? "School" : "Normal"} pedestrian crossing: no violation`,
    summary: school ? "A supervised pupil group uses the protected school crossing safely." : "Normal traffic yields and a pedestrian completes a protected crossing.",
    supportedModes: [mode], detection: school ? "Pupils approach inside the supervised school gate zone" : "A pedestrian approaches inside the marked detection zone",
    verification: "Confirm pedestrian intention, permitted vehicle speed, and a clear protected route",
    systemResponse: "Stop both traffic approaches before displaying pedestrian WALK",
    finalOutcome: "Safe crossing completed; traffic resumes only after the route is clear",
    severity: "routine", confidence: 0.98, vehicleCount: school ? 6 : 4, pedestrianCount: school ? 8 : 2, motorcycleCount: school ? 2 : 1,
    violation: false, violationCategory: "none", severityRationale: "No violation is present; the protected crossing sequence completes normally.", roadUser: "mixed",
  };
}

function violationScenarios(mode: CrossingMode): Scenario[] {
  const catalogue = mode === "school"
    ? SCHOOL_REFINEMENTS.map((refinement) => ({ ...TOP_VIOLATIONS.find((item) => item.slug === refinement.slug)!, ...refinement }))
    : TOP_VIOLATIONS;
  return catalogue.flatMap((item, index) => {
    if (mode === "normal" && item.slug === "exceeded-school-zone-speed-limit") return [];
    const classification = classificationFor(item.slug);
    return [{
    id: `${mode}-${item.slug}`,
    label: `${String(index + 1).padStart(2, "0")}. ${item.label}`,
    summary: `${item.label} in the ${mode === "school" ? "school forecourt" : "normal mid-block"} crossing simulation. Human review is required before any conclusion.`,
    supportedModes: [mode], detection: `${item.detection} at the ${mode === "school" ? "school" : "normal"} crossing`, verification: item.verification,
    systemResponse: item.systemResponse, finalOutcome: item.finalOutcome, severity: classification.severity, confidence: Math.max(0.82, 0.97 - index * 0.006),
    vehicleCount: mode === "school" ? 7 : 5, pedestrianCount: mode === "school" ? 9 : 3, motorcycleCount: item.roadUser === "motorcycle" ? 3 : 1,
    violation: true, violationCategory: classification.category, severityRationale: classification.rationale, roadUser: mode === "school" && item.slug === "motorcycle-in-pedestrian-area" ? "mixed" : item.roadUser,
    }];
  });
}

function confidenceFor(base: number, conditions: OperatingConditions): number {
  return Math.max(0, Number((base * conditions.conditionQuality).toFixed(2)));
}

export function assessConfidence(confidence: number): ConfidenceAssessment {
  if (confidence >= 0.9) return { band: "usable", label: "USABLE", action: "Continue simulation; violations still require human review.", walkPermitted: true, conclusionPermitted: true, humanReviewRequired: false };
  if (confidence >= 0.75) return { band: "limited", label: "LIMITED CONFIDENCE", action: "VERIFY - human confirmation is required.", walkPermitted: true, conclusionPermitted: true, humanReviewRequired: true };
  if (confidence >= 0.5) return { band: "non-usable", label: "SYSTEM DEGRADED", action: "Withhold WALK and do not conclude that a violation occurred.", walkPermitted: false, conclusionPermitted: false, humanReviewRequired: true };
  return { band: "failed", label: "SENSOR FAILURE", action: "Keep STOP/WAIT until an alternative check or authorised reset.", walkPermitted: false, conclusionPermitted: false, humanReviewRequired: true };
}

export function applyConfidenceSafetyOverride(frame: MotionFrame, assessment: ConfidenceAssessment): MotionFrame {
  if (assessment.walkPermitted) return frame;
  return {
    ...frame,
    pedestrian: { ...frame.pedestrian, progress: 0, state: "HOLD" },
    vehicleSignal: "STOP",
    pedestrianSignal: "WAIT",
    controller: frame.controller === "CRITICAL_ALARM" ? "CRITICAL_ALARM" : "STOP_ALL",
    pathTone: "red",
    routeClear: false,
    risk: frame.risk === "Emergency" ? "Emergency" : "High",
    action: `${frame.action} ${assessment.label}: ${assessment.action}`,
  };
}

function notificationRecipientsFor(scenario: Scenario): MockNotificationRecipient[] {
  if (scenario.severity !== "critical") return [];
  const recipients: MockNotificationRecipient[] = [{ name: "MPAJ traffic operations review desk", purpose: "Coordinate local crossing closure and authorised review", status: "LOCAL_MOCK_QUEUE_ONLY" }];
  if (scenario.violationCategory === "collision") recipients.push(
    { name: "Royal Malaysia Police traffic liaison", purpose: "Review the simulated collision record", status: "LOCAL_MOCK_QUEUE_ONLY" },
    { name: "Emergency medical services liaison", purpose: "Review possible road-user injury response", status: "LOCAL_MOCK_QUEUE_ONLY" },
  );
  if (scenario.violationCategory === "fire") recipients.push(
    { name: "Fire and Rescue Department liaison", purpose: "Review the simulated fire and exclusion-zone response", status: "LOCAL_MOCK_QUEUE_ONLY" },
    { name: "Emergency medical services liaison", purpose: "Review possible smoke or injury response", status: "LOCAL_MOCK_QUEUE_ONLY" },
  );
  return recipients;
}

function syntheticPlateFor(scenarioId: string, mode: CrossingMode): string {
  const hash = [...scenarioId].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 10_000, 0);
  return `SCV2-${mode === "school" ? "S" : "N"}${String(hash).padStart(4, "0")}`;
}

function countermeasuresFor(scenarioId: string, mode: CrossingMode): string[] {
  const slug = scenarioId.replace(/^(normal|school)-/, "");
  const supervision = mode === "school"
    ? "Use supervised pupil release and keep the school waiting area visibly separated from traffic."
    : "Improve driver sight distance and pedestrian visibility on both crossing approaches.";

  if (slug.includes("speed") || slug.includes("acceleration")) return [
    "Review approach-speed thresholds and provide advance speed-feedback signs.",
    "Assess raised-table, lane-narrowing, or other context-appropriate traffic-calming measures.",
    supervision,
  ];
  if (slug.includes("parked") || slug.includes("parking") || slug.includes("blocked")) return [
    "Strengthen keep-clear markings and parking restrictions around the crossing envelope.",
    "Protect tactile paving, kerb ramps, and sight triangles with suitable physical separation.",
    supervision,
  ];
  if (slug.includes("collision")) return [
    "Close the affected simulated route until the crossing asset and stopping layout are reviewed.",
    "Assess protective placement, visibility, and maintenance of signal and roadside infrastructure.",
    "Retain the local record for authorised human review; no automatic dispatch is permitted.",
  ];
  if (slug.includes("fire")) return [
    "Keep pedestrians outside the marked exclusion area and preserve an unobstructed evacuation route.",
    "Review safe assembly locations, emergency access, and fire-resistant separation from the waiting area.",
    "Use the local mock workflow for training only; no external emergency notification is sent.",
  ];
  if (slug.includes("vulnerable") || slug.includes("pedestrian-area")) return [
    "Provide longer protected clearance and an accessible request or supervised-release option.",
    "Improve tactile, visual, and audible guidance at the waiting and crossing zones.",
    supervision,
  ];
  return [
    "Review signal visibility, stop-line placement, and advance warning markings on both approaches.",
    "Consider speed management and lane-channelisation measures appropriate to the observed movement.",
    supervision,
  ];
}

function evidenceDirectionFor(frames: ReturnType<typeof motionFramesFor>, scenarioId: string): "Eastbound" | "Westbound" {
  const usesVehicleB = scenarioId.includes("overtook-yielding-vehicle") || scenarioId.includes("tailgating-near-stop-line");
  const actor = usesVehicleB ? frames[2].vehicleB : frames[2].vehicleA;
  const heading = ((actor.heading % 360) + 360) % 360;
  return heading >= 90 && heading <= 270 ? "Westbound" : "Eastbound";
}

export const SCENARIOS: Scenario[] = normaliseTextPayload(
  [safeScenario("normal"), ...violationScenarios("normal"), safeScenario("school"), ...violationScenarios("school")],
  "simulator",
);

function responseFor(scenario: Scenario): SignalResponse {
  if (scenario.violation) {
    return {
      vehicle: "STOP",
      pedestrian: "WAIT",
      action: scenario.systemResponse,
      reason: "Pedestrian WALK is withheld for every simulated violation until an authorised review confirms the route is clear.",
    };
  }
  return {
    vehicle: "STOP",
    pedestrian: "WALK",
    action: scenario.systemResponse,
    reason: "Both traffic approaches stop before the pedestrian signal displays WALK; the route clears, then traffic resumes.",
  };
}

export function runSimulation(rawInput: { mode: CrossingMode; scenarioId: ScenarioId; operatingConditions?: OperatingConditionInput; manualCrossingRequest?: boolean; duplicateButtonPresses?: number; secondarySafetyInputs?: SecondarySafetyInputs }, baseTime = new Date()): SimulationResult {
  const input = simulationInputSchema.parse(rawInput);
  const scenario = SCENARIOS.find((item) => item.id === input.scenarioId);
  if (!scenario || !scenario.supportedModes.includes(input.mode)) throw new Error("This scenario is not available for the selected crossing mode.");

  const detectionConfidence = confidenceFor(scenario.confidence, input.operatingConditions);
  const confidenceAssessment = assessConfidence(detectionConfidence);
  const secondarySafetyInputs = rawInput.secondarySafetyInputs ?? DEFAULT_SECONDARY_SAFETY_INPUTS;
  const fallback = assessCameraFallback(input.operatingConditions, rawInput.manualCrossingRequest === true, {
    ...secondarySafetyInputs,
    controllerAvailable: secondarySafetyInputs.controllerAvailable && scenario.severity !== "critical",
  });
  const baseSignal = responseFor(scenario);
  const signal: SignalResponse = fallback.active ? {
    vehicle: "STOP",
    pedestrian: fallback.protectedCrossingVerified ? "WALK" : "WAIT",
    action: fallback.message,
    reason: fallback.protectedCrossingVerified
      ? "The request is latched; simulated secondary inputs verify RED and all-red protection before the conservative WALK interval."
      : "The degraded camera cannot authorise WALK; the request remains waiting or in Safety Hold.",
  } : confidenceAssessment.walkPermitted ? baseSignal : {
    vehicle: "STOP",
    pedestrian: "WAIT",
    action: confidenceAssessment.action,
    reason: `${confidenceAssessment.label}: simulated system confidence is ${Math.round(detectionConfidence * 100)} percent. WALK remains withheld.`,
  };
  if (signal.pedestrian === "WALK" && signal.vehicle !== "STOP") throw new Error("Unsafe signal conflict rejected.");

  const motionScenarioId = fallback.protectedCrossingVerified ? protectedFallbackScenarioId(input.mode) : scenario.id;
  const rawMotionFrames = motionFramesFor(motionScenarioId, input.mode);
  const motionFrames = fallback.protectedCrossingVerified
    ? rawMotionFrames
    : rawMotionFrames.map((frame) => applyConfidenceSafetyOverride(frame, confidenceAssessment));
  const notificationRecipients = notificationRecipientsFor(scenario);
  const motionTimings = motionTimingsFor(motionScenarioId, input.mode);
  if (fallback.protectedCrossingVerified) {
    const walkIndexes = motionFrames.map((frame, index) => frame.pedestrianSignal === "WALK" && frame.routeClear ? index : -1).filter((index) => index >= 0);
    walkIndexes.forEach((index, order) => {
      motionTimings[index] = {
        durationMs: (DEGRADED_PROTECTED_WALK_SECONDS * 1_000) / walkIndexes.length,
        protectedWalkSecondsAtStart: Math.ceil(DEGRADED_PROTECTED_WALK_SECONDS * (1 - order / walkIndexes.length)),
      };
    });
  }
  let elapsedMilliseconds = 0;
  const timeline: TimelineStage[] = TIMELINE_STAGES.map((name, index) => {
    const frame = motionFrames[index];
    const timestamp = new Date(baseTime.getTime() + elapsedMilliseconds).toISOString();
    elapsedMilliseconds += motionTimings[index].durationMs;
    return {
      name,
      timestamp,
      detail: normaliseDisplayText(`${frame.action} Active sensor: ${frame.activeSensor}; risk: ${frame.risk}; vehicle signal: ${frame.vehicleSignal}; pedestrian signal: ${frame.pedestrianSignal}.`, "simulator"),
      status: "complete",
    };
  });

  const categoryForFrame: EventLogEntry["category"][] = ["sensor", "sensor", "detection", "controller", "safety", "safety", "outcome"];
  const cctvDirection = evidenceDirectionFor(motionFrames, scenario.id);
  const cctvCameraId = cctvDirection === "Eastbound" ? "CCTV EB-01" : "CCTV WB-01";
  const standardEventLog = motionFrames.map((frame, index) => {
    const criticalContext = scenario.severity === "critical" && index === 4
      ? ` Critical trigger metadata records ${scenario.label}. The affected actor is Vehicle A. The location is the ${input.mode === "school" ? "school forecourt and direct crossing route" : "MPAJ representative mid-block crossing"}. The system response uses three short local alarm tones, sets both vehicle indicators to STOP, sets the pedestrian indicator to HOLD, and places local mock records for ${notificationRecipients.map((recipient) => recipient.name).join(", ")}.`
      : "";
    return {
      id: `${input.scenarioId}-${index}`,
      timestamp: timeline[index].timestamp,
      category: categoryForFrame[index],
      message: normaliseDisplayText(`${TIMELINE_STAGES[index]}: ${frame.action} Vehicle A is ${frame.vehicleA.state} at ${frame.vehicleA.speed} km/h. Vehicle B is ${frame.vehicleB.state} at ${frame.vehicleB.speed} km/h. The pedestrian state is ${frame.pedestrian.state}. The active sensor is ${frame.activeSensor}. Risk is ${frame.risk}. The controller state is ${frame.controller}. The vehicle signal is ${frame.vehicleSignal}, and the pedestrian signal is ${frame.pedestrianSignal}.${index === 0 ? ` Operating conditions: ${input.operatingConditions.weather}, ${input.operatingConditions.lighting}, visibility ${input.operatingConditions.visibility}, sensor ${input.operatingConditions.sensorHealth}. Rain automatically includes wet-road ponding and reduced vehicle traction. Combined environmental input quality is ${Math.round(input.operatingConditions.conditionQuality * 100)} percent. Simulated system detection confidence is ${Math.round(detectionConfidence * 100)} percent; classification: ${confidenceAssessment.label}; required response: ${confidenceAssessment.action}` : ""}${scenario.violation && index === 2 ? ` ${cctvCameraId} supplements radar tracking at the Detected stage and records synthetic plate ${syntheticPlateFor(scenario.id, input.mode)} for authorised review; no live ANPR lookup occurs.` : ""}${criticalContext} ${index === 6 ? `Local deterministic simulation only. ${scenario.violation || confidenceAssessment.humanReviewRequired ? "Human confirmation is required. " : ""}${confidenceAssessment.conclusionPermitted ? "" : "No automated violation conclusion is permitted. "}No external dispatch occurs.` : ""}`.trim(), "simulator"),
    };
  });
  const eventLog = fallback.active && rawInput.manualCrossingRequest
    ? cameraFallbackEventLog(baseTime, input.operatingConditions.conditionQuality, fallback, rawInput.duplicateButtonPresses ?? 0)
    : standardEventLog;
  const safetyDecision = resolveSafetyDecision({
    mode: input.mode === "school" ? "SCHOOL" : "NORMAL",
    immediateCollisionRisk: scenario.severity === "critical",
    stopLineIntrusion: scenario.id.includes("red-signal") || scenario.id.includes("stop-line"),
    clearanceVerified: !scenario.violation || fallback.protectedCrossingVerified,
    pedestrianDemand: !scenario.violation || rawInput.manualCrossingRequest === true,
    independentFallbackVerified: fallback.protectedCrossingVerified,
    sensorState: input.operatingConditions.sensorHealth === "degraded" ? "degraded" : input.operatingConditions.sensorHealth === "constrained" ? "degraded" : "healthy",
    aiConfidence: detectionConfidence,
  });

  return {
    sessionId: `SIM-${baseTime.getTime()}`,
    scenario,
    mode: input.mode,
    completedAt: timeline.at(-1)?.timestamp ?? baseTime.toISOString(),
    timeline,
    signal,
    operatingConditions: input.operatingConditions,
    detectionConfidence,
    confidenceAssessment,
    incident: scenario.severity === "critical",
    emergencyReviewRequired: scenario.severity === "critical" || confidenceAssessment.humanReviewRequired,
    safetyDecision,
    cctvEvidence: scenario.violation ? {
      cameraId: cctvCameraId,
      capturedAt: timeline[2].timestamp,
      plateNumber: syntheticPlateFor(scenario.id, input.mode),
      vehicleDirection: cctvDirection,
      detectedCondition: confidenceAssessment.conclusionPermitted ? scenario.label : `Unconfirmed possible condition: ${scenario.label}`,
      recognitionConfidence: Math.max(0, Number((detectionConfidence - 0.03).toFixed(2))),
      captureStage: "Detected",
      activationReason: confidenceAssessment.conclusionPermitted ? "A configured simulated violation reached the Detected stage." : "A possible event reached the Detected stage, but low system confidence prevents an automated conclusion.",
      status: "SIMULATED_CAPTURE",
    } : null,
    notificationRecipients,
    countermeasures: scenario.violation ? countermeasuresFor(scenario.id, input.mode) : [],
    eventLog,
    cameraFallback: fallback.active ? {
      active: true,
      requestState: fallback.protectedCrossingVerified ? "complete" : fallback.requestState,
      protectedCrossingVerified: fallback.protectedCrossingVerified,
      duplicatePresses: rawInput.duplicateButtonPresses ?? 0,
    } : undefined,
  };
}

export function protectedFallbackScenarioId(mode: CrossingMode): ScenarioId {
  return `${mode}-no-violation`;
}

export function getProgress(timeline: TimelineStage[]): number {
  return Math.round((timeline.length / TIMELINE_STAGES.length) * 100);
}
