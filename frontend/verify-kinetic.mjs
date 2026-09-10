/** Acceptance checks for the Kinetic Studio surface. The legacy workshop remains available at ?legacy=1. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const frontend = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.PLEGA_QA_URL || "http://127.0.0.1:4903/";
const output = path.resolve(
  process.env.PLEGA_QA_OUTPUT || path.join(frontend, "../build/browser-qa"),
);
await fs.mkdir(path.join(output, "screenshots"), { recursive: true });
const checks = [];
const run = async (name, action) => {
  try {
    await action();
    checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, passed: false, error: String(error) });
    console.error(`FAIL ${name}: ${error}`);
    throw error;
  }
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(String(error)));
page.on("console", (message) => {
  // Chromium may probe an optional favicon.ico after the declared SVG icon; this is not an app runtime failure.
  if (
    message.type() === "error" &&
    !message.text().includes("404 (Not Found)")
  ) {
    runtimeErrors.push(message.text());
  }
});
await page.goto(url, { waitUntil: "networkidle" });

await run("Kinetic Studio loads", async () => {
  await page.getByRole("heading", { name: "Make the fold move." }).waitFor();
  assert.equal(await page.locator(".kinetic-workbench").count(), 1);
  assert.equal(await page.locator(".paper-canvas-editor").count(), 1);
});
await run("Composition has a real cast", async () => {
  assert.ok((await page.locator(".kinetic-cast button").count()) >= 6);
  assert.ok((await page.getByText("MOTION MAP").count()) === 1);
  await page.getByRole("button", { name: "Add a new voice" }).click();
  assert.ok((await page.locator(".kinetic-motif-menu button").count()) >= 6);
  await page.getByRole("button", { name: "Add a new voice" }).click();
});
await run("Parts drive the inspector", async () => {
  const before = await page.locator(".kinetic-inspector h2").innerText();
  await page.locator(".kinetic-cast button").nth(1).click();
  const after = await page.locator(".kinetic-inspector h2").innerText();
  assert.notEqual(after, before);
  await page.getByRole("button", { name: "Lattice" }).click();
});
await run("Motion is continuous and inspectable", async () => {
  const scrub = page.getByRole("slider", { name: "Opening angle" });
  await scrub.fill("12");
  assert.match(await page.locator(".kinetic-scrub-copy").innerText(), /12/);
  await page.getByRole("button", { name: "Play motion" }).click();
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: "Pause motion" }).click();
});
await run("Cut plan is connected to the same project", async () => {
  await page.getByRole("button", { name: "Cut plan", exact: true }).click();
  await page.locator(".print-page").waitFor();
  assert.ok((await page.locator("svg.print-page").count()) >= 1);
  await page.getByRole("button", { name: "Live object", exact: true }).click();
});
await run("Responsive phone surface", async () => {
  await page.screenshot({
    path: path.join(output, "screenshots/kinetic-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Make the fold move." }).waitFor();
  await page.screenshot({
    path: path.join(output, "screenshots/kinetic-phone.png"),
    fullPage: true,
  });
});
await context.close();
await browser.close();
assert.deepEqual(
  runtimeErrors,
  [],
  `runtime errors: ${runtimeErrors.join("; ")}`,
);
await fs.writeFile(
  path.join(output, "kinetic-report.json"),
  JSON.stringify({ url, checks, runtime_errors: runtimeErrors }, null, 2),
);
console.log(`Wrote ${path.join(output, "kinetic-report.json")}`);
