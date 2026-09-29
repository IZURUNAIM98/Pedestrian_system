import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const packageId = "RT-HIL-001-STAGE17-TRANSFER-20260924-03";
const root = path.join(process.cwd(), "outputs", packageId);
const evidence = path.join(root, "evidence");
const control = path.join(root, "control");
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const filesUnder = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const map = (directory, filter = () => true) => Object.fromEntries(filesUnder(directory).filter(filter).map((file) => [path.relative(directory, file).replaceAll("\\", "/"), sha(file)]).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(control, "evidence-manifest.json"), `${JSON.stringify({ packageId, algorithm: "sha256", files: map(evidence) }, null, 2)}\n`);
fs.writeFileSync(path.join(control, "evidence-manifest.sha256"), `${sha(path.join(control, "evidence-manifest.json"))}  evidence-manifest.json\n`);
const excluded = new Set(["transfer-manifest.json", "transfer-manifest.sha256"]);
fs.writeFileSync(path.join(root, "transfer-manifest.json"), `${JSON.stringify({ packageId, algorithm: "sha256", files: map(root, (file) => !excluded.has(path.relative(root, file).replaceAll("\\", "/"))) }, null, 2)}\n`);
fs.writeFileSync(path.join(root, "transfer-manifest.sha256"), `${sha(path.join(root, "transfer-manifest.json"))}  transfer-manifest.json\n`);
console.log("New evidence and transfer manifests finalised.");
