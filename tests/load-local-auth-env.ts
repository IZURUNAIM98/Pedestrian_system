import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const AUTH_KEYS = new Set(["DEMO_ACCESS_ID", "DEMO_ACCESS_PASSWORD"]);

export function loadLocalAuthEnvironment(): void {
  let contents = "";
  try {
    contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    // Deterministic, non-secret clean-room fixtures. Production credentials are never packaged.
    process.env.DEMO_ACCESS_ID ??= "SMARTCROSS-TEST-ONLY";
    process.env.DEMO_ACCESS_PASSWORD ??= "not-a-production-secret";
    return;
  }

  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/u);
    if (!match || !AUTH_KEYS.has(match[1]) || process.env[match[1]]) continue;
    const rawValue = match[2];
    process.env[match[1]] = rawValue.length >= 2 && ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'")))
      ? rawValue.slice(1, -1)
      : rawValue;
  }
}
