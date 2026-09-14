import type { EventLogEntry } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

export function EventLog({ entries, filter }: { entries: EventLogEntry[]; filter: "all" | EventLogEntry["category"] }) {
  const visible = filter === "all" ? entries : entries.filter((entry) => entry.category === filter);
  if (visible.length === 0) return <div className="empty-state"><strong>No violation events recorded</strong><span>Select and run a driver or motorist violation to create the original history record.</span></div>;
  return (
    <ol className="event-list">
      {visible.map((entry) => (
        <li key={entry.id}>
          <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
          <span className={`event-category event-${entry.category}`}>{entry.category}</span>
          <p>{entry.message}</p>
        </li>
      ))}
    </ol>
  );
}
