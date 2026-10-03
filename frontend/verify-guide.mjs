/** Browser acceptance of the complete animated library and recovery paths. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
const base = process.env.PLEGA_QA_URL || "http://127.0.0.1:5905/";
const output = path.resolve(
  process.env.PLEGA_QA_OUTPUT || "../build/browser-qa/guide",
);
const manifest = JSON.parse(
  await fs.readFile(
    new URL("./src/guide/lesson-manifest.json", import.meta.url),
    "utf8",
  ),
);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const seek = async (page, value) =>
  page.getByRole("slider", { name: "Step progress" }).evaluate((input, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
const open = async (page, id) => {
  await page.goto(new URL(`?model=${id}`, base).href, {
    waitUntil: "domcontentloaded",
  });
  await page.locator(".fold-viewport canvas").waitFor();
  await page.locator(".plega-step-list button").first().waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
};
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  serviceWorkers: "block",
});
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base);
await page.getByRole("heading", { name: "Origami library." }).waitFor();
assert.equal(await page.locator(".plega-model-card").count(), manifest.length);
assert.equal(await page.locator(".fold-viewport canvas").count(), 0);
await page.getByRole("searchbox").fill("tulip");
assert.equal(await page.locator(".plega-model-card").count(), 2);
await page.getByRole("searchbox").fill("not-a-model");
await page.getByText("No models match this search.").waitFor();
await page.getByRole("button", { name: "Clear filters" }).click();
await page.getByRole("button", { name: "Plants 3", exact: true }).click();
assert.equal(await page.locator(".plega-model-card").count(), 3);
await page.getByRole("button", { name: /All models/ }).click();
await page.screenshot({
  path: path.join(output, "library-desktop.png"),
  fullPage: true,
});
for (const model of manifest) {
  await open(page, model.id);
  assert.equal(
    await page.locator(".plega-step-list button").count(),
    model.steps,
  );
  const initial = await page.locator(".fold-viewport canvas").screenshot();
  const lesson = await (
    await page.request.get(new URL(model.url, base).href)
  ).json();
  for (let i = 0; i < model.steps; i++) {
    await page.locator(".plega-step-list button").nth(i).click();
    await seek(page, 0.5);
    await page.waitForTimeout(25);
    assert.equal(await page.locator(".plega-illustration svg").count(), 2);
    assert.ok(await page.locator(".plega-step-detail p").innerText());
    await seek(page, 1);
  }
  await page.locator(".plega-viewer-wrap").scrollIntoViewIfNeeded();
  const finished = await page.locator(".fold-viewport canvas").screenshot();
  assert.notDeepEqual(
    finished,
    initial,
    `${model.id} must transform from the square`,
  );
  await page.screenshot({
    path: path.join(output, `${model.id}-finished.png`),
  });
  const motion = lesson.instructions.steps.findIndex(
    (s) => s.kind !== "hold" && s.runs.length,
  );
  if (motion >= 0) {
    await page.locator(".plega-step-list button").nth(motion).click();
    await seek(page, 0.5);
    await page
      .locator(".fold-viewport canvas")
      .screenshot({ path: path.join(output, `${model.id}-motion.png`) });
  }
  console.log("Checked all steps:", model.id, model.steps);
}
await open(page, "heart");
await page.locator(".plega-step-list button").nth(2).click();
const title = await page.locator(".plega-step-list button.active").innerText();
await page.getByRole("button", { name: "Play this step" }).click();
await page.waitForTimeout(2300);
assert.equal(
  await page.locator(".plega-step-list button.active").innerText(),
  title,
  "single-step play stops at its own end",
);
await page.getByLabel("Playback speed").selectOption("2");
await page.getByRole("button", { name: "Play from start to finish" }).click();
await page
  .locator(".plega-step-list button")
  .last()
  .and(page.locator(".active"))
  .waitFor({ timeout: 100000 });
await page.getByRole("button", { name: "EN", exact: true }).click();
await page.getByRole("heading", { name: /Modelo terminado/ }).waitFor();
await page.getByRole("button", { name: "Cambiar tema de color" }).click();
assert.equal(
  await page.locator(".plega-origami-app").getAttribute("data-theme"),
  "dark",
);
await page.screenshot({ path: path.join(output, "heart-spanish-dark.png") });
await page.getByRole("button", { name: "ES", exact: true }).click();
await page.getByRole("button", { name: "Fold basics" }).click();
await page.getByRole("button", { name: /Open envelope/ }).click();
await page.getByRole("heading", { name: "Left flap" }).waitFor();
await page.goto(new URL("?model=guided%3Aopen-envelope", base).href);
await page.getByRole("heading", { name: "Left flap" }).waitFor();
await page.goto(
  new URL(
    "?model=diagram%3A%2Fguide%2Fcommons%2Forigami-paper-popper-type4.png",
    base,
  ).href,
);
await page.getByRole("heading", { name: "Origami library." }).waitFor();
assert.equal(await page.locator(".guide-diagram-scroll").count(), 0);
await page.goto(new URL("?model=missing", base).href);
await page.getByText("This model is not in the animated library.").waitFor();
await page.getByRole("button", { name: "Back to library" }).click();
await page.route("**/lessons/heart/heart.fold.json", (route) =>
  route.fulfill({
    status: 200,
    body: '{"tampered":true}',
    contentType: "application/json",
  }),
);
await page.goto(new URL("?model=heart", base).href);
await page.getByRole("alert").waitFor();
await page.getByRole("button", { name: "Back to library" }).click();
await page.unroute("**/lessons/heart/heart.fold.json");
await page.close();
for (const size of [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
]) {
  const p = await browser.newPage({ viewport: size });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(base);
  await p.locator(".plega-model-card").last().scrollIntoViewIfNeeded();
  assert.ok(await p.evaluate(() => scrollY > 0));
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    size.width,
  );
  await p
    .locator(".plega-model-card")
    .filter({ hasText: "Paper crane" })
    .click();
  await p.locator(".fold-viewport canvas").waitFor();
  await p.locator(".plega-step-list button").last().scrollIntoViewIfNeeded();
  await p.locator(".plega-step-list button").last().click();
  await p.getByRole("heading", { name: "Check the completed crane" }).waitFor();
  await p.locator(".plega-viewer-wrap").scrollIntoViewIfNeeded();
  await p.screenshot({ path: path.join(output, `${size.width}-crane.png`) });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    size.width,
  );
  await p.close();
}
const old = await browser.newPage();
await old.goto(new URL("?sections=1", base).href);
await old.locator(".origami-atlas-page").waitFor();
await old.close();
await browser.close();
assert.deepEqual(errors, []);
console.log("Animated library browser checks passed");
