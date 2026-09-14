import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INCLUDED_EXTENSIONS = new Set([".css", ".csv", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".sql", ".ts", ".tsx", ".txt"]);
const EXCLUDED_DIRECTORIES = new Set([".git", ".next", ".tools", "node_modules", "playwright-report", "test-results", "tmp"]);
const FORBIDDEN_MOJIBAKE = /[\u00c2\u00c3\u00e2\ufffd]/u;
const FORBIDDEN_INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0]/u;
const UNEXPECTED_ALPHABET = /[\u0370-\u052f\u0590-\u08ff\u0900-\u1fff\u2c00-\u2dff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\ua640-\ua69f\uac00-\ud7af\uf900-\ufaff]/u;
const decoder = new TextDecoder("utf-8", { fatal: true });

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(target);
    return INCLUDED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [target] : [];
  });
}

function location(text, index) {
  const before = text.slice(0, index);
  return `${before.split(/\r?\n/).length}:${index - before.lastIndexOf("\n")}`;
}

const failures = [];
const files = collect(ROOT);
for (const file of files) {
  const relative = path.relative(ROOT, file);
  const bytes = fs.readFileSync(file);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) failures.push(`${relative}:1:1 UTF-8 BOM is not permitted.`);
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    failures.push(`${relative}:1:1 File is not valid UTF-8.`);
    continue;
  }
  if (text !== text.normalize("NFC")) failures.push(`${relative}:1:1 Text is not Unicode NFC-normalised.`);
  for (const [pattern, message] of [
    [FORBIDDEN_MOJIBAKE, "Forbidden mojibake or replacement character detected."],
    [FORBIDDEN_INVISIBLE, "Invisible or non-printing Unicode character detected."],
    [UNEXPECTED_ALPHABET, "Unexpected non-Latin alphabet detected."],
  ]) {
    const match = pattern.exec(text);
    if (match) failures.push(`${relative}:${location(text, match.index)} ${message}`);
  }
}

if (failures.length) {
  console.error(`Text-standard validation failed with ${failures.length} issue(s):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Text-standard validation passed for ${files.length} UTF-8, BOM-free, NFC-normalised files.`);
