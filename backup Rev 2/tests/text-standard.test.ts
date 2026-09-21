import { describe, expect, it } from "vitest";
import { SCENARIOS, runSimulation } from "@/lib/simulation";
import {
  escapeHtmlText,
  humaniseEnglishState,
  JSON_UTF8_CONTENT_TYPE,
  normaliseDisplayText,
  normaliseTextPayload,
  validateEnglishText,
  withUtf8JsonContentType,
} from "@/lib/text-standard";

describe("permanent English and UTF-8 text standard", () => {
  it("normalises Unicode to NFC and preserves approved Malaysian terms, symbols and units", () => {
    expect(normaliseDisplayText("Cafe\u0301 MPAJ: 30 km/h, 75% … ♿", "import"))
      .toBe("Caf\u00e9 MPAJ: 30 km/h, 75% … ♿");
    expect(humaniseEnglishState("EMERGENCY_STOP")).toBe("emergency stop");
  });

  it.each([
    ["mojibake", "Broken \u00c2 text"],
    ["replacement glyph", "Broken \ufffd text"],
    ["invisible character", "Hidden\u200btext"],
    ["unexpected alphabet", "Latin \u0410 lookalike"],
  ])("rejects %s", (_name, value) => {
    expect(() => validateEnglishText(value, "ai")).toThrow();
  });

  it("normalises nested imported, database and AI payloads", () => {
    const payload = { message: "Cafe\u0301", nested: ["Ampang Jaya", { unit: "km/h" }] };
    expect(normaliseTextPayload(payload, "database")).toEqual({ message: "Caf\u00e9", nested: ["Ampang Jaya", { unit: "km/h" }] });
  });

  it("escapes raw HTML text without double-decoding it", () => {
    expect(escapeHtmlText('<MPAJ & "Ampang">', "import")).toBe("&lt;MPAJ &amp; &quot;Ampang&quot;&gt;");
  });

  it("sets the required UTF-8 JSON response header", () => {
    const response = withUtf8JsonContentType(new Response("{}"));
    expect(response.headers.get("content-type")).toBe(JSON_UTF8_CONTENT_TYPE);
  });

  it("validates every static scenario and generated simulator message", () => {
    for (const scenario of SCENARIOS) {
      expect(() => normaliseTextPayload(scenario, "simulator")).not.toThrow();
      const mode = scenario.supportedModes[0];
      const result = runSimulation({ mode, scenarioId: scenario.id }, new Date("2026-08-26T00:00:00Z"));
      expect(() => normaliseTextPayload(result, "api")).not.toThrow();
    }
  });
});
