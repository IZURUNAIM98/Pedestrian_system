import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const control = path.join(root, "control");
const bindingPath = path.join(control, "baseline-binding-manifest.json");
const bindingShaPath = path.join(control, "baseline-binding-manifest.sha256");
const failures = [];

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function detachedHash(file) {
  return fs.readFileSync(file, "utf8").trim().split(/\s+/u)[0]?.toLowerCase();
}

function resolveControlled(relative) {
  const target = path.resolve(root, relative);
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    failures.push(`${relative}: outside repository root`);
    return null;
  }
  return target;
}

if (!fs.existsSync(bindingPath) || !fs.existsSync(bindingShaPath)) {
  console.error("Baseline binding manifest or detached hash is missing.");
  process.exit(1);
}

const bindingHash = sha256(bindingPath);
if (bindingHash !== detachedHash(bindingShaPath)) failures.push("baseline-binding-manifest.json: detached hash mismatch");
const binding = JSON.parse(fs.readFileSync(bindingPath, "utf8"));

for (const [relative, expected] of Object.entries(binding.controlledMetadata)) {
  const target = resolveControlled(relative);
  if (!target || !fs.existsSync(target)) failures.push(`${relative}: missing`);
  else if (sha256(target) !== expected) failures.push(`${relative}: hash mismatch`);
}

const candidateManifestPath = resolveControlled(binding.candidateManifest.path);
const candidateShaPath = resolveControlled(binding.candidateManifest.detachedHashPath);
if (candidateManifestPath && candidateShaPath && fs.existsSync(candidateManifestPath) && fs.existsSync(candidateShaPath)) {
  const manifestHash = sha256(candidateManifestPath);
  if (manifestHash !== binding.candidateManifest.sha256) failures.push("candidate-manifest.json: binding hash mismatch");
  if (manifestHash !== detachedHash(candidateShaPath)) failures.push("candidate-manifest.json: detached hash mismatch");
  const candidate = JSON.parse(fs.readFileSync(candidateManifestPath, "utf8"));
  if (Object.keys(candidate.files).length !== binding.controlledPayloadFileCount) failures.push("candidate manifest: controlled file count mismatch");
  for (const [relative, expected] of Object.entries(candidate.files)) {
    const target = resolveControlled(relative);
    if (!target || !fs.existsSync(target)) failures.push(`${relative}: missing`);
    else if (sha256(target) !== expected) failures.push(`${relative}: payload hash mismatch`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Baseline binding verified (${binding.controlledPayloadFileCount} payload files; ${Object.keys(binding.controlledMetadata).length} metadata/tool files).`);
