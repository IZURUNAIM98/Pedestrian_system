import fs from "node:fs";
import path from "node:path";

const root = fs.realpathSync(process.cwd());
const manifest = JSON.parse(fs.readFileSync(path.join(root, "control/candidate-manifest.json"), "utf8"));
const inspectedExtensions = new Set([".js", ".json", ".mjs", ".ts", ".tsx"]);
const originalWorktreeMarker = ["Pedestrian", "system"].join("_");
const failures = [];
let inspected = 0;

for (const relative of Object.keys(manifest.files)) {
  const target = path.resolve(root, relative);
  const confined = path.relative(root, target);
  if (!confined || confined.startsWith("..") || path.isAbsolute(confined)) {
    failures.push(`${relative}: outside repository root`);
    continue;
  }
  if (!fs.existsSync(target)) {
    failures.push(`${relative}: missing`);
    continue;
  }
  if (!inspectedExtensions.has(path.extname(relative).toLowerCase())) continue;
  inspected += 1;
  const text = fs.readFileSync(target, "utf8");
  if (text.includes(originalWorktreeMarker) || /^[A-Za-z]:[\\/]/mu.test(text)) {
    failures.push(`${relative}: original-worktree or absolute path reference`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Controlled containment verified (${inspected} executable/configuration files inspected; unrelated inherited repository files excluded).`);
