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
  await page
    .locator('.paper-viewer[data-rendered="true"] .paper-canvas-editor')
    .waitFor({ timeout: 30000 });
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
await run("Every part can be framed from the live navigator", async () => {
  const count = await page.locator(".kinetic-cast button").count();
  for (let index = 0; index < count; index++) {
    await page.locator(".kinetic-cast button").nth(index).click();
    assert.equal(
      await page.locator(".paper-viewer").getAttribute("data-framing"),
      "selected",
    );
    assert.ok(
      Number(
        await page
          .locator(".paper-viewer")
          .getAttribute("data-camera-distance"),
      ) > 0,
    );
    assert.equal(
      (await page.locator(".paper-edit-handle[style*='visible']").count()) > 0,
      true,
    );
  }
  assert.equal(await page.locator(".kinetic-lane-track button").count(), count);
  await page.getByRole("button", { name: "All parts", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".paper-viewer")?.dataset.framing ===
      "composition",
  );
  assert.equal(
    await page.locator(".paper-viewer").getAttribute("data-framing"),
    "composition",
  );
});
await run("A direct 3D handle changes physical geometry", async () => {
  await page.locator(".kinetic-cast button").first().click();
  const handle = page.locator('.paper-edit-handle[data-field="a"]');
  await handle.waitFor({ state: "visible", timeout: 30000 });
  const before = Number(await handle.getAttribute("data-value"));
  let after = before;
  for (let attempt = 0; attempt < 2 && after <= before; attempt++) {
    await handle.waitFor({ state: "visible", timeout: 30000 });
    const box = await handle.boundingBox();
    const axis = await handle.evaluate((element) => ({
      x: Number(element.dataset.axisX),
      y: Number(element.dataset.axisY),
    }));
    const length = Math.hypot(axis.x, axis.y);
    assert.ok(box && length > 0);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(
      x + (axis.x / length) * 20,
      y + (axis.y / length) * 20,
      { steps: 8 },
    );
    await page.mouse.up();
    after = Number(await handle.getAttribute("data-value"));
  }
  assert.ok(
    after > before,
    `canvas drag did not change rise: ${before} -> ${after}`,
  );
  assert.equal(await page.locator(".kinetic-check.pass").count(), 1);
});
await run("Surface and card controls change the live project", async () => {
  const density = page.getByRole("slider", { name: "Aperture density" });
  await density.fill("5");
  assert.equal(await density.inputValue(), "5");
  const web = page.getByRole("slider", { name: "Protected paper web" });
  await web.fill("2.4");
  assert.equal(await web.inputValue(), "2.4");
  const cardHeight = page.getByRole("spinbutton", {
    name: "Height",
    exact: true,
  });
  const before = Number(await cardHeight.inputValue());
  await cardHeight.fill(String(before + 5));
  assert.equal(Number(await cardHeight.inputValue()), before + 5);
  await page.getByRole("button", { name: "Undo" }).click();
  assert.equal(Number(await cardHeight.inputValue()), before);
});
await run("Working compositions are loadable and reversible", async () => {
  await page.locator(".kinetic-gallery-launch").click();
  assert.equal(await page.locator(".kinetic-library-grid button").count(), 12);
  await page.screenshot({
    path: path.join(output, "screenshots/kinetic-signature-gallery.png"),
  });
  await page.getByRole("button", { name: "All 24" }).click();
  assert.equal(await page.locator(".kinetic-library-grid button").count(), 24);
  await page.screenshot({
    path: path.join(output, "screenshots/kinetic-gallery.png"),
  });
  await page.getByRole("button", { name: /Equinox garden/ }).click();
  assert.equal(await page.locator(".kinetic-cast button").count(), 12);
  assert.equal(await page.locator(".kinetic-check.pass").count(), 1);
  await page.screenshot({
    path: path.join(output, "screenshots/kinetic-equinox.png"),
  });
  await page.getByRole("slider", { name: "Opening angle" }).fill("145");
  await page.screenshot({
    path: path.join(output, "screenshots/kinetic-equinox-open.png"),
  });
  await page.getByRole("button", { name: "Cut plan", exact: true }).click();
  await page.getByRole("button", { name: "Next sheet" }).click();
  await page.locator("svg.print-page").waitFor();
  await page.getByRole("button", { name: "Live object", exact: true }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  assert.ok((await page.locator(".kinetic-cast button").count()) >= 6);
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
  await page
    .locator('.paper-viewer[data-rendered="true"]')
    .waitFor({ timeout: 30000 });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(width <= 390, `horizontal overflow: ${width}`);
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
