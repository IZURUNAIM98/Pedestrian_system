import { expect, test } from "@playwright/test";
import { loadLocalAuthEnvironment } from "../load-local-auth-env";

loadLocalAuthEnvironment();

const VIOLATION_PROFILES = [
  ["failure-to-stop-or-give-way", "conflict"],
  ["crossing-zone-speeding", "speed"],
  ["red-signal-violation", "red-light"],
  ["stopped-or-parked-on-crossing", "crossing-blocked"],
  ["accessible-route-blocked", "accessible-blocked"],
  ["motorcycle-filtering-at-crossing", "filtering"],
  ["motorcycle-in-pedestrian-area", "pedestrian-intrusion"],
  ["overtook-yielding-vehicle", "overtaking"],
  ["driving-wrong-direction", "wrong-way"],
  ["opposing-lane-queue-bypass", "queue-bypass"],
  ["unsafe-lane-change-near-crossing", "lane-change"],
  ["possible-distracted-driving", "possible-distraction"],
  ["tailgating-near-stop-line", "tailgating"],
  ["aggressive-acceleration-or-braking", "hard-braking"],
  ["unsafe-u-turn-near-crossing", "u-turn"],
  ["failed-to-yield-vulnerable-pedestrian", "vulnerable-user"],
  ["exceeded-school-zone-speed-limit", "school-speed"],
  ["parking-obstructed-sight-distance", "sight-obstruction"],
  ["collision-road-user-infrastructure", "collision"],
  ["vehicle-fire-smoke-explosion", "fire"],
] as const;

async function login(page: import("@playwright/test").Page) {
  const id = process.env.DEMO_ACCESS_ID;
  const password = process.env.DEMO_ACCESS_PASSWORD;
  if (!id || !password) throw new Error("Demonstration credentials are not configured for browser verification.");
  await page.goto("/access");
  await page.getByLabel("Operator ID").fill(id);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/smartcross-2-2");
  await expect(page).toHaveURL(/\/smartcross-2-2$/);
}

async function expectCleanEnglishCopy(page: import("@playwright/test").Page) {
  const copy = await page.locator("body").innerText();
  expect(copy).not.toMatch(/[\u00c2\u00c3\u00e2\ufffd]/u);
  expect(copy).not.toMatch(/\b(?:sequetial|unnecssary|englisg|vehiclke|simualte|asscociated)\b/i);
  expect(copy).not.toMatch(/\b(?:Vehicle|Motorcycle|STOP LINE) [AB]\s*[:\u0028\u0029\u00b7\u2190\u2192\u2013\u2014]/u);
}

test("requires authorised access for the SmartCross dashboard and simulation API", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/access$/);
  await expect(page.getByRole("heading", { name: "Sign in to the simulator" })).toBeVisible();

  const anonymousResponse = await page.request.post("/api/simulate", {
    data: { mode: "normal", scenarioId: "normal-no-violation" },
  });
  expect(anonymousResponse.status()).toBe(401);

  await login(page);
  await expect(page.locator(".brand-copy strong")).toHaveText("SmartCross");
  await expect(page.locator(".supervised-label")).toHaveText("Authorised demonstration. Supervised simulation.");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  const authorisedResponse = await page.request.post("/api/simulate", {
    data: { mode: "normal", scenarioId: "normal-no-violation" },
  });
  expect(authorisedResponse.ok()).toBe(true);
});

test("uses clear English copy across every page section", async ({ page }) => {
  await login(page);
  await expect(page).toHaveTitle("SmartCross");
  await expect(page.locator(".brand-copy strong")).toHaveText("SmartCross");
  await expect(page.locator(".brand-copy")).not.toContainText("Lintas AI");

  await expect(page.getByRole("button", { name: "Accessibility", exact: true })).toHaveCount(0);
  for (const section of ["SIMPSON workflow", "Simulator", "Technology", "Scenarios", "Incidents", "Reports"]) {
    await page.getByRole("button", { name: section, exact: true }).click();
    await expectCleanEnglishCopy(page);
  }
});

test("serves UTF-8 content and readable layouts at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const rootResponse = await page.goto("/");
  expect(rootResponse?.headers()["content-type"]).toBe("text/html; charset=utf-8");
  await login(page);
  expect((await page.locator("meta[charset]").getAttribute("charset"))?.toLowerCase()).toBe("utf-8");
  await expectCleanEnglishCopy(page);
  await expect(page.getByRole("button", { name: "Accessibility", exact: true })).toHaveCount(0);
  for (const section of ["SIMPSON workflow", "Simulator", "Technology", "Scenarios", "Incidents", "Reports"]) {
    await page.getByRole("button", { name: section, exact: true }).click();
    await expectCleanEnglishCopy(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), section).toBe(false);
  }

  const simulationResponse = await page.request.post("/api/simulate", {
    data: { mode: "normal", scenarioId: "normal-no-violation" },
  });
  expect(simulationResponse.ok()).toBe(true);
  expect(simulationResponse.headers()["content-type"]).toBe("application/json; charset=utf-8");
  const responseCopy = await simulationResponse.text();
  expect(responseCopy).not.toContain("\uFFFD");
});

test("runs the complete seven-stage school baseline", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await login(page);
  await expect(page.getByRole("note")).toContainText("Local deterministic mock data only");
  await page.getByRole("button", { name: "School" }).click();
  await page.getByLabel(/Crossing condition/).selectOption("school-no-violation");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.getByLabel("School courtyard beside the street")).toBeVisible();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "6", { timeout: 20_000 });
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Vehicle signal GO. Pedestrian signal WAIT/);
  await expect(page.getByRole("heading", { name: "Seven-stage simulation sequence" })).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(7);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("timeline is keyboard operable without narrow-screen overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  const first = page.getByRole("tab", { name: /Approach/ });
  await expect(first).toHaveAttribute("aria-selected", "true");
  await first.focus();
  await first.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Initiation/ })).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: `tmp/motion-redesign-narrow-${testInfo.project.name}.png`, fullPage: true });
});

test("critical incidents require local human confirmation", async ({ page }) => {
  await login(page);
  await page.getByLabel(/Crossing condition/).selectOption("normal-collision-road-user-infrastructure");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 8_000 });
  await page.getByRole("button", { name: "incidents" }).click();
  await expect(page.getByText("No responder has been contacted.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm for local record" }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
});

test("applies adverse operating conditions and keeps ANPR stage-gated", async ({ page }, testInfo) => {
  await login(page);
  await expect(page.getByText("No violation totals to display.")).toBeVisible();
  await expect(page.getByText("ANPR remains inactive because no violation is present")).toBeVisible();
  await expect(page.getByRole("img", { name: "Simulated rainwater ponding in the roadway with reduced vehicle traction" })).toHaveCount(0);
  await page.getByLabel("Weather condition").selectOption("rain");
  await page.getByLabel("Lighting condition").selectOption("night");
  await page.getByLabel("Visibility condition").selectOption("dense-haze");
  await expect(page.getByRole("combobox", { name: "Drainage condition" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Sensor health" })).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Derived sensor health: Degraded. Combined input quality: 60 percent." })).toBeVisible();
  await page.getByLabel(/Crossing condition/).selectOption("normal-crossing-zone-speeding");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-weather", "rain");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-lighting", "night");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-visibility", "dense-haze");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-sensor-health", "degraded");
  await expect(page.locator(".crossing-view")).not.toHaveAttribute("data-drainage", /.+/);
  await expect(page.locator(".phase-panel")).toHaveAttribute("data-confidence-band", "non-usable");
  await expect(page.getByText("SYSTEM DEGRADED", { exact: true })).toBeVisible();
  await expect(page.getByText("Withhold WALK and do not conclude that a violation occurred.")).toBeVisible();
  await expect(page.locator(".rain-overlay")).toBeVisible();
  await expect(page.locator(".night-overlay")).toBeVisible();
  await expect(page.getByRole("img", { name: "Simulated dense haze visibility" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Simulated rainwater ponding in the roadway with reduced vehicle traction" })).toBeVisible();
  await expect(page.getByText("Sensor health: Degraded")).toBeVisible();
  await expect(page.getByText("ANPR remains armed but inactive until this violation reaches the Detected stage.")).toBeVisible();
  await expect(page.getByText("CAMERA DEGRADED - PRESS BUTTON TO REQUEST CROSSING")).toBeVisible();
  await page.getByRole("button", { name: "Press pedestrian request button" }).click();
  await expect(page.locator(".scene-plate-capture")).toHaveCount(0);
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "2", { timeout: 6_000 });
  await expect(page.locator(".scene-plate-capture")).toBeVisible();
  await expect(page.getByLabel("Violation evidence captured").getByText("Detected", { exact: true })).toBeVisible();
  await expect(page.getByText("Unconfirmed possible condition: 02. Crossing-zone speeding")).toBeVisible();
  await expect(page.getByText("Total violations").locator("..").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByText("Unconfirmed low-confidence events").locator("..").getByText("1", { exact: true })).toBeVisible();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 8_000 });
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-fallback-controller", "fixed-timing");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-motion-profile", "no-violation");
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Vehicle signal STOP. Pedestrian signal WALK/);
  await expect(page.locator(".person-top")).toHaveAttribute("data-motion-state", "WALKING");
  await expect(page.getByText("AI input bypassed. Button-initiated fixed traffic control is active.")).toBeVisible();
  const statusOverlaps = await page.locator(".road-scene").evaluate((scene) => {
    const selectors = [".cctv-camera", ".scene-plate-capture", ".sensor-health-status", ".violation-marker"];
    const boxes = selectors.map((selector) => scene.querySelector(selector)?.getBoundingClientRect()).filter(Boolean) as DOMRect[];
    return boxes.some((box, index) => boxes.slice(index + 1).some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top));
  });
  expect(statusOverlaps).toBe(false);
  await page.screenshot({ path: `tmp/adverse-conditions-${testInfo.project.name}.png`, fullPage: true });
});

test("keeps a wheelchair user held while the accessible route remains blocked", async ({ page }, testInfo) => {
  await login(page);
  await page.getByLabel(/Crossing condition/).selectOption("normal-accessible-route-blocked");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "2", { timeout: 8_000 });
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-effect", "accessible-blocked");
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Vehicle signal STOP. Pedestrian signal WAIT/);
  await expect(page.getByRole("img", { name: /Wheelchair user: hold/ })).toBeVisible();
  await expect(page.locator(".vehicle-a .vehicle-stop-indicator")).toHaveText("STOP");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-route-clear", "false");
  await page.screenshot({ path: `tmp/motion-redesign-accessible-${testInfo.project.name}.png`, fullPage: true });
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "6", { timeout: 10_000 });
  await expect(page.getByRole("img", { name: /Wheelchair user: hold/ })).toBeVisible();
  await expect(page.locator(".vehicle-a")).toHaveAttribute("data-motion-state", "BLOCKING");
});

test("shows fire, smoke, exclusion zone and frozen STOP/HOLD state", async ({ page }, testInfo) => {
  await login(page);
  for (const mode of ["normal", "school"] as const) {
    await page.getByRole("button", { name: mode === "normal" ? "Normal" : "School" }).click();
    await page.getByLabel(/Crossing condition/).selectOption(`${mode}-vehicle-fire-smoke-explosion`);
    await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
    await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 8_000 });
    await expect(page.getByRole("img", { name: /Vehicle A.*fire/ })).toBeVisible();
    await expect(page.locator(".vehicle-fire-icon")).toContainText("FIRE / SMOKE");
    await expect(page.locator(".hazard-zone")).toContainText("LOCAL MOCK EXCLUSION ZONE");
    await expect(page.locator(".critical-incident-banner")).toContainText("CRITICAL INCIDENT");
    await expect(page.locator(".critical-incident-banner")).toHaveAttribute("data-alarm-pattern", "three-short-tones");
    await expect(page.locator(".vehicle-stop-indicator")).toHaveCount(2);

    const signageIsSeparated = await page.locator(".vehicle-a").evaluate((vehicle) => {
      const fire = vehicle.querySelector(".vehicle-fire-icon")?.getBoundingClientRect();
      const stop = vehicle.querySelector(".vehicle-stop-indicator")?.getBoundingClientRect();
      const body = vehicle.querySelector(".vehicle-body")?.getBoundingClientRect();
      if (!fire || !stop || !body) return false;
      const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return !overlaps(fire, stop) && !overlaps(fire, body) && !overlaps(stop, body);
    });
    expect(signageIsSeparated, `${mode} fire signage should not overlap`).toBe(true);

    await expect(page.getByRole("button", { name: "Reset simulation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset required before replay" })).toBeDisabled();
    await page.screenshot({ path: `tmp/motion-redesign-critical-${mode}-${testInfo.project.name}.png`, fullPage: true });
    await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "6", { timeout: 10_000 });
    await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Vehicle signal STOP. Pedestrian signal WAIT. Controller Critical alarm/);
    await page.getByRole("button", { name: "Reset simulation" }).click();
  }
});

test("shows the school-zone boundary only in the School violation 17 scene", async ({ page }, testInfo) => {
  await login(page);
  await expect(page.getByLabel(/Crossing condition/).locator("option")).toHaveCount(20);
  await expect(page.getByLabel(/Crossing condition/).locator('option[value="normal-exceeded-school-zone-speed-limit"]')).toHaveCount(0);
  await expect(page.locator(".school-zone-boundary")).toHaveCount(0);

  await page.getByRole("button", { name: "School" }).click();
  await expect(page.getByLabel(/Crossing condition/).locator("option")).toHaveCount(21);
  await page.getByLabel(/Crossing condition/).selectOption("school-exceeded-school-zone-speed-limit");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "1");
  const speedProfile = page.getByRole("group", { name: "School-zone speed profile" });
  await expect(speedProfile).toContainText("Simulation school-zone threshold: 30 km/h");
  await expect(page.getByTestId("school-zone-configured-limit")).toHaveText("30 km/h");
  await expect(page.getByTestId("school-zone-detection-speed")).toHaveText("42 km/h");
  await expect(page.getByTestId("school-zone-peak-speed")).toHaveText("50 km/h");
  await expect(page.getByTestId("school-zone-current-speed")).toHaveText("50 km/h");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "2", { timeout: 3_000 });
  await expect(page.getByTestId("school-zone-current-speed")).toHaveText("42 km/h");
  await page.screenshot({ path: `tmp/violation-17-school-only-${testInfo.project.name}.png`, fullPage: true });
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 4_000 });
  await expect(page.getByTestId("school-zone-current-speed")).toHaveText("0 km/h");
  await expect(page.getByText("Detected speed: 0 km/h", { exact: true })).toHaveCount(0);
});

test("stages violation 19 traffic-light collision before the alarm and impact circle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The collision ordering and geometry run once in desktop Chromium.");
  await login(page);
  for (const mode of ["normal", "school"] as const) {
    await page.getByRole("button", { name: mode === "normal" ? "Normal" : "School" }).click();
    await page.getByLabel(/Crossing condition/).selectOption(`${mode}-collision-road-user-infrastructure`);
    await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
    await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "2", { timeout: 5_000 });
    await expect(page.locator(".vehicle-a")).toHaveAttribute("data-motion-state", "TURNING");
    await expect(page.locator(".person-top")).toHaveAttribute("data-motion-state", "HOLD");
    await expect(page.locator(".infrastructure-collision-path")).toBeVisible();
    await page.screenshot({ path: `tmp/violation-19-path-${mode}-${testInfo.project.name}.png`, fullPage: true });
    await expect(page.locator(".impact-marker")).toHaveCount(0);
    await expect(page.locator(".critical-incident-banner")).toHaveCount(0);

    await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "3", { timeout: 3_000 });
    await expect(page.locator(".vehicle-a")).toHaveAttribute("data-motion-state", "COLLISION");
    await expect(page.locator(".person-top")).toHaveAttribute("data-motion-state", "HOLD");
    const vehicleHitsTrafficLight = await page.evaluate(() => {
      const vehicle = document.querySelector(".vehicle-a")?.getBoundingClientRect();
      const trafficLight = document.querySelector(".traffic-light-right .traffic-light-housing")?.getBoundingClientRect();
      if (!vehicle || !trafficLight) return false;
      return vehicle.left < trafficLight.right && vehicle.right > trafficLight.left && vehicle.top < trafficLight.bottom && vehicle.bottom > trafficLight.top;
    });
    expect(vehicleHitsTrafficLight, mode).toBe(true);
    await expect(page.locator(".impact-marker")).toHaveCount(0);
    await expect(page.locator(".critical-incident-banner")).toHaveCount(0);

    await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 3_000 });
    await expect(page.getByLabel("Simulated traffic-light pole collision point")).toBeVisible();
    await expect(page.locator(".traffic-light-right .impact-marker")).toHaveCount(1);
    await expect(page.locator(".critical-incident-banner")).toHaveCount(1);
    await page.screenshot({ path: `tmp/violation-19-${mode}-${testInfo.project.name}.png`, fullPage: true });
    await page.reload();
  }
});

test("keeps symmetrical 40 metre monitoring, paired signals and foreground pedestrian", async ({ page }) => {
  await login(page);
  await expect(page.locator(".engineering-zone")).toHaveCount(4);
  await expect(page.locator('.zone-speed[data-range-meters="40"]')).toHaveCount(2);
  await expect(page.locator('.zone-speed[data-direction="eastbound"] b')).toHaveText("EASTBOUND SPEED DETECTION - 40 m");
  await expect(page.locator('.zone-speed[data-direction="westbound"] b')).toHaveText("WESTBOUND SPEED DETECTION - 40 m");
  await expect(page.getByRole("img", { name: /CCTV EB-01/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /CCTV WB-01/ })).toBeVisible();
  await expect(page.locator(".traffic-light")).toHaveCount(2);
  await expect(page.locator(".motion-vehicle")).toHaveCount(2);
  await expect(page.locator(".vehicle-start-marker")).toHaveCount(0);
  const hasStartMarkerStyleRule = await page.evaluate(() => Array.from(document.styleSheets).some((styleSheet) => (
    Array.from(styleSheet.cssRules).some((rule) => rule.cssText.includes(".vehicle-start-marker"))
  )));
  expect(hasStartMarkerStyleRule).toBe(false);
  await expect(page.locator(".vehicle-a")).toHaveAttribute("style", /left:\s*8%/);
  await expect(page.locator(".vehicle-b")).toHaveAttribute("style", /left:\s*92%/);
  await expect(page.locator(".vehicle-a")).toHaveAttribute("data-distance-to-centre", "42");
  await expect(page.locator(".vehicle-b")).toHaveAttribute("data-distance-to-centre", "42");
  await expect(page.locator(".vehicle-a")).toHaveAttribute("data-monitoring-state", "start-buffer");
  await expect(page.locator(".vehicle-b")).toHaveAttribute("data-monitoring-state", "start-buffer");
  await page.getByRole("button", { name: "School" }).click();
  await expect(page.locator(".vehicle-start-marker")).toHaveCount(0);
  await expect(page.locator(".vehicle-a")).toHaveAttribute("style", /left:\s*8%/);
  await expect(page.locator(".vehicle-b")).toHaveAttribute("style", /left:\s*92%/);
  await page.locator("#scenario-select").selectOption("school-failure-to-stop-or-give-way");
  await expect(page.locator(".vehicle-start-marker")).toHaveCount(0);
  await expect(page.locator(".pedestrian-timer")).toHaveCount(2);
  await expect(page.locator(".zone-conflict b")).toHaveText("Conflict zone");
  const geometry = await page.evaluate(() => {
    const pedestrian = document.querySelector(".person-top");
    const zebra = document.querySelector(".zebra");
    const eastbound = document.querySelector(".zone-speed-eastbound")?.getBoundingClientRect();
    const westbound = document.querySelector(".zone-speed-westbound")?.getBoundingClientRect();
    if (!pedestrian || !zebra || !eastbound || !westbound) return { foreground: false, mirroredZones: false };
    return {
      foreground: Number.parseInt(getComputedStyle(pedestrian).zIndex, 10) > Number.parseInt(getComputedStyle(zebra).zIndex, 10),
      mirroredZones: Math.abs(eastbound.width - westbound.width) < 2 && Math.abs(eastbound.height - westbound.height) < 2,
    };
  });
  expect(geometry).toEqual({ foreground: true, mirroredZones: true });
  const sceneBox = await page.locator(".crossing-view").boundingBox();
  const commandBox = await page.locator(".simulation-command-bar").boundingBox();
  expect(sceneBox).not.toBeNull();
  expect(commandBox).not.toBeNull();
  expect(commandBox!.y).toBeGreaterThanOrEqual(sceneBox!.y + sceneBox!.height - 2);
  await expect(page.getByRole("button", { name: "Run seven-stage simulation" })).toBeVisible();
});

test("uses one pedestrian for Normal mode and a compact student group for School mode", async ({ page }, testInfo) => {
  await login(page);

  const normalIcon = page.locator(".pedestrian-icon > svg");
  await expect(normalIcon).toHaveCount(1);
  const normalBox = await normalIcon.boundingBox();
  const normalWaitingBox = await page.locator(".pedestrian-icon").boundingBox();
  const normalZebraBox = await page.locator(".zebra").boundingBox();
  expect(normalWaitingBox).not.toBeNull();
  expect(normalZebraBox).not.toBeNull();
  expect(normalWaitingBox!.y + normalWaitingBox!.height).toBeLessThanOrEqual(normalZebraBox!.y - 4);
  await expect(page.locator(".student-group")).toHaveCount(0);

  await page.getByRole("button", { name: "School" }).click();
  const studentGroup = page.getByRole("img", { name: /Student group:/ });
  const studentIcons = studentGroup.locator(".student-icons svg");
  await expect(studentGroup).toBeVisible();
  await expect(studentGroup).toHaveAttribute("style", /top: 3%/);
  await expect(studentIcons).toHaveCount(7);
  const studentBox = await studentIcons.first().boundingBox();
  const waitingGroupBox = await studentGroup.boundingBox();
  const zebraBox = await page.locator(".zebra").boundingBox();
  expect(normalBox).not.toBeNull();
  expect(studentBox).not.toBeNull();
  expect(waitingGroupBox).not.toBeNull();
  expect(zebraBox).not.toBeNull();
  expect(studentBox!.width).toBeLessThan(normalBox!.width);
  expect(studentBox!.height).toBeLessThan(normalBox!.height);
  expect(waitingGroupBox!.y + waitingGroupBox!.height).toBeLessThanOrEqual(zebraBox!.y - 4);
  await page.screenshot({ path: `tmp/school-student-group-waiting-${testInfo.project.name}.png`, fullPage: true });
  const startTop = await studentGroup.evaluate((element) => (element as HTMLElement).style.top);
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 8_000 });
  expect(await studentGroup.evaluate((element) => getComputedStyle(element).transitionDuration)).toContain("6s");
  expect(await studentGroup.evaluate((element) => getComputedStyle(element).transitionTimingFunction)).toContain("linear");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "5", { timeout: 14_000 });
  await expect(studentGroup).toHaveAttribute("aria-label", /Student group: completed/);
  expect(await studentGroup.evaluate((element) => (element as HTMLElement).style.top)).not.toBe(startTop);
  await page.screenshot({ path: `tmp/school-student-group-${testInfo.project.name}.png`, fullPage: true });
});

test("does not let either crossing mode enter the zebra before WALK", async ({ page }) => {
  await login(page);

  for (const mode of ["normal", "school"] as const) {
    if (mode === "school") await page.getByRole("button", { name: "School" }).click();
    await page.getByLabel(/Crossing condition/).selectOption(`${mode}-motorcycle-in-pedestrian-area`);
    await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
    await page.waitForFunction(({ expectedTop }) => {
      const crossing = document.querySelector(".crossing-view");
      const pedestrian = document.querySelector<HTMLElement>(".pedestrian-icon");
      const zebra = document.querySelector<HTMLElement>(".zebra");
      if (!crossing || !pedestrian || !zebra || crossing.getAttribute("data-frame") !== "1") return false;
      const pedestrianBox = pedestrian.getBoundingClientRect();
      const zebraBox = zebra.getBoundingClientRect();
      return pedestrian.style.top.replace(" ", "") === expectedTop && pedestrianBox.bottom <= zebraBox.top - 4;
    }, { expectedTop: `${mode === "school" ? "3" : "7"}%` });
    await page.reload();
  }
});

test("uses uninterrupted linear pedestrian motion in Normal and School crossings", async ({ page }) => {
  await login(page);

  for (const mode of ["normal", "school"] as const) {
    if (mode === "school") await page.getByRole("button", { name: "School" }).click();
    await page.getByLabel(/Crossing condition/).selectOption(`${mode}-no-violation`);
    await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
    await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 8_000 });

    const pedestrian = page.locator(".person-top");
    await expect(pedestrian).toHaveAttribute("style", new RegExp(`top: ${mode === "school" ? "44.5" : "51"}%`));
    expect(await pedestrian.evaluate((element) => getComputedStyle(element).transitionDuration)).toContain("6s");
    expect(await pedestrian.evaluate((element) => getComputedStyle(element).transitionTimingFunction)).toContain("linear");

    await page.getByRole("button", { name: "Reset sequence" }).click();
  }
});

test("shows School violation 07 as a premature step that stops before the zebra", async ({ page }, testInfo) => {
  await login(page);
  await page.getByRole("button", { name: "School" }).click();
  await page.getByLabel(/Crossing condition/).selectOption("school-motorcycle-in-pedestrian-area");

  const studentGroup = page.getByRole("img", { name: /Student group:/ });
  await expect(studentGroup).toHaveAttribute("style", /top: 3%/);
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "1", { timeout: 4_000 });
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Pedestrian signal WAIT/);
  await expect(studentGroup).toHaveAttribute("data-motion-state", "PAUSED");
  await expect(studentGroup).toHaveAttribute("style", /top: 7\.15%/);
  await page.locator(".crossing-view").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);

  const prematureBox = await studentGroup.boundingBox();
  const zebraBox = await page.locator(".zebra").boundingBox();
  expect(prematureBox).not.toBeNull();
  expect(zebraBox).not.toBeNull();
  expect(prematureBox!.y + prematureBox!.height).toBeLessThanOrEqual(zebraBox!.y - 4);
  await page.screenshot({ path: `tmp/school-violation-07-premature-step-${testInfo.project.name}.png`, fullPage: true });
});

test("synchronises timeline detail and event log with the active motion stage", async ({ page }) => {
  await login(page);
  await page.getByLabel(/Crossing condition/).selectOption("normal-red-signal-violation");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "0");
  await expect(page.locator(".event-list li")).toHaveCount(1);
  await expect(page.getByRole("tab", { name: /Approach/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "2", { timeout: 5_000 });
  await expect(page.locator(".event-list li")).toHaveCount(3);
  await expect(page.getByRole("tab", { name: /Detected/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "6", { timeout: 10_000 });
  await expect(page.locator(".event-list li")).toHaveCount(7);
  await expect(page.getByRole("tab", { name: /Outcome/ })).toHaveAttribute("aria-selected", "true");
});

test("keeps traffic stopped until the pedestrian clears, then releases vehicles sequentially", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "2");
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Vehicle signal STOP. Pedestrian signal WAIT/);
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 8_000 });
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Vehicle signal STOP. Pedestrian signal WALK/);
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "5", { timeout: 8_000 });
  await expect(page.locator(".vehicle-a")).toHaveAttribute("data-motion-state", "YIELDING");
  await expect(page.locator(".vehicle-b")).toHaveAttribute("data-motion-state", "YIELDING");
  const vehiclesStopped = await page.evaluate(() => {
    const vehicleA = document.querySelector(".vehicle-a")?.getBoundingClientRect();
    const vehicleB = document.querySelector(".vehicle-b")?.getBoundingClientRect();
    const stopA = document.querySelector(".stop-line-left")?.getBoundingClientRect();
    const stopB = document.querySelector(".stop-line-right")?.getBoundingClientRect();
    return Boolean(vehicleA && vehicleB && stopA && stopB && vehicleA.right <= stopA.left + 8 && vehicleB.left >= stopB.right - 8);
  });
  expect(vehiclesStopped).toBe(true);
  await page.waitForTimeout(5_600);
  const pedestrianCleared = await page.evaluate(() => {
    const pedestrian = document.querySelector(".person-top")?.getBoundingClientRect();
    const zebra = document.querySelector(".zebra")?.getBoundingClientRect();
    return Boolean(pedestrian && zebra && pedestrian.top >= zebra.bottom - 8);
  });
  expect(pedestrianCleared).toBe(true);
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "6", { timeout: 8_000 });
  await expect(page.locator(".vehicle-a")).toHaveAttribute("data-motion-state", "CLEARED");
  await expect(page.locator(".vehicle-b")).toHaveAttribute("data-motion-state", "CLEARED");
});

test("paired pedestrian timers share a real one-second controller countdown", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 8_000 });
  const timers = page.locator(".pedestrian-timer b");
  await expect(timers).toHaveCount(2);
  const first = Number.parseInt(await timers.first().innerText(), 10);
  expect(Number.parseInt(await timers.nth(1).innerText(), 10)).toBe(first);
  await expect.poll(async () => Number.parseInt(await timers.first().innerText(), 10), { timeout: 1_500 }).toBe(first - 1);
  const sampledAt = Date.now();
  await page.waitForTimeout(1_100);
  const elapsed = Date.now() - sampledAt;
  expect(elapsed).toBeGreaterThanOrEqual(1_000);
  expect(elapsed).toBeLessThan(1_400);
  expect(Number.parseInt(await timers.first().innerText(), 10)).toBe(first - 2);
  expect(Number.parseInt(await timers.nth(1).innerText(), 10)).toBe(first - 2);
  expect(Number.parseInt(await page.getByTestId("controller-countdown").innerText(), 10)).toBe(first - 2);
});

test("clears the seven-action local violation event log", async ({ page }) => {
  await login(page);
  await page.getByLabel(/Crossing condition/).selectOption("normal-red-signal-violation");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "6", { timeout: 12_000 });
  await expect(page.locator(".event-list li")).toHaveCount(7);
  await page.getByRole("button", { name: "Clear log" }).click();
  await expect(page.getByText("No violation events recorded")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear log" })).toBeDisabled();
});

test("reset cancels playback, preserves history and allows deterministic replay", async ({ page }) => {
  await login(page);
  await page.getByLabel(/Crossing condition/).selectOption("normal-red-signal-violation");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "1");
  await page.getByRole("button", { name: "Reset sequence" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-running", "false");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "0");
  await expect(page.getByText("Ready: actors at their starting markers")).toBeVisible();
  await expect(page.locator(".event-list li")).toHaveCount(7);
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-motion-profile", "red-signal-violation");
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "1");
});

test("records serious notifications only in the local mock workflow", async ({ page }) => {
  await login(page);
  await page.getByLabel(/Crossing condition/).selectOption("normal-vehicle-fire-smoke-explosion");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  const workflow = page.locator(".mock-notification-card");
  await expect(workflow.getByRole("heading", { name: "Vehicle fire, smoke, or explosion" })).toBeVisible();
  await expect(workflow).toContainText("No external message can leave prototype mode.");
  await expect(workflow).toContainText("MPAJ traffic operations review desk");
  await expect(workflow).toContainText("Fire and Rescue Department liaison");
  await expect(workflow).toContainText("Emergency medical services liaison");
  await expect(workflow).not.toContainText("Royal Malaysia Police traffic liaison");
  await workflow.getByRole("button", { name: "Acknowledge mock alert" }).click();
  await workflow.getByRole("button", { name: "Resolve mock workflow" }).click();
  await expect(workflow.getByRole("button", { name: "Mock workflow resolved" })).toBeDisabled();
});

test("all 39 selectable violations render their assigned motion profile and move the first actor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Exhaustive motion matrix runs once in desktop Chromium; mobile has focused layout coverage.");
  test.setTimeout(180_000);
  await login(page);
  for (const mode of ["normal", "school"] as const) {
    for (const [slug, effect] of VIOLATION_PROFILES.filter(([profileSlug]) => mode === "school" || profileSlug !== "exceeded-school-zone-speed-limit")) {
      if (mode === "school") await page.getByRole("button", { name: "School" }).click();
      await page.getByLabel(/Crossing condition/).selectOption(`${mode}-${slug}`);
      await expect(page.locator(".vehicle-start-marker")).toHaveCount(0);
      const beforeA = await page.locator(".vehicle-a").boundingBox();
      const beforeB = await page.locator(".vehicle-b").boundingBox();
      await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
      await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "1");
      await expect(page.locator(".crossing-view")).toHaveAttribute("data-motion-profile", slug);
      await expect(page.locator(".crossing-view")).toHaveAttribute("data-effect", effect);
      const afterA = await page.locator(".vehicle-a").boundingBox();
      const afterB = await page.locator(".vehicle-b").boundingBox();
      const moved = Boolean(beforeA && afterA && (Math.abs(afterA.x - beforeA.x) > 8 || Math.abs(afterA.y - beforeA.y) > 8))
        || Boolean(beforeB && afterB && (Math.abs(afterB.x - beforeB.x) > 8 || Math.abs(afterB.y - beforeB.y) > 8));
      expect(moved).toBe(true);
      await page.reload();
    }
  }
});

test("holds both vehicles at a red stop line whenever a violation recovery releases WALK", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The complete Normal and School recovery matrix runs once in desktop Chromium.");
  test.setTimeout(120_000);
  await login(page);

  const recoverableProfiles = [
    "motorcycle-in-pedestrian-area",
    "failed-to-yield-vulnerable-pedestrian",
    "exceeded-school-zone-speed-limit",
    "parking-obstructed-sight-distance",
  ];

  for (const mode of ["normal", "school"] as const) {
    for (const slug of recoverableProfiles.filter((profileSlug) => mode === "school" || profileSlug !== "exceeded-school-zone-speed-limit")) {
      await page.getByRole("button", { name: mode === "normal" ? "Normal" : "School" }).click();
      await page.getByLabel(/Crossing condition/).selectOption(`${mode}-${slug}`);
      await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
      await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Pedestrian signal WALK/, { timeout: 10_000 });
      await expect(page.locator(".vehicle-start-marker")).toHaveCount(0);
      const expectedState = mode === "school" && slug === "motorcycle-in-pedestrian-area" ? "YIELDING" : "STOPPED";
      await expect(page.locator(".vehicle-a")).toHaveAttribute("data-motion-state", expectedState);
      await expect(page.locator(".vehicle-b")).toHaveAttribute("data-motion-state", expectedState);
      await expect(page.locator(".vehicle-a")).toHaveAttribute("data-speed", "0");
      await expect(page.locator(".vehicle-b")).toHaveAttribute("data-speed", "0");

      const stoppedAtLines = await page.evaluate(() => {
        const vehicleA = document.querySelector(".vehicle-a")?.getBoundingClientRect();
        const vehicleB = document.querySelector(".vehicle-b")?.getBoundingClientRect();
        const stopA = document.querySelector(".stop-line-left")?.getBoundingClientRect();
        const stopB = document.querySelector(".stop-line-right")?.getBoundingClientRect();
        if (!vehicleA || !vehicleB || !stopA || !stopB) return false;
        const aGap = vehicleA.right <= stopA.left + 8 ? stopA.left - vehicleA.right : vehicleA.left - stopB.right;
        const bGap = vehicleB.left - stopB.right;
        return aGap >= -8 && aGap <= 40 && bGap >= -8 && bGap <= 40;
      });
      expect(stoppedAtLines, `${mode}-${slug}`).toBe(true);
      await page.reload();
    }
  }
});

test("renders the refined overlays and WALK-gated pedestrian sequence", async ({ page }) => {
  await login(page);

  for (const slug of ["overtook-yielding-vehicle", "unsafe-lane-change-near-crossing"]) {
    await page.getByLabel(/Crossing condition/).selectOption(`normal-${slug}`);
    await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
    await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "1");
    await expect(page.locator(".tracked-path")).toHaveCSS("display", "none");
    await page.reload();
  }

  await page.getByLabel(/Crossing condition/).selectOption("normal-motorcycle-in-pedestrian-area");
  const startTop = await page.locator(".person-top").evaluate((element) => (element as HTMLElement).style.top);
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "3", { timeout: 8_000 });
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Pedestrian signal WAIT/);
  await expect(page.locator(".person-top")).toHaveAttribute("data-motion-state", "HOLD");
  expect(await page.locator(".person-top").evaluate((element) => (element as HTMLElement).style.top)).toBe(startTop);
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 4_000 });
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Pedestrian signal WALK/);
  expect(await page.locator(".person-top").evaluate((element) => getComputedStyle(element).transitionDuration)).toContain("6s");
  expect(await page.locator(".person-top").evaluate((element) => getComputedStyle(element).transitionTimingFunction)).toContain("linear");
  expect(await page.locator(".person-top").evaluate((element) => (element as HTMLElement).style.top)).not.toBe(startTop);
});

test("keeps the vehicle icon front-facing throughout both U-turn scenarios", async ({ page }, testInfo) => {
  await login(page);
  for (const mode of ["normal", "school"] as const) {
    await page.getByRole("button", { name: mode === "normal" ? "Normal" : "School" }).click();
    await page.getByLabel(/Crossing condition/).selectOption(`${mode}-unsafe-u-turn-near-crossing`);
    await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
    await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "1");
    await expect(page.locator(".tracked-path")).not.toHaveCSS("display", "none");
    expect(await page.locator(".vehicle-a").evaluate((element) => getComputedStyle(element).transitionDuration)).toContain("1.8s");
    expect(await page.locator(".vehicle-a").evaluate((element) => getComputedStyle(element).transitionTimingFunction)).toContain("linear");
    const initialIconTransform = await page.locator(".vehicle-a").evaluate((element) => getComputedStyle(element).transform);
    const initialBodyTransform = await page.locator(".vehicle-a .vehicle-body").evaluate((element) => getComputedStyle(element).transform);
    for (const frame of [2, 3, 4]) {
      await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", String(frame), { timeout: 3_000 });
      await expect(page.locator(".vehicle-a")).toHaveAttribute("style", /--vehicle-heading: 0deg/);
    }
    expect(await page.locator(".vehicle-a").evaluate((element) => getComputedStyle(element).transform)).toBe(initialIconTransform);
    expect(await page.locator(".vehicle-a .vehicle-body").evaluate((element) => getComputedStyle(element).transform)).toBe(initialBodyTransform);
    await page.screenshot({ path: `tmp/smartcross-2-2-u-turn-fixed-facing-${mode}-${testInfo.project.name}.png`, fullPage: true });
    await page.reload();
  }
});

test("reference technology and scenario views remain populated", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Technology" }).click();
  await expect(page.getByRole("heading", { name: "Crossing safety controller" })).toBeVisible();
  await page.getByRole("button", { name: "Scenarios" }).click();
  await expect(page.getByRole("heading", { name: "20 normal-crossing conditions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "21 school-crossing conditions" })).toBeVisible();
  await expect(page.locator(".condition-matrix").nth(0).locator("li")).toHaveCount(20);
  await expect(page.locator(".condition-matrix").nth(1).locator("li")).toHaveCount(21);
  await expect(page.locator(".condition-matrix").nth(0).locator("li").nth(1)).toHaveText("Failure to stop or give way");
  await expect(page.locator(".condition-matrix").nth(1).locator("li").nth(1)).toHaveText("Crossing-zone speeding");
  await expect(page.locator(".condition-matrix li").filter({ hasText: /^\d+\.\s/ })).toHaveCount(0);
});

test("captures synthetic CCTV plate evidence for Normal and School violations", async ({ page }) => {
  await login(page);
  for (const [mode, scenarioId] of [["Normal", "normal-red-signal-violation"], ["School", "school-crossing-zone-speeding"]] as const) {
    await page.getByRole("button", { name: mode }).click();
    await page.getByLabel(/Crossing condition/).selectOption(scenarioId);
    await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
    await expect(page.locator(".cctv-camera")).toHaveClass(/cctv-active/, { timeout: 8_000 });
    await expect(page.getByRole("heading", { name: "Violation evidence captured" })).toBeVisible();
    await expect(page.locator(".plate-number")).toHaveText(/^SCV2-[NS]\d{4}$/);
    await expect(page.getByText("No live camera, database lookup, enforcement, or personal identification.")).toBeVisible();
    await page.reload();
  }
});

test("shows SmartCross traceable evidence and current-session statistics without a map legend", async ({ page }, testInfo) => {
  await login(page);
  await expect(page.getByRole("region", { name: "Map legend" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Simulated violation counters" })).toBeVisible();
  await expect(page.getByText("No violations have been run in this local session.")).toBeVisible();
  await expect(page.locator(".safety-status-strip")).toHaveCount(0);
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Vehicle signal GO. Pedestrian signal WAIT/);

  await page.getByLabel(/Crossing condition/).selectOption("normal-red-signal-violation");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".cctv-camera")).toHaveClass(/cctv-active/, { timeout: 8_000 });
  await expect(page.locator(".crossing-view")).toHaveAttribute("aria-label", /Vehicle signal STOP/);
  await expect(page.getByText("SIMULATED EVIDENCE - HUMAN REVIEW REQUIRED")).toBeVisible();
  await expect(page.getByText("Vehicle direction", { exact: true })).toBeVisible();
  await expect(page.getByText("Detected condition", { exact: true })).toBeVisible();
  await expect(page.getByText("Recognition confidence", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Countermeasures for 03\. Red-signal violation/ })).toBeVisible();
  await page.screenshot({ path: `tmp/smartcross-2-2-evidence-${testInfo.project.name}.png`, fullPage: true });
});

test("does not expose the retired presentation mode", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("button", { name: "Presentation mode" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Presentation controls" })).toHaveCount(0);
  await expect(page.locator(".main-nav")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});

test("rejects incorrect credentials without revealing which field failed", async ({ page }) => {
  await page.goto("/access");
  await page.getByLabel("Operator ID").fill("UNKNOWN");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.locator(".login-error")).toHaveText("The ID or password is incorrect.");
  await expect(page).toHaveURL(/\/access$/);
});

test("logs out and protects the root route", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/access$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/access$/);
});

test("uses consistent English capitalisation for acronyms, actors, states and modes", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("button", { name: "SIMPSON workflow" })).toBeVisible();

  await page.getByRole("button", { name: "Technology" }).click();
  await expect(page.getByText("THREE-TIER IoT ARCHITECTURE", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Simulator" }).click();
  await expect(page.getByText("STOP LINE A", { exact: true })).toBeVisible();
  await expect(page.getByText("STOP LINE B", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Crossing condition/).locator("option")).toContainText([
    "04. Stopped or parked on the crossing",
    "06. Motorcycle filtering at the crossing",
    "19. Collision with a road user or infrastructure",
  ]);

  await page.getByLabel(/Crossing condition/).selectOption("normal-vehicle-fire-smoke-explosion");
  await page.getByRole("button", { name: "Run seven-stage simulation" }).click();
  await expect(page.locator(".crossing-view")).toHaveAttribute("data-frame", "4", { timeout: 8_000 });
  await expect(page.getByRole("img", { name: /Vehicle A is fire/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset simulation" })).toBeVisible();

  await page.getByRole("button", { name: "Reports" }).click();
  await expect(page.getByRole("cell", { name: "Normal", exact: true }).first()).toBeVisible();
});
