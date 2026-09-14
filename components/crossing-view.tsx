"use client";

import type { CSSProperties } from "react";
import { frameFor, idleFrame, motionSlugForScenario, SCHOOL_ZONE_SPEED_PROFILE, type MotionEffect, type PedestrianMotion, type VehicleMotion } from "@/lib/motion";
import { applyConfidenceSafetyOverride } from "@/lib/simulation";
import { capitaliseEnglish, humaniseEnglishState } from "@/lib/text-standard";
import type { PedestrianState, SignalState, SimulationResult } from "@/lib/types";

type MotionStyle = CSSProperties & Record<`--${string}`, string | number>;

const EFFECT_LABELS: Record<MotionEffect, string> = {
  none: "Tracked movement",
  conflict: "Failure-to-yield conflict path",
  speed: "Speed threshold breach",
  "red-light": "Red signal and stop-line breach",
  "crossing-blocked": "Marked crossing obstruction",
  "accessible-blocked": "Accessible route obstruction",
  filtering: "Motorcycle filtering path",
  "pedestrian-intrusion": "Pedestrian-area intrusion",
  overtaking: "Yielding-vehicle overtake path",
  "wrong-way": "Wrong-direction path",
  "queue-bypass": "Opposing-lane queue bypass",
  "lane-change": "Danger-zone lane change",
  "possible-distraction": "Possible distraction path",
  tailgating: "Unsafe following distance",
  "hard-braking": "Aggressive speed change",
  "u-turn": "Unsafe turning arc",
  "vulnerable-user": "Vulnerable-user priority route",
  "school-speed": "School-zone speed breach",
  "sight-obstruction": "Blocked sight-distance triangle",
  collision: "Simulated impact zone",
  fire: "Fire and exclusion zone",
};

function pedestrianLabel(pedestrian: PedestrianMotion): string {
  const user = pedestrian.kind === "adult" ? "Pedestrian" : pedestrian.kind === "wheelchair" ? "Wheelchair user" : `${pedestrian.kind[0].toUpperCase()}${pedestrian.kind.slice(1)} pedestrian`;
  return `${user}: ${humaniseEnglishState(pedestrian.state)}`;
}

function PedestrianIcon({ pedestrian, mode }: { pedestrian: PedestrianMotion; mode: SimulationResult["mode"] }) {
  const start = mode === "school" ? 3 : 16;
  const style: MotionStyle = {
    top: `${start + ((86 - start) * pedestrian.progress) / 100}%`,
  };
  const label = mode === "school"
    ? `Student group: ${humaniseEnglishState(pedestrian.state)}`
    : pedestrianLabel(pedestrian);
  return (
    <span className={`pedestrian-icon person-top pedestrian-${pedestrian.kind}${mode === "school" ? " student-group" : ""}`} data-motion-state={pedestrian.state} style={style} role="img" aria-label={label}>
      {mode === "school" ? (
        <span className="student-icons" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <svg key={index} viewBox="0 0 32 48" focusable="false">
              <circle cx="16" cy="7" r="5" />
              <path d="M13 14h6l5 11-4 2-2-5v8l7 12-5 3-6-11-4 11-6-2 6-14v-8l-3 7-5-2 6-12h5Z" />
            </svg>
          ))}
        </span>
      ) : pedestrian.kind === "wheelchair" ? <span className="wheelchair-symbol" aria-hidden="true">♿</span> : (
        <svg viewBox="0 0 32 48" aria-hidden="true" focusable="false">
          <circle cx="16" cy="7" r="5" />
          <path d="M13 14h6l5 11-4 2-2-5v8l7 12-5 3-6-11-4 11-6-2 6-14v-8l-3 7-5-2 6-12h5Z" />
        </svg>
      )}
      <small>{humaniseEnglishState(pedestrian.state)}</small>
    </span>
  );
}

function PedestrianTimer({ pedestrian, countdown }: { pedestrian: PedestrianState; countdown: number }) {
  return <span className={`pedestrian-timer timer-${pedestrian.toLowerCase()}`} role="timer" aria-live="polite" aria-label={`Pedestrian ${pedestrian} countdown, ${countdown} seconds`}><small>Pedestrian</small><strong>{pedestrian}</strong><b>{countdown}s</b></span>;
}

function TrafficLight({ className, state, label, pedestrian, countdown, showImpact = false }: { className: string; state: SignalState; label: string; pedestrian: PedestrianState; countdown: number; showImpact?: boolean }) {
  return (
    <span className={`traffic-light ${className}`}>
      <span className="traffic-light-row">
        <span className="traffic-light-signal" role="img" aria-label={`${label} traffic light ${state}`}>
          <span className="traffic-light-housing" aria-hidden="true">
            <i className={state === "STOP" ? "lens lens-red active" : "lens lens-red"} />
            <i className={state === "AMBER" ? "lens lens-amber active" : "lens lens-amber"} />
            <i className={state === "GO" ? "lens lens-green active" : "lens lens-green"} />
          </span>
          {showImpact ? <span className="impact-marker traffic-light-impact" aria-label="Simulated traffic-light pole collision point">IMPACT</span> : null}
        </span>
        <PedestrianTimer pedestrian={pedestrian} countdown={countdown} />
      </span>
      <small aria-hidden="true">{label}: {state}</small>
    </span>
  );
}

function VehicleActor({ actor, side, roadUser, forceStop = false }: { actor: VehicleMotion; side: "a" | "b"; roadUser: string; forceStop?: boolean }) {
  const distance = Math.round(Math.abs(50 - actor.x));
  const style: MotionStyle = { left: `${actor.x}%`, top: `${actor.lane}%`, "--vehicle-heading": `${actor.heading}deg`, "--vehicle-counter-heading": `${-actor.heading}deg` };
  const stopMark = (actor.state === "STOPPED" || actor.state === "YIELDING") && actor.x === 34 ? "a" : (actor.state === "STOPPED" || actor.state === "YIELDING") && actor.x === 66 ? "b" : undefined;
  const showStop = forceStop || actor.state === "BLOCKING" || actor.state === "COLLISION" || actor.state === "FIRE";
  return (
    <span className={`car motion-vehicle vehicle-${side} road-user-${roadUser}${forceStop ? " emergency-stop" : ""}`} data-motion-state={actor.state} data-stop-mark={stopMark} data-speed={actor.speed} style={style} role="img" aria-label={`${actor.label} is ${humaniseEnglishState(actor.state)} at ${actor.speed} kilometres per hour and ${distance} metres from the crossing centre${showStop ? ". STOP is required" : ""}`} aria-hidden={actor.visible === false ? true : undefined}>
      <span className="vehicle-body"><b>{actor.label}</b><small>{actor.speed} km/h, {humaniseEnglishState(actor.state)}</small><em>{distance} m to centre</em></span>
      {showStop || actor.state === "FIRE" ? (
        <span className="vehicle-signage" aria-hidden="true">
          {actor.state === "FIRE" ? <span className="vehicle-fire-icon">FIRE / SMOKE</span> : null}
          {showStop ? <strong className="vehicle-stop-indicator">STOP</strong> : null}
        </span>
      ) : null}
    </span>
  );
}

function EffectLayer({ effect, tone, currentSpeed, mode }: { effect: MotionEffect; tone: string; currentSpeed: number; mode: SimulationResult["mode"] }) {
  return (
    <div className={`motion-effect effect-${effect} path-${tone}`} aria-label={EFFECT_LABELS[effect]}>
      <span className="tracked-path"><b>{EFFECT_LABELS[effect]}</b></span>
      {effect === "collision" ? <svg className="infrastructure-collision-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Vehicle A path towards the right traffic-light pole"><path d="M 30 64 C 43 64, 53 73, 57 90" /></svg> : null}
      {effect === "accessible-blocked" ? <span className="accessible-route">Accessible route</span> : null}
      {effect === "sight-obstruction" ? <span className="visibility-cone">Sight-distance triangle</span> : null}
      {effect === "tailgating" ? <span className="following-gap">Unsafe gap</span> : null}
      {effect === "queue-bypass" || effect === "filtering" || effect === "overtaking" ? <span className="vehicle-queue"><i /><i /><i /></span> : null}
      {effect === "fire" ? <span className="hazard-zone">LOCAL MOCK EXCLUSION ZONE</span> : null}
      {effect === "school-speed" && mode === "school" ? <div className="school-zone-boundary"><section className="school-zone-speed-panel" role="group" aria-label="School-zone speed profile"><strong>Simulation school-zone threshold: {SCHOOL_ZONE_SPEED_PROFILE.configuredLimit} km/h</strong><dl><div><dt>Configured limit</dt><dd data-testid="school-zone-configured-limit">{SCHOOL_ZONE_SPEED_PROFILE.configuredLimit} km/h</dd></div><div><dt>Detection speed</dt><dd data-testid="school-zone-detection-speed">{SCHOOL_ZONE_SPEED_PROFILE.detectionSpeed} km/h</dd></div><div><dt>Peak speed</dt><dd data-testid="school-zone-peak-speed">{SCHOOL_ZONE_SPEED_PROFILE.peakSpeed} km/h</dd></div><div><dt>Current speed</dt><dd data-testid="school-zone-current-speed">{currentSpeed} km/h</dd></div></dl></section></div> : null}
    </div>
  );
}

export function CrossingView({ result, animationFrame, isAnimating, hasRun, controllerCountdown, motionDurationMs }: { result: SimulationResult; animationFrame: number; isAnimating: boolean; hasRun: boolean; controllerCountdown: number; motionDurationMs: number }) {
  const rawFrame = hasRun ? frameFor(result.scenario.id, result.mode, animationFrame) : idleFrame();
  const frame = applyConfidenceSafetyOverride(rawFrame, result.confidenceAssessment);
  const roadUserA = result.scenario.roadUser === "mixed" ? "car" : result.scenario.roadUser;
  const motionSlug = motionSlugForScenario(result.scenario.id);
  const rawStateLabel = humaniseEnglishState(frame.controller);
  const stateLabel = `${rawStateLabel[0].toUpperCase()}${rawStateLabel.slice(1)}`;
  const critical = frame.controller === "CRITICAL_ALARM";
  const vehicleMotionDurationMs = frame.effect === "u-turn" ? motionDurationMs : Math.max(10, motionDurationMs - 200);
  const motionStyle: MotionStyle = {
    "--motion-duration": `${vehicleMotionDurationMs}ms`,
    "--pedestrian-motion-duration": `${Math.max(10, motionDurationMs)}ms`,
  };

  return (
    <div className="crossing-view" style={motionStyle} data-mode={result.mode} data-step={frame.timelineStage} data-frame={hasRun ? animationFrame : 0} data-motion-profile={motionSlug} data-effect={frame.effect} data-running={isAnimating} data-has-run={hasRun} data-route-clear={frame.routeClear} data-weather={result.operatingConditions.weather} data-lighting={result.operatingConditions.lighting} data-visibility={result.operatingConditions.visibility} data-sensor-health={result.operatingConditions.sensorHealth} aria-label={`Simulated ${result.mode} crossing. Vehicle signal ${frame.vehicleSignal}. Pedestrian signal ${frame.pedestrianSignal}. Controller ${stateLabel}.`}>
      <div className="crossing-topbar"><span><i className="live-dot" /> SIMULATED DATA, ANIMATED PROTOTYPE</span><span>{result.mode === "school" ? "School crossing with supervised courtyard" : "Normal crossing with public footpath"}</span></div>
      <div className="scene-location"><span><small>REPRESENTATIVE LOCATION</small><strong>{result.mode === "school" ? "School forecourt and direct crossing route" : "MPAJ mid-block local road"}</strong></span><span className={`controller-state controller-${frame.controller.toLowerCase()}`}><i /> Controller: {stateLabel}</span></div>
      <div className="road-scene">
        {result.operatingConditions.lighting === "night" ? <span className="night-overlay" aria-hidden="true" /> : null}
        {result.operatingConditions.weather === "rain" ? <span className="rain-overlay" aria-hidden="true" /> : null}
        {result.operatingConditions.visibility !== "clear" ? <span className={`haze-overlay haze-${result.operatingConditions.visibility}`} role="img" aria-label={`Simulated ${result.operatingConditions.visibility === "dense-haze" ? "dense " : ""}haze visibility`} /> : null}
        {result.operatingConditions.weather === "rain" ? <span className="rainwater-pond" role="img" aria-label="Simulated rainwater ponding in the roadway with reduced vehicle traction">RAINWATER PONDING - REDUCED TRACTION</span> : null}
        <div className={`sensor-health-status sensor-${result.operatingConditions.sensorHealth}`} role="status"><span aria-hidden="true">{result.operatingConditions.sensorHealth === "operational" ? "OK" : "!"}</span> Sensor health: {capitaliseEnglish(result.operatingConditions.sensorHealth)} ({Math.round(result.operatingConditions.conditionQuality * 100)}%)</div>
        <div className={`cctv-camera${hasRun && result.scenario.violation && animationFrame >= 2 ? " cctv-active" : ""}`} role="img" aria-label={`CCTV camera ${hasRun && result.scenario.violation && animationFrame >= 2 ? "capturing simulated plate evidence" : "ready"}`}><span aria-hidden="true" /><b>CCTV V2-01</b></div>
        <span className="cctv-coverage" aria-hidden="true" />
        <div className="pavement pavement-top">
          <span className="waiting-zone waiting-zone-top">Tactile waiting zone</span>
          <span className="radar-zone radar-left" aria-hidden="true">Approach radar</span>
          {result.mode === "school" ? <div className="school-campus" aria-label="School courtyard beside the street"><span className="school-building">SCHOOL</span><span className="school-gate">Gate at school frontage</span><span className="courtyard"><i /><i /><i /></span><strong>School courtyard</strong></div> : <div className="normal-streetscape" aria-hidden="true"><i /><i /><i /></div>}
        </div>
        <div className="road-lane">
          <span className="stop-line stop-line-left"><b>STOP LINE A</b></span><span className="zebra" aria-hidden="true"><b>Marked crossing</b></span><span className="stop-line stop-line-right"><b>STOP LINE B</b></span>
          <span className="lane-direction lane-direction-a" aria-hidden="true">Eastbound Vehicle A</span><span className="lane-direction lane-direction-b" aria-hidden="true">Westbound Vehicle B</span>
          <VehicleActor actor={frame.vehicleA} side="a" roadUser={roadUserA} forceStop={critical} />
          <VehicleActor actor={frame.vehicleB} side="b" roadUser="car" forceStop={critical} />
        </div>
        <div className="engineering-zone-layer" aria-hidden="true">
          <span className="engineering-zone zone-speed zone-speed-left"><b>Speed measurement</b></span>
          <span className="engineering-zone zone-speed zone-speed-right"><b>Speed measurement</b></span>
          <span className="engineering-zone zone-conflict"><b>Conflict zone</b></span>
          <span className="engineering-zone zone-parking"><b>Parking review</b></span>
        </div>
        <EffectLayer effect={frame.effect} tone={frame.pathTone} currentSpeed={Math.max(frame.vehicleA.speed, frame.vehicleB.speed)} mode={result.mode} />
        <PedestrianIcon pedestrian={frame.pedestrian} mode={result.mode} />
        <div className="pavement pavement-bottom"><span className="radar-zone radar-right" aria-hidden="true">Opposing radar</span></div>
        <TrafficLight className="traffic-light-left" state={frame.vehicleSignal} label="Eastbound" pedestrian={frame.pedestrianSignal} countdown={controllerCountdown} />
        <TrafficLight className="traffic-light-right" state={frame.vehicleSignal} label="Westbound" pedestrian={frame.pedestrianSignal} countdown={controllerCountdown} showImpact={critical && frame.effect === "collision"} />
        {result.scenario.violation ? <div className={`violation-marker severity-${result.scenario.severity}`}>SIMULATED {humaniseEnglishState(frame.effect).toLocaleUpperCase("en-MY")}. PEDESTRIAN {frame.pedestrianSignal}</div> : null}
        {hasRun && result.cctvEvidence && animationFrame >= 2 ? <div className="scene-plate-capture" role="status"><small>SIMULATED PLATE CAPTURE</small><strong>{result.cctvEvidence.plateNumber}</strong></div> : null}
        {critical ? <div className="critical-incident-banner" role="alert" data-alarm-pattern="three-short-tones"><strong>CRITICAL INCIDENT</strong><span>SIMULATED ALARM. BOTH VEHICLES STOP. PEDESTRIAN HOLD.</span></div> : null}
      </div>
      <div className={`scene-caption ${frame.routeClear ? "scene-safe" : "scene-hold"}`}><strong>{!hasRun ? "Ready: actors at their starting markers" : `${result.timeline[animationFrame]?.name ?? "Sequence"}, stage ${animationFrame + 1} of 7`}</strong><span>{!hasRun ? "Select a condition and run the sequence. No actor moves before the simulation begins." : frame.action}</span></div>
    </div>
  );
}
