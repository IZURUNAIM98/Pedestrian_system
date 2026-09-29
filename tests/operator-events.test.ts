import { describe, expect, it } from "vitest";
import { filterOperatorEvents, presentOperatorEvent } from "@/lib/operator-events";
import type { EventLogEntry } from "@/lib/types";

const entry = (message: string, category: EventLogEntry["category"] = "controller"): EventLogEntry => ({ id: message, timestamp: "2026-09-21T00:00:00.000Z", category, message });

describe("operator event presentation", () => {
  it("keeps normal events concise", () => {
    const event = presentOperatorEvent(entry("Normal operation restored. Vehicle signal is GO.", "outcome"));
    expect(event.status).toBe("Normal Operation Restored");
    expect(event.action).toBe("No action required");
    expect(event.evidence).toHaveLength(0);
  });

  it("surfaces critical safety facts without removing the original evidence", () => {
    const source = entry("Critical vehicle fire emergency. Direction: Eastbound. Speed: 55 km/h. Sensor health operational. Vehicle signal is STOP. Pedestrian state is WAIT. CCTV detection range 40 m.", "safety");
    const event = presentOperatorEvent(source);
    expect(event.status).toBe("Critical Safety Mode");
    expect(event.action).toBe("Emergency response initiated");
    expect(event.evidence.length).toBeGreaterThanOrEqual(3);
    expect(source.message).toContain("CCTV detection range 40 m");
  });

  it("combines matching bidirectional heavy-traffic records and filters them", () => {
    const source = Object.assign(entry("Both. Evidence: queue 8 per direction. Action: GREEN -> ALL_RED. Safety rule: STOP before WALK. Result: pedestrian WAIT."), { direction: "Both" });
    expect(presentOperatorEvent(source).direction).toBe("Both Directions");
    expect(filterOperatorEvents([source], "traffic")).toHaveLength(1);
    expect(filterOperatorEvents([source], "emergency")).toHaveLength(0);
  });
});
