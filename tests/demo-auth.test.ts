import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, credentialsAreValid, sessionIsValid } from "@/lib/demo-auth";
import { loadLocalAuthEnvironment } from "./load-local-auth-env";

beforeAll(() => {
  loadLocalAuthEnvironment();
  expect(process.env.DEMO_ACCESS_ID).toBeTruthy();
  expect(process.env.DEMO_ACCESS_PASSWORD).toBeTruthy();
});

describe("demonstration access", () => {
  it("accepts the configured credentials", () => {
    expect(credentialsAreValid(process.env.DEMO_ACCESS_ID ?? "", process.env.DEMO_ACCESS_PASSWORD ?? "")).toBe(true);
  });

  it("rejects incorrect credentials", () => {
    expect(credentialsAreValid(process.env.DEMO_ACCESS_ID ?? "", "wrong-password")).toBe(false);
    expect(credentialsAreValid("UNKNOWN", process.env.DEMO_ACCESS_PASSWORD ?? "")).toBe(false);
  });

  it("validates signed sessions and rejects expired or modified tokens", () => {
    const now = Date.parse("2026-08-19T00:00:00Z");
    const token = createSessionToken(now);
    expect(sessionIsValid(token, now + 1_000)).toBe(true);
    expect(sessionIsValid(`${token}x`, now + 1_000)).toBe(false);
    expect(sessionIsValid(token, now + 9 * 60 * 60 * 1_000)).toBe(false);
  });
});
