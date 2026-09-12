/** Browser acceptance for the public Plega Origami Atlas and its sectioned lab. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.env.PLEGA_QA_URL || "http://127.0.0.1:4903/";
const output = path.resolve(
  process.env.PLEGA_QA_OUTPUT ||
    path.join(
      fileURLToPath(new URL("..", import.meta.url)),
      "build/browser-qa",
    ),
  "origami",
);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("404 (Not Found)"))
    errors.push(message.text());
});
await page.goto(base, { waitUntil: "networkidle" });
await page
  .getByRole("heading", { name: "One sheet. Many ways to move." })
  .waitFor();
assert.equal(await page.locator(".origami-project-card").count(), 8);
assert.equal(await page.locator(".origami-family-bar button").count(), 6);
await page.screenshot({ path: path.join(output, "atlas.png"), fullPage: true });

await page.getByRole("button", { name: /Modular cube/ }).click();
await page
  .locator('.origami-canvas[data-rendered="true"]')
  .waitFor({ timeout: 30000 });
assert.equal(await page.locator(".origami-lab-page").count(), 1);
assert.ok(
  Number(await page.locator(".origami-canvas").getAttribute("data-facets")) >=
    12,
);
assert.equal(await page.locator(".origami-sections button").count(), 4);
const before = await page
  .locator(".origami-canvas")
  .getAttribute("data-progress");
await page.getByRole("slider", { name: "Fold progress" }).fill("88");
await page.waitForFunction(
  (value) =>
    document.querySelector(".origami-canvas")?.dataset.progress !== value,
  before,
);
assert.equal(
  await page.locator(".origami-canvas").getAttribute("data-mode"),
  "folded",
);
await page.getByRole("button", { name: "Separate layers" }).click();
assert.equal(
  await page.locator(".origami-canvas").getAttribute("data-mode"),
  "exploded",
);
await page.getByRole("button", { name: "Crease map" }).click();
assert.equal(
  await page.locator(".origami-canvas").getAttribute("data-mode"),
  "pattern",
);
await page.locator(".origami-sections button").nth(2).click();
assert.equal(
  await page.locator(".origami-canvas").getAttribute("data-selected"),
  "lid",
);
await page.screenshot({
  path: path.join(output, "lab-modular-cube.png"),
  fullPage: true,
});

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("heading", { name: /same flat pattern/i }).waitFor();
assert.ok(
  (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
);
await page.screenshot({
  path: path.join(output, "lab-phone.png"),
  fullPage: true,
});
await context.close();
await browser.close();
assert.deepEqual(errors, [], `runtime errors: ${errors.join("; ")}`);
console.log(`Origami browser QA passed; evidence in ${output}`);
