export type SafetyMode = "NORMAL" | "SCHOOL";
export type SensorState = "healthy" | "degraded" | "stale" | "failed" | "contradictory";
export type SafetyState =
  | "COLLISION_PREVENTION"
  | "PEDESTRIAN_CLEARANCE"
  | "ALL_RED_CLEARANCE"
  | "EMERGENCY_VALIDATION_HOLD"
  | "EMERGENCY_PASSAGE"
  | "QUEUE_STABILISATION"
  | "PEDESTRIAN_SERVICE"
  | "DEGRADED_SAFE_HOLD"
  | "NORMAL_OPERATION"
  | "CONTROLLED_RECOVERY";

export interface SafetyInputs {
  mode: SafetyMode;
  immediateCollisionRisk?: boolean;
  pedestrianInCrossing?: boolean;
  clearanceVerified?: boolean;
  emergencyRequests?: Array<{ direction: "Eastbound" | "Westbound"; authenticated: boolean; confidence: number }>;
  congestionActive?: boolean;
  pedestrianDemand?: boolean;
  sensorState?: SensorState;
  aiConfidence?: number;
  stopLineIntrusion?: boolean;
  operatorOverride?: "none" | "safe-hold" | "resume";
  recoveryRequested?: boolean;
}

export interface SafetyDecision {
  state: SafetyState;
  vehicle: { eastbound: "GO" | "AMBER" | "STOP"; westbound: "GO" | "AMBER" | "STOP" };
  pedestrian: "WAIT" | "WALK";
  phaseClock: "vehicle" | "transition" | "walk" | "hold" | "recovery";
  reason: string;
  rejectedCommands: string[];
  requiresHumanReview: boolean;
  recoveryState: "not-required" | "awaiting-clearance" | "stabilising" | "complete";
}

const stop = { eastbound: "STOP", westbound: "STOP" } as const;

function decision(state: SafetyState, reason: string, overrides: Partial<SafetyDecision> = {}): SafetyDecision {
  const result: SafetyDecision = {
    state,
    vehicle: stop,
    pedestrian: "WAIT",
    phaseClock: "hold",
    reason,
    rejectedCommands: [],
    requiresHumanReview: false,
    recoveryState: "not-required",
    ...overrides,
  };
  assertConflictFree(result);
  return result;
}

export function assertConflictFree(value: Pick<SafetyDecision, "vehicle" | "pedestrian">): void {
  if (value.pedestrian === "WALK" && (value.vehicle.eastbound !== "STOP" || value.vehicle.westbound !== "STOP")) {
    throw new Error("Safety invariant rejected: pedestrian WALK cannot coexist with conflicting vehicle movement.");
  }
}

/** One deterministic priority resolver shared by Normal and School modes. */
export function resolveSafetyDecision(input: SafetyInputs): SafetyDecision {
  const sensorState = input.sensorState ?? "healthy";
  const confidence = input.aiConfidence ?? 1;
  const emergencies = input.emergencyRequests ?? [];
  const validEmergencies = emergencies.filter((item) => item.authenticated && item.confidence >= 0.9);
  const rejected = emergencies.filter((item) => !item.authenticated || item.confidence < 0.9);

  if (input.operatorOverride === "safe-hold" || input.immediateCollisionRisk || input.stopLineIntrusion) {
    return decision("COLLISION_PREVENTION", "Immediate conflict prevention has highest priority; all movements are held.", {
      rejectedCommands: ["pedestrian WALK", "vehicle GREEN", "emergency passage"], requiresHumanReview: true,
      recoveryState: "awaiting-clearance",
    });
  }
  if (input.pedestrianInCrossing) {
    return decision("PEDESTRIAN_CLEARANCE", "A pedestrian already inside the crossing retains protected clearance.", {
      pedestrian: "WALK", phaseClock: "walk", rejectedCommands: ["vehicle GREEN", "new pedestrian entry", "emergency passage"],
      recoveryState: "awaiting-clearance",
    });
  }
  if (input.clearanceVerified === false) {
    return decision("ALL_RED_CLEARANCE", "The conflict area is not yet verified clear; mandatory all-red clearance continues.", {
      phaseClock: "transition", rejectedCommands: ["pedestrian WALK", "vehicle GREEN"], recoveryState: "awaiting-clearance",
    });
  }
  if (["failed", "stale", "contradictory"].includes(sensorState)) {
    return decision("DEGRADED_SAFE_HOLD", `Sensor state ${sensorState} cannot support a release decision.`, {
      rejectedCommands: ["adaptive release", "pedestrian WALK", "emergency passage"], requiresHumanReview: true,
      recoveryState: "awaiting-clearance",
    });
  }
  if (emergencies.length > 1 && new Set(validEmergencies.map((item) => item.direction)).size > 1) {
    return decision("EMERGENCY_VALIDATION_HOLD", "Opposing verified emergency requests require one conflict-free human-authorised passage order.", {
      rejectedCommands: ["simultaneous emergency passage", "pedestrian WALK", "ordinary vehicle GREEN"], requiresHumanReview: true,
      recoveryState: "awaiting-clearance",
    });
  }
  if (emergencies.length && validEmergencies.length === 0) {
    return decision("EMERGENCY_VALIDATION_HOLD", "The emergency request is unauthenticated or below the validation threshold.", {
      rejectedCommands: ["unverified emergency priority", "pedestrian WALK"], requiresHumanReview: true,
      recoveryState: "awaiting-clearance",
    });
  }
  if (validEmergencies.length === 1) {
    const direction = validEmergencies[0].direction;
    return decision("EMERGENCY_PASSAGE", `Verified ${direction} emergency passage is the sole released movement.`, {
      vehicle: direction === "Eastbound" ? { eastbound: "GO", westbound: "STOP" } : { eastbound: "STOP", westbound: "GO" },
      phaseClock: "vehicle", rejectedCommands: ["pedestrian WALK", "ordinary conflicting traffic", ...rejected.map(() => "unverified emergency request")],
      recoveryState: "stabilising",
    });
  }
  if (input.recoveryRequested) {
    return decision("CONTROLLED_RECOVERY", "A bounded all-red recovery buffer precedes normal or adaptive release.", {
      phaseClock: "recovery", rejectedCommands: ["immediate GREEN", "pedestrian WALK"], recoveryState: "stabilising",
    });
  }
  if (input.congestionActive) {
    return decision("QUEUE_STABILISATION", "Traffic queues receive a bounded vehicle phase without cancelling stored pedestrian demand.", {
      vehicle: { eastbound: "GO", westbound: "GO" }, phaseClock: "vehicle",
      rejectedCommands: input.pedestrianDemand ? ["discard pedestrian demand"] : [],
    });
  }
  if (input.pedestrianDemand) {
    if (sensorState === "degraded" || confidence < 0.75) {
      return decision("DEGRADED_SAFE_HOLD", "Demand is stored while independent safety checks remain insufficient.", {
        rejectedCommands: ["AI-authorised WALK"], requiresHumanReview: true, recoveryState: "awaiting-clearance",
      });
    }
    return decision("PEDESTRIAN_SERVICE", "The route is clear and both conflicting approaches are stopped before WALK.", {
      pedestrian: "WALK", phaseClock: "walk",
    });
  }
  return decision("NORMAL_OPERATION", `${input.mode} crossing is in deterministic normal operation.`, {
    vehicle: { eastbound: "GO", westbound: "GO" }, phaseClock: "vehicle", recoveryState: "complete",
  });
}
