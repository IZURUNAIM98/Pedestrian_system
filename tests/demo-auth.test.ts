import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, credentialsAreValid, sessionIsValid } from "@/lib/demo-auth";

beforeAll(() => {
  process.env.DEMO_ACCESS_ID = "ENNOVA";
  process.env.DEMO_ACCESS_PASSWORD = "123456";
});

describe("demonstration access", () => {
  it("accepts the configured credentials", () => {
    expect(credentialsAreValid("ENNOVA", "123456")).toBe(true);
  });

  it("rejects incorrect credentials", () => {
    expect(credentialsAreValid("ENNOVA", "wrong")).toBe(false);
    expect(credentialsAreValid("UNKNOWN", "123456")).toBe(false);
  });

  it("validates signed sessions and rejects expired or modified tokens", () => {
    const now = Date.parse("2026-08-19T00:00:00Z");
    const token = createSessionToken(now);
    expect(sessionIsValid(token, now + 1_000)).toBe(true);
    expect(sessionIsValid(`${token}x`, now + 1_000)).toBe(false);
    expect(sessionIsValid(token, now + 9 * 60 * 60 * 1_000)).toBe(false);
  });
});
