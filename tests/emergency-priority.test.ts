import { describe, expect, it } from "vitest";
import { CCTV_DETECTION_RANGE_METERS, EMERGENCY_PRIORITY_SEQUENCE, createEmergencyPriorityRecord } from "@/lib/emergency-priority";

describe("emergency priority sequence", () => {
  it("models both directions and all responder types with the declared CCTV range", () => {
    for (const vehicleType of ["ambulance", "police", "fire-rescue"] as const) {
      for (const direction of ["Eastbound", "Westbound"] as const) {
        const record = createEmergencyPriorityRecord({ vehicleType, direction });
        expect(record.cctvDetectionRangeMeters).toBe(CCTV_DETECTION_RANGE_METERS);
        expect(record.detectionSource).toBe("CCTV + radar");
        expect(record.frames.map((frame) => frame.state)).toEqual([...EMERGENCY_PRIORITY_SEQUENCE]);
        expect(record.frames[0].emergencyX).toBe(direction === "Eastbound" ? 8 : 92);
        expect(record.eventLog.some((entry) => entry.message.includes("Vehicle Type"))).toBe(true);
        expect(record.eventLog.some((entry) => entry.message.includes("CCTV Detection Range: 40 m"))).toBe(true);
      }
    }
  });

  it("holds an unvalidated approach before the crossing and keeps conflicting traffic stopped", () => {
    const record = createEmergencyPriorityRecord({ direction: "Eastbound", validationStatus: "sensor-disagreement" });
    expect(record.priorityStatus).toBe("safe-hold");
    expect(Math.max(...record.frames.map((frame) => frame.emergencyX))).toBeLessThan(35);
    expect(record.frames.filter((frame) => frame.state !== "NORMAL").every((frame) => frame.vehicleSignal === "STOP" && frame.conflictingVehicleSignal === "STOP")).toBe(true);
  });

  it("protects a pedestrian already in the crossing before granting priority", () => {
    const record = createEmergencyPriorityRecord({ pedestrianAlreadyCrossing: true });
    const passing = record.frames.findIndex((frame) => frame.state === "EMERGENCY_PASSING");
    expect(record.frames.slice(0, passing).some((frame) => frame.pedestrianSignal === "WALK")).toBe(true);
    expect(record.frames.find((frame) => frame.state === "EMERGENCY_PRIORITY")?.pedestrianProgress).toBe(100);
    expect(record.frames[passing].vehicleSignal).toBe("GO");
  });
});
