import { z } from "zod";
import { resolveSafetyDecision, type SafetyDecision, type SafetyMode } from "@/lib/safety-orchestrator";

export const replayFrameSchema = z.object({
  frameId: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
});

export const pedestrianDetectionSchema = z.object({
  detectionId: z.string().min(1),
  frameId: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
  confidence: z.number().min(0).max(1),
  modelVersion: z.string().min(1),
});

export type ReplayFrame = z.infer<typeof replayFrameSchema>;
export type PedestrianDetection = z.infer<typeof pedestrianDetectionSchema>;
export type OccupancyState = "CLEAR" | "OCCUPIED" | "UNKNOWN";

export interface CrossingPolygon { readonly points: ReadonlyArray<readonly [number, number]>; }
export interface TrackedPedestrian { trackId: string; detection: PedestrianDetection; missedFrames: number; }
export interface OccupancyObservation {
  state: OccupancyState;
  timestampMs: number;
  confidence: number;
  provenance: "model-inference" | "occlusion-hold" | "no-detection" | "invalid-input";
  trackIds: string[];
}
export interface ReplayPipelineTrace {
  frame: ReplayFrame;
  detections: PedestrianDetection[];
  tracks: TrackedPedestrian[];
  occupancy: OccupancyObservation;
  decision: SafetyDecision;
  operatorEvent: string;
}

const DEFAULT_POLYGON: CrossingPolygon = { points: [[0.25, 0.25], [0.75, 0.25], [0.75, 0.85], [0.25, 0.85]] };
const centroid = (detection: PedestrianDetection): [number, number] => [detection.x + detection.width / 2, detection.y + detection.height / 2];
const inside = (detection: PedestrianDetection, polygon: CrossingPolygon): boolean => {
  const [x, y] = centroid(detection);
  let hit = false;
  for (let i = 0, j = polygon.points.length - 1; i < polygon.points.length; j = i++) {
    const [xi, yi] = polygon.points[i]; const [xj, yj] = polygon.points[j];
    const intersects = (yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
    if (intersects) hit = !hit;
  }
  return hit;
};

export function orderReplayFrames(frames: readonly unknown[], nowMs: number): ReplayFrame[] {
  const parsed = frames.map((frame) => replayFrameSchema.safeParse(frame));
  if (parsed.some((item) => !item.success)) throw new Error("Corrupt replay frame rejected before inference.");
  const ordered = parsed.flatMap((item) => item.success ? [item.data] : []).sort((a, b) => a.timestampMs - b.timestampMs || a.frameId.localeCompare(b.frameId));
  if (ordered.some((frame, index) => index > 0 && frame.timestampMs === ordered[index - 1].timestampMs && frame.frameId === ordered[index - 1].frameId)) throw new Error("Duplicate replay frame rejected.");
  if (ordered.some((frame) => frame.timestampMs > nowMs || nowMs - frame.timestampMs > 30_000)) throw new Error("Future or stale replay frame rejected.");
  return ordered;
}

export function trackAndAssessOccupancy(
  detections: readonly PedestrianDetection[],
  previousTracks: readonly TrackedPedestrian[],
  timestampMs: number,
  polygon: CrossingPolygon = DEFAULT_POLYGON,
  minConfidence = 0.75,
): { tracks: TrackedPedestrian[]; occupancy: OccupancyObservation } {
  const eligible = detections.filter((detection) => detection.confidence >= minConfidence);
  if (detections.length > 0 && eligible.length === 0) return { tracks: [], occupancy: { state: "UNKNOWN", timestampMs, confidence: Math.max(...detections.map((detection) => detection.confidence)), provenance: "invalid-input", trackIds: [] } };
  const tracks = eligible.map((detection, index) => ({ trackId: previousTracks[index]?.trackId ?? `ped-${index + 1}`, detection, missedFrames: 0 }));
  if (tracks.length > 0) {
    const inZone = tracks.filter((track) => inside(track.detection, polygon));
    return { tracks, occupancy: { state: inZone.length ? "OCCUPIED" : "CLEAR", timestampMs, confidence: Math.min(...inZone.concat(tracks).map((track) => track.detection.confidence)), provenance: "model-inference", trackIds: inZone.map((track) => track.trackId) } };
  }
  const held = previousTracks.filter((track) => track.missedFrames < 2).map((track) => ({ ...track, missedFrames: track.missedFrames + 1 }));
  if (held.length) return { tracks: held, occupancy: { state: "UNKNOWN", timestampMs, confidence: 0, provenance: "occlusion-hold", trackIds: held.map((track) => track.trackId) } };
  return { tracks: [], occupancy: { state: "CLEAR", timestampMs, confidence: 1, provenance: "no-detection", trackIds: [] } };
}

export function safetyDecisionForOccupancy(mode: SafetyMode, occupancy: OccupancyObservation, vehicleConflict = false): SafetyDecision {
  return resolveSafetyDecision({ mode, pedestrianInCrossing: occupancy.state === "OCCUPIED", clearanceVerified: occupancy.state === "CLEAR" && !vehicleConflict, pedestrianDemand: occupancy.state !== "CLEAR", sensorState: occupancy.state === "UNKNOWN" ? "stale" : "healthy", aiConfidence: occupancy.confidence, stopLineIntrusion: vehicleConflict });
}

export function buildReplayTrace(frame: ReplayFrame, detections: readonly PedestrianDetection[], previousTracks: readonly TrackedPedestrian[] = [], mode: SafetyMode = "NORMAL", vehicleConflict = false): ReplayPipelineTrace {
  const valid = detections.map((item) => pedestrianDetectionSchema.safeParse(item)).filter((item): item is { success: true; data: PedestrianDetection } => item.success).map((item) => item.data).filter((item) => item.frameId === frame.frameId && item.timestampMs === frame.timestampMs);
  const { tracks, occupancy } = trackAndAssessOccupancy(valid, previousTracks, frame.timestampMs);
  const decision = safetyDecisionForOccupancy(mode, occupancy, vehicleConflict);
  return { frame, detections: valid, tracks, occupancy, decision, operatorEvent: `Frame ${frame.frameId}: model inference ${valid.length} detection(s); track occupancy ${occupancy.state}; safety ${decision.state}; simulated recommendation ${decision.pedestrian === "WALK" ? "REQUEST WALK WHEN SAFE" : "HOLD / WAIT"}.` };
}
