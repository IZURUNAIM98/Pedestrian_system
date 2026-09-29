import { useState } from "react";
import type { EventLogEntry } from "@/lib/types";
import { filterOperatorEvents, presentOperatorEvent, type OperatorEventFilter } from "@/lib/operator-events";
import { formatTimestamp } from "@/lib/utils";

const FILTERS: Array<{ value: OperatorEventFilter; label: string }> = [
  { value: "all", label: "All" }, { value: "traffic", label: "Traffic" }, { value: "violation", label: "Violation" },
  { value: "pedestrian", label: "Pedestrian" }, { value: "emergency", label: "Emergency" }, { value: "safety", label: "Safety" }, { value: "system", label: "System" },
];

export function EventLog({ entries, filter = "all", operatingMode = "SIMULATION" }: { entries: EventLogEntry[]; filter?: "all" | EventLogEntry["category"]; operatingMode?: "SIMULATION" | "HARDWARE_IN_LOOP" | "SHADOW" | "SUPERVISED" | "LIVE_RESTRICTED" }) {
  const [view, setView] = useState<"operator" | "technical">("operator");
  const [operatorFilter, setOperatorFilter] = useState<OperatorEventFilter>("all");
  const categoryEntries = filter === "all" ? entries : entries.filter((entry) => entry.category === filter);
  const visible = filterOperatorEvents(categoryEntries, operatorFilter);
  return (
    <div className="event-log-shell">
      <div className="event-view-controls" aria-label="Event log presentation controls">
        <div className="segmented-control" role="group" aria-label="Event log view"><button type="button" aria-pressed={view === "operator"} onClick={() => setView("operator")}>Operator View</button><button type="button" aria-pressed={view === "technical"} onClick={() => setView("technical")}>Technical View</button></div>
        <div className="event-filter-bar" role="group" aria-label="Filter operator events">{FILTERS.map((item) => <button key={item.value} type="button" aria-pressed={operatorFilter === item.value} onClick={() => setOperatorFilter(item.value)}>{item.label}</button>)}</div>
      </div>
      {visible.length === 0 ? <div className="empty-state"><strong>{entries.length === 0 ? "No violation events recorded" : "No events match this view"}</strong><span>{entries.length === 0 ? "Select and run a driver or motorist violation to create the original history record." : "Choose another operational filter."}</span></div> : view === "operator" ? <ol className="event-list operator-event-list">
        {visible.map((entry) => {
          const event = presentOperatorEvent(entry);
          return <li key={entry.id} className={`operator-event-card severity-${event.severity}`}>
            <div className="event-card-meta"><time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time><span>{event.direction}</span><span className="event-mode">{operatingMode}</span><strong>{event.status}</strong></div>
            <div className="event-card-grid"><section><span>What happened</span><p>{event.happened}</p></section><section><span>SmartCross response</span><p>{event.response}</p></section><section><span>Safety</span><p>{event.safety}</p></section><section><span>Operator action</span><p className="operator-action">{event.action}</p></section></div>
            {event.evidence.length > 0 ? <div className="key-evidence"><span>Key technical evidence</span><div>{event.evidence.map((fact) => <p key={fact}>{fact}</p>)}</div></div> : null}
            <details><summary>View technical details</summary><p>{entry.message}</p><dl><div><dt>Record ID</dt><dd>{entry.id}</dd></div><div><dt>Engineering category</dt><dd>{entry.category}</dd></div><div><dt>Operating mode</dt><dd>{operatingMode}</dd></div><div><dt>Decision reason</dt><dd>{event.response}</dd></div></dl></details>
          </li>;
        })}
      </ol> : <ol className="event-list technical-event-list">{visible.map((entry) => <li key={entry.id}><time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time><span className={`event-category event-${entry.category}`}>{entry.category}</span><p>{entry.message}</p></li>)}</ol>}
    </div>
  );
}
