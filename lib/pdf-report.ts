import type { SimulationResult } from "@/lib/types";
import { capitaliseEnglish } from "@/lib/text-standard";
import { formatTimestamp } from "@/lib/utils";

const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

export const PDF_REPORT_THEME = Object.freeze({
  page: PAGE,
  margin: MARGIN,
  colours: {
    navy: "0.02 0.20 0.27",
    teal: "0.04 0.47 0.43",
    ink: "0.08 0.15 0.18",
    muted: "0.34 0.42 0.45",
    line: "0.76 0.81 0.81",
    panel: "0.96 0.97 0.96",
    white: "1 1 1",
    warning: "0.52 0.37 0.05",
    critical: "0.73 0.08 0.10",
    watermark: "0.95 0.96 0.95",
  },
});

type FontKey = "regular" | "bold";
type ReportRow = [label: string, value: string];

function plainText(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfText(value: string): string {
  return plainText(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function textWidth(value: string, size: number, bold = false): number {
  return plainText(value).length * size * (bold ? 0.54 : 0.5);
}

function wrapText(value: string, width: number, size: number, bold = false): string[] {
  const output: string[] = [];
  for (const paragraph of plainText(value).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { output.push(""); continue; }
    let line = "";
    for (const originalWord of words) {
      let word = originalWord;
      while (textWidth(word, size, bold) > width) {
        const count = Math.max(1, Math.floor(width / (size * (bold ? 0.54 : 0.5))));
        if (line) { output.push(line); line = ""; }
        output.push(word.slice(0, count));
        word = word.slice(count);
      }
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, size, bold) > width) { output.push(line); line = word; } else line = next;
    }
    if (line) output.push(line);
  }
  return output.length ? output : [""];
}

function text(textValue: string, x: number, y: number, size: number, font: FontKey = "regular", colour = PDF_REPORT_THEME.colours.ink): string {
  return `BT /${font === "bold" ? "F2" : "F1"} ${size.toFixed(2)} Tf ${colour} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfText(textValue)}) Tj ET`;
}

function fill(x: number, y: number, width: number, height: number, colour: string): string {
  return `q ${colour} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`;
}

function stroke(x: number, y: number, width: number, height: number, colour = PDF_REPORT_THEME.colours.line, lineWidth = 0.55): string {
  return `q ${colour} RG ${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q`;
}

function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: "Asia/Kuala_Lumpur",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function reportIdFor(generatedAt: Date, item?: SimulationResult): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: "Asia/Kuala_Lumpur",
  }).formatToParts(generatedAt);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  const suffix = item?.sessionId.replace(/^SIM-/, "").slice(-4) ?? "0000";
  return `SC22-${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}${get("second")}-${suffix}`;
}

function displayScenarioName(item: SimulationResult): string {
  return item.scenario.label.replace(/^\d{2}\.\s+/, "");
}

function finalOutcomeFor(item: SimulationResult): string {
  return item.confidenceAssessment.conclusionPermitted
    ? item.scenario.finalOutcome
    : "No automated conclusion - confidence assessment is non-usable";
}

function parseTimeline(item: SimulationResult, detail: string): { description: string; sensorRisk: string; vehicle: string; pedestrian: string } {
  const match = detail.match(/^(.*?)\s+Active sensor:\s*([^;]+);\s*risk:\s*([^;]+);\s*vehicle signal:\s*([^;]+);\s*pedestrian signal:\s*([^.;]+)\.?$/i);
  if (!match) return { description: detail, sensorRisk: "Unavailable", vehicle: "-", pedestrian: "-" };
  const shared = `${item.confidenceAssessment.label}: ${item.confidenceAssessment.action}`;
  return {
    description: match[1].replace(shared, "").replace(/\s+/g, " ").trim(),
    sensorRisk: `${capitaliseEnglish(match[2].trim())} / ${match[3].trim()}`,
    vehicle: match[4].trim(),
    pedestrian: match[5].trim(),
  };
}

function drawPanel(commands: string[], title: string, rows: ReportRow[], x: number, top: number, width: number, scale: number): number {
  const titleHeight = 20 * scale;
  const fontSize = 7.7 * scale;
  const leading = 9.2 * scale;
  const padding = 4 * scale;
  const labelWidth = Math.min(78 * scale, width * 0.34);
  const prepared = rows.map(([label, value]) => ({
    label: wrapText(label, labelWidth - padding * 2, fontSize, true),
    value: wrapText(value, width - labelWidth - padding * 2, fontSize),
  }));
  const heights = prepared.map((row) => Math.max(row.label.length, row.value.length) * leading + padding * 2);
  const totalHeight = titleHeight + heights.reduce((sum, height) => sum + height, 0);
  commands.push(fill(x, top - titleHeight, width, titleHeight, PDF_REPORT_THEME.colours.navy));
  commands.push(text(title, x + 6 * scale, top - 14 * scale, 9 * scale, "bold", PDF_REPORT_THEME.colours.white));
  let y = top - titleHeight;
  prepared.forEach((row, index) => {
    const height = heights[index];
    if (index % 2 === 0) commands.push(fill(x, y - height, width, height, PDF_REPORT_THEME.colours.panel));
    commands.push(stroke(x, y - height, width, height), `q ${PDF_REPORT_THEME.colours.line} RG 0.45 w ${(x + labelWidth).toFixed(2)} ${(y - height).toFixed(2)} m ${(x + labelWidth).toFixed(2)} ${y.toFixed(2)} l S Q`);
    row.label.forEach((line, lineIndex) => commands.push(text(line, x + padding, y - padding - fontSize - lineIndex * leading, fontSize, "bold")));
    row.value.forEach((line, lineIndex) => commands.push(text(line, x + labelWidth + padding, y - padding - fontSize - lineIndex * leading, fontSize)));
    y -= height;
  });
  return top - totalHeight;
}

function drawEventTable(commands: string[], item: SimulationResult, top: number, scale: number): number {
  const widths = [20, 54, 44, 215, 72, 47, 47].map((width) => width * scale);
  const headers = ["No.", "Stage", "Time", "Occurrence detail", "Sensor / risk", "Vehicle", "Ped."];
  const fontSize = 7.15 * scale;
  const leading = 8.3 * scale;
  const padding = 3.2 * scale;
  const headerHeight = 20 * scale;
  let x = MARGIN;
  commands.push(fill(MARGIN, top - headerHeight, CONTENT_WIDTH, headerHeight, PDF_REPORT_THEME.colours.navy));
  headers.forEach((header, index) => {
    commands.push(stroke(x, top - headerHeight, widths[index], headerHeight));
    wrapText(header, widths[index] - padding * 2, fontSize, true).forEach((line, lineIndex) => commands.push(text(line, x + padding, top - padding - fontSize - lineIndex * leading, fontSize, "bold", PDF_REPORT_THEME.colours.white)));
    x += widths[index];
  });
  let y = top - headerHeight;
  item.timeline.forEach((stage, index) => {
    const parsed = parseTimeline(item, stage.detail);
    const cells = [String(index + 1), stage.name, formatTimestamp(stage.timestamp), parsed.description, parsed.sensorRisk, parsed.vehicle, parsed.pedestrian];
    const wrapped = cells.map((cell, cellIndex) => wrapText(cell, widths[cellIndex] - padding * 2, fontSize, cellIndex === 0 || cellIndex === 1 || cellIndex > 4));
    const height = Math.max(...wrapped.map((lines) => lines.length)) * leading + padding * 2;
    x = MARGIN;
    if (index % 2 === 0) commands.push(fill(MARGIN, y - height, CONTENT_WIDTH, height, PDF_REPORT_THEME.colours.panel));
    wrapped.forEach((lines, cellIndex) => {
      commands.push(stroke(x, y - height, widths[cellIndex], height));
      lines.forEach((line, lineIndex) => commands.push(text(line, x + padding, y - padding - fontSize - lineIndex * leading, fontSize, cellIndex === 0 || cellIndex === 1 || cellIndex > 4 ? "bold" : "regular")));
      x += widths[cellIndex];
    });
    y -= height;
  });
  return y;
}

function notificationSummary(item: SimulationResult): string {
  if (!item.notificationRecipients.length) return "None queued; operator review only. No external dispatch.";
  return `${item.notificationRecipients.map((recipient) => recipient.name).join("; ")}. Local mock queue only; no external dispatch.`;
}

function evidenceRows(item: SimulationResult): ReportRow[] {
  if (!item.cctvEvidence) return [["ANPR", "Inactive - no plate captured because no violation was detected."], ["Evidence", "No synthetic CCTV evidence created."]];
  return [
    ["Status", "SIMULATED EVIDENCE"],
    ["Camera / plate", `${item.cctvEvidence.cameraId} / ${item.cctvEvidence.plateNumber}`],
    ["Capture", `${formatTimestamp(item.cctvEvidence.capturedAt)} MYT / ${item.cctvEvidence.vehicleDirection}`],
    ["Condition", item.cctvEvidence.detectedCondition],
    ["Confidence", `${Math.round(item.cctvEvidence.recognitionConfidence * 100)}% mock recognition`],
  ];
}

function buildOccurrencePage(item: SimulationResult | undefined, generatedAt: Date, reportId: string, scale: number): { commands: string[]; bottom: number } {
  const commands: string[] = [];
  commands.push(fill(0, 0, PAGE.width, PAGE.height, "1 1 1"));
  commands.push(`q\n${PDF_REPORT_THEME.colours.watermark} rg\nBT /F2 35 Tf 0.707 0.707 -0.707 0.707 150 260 Tm (SIMULATION ONLY) Tj ET\nQ`);
  commands.push(fill(0, 787, PAGE.width, 55, PDF_REPORT_THEME.colours.navy));
  commands.push(text("SMARTCROSS 2.2", MARGIN, 814, 12, "bold", PDF_REPORT_THEME.colours.white));
  commands.push(text("CURRENT OCCURRENCE BRIEF", MARGIN + 128, 814, 10, "regular", "0.72 0.86 0.84"));
  commands.push(text(reportId, PAGE.width - MARGIN - textWidth(reportId, 7.5), 814, 7.5, "regular", PDF_REPORT_THEME.colours.white));
  if (!item) {
    commands.push(text("No current occurrence", MARGIN, 744, 20, "bold", PDF_REPORT_THEME.colours.navy));
    commands.push(text("Run a simulation before downloading an occurrence brief.", MARGIN, 714, 10));
    commands.push(fill(MARGIN, 620, CONTENT_WIDTH, 58, PDF_REPORT_THEME.colours.panel), stroke(MARGIN, 620, CONTENT_WIDTH, 58, PDF_REPORT_THEME.colours.teal));
    commands.push(text("SIMULATION ONLY", MARGIN + 14, 654, 10, "bold", PDF_REPORT_THEME.colours.teal));
    commands.push(text("No live CCTV, enforcement, signal control, or emergency dispatch is connected.", MARGIN + 14, 636, 9));
    return { commands, bottom: 620 };
  }

  commands.push(text(displayScenarioName(item), MARGIN, 757, 18 * scale, "bold", PDF_REPORT_THEME.colours.navy));
  commands.push(text(`${capitaliseEnglish(item.mode)} crossing - ${item.scenario.violation ? "Violation" : "No violation"} - ${capitaliseEnglish(item.scenario.severity)} severity`, MARGIN, 736, 9 * scale, "bold", item.incident ? PDF_REPORT_THEME.colours.critical : PDF_REPORT_THEME.colours.teal));

  const overviewRows: ReportRow[] = [
    ["Run ID", item.sessionId],
    ["Completed", `${formatDateTime(item.completedAt)} MYT`],
    ["Confidence", `${Math.round(item.detectionConfidence * 100)}% - ${item.confidenceAssessment.label}`],
    ["Generated", `${formatDateTime(generatedAt)} MYT`],
  ];
  let y = drawPanel(commands, "OCCURRENCE IDENTIFICATION", overviewRows, MARGIN, 719, CONTENT_WIDTH, scale);
  y -= 8 * scale;
  const gap = 8 * scale;
  const halfWidth = (CONTENT_WIDTH - gap) / 2;
  const conditions: ReportRow[] = [
    ["Conditions", `${capitaliseEnglish(item.operatingConditions.weather)}, ${capitaliseEnglish(item.operatingConditions.lighting)}, ${capitaliseEnglish(item.operatingConditions.visibility)}`],
    ["Sensor", capitaliseEnglish(item.operatingConditions.sensorHealth)],
    ["Input quality", `${Math.round(item.operatingConditions.conditionQuality * 100)}% simulated`],
    ["Trigger", item.scenario.detection],
  ];
  const leftBottom = drawPanel(commands, "DETECTION CONDITIONS", conditions, MARGIN, y, halfWidth, scale);
  const rightBottom = drawPanel(commands, "CCTV / ANPR", evidenceRows(item), MARGIN + halfWidth + gap, y, halfWidth, scale);
  y = Math.min(leftBottom, rightBottom) - 9 * scale;

  commands.push(text("SEVEN-STAGE OCCURRENCE", MARGIN, y, 10.5 * scale, "bold", PDF_REPORT_THEME.colours.navy));
  commands.push(`% EVENT-STAGES: ${item.timeline.map((stage) => stage.name).join("|")}`);
  y = drawEventTable(commands, item, y - 8 * scale, scale) - 9 * scale;

  const actions = item.countermeasures.length
    ? item.countermeasures.map((measure, index) => `${index + 1}. ${measure}`).join(" ")
    : "No violation-specific countermeasure generated.";
  const responseRows: ReportRow[] = [
    ["Outcome", finalOutcomeFor(item)],
    ["Required action", item.confidenceAssessment.action],
    ["Human review", item.emergencyReviewRequired || item.scenario.violation ? "Required before any operational conclusion." : "Not triggered for this no-violation occurrence."],
    ["Notifications", notificationSummary(item)],
    ["Countermeasures", actions],
  ];
  y = drawPanel(commands, "OUTCOME AND REQUIRED RESPONSE", responseRows, MARGIN, y, CONTENT_WIDTH, scale) - 8 * scale;

  const safetyLines = wrapText("Safety boundary: STOP before WALK. No pedestrian entry during WAIT/HOLD. Synthetic plates only. Human review before conclusions. No automatic emergency dispatch.", CONTENT_WIDTH - 20, 7.4 * scale, true);
  const safetyHeight = safetyLines.length * 8.7 * scale + 12 * scale;
  commands.push(fill(MARGIN, y - safetyHeight, CONTENT_WIDTH, safetyHeight, PDF_REPORT_THEME.colours.panel), stroke(MARGIN, y - safetyHeight, CONTENT_WIDTH, safetyHeight, PDF_REPORT_THEME.colours.warning));
  safetyLines.forEach((line, index) => commands.push(text(line, MARGIN + 10, y - 8 * scale - index * 8.7 * scale, 7.4 * scale, "bold", PDF_REPORT_THEME.colours.warning)));
  return { commands, bottom: y - safetyHeight };
}

function serialize(commands: string[], reportId: string): Uint8Array {
  const footer = [
    `q ${PDF_REPORT_THEME.colours.line} RG 0.5 w ${MARGIN} 43 m ${PAGE.width - MARGIN} 43 l S Q`,
    text("SIMULATION ONLY", MARGIN, 26, 7.5, "bold", PDF_REPORT_THEME.colours.critical),
    text("Generated in Malaysian Time", 220, 26, 7.5, "regular", PDF_REPORT_THEME.colours.muted),
    text("Page 1 of 1", PAGE.width - MARGIN - 42, 26, 7.5, "regular", PDF_REPORT_THEME.colours.muted),
  ];
  const stream = [...commands, ...footer].join("\n");
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [5 0 R] /Count 1 >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[5] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`;
  objects[6] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let document = `%PDF-1.4\n%SmartCross 2.2 one-page occurrence brief ${reportId}\n`;
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) { offsets[index] = document.length; document += `${index} 0 obj\n${objects[index]}\nendobj\n`; }
  const xref = document.length;
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) document += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(document);
}

export function createSimulationReportPdf(history: SimulationResult[], generatedAt = new Date()): Uint8Array {
  const currentOccurrence = history[0];
  const reportId = reportIdFor(generatedAt, currentOccurrence);
  let layout = buildOccurrencePage(currentOccurrence, generatedAt, reportId, 1);
  if (layout.bottom < 54) layout = buildOccurrencePage(currentOccurrence, generatedAt, reportId, 0.88);
  layout.commands.push(`% CONTENT-BOTTOM: ${layout.bottom.toFixed(2)}`);
  return serialize(layout.commands, reportId);
}
