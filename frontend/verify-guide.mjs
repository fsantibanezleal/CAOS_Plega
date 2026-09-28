/** Browser acceptance for the public, rights-aware folding guide. */
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
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".guide-app").waitFor();
  if (viewport.width > 500)
    await page.getByRole("heading", { name: "Library." }).waitFor();
  const total = await page.locator(".guide-total strong").textContent();
  assert.ok(
    Number(total.replaceAll(",", "")) > 2000,
    "catalog should contain the audited source links",
  );
  assert.equal(await page.locator(".guide-paper-svg").count(), 1);
  const before = await page
    .locator(".guide-paper-svg polygon")
    .last()
    .getAttribute("points");
  await page.getByRole("button", { name: "Play fold" }).click();
  await page.waitForTimeout(500);
  const after = await page
    .locator(".guide-paper-svg polygon")
    .last()
    .getAttribute("points");
  assert.notEqual(after, before, "paper geometry should animate");
  await page.waitForTimeout(750);
  await page.getByRole("button", { name: "Next fold" }).click();
  await page.getByRole("heading", { name: "Second corner" }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    viewport.width,
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollHeight),
    viewport.height,
  );
  await page.screenshot({
    path: path.join(output, `${viewport.width}-guide.png`),
  });
  if (viewport.width > 500) {
    await page
      .getByRole("combobox", { name: "Plan format" })
      .selectOption("diagram");
    await page.locator(".guide-list-item").first().click();
    await page.getByRole("link", { name: "Download diagram" }).waitFor();
    await page.getByRole("button", { name: "Zoom in" }).click();
    assert.ok(
      Number(
        (await page.locator(".guide-zoom output").textContent()).replace(
          "%",
          "",
        ),
      ) > 100,
    );
    await page.screenshot({ path: path.join(output, "licensed-diagram.png") });
    await page.goto(
      new URL("?model=tavin%3A%2Fguide%2Ftavin%2F846.png", base).href,
    );
    await page.getByRole("heading", { name: "Crane" }).first().waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "Download diagram" })
        .getAttribute("href"),
      "/guide/tavin/846.pdf",
    );
    const pdf = await page.request.get(
      new URL("guide/tavin/846.pdf", base).href,
    );
    assert.equal(pdf.status(), 200);
    assert.equal((await pdf.body()).subarray(0, 4).toString(), "%PDF");
    await page.screenshot({ path: path.join(output, "tavin-crane.png") });
    await page
      .getByRole("combobox", { name: "Plan format" })
      .selectOption("external");
    await page.locator(".guide-list-item").first().click();
    await page
      .getByRole("link", { name: /Open at source/ })
      .first()
      .waitFor();
    assert.equal(
      await page.locator(".guide-paper-svg").count(),
      0,
      "external plans must not claim an on-site animation",
    );
    await page
      .getByRole("combobox", { name: "Plan source" })
      .selectOption("Paper Kawaii");
    assert.match(
      await page.locator(".guide-result-count").textContent(),
      /^400 results$/,
    );
    await page.locator(".guide-list-item").first().click();
    assert.match(
      await page.locator(".guide-instructions").textContent(),
      /Paper Kawaii/,
    );
  } else {
    await page
      .getByRole("button", { name: /Library/ })
      .first()
      .click();
    await page
      .getByRole("combobox", { name: "Plan format" })
      .selectOption("diagram");
    await page.locator(".guide-list-item").first().click();
    assert.equal(await page.locator(".guide-library.open").count(), 0);
    await page.screenshot({ path: path.join(output, "390-diagram.png") });
  }
  await page.close();
}
const old = await browser.newPage();
await old.goto(base + "?sections=1", { waitUntil: "networkidle" });
assert.equal(
  await old.locator(".origami-atlas-page").count(),
  1,
  "previous sections atlas remains reachable",
);
await old.close();
await browser.close();
assert.deepEqual(errors, []);
console.log("Guide browser acceptance passed");
