/** Built-workshop acceptance. Uses only original fixtures and synthetic private notes. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { chromium, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const frontend = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.PLEGA_QA_URL || "http://127.0.0.1:4903/CAOS_Plega/";
const output = path.resolve(
  process.env.PLEGA_QA_OUTPUT || path.join(frontend, "../build/browser-qa"),
);
const origin = new URL(url).origin;
const started = new Date().toISOString();
const catalog = JSON.parse(
  await fs.readFile(
    path.join(frontend, "../data/artifacts/projects.json"),
    "utf8",
  ),
);
await fs.mkdir(path.join(output, "screenshots"), { recursive: true });
await fs.mkdir(path.join(output, "downloads"), { recursive: true });
const report = {
  started_utc: started,
  url,
  checks: [],
  screenshots: [],
  downloads: [],
  runtime_errors: [],
  console_errors: [],
  foreign_requests: [],
  policy_violations: [],
  limitations: [],
};
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
let browser;
let activePage;
let activeContext;
let offlineIdentityPending = false;

async function capture(page, name) {
  const relative = `screenshots/${slug(name)}.png`;
  await page.screenshot({
    path: path.join(output, relative),
    fullPage: true,
    animations: "disabled",
    timeout: 20000,
  });
  report.screenshots.push({
    name,
    path: relative,
    viewport: page.viewportSize(),
  });
}
async function group(name, action) {
  const begin = Date.now();
  report.active_group = name;
  try {
    const detail = await action();
    report.checks.push({
      name,
      passed: true,
      duration_ms: Date.now() - begin,
      ...(detail || {}),
    });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({
      name,
      passed: false,
      duration_ms: Date.now() - begin,
      error: String(error?.stack || error),
    });
    console.error(`FAIL ${name}: ${error.message}`);
    if (activePage && !activePage.isClosed()) {
      try {
        await capture(activePage, "failure-" + name);
      } catch {
        /* Preserve the original failure. */
      }
    }
  } finally {
    if (activeContext) {
      try {
        await close(activePage, activeContext);
      } catch {
        await activeContext.close().catch(() => {});
        activeContext = undefined;
      }
    }
    if (browser?.isConnected()) await browser.close();
    await fs.writeFile(
      path.join(output, "report-progress.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
}
async function pageFor(options = {}) {
  if (!browser?.isConnected())
    browser = await chromium.launch({
      headless: true,
      args: ["--enable-unsafe-swiftshader"],
    });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    ...options,
  });
  await context.addInitScript(() => {
    window.__plegaPolicyViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.__plegaPolicyViolations.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      }),
    );
  });
  const page = await context.newPage();
  activeContext = context;
  activePage = page;
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => report.runtime_errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      report.console_errors.push({
        text: message.text(),
        url: message.location().url,
        expected_offline_identity:
          offlineIdentityPending &&
          message.location().url === new URL("release.json", url).href,
      });
  });
  page.on("request", (request) => {
    const address = new URL(request.url());
    if (
      ["http:", "https:"].includes(address.protocol) &&
      address.origin !== origin
    )
      report.foreign_requests.push({
        origin: address.origin,
        type: request.resourceType(),
      });
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await expect(
    page.getByRole("textbox", { name: "Project title", exact: true }),
  ).toBeVisible();
  return { page, context };
}
async function close(page, context) {
  report.policy_violations.push(
    ...(await page.evaluate(() => window.__plegaPolicyViolations || [])),
  );
  await context.close();
  if (activeContext === context) activeContext = undefined;
}
async function stage(page, name) {
  const button = page
    .locator(".workflow button")
    .filter({ hasText: new RegExp(`\\b${name}\\b`) });
  await button.click();
  await expect(button).toHaveAttribute("aria-current", "step");
}
async function saved(page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const value = JSON.parse(
          localStorage.getItem("plega-workspace-v1") || "null",
        );
        return value?.project?.title;
      }),
    )
    .toBe(
      await page
        .getByRole("textbox", { name: "Project title", exact: true })
        .inputValue(),
    );
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("plega-workspace-v1")),
  );
}
async function openStarter(page, name) {
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  const card = page
    .locator(".starter-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page.locator(".library-dialog")).not.toBeVisible();
}
async function download(page, name, action) {
  const pending = page.waitForEvent("download", { timeout: 45000 });
  await action();
  const item = await pending;
  assert.equal(await item.failure(), null);
  const suggested = item.suggestedFilename();
  assert(!/[\\/]/.test(suggested), "Download filename must be flat.");
  const relative = `downloads/${slug(name)}-${suggested}`;
  await item.saveAs(path.join(output, relative));
  const bytes = await fs.readFile(path.join(output, relative));
  assert(bytes.length > 50, "A download must contain real content.");
  report.downloads.push({
    name,
    path: relative,
    bytes: bytes.length,
    sha256: hash(bytes),
  });
  return bytes;
}
function zipFiles(bytes) {
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const flags = bytes.readUInt16LE(offset + 6);
    assert.equal(
      flags & 9,
      0,
      "No encryption or descriptor streaming expected.",
    );
    const method = bytes.readUInt16LE(offset + 8);
    const compressed = bytes.readUInt32LE(offset + 18);
    const size = bytes.readUInt32LE(offset + 22);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extra = bytes.readUInt16LE(offset + 28);
    const name = bytes
      .subarray(offset + 30, offset + 30 + nameLength)
      .toString("utf8");
    assert(
      !files.has(name) && !/[\\/]/.test(name) && name !== "..",
      "ZIP entries must be unique and flat.",
    );
    const start = offset + 30 + nameLength + extra;
    assert(start + compressed <= bytes.length);
    const content =
      method === 0
        ? bytes.subarray(start, start + compressed)
        : method === 8
          ? inflateRawSync(bytes.subarray(start, start + compressed))
          : null;
    assert(
      content && content.length === size,
      "ZIP payload must match its declared length.",
    );
    files.set(name, content);
    offset = start + compressed;
  }
  assert.equal(
    bytes.readUInt32LE(offset),
    0x02014b50,
    "A central directory must follow ZIP content.",
  );
  assert(files.size > 0);
  return files;
}
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({
    width: innerWidth,
    body: document.documentElement.scrollWidth,
  }));
  assert(
    sizes.body <= sizes.width + 2,
    `Horizontal overflow: ${JSON.stringify(sizes)}`,
  );
}

try {
  browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  await group("Design controls and keyboard motion", async () => {
    const { page, context } = await pageFor();
    await expect(
      page.locator(".paper-viewer canvas, .viewer canvas, canvas").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play motion", exact: true }),
    ).toBeEnabled();
    await page.locator("#opening").focus();
    await page.locator("#opening").press("Home");
    await expect(page.locator("#opening")).toHaveValue("0");
    await page.locator("#opening").press("End");
    await expect(page.locator("#opening")).toHaveValue("180");
    await page
      .getByRole("button", { name: "Play motion", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause motion", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Pause motion", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Project title", exact: true })
      .fill("QA editable original");
    await saved(page);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Project title", exact: true }),
    ).not.toHaveValue("QA editable original");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Project title", exact: true }),
    ).toHaveValue("QA editable original");
    await noOverflow(page);
    await capture(page, "desktop-design");
    await close(page, context);
  });

  await group("Six original starters and supported checks", async () => {
    const { page, context } = await pageFor();
    assert.equal(catalog.starters.length, 6);
    for (const starter of catalog.starters) {
      await openStarter(page, starter.title.en);
      await expect(
        page.getByRole("textbox", { name: "Project title", exact: true }),
      ).toHaveValue(starter.project.title);
      await stage(page, "Check");
      await expect(page.locator(".check-verdict")).toContainText(
        "Supported geometry passes",
      );
      await capture(page, "starter-" + starter.id);
    }
    await close(page, context);
    return { starters: catalog.starters.map((item) => item.id) };
  });

  await group(
    "Two invalid cases and explicit repair preview apply undo",
    async () => {
      const { page, context } = await pageFor();
      assert.equal(catalog.repairCases.length, 2);
      for (const item of catalog.repairCases) {
        await openStarter(page, item.title.en);
        await stage(page, "Check");
        await expect(page.locator(".check-verdict")).toContainText(
          "Review these constraints",
        );
        const before = (await saved(page)).project;
        await expect(
          page.locator(".repair-options button").first(),
        ).toBeVisible();
        await page.locator(".repair-options button").first().click();
        await expect(
          page.getByRole("button", { name: "Apply this repair", exact: true }),
        ).toBeVisible();
        assert.deepEqual(
          (await saved(page)).project,
          before,
          "Preview must not mutate the saved project.",
        );
        await capture(page, "repair-preview-" + item.id);
        await page
          .getByRole("button", { name: "Apply this repair", exact: true })
          .click();
        await expect
          .poll(async () => JSON.stringify((await saved(page)).project))
          .not.toBe(JSON.stringify(before));
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        await expect
          .poll(async () => JSON.stringify((await saved(page)).project))
          .toBe(JSON.stringify(before));
      }
      await close(page, context);
    },
  );

  await group(
    "PDF SVG FOLD downloads and actual paper dimensions",
    async () => {
      const { page, context } = await pageFor();
      await openStarter(
        page,
        catalog.starters.find((item) => item.id.includes("sampler"))?.title
          .en || catalog.starters[0].title.en,
      );
      await stage(page, "Make");
      await expect(
        page.getByRole("button", {
          name: "Download complete PDF",
          exact: true,
        }),
      ).toBeEnabled();
      await capture(page, "make-a4");
      for (const [paper, width, height] of [
        ["A4", 210, 297],
        ["Letter", 215.9, 279.4],
      ]) {
        await page
          .getByLabel("Printer paper", { exact: true })
          .selectOption(paper);
        const bytes = await download(page, `pdf-${paper}`, () =>
          page
            .getByRole("button", { name: "Download complete PDF", exact: true })
            .click(),
        );
        assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
        const pdf = await PDFDocument.load(bytes);
        assert(
          pdf.getPageCount() >= 3,
          "Complete booklet contains overview, instructions and patterns.",
        );
        for (const sheet of pdf.getPages()) {
          assert(Math.abs(sheet.getWidth() - (width * 72) / 25.4) < 0.01);
          assert(Math.abs(sheet.getHeight() - (height * 72) / 25.4) < 0.01);
        }
      }
      const svg = zipFiles(
        await download(page, "svg", () =>
          page
            .getByRole("button", {
              name: "SVG sheets Ãƒâ€šÃ‚Â· ZIP",
              exact: true,
            })
            .click(),
        ),
      );
      const sheets = [...svg].filter(([name]) => name.endsWith(".svg"));
      assert(sheets.length > 0);
      for (const [, bytes] of sheets) {
        const text = bytes.toString("utf8");
        assert(
          /<svg\b/.test(text) &&
            /width="[\d.]+mm"/.test(text) &&
            /height="[\d.]+mm"/.test(text),
        );
        assert(!/<script\b|\son\w+=|(?:href|src)="https?:/i.test(text));
      }
      const fold = zipFiles(
        await download(page, "fold", () =>
          page
            .getByRole("button", {
              name: "FOLD flat frames Ãƒâ€šÃ‚Â· ZIP",
              exact: true,
            })
            .click(),
        ),
      );
      const graphs = [...fold].filter(([name]) => name.endsWith(".fold"));
      assert(graphs.length > 0);
      for (const [, bytes] of graphs) {
        const graph = JSON.parse(bytes.toString("utf8"));
        assert.equal(graph.frame_unit, "mm");
        assert(
          graph.vertices_coords.length > 0 && graph.edges_vertices.length > 0,
        );
        assert.equal(
          graph.edges_assignment.length,
          graph.edges_vertices.length,
        );
      }
      await close(page, context);
      return {
        svg_sheets: sheets.length,
        fold_graphs: graphs.length,
        calibration:
          "A4/Letter PDF page dimensions independently parsed; physical printer calibration untested.",
      };
    },
  );

  await group(
    "Assembly observations local recovery and share privacy",
    async () => {
      const { page, context } = await pageFor();
      await stage(page, "Assemble");
      const note = "QA_SYNTHETIC_PRIVATE_OBSERVATION";
      await page
        .getByLabel("Your build observations", { exact: true })
        .fill(note);
      await page.getByLabel("I completed this step", { exact: true }).check();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem("plega-workspace-v1") || "null")
                ?.notes,
          ),
        )
        .toBe(note);
      const previous = await saved(page);
      assert(previous.completed.length > 0);
      const portable = JSON.parse(
        (
          await download(page, "workspace", () =>
            page
              .getByRole("button", { name: "Save project", exact: true })
              .click(),
          )
        ).toString("utf8"),
      );
      assert.equal(portable.notes, note);
      assert.deepEqual(portable.completed, previous.completed);
      await capture(page, "assemble-observations");
      await page.getByRole("button", { name: "Share", exact: true }).click();
      const shared = new URL(
        await page.getByLabel("Design link", { exact: true }).inputValue(),
      );
      const design = JSON.parse(
        decodeURIComponent(shared.hash.slice("#project=".length)),
      );
      assert(
        !JSON.stringify(design).includes(note) &&
          !Object.hasOwn(design, "notes") &&
          !Object.hasOwn(design, "completed"),
      );
      assert.deepEqual(design, previous.project);
      await page
        .getByRole("dialog", { name: "Share the design", exact: true })
        .getByRole("button", { name: "Close / Cerrar", exact: true })
        .click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await stage(page, "Assemble");
      await expect(
        page.getByLabel("Your build observations", { exact: true }),
      ).toHaveValue(note);
      await expect(
        page.getByLabel("I completed this step", { exact: true }),
      ).toBeChecked();
      const second = await context.newPage();
      await second.goto(url, { waitUntil: "domcontentloaded" });
      await expect
        .poll(() =>
          second.evaluate(
            () =>
              JSON.parse(localStorage.getItem("plega-workspace-v1") || "null")
                ?.notes,
          ),
        )
        .toBe(note);
      await second.close();
      await close(page, context);
      return {
        recovery: "Reload and second tab in the same browser profile",
        sharing:
          "Only project geometry/title; synthetic notes and assembly progress excluded",
      };
    },
  );

  await group("Invalid imports preserve current workspace", async () => {
    const { page, context } = await pageFor();
    const before = await saved(page);
    for (const bytes of [
      Buffer.from('{"invalid":true}'),
      Buffer.from("{broken"),
      Buffer.alloc(131073, 65),
    ]) {
      await page.locator('input[type="file"]').setInputFiles({
        name: "invalid.plega.json",
        mimeType: "application/json",
        buffer: bytes,
      });
      await expect(page.getByRole("status")).toContainText(
        "current project is unchanged",
      );
      assert.deepEqual(await saved(page), before);
    }
    await capture(page, "invalid-import-preserved");
    await close(page, context);
  });

  await group(
    "English Spanish light dark and guide keyboard close",
    async () => {
      const { page, context } = await pageFor();
      await page
        .getByRole("button", { name: "Workshop guide", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", {
          name: "The paper workshop guide",
          exact: true,
        }),
      ).toBeVisible();
      await capture(page, "guide-en-light");
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Workshop guide", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Switch to dark theme", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await capture(page, "desktop-en-dark");
      await page
        .getByRole("button", { name: "Cambiar a espaÃƒÆ’Ã‚Â±ol", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      await stage(page, "Comprobar");
      await expect(page.locator(".check-verdict")).toContainText(
        "GeometrÃƒÆ’Ã‚Â­a admitida correcta",
      );
      await capture(page, "desktop-es-dark");
      await page
        .getByRole("button", { name: "Activar tema claro", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await capture(page, "desktop-es-light");
      await close(page, context);
    },
  );

  await group(
    "Phone touch four workflow stages and reduced motion",
    async () => {
      const { page, context } = await pageFor({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      for (const name of ["Design", "Check", "Make", "Assemble"]) {
        await stage(page, name);
        await noOverflow(page);
        await capture(page, "phone-" + name);
      }
      await stage(page, "Design");
      await expect(
        page.getByRole("button", { name: "Play motion", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Projects", exact: true }).tap();
      await expect(page.locator(".starter-card")).toHaveCount(8);
      await capture(page, "phone-project-library");
      await page.keyboard.press("Escape");
      await close(page, context);
      return {
        viewport: "390x844",
        input: "Chromium emulated touch; no physical device certification",
      };
    },
  );

  await group("Production identity and offline cache lifecycle", async () => {
    const { page, context } = await pageFor();
    const response = await context.request.get(
      new URL("release.json", url).href,
    );
    let metadata = null;
    try {
      metadata = await response.json();
    } catch {
      /* Vite dev returns the application entry. */
    }
    if (metadata?.product !== "PLEGA") {
      assert(
        new URL(url).port === "5903",
        "Only the explicit development server may omit staged identity/offline testing.",
      );
      report.limitations.push(
        "Development run: exact staged identity, CSP and offline worker are verified only in the production artifact gate.",
      );
      await close(page, context);
      return {
        skipped: true,
        reason: "Explicit Vite development server; no production worker",
      };
    }
    assert(metadata.files["sw.js"] && /^[a-f0-9]{40}$/.test(metadata.revision));
    report.release = {
      revision: metadata.revision,
      source_clean: metadata.source_clean,
      release_id: metadata.release_id,
      artifact_tree_sha256: metadata.artifact_tree_sha256,
    };
    await page.evaluate(() => caches.open("unrelated-project-qa-sentinel"));
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);
    const keys = await page.evaluate(() => caches.keys());
    assert(
      keys.includes("unrelated-project-qa-sentinel") &&
        keys.some((key) => key.startsWith("plega-")),
    );
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("textbox", { name: "Project title", exact: true }),
    ).toBeVisible();
    await stage(page, "Make");
    const offlinePdf = await download(page, "offline-pdf", () =>
      page
        .getByRole("button", { name: "Download complete PDF", exact: true })
        .click(),
    );
    assert.equal(offlinePdf.subarray(0, 5).toString(), "%PDF-");
    offlineIdentityPending = true;
    const liveIdentityAvailable = await page.evaluate(async () => {
      try {
        await fetch(new URL("release.json", location.href), {
          cache: "no-store",
        });
        return true;
      } catch {
        return false;
      }
    });
    offlineIdentityPending = false;
    assert.equal(
      liveIdentityAvailable,
      false,
      "Offline release identity must not be supplied from cache.",
    );
    await capture(page, "offline-printable-workshop");
    await context.setOffline(false);
    await close(page, context);
    return {
      offline_pdf: true,
      unrelated_cache_preserved: true,
      identity_network_only: true,
      update:
        "Waiting/explicit activation additionally exercised by isolated generated-worker regression",
    };
  });

  await group("Runtime errors foreign origins and CSP violations", async () => {
    assert.deepEqual(report.runtime_errors, []);
    assert.deepEqual(report.foreign_requests, []);
    assert.deepEqual(report.policy_violations, []);
    // A deliberately offline release request fails by contract; its browser network error is expected.
    const unexpected = report.console_errors.filter(
      (line) =>
        !(
          line.expected_offline_identity &&
          (line.text.includes("net::ERR_INTERNET_DISCONNECTED") ||
            line.text.includes("net::ERR_FAILED"))
        ),
    );
    assert.deepEqual(unexpected, []);
    return {
      expected_offline_network_errors:
        report.console_errors.length - unexpected.length,
    };
  });
} catch (error) {
  report.checks.push({
    name: "Harness startup",
    passed: false,
    error: String(error?.stack || error),
  });
} finally {
  if (browser) await browser.close();
  report.finished_utc = new Date().toISOString();
  report.passed =
    report.checks.length > 0 && report.checks.every((check) => check.passed);
  report.summary = {
    groups: report.checks.length,
    passed: report.checks.filter((item) => item.passed).length,
    failed: report.checks.filter((item) => !item.passed).length,
    skipped: report.checks.filter((item) => item.skipped).length,
  };
  await fs.writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ ...report.summary, output, passed: report.passed }),
  );
  if (!report.passed) process.exitCode = 1;
}
