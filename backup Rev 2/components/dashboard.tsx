"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CrossingView } from "@/components/crossing-view";
import { EventLog } from "@/components/event-log";
import { TimelineRail } from "@/components/timeline-rail";
import { HeavyTrafficPanel } from '@/components/heavy-traffic-panel';
import { applyConfidenceSafetyOverride, DEFAULT_OPERATING_CONDITIONS, deriveOperatingConditions, SCENARIOS, getProgress, protectedFallbackScenarioId, runSimulation } from "@/lib/simulation";
import { capitaliseEnglish } from "@/lib/text-standard";
import { createSimulationReportPdf } from "@/lib/pdf-report";
import { frameFor, idleFrame, MOTION_FRAME_COUNT, MOTION_STAGE_BY_FRAME, STANDARD_MOTION_FRAME_MS, timingFor } from "@/lib/motion";
import { TIMELINE_STAGES, type CrossingMode, type EventLogEntry, type OperatingConditions, type ScenarioId, type SimulationResult } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";
import { assessCameraFallback, DEFAULT_SECONDARY_SAFETY_INPUTS, DEGRADED_PROTECTED_WALK_SECONDS, isCameraDegraded } from "@/lib/camera-fallback";
import { createEmergencyPriorityRecord } from "@/lib/emergency-priority";
import type { EmergencyDirection, EmergencyPriorityRecord, EmergencyVehicleType } from "@/lib/types";

type View = "overview" | "simulator" | "technology" | "scenarios" | "incidents" | "reports";
type MockNotificationStatus = "idle" | "sent" | "acknowledged" | "resolved";
const initialTime = new Date("2026-08-19T02:15:00.000Z");
const navigation: Array<{ id: View; label: string }> = [
  { id: "overview", label: "SIMPSON workflow" },
  { id: "simulator", label: "Simulator" },
  { id: "technology", label: "Technology" },
  { id: "scenarios", label: "Scenarios" },
  { id: "incidents", label: "Incidents" },
  { id: "reports", label: "Reports" },
];

function playCriticalAlarm(): void {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.connect(context.destination);
  for (const offset of [0, 0.3, 0.6]) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, context.currentTime + offset);
    envelope.gain.setValueAtTime(0.0001, context.currentTime + offset);
    envelope.gain.exponentialRampToValueAtTime(0.075, context.currentTime + offset + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.16);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + 0.18);
  }
  master.gain.exponentialRampToValueAtTime(1, context.currentTime + 0.01);
  window.setTimeout(() => { void context.close(); }, 1_000);
}

const viewHeadings: Record<View, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "SIMPSON WORKFLOW", title: "Observe. Protect. Review.", description: "A clear local sequence for simulated crossing demand, road-user risk, and authorised review." },
  simulator: { eyebrow: "UNIFIED CROSSING AND VIOLATION SIMULATION", title: "See the approach. Test the condition. Review one record.", description: "One wide animated view connects movement, protected signal logic, seven chronological stages, and the original event record." },
  technology: { eyebrow: "THREE-TIER IoT ARCHITECTURE", title: "Local decisions. Connected oversight.", description: "The concept observes crossing demand locally and shares only anonymous events needed for authorised safety review." },
  scenarios: { eyebrow: "TWO MPAJ-FOCUSED SCENARIOS", title: "Context-specific condition sets.", description: "The normal crossing provides 20 conditions. The school crossing includes one additional school-zone speeding condition, for a total of 21." },
  incidents: { eyebrow: "AUTHORISED HUMAN REVIEW", title: "Review simulated incidents.", description: "Confirm or dismiss local prototype records without contacting enforcement or emergency services." },
  reports: { eyebrow: "CREATE AN OFFLINE RECORD", title: "Simulation reports", description: "Export readable PDF summaries derived from the same local session and violation-history data." },
};

export function Dashboard() {
  const router = useRouter();
  const [view, setView] = useState<View>("simulator");
  const [mode, setMode] = useState<CrossingMode>("normal");
  const [sequence, setSequence] = useState('crossing');
  const [heavyRunning, setHeavyRunning] = useState(false);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("normal-no-violation");
  const [result, setResult] = useState<SimulationResult>(() => runSimulation({ mode: "normal", scenarioId: "normal-no-violation" }, initialTime));
  const [history, setHistory] = useState<SimulationResult[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | EventLogEntry["category"]>("all");
  const [reviewStatus, setReviewStatus] = useState<"pending" | "confirmed" | "dismissed">("pending");
  const [announcement, setAnnouncement] = useState("Normal crossing with no violation is ready.");
  const [animationStep, setAnimationStep] = useState(MOTION_FRAME_COUNT - 1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [frameStartedAt, setFrameStartedAt] = useState(() => Date.now());
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [hasRun, setHasRun] = useState(false);
  const [hiddenLogSessions, setHiddenLogSessions] = useState<Set<string>>(() => new Set());
  const [mockNotificationStatus, setMockNotificationStatus] = useState<MockNotificationStatus>("idle");
  const [operatingConditions, setOperatingConditions] = useState<OperatingConditions>(DEFAULT_OPERATING_CONDITIONS);
  const [fallbackRequested, setFallbackRequested] = useState(false);
  const [duplicateButtonPresses, setDuplicateButtonPresses] = useState(0);
  const [emergencyPriority, setEmergencyPriority] = useState<EmergencyPriorityRecord | null>(null);
  const [emergencyStage, setEmergencyStage] = useState(0);
  const [emergencyRunning, setEmergencyRunning] = useState(false);
  const [emergencyType, setEmergencyType] = useState<EmergencyVehicleType>("ambulance");
  const [emergencyDirection, setEmergencyDirection] = useState<EmergencyDirection>("Eastbound");
  const alarmedSession = useRef<string | null>(null);

  const availableScenarios = useMemo(() => SCENARIOS.filter((item) => item.supportedModes.includes(mode)), [mode]);
  const incidents = history.filter((item) => item.incident);
  const selectedScenario = SCENARIOS.find((item) => item.id === scenarioId) ?? availableScenarios[0];
  const previewResult = useMemo(() => runSimulation({ mode, scenarioId, operatingConditions }, initialTime), [mode, operatingConditions, scenarioId]);
  const heavySceneResult = useMemo(() => runSimulation({mode,scenarioId:`${mode}-no-violation`},initialTime),[mode]);
  const sceneResult = hasRun ? result : previewResult;
  const cameraDegraded = isCameraDegraded(operatingConditions);
  const fallbackAssessment = assessCameraFallback(operatingConditions, fallbackRequested, {
    ...DEFAULT_SECONDARY_SAFETY_INPUTS,
    controllerAvailable: selectedScenario.severity !== "critical",
  });
  const sceneStep = hasRun ? animationStep : 0;
  const activeEmergencyFrame = emergencyPriority?.frames[emergencyStage] ?? null;
  const activeTimelineStep = MOTION_STAGE_BY_FRAME[Math.min(animationStep, MOTION_FRAME_COUNT - 1)];
  const activeStage = result.timeline[activeTimelineStep];
  const activeMotionScenarioId = sceneResult.cameraFallback?.protectedCrossingVerified ? protectedFallbackScenarioId(sceneResult.mode) : result.scenario.id;
  const rawActiveMotion = hasRun ? frameFor(activeMotionScenarioId, result.mode, animationStep) : idleFrame();
  const activeMotion = sceneResult.cameraFallback?.protectedCrossingVerified ? rawActiveMotion : applyConfidenceSafetyOverride(rawActiveMotion, sceneResult.confidenceAssessment);
  const standardActiveTiming = hasRun ? timingFor(activeMotionScenarioId, result.mode, animationStep) : { durationMs: 0, protectedWalkSecondsAtStart: null };
  const activeTiming = sceneResult.cameraFallback?.protectedCrossingVerified && rawActiveMotion.pedestrianSignal === "WALK"
    ? { durationMs: standardActiveTiming.durationMs * (DEGRADED_PROTECTED_WALK_SECONDS / 12), protectedWalkSecondsAtStart: standardActiveTiming.protectedWalkSecondsAtStart === null ? null : Math.ceil(standardActiveTiming.protectedWalkSecondsAtStart * (DEGRADED_PROTECTED_WALK_SECONDS / 12)) }
    : standardActiveTiming;
  const elapsedSeconds = Math.max(0, Math.floor((clockNow - frameStartedAt) / 1_000));
  const frameSecondsRemaining = isAnimating ? Math.max(0, Math.ceil((frameStartedAt + activeTiming.durationMs - clockNow) / 1_000)) : 0;
  const phaseSeconds = activeTiming.protectedWalkSecondsAtStart === null
    ? frameSecondsRemaining
    : Math.max(0, activeTiming.protectedWalkSecondsAtStart - elapsedSeconds);
  const timelineProgress = !hasRun ? 0 : isAnimating ? Math.round(((activeTimelineStep + 1) / TIMELINE_STAGES.length) * 100) : getProgress(result.timeline);
  const violationHistoryEntries = useMemo(() => history.filter((item) => (item.scenario.violation || item.emergencyPriority) && !hiddenLogSessions.has(item.sessionId)).flatMap((item) => {
    const visibleEntries = hasRun && item.sessionId === result.sessionId ? item.eventLog.slice(0, animationStep + 1) : item.eventLog;
    return visibleEntries.map((entry) => ({ ...entry, id: `${item.sessionId}-${entry.id}`, message: `${item.scenario.label}: ${entry.message}` }));
  }), [animationStep, hasRun, hiddenLogSessions, history, result.sessionId]);

  useEffect(() => {
    if (!isAnimating) return;
    const clock = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(clock);
  }, [isAnimating]);

  useEffect(() => {
    if (!isAnimating || activeTiming.durationMs <= 0) return;
    const timer = window.setTimeout(() => {
      if (animationStep >= MOTION_FRAME_COUNT - 2) {
        setAnimationStep(MOTION_FRAME_COUNT - 1);
        setIsAnimating(false);
        setClockNow(Date.now());
        setAnnouncement(`${result.scenario.label} completed. Seven chronological stages recorded at 100 percent.`);
      } else {
        const nextStart = Date.now();
        setAnimationStep((step) => step + 1);
        setFrameStartedAt(nextStart);
        setClockNow(nextStart);
      }
    }, activeTiming.durationMs);
    return () => window.clearTimeout(timer);
  }, [activeTiming.durationMs, animationStep, isAnimating, result.scenario.label]);

  useEffect(() => {
    if (!hasRun || activeMotion.controller !== "CRITICAL_ALARM" || alarmedSession.current === result.sessionId) return;
    alarmedSession.current = result.sessionId;
    playCriticalAlarm();
    setAnnouncement(`Critical incident detected in ${result.scenario.label}. Three short simulated alarm tones sounded. Both vehicles STOP; pedestrian HOLD.`);
  }, [activeMotion.controller, hasRun, result.scenario.label, result.sessionId]);

  useEffect(() => {
    if (!emergencyRunning || !emergencyPriority) return;
    const timer = window.setTimeout(() => {
      if (emergencyStage >= emergencyPriority.frames.length - 1) {
        setEmergencyStage(emergencyPriority.frames.length - 1);
        setEmergencyRunning(false);
        if (emergencyPriority.priorityStatus === "active") {
          setEmergencyPriority({ ...emergencyPriority, priorityStatus: "complete" });
        }
        setAnnouncement("Emergency priority sequence complete. Crossing recovered to normal operation.");
      } else setEmergencyStage((stage) => stage + 1);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [emergencyPriority, emergencyRunning, emergencyStage]);

  function changeMode(nextMode: CrossingMode) {
    setIsAnimating(false);
    setEmergencyRunning(false);
    setEmergencyPriority(null);
    setMode(nextMode);
    const first = SCENARIOS.find((item) => item.supportedModes.includes(nextMode));
    if (first) setScenarioId(first.id);
    setAnimationStep(0);
    setHasRun(false);
    setFallbackRequested(false);
    setDuplicateButtonPresses(0);
  }

  function executeSimulation(manualCrossingRequest = fallbackRequested) {
    try {
      const next = runSimulation({ mode, scenarioId, operatingConditions, manualCrossingRequest, duplicateButtonPresses }, new Date());
      setResult(next);
      setHistory((current) => [next, ...current].slice(0, 12));
      setReviewStatus("pending");
      setView("simulator");
      setAnimationStep(0);
      setHasRun(true);
      setIsAnimating(true);
      const startedAt = Date.now();
      setFrameStartedAt(startedAt);
      setClockNow(startedAt);
      setMockNotificationStatus(next.scenario.severity === "critical" ? "sent" : "idle");
      alarmedSession.current = null;
      setAnnouncement(`${next.scenario.label} animation started.`);
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "The simulation could not run.");
    }
  }

  function executeEmergencyPriority() {
    const base = runSimulation({ mode, scenarioId: `${mode}-no-violation` as ScenarioId, operatingConditions }, new Date());
    const priority = createEmergencyPriorityRecord({ vehicleType: emergencyType, direction: emergencyDirection });
    const next: SimulationResult = { ...base, sessionId: `EMG-${Date.now()}`, emergencyReviewRequired: true, emergencyPriority: priority, eventLog: priority.eventLog };
    setEmergencyPriority(priority);
    setEmergencyStage(0);
    setEmergencyRunning(true);
    setResult(next);
    setHistory((current) => [next, ...current].slice(0, 12));
    setHasRun(true);
    setIsAnimating(false);
    setReviewStatus("pending");
    setView("simulator");
    setAnnouncement(`${emergencyType} emergency priority sequence started from ${emergencyDirection}.`);
  }

  function requestDegradedCrossing() {
    if (fallbackRequested || isAnimating) {
      setDuplicateButtonPresses((count) => count + 1);
      setAnnouncement("Crossing request already registered. Duplicate press ignored.");
      return;
    }
    setFallbackRequested(true);
    setAnnouncement("Crossing request registered. Please wait while the simulated controller establishes protection.");
    executeSimulation(true);
  }

  function resetSequence() {
    setIsAnimating(false);
    setEmergencyRunning(false);
    setEmergencyPriority(null);
    setEmergencyStage(0);
    setAnimationStep(0);
    setHasRun(false);
    setMockNotificationStatus("idle");
    setFallbackRequested(false);
    setDuplicateButtonPresses(0);
    setAnnouncement(`${selectedScenario.label} reset to Approach. Historical incident records were preserved.`);
  }

  function clearEventLog() {
    setHiddenLogSessions((current) => new Set([...current, ...history.filter((item) => item.scenario.violation || item.emergencyPriority).map((item) => item.sessionId)]));
    setAnnouncement("Violation event log cleared from this local view.");
  }

  function exportReport() {
    const pdf = createSimulationReportPdf(history);
    const pdfBuffer = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(pdfBuffer).set(pdf);
    const url = URL.createObjectURL(new Blob([pdfBuffer], { type: "application/pdf" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "smartcross-simulation-report.pdf";
    anchor.click();
    URL.revokeObjectURL(url);
    setAnnouncement("Simulation report downloaded as PDF.");
  }

  async function logOut() {
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed.");
      router.replace("/access");
      router.refresh();
    } catch {
      setAnnouncement("Sign-out failed. Try again.");
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">AJ</div>
        <div className="brand-copy"><strong>SmartCross</strong></div>
        <div className="topbar-actions"><div className="boundary-chip"><span /> Simulation only</div><button className="logout-button" type="button" onClick={logOut}>Log out</button></div>
      </header>

      <nav className="main-nav" aria-label="Primary navigation">
        {navigation.map((item) => (
          <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}>{item.label}</button>
        ))}
        <span className="supervised-label">Authorised demonstration. Supervised simulation.</span>
      </nav>

      <main id="main-content" className="page-content">
        <div className="page-heading">
          <div><span className="eyebrow">{viewHeadings[view].eyebrow}</span><h1>{viewHeadings[view].title}</h1><p>{viewHeadings[view].description}</p></div>
          <Badge severity={result.scenario.severity}>{result.scenario.severity === "routine" ? "Normal operation" : capitaliseEnglish(result.scenario.severity)}</Badge>
        </div>

        <div className="prototype-notice" role="note"><strong>Educational prototype: no live dispatch connection.</strong><span>Local deterministic mock data only. Not affiliated with or endorsed by MPAJ. Do not use this website to report an active emergency.</span></div>
        <div className="sr-only" aria-live="polite">{announcement}</div>

        {view === "overview" ? <Overview history={history} result={result} onOpenSimulator={() => setView("simulator")} /> : null}
        {view === 'simulator' ? <div className="ht-sequence-select"><label htmlFor="sequence-select">Simulation sequence</label><select id="sequence-select" disabled={isAnimating||emergencyRunning||heavyRunning} value={sequence} onChange={e=>setSequence(e.target.value)}><option value="crossing">Crossing and existing violation sequences</option><option value="heavy">Peak-Hour Heavy Traffic and Queue Stabilisation</option></select></div> : null}
        {view === 'simulator' && sequence === 'heavy' ? <HeavyTrafficPanel mode={mode} result={heavySceneResult} onModeChange={changeMode} onBusy={setHeavyRunning}/> : null}
        {view === "simulator" && sequence === 'crossing' ? (
          <div className="simulator-layout simulator-reference-layout">
            <section className="simulator-board" aria-labelledby="simulator-board-title">
              <div className="simulator-release-bar"><span><i /> SIMULATION ONLY</span><span>One crossing view. No live enforcement or signal connection.</span></div>
              <div className="simulator-board-intro"><div><span className="eyebrow">ENHANCED CROSSING OPERATIONS SIMULATOR</span><h2 id="simulator-board-title">Follow every approach, conflict, and response.</h2><p>The normal crossing provides 20 conditions. The school crossing provides 21. Each condition uses a traceable seven-stage sequence.</p></div><span className="simulation-value">Simulation value</span></div>
              <div className="crossing-mode-tabs" aria-label="Crossing type">
                <button className={mode === "normal" ? "selected" : ""} aria-pressed={mode === "normal"} onClick={() => changeMode("normal")}><span>ZBR</span><strong>Normal zebra crossing</strong><small>Mid-block road and public footpath</small></button>
                <button className={mode === "school" ? "selected" : ""} aria-pressed={mode === "school"} onClick={() => changeMode("school")}><span>SKL</span><strong>School crossing</strong><small>School forecourt and supervised courtyard</small></button>
              </div>
              <div className="simulator-stage">
                <div className="workspace-column">
                  <CrossingView result={sceneResult} animationFrame={sceneStep} isAnimating={isAnimating || emergencyRunning} hasRun={hasRun} controllerCountdown={activeEmergencyFrame ? Math.max(0, 12 - emergencyStage) : phaseSeconds} motionDurationMs={activeTiming.durationMs || STANDARD_MOTION_FRAME_MS} emergencyPriority={emergencyPriority} emergencyFrame={activeEmergencyFrame} />
                  <div className="simulation-command-bar">
                    <div className="simulation-command-select">
                      <span className="eyebrow">40 M RADAR + CCTV MONITORING</span>
                      <label id="simulation-command-title" htmlFor="scenario-select">Crossing condition ({availableScenarios.length} options)</label>
                      <select id="scenario-select" aria-describedby="scenario-help" value={scenarioId} disabled={isAnimating} onChange={(event) => { setIsAnimating(false); setScenarioId(event.target.value as ScenarioId); setAnimationStep(0); setHasRun(false); setFallbackRequested(false); setDuplicateButtonPresses(0); }}>{availableScenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                      <small id="scenario-help">{selectedScenario.summary}</small>
                    </div>
                    <div className="simulation-command-actions">
                      {cameraDegraded ? <Button onClick={requestDegradedCrossing} disabled={isAnimating || (hasRun && fallbackRequested)}>{fallbackRequested ? "Crossing request registered" : "Press pedestrian request button"}</Button> : <Button onClick={() => executeSimulation(false)} disabled={isAnimating || (hasRun && result.scenario.severity === "critical")}>{isAnimating ? "Simulation running..." : hasRun && result.scenario.severity === "critical" ? "Reset required before replay" : hasRun ? "Replay deterministic sequence" : "Run seven-stage simulation"}</Button>}
                      {hasRun ? <Button variant="secondary" onClick={resetSequence}>{result.scenario.severity === "critical" ? "Reset simulation" : "Reset sequence"}</Button> : null}
                    </div>
                  </div>
                  <div className="emergency-priority-controls" aria-labelledby="emergency-priority-title">
                    <div><span className="eyebrow">EMERGENCY PRIORITY MODE</span><h3 id="emergency-priority-title">Incoming emergency vehicle sequence</h3><p>CCTV + radar validates a 40 m approach. Existing pedestrians finish safely; new entry is held while conflicting traffic stops.</p></div>
                    <div className="emergency-priority-fields"><label>Vehicle<select value={emergencyType} disabled={isAnimating || emergencyRunning} onChange={(event) => setEmergencyType(event.target.value as EmergencyVehicleType)}><option value="ambulance">Ambulance</option><option value="police">Police</option><option value="fire-rescue">Fire / rescue</option></select></label><label>Direction<select value={emergencyDirection} disabled={isAnimating || emergencyRunning} onChange={(event) => setEmergencyDirection(event.target.value as EmergencyDirection)}><option value="Eastbound">Eastbound</option><option value="Westbound">Westbound</option></select></label><Button onClick={executeEmergencyPriority} disabled={isAnimating || emergencyRunning}>Run emergency priority</Button></div>
                    {activeEmergencyFrame && emergencyPriority ? <div className="emergency-priority-status" role="status"><b>{activeEmergencyFrame.state}</b><span>{emergencyPriority.vehicleType} | {emergencyPriority.direction} | {emergencyPriority.detectionDistanceMeters} m | {emergencyPriority.speedKmh} km/h</span><small>Detection: {emergencyPriority.detectionSource} | Validation: {emergencyPriority.validationStatus} | Crossing: {activeEmergencyFrame.crossingStatus} | CCTV range: {emergencyPriority.cctvDetectionRangeMeters} m | Priority: {emergencyPriority.priorityStatus}</small></div> : null}
                  </div>
                  <CctvEvidencePanel result={sceneResult} active={hasRun && sceneStep >= 2} />
                  <SimulationStats history={history} />
                </div>
                <Card className="control-panel">
                  <div className={`phase-panel confidence-${sceneResult.confidenceAssessment.band}`} data-confidence-band={sceneResult.confidenceAssessment.band}><span>Current phase</span><strong>{hasRun ? activeStage.name : "Ready"}</strong><div className="phase-metrics"><p><b data-testid="controller-countdown">{phaseSeconds}s</b><small>Real-time countdown</small></p><p><b data-testid="adjusted-confidence">{Math.round(sceneResult.detectionConfidence * 100)}%</b><small>Simulated system detection confidence</small></p></div><div className="confidence-status" role="status"><b>{sceneResult.confidenceAssessment.label}</b><span>{sceneResult.cameraFallback?.protectedCrossingVerified ? "AI input bypassed. Button-initiated fixed traffic control is active." : sceneResult.confidenceAssessment.action}</span></div><em>{capitaliseEnglish(activeMotion.activeSensor)} sensor, {activeMotion.risk.toLowerCase()} risk, {activeMotion.pedestrianSignal === "WALK" && activeMotion.routeClear ? "protected WALK" : "pedestrian WAIT/HOLD"}</em></div>
                  <div className="card-heading"><div><span className="eyebrow">AIM METHOD</span><h2 id="control-title">Monitor the selected condition</h2></div></div>
                  <div className="input-preview"><span className="eyebrow">SIMULATED INPUT</span><strong>{selectedScenario.detection}</strong><span>Rules-based, deterministic, and not connected to a live feed</span></div>
                  <OperatingConditionControls value={operatingConditions} disabled={isAnimating} onChange={(next) => { setOperatingConditions(next); setFallbackRequested(false); setDuplicateButtonPresses(0); }} />
                  {cameraDegraded ? <div className={`camera-fallback-panel ${fallbackAssessment.requestState}`} role="status" aria-live="polite"><strong>{fallbackAssessment.message}</strong><span>The adjacent request button registers demand only. WALK remains controlled by the simulated RED, all-red, stop-line and secondary-sensor interlocks.</span></div> : null}
                  <div className="sequence-rule"><strong>Pedestrian sequence</strong><span>{selectedScenario.violation ? "The assigned violation sequence moves each actor in order. The WALK signal appears only after all vehicles have stopped and the route has been verified as clear." : "No violation: stop both approaches, display WALK, clear the route, and then resume traffic in sequence."}</span></div>
                  <div className="sequence-rule" data-testid="authoritative-decision"><strong>Authoritative safety decision</strong><span>{sceneResult.safetyDecision.state}: {sceneResult.safetyDecision.reason}</span><small>One phase clock: {sceneResult.safetyDecision.phaseClock}. Rejected commands: {sceneResult.safetyDecision.rejectedCommands.length ? sceneResult.safetyDecision.rejectedCommands.join(", ") : "none"}.</small></div>
                  <p className="helper">Creates a local record only. No external service is contacted.</p>
                </Card>
              </div>
            </section>

            <Card className="timeline-card full-span" aria-labelledby="timeline-title">
              <div className="card-heading"><div><span className="eyebrow">ANALYSE AND EVALUATE</span><h2 id="timeline-title">Seven-stage simulation sequence</h2></div><div className="completion"><strong>{timelineProgress}%</strong><span>{isAnimating ? "Running" : hasRun ? "Complete" : "Ready"}</span></div></div>
              <div className="progress-track" aria-label={`${timelineProgress} percent complete`}><span style={{ width: `${timelineProgress}%` }} /></div>
              <TimelineRail stages={result.timeline} activeIndex={hasRun ? activeTimelineStep : 0} />
            </Card>

            {hasRun && result.scenario.violation ? <CountermeasurePanel result={result} /> : null}

            <MockNotificationWorkflow
              result={result}
              active={hasRun && result.scenario.severity === "critical"}
              status={mockNotificationStatus}
              onStatus={(status) => {
                setMockNotificationStatus(status);
                setAnnouncement(status === "acknowledged" ? "Mock alert acknowledged in this local prototype." : "Mock notification workflow resolved locally.");
              }}
            />

            <Card className="log-card full-span" aria-labelledby="log-title">
              <div className="card-heading"><div><span className="eyebrow">ORIGINAL VIOLATION-HISTORY RECORD</span><h2 id="log-title">Violation event log</h2></div><div className="log-actions"><label className="compact-field"><span>Filter</span><select value={logFilter} onChange={(event) => setLogFilter(event.target.value as typeof logFilter)}><option value="all">All events</option><option value="sensor">Sensor</option><option value="detection">Detection</option><option value="controller">Controller</option><option value="safety">Safety</option><option value="outcome">Outcome</option></select></label><Button variant="secondary" onClick={clearEventLog} disabled={violationHistoryEntries.length === 0}>Clear log</Button></div></div>
              <EventLog entries={violationHistoryEntries} filter={logFilter} />
            </Card>
          </div>
        ) : null}
        {view === "technology" ? <TechnologyReference /> : null}
        {view === "scenarios" ? <ScenariosReference /> : null}
        {view === "incidents" ? <IncidentReview incidents={incidents} result={result} reviewStatus={reviewStatus} onReview={setReviewStatus} /> : null}
        {view === "reports" ? <Reports history={history} onExport={exportReport} /> : null}
      </main>
      <footer><span>SmartCross simulation build</span><span>Safety rule: Display WALK only when the route is clear and both traffic approaches are stopped.</span></footer>
    </div>
  );
}

function CountermeasurePanel({ result }: { result: SimulationResult }) {
  return <Card className="countermeasure-card full-span" aria-labelledby="countermeasure-title"><div className="card-heading"><div><span className="eyebrow">CONTEXTUAL SAFETY RESPONSE</span><h2 id="countermeasure-title">Countermeasures for {result.scenario.label}</h2><p>Engineering and operational options for authorised assessment after this simulated violation.</p></div><Badge severity={result.scenario.severity}>Human review</Badge></div><ol>{result.countermeasures.map((measure, index) => <li key={measure}><span aria-hidden="true">{index + 1}</span><p>{measure}</p></li>)}</ol><small>Recommendations are conceptual. Site surveys, professional design, authority approval, and local standards are required before implementation.</small></Card>;
}

function OperatingConditionControls({ value, disabled, onChange }: { value: OperatingConditions; disabled: boolean; onChange: (value: OperatingConditions) => void }) {
  type UserConditionKey = "weather" | "lighting" | "visibility";
  const update = <Key extends UserConditionKey>(key: Key, next: OperatingConditions[Key]) => {
    const selected = { weather: value.weather, lighting: value.lighting, visibility: value.visibility, [key]: next };
    onChange(deriveOperatingConditions(selected));
  };
  const conditionSummary = value.conditionQuality === 1 ? "No simulated environmental reduction." : "Includes individual factors and overlap penalties.";
  return <fieldset className="operating-condition-controls" disabled={disabled}><legend>Simulated operating conditions</legend><p>Weather, lighting and visibility combine automatically. Rain also creates simulated road ponding and reduced traction; the percentage is not a live sensor reading.</p><div>
    <label><span>Weather</span><select aria-label="Weather condition" value={value.weather} onChange={(event) => update("weather", event.target.value as OperatingConditions["weather"])}><option value="dry">Dry</option><option value="rain">Rain</option></select></label>
    <label><span>Lighting</span><select aria-label="Lighting condition" value={value.lighting} onChange={(event) => update("lighting", event.target.value as OperatingConditions["lighting"])}><option value="day">Day</option><option value="night">Night</option></select></label>
    <label><span>Visibility</span><select aria-label="Visibility condition" value={value.visibility} onChange={(event) => update("visibility", event.target.value as OperatingConditions["visibility"])}><option value="clear">Clear air</option><option value="haze">Haze</option><option value="dense-haze">Dense haze</option></select></label>
    <div className={`derived-sensor-health sensor-${value.sensorHealth}`} role="status" aria-label={`Derived sensor health: ${capitaliseEnglish(value.sensorHealth)}. Combined input quality: ${Math.round(value.conditionQuality * 100)} percent.`}><span>Automatically derived sensor health</span><strong>{capitaliseEnglish(value.sensorHealth)} - {Math.round(value.conditionQuality * 100)}%</strong><small>{conditionSummary}</small></div>
  </div><details className="condition-method"><summary>How the simulated percentage is combined</summary><p>Provisional factors: rain with wet-road ponding 91%, night 93%, haze 94%, and dense haze 84%. Factors multiply, then overlap penalties apply for rain with night or haze, night with haze, and three simultaneous adverse inputs. Scenario confidence equals its baseline multiplied by this combined input quality.</p></details></fieldset>;
}

function CctvEvidencePanel({ result, active }: { result: SimulationResult; active: boolean }) {
  const evidence = active ? result.cctvEvidence : null;
  return <Card className={`cctv-evidence-card${evidence ? " evidence-active" : ""}`} aria-labelledby="cctv-evidence-title">
    <div><span className="cctv-lens" aria-hidden="true" /><span><small>CCTV / PLATE RECOGNITION</small><h3 id="cctv-evidence-title">{evidence ? "Violation evidence captured" : "Camera ready"}</h3></span></div>
    {evidence ? <><div className="evidence-label" role="status">SIMULATED EVIDENCE - HUMAN REVIEW REQUIRED</div><dl><div><dt>Synthetic plate</dt><dd className="plate-number">{evidence.plateNumber}</dd></div><div><dt>Camera ID</dt><dd>{evidence.cameraId}</dd></div><div><dt>Activation stage</dt><dd>{evidence.captureStage}</dd></div><div><dt>Timestamp</dt><dd>{formatTimestamp(evidence.capturedAt)}</dd></div><div><dt>Vehicle direction</dt><dd>{evidence.vehicleDirection}</dd></div><div><dt>Detected condition</dt><dd>{evidence.detectedCondition}</dd></div><div><dt>Recognition confidence</dt><dd>{Math.round(evidence.recognitionConfidence * 100)}% simulated</dd></div></dl><p className="activation-reason">{evidence.activationReason}</p></> : <p>{result.scenario.violation ? "ANPR remains armed but inactive until this violation reaches the Detected stage." : "ANPR remains inactive because no violation is present; no plate is captured."}</p>}
    <span className="cctv-boundary">Simulated CCTV and synthetic plate data. No live camera, database lookup, enforcement, or personal identification.</span>
  </Card>;
}

function MockNotificationWorkflow({ result, active, status, onStatus }: { result: SimulationResult; active: boolean; status: MockNotificationStatus; onStatus: (status: MockNotificationStatus) => void }) {
  if (!active) return <Card className="mock-notification-card full-span mock-notification-empty"><span className="eyebrow">MOCK NOTIFICATION WORKFLOW</span><h2>Critical incident notification test</h2><p>Only collision and fire scenarios create contextual local mock recipients. All other violations remain in the authorised operator review queue. No external recipient is connected.</p></Card>;

  const acknowledged = status === "acknowledged" || status === "resolved";
  const resolved = status === "resolved";
  const steps = [
    ["Detected", true],
    ["Verification required", true],
    ["Preliminary alert issued", true],
    ["Mock notification recorded", status !== "idle"],
    ["Acknowledged", acknowledged],
    ["Incident resolved", resolved],
  ] as const;

  return <Card className="mock-notification-card full-span" aria-labelledby="mock-notification-title">
    <div className="card-heading"><div><span className="eyebrow">MOCK NOTIFICATION WORKFLOW</span><h2 id="mock-notification-title">{result.scenario.label}</h2></div><Badge severity={result.scenario.severity}>{capitaliseEnglish(result.scenario.severity)}</Badge></div>
    <div className="mock-boundary" role="note"><strong>No external message can leave prototype mode.</strong><span>All recipients, alerts, acknowledgements and dispatch states below are fictional local records.</span></div>
    <div className="mock-notification-grid">
      <section aria-labelledby="mock-recipients-title"><h3 id="mock-recipients-title">Contextual fictional recipients</h3><ul className="mock-recipient-list">{result.notificationRecipients.map((recipient) => <li key={recipient.name}><strong>{recipient.name}</strong><span>{recipient.purpose} - mock queue only</span></li>)}</ul></section>
      <section aria-labelledby="mock-workflow-title"><h3 id="mock-workflow-title">Local workflow state</h3><ol className="workflow-steps">{steps.map(([label, complete]) => <li className={complete ? "complete" : "pending"} key={label}><span aria-hidden="true">{complete ? "Done" : "Pending"}</span>{label}</li>)}</ol><div className="mock-actions">{status === "sent" ? <Button onClick={() => onStatus("acknowledged")}>Acknowledge mock alert</Button> : null}{status === "acknowledged" ? <Button onClick={() => onStatus("resolved")}>Resolve mock workflow</Button> : null}{status === "resolved" ? <Button disabled>Mock workflow resolved</Button> : null}</div></section>
    </div>
    <div className="mock-audit"><strong>Timestamped local audit trail</strong><p><time dateTime={result.timeline[0].timestamp}>{formatTimestamp(result.timeline[0].timestamp)}</time><span>Detection recorded by the deterministic simulator.</span></p><p><time dateTime={result.timeline[2].timestamp}>{formatTimestamp(result.timeline[2].timestamp)}</time><span>Preliminary alert placed in the local mock queue; no transmission occurred.</span></p></div>
  </Card>;
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <Card className="metric"><span>{label}</span><strong>{value}</strong><small>{hint}</small></Card>;
}

function SimulationStats({ history }: { history: SimulationResult[] }) {
  const violations = history.filter((item) => item.scenario.violation && item.confidenceAssessment.conclusionPermitted);
  const unconfirmed = history.filter((item) => item.scenario.violation && !item.confidenceAssessment.conclusionPermitted).length;
  const count = (category: SimulationResult["scenario"]["violationCategory"]) => violations.filter((item) => item.scenario.violationCategory === category).length;
  const stats = [
    ["Total violations", violations.length], ["Failure-to-yield violations", count("yield")], ["Speed violations", count("speed")],
    ["Crossing obstructions", count("obstruction")], ["Motorcycle violations", count("motorcycle")],
    ["Critical incidents", violations.filter((item) => item.incident).length], ["Unconfirmed low-confidence events", unconfirmed], ["Normal-crossing violations", violations.filter((item) => item.mode === "normal").length], ["School-crossing violations", violations.filter((item) => item.mode === "school").length],
  ] as Array<[string, number]>;
  const visibleStats = stats.filter(([label, value]) => label === "Total violations" || value > 0);
  return <section className="session-statistics" aria-labelledby="session-statistics-title"><header><div><span className="eyebrow">CURRENT SESSION TOTALS</span><h3 id="session-statistics-title">Simulated violation counters</h3></div><p>{violations.length === 0 && unconfirmed === 0 ? "No violations have been run in this local session. Category counters appear after the first violation simulation." : `${violations.length} simulated violation${violations.length === 1 ? " has" : "s have"} been recorded; ${unconfirmed} low-confidence event${unconfirmed === 1 ? " remains" : "s remain"} unconfirmed.`}</p></header>{violations.length || unconfirmed ? <div className="simulation-stats" aria-label="Current session simulation counters">{visibleStats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div> : <div className="session-statistics-empty" role="status">No violation totals to display.</div>}</section>;
}

function TechnologyReference() {
  const tiers = [
    ["01", "Field sensing and CCTV nodes", "Pedestrian demand, vehicle approach speed, stop-line movement, kerbside occupancy, accessible requests, and synthetic plate captures are represented with local mock inputs."],
    ["02", "Crossing safety controller", "Deterministic rules compare movement, signal state and route occupancy, then apply a conservative local response."],
    ["03", "Authorised review layer", "Event summaries and synthetic plate records support maintenance, planning and human review without a live camera, vehicle database, or enforcement connection."],
  ];
  return <div className="reference-page"><div className="reference-list">{tiers.map(([number, title, copy]) => <Card key={number} className="reference-row"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p><small>Conceptual prototype; validation required</small></div></Card>)}</div><div className="safety-feature"><div><span className="eyebrow">FAIL-SAFE BEHAVIOUR</span><h2>Uncertainty leads to a conservative response.</h2><p>Stale, obstructed, or conflicting inputs keep pedestrians waiting and send the simulated case to human review.</p></div><Card><span>Safety invariant</span><strong>The pedestrian signal displays WALK only when both traffic approaches are stopped and the route is clear.</strong></Card></div><div className="governance-grid"><Card><span className="eyebrow">ACCESSIBILITY</span><h2>Operable and understandable</h2><p>Keyboard controls, visible focus, text-labelled states, reduced-motion support and responsive layouts are part of the test contract.</p></Card><Card><span className="eyebrow">GOVERNANCE</span><h2>Evidence needs human judgement</h2><p>Every plate is synthetic, confidence is simulated, uncertain detections remain unconfirmed, and no automated enforcement conclusion is permitted.</p></Card><Card><span className="eyebrow">MPAJ RESPONSIBILITY</span><h2>Operational authority remains external</h2><p>MPAJ would define operating procedures, approve field validation, assign trained reviewers, maintain assets and coordinate any real response through approved channels. This prototype performs none of those duties.</p></Card></div></div>;
}

function ScenariosReference() {
  const normalConditions = SCENARIOS.filter((item) => item.supportedModes.includes("normal"));
  const schoolConditions = SCENARIOS.filter((item) => item.supportedModes.includes("school"));
  const matrixLabel = (label: string) => label.replace(/^\d+\.\s*/, "");
  return <div className="reference-page"><div className="scenario-feature"><div><span className="eyebrow">DRIVER-BEHAVIOUR FOCUS</span><h2>Detect risky movement. Protect people. Escalate for human review.</h2></div><p>The prototype reacts to observable simulated movement, not identity or intent. Every violation prevents pedestrian release until a verified clear route permits a protected recovery.</p></div><div className="scenario-card-grid"><Card><span className="scenario-code">ZBR</span><small>REPRESENTATIVE MPAJ MID-BLOCK ROAD</small><h2>Normal zebra crossing</h2><p>One direct route crosses opposing traffic lanes between a public footpath and tactile waiting zones.</p><strong>Mitigation approach</strong><span>Stop traffic in both directions before serving the protected route.</span></Card><Card><span className="scenario-code">SKL</span><small>SCHOOL FORECOURT CONTEXT</small><h2>School crossing</h2><p>Children, parked vehicles, and arrival peaks are represented beside a clearly visible school courtyard.</p><strong>Mitigation approach</strong><span>Use supervised demand, lower speed thresholds, and a conservative all-red hold.</span></Card></div><Card className="condition-matrix"><div><span className="eyebrow">NORMAL CONDITION MATRIX</span><h2>20 normal-crossing conditions</h2><p>Violation 17 is excluded because a school-zone speed limit does not apply to this scenario.</p></div><ol>{normalConditions.map((item) => <li key={item.id}>{matrixLabel(item.label)}</li>)}</ol></Card><Card className="condition-matrix"><div><span className="eyebrow">SCHOOL CONDITION MATRIX</span><h2>21 school-crossing conditions</h2><p>The school scenario retains violation 17: Exceeded school-zone speed limit.</p></div><ol>{schoolConditions.map((item) => <li key={item.id}>{matrixLabel(item.label)}</li>)}</ol></Card></div>;
}

function Overview({ history, result, onOpenSimulator }: { history: SimulationResult[]; result: SimulationResult; onOpenSimulator: () => void }) {
  const incidentCount = history.filter((item) => item.incident).length;
  return <div className="overview-grid"><Card className="hero-card"><span className="eyebrow">CURRENT STATUS</span><h2>Crossing protected</h2><p>{result.signal.reason}</p><div className="signal-summary"><span>Vehicle <strong>{result.signal.vehicle}</strong></span><span>Pedestrian <strong>{result.signal.pedestrian}</strong></span></div><Button onClick={onOpenSimulator}>Open simulator</Button></Card><div className="overview-metrics"><Metric label="Sessions" value={history.length} hint="this local visit" /><Metric label="Timeline completion" value="100%" hint="latest session" /><Metric label="Incidents" value={incidentCount} hint="awaiting human review" /><Metric label="External connections" value={0} hint="simulation boundary" /></div><Card className="full-span"><div className="card-heading"><div><span className="eyebrow">REMEMBER AND UNDERSTAND</span><h2>How this prototype responds</h2></div></div><div className="explain-grid"><p><strong>1. Approach</strong><span>Place each road user in a deterministic starting context.</span></p><p><strong>2. Detect</strong><span>Compare movement, signal state, and crossing occupancy.</span></p><p><strong>3. Protect</strong><span>Escalate, resolve the conflict, and preserve the STOP-before-WALK rule.</span></p><p><strong>4. Record</strong><span>Keep seven timestamps and the original event log for review.</span></p></div></Card></div>;
}

function IncidentReview({ incidents, result, reviewStatus, onReview }: { incidents: SimulationResult[]; result: SimulationResult; reviewStatus: "pending" | "confirmed" | "dismissed"; onReview: (status: "pending" | "confirmed" | "dismissed") => void }) {
  const active = result.incident ? result : incidents[0];
  if (!active) return <Card className="empty-state page-empty"><strong>No critical incidents recorded</strong><span>Run a critical violation scenario to test the human-confirmation workflow.</span></Card>;
  return <div className="incident-grid"><Card className="incident-alert"><div><span className="alert-symbol" aria-hidden="true">!</span><div><span className="eyebrow">SIMULATED CRITICAL INCIDENT</span><h2>{active.scenario.label}</h2></div></div><p>{active.scenario.summary}</p><dl><div><dt>Session</dt><dd>{active.sessionId}</dd></div><div><dt>Confidence</dt><dd>{Math.round(active.detectionConfidence * 100)}% simulated</dd></div><div><dt>Status</dt><dd>{capitaliseEnglish(reviewStatus)}</dd></div></dl><div className="confirmation-box"><strong>Human confirmation required</strong><span>No responder has been contacted. Confirming only updates this local prototype.</span><div><Button onClick={() => onReview("confirmed")}>Confirm for local record</Button><Button variant="secondary" onClick={() => onReview("dismissed")}>Mark false positive</Button></div></div></Card><Card><span className="eyebrow">RESPONSE TRACE</span><h2>Safety actions</h2><ol className="action-list"><li>Conflicting vehicle movement set to STOP.</li><li>Protected crossing phase locked in simulation.</li><li>Incident added to the review queue.</li><li>Automatic emergency dispatch remains disabled.</li></ol></Card></div>;
}

function Reports({ history, onExport }: { history: SimulationResult[]; onExport: () => void }) {
  return <Card className="reports-card"><div className="card-heading"><div><span className="eyebrow">CREATE</span><h2>One-page occurrence brief</h2><p>Download an essential one-page PDF for the most recent simulation occurrence.</p></div><Button onClick={onExport} disabled={history.length === 0}>Download current occurrence</Button></div>{history.length ? <div className="table-wrap"><table><thead><tr><th>Session</th><th>Scenario</th><th>Mode</th><th>Confidence</th><th>Outcome</th><th>Completed (MYT)</th></tr></thead><tbody>{history.map((item) => <tr key={item.sessionId}><td className="mono">{item.sessionId}</td><td>{item.scenario.label}</td><td>{capitaliseEnglish(item.mode)}</td><td>{Math.round(item.detectionConfidence * 100)}% - {item.confidenceAssessment.label}</td><td><Badge severity={item.scenario.severity}>{!item.confidenceAssessment.conclusionPermitted ? "No conclusion" : item.incident ? "Critical review" : item.scenario.violation ? "Violation recorded" : "No violation"}</Badge></td><td>{formatTimestamp(item.completedAt)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No session reports yet</strong><span>Run a simulation to create the first local report record.</span></div>}</Card>;
}
