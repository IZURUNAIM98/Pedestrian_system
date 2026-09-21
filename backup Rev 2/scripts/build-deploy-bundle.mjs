import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";
import postcss from "postcss";
import ts from "typescript";
import terser from "next/dist/compiled/terser/bundle.min.js";
import "./verify-smartcross-2-2-lock.mjs";

const root = process.cwd();
const out = path.join(root, "tmp", "deploy");
const relativeOut = path.relative(root, out);
if (relativeOut !== path.join("tmp", "deploy") || relativeOut.startsWith("..")) throw new Error("Unsafe deployment output path.");
if (fs.existsSync(out)) {
  for (const entry of fs.readdirSync(out)) {
    fs.rmSync(path.join(out, entry), { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(out, { recursive: true });
}
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

const compactStringDictionary = [
  "Local deterministic simulation only.", "pedestrian signal", "vehicle signal", "traffic approaches", "operating conditions", "authorised human review",
  "the pedestrian", "The pedestrian", "the crossing", "The crossing", "the vehicle", "The vehicle", "the controller", "both vehicles", "route is clear",
  "simulated system", "Simulated system", "no external", "No external", "stop line", "Stop line", "human review", "Human review",
  " pedestrian", " crossing", " vehicle", " simulation", " controller", " protected", " condition", " school", " Vehicle A", " Vehicle B",
  " remains", " recorded", " approach", " confidence", " authorised", " traffic", " system", " violation", " movement", " route",
  " the ", " and ", " with ", " while ", " after ", " before ", " from ", " into ", " only ", " for ", " are ", " through ",
];
const compactStringTokens = compactStringDictionary.map((_, index) => String.fromCodePoint(0xe000 + index));
const compactTypeScript = async (value, encodeStrings = true) => {
  const transpiled = ts.transpileModule(value, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sourceFile = ts.createSourceFile("deploy-bundle.js", transpiled, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const transformResult = ts.transform(sourceFile, [(context) => {
    const visit = (node) => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text.length >= 24) {
        const parent = node.parent;
        const isModuleSpecifier = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node;
        const isPropertyName = (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node;
        if (!isModuleSpecifier && !isPropertyName) {
          let encoded = node.text;
          compactStringDictionary.forEach((phrase, index) => { encoded = encoded.replaceAll(phrase, compactStringTokens[index]); });
          if (encoded !== node.text) return context.factory.createCallExpression(context.factory.createIdentifier("__expand"), undefined, [context.factory.createStringLiteral(encoded)]);
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (rootNode) => ts.visitNode(rootNode, visit);
  }]);
  const transformed = ts.createPrinter({ removeComments: true }).printFile(transformResult.transformed[0]);
  transformResult.dispose();
  const dictionaryPrelude = `const __dictionary=${JSON.stringify(compactStringDictionary)},__tokens=${JSON.stringify(compactStringTokens)},__expand=e=>{for(let n=0;n<__dictionary.length;n++)e=e.replaceAll(__tokens[n],__dictionary[n]);return e};`;
  const result = await terser.minify(encodeStrings ? `${dictionaryPrelude}\n${transformed}` : transpiled, {
    module: true,
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  if (!result.code) throw new Error("Deployment source minification returned no code.");
  return result.code;
};

const deployedComponentFiles = [
  "components/dashboard.tsx",
  "components/crossing-view.tsx",
  "components/heavy-traffic-panel.tsx",
  "components/event-log.tsx",
  "components/timeline-rail.tsx",
  "components/ui/badge.tsx",
  "components/ui/button.tsx",
  "components/ui/card.tsx",
  "components/access-form.tsx",
  "app/access/page.tsx",
  "app/layout.tsx",
  "app/page.tsx",
  "app/smartcross-2-2/page.tsx",
];
const deployedStringTokens = new Set();
const dynamicClassPrefixes = new Set();
for (const file of deployedComponentFiles) {
  const sourceFile = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const collectStringToken = (value) => {
    for (const match of value.matchAll(/[A-Za-z_][\w-]*/g)) {
      deployedStringTokens.add(match[0]);
      if (match[0].endsWith("-")) dynamicClassPrefixes.add(match[0]);
    }
  };
  const collectClassValue = (node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) collectStringToken(node.text);
    ts.forEachChild(node, collectClassValue);
  };
  const visit = (node) => {
    const isClassAttribute = ts.isJsxAttribute(node) && node.name.getText(sourceFile) === "className";
    const isClassVariable = ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /class/i.test(node.name.text);
    const isClassJoin = ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cn";
    if (isClassAttribute && node.initializer) collectClassValue(node.initializer);
    if (isClassVariable && node.initializer) collectClassValue(node.initializer);
    if (isClassJoin) node.arguments.forEach(collectClassValue);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}
const combinedCss = postcss.parse(`${read("app/globals.css").replace('@import "tailwindcss";', "")}\n${read("app/enhancements.css")}`);
combinedCss.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
  const reachableSelectors = rule.selectors?.filter((selector) => {
    const classNames = [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]);
    return classNames.length === 0 || classNames.every((name) => deployedStringTokens.has(name) || [...dynamicClassPrefixes].some((prefix) => name.startsWith(prefix)));
  });
  if (!reachableSelectors?.length) rule.remove();
  else rule.selectors = reachableSelectors;
});
write("app/globals.css", transform({ filename: "globals.css", code: Buffer.from(combinedCss.toString()), minify: true }).code);

const types = read("lib/types.ts");
const textStandard = read("lib/text-standard.ts");
const motion = read("lib/motion.ts");
const cameraFallback = read("lib/camera-fallback.ts");
const safetyOrchestrator = read("lib/safety-orchestrator.ts");
const simulation = read("lib/simulation.ts");
const zodImport = simulation.match(/^import \{ z \} from "zod";$/m)?.[0] ?? 'import { z } from "zod";';
write("lib/simulation.js", await compactTypeScript(`${zodImport}\n${types}\n${textStandard}\n${motion.replace(/^import .*?;\s*$/gm, "").trim()}\n${cameraFallback.replace(/^import .*?;\s*$/gm, "").trim()}\n${safetyOrchestrator.replace(/^import .*?;\s*$/gm, "").trim()}\n${simulation.replace(/^import .*?;\s*$/gm, "").trim()}\n`));

const dashboardHeader = `"use client";
import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes } from "react";
import { useRouter } from "next/navigation";
  import { applyConfidenceSafetyOverride, assessCameraFallback, DEFAULT_OPERATING_CONDITIONS, DEFAULT_SECONDARY_SAFETY_INPUTS, DEGRADED_PROTECTED_WALK_SECONDS, deriveOperatingConditions, isCameraDegraded, protectedFallbackScenarioId, SCENARIOS, SCHOOL_ZONE_SPEED_PROFILE, STANDARD_MOTION_FRAME_MS, TIMELINE_STAGES, frameFor, getProgress, idleFrame, MOTION_FRAME_COUNT, MOTION_STAGE_BY_FRAME, motionSlugForScenario, runSimulation, timingFor, type CrossingMode, type EventLogEntry, type MotionEffect, type OperatingConditions, type PedestrianMotion, type PedestrianState, type ScenarioId, type Severity, type SignalState, type SimulationResult, type TimelineStage, type VehicleMotion } from "../lib/simulation";
  import { CCTV_DETECTION_RANGE_METERS, createEmergencyPriorityRecord } from "../lib/emergency-priority";
  import { HEAVY_TRAFFIC_DEFAULTS, HEAVY_TRAFFIC_NAME, HEAVY_TRAFFIC_PRESETS, createHeavyTrafficState, heavyTrafficConfigSchema, heavyTrafficDominance, heavyTrafficPedestrianTimer, heavyTrafficSignals, heavyTrafficActorX, registerHeavyTrafficRequest, stepHeavyTraffic } from "../lib/heavy-traffic";
`;
const dashboardParts = [
  "lib/text-standard.ts",
    "lib/utils.ts",
  "lib/pdf-report.ts",
  "components/ui/badge.tsx",
  "components/ui/button.tsx",
  "components/ui/card.tsx",
  "components/crossing-view.tsx",
  "components/heavy-traffic-panel.tsx",
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
write("components/dashboard.jsx", `"use client";${await compactTypeScript(`${dashboardHeader}\n${dashboardParts.join("\n\n")}\n`, false)}`);

const copiedFiles = [
  "package.json",
  "app/layout.tsx",
  "app/page.tsx",
  "app/access/page.tsx",
  "app/api/login/route.ts",
  "app/api/logout/route.ts",
  "app/api/simulate/route.ts",
  "app/smartcross-2-2/page.tsx",
  "components/access-form.tsx",
  "components/ui/button.tsx",
  "lib/demo-auth.ts",
  "lib/text-standard.ts",
  "lib/utils.ts",
  "lib/emergency-priority.ts",
  "lib/heavy-traffic.ts",
  "lib/safety-orchestrator.ts",
  "lib/types.ts",
];

for (const file of copiedFiles) {
  let value = read(file);
  if (file === "package.json") {
    const deploymentPackage = JSON.parse(value);
    deploymentPackage.scripts = { build: "next build", start: "next start" };
    deploymentPackage.devDependencies = {
      "@types/node": deploymentPackage.devDependencies["@types/node"],
      "@types/react": deploymentPackage.devDependencies["@types/react"],
      "@types/react-dom": deploymentPackage.devDependencies["@types/react-dom"],
      typescript: deploymentPackage.devDependencies.typescript,
    };
    value = JSON.stringify(deploymentPackage);
  }
  if (file === "app/layout.tsx") value = value.replace('import "./enhancements.css";\n', "");
  if (file === "app/page.tsx") value = value.replaceAll('"@/components/dashboard"', '"../components/dashboard"').replaceAll('"@/lib/demo-auth"', '"../lib/demo-auth"');
  if (file === "app/smartcross-2-2/page.tsx") value = value.replaceAll('"@/components/dashboard"', '"../../components/dashboard"').replaceAll('"@/lib/demo-auth"', '"../../lib/demo-auth"');
  if (file === "app/access/page.tsx") value = value.replaceAll('"@/components/access-form"', '"../../components/access-form"').replaceAll('"@/lib/demo-auth"', '"../../lib/demo-auth"');
  if (file === "app/api/simulate/route.ts") value = value.replaceAll('"@/lib/demo-auth"', '"../../../lib/demo-auth"').replaceAll('"@/lib/simulation"', '"../../../lib/simulation"').replaceAll('"@/lib/text-standard"', '"../../../lib/simulation"');
  if (file === "app/api/login/route.ts" || file === "app/api/logout/route.ts") value = value.replaceAll('"@/lib/demo-auth"', '"../../../lib/demo-auth"').replaceAll('"@/lib/text-standard"', '"../../../lib/text-standard"');
  if (file === "components/access-form.tsx") value = value.replaceAll('"@/lib/text-standard"', '"../lib/text-standard"').replaceAll('"@/components/ui/button"', '"./ui/button"');
  if (file === "components/ui/button.tsx") value = value.replaceAll('"@/lib/utils"', '"../../lib/utils"');
  if (file === "lib/utils.ts") value = value.replaceAll('"@/lib/text-standard"', '"./text-standard"');
  if (file === "lib/emergency-priority.ts") value = value.replaceAll('"@/lib/types"', '"./types"');
  if (file === "lib/heavy-traffic.ts") value = value.replaceAll("'@/lib/emergency-priority'", "'./emergency-priority'").replaceAll("'@/lib/types'", "'./types'");
  if (file === "lib/types.ts") value = value.replaceAll('"@/lib/safety-orchestrator"', '"./safety-orchestrator"');
  if (/\.[cm]?[jt]sx?$/u.test(file) && file !== "lib/emergency-priority.ts" && file !== "lib/types.ts" && file !== "lib/heavy-traffic.ts" && file !== "lib/safety-orchestrator.ts") value = await compactTypeScript(value, false);
  if (file === "components/access-form.tsx") value = `"use client";${value}`;
  write(file, value);
}

write(".vercelignore", ".next\nnode_modules\n.vercel\n.env\n.env.*\n");

console.log("Prepared SmartCross Vercel bundle in tmp/deploy");
