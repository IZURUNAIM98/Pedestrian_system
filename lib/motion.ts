import type { CrossingMode, PedestrianState, SignalState } from "@/lib/types";

export const MOTION_FRAME_COUNT = 7;
export const MOTION_STAGE_BY_FRAME = [0, 1, 2, 3, 4, 5, 6] as const;
export const STANDARD_MOTION_FRAME_MS = 1_000;
export const U_TURN_MOTION_FRAME_MS = 1_800;
export const PROTECTED_WALK_SECONDS = 12;
export const SCHOOL_ZONE_SPEED_PROFILE = Object.freeze({
  configuredLimit: 30,
  approachSpeed: 46,
  peakSpeed: 50,
  detectionSpeed: 42,
});

export type VehicleMotionState =
  | "WAITING"
  | "APPROACHING"
  | "ACCELERATING"
  | "BRAKING"
  | "STOPPED"
  | "YIELDING"
  | "TURNING"
  | "WRONG_WAY"
  | "BLOCKING"
  | "COLLISION"
  | "FIRE"
  | "CLEARED";

export type PedestrianMotionState =
  | "WAITING"
  | "WALKING"
  | "PAUSED"
  | "VULNERABLE_PRIORITY"
  | "ROUTED_AWAY"
  | "COMPLETED"
  | "HOLD";

export type ControllerMotionState =
  | "DETECTION"
  | "VERIFICATION"
  | "CAUTION"
  | "WALK"
  | "HOLD"
  | "STOP_ALL"
  | "CRITICAL_ALARM"
  | "OUTCOME"
  | "RESET";

export type MotionEffect =
  | "none"
  | "conflict"
  | "speed"
  | "red-light"
  | "crossing-blocked"
  | "accessible-blocked"
  | "filtering"
  | "pedestrian-intrusion"
  | "overtaking"
  | "wrong-way"
  | "queue-bypass"
  | "lane-change"
  | "possible-distraction"
  | "tailgating"
  | "hard-braking"
  | "u-turn"
  | "vulnerable-user"
  | "school-speed"
  | "sight-obstruction"
  | "collision"
  | "fire";

export interface VehicleMotion {
  x: number;
  lane: number;
  heading: number;
  speed: number;
  state: VehicleMotionState;
  label: string;
  visible?: boolean;
}

export interface PedestrianMotion {
  progress: number;
  state: PedestrianMotionState;
  kind: "adult" | "child" | "elderly" | "wheelchair";
}

export interface MotionFrame {
  timelineStage: number;
  vehicleA: VehicleMotion;
  vehicleB: VehicleMotion;
  pedestrian: PedestrianMotion;
  vehicleSignal: SignalState;
  pedestrianSignal: PedestrianState;
  controller: ControllerMotionState;
  pathTone: "blue" | "amber" | "red" | "green";
  effect: MotionEffect;
  routeClear: boolean;
  activeSensor: "approach" | "speed" | "stop" | "crossing" | "conflict" | "clear";
  risk: "Normal" | "Caution" | "High" | "Emergency";
  action: string;
}

export interface MotionFrameTiming {
  durationMs: number;
  protectedWalkSecondsAtStart: number | null;
}

const A_START: VehicleMotion = { x: 8, lane: 68, heading: 0, speed: 0, state: "WAITING", label: "Vehicle A" };
const B_START: VehicleMotion = { x: 92, lane: 32, heading: 180, speed: 0, state: "WAITING", label: "Vehicle B" };
const PED_START: PedestrianMotion = { progress: 0, state: "WAITING", kind: "adult" };
const A_STOP_MARK = 34;
const B_STOP_MARK = 66;

function vehicle(base: VehicleMotion, patch: Partial<VehicleMotion> = {}): VehicleMotion {
  return { ...base, ...patch };
}

function pedestrian(patch: Partial<PedestrianMotion> = {}): PedestrianMotion {
  return { ...PED_START, ...patch };
}

function baseFrames(): MotionFrame[] {
  return Array.from({ length: MOTION_FRAME_COUNT }, (_, index) => ({
    timelineStage: MOTION_STAGE_BY_FRAME[index],
    vehicleA: vehicle(A_START),
    vehicleB: vehicle(B_START),
    pedestrian: pedestrian(),
    vehicleSignal: index >= 2 ? "STOP" : index === 1 ? "AMBER" : "GO",
    pedestrianSignal: "WAIT",
    controller: index < 2 ? "DETECTION" : index === 2 ? "VERIFICATION" : index === 3 ? "HOLD" : index < 6 ? "OUTCOME" : "RESET",
    pathTone: index < 2 ? "blue" : index === 2 ? "amber" : "red",
    effect: "none",
    routeClear: false,
    activeSensor: index === 0 ? "approach" : index === 1 ? "speed" : index === 2 ? "stop" : index < 5 ? "conflict" : index === 5 ? "crossing" : "clear",
    risk: "Normal",
    action: "Actors remain at their assigned starting markers.",
  }));
}

function setFrame(frames: MotionFrame[], index: number, patch: Partial<MotionFrame>): void {
  frames[index] = { ...frames[index], ...patch };
}

function stoppedA(patch: Partial<VehicleMotion> = {}): VehicleMotion {
  return vehicle(A_START, { x: A_STOP_MARK, speed: 0, state: "STOPPED", ...patch });
}

function stoppedB(patch: Partial<VehicleMotion> = {}): VehicleMotion {
  return vehicle(B_START, { x: B_STOP_MARK, speed: 0, state: "STOPPED", ...patch });
}

function stoppedNearCrossing(actor: VehicleMotion, side: "a" | "b"): VehicleMotion {
  const hasClearedCrossing = side === "a" && actor.x > 59;
  return {
    ...actor,
    x: hasClearedCrossing ? B_STOP_MARK : side === "a" ? A_STOP_MARK : B_STOP_MARK,
    speed: 0,
    state: "STOPPED",
  };
}

function recoverableWalk(frames: MotionFrame[], kind: PedestrianMotion["kind"] = "adult"): void {
  const safeState = frames[4];
  setFrame(frames, 5, {
    vehicleA: safeState.vehicleA,
    vehicleB: safeState.vehicleB,
    pedestrian: pedestrian({ progress: 100, state: "COMPLETED", kind }),
    vehicleSignal: "STOP",
    pedestrianSignal: "WALK",
    controller: "WALK",
    pathTone: "green",
    effect: safeState.effect,
    routeClear: true,
    action: "The pedestrian reaches the opposite kerb while both traffic approaches remain stopped.",
  });
  setFrame(frames, 6, {
    vehicleA: safeState.vehicleA,
    vehicleB: safeState.vehicleB,
    pedestrian: pedestrian({ progress: 100, state: "COMPLETED", kind }),
    vehicleSignal: "STOP",
    pedestrianSignal: "WAIT",
    controller: "OUTCOME",
    pathTone: "green",
    effect: safeState.effect,
    routeClear: true,
    action: "Protected WALK ends and the completed recovery sequence is stored in the local event log.",
  });
}

function applyContinuousPedestrianWalk(frames: MotionFrame[]): MotionFrame[] {
  let index = 0;

  while (index < frames.length) {
    if (frames[index].pedestrianSignal !== "WALK" || !frames[index].routeClear) {
      index += 1;
      continue;
    }

    const walkStart = index;
    while (index + 1 < frames.length && frames[index + 1].pedestrianSignal === "WALK" && frames[index + 1].routeClear) {
      index += 1;
    }
    const walkEnd = index;
    const startProgress = walkStart === 0 ? frames[walkStart].pedestrian.progress : frames[walkStart - 1].pedestrian.progress;
    const endProgress = frames[walkEnd].pedestrian.progress;
    const walkStageCount = walkEnd - walkStart + 1;

    if (endProgress > startProgress) {
      for (let walkIndex = walkStart; walkIndex <= walkEnd; walkIndex += 1) {
        const stageNumber = walkIndex - walkStart + 1;
        frames[walkIndex] = {
          ...frames[walkIndex],
          pedestrian: {
            ...frames[walkIndex].pedestrian,
            progress: startProgress + ((endProgress - startProgress) * stageNumber) / walkStageCount,
          },
        };
      }
    }

    index += 1;
  }

  return frames;
}

function safeBaseline(): MotionFrame[] {
  const frames = baseFrames();
  setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 18, speed: 22, state: "APPROACHING" }), vehicleB: vehicle(B_START, { x: 82, speed: 22, state: "APPROACHING" }), action: "Both opposing vehicles approach at a safe baseline speed while the pedestrian waits behind the kerb." });
  setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 24, speed: 12, state: "BRAKING" }), vehicleB: vehicle(B_START, { x: 76, speed: 12, state: "BRAKING" }), vehicleSignal: "AMBER", action: "Pedestrian demand is registered and both vehicles begin coordinated deceleration before their stop lines." });
  setFrame(frames, 2, { vehicleA: stoppedA({ state: "BRAKING" }), vehicleB: stoppedB({ state: "BRAKING" }), vehicleSignal: "STOP", action: "Bidirectional radar and stop-line sensing confirm both tracks slowing without entering the crossing." });
  setFrame(frames, 3, { vehicleA: stoppedA({ state: "YIELDING" }), vehicleB: stoppedB({ state: "YIELDING" }), vehicleSignal: "STOP", controller: "HOLD", pathTone: "green", routeClear: true, action: "Both vehicles come to a complete stop before the stop lines; the controller verifies both stops while the traffic signals display RED." });
  setFrame(frames, 4, { vehicleA: stoppedA({ state: "YIELDING" }), vehicleB: stoppedB({ state: "YIELDING" }), pedestrian: pedestrian({ progress: 38, state: "WALKING" }), vehicleSignal: "STOP", pedestrianSignal: "WALK", controller: "WALK", pathTone: "green", routeClear: true, action: "No conflict is created; WALK starts only after both opposing lanes are held at RED." });
  setFrame(frames, 5, { vehicleA: stoppedA({ state: "YIELDING" }), vehicleB: stoppedB({ state: "YIELDING" }), pedestrian: pedestrian({ progress: 100, state: "COMPLETED" }), vehicleSignal: "STOP", pedestrianSignal: "WALK", controller: "WALK", pathTone: "green", routeClear: true, action: "The pedestrian crosses continuously while both vehicles remain stationary at RED." });
  setFrame(frames, 6, { vehicleA: vehicle(A_START, { x: 94, speed: 0, state: "CLEARED" }), vehicleB: vehicle(B_START, { x: 22, speed: 0, state: "CLEARED" }), pedestrian: pedestrian({ progress: 100, state: "COMPLETED" }), vehicleSignal: "GO", pedestrianSignal: "WAIT", controller: "OUTCOME", pathTone: "green", routeClear: true, action: "After the pedestrian clears the route, both vehicles move beyond the crossing. WALK returns to WAIT, and no incident is recorded." });
  return applyContinuousPedestrianWalk(frames);
}

function violationFrames(slug: string, mode: CrossingMode): MotionFrame[] {
  const frames = baseFrames();
  const approachA = (x = 30, speed = 28, lane = 68) => vehicle(A_START, { x, speed, lane, state: "APPROACHING" });
  const holdB = stoppedB();

  switch (slug) {
    case "failure-to-stop-or-give-way":
      setFrame(frames, 0, { vehicleA: approachA(30, 26), vehicleB: holdB, pedestrian: pedestrian({ state: "WAITING" }), effect: "conflict", action: "Vehicle A approaches while a pedestrian waits behind the kerb at the marked route." });
      setFrame(frames, 1, { vehicleA: approachA(46, 38), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "AMBER", pedestrianSignal: "WAIT", effect: "conflict", pathTone: "red", action: "Pedestrian demand is visible, but Vehicle A maintains its approach instead of yielding." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 47, speed: 18, state: "BRAKING" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), effect: "conflict", action: "Vehicle A brakes before the pedestrian conflict point; Vehicle B remains stopped and the pedestrian stays behind the kerb." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 48, speed: 0, state: "STOPPED" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "STOP_ALL", effect: "conflict", action: "The controller stops all actors and withholds WALK pending human review." });
      break;
    case "crossing-zone-speeding":
      setFrame(frames, 0, { vehicleA: approachA(28, 24), vehicleB: holdB, effect: "speed", action: "Vehicle A approaches normally while the pedestrian waits." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 50, speed: mode === "school" ? 48 : 58, state: "ACCELERATING" }), vehicleB: holdB, effect: "speed", pathTone: "red", action: "Vehicle A accelerates above the configured limit inside the speed zone." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 66, speed: 34, state: "BRAKING" }), vehicleB: holdB, effect: "speed", action: "High speed is verified; Vehicle A clears the crossing zone and decelerates." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 82, speed: 12, state: "CLEARED" }), vehicleB: holdB, controller: "CAUTION", effect: "speed", routeClear: true, action: "The caution response remains active; Vehicle B and the pedestrian stay held until the zone is clear." });
      break;
    case "red-signal-violation":
      setFrame(frames, 0, { vehicleA: approachA(8, 18), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "STOP", effect: "red-light", action: "Vehicle A begins at its approach marker while the signal is already red and the pedestrian remains on HOLD." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 34, speed: 25, state: "APPROACHING" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "STOP", effect: "red-light", pathTone: "red", action: "Vehicle A continues smoothly towards stop line A despite the red signal." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 52, speed: 28, state: "ACCELERATING" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "STOP", effect: "red-light", pathTone: "red", action: "Vehicle A breaches stop line A and moves continuously through the zebra crossing on red." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 64, speed: 20, state: "APPROACHING" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "STOP", controller: "STOP_ALL", effect: "red-light", pathTone: "red", routeClear: true, action: "After Vehicle A clears the full restricted crossing area, the red-signal violation is detected and recorded." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: 78, speed: 10, state: "BRAKING" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "HOLD", effect: "red-light", routeClear: true, action: "Vehicle A decelerates only on the far side while the pedestrian remains held pending route verification." });
      setFrame(frames, 5, { vehicleA: vehicle(A_START, { x: 88, speed: 0, state: "CLEARED" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "HOLD", effect: "red-light", routeClear: true, action: "Vehicle A settles beyond the crossing and both the controller and event log retain the confirmed breach." });
      setFrame(frames, 6, { vehicleA: vehicle(A_START, { x: 88, speed: 0, state: "CLEARED" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "OUTCOME", effect: "red-light", routeClear: true, action: "The red-signal sequence ends with the crossing clear, WALK withheld and the local record ready for human review." });
      break;
    case "stopped-or-parked-on-crossing":
      setFrame(frames, 0, { vehicleA: approachA(32, 12), vehicleB: holdB, effect: "crossing-blocked", action: "Vehicle A enters the crossing at low speed." });
      for (let index = 1; index < MOTION_FRAME_COUNT; index += 1) {
        setFrame(frames, index, {
          vehicleA: vehicle(A_START, { x: 50, speed: 0, state: "BLOCKING" }),
          vehicleB: holdB,
          pedestrian: pedestrian({ progress: 0, state: "HOLD" }),
          vehicleSignal: "STOP",
          pedestrianSignal: "WAIT",
          controller: index < 3 ? "STOP_ALL" : "HOLD",
          effect: "crossing-blocked",
          pathTone: "red",
          routeClear: false,
          action: index === 1
            ? "Vehicle A stops across the zebra and blocks the pedestrian route."
            : index === 2
              ? "Crossing occupancy and the stationary obstruction are verified without moving Vehicle A."
              : "Vehicle A remains fixed in the blocked position; WALK stays withheld until the obstruction is removed manually.",
        });
      }
      break;
    case "accessible-route-blocked":
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 8, lane: 68, speed: 0, state: "WAITING", label: "Vehicle A" }), vehicleB: holdB, pedestrian: pedestrian({ kind: "wheelchair", state: "HOLD" }), effect: "accessible-blocked", action: "Vehicle A begins at its marker while a wheelchair user waits behind the tactile kerb route." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 30, lane: 78, speed: 10, state: "APPROACHING", label: "Vehicle A" }), vehicleB: holdB, pedestrian: pedestrian({ kind: "wheelchair", state: "HOLD" }), effect: "accessible-blocked", pathTone: "amber", action: "Vehicle A moves smoothly from the road approach towards the accessible route." });
      for (let index = 2; index < MOTION_FRAME_COUNT; index += 1) {
        setFrame(frames, index, {
          vehicleA: vehicle(A_START, { x: 44, lane: 88, speed: 0, state: "BLOCKING", label: "Vehicle A" }),
          vehicleB: holdB,
          pedestrian: pedestrian({ progress: 0, kind: "wheelchair", state: "HOLD" }),
          vehicleSignal: "STOP",
          pedestrianSignal: "WAIT",
          controller: index < 4 ? "STOP_ALL" : "HOLD",
          effect: "accessible-blocked",
          pathTone: "red",
          routeClear: false,
          action: index === 2
            ? "Vehicle A stops over the accessible route; the vehicle, STOP indicator and blocked route turn red."
            : index === 3
              ? "The stationary kerb-ramp obstruction is verified and recorded as an accessibility obstruction."
              : "Vehicle A remains stationary on the accessible route; the wheelchair user stays on HOLD until a manual reset.",
        });
      }
      break;
    case "motorcycle-filtering-at-crossing":
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 18, lane: 52, speed: 20, state: "APPROACHING", label: "Motorcycle A" }), vehicleB: holdB, effect: "filtering", action: "Motorcycle A begins filtering forward between a stationary queue while Vehicle B waits." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 32, lane: 52, speed: 24, state: "APPROACHING", label: "Motorcycle A" }), vehicleB: holdB, effect: "filtering", pathTone: "red", action: "Motorcycle A continues forwards through the queue towards the crossing approach." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 44, lane: 52, speed: 22, state: "APPROACHING", label: "Motorcycle A" }), vehicleB: holdB, effect: "filtering", pathTone: "red", action: "The filtered motorcycle reaches the zebra edge without reversing or changing travel direction." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 52, lane: 52, speed: 20, state: "APPROACHING", label: "Motorcycle A" }), vehicleB: holdB, controller: "STOP_ALL", effect: "filtering", pathTone: "red", action: "Motorcycle A proceeds across the zebra while the pedestrian remains held on WAIT." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: 64, lane: 52, speed: 18, state: "APPROACHING", label: "Motorcycle A" }), vehicleB: holdB, controller: "HOLD", effect: "filtering", pathTone: "red", action: "Motorcycle A clears the zebra in one continuous forward movement." });
      setFrame(frames, 5, { vehicleA: vehicle(A_START, { x: 78, lane: 52, speed: 12, state: "CLEARED", label: "Motorcycle A" }), vehicleB: holdB, controller: "HOLD", effect: "filtering", routeClear: true, action: "The filtered motorcycle decelerates only after clearing the crossing." });
      setFrame(frames, 6, { vehicleA: vehicle(A_START, { x: 88, lane: 52, speed: 0, state: "CLEARED", label: "Motorcycle A" }), vehicleB: holdB, controller: "OUTCOME", effect: "filtering", routeClear: true, action: "Motorcycle A settles beyond the crossing and the completed forward track remains available for review." });
      break;
    case "motorcycle-in-pedestrian-area":
      if (mode === "school") {
        const safeFrames = safeBaseline();
        const pedestrianFrames: PedestrianMotion[] = [
          pedestrian({ kind: "child", progress: 0, state: "WAITING" }),
          pedestrian({ kind: "child", progress: 5, state: "PAUSED" }),
          pedestrian({ kind: "child", progress: 5, state: "PAUSED" }),
          pedestrian({ kind: "child", progress: 5, state: "HOLD" }),
          pedestrian({ kind: "child", progress: 38, state: "WALKING" }),
          pedestrian({ kind: "child", progress: 100, state: "COMPLETED" }),
          pedestrian({ kind: "child", progress: 100, state: "COMPLETED" }),
        ];
        const actions = [
          "Both vehicles begin the normal safe approach while the pupil waits inside the protected school waiting area.",
          "Before WALK, the pupil takes a visible premature step towards the zebra edge and pauses when the WAIT reminder activates.",
          "Both vehicles continue the normal coordinated braking sequence while the pupil remains paused before the zebra line.",
          "Both vehicles stop exactly as in the No Violation sequence; the pupil is held inside the waiting area while the controller verifies the route.",
          "Protected WALK begins only after both vehicle stops are confirmed, and the pupil then enters the zebra.",
          "The pupil completes the protected crossing while both vehicles remain stationary at RED.",
          "After the pupil clears the route, the normal vehicle release completes and the premature-movement event remains recorded for review.",
        ];
        for (let index = 0; index < MOTION_FRAME_COUNT; index += 1) {
          frames[index] = {
            ...safeFrames[index],
            pedestrian: pedestrianFrames[index],
            effect: "pedestrian-intrusion",
            action: actions[index],
          };
        }
        break;
      }
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 28, lane: 68, speed: 20, state: "APPROACHING", label: "Motorcycle A" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", effect: "pedestrian-intrusion", action: "Motorcycle A approaches the edge of the pedestrian facility while every pedestrian remains held." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 47, lane: 48, speed: 14, state: "APPROACHING", label: "Motorcycle A" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), effect: "pedestrian-intrusion", pathTone: "red", action: "Motorcycle A enters the pedestrian area while the pedestrian remains behind the kerb on WAIT." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 58, lane: 48, speed: 6, state: "BRAKING", label: "Motorcycle A" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), effect: "pedestrian-intrusion", action: "The controller issues a STOP command for the motorcycle and keeps the pedestrian stationary." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: B_STOP_MARK, lane: 68, speed: 0, state: "STOPPED", label: "Motorcycle A" }), vehicleB: stoppedB(), pedestrian: pedestrian({ progress: 0, state: "HOLD" }), controller: "HOLD", effect: "pedestrian-intrusion", routeClear: true, action: "Motorcycle A clears the conflict zone and settles at the far stop line while pedestrian WALK remains withheld." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: B_STOP_MARK, lane: 68, speed: 0, state: "STOPPED", label: "Motorcycle A" }), vehicleB: stoppedB(), pedestrian: pedestrian({ progress: 68, state: "WALKING" }), vehicleSignal: "STOP", pedestrianSignal: "WALK", controller: "WALK", pathTone: "green", effect: "pedestrian-intrusion", routeClear: true, action: "Motorcycle A stops at the far stop line, and Vehicle B stops at its opposing stop line before the pedestrian receives WALK." });
      recoverableWalk(frames);
      break;
    case "overtook-yielding-vehicle":
      setFrame(frames, 0, { vehicleA: stoppedA({ state: "YIELDING", label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 15, lane: 68, heading: 0, speed: 26, state: "APPROACHING", label: "Following Vehicle B" }), pedestrian: pedestrian({ progress: 0, state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", effect: "overtaking", action: "The lead vehicle yields while the following vehicle approaches from behind and the pedestrian stays at the kerb." });
      setFrame(frames, 1, { vehicleA: stoppedA({ state: "YIELDING", label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 30, lane: 52, heading: 0, speed: 30, state: "ACCELERATING", label: "Following Vehicle B" }), pedestrian: pedestrian({ progress: 0, state: "HOLD" }), effect: "overtaking", pathTone: "red", action: "The following vehicle moves out to pass the yielding vehicle without a dotted trajectory overlay." });
      setFrame(frames, 2, { vehicleA: stoppedA({ state: "YIELDING", label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 42, lane: 35, heading: 0, speed: 32, state: "ACCELERATING", label: "Following Vehicle B" }), pedestrian: pedestrian({ progress: 0, state: "HOLD" }), effect: "overtaking", action: "The overtaking vehicle reaches the crossing approach while WALK remains withheld." });
      setFrame(frames, 3, { vehicleA: stoppedA({ state: "YIELDING", label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 52, lane: 35, heading: 0, speed: 26, state: "APPROACHING", label: "Following Vehicle B" }), pedestrian: pedestrian({ progress: 0, state: "HOLD" }), controller: "STOP_ALL", effect: "overtaking", action: "The following vehicle passes through the crossing zone while the lead vehicle remains yielded." });
      setFrame(frames, 4, { vehicleA: stoppedA({ state: "YIELDING", label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 64, lane: 35, heading: 0, speed: 20, state: "APPROACHING", label: "Following Vehicle B" }), pedestrian: pedestrian({ progress: 0, state: "HOLD" }), controller: "HOLD", effect: "overtaking", action: "The overtaking vehicle clears the zebra and begins returning to its lane." });
      setFrame(frames, 5, { vehicleA: stoppedA({ state: "YIELDING", label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 76, lane: 52, heading: 0, speed: 12, state: "CLEARED", label: "Following Vehicle B" }), pedestrian: pedestrian({ progress: 0, state: "HOLD" }), controller: "HOLD", effect: "overtaking", routeClear: true, action: "The following vehicle completes its pass beyond the protected crossing." });
      setFrame(frames, 6, { vehicleA: stoppedA({ state: "YIELDING", label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 88, lane: 68, heading: 0, speed: 0, state: "CLEARED", label: "Following Vehicle B" }), pedestrian: pedestrian({ progress: 0, state: "HOLD" }), controller: "OUTCOME", effect: "overtaking", routeClear: true, action: "The following vehicle settles in its lane; the pedestrian remains held because no WALK phase was issued." });
      break;
    case "driving-wrong-direction":
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 78, lane: 68, heading: 180, speed: 24, state: "WRONG_WAY" }), vehicleB: holdB, effect: "wrong-way", action: "Vehicle A starts against the configured lane direction." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 60, lane: 68, heading: 180, speed: 22, state: "WRONG_WAY" }), vehicleB: holdB, effect: "wrong-way", pathTone: "red", action: "The direction indicator turns red as Vehicle A travels towards the crossing." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 58, lane: 68, heading: 180, speed: 0, state: "STOPPED" }), vehicleB: holdB, effect: "wrong-way", action: "Vehicle A brakes without reversing before the crossing centre; all other actors remain held." });
      break;
    case "opposing-lane-queue-bypass":
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 20, lane: 68, speed: 20, state: "APPROACHING" }), vehicleB: holdB, effect: "queue-bypass", action: "Vehicle A leaves its queue and enters the opposing lane." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 42, lane: 30, speed: 28, state: "ACCELERATING" }), vehicleB: holdB, effect: "queue-bypass", pathTone: "red", action: "Vehicle A bypasses the queue in the opposing lane." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 50, lane: 30, speed: 24, state: "APPROACHING" }), vehicleB: holdB, effect: "queue-bypass", pathTone: "red", action: "Vehicle A continues through the crossing approach in the opposing lane while WALK remains held." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 60, lane: 38, speed: 18, state: "APPROACHING" }), vehicleB: holdB, controller: "CAUTION", effect: "queue-bypass", action: "Vehicle A clears the zebra and begins merging back without reversing." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: 70, lane: 52, speed: 14, state: "CLEARED" }), vehicleB: holdB, controller: "HOLD", effect: "queue-bypass", routeClear: true, action: "Vehicle A continues forward beyond the crossing while returning to its lane." });
      setFrame(frames, 5, { vehicleA: vehicle(A_START, { x: 80, lane: 64, speed: 8, state: "CLEARED" }), vehicleB: holdB, controller: "HOLD", effect: "queue-bypass", routeClear: true, action: "The queue-bypass track stabilises in the assigned lane beyond the protected area." });
      setFrame(frames, 6, { vehicleA: vehicle(A_START, { x: 86, lane: 68, speed: 0, state: "CLEARED" }), vehicleB: holdB, controller: "OUTCOME", effect: "queue-bypass", routeClear: true, action: "Vehicle A settles after completing the forward bypass and merge trajectory." });
      break;
    case "unsafe-lane-change-near-crossing":
      setFrame(frames, 0, { vehicleA: approachA(18, 24, 68), vehicleB: holdB, effect: "lane-change", action: "Vehicle A approaches in its assigned lane." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 30, lane: 58, speed: 26, state: "APPROACHING" }), vehicleB: holdB, effect: "lane-change", pathTone: "red", action: "Vehicle A starts changing lanes inside the protected approach without a dotted trajectory overlay." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 40, lane: 44, speed: 28, state: "APPROACHING" }), vehicleB: holdB, effect: "lane-change", action: "Vehicle A crosses the lane boundary near the zebra while the pedestrian remains held." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 50, lane: 34, speed: 24, state: "APPROACHING" }), vehicleB: holdB, controller: "CAUTION", effect: "lane-change", action: "The lane change continues through the crossing zone under a CAUTION response." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: 62, lane: 34, speed: 18, state: "APPROACHING" }), vehicleB: holdB, controller: "HOLD", effect: "lane-change", action: "Vehicle A clears the zebra in the adjacent lane." });
      setFrame(frames, 5, { vehicleA: vehicle(A_START, { x: 75, lane: 50, speed: 12, state: "CLEARED" }), vehicleB: holdB, controller: "HOLD", effect: "lane-change", routeClear: true, action: "Vehicle A returns towards its assigned lane beyond the protected crossing." });
      setFrame(frames, 6, { vehicleA: vehicle(A_START, { x: 86, lane: 68, speed: 0, state: "CLEARED" }), vehicleB: holdB, controller: "OUTCOME", effect: "lane-change", routeClear: true, action: "Vehicle A settles after the completed unsafe lane-change track is stored for review." });
      break;
    case "possible-distracted-driving":
      setFrame(frames, 0, { vehicleA: approachA(26, 24), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "possible-distraction", action: "Vehicle A approaches normally while pedestrian demand remains visible behind the kerb." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 37, lane: 58, speed: 24, state: "APPROACHING" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "possible-distraction", action: "Vehicle A begins an uncertain wandering response inside the protected approach." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 43, lane: 46, speed: 18, state: "BRAKING" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "possible-distraction", pathTone: "amber", action: "Privacy-filtered classification flags possible distraction; the classification remains unverified." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 45, lane: 40, speed: 8, state: "BRAKING" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "possible-distraction", pathTone: "red", controller: "CAUTION", action: "The delayed lane response continues near the stop line, increasing risk while WALK remains held." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: 46, lane: 40, speed: 0, state: "STOPPED" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "possible-distraction", pathTone: "red", controller: "STOP_ALL", action: "Vehicle A reaches the protected approach and stops without reversing before entering the pedestrian route." });
      setFrame(frames, 5, { vehicleA: vehicle(A_START, { x: 68, lane: 68, speed: 12, state: "CLEARED" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "possible-distraction", controller: "HOLD", action: "The controller preserves the uncertain track for mandatory human verification without declaring an offence." });
      setFrame(frames, 6, { vehicleA: vehicle(A_START, { x: 84, lane: 68, speed: 0, state: "CLEARED" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "possible-distraction", routeClear: true, controller: "OUTCOME", action: "Vehicle A stabilises beyond the protected zone; the record remains labelled possible and unconfirmed." });
      break;
    case "tailgating-near-stop-line":
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 20, lane: 68, speed: 16, state: "BRAKING", label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 8, lane: 68, heading: 0, speed: 24, state: "APPROACHING", label: "Following Vehicle B" }), effect: "tailgating", action: "Lead Vehicle A begins braking; Vehicle B follows too closely." });
      setFrame(frames, 1, { vehicleA: stoppedA({ label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 16, lane: 68, heading: 0, speed: 18, state: "BRAKING", label: "Following Vehicle B" }), effect: "tailgating", pathTone: "red", action: "Vehicle B closes the gap and the following-distance marker turns red." });
      setFrame(frames, 2, { vehicleA: stoppedA({ label: "Lead Vehicle A" }), vehicleB: vehicle(B_START, { x: 20, lane: 68, heading: 0, speed: 0, state: "STOPPED", label: "Following Vehicle B" }), effect: "tailgating", action: "Vehicle B stops closely behind Vehicle A without collision or reverse movement." });
      break;
    case "aggressive-acceleration-or-braking":
      setFrame(frames, 0, { vehicleA: approachA(8, 22), vehicleB: holdB, effect: "hard-braking", action: "Vehicle A begins its approach at normal speed with the crossing still ahead." });
      setFrame(frames, 1, { vehicleA: approachA(15, 30), vehicleB: holdB, effect: "hard-braking", action: "Vehicle A continues approaching and closes on the controlled stop-line area." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 20, speed: 42, state: "ACCELERATING" }), vehicleB: holdB, effect: "hard-braking", pathTone: "red", action: "Vehicle A accelerates aggressively near stop line A and triggers the risk response." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 23, speed: 20, state: "BRAKING" }), vehicleB: holdB, controller: "STOP_ALL", effect: "hard-braking", pathTone: "red", action: "Emergency braking engages before the vehicle reaches the crossing line." });
      setFrame(frames, 4, { vehicleA: stoppedA(), vehicleB: holdB, controller: "HOLD", effect: "hard-braking", pathTone: "red", action: "Vehicle A reaches zero at stop line A without reversing or entering the zebra crossing." });
      setFrame(frames, 5, { vehicleA: stoppedA(), vehicleB: holdB, controller: "HOLD", effect: "hard-braking", action: "Vehicle A remains stopped at the crossing line while the hard-braking event is reviewed." });
      setFrame(frames, 6, { vehicleA: stoppedA(), vehicleB: holdB, controller: "OUTCOME", effect: "hard-braking", action: "The sequence ends with Vehicle A stationary at stop line A and the pedestrian WALK signal withheld." });
      break;
    case "unsafe-u-turn-near-crossing":
      setFrame(frames, 0, { vehicleA: approachA(20, 20, 68), vehicleB: holdB, effect: "u-turn", action: "Vehicle A approaches the crossing from the left at the start of the marked turning path." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 34, lane: 68, heading: 0, speed: 18, state: "APPROACHING" }), vehicleB: holdB, effect: "u-turn", pathTone: "red", action: "Vehicle A follows the first section of the dotted U-turn path towards the crossing." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 44, lane: 63, heading: 0, speed: 14, state: "TURNING" }), vehicleB: holdB, effect: "u-turn", pathTone: "red", action: "Vehicle A enters the curved portion of the dotted path while its icon keeps the original front-facing orientation." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 49, lane: 51, heading: 0, speed: 10, state: "TURNING" }), vehicleB: holdB, controller: "STOP_ALL", effect: "u-turn", pathTone: "red", action: "Vehicle A reaches the apex of the marked U-turn arc without rotating the vehicle icon." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: 44, lane: 40, heading: 0, speed: 10, state: "TURNING" }), vehicleB: holdB, controller: "STOP_ALL", effect: "u-turn", pathTone: "red", action: "Vehicle A continues around the same dotted arc with a consistent front-facing icon." });
      setFrame(frames, 5, { vehicleA: vehicle(A_START, { x: 34, lane: 34, heading: 0, speed: 12, state: "TURNING" }), vehicleB: holdB, controller: "HOLD", effect: "u-turn", pathTone: "red", routeClear: true, action: "Vehicle A exits the curve along the return section while maintaining the original icon orientation." });
      setFrame(frames, 6, { vehicleA: vehicle(A_START, { x: 20, lane: 32, heading: 0, speed: 0, state: "CLEARED" }), vehicleB: holdB, controller: "OUTCOME", effect: "u-turn", pathTone: "red", routeClear: true, action: "Vehicle A completes the U-turn path with its front-facing icon unchanged." });
      break;
    case "failed-to-yield-vulnerable-pedestrian":
      setFrame(frames, 0, { vehicleA: approachA(12, 28), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "VULNERABLE_PRIORITY", kind: mode === "school" ? "child" : "elderly" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", effect: "vulnerable-user", action: "Vehicle A approaches while a vulnerable pedestrian waits inside the protected demand zone." });
      setFrame(frames, 1, { vehicleA: approachA(18, 22), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD", kind: mode === "school" ? "child" : "elderly" }), effect: "vulnerable-user", pathTone: "red", action: "The priority marker activates while Vehicle A begins slowing and the pedestrian remains on WAIT." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 22, speed: 12, state: "BRAKING" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD", kind: mode === "school" ? "child" : "elderly" }), effect: "vulnerable-user", pathTone: "red", action: "Vehicle A brakes before the red danger marker nearest the crossing line." });
      setFrame(frames, 3, { vehicleA: stoppedA(), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD", kind: mode === "school" ? "child" : "elderly" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "HOLD", pathTone: "red", effect: "vulnerable-user", action: "Vehicle A reaches zero near stop line A before the crossing while the vulnerable pedestrian still waits." });
      setFrame(frames, 4, { vehicleA: stoppedA(), vehicleB: holdB, pedestrian: pedestrian({ progress: 64, state: "VULNERABLE_PRIORITY", kind: mode === "school" ? "child" : "elderly" }), vehicleSignal: "STOP", pedestrianSignal: "WALK", controller: "WALK", pathTone: "green", effect: "vulnerable-user", routeClear: true, action: "Priority WALK begins only after both vehicles are confirmed stopped near their red stop lines." });
      recoverableWalk(frames, mode === "school" ? "child" : "elderly");
      break;
    case "exceeded-school-zone-speed-limit":
      setFrame(frames, 0, { vehicleA: approachA(18, SCHOOL_ZONE_SPEED_PROFILE.approachSpeed), vehicleB: holdB, pedestrian: pedestrian({ kind: "child", state: "HOLD" }), effect: "school-speed", action: "Vehicle A enters the marked school-zone boundary at 46 km/h, above the configured 30 km/h threshold." });
      setFrame(frames, 1, { vehicleA: approachA(34, SCHOOL_ZONE_SPEED_PROFILE.peakSpeed), vehicleB: holdB, pedestrian: pedestrian({ kind: "child", state: "HOLD" }), effect: "school-speed", pathTone: "red", action: "Vehicle A reaches the 50 km/h simulated peak while continuing towards the zebra crossing and school users remain at the kerb." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 48, speed: SCHOOL_ZONE_SPEED_PROFILE.detectionSpeed, state: "APPROACHING" }), vehicleB: holdB, pedestrian: pedestrian({ kind: "child", state: "HOLD" }), effect: "school-speed", pathTone: "red", action: "The school-zone violation is detected at 42 km/h as Vehicle A crosses the first zebra line before braking." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 60, speed: 24, state: "BRAKING" }), vehicleB: holdB, pedestrian: pedestrian({ kind: "child", state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "STOP_ALL", effect: "school-speed", pathTone: "red", action: "Vehicle A clears the full zebra and then brakes on the far side of the crossing." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: B_STOP_MARK, speed: 0, state: "STOPPED" }), vehicleB: stoppedB(), pedestrian: pedestrian({ kind: "child", state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "HOLD", pathTone: "green", effect: "school-speed", routeClear: true, action: "Vehicle A stops after the zebra crossing at the far stop line, and Vehicle B stops at its opposing stop line while the route is verified before WALK release." });
      recoverableWalk(frames, "child");
      break;
    case "parking-obstructed-sight-distance":
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 28, lane: 88, speed: 10, state: "APPROACHING", label: "Vehicle A" }), vehicleB: holdB, effect: "sight-obstruction", action: "Vehicle A pulls towards the kerb near the crossing." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 42, lane: 88, speed: 0, state: "BLOCKING", label: "Vehicle A" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "sight-obstruction", pathTone: "red", action: "Vehicle A parks inside the sight-distance triangle; visibility turns red." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 42, lane: 88, speed: 0, state: "BLOCKING", label: "Vehicle A" }), vehicleB: holdB, pedestrian: pedestrian({ state: "HOLD" }), effect: "sight-obstruction", action: "The obscured sightline and hidden pedestrian route are verified." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: B_STOP_MARK, lane: 88, speed: 0, state: "STOPPED", label: "Vehicle A" }), vehicleB: stoppedB(), pedestrian: pedestrian({ state: "HOLD" }), effect: "sight-obstruction", routeClear: true, action: "Vehicle A moves forwards out of the restricted area, visibility returns to normal, and Vehicle A stops at the far stop line before WALK." });
      setFrame(frames, 4, { vehicleA: vehicle(A_START, { x: B_STOP_MARK, lane: 88, speed: 0, state: "STOPPED", label: "Vehicle A" }), vehicleB: stoppedB(), pedestrian: pedestrian({ progress: 42, state: "WALKING" }), vehicleSignal: "STOP", pedestrianSignal: "WALK", controller: "WALK", pathTone: "green", effect: "sight-obstruction", routeClear: true, action: "Vehicle A and Vehicle B stop at their respective stop lines. After the sight distance is verified, the pedestrian begins crossing." });
      recoverableWalk(frames);
      break;
    case "collision-road-user-infrastructure":
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 30, lane: 68, speed: 30, state: "APPROACHING" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), effect: "collision", action: "Vehicle A approaches from the left lane while the pedestrian remains held behind the kerb." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 40, lane: 68, speed: 32, state: "APPROACHING" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), effect: "collision", action: "Vehicle A continues to the right along the blue tracked path towards the crossing infrastructure." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 57, lane: 108, heading: 62, speed: 8, state: "TURNING" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), effect: "collision", pathTone: "amber", action: "Vehicle A follows the blue curve down and right until it reaches the westbound traffic-light pole." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 57, lane: 108, heading: 62, speed: 0, state: "COLLISION" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "STOP_ALL", effect: "collision", pathTone: "red", action: "Vehicle A collides with the right-side westbound traffic-light pole; the vehicle and pedestrian remain stopped before the alarm stage." });
      for (let index = 4; index < MOTION_FRAME_COUNT; index += 1) setFrame(frames, index, { vehicleA: vehicle(A_START, { x: 57, lane: 108, heading: 62, speed: 0, state: "COLLISION" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "CRITICAL_ALARM", effect: "collision", pathTone: "red", action: index === 4 ? "The post-impact alarm activates and the red collision circle now marks the struck traffic-light pole." : index === 5 ? "Three short alarm tones continue and local mock notices are pinned for infrastructure review; no external dispatch occurs." : "Vehicle A remains frozen against the traffic-light pole and the Level 4 local record stays pinned until an authorised manual reset." });
      break;
    case "vehicle-fire-smoke-explosion":
      setFrame(frames, 0, { vehicleA: vehicle(A_START, { x: 28, speed: 26, state: "APPROACHING", label: "Vehicle A" }), vehicleB: holdB, effect: "fire", action: "Vehicle A approaches the crossing on the defined collision path while all pedestrians remain held." });
      setFrame(frames, 1, { vehicleA: vehicle(A_START, { x: 37, speed: 30, state: "APPROACHING", label: "Vehicle A" }), vehicleB: holdB, effect: "fire", action: "Vehicle A continues towards the conflict without adequate avoidance; pedestrian WALK remains held." });
      setFrame(frames, 2, { vehicleA: vehicle(A_START, { x: 44, speed: 22, state: "BRAKING", label: "Vehicle A" }), vehicleB: holdB, effect: "fire", pathTone: "amber", action: "Track convergence identifies a high-risk collision condition and preserves the anonymous evidence window." });
      setFrame(frames, 3, { vehicleA: vehicle(A_START, { x: 48, speed: 10, state: "BRAKING", label: "Vehicle A" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "STOP_ALL", effect: "fire", pathTone: "red", action: "The controller commands RED and keeps pedestrians on HOLD as Vehicle A enters the deliberate incident path." });
      for (let index = 4; index < MOTION_FRAME_COUNT; index += 1) setFrame(frames, index, { vehicleA: vehicle(A_START, { x: 50, heading: 12, speed: 0, state: "FIRE", label: "Vehicle A" }), vehicleB: holdB, pedestrian: pedestrian({ progress: 0, state: "HOLD" }), vehicleSignal: "STOP", pedestrianSignal: "WAIT", controller: "CRITICAL_ALARM", effect: "fire", pathTone: "red", action: index === 4 ? "A simulated impact occurs and fire activates after Vehicle A stops in the locked conflict zone." : index === 5 ? "Three short alarm tones, the accessible visual alarm, and local mock notification states activate for acknowledgement." : "Vehicle A and the fire remain frozen; the crossing stays closed and no external dispatch occurs until manual reset." });
      break;
  }

  for (let index = 1; index < MOTION_FRAME_COUNT; index += 1) {
    if (frames[index].action === "Actors remain at their assigned starting markers.") {
      const condition = frames[Math.max(0, index - 1)].effect.replaceAll("-", " ");
      setFrame(frames, index, {
        vehicleA: frames[Math.max(0, index - 1)].vehicleA,
        vehicleB: frames[Math.max(0, index - 1)].vehicleB,
        pedestrian: frames[Math.max(0, index - 1)].pedestrian,
        vehicleSignal: "STOP",
        pedestrianSignal: "WAIT",
        controller: frames[Math.max(0, index - 1)].controller === "CRITICAL_ALARM" ? "CRITICAL_ALARM" : index < 5 ? "STOP_ALL" : "OUTCOME",
        effect: frames[Math.max(0, index - 1)].effect,
        pathTone: frames[Math.max(0, index - 1)].pathTone,
        routeClear: frames[Math.max(0, index - 1)].routeClear,
        action: index === 3
          ? `The controller contains the ${condition} movement and keeps pedestrian release protected.`
          : index === 4
            ? `The ${condition} trajectory remains at its defined conflict state while pedestrian release stays protected.`
            : index === 5
              ? `The controller holds the safe state and queues the anonymous ${condition} track for authorised human review.`
              : `The ${condition} sequence ends in a stable state and its suspected record remains in the local audit trail.`,
      });
    }
  }

  const preservesSafeBaselineVehicles = mode === "school" && slug === "motorcycle-in-pedestrian-area";
  if (!preservesSafeBaselineVehicles) {
    let walkReleased = false;
    for (let index = 0; index < MOTION_FRAME_COUNT; index += 1) {
      walkReleased ||= frames[index].pedestrianSignal === "WALK";
      if (!walkReleased) continue;
      frames[index] = {
        ...frames[index],
        vehicleA: stoppedNearCrossing(frames[index].vehicleA, "a"),
        vehicleB: stoppedNearCrossing(frames[index].vehicleB, "b"),
        vehicleSignal: "STOP",
      };
    }
  }

  return applyContinuousPedestrianWalk(frames).map((frame, index) => {
    const emergency = frame.effect === "collision" || frame.effect === "fire";
    const activeSensor = index === 0 ? "approach" : index === 1 ? (frame.effect === "speed" || frame.effect === "school-speed" ? "speed" : "approach") : index === 2 ? (frame.effect === "red-light" || frame.effect === "crossing-blocked" ? "stop" : "crossing") : index < 5 ? "conflict" : index === 5 ? "crossing" : "clear";
    const risk = emergency && index >= 4 ? "Emergency" : index >= 3 && !frame.routeClear ? "High" : index >= 1 ? "Caution" : "Normal";
    const settledFrame = index === MOTION_FRAME_COUNT - 1
      ? {
          ...frame,
          vehicleA: { ...frame.vehicleA, speed: 0 },
          vehicleB: { ...frame.vehicleB, speed: 0 },
        }
      : frame;
    return { ...settledFrame, timelineStage: index, activeSensor, risk };
  });
}

export function motionSlugForScenario(scenarioId: string): string {
  return scenarioId.replace(/^(normal|school)-/, "");
}

export function motionFramesFor(scenarioId: string, mode: CrossingMode): MotionFrame[] {
  const slug = motionSlugForScenario(scenarioId);
  if (slug === "exceeded-school-zone-speed-limit" && mode !== "school") {
    throw new Error("School-zone speeding is available only for school crossings.");
  }
  return slug === "no-violation" ? safeBaseline() : violationFrames(slug, mode);
}

export function frameFor(scenarioId: string, mode: CrossingMode, frameIndex: number): MotionFrame {
  const safeIndex = Math.max(0, Math.min(MOTION_FRAME_COUNT - 1, frameIndex));
  return motionFramesFor(scenarioId, mode)[safeIndex];
}

export function motionTimingsFor(scenarioId: string, mode: CrossingMode): MotionFrameTiming[] {
  const frames = motionFramesFor(scenarioId, mode);
  const uTurn = motionSlugForScenario(scenarioId) === "unsafe-u-turn-near-crossing";
  const timings: MotionFrameTiming[] = frames.map(() => ({
    durationMs: uTurn ? U_TURN_MOTION_FRAME_MS : STANDARD_MOTION_FRAME_MS,
    protectedWalkSecondsAtStart: null,
  }));

  for (let index = 0; index < frames.length; index += 1) {
    if (frames[index].pedestrianSignal !== "WALK" || !frames[index].routeClear) continue;
    const start = index;
    while (index + 1 < frames.length && frames[index + 1].pedestrianSignal === "WALK" && frames[index + 1].routeClear) index += 1;
    const frameCount = index - start + 1;
    const frameDurationMs = (PROTECTED_WALK_SECONDS * 1_000) / frameCount;
    for (let walkIndex = start; walkIndex <= index; walkIndex += 1) {
      timings[walkIndex] = {
        durationMs: frameDurationMs,
        protectedWalkSecondsAtStart: Math.round(PROTECTED_WALK_SECONDS - ((walkIndex - start) * PROTECTED_WALK_SECONDS) / frameCount),
      };
    }
  }

  timings[MOTION_FRAME_COUNT - 1] = { ...timings[MOTION_FRAME_COUNT - 1], durationMs: 0 };
  return timings;
}

export function timingFor(scenarioId: string, mode: CrossingMode, frameIndex: number): MotionFrameTiming {
  const safeIndex = Math.max(0, Math.min(MOTION_FRAME_COUNT - 1, frameIndex));
  return motionTimingsFor(scenarioId, mode)[safeIndex];
}

export function idleFrame(): MotionFrame {
  return baseFrames()[0];
}
