import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "control/candidate-manifest.json"), "utf8"));
const includedExtensions = new Set([".css", ".csv", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".sql", ".ts", ".tsx", ".txt"]);
const forbiddenMojibake = /[\u00c2\u00c3\u00e2\ufffd]/u;
const forbiddenInvisible = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0]/u;
const unexpectedAlphabet = /[\u0370-\u052f\u0590-\u08ff\u0900-\u1fff\u2c00-\u2dff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\ua640-\ua69f\uac00-\ud7af\uf900-\ufaff]/u;
const decoder = new TextDecoder("utf-8", { fatal: true });
const files = Object.keys(manifest.files).filter((relative) => includedExtensions.has(path.extname(relative).toLowerCase()));
const failures = [];

function location(text, index) {
  const before = text.slice(0, index);
  return `${before.split(/\r?\n/u).length}:${index - before.lastIndexOf("\n")}`;
}

for (const relative of files) {
  const target = path.resolve(root, relative);
  const confined = path.relative(root, target);
  if (!confined || confined.startsWith("..") || path.isAbsolute(confined) || !fs.existsSync(target)) {
    failures.push(`${relative}:1:1 Missing or outside repository root.`);
    continue;
  }
  const bytes = fs.readFileSync(target);
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
    [forbiddenMojibake, "Forbidden mojibake or replacement character detected."],
    [forbiddenInvisible, "Invisible or non-printing Unicode character detected."],
    [unexpectedAlphabet, "Unexpected non-Latin alphabet detected."],
  ]) {
    const match = pattern.exec(text);
    if (match) failures.push(`${relative}:${location(text, match.index)} ${message}`);
  }
}

if (failures.length) {
  console.error(`Controlled text validation failed with ${failures.length} issue(s):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Controlled text validation passed for ${files.length} manifest-listed UTF-8, BOM-free, NFC-normalised files.`);
