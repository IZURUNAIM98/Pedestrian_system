"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./phase-two-design.module.css";

export type Junction = "three-way" | "four-way";
export type Context = "normal" | "school";

const options: Array<{ junction: Junction; context: Context; code: string; title: string; note: string }> = [
  { junction: "three-way", context: "normal", code: "P2-3N", title: "Three-way - Normal", note: "T-junction coverage with three pedestrian approaches and coordinated radar sightlines." },
  { junction: "three-way", context: "school", code: "P2-3S", title: "Three-way - School", note: "Supervised school frontage, 30 km/h concept zone and enlarged pupil waiting areas." },
  { junction: "four-way", context: "normal", code: "P2-4N", title: "Four-way - Normal", note: "Four-leg crossing concept with paired detection zones on every pedestrian route." },
  { junction: "four-way", context: "school", code: "P2-4S", title: "Four-way - School", note: "Four-leg school concept with supervised corners and a clearly marked central caution area." },
];

function ZebraVertical({ x }: { x: number }) {
  return <g aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <rect key={index} x={x} y={222 + index * 23} width="72" height="13" rx="2" className={styles.zebra} />)}</g>;
}

function ZebraHorizontal({ y }: { y: number }) {
  return <g aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <rect key={index} x={407 + index * 23} y={y} width="13" height="72" rx="2" className={styles.zebra} />)}</g>;
}

function GridZone({ x, y, width = 82, height = 64 }: { x: number; y: number; width?: number; height?: number }) {
  return <rect x={x} y={y} width={width} height={height} rx="4" className={styles.gridZone} />;
}

function Signal({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} aria-hidden="true"><rect x="-7" y="0" width="14" height="38" rx="5" className={styles.signalPole} /><rect x="-13" y="-20" width="26" height="25" rx="7" className={styles.signalBox} /><circle cx="0" cy="-8" r="6" className={styles.redSignal} /></g>;
}

function Person({ x, y, school = false }: { x: number; y: number; school?: boolean }) {
  return <g transform={`translate(${x} ${y})`} aria-hidden="true"><circle cx="0" cy="-8" r="7" className={school ? styles.pupilHead : styles.personHead} /><path d="M 0 0 L 0 19 M -9 7 L 9 7 M 0 18 L -8 31 M 0 18 L 8 31" className={school ? styles.pupilBody : styles.personBody} /></g>;
}

function Vehicle({ x, y, rotate = 0, color = "blue" }: { x: number; y: number; rotate?: number; color?: "blue" | "white" | "amber" }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate})`} aria-hidden="true"><rect x="-38" y="-20" width="76" height="40" rx="14" className={styles[`vehicle${color[0].toUpperCase()}${color.slice(1)}`]} /><rect x="-16" y="-15" width="32" height="30" rx="8" className={styles.windshield} /><circle cx="-24" cy="-22" r="5" className={styles.wheel} /><circle cx="24" cy="-22" r="5" className={styles.wheel} /><circle cx="-24" cy="22" r="5" className={styles.wheel} /><circle cx="24" cy="22" r="5" className={styles.wheel} /></g>;
}

function RadarRing({ x, y, label }: { x: number; y: number; label: string }) {
  return <g transform={`translate(${x} ${y})`} aria-hidden="true"><circle r="48" className={styles.engineeringRadar} /><circle r="34" className={styles.engineeringRadarInner} /><circle r="5" className={styles.radarLens} /><text y="4" textAnchor="middle" className={styles.radarText}>{label}</text></g>;
}

function VehicleCard({ x, y, name, align = "start" }: { x: number; y: number; name: string; align?: "start" | "end" }) {
  const left = align === "end" ? x - 122 : x;
  return <g transform={`translate(${left} ${y})`} aria-hidden="true"><rect width="122" height="57" rx="8" className={styles.vehicleCard} /><text x="61" y="20" textAnchor="middle" className={styles.vehicleCardTitle}>{name}</text><text x="61" y="34" textAnchor="middle" className={styles.vehicleCardText}>0 km/h, waiting</text><text x="61" y="47" textAnchor="middle" className={styles.vehicleCardText}>42 m to centre</text></g>;
}

function PedestrianBadge({ x, y, school = false }: { x: number; y: number; school?: boolean }) {
  return <g transform={`translate(${x} ${y})`} aria-hidden="true"><rect x="-28" y="-49" width="56" height="78" rx="20" className={styles.pedestrianBadge} /><Person x={0} y={-5} school={school} /><rect x="-24" y="18" width="48" height="17" rx="8" className={styles.waitBadge} /><text y="30" textAnchor="middle" className={styles.waitText}>WAITING</text></g>;
}

function Overlay({ x, y, width, height, label, amber = false }: { x: number; y: number; width: number; height: number; label: string; amber?: boolean }) {
  return <g aria-hidden="true"><rect x={x} y={y} width={width} height={height} rx="3" className={amber ? styles.amberOverlay : styles.blueOverlay} /><rect x={x} y={y - 15} width={Math.min(width, label.length * 6 + 18)} height="15" className={amber ? styles.amberLabel : styles.blueLabel} /><text x={x + 7} y={y - 4} className={styles.overlayText}>{label}</text></g>;
}

function StopLine({ x, y, vertical = false, label }: { x: number; y: number; vertical?: boolean; label: string }) {
  return <g aria-hidden="true"><path d={vertical ? `M ${x} ${y} v 86` : `M ${x} ${y} h 86`} className={styles.stopLine} /><rect x={vertical ? x - 3 : x + 8} y={vertical ? y + 34 : y - 19} width="73" height="17" rx="2" className={styles.stopLabel} /><text x={vertical ? x + 33 : x + 44} y={vertical ? y + 46 : y - 7} textAnchor="middle" className={styles.stopText}>{label}</text></g>;
}

function TactilePad({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate})`} aria-hidden="true"><rect width="66" height="18" rx="2" className={styles.tactilePad} />{Array.from({ length: 8 }, (_, index) => <circle key={index} cx={7 + index * 8} cy="9" r="2" className={styles.tactileDot} />)}</g>;
}

function SchoolCorner() {
  return (
    <g aria-hidden="true">
      <rect x="782" y="63" width="198" height="88" rx="12" className={styles.schoolBuilding} />
      <rect x="802" y="91" width="158" height="40" rx="7" className={styles.schoolWindows} />
      <text x="881" y="84" textAnchor="middle" className={styles.schoolLabel}>SCHOOL</text>
      <path d="M 818 170 h 92" className={styles.schoolGate} />
      <g transform="translate(810 186)"><Person x={0} y={0} school /><Person x={27} y={2} school /><Person x={54} y={0} school /></g>
      <g transform="translate(940 181)"><circle cx="0" cy="-8" r="8" className={styles.supervisorHead} /><path d="M 0 1 L 0 25 M -10 8 L 10 8 M 0 24 L -8 38 M 0 24 L 8 38" className={styles.supervisorBody} /></g>
    </g>
  );
}

export function CrossingMap({ junction, context, active = false }: { junction: Junction; context: Context; active?: boolean }) {
  const fourWay = junction === "four-way";
  const school = context === "school";
  return (
    <svg className={`${styles.map} ${active ? styles.mapActive : ""}`} viewBox="0 0 1000 620" role="img" aria-label={`${fourWay ? "Four-way intersection" : "Three-way T-junction"}, ${school ? "school" : "normal"} crossing concept showing zebra crossings, radar coverage and designated pedestrian detection grids.`}>
      <defs>
        <pattern id="p2-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M 16 0 L 0 0 0 16" className={styles.gridLine} /></pattern>
        <linearGradient id="p2-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#253746" /><stop offset="1" stopColor="#172633" /></linearGradient>
        <filter id="p2-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="1000" height="620" className={styles.engineeringGround} />
      <g className={styles.pavementGrid} aria-hidden="true">{Array.from({ length: 15 }, (_, index) => <path key={`v-${index}`} d={`M ${index * 72} 0 V 620`} />)}{Array.from({ length: 10 }, (_, index) => <path key={`h-${index}`} d={`M 0 ${index * 68} H 1000`} />)}</g>
      <path d="M 0 210 H 1000 V 430 H 0 Z" className={styles.engineeringRoad} />
      <path d={fourWay ? "M 405 0 H 595 V 620 H 405 Z" : "M 405 320 H 595 V 620 H 405 Z"} className={styles.engineeringRoad} />
      <g className={styles.engineeringKerbs} aria-hidden="true"><path d="M 0 210 H 405 M 595 210 H 1000 M 0 430 H 405 M 595 430 H 1000" /><path d={fourWay ? "M 405 0 V 210 M 595 0 V 210 M 405 430 V 620 M 595 430 V 620" : "M 405 430 V 620 M 595 430 V 620"} /></g>
      <g className={styles.engineeringLaneMarks} aria-hidden="true"><path d="M 0 320 H 345 M 655 320 H 1000" /><path d={fourWay ? "M 500 0 V 150 M 500 490 V 620" : "M 500 490 V 620"} /></g>
      <ZebraVertical x={315} /><ZebraVertical x={613} />{fourWay ? <ZebraHorizontal y={132} /> : null}<ZebraHorizontal y={430} />
      <StopLine x={286} y={258} vertical label="STOP LINE A" /><StopLine x={714} y={276} vertical label="STOP LINE B" />
      {fourWay ? <StopLine x={457} y={112} label="STOP LINE C" /> : null}<StopLine x={457} y={492} label={fourWay ? "STOP LINE D" : "STOP LINE C"} />
      <TactilePad x={319} y={190} /><TactilePad x={617} y={432} />{fourWay ? <TactilePad x={387} y={137} rotate={90} /> : null}<TactilePad x={595} y={433} rotate={90} />
      <g filter="url(#p2-glow)"><GridZone x={294} y={142} width={94} height={60} /><GridZone x={612} y={142} width={94} height={60} /><GridZone x={294} y={438} width={94} height={60} /><GridZone x={612} y={438} width={94} height={60} />{fourWay ? <><GridZone x={337} y={126} width={60} height={82} /><GridZone x={603} y={126} width={60} height={82} /></> : null}<GridZone x={337} y={428} width={60} height={82} /><GridZone x={603} y={428} width={60} height={82} /></g>
      <Overlay x={78} y={335} width={300} height={67} label="SPEED MEASUREMENT" /><Overlay x={680} y={247} width={255} height={67} label="SPEED MEASUREMENT" />
      <Overlay x={411} y={214} width={178} height={212} label="CONFLICT ZONE" />
      <Overlay x={720} y={225} width={210} height={86} label="PARKING REVIEW" amber />
      <RadarRing x={260} y={535} label="OPPOSING RADAR" /><RadarRing x={school ? 710 : 752} y={school ? 142 : 116} label="APPROACH RADAR" />{fourWay ? <><RadarRing x={330} y={73} label="NORTH RADAR" /><RadarRing x={670} y={547} label="SOUTH RADAR" /></> : <RadarRing x={735} y={538} label="BRANCH RADAR" />}
      <Signal x={386} y={194} /><Signal x={614} y={446} /><Signal x={386} y={446} /><Signal x={614} y={194} />
      <Vehicle x={132} y={274} color="white" /><VehicleCard x={26} y={350} name="Vehicle A" /><Vehicle x={868} y={366} rotate={180} color="blue" /><VehicleCard x={968} y={268} name="Vehicle B" align="end" />
      {fourWay ? <><Vehicle x={542} y={70} rotate={90} color="white" /><VehicleCard x={598} y={34} name="Vehicle C" /></> : null}<Vehicle x={458} y={560} rotate={-90} color={school ? "amber" : "blue"} /><VehicleCard x={520} y={540} name={fourWay ? "Vehicle D" : "Vehicle C"} />
      <PedestrianBadge x={365} y={174} school={school} />{school ? <SchoolCorner /> : <PedestrianBadge x={648} y={466} />}
      {school ? <g aria-hidden="true"><rect x="431" y="251" width="138" height="138" rx="10" className={styles.schoolZone} /><text x="500" y="302" textAnchor="middle" className={styles.zoneText}>SCHOOL</text><text x="500" y="334" textAnchor="middle" className={styles.zoneText}>ZONE</text><circle cx="500" cy="368" r="23" className={styles.speedRing} /><text x="500" y="377" textAnchor="middle" className={styles.speedText}>30</text></g> : null}
      <g className={styles.cctvBadge} transform="translate(20 18)" aria-hidden="true"><rect width="112" height="30" rx="6" /><rect x="10" y="9" width="22" height="12" rx="3" /><circle cx="27" cy="15" r="4" /><text x="42" y="19">CCTV P2-01</text></g>
      <g className={styles.healthBadge} transform="translate(790 18)" aria-hidden="true"><rect width="190" height="36" rx="7" /><circle cx="18" cy="18" r="10" /><text x="18" y="22" textAnchor="middle">OK</text><text x="36" y="22">Sensor health: Operational</text></g>
      <g className={styles.mapLegend} transform="translate(20 66)"><rect width="228" height="65" rx="8" /><circle cx="20" cy="21" r="6" className={styles.legendRadar} /><text x="37" y="25">RADAR COVERAGE</text><rect x="14" y="39" width="15" height="15" className={styles.legendGrid} /><text x="37" y="52">DESIGNATED ZONE GRID</text></g>
    </svg>
  );
}

export function PhaseTwoDesign() {
  const [junction, setJunction] = useState<Junction>("three-way");
  const [context, setContext] = useState<Context>("normal");
  const active = useMemo(() => options.find((item) => item.junction === junction && item.context === context) ?? options[0], [junction, context]);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Return to SmartCross 2.2"><span className={styles.brandMark}>AJ</span><span><strong>SmartCross</strong><small>PHASE 2</small></span></Link>
        <div className={styles.status}><i /> CONCEPT SIMULATION <span>|</span> MPAJ STUDY</div>
        <Link href="/" className={styles.back}>Back to SmartCross 2.2</Link>
      </header>

      <section className={styles.hero}>
        <div><span className={styles.eyebrow}>NEXT-GENERATION CROSSING DESIGN</span><h1>One safety system.<br /><em>Four street contexts.</em></h1><p>An upgraded concept explorer extending the SmartCross 2.2 visual language to three-way junctions and four-way intersections.</p></div>
        <div className={styles.heroMetrics} aria-label="Concept coverage summary"><article><strong>04</strong><span>design configurations</span></article><article><strong>360 DEG</strong><span>coordinated sensing</span></article><article><strong>STOP</strong><span>before WALK</span></article></div>
      </section>

      <section className={styles.workspace} aria-labelledby="design-title">
        <div className={styles.selectionRail}>
          <div className={styles.railIntro}><span>DESIGN MATRIX</span><h2 id="design-title">Select a layout</h2><p>Choose the road geometry and pedestrian context independently.</p></div>
          <fieldset><legend>Road geometry</legend><div className={styles.segmented}>
            <button className={junction === "three-way" ? styles.selected : ""} aria-pressed={junction === "three-way"} onClick={() => setJunction("three-way")}><b>03</b><span>Three-way junction<small>T-junction</small></span></button>
            <button className={junction === "four-way" ? styles.selected : ""} aria-pressed={junction === "four-way"} onClick={() => setJunction("four-way")}><b>04</b><span>Four-way intersection<small>Crossroads</small></span></button>
          </div></fieldset>
          <fieldset><legend>Crossing context</legend><div className={styles.segmented}>
            <button className={context === "normal" ? styles.selected : ""} aria-pressed={context === "normal"} onClick={() => setContext("normal")}><b>N</b><span>Normal crossing<small>General public</small></span></button>
            <button className={context === "school" ? styles.schoolSelected : ""} aria-pressed={context === "school"} onClick={() => setContext("school")}><b>S</b><span>School crossing<small>Supervised pupils</small></span></button>
          </div></fieldset>
          <div className={styles.boundary}><strong>Concept boundary</strong><p>Illustrative geometry and simulated sensing only. Dimensions, signal phasing and equipment positions require site survey, authority review and certified engineering design.</p></div>
        </div>

        <div className={styles.canvasPanel}>
          <div className={styles.canvasHeader}><div><span>{active.code} | DESIGN VIEW</span><h2>{active.title}</h2></div><div className={styles.liveChip}><i /> DESIGN ACTIVE</div></div>
          <CrossingMap junction={junction} context={context} />
          <div className={styles.caption}><p>{active.note}</p><span>Concept visual | Not to scale</span></div>
        </div>
      </section>

      <section className={styles.systemBand} aria-labelledby="system-title">
        <div className={styles.systemHeading}><span className={styles.eyebrow}>SHARED CONTROL PRINCIPLE</span><h2 id="system-title">Detect early. Hold conflict. Release safely.</h2><p>Every Phase 2 layout keeps the deterministic safety boundary from SmartCross 2.2.</p></div>
        <ol className={styles.sequence}>
          <li><b>01</b><div><strong>Observe</strong><span>Radar watches approaches and marked waiting grids.</span></div></li>
          <li><b>02</b><div><strong>Verify</strong><span>Crossing demand and vehicle conflicts are checked.</span></div></li>
          <li><b>03</b><div><strong>Stop traffic</strong><span>Conflicting vehicle movements receive STOP first.</span></div></li>
          <li><b>04</b><div><strong>Release WALK</strong><span>WALK appears only after the route is confirmed clear.</span></div></li>
        </ol>
      </section>

      <footer className={styles.footer}><span>SMARTCROSS PHASE 2 | CONCEPT DESIGN EXPLORER</span><span>No live radar, CCTV, signal control, enforcement or emergency dispatch.</span></footer>
    </main>
  );
}
