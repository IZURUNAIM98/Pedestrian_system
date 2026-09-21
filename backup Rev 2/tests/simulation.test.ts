import { describe, expect, it } from "vitest";
import { assessConfidence, conditionQualityFor, deriveOperatingConditions, deriveSensorHealth, getProgress, runSimulation, SCENARIOS } from "@/lib/simulation";
import { createSimulationReportPdf } from "@/lib/pdf-report";
import { MOTION_FRAME_COUNT, motionFramesFor, motionTimingsFor, PROTECTED_WALK_SECONDS, SCHOOL_ZONE_SPEED_PROFILE, STANDARD_MOTION_FRAME_MS, U_TURN_MOTION_FRAME_MS, type MotionEffect } from "@/lib/motion";
import { TIMELINE_STAGES } from "@/lib/types";
import { assessCameraFallback, CAMERA_DEGRADATION_THRESHOLD, DEGRADED_PROTECTED_WALK_SECONDS } from "@/lib/camera-fallback";

function visiblePdfText(pdf: Uint8Array): string {
  return [...new TextDecoder().decode(pdf).matchAll(/\((.*)\) Tj/g)].map((match) => match[1].replaceAll("\\(", "(").replaceAll("\\)", ")")).join(" ");
}

const EXPECTED_EFFECTS: Array<[string, MotionEffect]> = [
  ["failure-to-stop-or-give-way", "conflict"],
  ["crossing-zone-speeding", "speed"],
  ["red-signal-violation", "red-light"],
  ["stopped-or-parked-on-crossing", "crossing-blocked"],
  ["accessible-route-blocked", "accessible-blocked"],
  ["motorcycle-filtering-at-crossing", "filtering"],
  ["motorcycle-in-pedestrian-area", "pedestrian-intrusion"],
  ["overtook-yielding-vehicle", "overtaking"],
  ["driving-wrong-direction", "wrong-way"],
  ["opposing-lane-queue-bypass", "queue-bypass"],
  ["unsafe-lane-change-near-crossing", "lane-change"],
  ["possible-distracted-driving", "possible-distraction"],
  ["tailgating-near-stop-line", "tailgating"],
  ["aggressive-acceleration-or-braking", "hard-braking"],
  ["unsafe-u-turn-near-crossing", "u-turn"],
  ["failed-to-yield-vulnerable-pedestrian", "vulnerable-user"],
  ["exceeded-school-zone-speed-limit", "school-speed"],
  ["parking-obstructed-sight-distance", "sight-obstruction"],
  ["collision-road-user-infrastructure", "collision"],
  ["vehicle-fire-smoke-explosion", "fire"],
];

function expectedEffectsFor(mode: "normal" | "school"): Array<[string, MotionEffect]> {
  return EXPECTED_EFFECTS.filter(([slug]) => mode === "school" || slug !== "exceeded-school-zone-speed-limit");
}

describe("deterministic crossing simulation", () => {
  it("keeps healthy-camera behavior outside the fallback branch", () => {
    const healthy = runSimulation({ mode: "normal", scenarioId: "normal-no-violation" }, new Date("2026-09-14T00:00:00Z"));
    expect(healthy.cameraFallback).toBeUndefined();
    expect(healthy.signal).toMatchObject({ vehicle: "STOP", pedestrian: "WALK" });
    expect(CAMERA_DEGRADATION_THRESHOLD).toBe(0.75);
  });

  it("latches a 60 percent degraded-camera request and completes a protected fallback", () => {
    const conditions = { weather: "rain", lighting: "night", visibility: "dense-haze" } as const;
    const result = runSimulation({ mode: "normal", scenarioId: "normal-no-violation", operatingConditions: conditions, manualCrossingRequest: true }, new Date("2026-09-14T00:00:00Z"));
    expect(result.operatingConditions.conditionQuality).toBe(0.6);
    expect(result.cameraFallback).toMatchObject({ active: true, requestState: "complete", protectedCrossingVerified: true });
    expect(result.signal).toMatchObject({ vehicle: "STOP", pedestrian: "WALK" });
    expect(result.eventLog.map((entry) => entry.message).join(" ")).toContain("minimum all-red clearance verified before WALK");
    expect(result.eventLog.at(-1)?.message).toContain("traffic returned to GREEN");
    expect(DEGRADED_PROTECTED_WALK_SECONDS).toBe(15);
  });

  it("uses the fixed protected fallback for every non-critical selected condition when AI input is unreliable", () => {
    const conditions = { weather: "rain", lighting: "night", visibility: "dense-haze" } as const;
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode) && item.severity !== "critical")) {
        const result = runSimulation({ mode, scenarioId: scenario.id, operatingConditions: conditions, manualCrossingRequest: true });
        expect(result.cameraFallback?.protectedCrossingVerified, scenario.id).toBe(true);
        expect(result.signal, scenario.id).toMatchObject({ vehicle: "STOP", pedestrian: "WALK" });
        const walkStages = result.timeline.filter((stage) => stage.detail.includes("pedestrian signal: WALK"));
        expect(walkStages.length, scenario.id).toBeGreaterThan(0);
        expect(walkStages.every((stage) => stage.detail.includes("vehicle signal: STOP")), scenario.id).toBe(true);
      }
    }
  });

  it("records duplicate degraded-camera requests without creating another cycle", () => {
    const conditions = deriveOperatingConditions({ weather: "rain", lighting: "night", visibility: "dense-haze" });
    expect(assessCameraFallback(conditions, true).requestState).toBe("latched");
    const result = runSimulation({ mode: "normal", scenarioId: "normal-no-violation", operatingConditions: conditions, manualCrossingRequest: true, duplicateButtonPresses: 2 });
    expect(result.cameraFallback?.duplicatePresses).toBe(2);
    expect(result.eventLog[1].message).toContain("2 duplicate presses ignored");
  });

  it("holds WALK when secondary sensors disagree or a critical scenario is active", () => {
    const conditions = { weather: "rain", lighting: "night", visibility: "dense-haze" } as const;
    const disagreement = runSimulation({ mode: "normal", scenarioId: "normal-no-violation", operatingConditions: conditions, manualCrossingRequest: true, secondarySafetyInputs: { radarClear: true, lidarClear: false, stopLinesClear: true, vehiclePresenceClear: true, controllerAvailable: true } });
    expect(disagreement.signal.pedestrian).toBe("WAIT");
    expect(disagreement.cameraFallback?.requestState).toBe("safety-hold");
    const critical = runSimulation({ mode: "normal", scenarioId: "normal-collision-road-user-infrastructure", operatingConditions: conditions, manualCrossingRequest: true });
    expect(critical.signal.pedestrian).toBe("WAIT");
    expect(critical.eventLog.some((entry) => entry.message.includes("Safety Hold"))).toBe(true);
  });

  it("returns to unchanged camera-driven behavior after recovery", () => {
    const recovered = runSimulation({ mode: "school", scenarioId: "school-no-violation", operatingConditions: { weather: "dry", lighting: "day", visibility: "clear" }, manualCrossingRequest: true });
    expect(recovered.cameraFallback).toBeUndefined();
    expect(recovered.signal).toMatchObject({ vehicle: "STOP", pedestrian: "WALK" });
  });
  it("creates seven ordered timestamped sequence stages and completes at 100%", () => {
    const result = runSimulation({ mode: "normal", scenarioId: "normal-no-violation" }, new Date("2026-08-19T00:00:00Z"));
    expect(result.timeline.map((stage) => stage.name)).toEqual(TIMELINE_STAGES);
    expect(result.timeline.every((stage) => Boolean(stage.timestamp))).toBe(true);
    expect(result.timeline.map((stage) => Date.parse(stage.timestamp))).toEqual([...result.timeline.map((stage) => Date.parse(stage.timestamp))].sort((a, b) => a - b));
    expect(getProgress(result.timeline)).toBe(100);
  });

  it("never gives WALK unless conflicting vehicles are stopped", () => {
    const result = runSimulation({ mode: "school", scenarioId: "school-no-violation" });
    expect(result.signal.pedestrian).toBe("WALK");
    expect(result.signal.vehicle).toBe("STOP");
  });

  it("provides 20 Normal conditions and 21 School conditions", () => {
    const normalLabels = [
      "Normal pedestrian crossing: no violation", "01. Failure to stop or give way", "02. Crossing-zone speeding", "03. Red-signal violation",
      "04. Stopped or parked on the crossing", "05. Accessible route blocked", "06. Motorcycle filtering at the crossing",
      "07. Motorcycle in the pedestrian area", "08. Overtaking a yielding vehicle", "09. Driving in the wrong direction",
      "10. Opposing-lane queue bypass", "11. Unsafe lane change near the crossing", "12. Possible distracted driving or phone use",
      "13. Tailgating near the stop line", "14. Aggressive acceleration or braking", "15. Unsafe U-turn near the crossing",
      "16. Failure to yield to a vulnerable pedestrian", "18. Parking obstructing sight distance",
      "19. Collision with a road user or infrastructure", "20. Vehicle fire, smoke, or explosion",
    ];
    const schoolLabels = [
      "School pedestrian crossing: no violation", "01. Crossing-zone speeding", "02. Red-signal violation", "03. Failure to yield",
      "04. Vehicle stopped on the zebra crossing", "05. Accessibility obstruction", "06. Motorcycle filtering",
      "07. Premature pedestrian movement", "08. Unsafe overtaking", "09. Wrong-way approach", "10. Opposing-lane bypass",
      "11. Unsafe lane change", "12. Tailgating", "13. Distracted or delayed driver response", "14. Emergency braking",
      "15. U-turn at the crossing", "16. Vulnerable pedestrian conflict", "17. School-zone violation",
      "18. Parking-related obstruction", "19. Collision event", "20. Vehicle fire event",
    ];
    for (const mode of ["normal", "school"] as const) {
      const options = SCENARIOS.filter((item) => item.supportedModes.includes(mode));
      expect(options).toHaveLength(mode === "normal" ? 20 : 21);
      expect(options[0]).toMatchObject({ id: `${mode}-no-violation`, violation: false });
      expect(options.slice(1).every((item) => item.violation)).toBe(true);
      expect(options.map((item) => item.label)).toEqual(mode === "school" ? schoolLabels : normalLabels);
      for (const option of options) {
        const result = runSimulation({ mode, scenarioId: option.id }, new Date("2026-08-19T00:00:00Z"));
        expect(result.timeline.map((stage) => stage.name)).toEqual(TIMELINE_STAGES);
        expect(result.eventLog).toHaveLength(MOTION_FRAME_COUNT);
      }
    }
  });

  it("creates simulated CCTV plate evidence for every violation in both modes only", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        const result = runSimulation({ mode, scenarioId: scenario.id }, new Date("2026-08-27T00:00:00Z"));
        if (scenario.violation) {
          expect(result.cctvEvidence).toMatchObject({ detectedCondition: scenario.label, captureStage: "Detected", status: "SIMULATED_CAPTURE" });
          expect(result.cctvEvidence?.cameraId).toBe(result.cctvEvidence?.vehicleDirection === "Eastbound" ? "CCTV EB-01" : "CCTV WB-01");
          expect(result.cctvEvidence?.plateNumber).toMatch(/^SCV2-[NS]\d{4}$/);
          expect(result.cctvEvidence?.capturedAt).toBe(result.timeline[2].timestamp);
          expect(["Eastbound", "Westbound"]).toContain(result.cctvEvidence?.vehicleDirection);
          expect(result.countermeasures).toHaveLength(3);
          expect(result.eventLog[2].message).toContain("no live ANPR lookup occurs");
        } else {
          expect(result.cctvEvidence).toBeNull();
          expect(result.countermeasures).toEqual([]);
        }
      }
    }
  });

  it("uses plain uppercase actor identifiers without attached decorative symbols", () => {
    for (const scenario of SCENARIOS) {
      const mode = scenario.supportedModes[0];
      const frames = motionFramesFor(scenario.id, mode);
      const result = runSimulation({ mode, scenarioId: scenario.id }, new Date("2026-08-19T00:00:00Z"));

      for (const label of frames.flatMap((frame) => [frame.vehicleA.label, frame.vehicleB.label])) {
        expect(label).toMatch(/^(?:Vehicle|Motorcycle|Lead Vehicle|Following Vehicle) [AB]$/);
        expect(label).not.toMatch(/[\u0028\u0029\u00b7\u2190\u2192\u2013\u2014]/u);
      }

      for (const entry of result.eventLog) {
        expect(entry.message).not.toMatch(/\b(?:Vehicle|Motorcycle) [AB]\s*[:\u0028\u0029\u00b7\u2190\u2192\u2013\u2014]/u);
      }

      for (const frame of frames) {
        expect(frame.action).not.toMatch(/\b(?:bus|van|red cross marks?)\b/i);
      }

      for (const stage of result.timeline) {
        expect(stage.detail).not.toMatch(/signal:\s*[A-Z]+\/[A-Z]+/);
      }
    }
  });

  it("flags a critical incident without automatic dispatch", () => {
    const result = runSimulation({ mode: "normal", scenarioId: "normal-collision-road-user-infrastructure" });
    expect(result.incident).toBe(true);
    expect(result.emergencyReviewRequired).toBe(true);
    expect(result.eventLog.at(-1)?.message).toContain("Human confirmation is required.");
  });

  it("counts only collision and fire as critical incidents and routes contextual mock recipients", () => {
    const high = runSimulation({ mode: "normal", scenarioId: "normal-red-signal-violation" });
    const collision = runSimulation({ mode: "normal", scenarioId: "normal-collision-road-user-infrastructure" });
    const fire = runSimulation({ mode: "school", scenarioId: "school-vehicle-fire-smoke-explosion" });
    expect(high).toMatchObject({ incident: false, emergencyReviewRequired: false, notificationRecipients: [] });
    expect(collision.notificationRecipients.map((recipient) => recipient.name)).toEqual([
      "MPAJ traffic operations review desk",
      "Royal Malaysia Police traffic liaison",
      "Emergency medical services liaison",
    ]);
    expect(fire.notificationRecipients.map((recipient) => recipient.name)).toEqual([
      "MPAJ traffic operations review desk",
      "Fire and Rescue Department liaison",
      "Emergency medical services liaison",
    ]);
  });

  it("applies deterministic adverse-condition confidence adjustments", () => {
    const result = runSimulation({
      mode: "school",
      scenarioId: "school-exceeded-school-zone-speed-limit",
      operatingConditions: { weather: "rain", lighting: "night", visibility: "clear" },
    });
    expect(result.operatingConditions).toEqual({ weather: "rain", lighting: "night", visibility: "clear", sensorHealth: "constrained", conditionQuality: 0.82 });
    expect(result.detectionConfidence).toBe(Number((result.scenario.confidence * 0.82).toFixed(2)));
    expect(result.cctvEvidence?.recognitionConfidence).toBe(Number((result.detectionConfidence - 0.03).toFixed(2)));
    expect(result.eventLog[0].message).toContain("Operating conditions: rain, night, visibility clear, sensor constrained. Rain automatically includes wet-road ponding and reduced vehicle traction.");
    expect(result.confidenceAssessment).toMatchObject({ band: "non-usable", label: "SYSTEM DEGRADED", walkPermitted: false, conclusionPermitted: false });
    expect(result.signal).toMatchObject({ vehicle: "STOP", pedestrian: "WAIT" });
    expect(result.timeline.every((stage) => stage.detail.includes("pedestrian signal: WAIT"))).toBe(true);
    expect(result.eventLog.at(-1)?.message).toContain("No automated violation conclusion is permitted.");
  });

  it("derives sensor health from user-controlled environmental variables", () => {
    expect(deriveSensorHealth({ weather: "dry", lighting: "day", visibility: "clear" })).toBe("operational");
    expect(deriveSensorHealth({ weather: "rain", lighting: "day", visibility: "clear" })).toBe("operational");
    expect(deriveSensorHealth({ weather: "rain", lighting: "night", visibility: "clear" })).toBe("constrained");
    expect(deriveSensorHealth({ weather: "rain", lighting: "night", visibility: "dense-haze" })).toBe("degraded");
  });

  it("combines all 12 operating-condition permutations with overlap penalties", () => {
    expect(conditionQualityFor({ weather: "rain", lighting: "day", visibility: "clear" })).toBe(0.91);
    expect(conditionQualityFor({ weather: "dry", lighting: "night", visibility: "clear" })).toBe(0.93);
    expect(conditionQualityFor({ weather: "rain", lighting: "night", visibility: "clear" })).toBe(0.82);
    expect(conditionQualityFor({ weather: "dry", lighting: "night", visibility: "haze" })).toBe(0.85);
    expect(conditionQualityFor({ weather: "rain", lighting: "night", visibility: "dense-haze" })).toBe(0.6);

    const scores = new Set<number>();
    for (const weather of ["dry", "rain"] as const) for (const lighting of ["day", "night"] as const) for (const visibility of ["clear", "haze", "dense-haze"] as const) {
      const result = deriveOperatingConditions({ weather, lighting, visibility });
      expect(result.conditionQuality).toBeGreaterThanOrEqual(0);
      expect(result.conditionQuality).toBeLessThanOrEqual(1);
      scores.add(result.conditionQuality);
    }
    expect(scores.size).toBeGreaterThan(7);
  });

  it("classifies the four provisional system-confidence bands", () => {
    expect(assessConfidence(0.9).band).toBe("usable");
    expect(assessConfidence(0.75)).toMatchObject({ band: "limited", humanReviewRequired: true, walkPermitted: true });
    expect(assessConfidence(0.5)).toMatchObject({ band: "non-usable", walkPermitted: false, conclusionPermitted: false });
    expect(assessConfidence(0.49)).toMatchObject({ band: "failed", label: "SENSOR FAILURE", walkPermitted: false, conclusionPermitted: false });
  });

  it("rejects a school scenario at a normal crossing", () => {
    expect(() => runSimulation({ mode: "normal", scenarioId: "school-no-violation" })).toThrow("not available");
    expect(() => runSimulation({ mode: "normal", scenarioId: "normal-exceeded-school-zone-speed-limit" })).toThrow("not available");
  });

  it("creates a readable one-page brief for the current occurrence", () => {
    const result = runSimulation({ mode: "normal", scenarioId: "normal-crossing-zone-speeding" }, new Date("2026-08-19T00:00:00Z"));
    const pdf = createSimulationReportPdf([result], new Date("2026-08-19T00:01:00Z"));
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("CURRENT OCCURRENCE BRIEF");
    expect(text).toContain("SMARTCROSS");
    expect(text).not.toMatch(/SMARTCROSS\s+2[.]2/);
    expect(text).toContain(result.sessionId);
    expect(text).toContain(result.cctvEvidence!.plateNumber);
    expect(text).toContain("SEVEN-STAGE OCCURRENCE");
    expect(text).toContain("OUTCOME AND REQUIRED RESPONSE");
    expect(text).toContain("Page 1 of 1");
    expect(text).toContain("/Count 1");
    expect(text.match(/SIMULATION ONLY/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("exports only the newest occurrence while preserving its seven-stage order", () => {
    const first = runSimulation({ mode: "normal", scenarioId: "normal-no-violation" }, new Date("2026-08-19T00:00:00Z"));
    const second = runSimulation({ mode: "school", scenarioId: "school-vehicle-fire-smoke-explosion" }, new Date("2026-08-19T00:02:00Z"));
    const text = new TextDecoder().decode(createSimulationReportPdf([first, second], new Date("2026-08-19T00:05:00Z")));
    expect(text).toContain(first.sessionId);
    expect(text).not.toContain(second.sessionId);
    expect(text).toContain(`% EVENT-STAGES: ${TIMELINE_STAGES.join("|")}`);
    expect(text).toContain("Page 1 of 1");
  });

  it("wraps long report values and handles missing optional evidence", () => {
    const base = runSimulation({ mode: "normal", scenarioId: "normal-crossing-zone-speeding" }, new Date("2026-08-19T00:00:00Z"));
    const longValue = "Authorised municipal simulation review recipient with an intentionally extended responsibility description for table wrapping verification";
    const result = {
      ...base,
      scenario: { ...base.scenario, label: `${base.scenario.label} with an extended Malaysian municipal review description` },
      cctvEvidence: null,
      notificationRecipients: [{ name: longValue, purpose: longValue, status: "LOCAL_MOCK_QUEUE_ONLY" as const }],
    };
    const text = new TextDecoder().decode(createSimulationReportPdf([result], new Date("2026-08-19T00:05:00Z")));
    expect(text).toContain("Inactive - no plate captured because no");
    expect(text).toContain("Authorised municipal simulation review");
    expect(text).toContain("/Count 1");
    expect(text).toContain("Safety boundary");
  });

  it("generates a complete simulation-only report when session history is empty", () => {
    const text = new TextDecoder().decode(createSimulationReportPdf([], new Date("2026-08-19T00:05:00Z")));
    expect(text).toContain("No current occurrence");
    expect(text).toContain("No live CCTV, enforcement, signal control, or emergency dispatch");
    expect(text).toContain("Page 1 of 1");
  });

  it("maps essential current-occurrence fields into searchable report text", () => {
    const sessions = [
      runSimulation({ mode: "school", scenarioId: "school-vehicle-fire-smoke-explosion", operatingConditions: { weather: "dry", lighting: "night", visibility: "clear" } }, new Date("2026-08-19T00:02:00Z")),
      runSimulation({ mode: "normal", scenarioId: "normal-no-violation", operatingConditions: { weather: "rain", lighting: "day", visibility: "haze" } }, new Date("2026-08-19T00:00:00Z")),
    ];
    const text = visiblePdfText(createSimulationReportPdf(sessions, new Date("2026-08-19T00:05:00Z")));
    const current = sessions[0];
    expect(text).toContain(current.sessionId);
    expect(text).toContain(current.scenario.detection);
    expect(text).toContain(current.scenario.finalOutcome);
    expect(text).toContain(`${Math.round(current.operatingConditions.conditionQuality * 100)}% simulated`);
    for (const recipient of current.notificationRecipients) expect(text).toContain(recipient.name);
    for (const countermeasure of current.countermeasures) expect(text).toContain(countermeasure);
    if (current.cctvEvidence) {
      expect(text).toContain(current.cctvEvidence.cameraId);
      expect(text).toContain(current.cctvEvidence.plateNumber);
      expect(text).toContain(current.cctvEvidence.detectedCondition);
    }
    expect(text).not.toContain(sessions[1].sessionId);
  });

  it("keeps every selectable occurrence within one A4 page", () => {
    for (const scenario of SCENARIOS) {
      const mode = scenario.supportedModes[0];
      const result = runSimulation({ mode, scenarioId: scenario.id }, new Date("2026-08-19T00:00:00Z"));
      const text = new TextDecoder().decode(createSimulationReportPdf([result], new Date("2026-08-19T00:05:00Z")));
      expect(text).toContain("/Count 1");
      expect(text).toContain("Page 1 of 1");
      const bottom = Number(text.match(/% CONTENT-BOTTOM: ([\d.]+)/)?.[1]);
      expect(bottom).toBeGreaterThanOrEqual(54);
    }
  });

  it("withholds WALK for every violation in both crossing modes", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode) && item.violation)) {
        const result = runSimulation({ mode, scenarioId: scenario.id });
        expect(result.signal).toMatchObject({ vehicle: "STOP", pedestrian: "WAIT" });
        expect(result.timeline).toHaveLength(7);
      }
    }
  });

  it("releases WALK only for each no-violation profile after traffic STOP", () => {
    for (const mode of ["normal", "school"] as const) {
      const result = runSimulation({ mode, scenarioId: `${mode}-no-violation` });
      expect(result.signal).toMatchObject({ vehicle: "STOP", pedestrian: "WALK" });
    }
  });

  it("uses the attached scenario-specific sequence in both crossing modes", () => {
    for (const mode of ["normal", "school"] as const) {
      const speeding = runSimulation({ mode, scenarioId: `${mode}-crossing-zone-speeding` });
      expect(speeding.timeline.map((stage) => stage.name)).toEqual(["Approach", "Initiation", "Detected", "Escalation", "Conflict", "Response", "Outcome"]);
      expect(speeding.timeline[0].detail).toContain("approaches normally");
      expect(speeding.timeline[1].detail).toContain("accelerates above");
      expect(speeding.timeline[2].detail).toContain("High speed");
      expect(speeding.scenario.severity).toBe("medium");
    }
  });

  it("implements all 39 selectable violation profiles with distinct seven-stage motion and effects", () => {
    for (const mode of ["normal", "school"] as const) {
      const signatures = new Set<string>();
      const expectedEffects = expectedEffectsFor(mode);
      for (const [slug, effect] of expectedEffects) {
        const frames = motionFramesFor(`${mode}-${slug}`, mode);
        expect(frames).toHaveLength(MOTION_FRAME_COUNT);
        expect(frames.some((frame) => frame.effect === effect)).toBe(true);
        expect(frames.some((frame) => frame.vehicleA.speed > 0 || frame.vehicleB.speed > 0)).toBe(true);
        expect(frames.map((frame) => frame.timelineStage)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(frames.map((frame) => frame.activeSensor)).toHaveLength(7);
        expect(frames.every((frame) => frame.action.length > 20)).toBe(true);
        const signature = frames.map((frame) => [frame.vehicleA.x, frame.vehicleA.lane, frame.vehicleA.state, frame.vehicleA.speed, frame.vehicleB.x, frame.vehicleB.lane, frame.vehicleB.state, frame.pedestrian.progress, frame.pedestrian.state, frame.effect].join(":" )).join("|");
        signatures.add(signature);
      }
      expect(signatures.size).toBe(expectedEffects.length);
    }
  });

  it("never exposes WALK to a moving actor inside the conflict zone", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        for (const frame of motionFramesFor(scenario.id, mode)) {
          if (frame.pedestrianSignal !== "WALK") continue;
          expect(frame.vehicleSignal).toBe("STOP");
          for (const actor of [frame.vehicleA, frame.vehicleB]) {
            const insideConflict = actor.x > 43 && actor.x < 57;
            expect(insideConflict && actor.speed > 0).toBe(false);
          }
        }
      }
    }
  });

  it("keeps stationary vehicle states at zero speed in every selectable sequence", () => {
    const stationaryStates = new Set(["WAITING", "STOPPED", "YIELDING", "BLOCKING", "COLLISION", "FIRE"]);
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        for (const [index, frame] of motionFramesFor(scenario.id, mode).entries()) {
          for (const actor of [frame.vehicleA, frame.vehicleB]) {
            if (stationaryStates.has(actor.state)) expect(actor.speed, `${scenario.id} frame ${index} ${actor.label} ${actor.state}`).toBe(0);
          }
        }
      }
    }
  });

  it("allows pedestrian progress to increase only while the signal says WALK", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        const frames = motionFramesFor(scenario.id, mode);
        for (let index = 1; index < frames.length; index += 1) {
          if (frames[index].pedestrian.progress > frames[index - 1].pedestrian.progress) {
            if (scenario.id === "school-motorcycle-in-pedestrian-area" && index === 1) {
              expect(frames[index].pedestrianSignal).toBe("WAIT");
              expect(frames[index].pedestrian.progress).toBe(5);
              expect(frames[index].pedestrian.state).toBe("PAUSED");
              continue;
            }
            expect(frames[index].pedestrianSignal, `${scenario.id} frame ${index}`).toBe("WALK");
            expect(frames[index].vehicleSignal, `${scenario.id} frame ${index}`).toBe("STOP");
          }
        }
      }
    }
  });

  it("keeps every protected pedestrian crossing at one continuous speed", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        const frames = motionFramesFor(scenario.id, mode);
        let index = 0;

        while (index < frames.length) {
          if (frames[index].pedestrianSignal !== "WALK" || !frames[index].routeClear) {
            index += 1;
            continue;
          }

          const walkStart = index;
          while (index + 1 < frames.length && frames[index + 1].pedestrianSignal === "WALK" && frames[index + 1].routeClear) index += 1;
          const walkEnd = index;
          const startProgress = walkStart === 0 ? frames[walkStart].pedestrian.progress : frames[walkStart - 1].pedestrian.progress;
          const deltas = frames.slice(walkStart, walkEnd + 1).map((frame, offset) => {
            const previousProgress = offset === 0 ? startProgress : frames[walkStart + offset - 1].pedestrian.progress;
            return frame.pedestrian.progress - previousProgress;
          });

          if (deltas.some((delta) => delta > 0)) {
            expect(deltas.every((delta) => delta > 0), `${scenario.id} WALK must not pause mid-crossing`).toBe(true);
            expect(Math.max(...deltas) - Math.min(...deltas), `${scenario.id} WALK speed must remain constant`).toBeLessThan(0.001);
          }
          index += 1;
        }
      }
    }
  });

  it("shows School violation 07 before the zebra while vehicles follow No Violation motion", () => {
    const violation = motionFramesFor("school-motorcycle-in-pedestrian-area", "school");
    const baseline = motionFramesFor("school-no-violation", "school");

    expect(violation.map((frame) => frame.vehicleA)).toEqual(baseline.map((frame) => frame.vehicleA));
    expect(violation.map((frame) => frame.vehicleB)).toEqual(baseline.map((frame) => frame.vehicleB));
    expect(violation.map((frame) => frame.vehicleSignal)).toEqual(baseline.map((frame) => frame.vehicleSignal));
    expect(violation[1].pedestrian).toMatchObject({ kind: "child", progress: 5, state: "PAUSED" });
    expect(violation.slice(1, 4).every((frame) => frame.pedestrian.progress === 5 && frame.pedestrianSignal === "WAIT")).toBe(true);
    expect(violation[4].pedestrianSignal).toBe("WALK");
    expect(violation.at(-1)?.pedestrian.state).toBe("COMPLETED");
  });

  it("keeps violation 4 fixed on the zebra with WALK withheld", () => {
    for (const mode of ["normal", "school"] as const) {
      const frames = motionFramesFor(`${mode}-stopped-or-parked-on-crossing`, mode);
      expect(frames.slice(1).every((frame) => frame.vehicleA.x === 50)).toBe(true);
      expect(frames.slice(1).every((frame) => frame.vehicleA.speed === 0 && frame.vehicleA.state === "BLOCKING")).toBe(true);
      expect(frames.every((frame) => frame.pedestrianSignal !== "WALK" && frame.pedestrian.progress === 0)).toBe(true);
    }
  });

  it("keeps violation 5 stationary on the accessible route with WALK withheld", () => {
    for (const mode of ["normal", "school"] as const) {
      const frames = motionFramesFor(`${mode}-accessible-route-blocked`, mode);
      expect(frames.slice(2).every((frame) => frame.vehicleA.x === 44 && frame.vehicleA.lane === 88)).toBe(true);
      expect(frames.slice(2).every((frame) => frame.vehicleA.speed === 0 && frame.vehicleA.state === "BLOCKING")).toBe(true);
      expect(frames.every((frame) => frame.pedestrianSignal === "WAIT" && frame.pedestrian.progress === 0)).toBe(true);
      expect(frames.every((frame) => frame.routeClear === false)).toBe(true);
    }
  });

  it("records violation 3 only after the vehicle clears the zebra", () => {
    for (const mode of ["normal", "school"] as const) {
      const frames = motionFramesFor(`${mode}-red-signal-violation`, mode);
      expect(frames[2].vehicleA).toMatchObject({ x: 52, state: "ACCELERATING" });
      expect(frames[3].vehicleA.x).toBeGreaterThan(57);
      expect(frames[3].action).toContain("detected and recorded");
      expect(frames.every((frame) => frame.pedestrianSignal === "WAIT" && frame.pedestrian.progress === 0)).toBe(true);
    }
  });

  it("keeps violation 6 filtering forward through and beyond the zebra", () => {
    for (const mode of ["normal", "school"] as const) {
      const frames = motionFramesFor(`${mode}-motorcycle-filtering-at-crossing`, mode);
      const positions = frames.map((frame) => frame.vehicleA.x);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(positions.some((x) => x >= 43 && x <= 57)).toBe(true);
      expect(positions.at(-1)).toBeGreaterThan(57);
    }
  });

  it("runs the ordered motion contracts for violations 14 to 17", () => {
    for (const mode of ["normal", "school"] as const) {
      const hardBrake = motionFramesFor(`${mode}-aggressive-acceleration-or-braking`, mode);
      expect(hardBrake.map((frame) => frame.vehicleA.state)).toEqual([
        "APPROACHING", "APPROACHING", "ACCELERATING", "BRAKING", "STOPPED", "STOPPED", "STOPPED",
      ]);
      expect(hardBrake.at(-1)?.vehicleA.x).toBe(34);

      const uTurn = motionFramesFor(`${mode}-unsafe-u-turn-near-crossing`, mode);
      expect(uTurn.map((frame) => frame.vehicleA.heading)).toEqual([0, 0, 0, 0, 0, 0, 0]);
      expect(uTurn.map((frame) => frame.vehicleA.lane)).toEqual([68, 68, 63, 51, 40, 34, 32]);

      const vulnerable = motionFramesFor(`${mode}-failed-to-yield-vulnerable-pedestrian`, mode);
      expect(vulnerable.slice(0, 4).map((frame) => frame.vehicleA.x)).toEqual([12, 18, 22, 34]);
      expect(vulnerable[3].vehicleA).toMatchObject({ x: 34, speed: 0, state: "STOPPED" });

    }
    const schoolSpeed = motionFramesFor("school-exceeded-school-zone-speed-limit", "school");
    expect(schoolSpeed[2].vehicleA.x).toBeGreaterThan(43);
    expect(schoolSpeed[3].vehicleA.state).toBe("BRAKING");
    expect(schoolSpeed[4].vehicleA).toMatchObject({ x: 66, speed: 0, state: "STOPPED" });
  });

  it("settles both vehicles at zero speed in every selectable profile", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        const finalFrame = motionFramesFor(scenario.id, mode).at(-1);
        expect(finalFrame?.vehicleA.speed, scenario.id).toBe(0);
        expect(finalFrame?.vehicleB.speed, scenario.id).toBe(0);
      }
    }
  });

  it("keeps every violation trajectory continuous without an unintended reverse", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const [slug] of expectedEffectsFor(mode)) {
        const frames = motionFramesFor(`${mode}-${slug}`, mode);
        const aPositions = frames.map((frame) => frame.vehicleA.x);
        const bPositions = frames.map((frame) => frame.vehicleB.x);
        if (slug === "driving-wrong-direction") {
          expect(aPositions).toEqual([...aPositions].sort((a, b) => b - a));
        } else if (slug !== "unsafe-u-turn-near-crossing") {
          expect(aPositions, `${mode}-${slug} Vehicle A`).toEqual([...aPositions].sort((a, b) => a - b));
        }
        const expectedBPositions = mode === "school" && slug === "motorcycle-in-pedestrian-area"
          ? [...bPositions].sort((a, b) => b - a)
          : [...bPositions].sort((a, b) => a - b);
        expect(bPositions, `${mode}-${slug} Vehicle B`).toEqual(expectedBPositions);
      }
    }
  });

  it("allows recoverable pedestrians to resume only after the route clears", () => {
    const recoverable = ["motorcycle-in-pedestrian-area", "failed-to-yield-vulnerable-pedestrian", "exceeded-school-zone-speed-limit", "parking-obstructed-sight-distance"];
    for (const mode of ["normal", "school"] as const) {
      for (const slug of recoverable.filter((item) => mode === "school" || item !== "exceeded-school-zone-speed-limit")) {
        const frames = motionFramesFor(`${mode}-${slug}`, mode);
        const walkFrames = frames.filter((frame) => frame.pedestrianSignal === "WALK");
        expect(walkFrames.length).toBeGreaterThan(0);
        const resumedWalkFrames = walkFrames.filter((frame) => frame.routeClear);
        expect(resumedWalkFrames.length).toBeGreaterThan(0);
        expect(resumedWalkFrames.every((frame) => frame.vehicleSignal === "STOP")).toBe(true);
        for (const frame of resumedWalkFrames) {
          expect(frame.vehicleA.speed, `${mode}-${slug} Vehicle A speed during WALK`).toBe(0);
          expect(frame.vehicleB.speed, `${mode}-${slug} Vehicle B speed during WALK`).toBe(0);
          const expectedState = mode === "school" && slug === "motorcycle-in-pedestrian-area" ? "YIELDING" : "STOPPED";
          expect(frame.vehicleA.state, `${mode}-${slug} Vehicle A state during WALK`).toBe(expectedState);
          expect(frame.vehicleB.state, `${mode}-${slug} Vehicle B state during WALK`).toBe(expectedState);
          expect([34, 66], `${mode}-${slug} Vehicle A stop-line position during WALK`).toContain(frame.vehicleA.x);
          expect(frame.vehicleB.x, `${mode}-${slug} Vehicle B stop-line position during WALK`).toBe(66);
        }
        expect(frames.at(-1)?.pedestrian.state).toBe("COMPLETED");
      }
    }
  });

  it("holds both vehicles at the stop lines throughout every permitted WALK frame", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        for (const frame of motionFramesFor(scenario.id, mode).filter((item) => item.pedestrianSignal === "WALK")) {
          expect(frame.vehicleA.speed, `${scenario.id} Vehicle A speed`).toBe(0);
          expect(frame.vehicleB.speed, `${scenario.id} Vehicle B speed`).toBe(0);
          expect([34, 66], `${scenario.id} Vehicle A stop line`).toContain(frame.vehicleA.x);
          expect(frame.vehicleB.x, `${scenario.id} Vehicle B stop line`).toBe(66);
          expect(["STOPPED", "YIELDING"], `${scenario.id} Vehicle A state`).toContain(frame.vehicleA.state);
          expect(["STOPPED", "YIELDING"], `${scenario.id} Vehicle B state`).toContain(frame.vehicleB.state);
        }
      }
    }
  });

  it("uses a slower continuous timing profile for violation 15 U-turns in both scenarios", () => {
    for (const mode of ["normal", "school"] as const) {
      const frames = motionFramesFor(`${mode}-unsafe-u-turn-near-crossing`, mode);
      const timings = motionTimingsFor(`${mode}-unsafe-u-turn-near-crossing`, mode);
      expect(frames.map((frame) => frame.vehicleA.heading)).toEqual([0, 0, 0, 0, 0, 0, 0]);
      expect(frames.slice(1, 6).map((frame) => [frame.vehicleA.x, frame.vehicleA.lane])).toEqual([[34, 68], [44, 63], [49, 51], [44, 40], [34, 34]]);
      expect(frames.slice(2, 6).every((frame) => frame.vehicleA.state === "TURNING")).toBe(true);
      expect(timings.slice(0, -1).every((timing) => timing.durationMs === U_TURN_MOTION_FRAME_MS)).toBe(true);
    }
  });

  it("preserves the configured, approach, peak, detection and stopped school-zone speeds", () => {
    const frames = motionFramesFor("school-exceeded-school-zone-speed-limit", "school");
    expect(SCHOOL_ZONE_SPEED_PROFILE).toEqual({ configuredLimit: 30, approachSpeed: 46, peakSpeed: 50, detectionSpeed: 42 });
    expect(frames.map((frame) => frame.vehicleA.speed)).toEqual([46, 50, 42, 24, 0, 0, 0]);
  });

  it("assigns every verified WALK run one real 12-second clearance window", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const scenario of SCENARIOS.filter((item) => item.supportedModes.includes(mode))) {
        const frames = motionFramesFor(scenario.id, mode);
        const timings = motionTimingsFor(scenario.id, mode);
        expect(timings).toHaveLength(MOTION_FRAME_COUNT);
        expect(timings.at(-1)?.durationMs).toBe(0);
        for (let index = 0; index < frames.length; index += 1) {
          if (frames[index].pedestrianSignal === "WALK" && frames[index].routeClear) {
            if (index > 0 && frames[index - 1].pedestrianSignal === "WALK" && frames[index - 1].routeClear) continue;
            let end = index;
            while (end + 1 < frames.length && frames[end + 1].pedestrianSignal === "WALK" && frames[end + 1].routeClear) end += 1;
            expect(timings.slice(index, end + 1).reduce((total, timing) => total + timing.durationMs, 0)).toBe(PROTECTED_WALK_SECONDS * 1_000);
            expect(timings[index].protectedWalkSecondsAtStart).toBe(PROTECTED_WALK_SECONDS);
          } else if (index < MOTION_FRAME_COUNT - 1) {
            const expectedDuration = scenario.id.endsWith("unsafe-u-turn-near-crossing") ? U_TURN_MOTION_FRAME_MS : STANDARD_MOTION_FRAME_MS;
            expect(timings[index].durationMs).toBe(expectedDuration);
          }
        }
      }
    }
  });

  it("freezes collision and fire scenes under STOP/HOLD until manual reset", () => {
    for (const mode of ["normal", "school"] as const) {
      for (const slug of ["collision-road-user-infrastructure", "vehicle-fire-smoke-explosion"]) {
        const frames = motionFramesFor(`${mode}-${slug}`, mode);
        for (const frame of frames.slice(4)) {
          expect(frame.controller).toBe("CRITICAL_ALARM");
          expect(frame.vehicleSignal).toBe("STOP");
          expect(frame.pedestrianSignal).toBe("WAIT");
          expect(frame.vehicleA.speed).toBe(0);
          expect(frame.vehicleB.speed).toBe(0);
        }
        const result = runSimulation({ mode, scenarioId: `${mode}-${slug}` }, new Date("2026-08-24T00:00:00Z"));
        expect(result.eventLog[4].message).toContain("three short local alarm tones");
        expect(result.eventLog[4].message).toContain("The affected actor is Vehicle A.");
        expect(result.eventLog[4].message).toContain("places local mock records for MPAJ traffic operations review desk");
      }
    }
  });

  it("moves Vehicle A along a curved path into the right traffic-light pole before raising the alarm", () => {
    for (const mode of ["normal", "school"] as const) {
      const frames = motionFramesFor(`${mode}-collision-road-user-infrastructure`, mode);
      expect(frames.map((frame) => frame.vehicleA.x)).toEqual([30, 40, 57, 57, 57, 57, 57]);
      expect(frames.map((frame) => frame.vehicleA.lane)).toEqual([68, 68, 108, 108, 108, 108, 108]);
      expect(frames.every((frame) => frame.pedestrian.progress === 0 && frame.pedestrian.state === "HOLD")).toBe(true);
      expect(frames[2].vehicleA.state).toBe("TURNING");
      expect(frames[3]).toMatchObject({ controller: "STOP_ALL", pedestrian: { state: "HOLD" }, vehicleA: { x: 57, lane: 108, state: "COLLISION", speed: 0 } });
      expect(frames[4].controller).toBe("CRITICAL_ALARM");
    }
  });
});
