"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CrossingMap, type Context, type Junction } from "./phase-two-design";
import styles from "./phase-two-design.module.css";

type View = "simulator" | "technology" | "scenarios" | "incidents" | "reports";
type Scenario = "baseline" | "speeding" | "red-light" | "blocked" | "collision";
type Weather = "Dry" | "Rain";
type Light = "Day" | "Night";
type Visibility = "Clear" | "Haze";

const stages = ["Approach", "Initiation", "Detected", "Escalation", "Conflict", "Response", "Outcome"];
const scenarios: Array<{ id: Scenario; label: string; severity: string; description: string }> = [
  { id: "baseline", label: "No violation - protected crossing", severity: "Routine", description: "Traffic stops before WALK and the pedestrian route clears safely." },
  { id: "speeding", label: "Approach speeding", severity: "High", description: "Radar identifies excessive approach speed and withholds WALK." },
  { id: "red-light", label: "Red-signal violation", severity: "High", description: "The controller holds pedestrians while a stop-line breach is reviewed." },
  { id: "blocked", label: "Crossing or ramp obstructed", severity: "Medium", description: "The designated pedestrian route remains closed until obstruction clearance." },
  { id: "collision", label: "Collision near crossing", severity: "Critical", description: "All movements freeze for a simulated incident review; no dispatch occurs." },
];

function confidenceFor(weather: Weather, light: Light, visibility: Visibility) {
  return Math.max(62, 98 - (weather === "Rain" ? 10 : 0) - (light === "Night" ? 8 : 0) - (visibility === "Haze" ? 12 : 0));
}

export function PhaseTwoDashboard() {
  const [view, setView] = useState<View>("simulator");
  const [junction, setJunction] = useState<Junction>("three-way");
  const [context, setContext] = useState<Context>("normal");
  const [scenario, setScenario] = useState<Scenario>("baseline");
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [weather, setWeather] = useState<Weather>("Dry");
  const [light, setLight] = useState<Light>("Day");
  const [visibility, setVisibility] = useState<Visibility>("Clear");
  const [history, setHistory] = useState<Array<{ id: number; scenario: Scenario; label: string; context: Context; junction: Junction }>>([]);
  const selectedScenario = scenarios.find((item) => item.id === scenario) ?? scenarios[0];
  const confidence = confidenceFor(weather, light, visibility);
  const isViolation = scenario !== "baseline";
  const vehicleSignal = stage === 0 || (stage === 6 && !isViolation) ? "GO" : "STOP";
  const pedestrianSignal = !isViolation && stage === 5 ? "WALK" : "WAIT";
  const progress = completed ? 100 : Math.round((stage / 6) * 100);
  const contextName = context === "school" ? "School crossing" : "Normal crossing";
  const junctionName = junction === "four-way" ? "Four-way intersection" : "Three-way junction";

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (stage >= 6) {
        setRunning(false);
        setCompleted(true);
        setHistory((items) => [{ id: Date.now(), scenario, label: selectedScenario.label, context, junction }, ...items].slice(0, 8));
      } else setStage((value) => value + 1);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [context, junction, running, scenario, selectedScenario.label, stage]);

  function run() { setStage(0); setCompleted(false); setRunning(true); }
  function reset() { setStage(0); setCompleted(false); setRunning(false); }
  function switchDesign(nextJunction: Junction, nextContext: Context) { setJunction(nextJunction); setContext(nextContext); reset(); }

  const detail = useMemo(() => {
    if (stage === 0) return `Radar monitors every approach while pedestrians remain inside the ${contextName.toLowerCase()} waiting grids.`;
    if (stage === 1) return "A crossing request is registered. The controller begins the vehicle clearance sequence.";
    if (stage === 2) return `${selectedScenario.label} is classified from deterministic simulated inputs at ${confidence}% confidence.`;
    if (stage === 3) return isViolation ? "The condition is escalated for safety handling and human review." : "All conflicting approaches receive STOP before pedestrian release.";
    if (stage === 4) return isViolation ? "The conflict route remains closed and the pedestrian signal stays at WAIT." : "The controller verifies zero conflicting movement and a clear crossing route.";
    if (stage === 5) return isViolation ? "WALK remains withheld; the simulated record is retained for review." : "Protected WALK is released only after all conflicting traffic is stopped.";
    return isViolation ? "Sequence closed under STOP and WAIT. No external enforcement or dispatch occurred." : "Pedestrians clear the route, WALK ends, and traffic resumes in sequence.";
  }, [confidence, contextName, isViolation, selectedScenario.label, stage]);

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}><span className={styles.brandMark}>AJ</span><span><strong>SmartCross</strong><small>PHASE 2</small></span></Link>
        <div className={styles.status}><i /> SIMULATION ONLY <span>|</span> MPAJ STUDY</div>
        <Link href="/smartcross-2-2" className={styles.back}>Open SmartCross 2.2</Link>
      </header>
      <nav className={styles.dashboardNav} aria-label="Primary navigation">
        {(["simulator", "technology", "scenarios", "incidents", "reports"] as View[]).map((item) => <button key={item} className={view === item ? styles.navActive : ""} onClick={() => setView(item)}>{item}</button>)}
        <span>Phase 2 concept system</span>
      </nav>

      <div className={styles.dashboardPage}>
        <header className={styles.pageTitle}><div><span className={styles.eyebrow}>SMART JUNCTION CROSSING SIMULATOR</span><h1>{view === "simulator" ? "See every approach. Control every conflict." : view === "technology" ? "A layered roadside safety concept." : view === "scenarios" ? "Four designs. Shared safety logic." : view === "incidents" ? "Review simulated safety events." : "Create an accountable session record."}</h1><p>SmartCross Phase 2 extends the 2.2 workflow to three-way junctions and four-way intersections without connecting to live infrastructure.</p></div><span className={styles.operationBadge}>{completed ? "SEQUENCE COMPLETE" : "CONCEPT ACTIVE"}</span></header>
        <aside className={styles.dashboardNotice}><strong>Educational prototype: no live traffic control or dispatch.</strong><span>Radar, CCTV, confidence, signal states and incident records are deterministic mock outputs. Engineering validation is required.</span></aside>

        {view === "simulator" ? <>
          <section className={styles.simBoard}>
            <div className={styles.releaseBar}><span><i /> SIMULATION ONLY</span><span>FOUR DESIGNS | ONE SAFETY INTERLOCK | HUMAN REVIEW</span></div>
            <div className={styles.boardIntro}><div><span className={styles.eyebrow}>ENHANCED JUNCTION OPERATIONS</span><h2>Follow the crossing demand, conflict and response.</h2><p>Select a junction and context, choose a condition, then run its seven-stage sequence.</p></div><b>PHASE 2</b></div>
            <div className={styles.designTabs} aria-label="Phase 2 crossing designs">
              {(["three-way", "four-way"] as Junction[]).flatMap((j) => (["normal", "school"] as Context[]).map((c) => {
                const selected = junction === j && context === c;
                return <button key={`${j}-${c}`} aria-pressed={selected} className={selected ? styles.designSelected : ""} onClick={() => switchDesign(j, c)}><b>{j === "three-way" ? "03" : "04"}</b><span>{j === "three-way" ? "Three-way" : "Four-way"}<small>{c === "school" ? "School crossing" : "Normal crossing"}</small></span></button>;
              }))}
            </div>
            <div className={styles.simGrid}>
              <div className={styles.sceneColumn}>
                <div className={styles.sceneHeader}><div><span>SIMULATED DATA | ANIMATED PROTOTYPE</span><strong>{junctionName} - {contextName}</strong></div><div><i /> CONTROLLER: {vehicleSignal}</div></div>
                <div className={styles.sceneLocation}><div><span>REPRESENTATIVE LOCATION</span><strong>{context === "school" ? "School frontage and supervised junction" : "MPAJ local junction concept"}</strong></div><div><i /> {junctionName.toUpperCase()}</div></div>
                <CrossingMap junction={junction} context={context} active={running} />
                <div className={styles.sceneCaption}><strong>{stages[stage]} - Stage {stage + 1} of 7</strong><span>{detail}</span></div>
                <div className={styles.evidenceStrip}><article><span>RADAR / DETECTION</span><strong>{running || completed ? "Approaches tracked" : "Sensors ready"}</strong><small>{confidence}% simulated confidence</small></article><article><span>SIGNAL INTERLOCK</span><strong>Vehicle {vehicleSignal} | Pedestrian {pedestrianSignal}</strong><small>{pedestrianSignal === "WALK" ? "Route verified clear" : "Pedestrian held"}</small></article><article><span>EVENT EVIDENCE</span><strong>{isViolation && (running || completed) ? "Review record captured" : "No violation evidence"}</strong><small>Synthetic and local only</small></article></div>
              </div>
              <aside className={styles.controlColumn}>
                <div className={styles.phaseCard}><span>Current phase</span><strong>{running ? stages[stage] : completed ? "Complete" : "Ready"}</strong><div><p><b>{progress}%</b><small>sequence progress</small></p><p><b>{confidence}%</b><small>detection confidence</small></p></div><em>{vehicleSignal} traffic | Pedestrian {pedestrianSignal}</em></div>
                <div className={styles.controls}><span className={styles.eyebrow}>AIM METHOD</span><h2>Run a crossing condition</h2><label>Crossing condition<select value={scenario} onChange={(event) => { setScenario(event.target.value as Scenario); reset(); }}>{scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><p>{selectedScenario.description}</p>
                  <div className={styles.inputCard}><span>SIMULATED INPUT</span><strong>{junctionName}, {contextName}</strong><small>Radar coverage and designated grid zones enabled</small></div>
                  <fieldset><legend>Operating conditions</legend><label>Weather<select value={weather} onChange={(e) => setWeather(e.target.value as Weather)}><option>Dry</option><option>Rain</option></select></label><label>Lighting<select value={light} onChange={(e) => setLight(e.target.value as Light)}><option>Day</option><option>Night</option></select></label><label>Visibility<select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}><option>Clear</option><option>Haze</option></select></label><div className={styles.health}>Derived sensor health <strong>{confidence >= 80 ? "Operational" : "Degraded"} - {confidence}%</strong></div></fieldset>
                  <button className={styles.runButton} onClick={running ? reset : run}>{running ? "Reset simulation" : completed ? "Run again" : "Run seven-stage simulation"}</button>
                </div>
              </aside>
            </div>
          </section>
          <section className={styles.timelineCard}><header><div><span className={styles.eyebrow}>ANALYSE AND EVALUATE</span><h2>Seven-stage simulation sequence</h2></div><strong>{progress}% <small>{running ? "Running" : completed ? "Complete" : "Ready"}</small></strong></header><div className={styles.progressTrack}><i style={{ width: `${progress}%` }} /></div><ol>{stages.map((item, index) => <li key={item} className={index <= stage && (running || completed) ? styles.stageActive : ""}><b>{index + 1}</b><span>{item}<small>{index <= stage && (running || completed) ? "Recorded" : "Pending"}</small></span></li>)}</ol><p><b>Stage {stage + 1} of 7.</b> {detail}</p></section>
          <section className={styles.bottomGrid}><article><span className={styles.eyebrow}>MOCK NOTIFICATION WORKFLOW</span><h2>Critical incident review</h2><p>{scenario === "collision" && (running || completed) ? "A local critical-event card is active. No responder has been contacted." : "Only the collision condition activates the local mock workflow. No external recipient is connected."}</p></article><article><span className={styles.eyebrow}>SESSION RECORD</span><h2>Simulation event log</h2><p>{history.length ? `${history.length} completed sequence${history.length === 1 ? "" : "s"} retained in this browser session.` : "No completed sequences recorded."}</p></article></section>
        </> : null}

        {view === "technology" ? <section className={styles.infoGrid}>{["Radar approach sensing","Pedestrian grid detection","Deterministic controller","Synthetic evidence"].map((title, i) => <article key={title}><b>0{i+1}</b><h2>{title}</h2><p>{["Coverage fans monitor vehicle and pedestrian approaches in the concept geometry.","Marked waiting grids define the intended detection and holding areas.","AI may classify risk, but only independently reviewed rules may govern WALK.","No live CCTV, identity lookup, enforcement or personal data is used."][i]}</p></article>)}</section> : null}
        {view === "scenarios" ? <section className={styles.scenarioMatrix}>{(["three-way","four-way"] as Junction[]).map((j) => <article key={j}><span className={styles.eyebrow}>{j.toUpperCase()}</span><h2>{j === "three-way" ? "Three-way junction" : "Four-way intersection"}</h2><ul><li>Normal crossing with general pedestrian demand</li><li>School crossing with supervised pupils</li><li>Radar approach and waiting-grid coverage</li><li>STOP-before-WALK route-clearance interlock</li><li>Five demonstration conditions</li></ul></article>)}</section> : null}
        {view === "incidents" ? <section className={styles.recordPanel}><span className={styles.eyebrow}>AUTHORISED HUMAN REVIEW</span><h2>Simulated incidents</h2>{history.filter((item) => item.scenario !== "baseline").length ? history.filter((item) => item.scenario !== "baseline").map((item) => <article key={item.id}><strong>{item.label}</strong><span>{item.junction} | {item.context} | Local record only</span></article>) : <p>No simulated violations have been completed in this session.</p>}</section> : null}
        {view === "reports" ? <section className={styles.recordPanel}><span className={styles.eyebrow}>OFFLINE RECORD</span><h2>Phase 2 session summary</h2><p>Completed sequences: {history.length}. Reports remain conceptual and require authorised human interpretation.</p><button className={styles.runButton} onClick={() => window.print()}>Print or save as PDF</button></section> : null}
      </div>
      <footer className={styles.footer}><span>SMARTCROSS PHASE 2 | SIMULATION BUILD</span><span>Safety rule: release WALK only after all conflicting approaches stop and the route is clear.</span></footer>
    </main>
  );
}
