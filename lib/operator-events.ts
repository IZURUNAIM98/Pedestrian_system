import type { EventLogEntry } from "@/lib/types";

export type OperatorEventFilter = "all" | "traffic" | "violation" | "pedestrian" | "emergency" | "safety" | "system";
export type OperatorEventSeverity = "normal" | "monitoring" | "high" | "critical";
export type OperatorAction = "No action required" | "Monitor" | "Check CCTV" | "Acknowledge" | "Manual review required" | "Emergency response initiated";

export interface OperatorEventPresentation {
  filter: Exclude<OperatorEventFilter, "all">;
  severity: OperatorEventSeverity;
  direction: string;
  status: string;
  happened: string;
  response: string;
  safety: string;
  action: OperatorAction;
  evidence: string[];
}

type RichEvent = EventLogEntry & Partial<{ direction: string; evidence: string; action: string; safetyRule: string; result: string }>;

const metricPatterns = [
  /(?:queue|vehicle count|speed|occupancy|arrival rate|stopped duration|congestion score|confidence|sensor health|signal state|pedestrian state|detection distance|cctv detection range)[^.;]*/gi,
  /Vehicle [AB] is [^.;]*/gi,
  /(?:vehicle|pedestrian) signal is [^.;]*/gi,
];
const evidenceLimit: Record<OperatorEventSeverity, number> = { normal: 0, monitoring: 1, high: 3, critical: 5 };

function includesAny(value: string, terms: string[]) { return terms.some((term) => value.includes(term)); }
function firstSentence(value: string) { return value.split(/(?<=[.!?])\s+/u)[0]?.replace(/^[^:]+:\s*/u, "") ?? value; }

export function presentOperatorEvent(entry: EventLogEntry): OperatorEventPresentation {
  const rich = entry as RichEvent;
  const text = entry.message;
  const lower = text.toLowerCase();
  const critical = includesAny(lower, ["critical", "collision", "fire", "explosion", "emergency response"]);
  const emergency = includesAny(lower, ["emergency", "priority vehicle", "ambulance", "fire / rescue"]);
  const degraded = includesAny(lower, ["degraded", "unreliable", "sensor disagreement", "failed"]);
  const violation = includesAny(lower, ["violation", "wrong direction", "speeding", "red-signal", "stop-line intrusion"]);
  const pedestrian = includesAny(lower, ["pedestrian", "walk", "crossing demand"]);
  const heavy = includesAny(lower, ["heavy traffic", "congestion", "queue", "adaptive"]);
  const recovery = includesAny(lower, ["recovery", "restored", "normal operation"]);
  const safetyEvent = entry.category === "safety" || includesAny(lower, ["all-red", "safety hold", "interlock", "withheld"]);

  const severity: OperatorEventSeverity = critical || emergency ? "critical" : violation || degraded || safetyEvent ? "high" : heavy ? "monitoring" : "normal";
  const filter: OperatorEventPresentation["filter"] = emergency ? "emergency" : violation ? "violation" : heavy ? "traffic" : pedestrian ? "pedestrian" : safetyEvent ? "safety" : "system";
  const direction = rich.direction === "Both" ? "Both Directions" : rich.direction ?? (lower.includes("eastbound") && lower.includes("westbound") ? "Both Directions" : lower.includes("eastbound") ? "Eastbound" : lower.includes("westbound") ? "Westbound" : "Crossing Area");
  const status = critical ? "Critical Safety Mode" : emergency ? "Emergency Priority" : degraded ? "Degraded Mode" : violation ? "Traffic Violation" : recovery ? "Normal Operation Restored" : heavy ? "Adaptive Control" : safetyEvent ? "Safety Hold" : entry.category === "sensor" ? "Monitoring" : "Normal";
  const happened = rich.evidence ? firstSentence(rich.evidence) : firstSentence(text);
  const response = rich.action ?? (entry.category === "controller" ? firstSentence(text) : safetyEvent ? "SmartCross is holding conflicting movement while safety conditions are checked." : entry.category === "outcome" ? "SmartCross completed the deterministic sequence and retained the audit record." : "SmartCross is monitoring the state and applying the configured crossing rules.");
  const safety = rich.safetyRule ?? (lower.includes("walk") ? "STOP-before-WALK and crossing-clearance interlocks remain active." : critical || safetyEvent ? "Conflicting traffic is held and pedestrian release remains protected." : "No safety interlock has been breached.");
  const action: OperatorAction = critical ? "Emergency response initiated" : emergency ? "Acknowledge" : degraded ? "Check CCTV" : violation || safetyEvent ? "Manual review required" : heavy ? "Monitor" : "No action required";
  const candidates = [rich.result, ...metricPatterns.flatMap((pattern) => text.match(pattern) ?? [])].filter((value): value is string => Boolean(value));
  const evidence = [...new Set(candidates.map((value) => value.trim()))].slice(0, evidenceLimit[severity]);
  return { filter, severity, direction, status, happened, response, safety, action, evidence };
}

export function filterOperatorEvents(entries: EventLogEntry[], filter: OperatorEventFilter) {
  return filter === "all" ? entries : entries.filter((entry) => presentOperatorEvent(entry).filter === filter);
}
