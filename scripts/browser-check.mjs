import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const baseUrl = process.env.CHECK_BASE_URL ?? "http://127.0.0.1:3100";
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

if (process.env.CHECK_SHARE_URL) {
  await page.goto(process.env.CHECK_SHARE_URL, { waitUntil: "networkidle" });
}
await page.goto(`${baseUrl}/access`, { waitUntil: "networkidle" });
await page.screenshot({ path: "browser-check-access-desktop.png", fullPage: true });
await page.getByLabel("Operator ID").fill(process.env.DEMO_ACCESS_ID ?? "");
await page.getByLabel("Password").fill(process.env.DEMO_ACCESS_PASSWORD ?? "");
await page.getByRole("button", { name: "Sign in securely" }).click();
await page.waitForURL(`${baseUrl}/`);
await page.waitForLoadState("networkidle");

const normalOptionCount = await page.getByLabel(/Crossing condition/).locator("option").count();
await page.screenshot({ path: "browser-check-normal-desktop.png", fullPage: true });
await page.getByRole("button", { name: "Run five-stage simulation" }).click();
await page.locator('.crossing-view[data-step="2"]').waitFor({ state: "visible" });
await page.waitForTimeout(500);
await page.screenshot({ path: "browser-check-pedestrian-foreground.png", fullPage: true });
await page.getByRole("button", { name: "Run five-stage simulation" }).waitFor({ state: "visible" });
await page.getByRole("button", { name: "School" }).click();
const schoolOptionCount = await page.getByLabel(/Crossing condition/).locator("option").count();
if (normalOptionCount !== 20 || schoolOptionCount !== 20) throw new Error(`Expected 20 options per crossing; found normal=${normalOptionCount}, school=${schoolOptionCount}.`);
await page.getByLabel(/Crossing condition/).selectOption("school-crossing-zone-speeding");
const idlePositions = await page.locator(".car").evaluateAll((elements) => elements.map((element) => { const box = element.getBoundingClientRect(); return { left: Math.round(box.left), top: Math.round(box.top) }; }));
await page.waitForTimeout(900);
const idlePositionsAfterWait = await page.locator(".car").evaluateAll((elements) => elements.map((element) => { const box = element.getBoundingClientRect(); return { left: Math.round(box.left), top: Math.round(box.top) }; }));
if (JSON.stringify(idlePositions) !== JSON.stringify(idlePositionsAfterWait)) throw new Error(`Vehicles moved before Run: ${JSON.stringify({ idlePositions, idlePositionsAfterWait })}`);
if (Math.abs(idlePositions[0].top - idlePositions[1].top) < 55) throw new Error(`Vehicles are not separated into opposing lanes: ${JSON.stringify(idlePositions)}`);
const initialCarLeft = idlePositions[0].left;
await page.getByRole("button", { name: "Run five-stage simulation" }).click();

let unsafeWalk = false;
let violationWalkObserved = false;
const carPositions = [];
for (let index = 0; index < 20; index += 1) {
  const label = await page.locator(".crossing-view").getAttribute("aria-label");
  if (label?.includes("Pedestrian signal WALK") && !label.includes("Vehicle signal STOP")) unsafeWalk = true;
  if (label?.includes("Pedestrian signal WALK")) violationWalkObserved = true;
  carPositions.push(await page.locator(".car-left").evaluate((element) => Math.round(element.getBoundingClientRect().left)));
  await page.waitForTimeout(220);
}
const finalCarLeft = await page.locator(".car-left").evaluate((element) => element.getBoundingClientRect().left);
const finalViolationSignal = await page.locator(".crossing-view").getAttribute("aria-label");
if (!finalViolationSignal?.includes("Vehicle signal STOP. Pedestrian signal WAIT")) throw new Error(`Violation outcome did not remain STOP/WAIT: ${finalViolationSignal}`);
const schoolCampusBox = await page.locator(".school-campus").evaluate((element) => { const box = element.getBoundingClientRect(); return { left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width), height: Math.round(box.height) }; });
const pedestrianIconBox = await page.locator(".person-top").evaluate((element) => { const box = element.getBoundingClientRect(); return { width: Math.round(box.width), height: Math.round(box.height) }; });
const engineeringZoneCount = await page.locator(".engineering-zone").count();
const trafficLightCount = await page.locator(".traffic-light").count();
const speedRecordCount = await page.locator(".vehicle-speed-record").count();
const vehicleSpeedCount = await page.locator(".car-speed").count();
const pedestrianTimerCount = await page.locator(".pedestrian-timer").count();
const safeMarkerCount = await page.locator(".safe-marker").count();
const abolishedZoneCount = await page.locator(".zone-approach, .zone-waiting, .zone-collection, .signal-vehicle").count();
const pedestrianZIndex = await page.locator(".person-top").evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
const zebraZIndex = await page.locator(".zebra").evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
if (engineeringZoneCount !== 4) throw new Error(`Expected 4 retained engineering zones; found ${engineeringZoneCount}.`);
if (trafficLightCount !== 2) throw new Error(`Expected two bilateral traffic lights; found ${trafficLightCount}.`);
if (speedRecordCount !== 0) throw new Error(`Expected separate speed records to be removed; found ${speedRecordCount}.`);
if (vehicleSpeedCount !== 2) throw new Error(`Expected speed inside both vehicle icons; found ${vehicleSpeedCount}.`);
if (pedestrianTimerCount !== 2) throw new Error(`Expected two pedestrian WAIT/WALK timers; found ${pedestrianTimerCount}.`);
const accessibleRouteCount = await page.locator(".zone-accessible, .waiting-zone-bottom").count();
if (accessibleRouteCount !== 0) throw new Error(`Expected the accessible-route zone and label to be removed; found ${accessibleRouteCount}.`);
if (safeMarkerCount !== 0) throw new Error(`The abolished no-violation protected-walk badge is still present.`);
if (abolishedZoneCount !== 0) throw new Error(`Abolished crossing overlays remain visible; found ${abolishedZoneCount}.`);
if (pedestrianZIndex <= zebraZIndex) throw new Error(`Pedestrian is not in front of zebra: pedestrian=${pedestrianZIndex}, zebra=${zebraZIndex}.`);
if (violationWalkObserved) throw new Error("A violation sequence displayed pedestrian WALK.");
await page.screenshot({ path: "browser-check-school-desktop.png", fullPage: true });

await page.getByRole("button", { name: "Normal" }).click();
await page.getByLabel(/Crossing condition/).selectOption("normal-vehicle-fire-smoke-explosion");
await page.getByRole("button", { name: "Run five-stage simulation" }).click();
await page.locator(".vehicle-fire-icon").waitFor({ state: "visible" });
await page.locator(".mock-notification-card").getByText("No external message can leave prototype mode.").waitFor({ state: "visible" });
const mockRecipientCount = await page.locator(".mock-recipient-list li").count();
if (mockRecipientCount !== 4) throw new Error(`Expected four fictional test recipients; found ${mockRecipientCount}.`);
const pedestrianIconCount = await page.locator(".pedestrian-icon").count();
if (pedestrianIconCount !== 1) throw new Error(`Expected one pedestrian icon; found ${pedestrianIconCount}.`);
await page.screenshot({ path: "browser-check-fire-desktop.png", fullPage: true });

await page.getByRole("button", { name: "technology" }).click();
await page.screenshot({ path: "browser-check-technology-desktop.png", fullPage: true });
await page.getByRole("button", { name: "scenarios" }).click();
await page.screenshot({ path: "browser-check-scenarios-desktop.png", fullPage: true });

await page.getByRole("button", { name: "reports" }).click();
mkdirSync("tmp/pdfs", { recursive: true });
const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Download PDF" }).click();
const download = await downloadPromise;
await download.saveAs("tmp/pdfs/lintas-ai-simulation-report.pdf");

await page.setViewportSize({ width: 360, height: 800 });
await page.getByRole("button", { name: "simulator" }).click();
await page.screenshot({ path: "browser-check-mobile.png", fullPage: true });
const diagnostics = await page.evaluate(() => ({
  title: document.title,
  bodyTextLength: document.body.innerText.trim().length,
  overlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")),
  viewport: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  hasSchoolCourtyard: Boolean(document.querySelector(".school-campus")),
}));

console.log(JSON.stringify({ ...diagnostics, normalOptionCount, schoolOptionCount, engineeringZoneCount, trafficLightCount, speedRecordCount, vehicleSpeedCount, pedestrianTimerCount, safeMarkerCount, abolishedZoneCount, mockRecipientCount, pedestrianIconCount, pedestrianZIndex, zebraZIndex, idlePositions, idleVehiclesStationary: JSON.stringify(idlePositions) === JSON.stringify(idlePositionsAfterWait), carMoved: Math.max(...carPositions) - Math.min(...carPositions) > 40, initialCarLeft: Math.round(initialCarLeft), finalCarLeft: Math.round(finalCarLeft), finalViolationSignal, carPositions, schoolCampusBox, pedestrianIconBox, violationWalkObserved, unsafeWalk, consoleErrors }, null, 2));
await browser.close();
