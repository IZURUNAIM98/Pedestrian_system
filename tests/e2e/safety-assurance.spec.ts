import { expect, test } from "@playwright/test";
import { loadLocalAuthEnvironment } from "../load-local-auth-env";

loadLocalAuthEnvironment();

test("login has a secure native POST fallback and never places credentials in the URL", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3100", javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/access");
  const form = page.locator("form.access-form");
  await expect(form).toHaveAttribute("method", "post");
  await expect(form).toHaveAttribute("action", "/api/login");
  await page.getByLabel("Operator ID").fill(process.env.DEMO_ACCESS_ID ?? "");
  await page.getByLabel("Password").fill(process.env.DEMO_ACCESS_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  expect(page.url()).not.toContain(process.env.DEMO_ACCESS_ID ?? "credential");
  expect(page.url()).not.toContain(process.env.DEMO_ACCESS_PASSWORD ?? "credential");
  await context.close();
});

test("shows one authoritative conflict-free decision for the selected crossing", async ({ page }) => {
  await page.goto("/access");
  await page.getByLabel("Operator ID").fill(process.env.DEMO_ACCESS_ID ?? "");
  await page.getByLabel("Password").fill(process.env.DEMO_ACCESS_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("authoritative-decision")).toContainText("PEDESTRIAN_SERVICE");
  await expect(page.getByTestId("authoritative-decision")).toContainText("One phase clock: walk");
  await expect(page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')).toHaveCount(0);
});
