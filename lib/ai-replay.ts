import { z } from "zod";

export const REPLAY_MODES = ["SCRIPTED_DEMO", "AI_REPLAY", "LIVE_OBSERVATION"] as const;
export type ReplayMode = (typeof REPLAY_MODES)[number];

export const replayObservationSchema = z.object({
  timestampMs: z.number().int().nonnegative(),
  sourceId: z.string().min(1),
  frameId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});
export type ReplayObservation = z.infer<typeof replayObservationSchema>;

export interface ReplayProvenance {
  mode: ReplayMode;
  input: "scenario-script" | "recorded-observation" | "future-live-feed";
  algorithm: "deterministic-scenario-engine" | "model-unavailable";
  modelVersion: string | null;
  confidence: number | null;
}

export interface ReplayResult {
  accepted: boolean;
  status: "SCRIPTED" | "MODEL_UNAVAILABLE" | "LIVE_UNAVAILABLE" | "REJECTED";
  reason: string;
  observationsProcessed: number;
  provenance: ReplayProvenance;
}

const unavailable = (mode: ReplayMode, observationsProcessed = 0): ReplayResult => ({
  accepted: false,
  status: mode === "AI_REPLAY" ? "MODEL_UNAVAILABLE" : mode === "LIVE_OBSERVATION" ? "LIVE_UNAVAILABLE" : "REJECTED",
  reason: mode === "AI_REPLAY"
    ? "No versioned detector is installed; no inference result is produced and safety state must remain fail-closed."
    : mode === "LIVE_OBSERVATION"
      ? "Live observation is designed but unavailable until separately approved and integrated."
      : "Scripted scenarios must be run through the deterministic scenario engine.",
  observationsProcessed,
  provenance: {
    mode,
    input: mode === "AI_REPLAY" ? "recorded-observation" : mode === "LIVE_OBSERVATION" ? "future-live-feed" : "scenario-script",
    algorithm: mode === "SCRIPTED_DEMO" ? "deterministic-scenario-engine" : "model-unavailable",
    modelVersion: null,
    confidence: null,
  },
});

export function runReplay(mode: ReplayMode, observations: readonly unknown[] = []): ReplayResult {
  if (mode !== "AI_REPLAY") return unavailable(mode);
  const parsed = observations.map((item) => replayObservationSchema.safeParse(item));
  if (parsed.some((item) => !item.success)) return { ...unavailable(mode), status: "REJECTED", reason: "Malformed replay observation rejected before any inference or safety decision." };
  const ordered = parsed.flatMap((item) => item.success ? [item.data] : []).sort((a, b) => a.timestampMs - b.timestampMs || a.sourceId.localeCompare(b.sourceId) || a.frameId.localeCompare(b.frameId));
  return unavailable(mode, ordered.length);
}
