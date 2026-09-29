import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "smartcross-2.2.lock.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];

for (const [file, expected] of Object.entries(manifest.files)) {
  const target = path.resolve(root, file);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    failures.push(`${file}: resolves outside the repository`);
    continue;
  }
  if (!fs.existsSync(target)) {
    failures.push(`${file}: missing`);
    continue;
  }
  const actual = createHash("sha256").update(fs.readFileSync(target)).digest("hex");
  if (actual !== expected) failures.push(`${file}: expected ${expected}, received ${actual}`);
}

if (failures.length > 0) {
  console.error("SmartCross repository lock failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  console.error("Review every change before intentionally refreshing smartcross-2.2.lock.json.");
  process.exit(1);
}

console.log(`SmartCross repository lock verified (${Object.keys(manifest.files).length} files).`);
