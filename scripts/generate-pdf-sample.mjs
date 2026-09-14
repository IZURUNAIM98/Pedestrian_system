import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const stripImports = (value) => value.replace(/^import .*?;\s*$/gm, "").trim();
const source = [
  'import { z } from "zod";',
  read("lib/types.ts"),
  read("lib/text-standard.ts"),
  stripImports(read("lib/utils.ts")),
  stripImports(read("lib/motion.ts")),
  stripImports(read("lib/simulation.ts")),
  stripImports(read("lib/pdf-report.ts")),
].join("\n\n");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const buildDir = path.join(root, "tmp", "pdf-sample-build");
fs.mkdirSync(buildDir, { recursive: true });
const modulePath = path.join(buildDir, "report-module.mjs");
fs.writeFileSync(modulePath, compiled);
const { createSimulationReportPdf, runSimulation } = await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`);

const sessions = [
  runSimulation({ mode: "normal", scenarioId: "normal-vehicle-fire-smoke-explosion", operatingConditions: { weather: "dry", lighting: "night", visibility: "dense-haze" } }, new Date(1788495605974)),
  runSimulation({ mode: "normal", scenarioId: "normal-no-violation", operatingConditions: { weather: "rain", lighting: "day", visibility: "dense-haze" } }, new Date(1788495362016)),
  runSimulation({ mode: "normal", scenarioId: "normal-no-violation", operatingConditions: { weather: "rain", lighting: "day", visibility: "clear" } }, new Date(1788495339149)),
];
const output = path.join(root, "output", "pdf", "smartcross-2-2-professional-simulation-report.pdf");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, createSimulationReportPdf(sessions, new Date("2026-09-04T04:27:49Z")));
console.log(output);
