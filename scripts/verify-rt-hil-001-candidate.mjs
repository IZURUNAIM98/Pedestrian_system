import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageRoot = path.join(root, "docs", "rt-hil-001-stage17-candidate");
const manifestPath = path.join(packageRoot, "candidate-manifest.json");
const identityPath = path.join(packageRoot, "candidate-manifest.sha256");
const manifestBytes = fs.readFileSync(manifestPath);
const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");
const expectedManifestHash = fs.readFileSync(identityPath, "utf8").trim().split(/\s+/u)[0];
const failures = manifestHash === expectedManifestHash ? [] : [`candidate-manifest.json: expected identity ${expectedManifestHash}, received ${manifestHash}`];
const manifest = JSON.parse(manifestBytes.toString("utf8"));
for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(target)) { failures.push(`${relativePath}: missing or outside repository`); continue; }
  const actual = createHash("sha256").update(fs.readFileSync(target)).digest("hex");
  if (actual !== expectedHash) failures.push(`${relativePath}: expected ${expectedHash}, received ${actual}`);
}
if (failures.length) { console.error(`RT-HIL-001 candidate verification failed:\n${failures.map((item) => `- ${item}`).join("\n")}`); process.exit(1); }
console.log(`RT-HIL-001 candidate ${manifest.candidateId} verified (${Object.keys(manifest.files).length} files; manifest ${manifestHash}).`);
