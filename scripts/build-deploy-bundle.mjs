import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";
import ts from "typescript";
import terser from "next/dist/compiled/terser/bundle.min.js";
import "./verify-smartcross-2-2-lock.mjs";

const root = process.cwd();
const out = path.join(root, "tmp", "deploy");
const relativeOut = path.relative(root, out);
if (relativeOut !== path.join("tmp", "deploy") || relativeOut.startsWith("..")) throw new Error("Unsafe deployment output path.");
fs.rmSync(out, { recursive: true, force: true });
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, value) => {
  const target = path.join(out, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
};
const withoutImports = (value) => value
  .replace(/^"use client";\s*/m, "")
  .replace(/^import .*?;\s*$/gm, "")
  .trim();

const compactTypeScript = async (value) => {
  const transpiled = ts.transpileModule(value, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const result = await terser.minify(transpiled, {
    module: true,
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  if (!result.code) throw new Error("Deployment source minification returned no code.");
  return result.code;
};

const compactCss = (file) => transform({ filename: path.basename(file), code: Buffer.from(read(file).replace('@import "tailwindcss";', "")), minify: true }).code;
write("app/globals.css", compactCss("app/globals.css"));
write("app/enhancements.css", compactCss("app/enhancements.css"));

const types = read("lib/types.ts");
const textStandard = read("lib/text-standard.ts");
const motion = read("lib/motion.ts");
const cameraFallback = read("lib/camera-fallback.ts");
const simulation = read("lib/simulation.ts");
const zodImport = simulation.match(/^import \{ z \} from "zod";$/m)?.[0] ?? 'import { z } from "zod";';
write("lib/simulation.js", await compactTypeScript(`${zodImport}\n${types}\n${textStandard}\n${motion.replace(/^import .*?;\s*$/gm, "").trim()}\n${cameraFallback.replace(/^import .*?;\s*$/gm, "").trim()}\n${simulation.replace(/^import .*?;\s*$/gm, "").trim()}\n`));

const dashboardHeader = `"use client";
import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes } from "react";
import { applyConfidenceSafetyOverride, assessCameraFallback, DEFAULT_OPERATING_CONDITIONS, DEGRADED_PROTECTED_WALK_SECONDS, deriveOperatingConditions, isCameraDegraded, SCENARIOS, SCHOOL_ZONE_SPEED_PROFILE, STANDARD_MOTION_FRAME_MS, TIMELINE_STAGES, frameFor, getProgress, idleFrame, MOTION_FRAME_COUNT, MOTION_STAGE_BY_FRAME, motionSlugForScenario, runSimulation, timingFor, type CrossingMode, type EventLogEntry, type MotionEffect, type OperatingConditions, type PedestrianMotion, type PedestrianState, type ScenarioId, type Severity, type SignalState, type SimulationResult, type TimelineStage, type VehicleMotion } from "../lib/simulation";
`;
const dashboardParts = [
  "lib/text-standard.ts",
  "lib/utils.ts",
  "lib/pdf-report.ts",
  "components/ui/badge.tsx",
  "components/ui/button.tsx",
  "components/ui/card.tsx",
  "components/crossing-view.tsx",
  "components/timeline-rail.tsx",
  "components/event-log.tsx",
  "components/dashboard.tsx",
].map((file) => {
  const content = withoutImports(read(file));
  if (file !== "components/dashboard.tsx") return content;
  return content.replace(
    /\r?\nfunction capitalise\(value: string\): string \{[\s\S]*?\r?\n\}(?:\r?\n|$)/,
    "\n",
  );
});
write("components/dashboard.jsx", `"use client";${await compactTypeScript(`${dashboardHeader}\n${dashboardParts.join("\n\n")}\n`)}`);

const copiedFiles = [
  "package.json",
  "app/layout.tsx",
  "app/page.tsx",
  "app/api/simulate/route.ts",
  "app/smartcross-2-2/page.tsx",
];

for (const file of copiedFiles) {
  let value = read(file);
  if (file === "package.json") {
    const deploymentPackage = JSON.parse(value);
    deploymentPackage.scripts.build = "next build";
    delete deploymentPackage.scripts["validate:text"];
    value = `${JSON.stringify(deploymentPackage, null, 2)}\n`;
  }
  if (file === "app/page.tsx") value = value.replaceAll('"@/components/dashboard"', '"../components/dashboard"');
  if (file === "app/smartcross-2-2/page.tsx") value = value.replaceAll('"@/components/dashboard"', '"../../components/dashboard"');
  if (file.startsWith("app/api/")) value = value.replaceAll('"@/lib/simulation"', '"../../../lib/simulation"').replaceAll('"@/lib/text-standard"', '"../../../lib/simulation"');
  write(file, value);
}

console.log("Prepared SmartCross 2.2-only Vercel bundle in tmp/deploy");
