/** Browser acceptance for the animation-first origami experience. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.env.PLEGA_QA_URL || "http://127.0.0.1:5903/";
const output = path.resolve(
  process.env.PLEGA_QA_OUTPUT || "../build/browser-qa/guide",
);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Origami library." }).waitFor();
  await page
    .locator(".fold-spinner")
    .waitFor({ state: "hidden", timeout: 20000 });
  assert.equal(await page.locator(".plega-model-card").count(), 1);
  assert.equal(await page.locator(".plega-model-card canvas").count(), 0);
  assert.equal(await page.locator(".plega-step-list button").count(), 44);
  assert.equal(await page.locator(".fold-viewport canvas").count(), 1);
  assert.equal(await page.locator(".guide-diagram-scroll").count(), 0);
  const initialImage = await page.locator(".fold-viewport canvas").screenshot();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollHeight > innerHeight,
    ),
    "the full lesson must scroll in the page",
  );
  const response = await page.request.get(
    new URL("lessons/crane/crane.fold.json", base).href,
  );
  assert.equal(response.status(), 200);
  const lesson = await response.json();
  assert.equal(lesson.status, "resolved");
  assert.equal(lesson.instructions.steps.length, 44);
  assert.equal(lesson.geometry.operations.length, 40);
  await page.getByRole("button", { name: "Play from start to finish" }).click();
  await page
    .locator(".plega-step-list button.active")
    .filter({ hasText: "Make the first diagonal" })
    .waitFor({ timeout: 15000 });
  await page.locator(".plega-step-list button").last().scrollIntoViewIfNeeded();
  assert.ok(
    await page.evaluate(() => scrollY > 0),
    "the last step must be reachable with page scroll",
  );
  await page.locator(".plega-step-list button").last().click();
  await page
    .getByRole("heading", { name: "Check the completed crane" })
    .waitFor();
  await page.waitForTimeout(900);
  const finishedImage = await page
    .locator(".fold-viewport canvas")
    .screenshot();
  assert.notDeepEqual(
    finishedImage,
    initialImage,
    "the completed model must differ from the starting square",
  );
  await page.locator(".plega-viewer-wrap").scrollIntoViewIfNeeded();
  assert.ok(
    await page
      .getByRole("button", { name: "Play from start to finish" })
      .isVisible(),
  );
  await page.screenshot({
    path: path.join(output, `${viewport.width}-crane.png`),
  });
  if (viewport.width > 500) {
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page
      .getByRole("heading", { name: "Biblioteca de origami." })
      .waitFor();
    await page.getByRole("button", { name: "ES", exact: true }).click();
    await page.getByRole("button", { name: "Fold basics" }).click();
    await page.getByRole("heading", { name: "Fold basics." }).waitFor();
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: /Open envelope/ }).click();
    await page.getByRole("heading", { name: "Left flap" }).waitFor();
    assert.equal(await page.locator(".plega-basic-paper svg").count(), 1);
    await page.goto(new URL("?model=guided%3Aopen-envelope", base).href, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("heading", { name: "Left flap" }).waitFor();
    await page.goto(
      new URL(
        "?model=diagram%3A%2Fguide%2Fcommons%2Forigami-paper-popper-type4.png",
        base,
      ).href,
      { waitUntil: "domcontentloaded" },
    );
    await page.getByRole("heading", { name: "Origami library." }).waitFor();
    assert.equal(await page.locator(".guide-diagram-scroll").count(), 0);
  } else {
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      viewport.width,
    );
  }
  await page.close();
}
const old = await browser.newPage();
await old.goto(base + "?sections=1", { waitUntil: "domcontentloaded" });
await old.locator(".origami-atlas-page").waitFor();
await old.close();
await browser.close();
assert.deepEqual(errors, []);
console.log("Origami experience browser acceptance passed");
