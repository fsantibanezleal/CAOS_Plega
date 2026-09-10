import assert from "node:assert/strict";
export async function verifyCanvasEdits(
  page,
  { touch = false, capture = async () => {} } = {},
) {
  const context = page.context();
  await page.locator('.paper-edit-handle[data-field="a"]').waitFor();
  const stored = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("plega-workspace-v1")).project,
    );
  const before = await stored();
  const rise = page.locator('.paper-edit-handle[data-field="a"]');
  await rise.focus();
  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(150);
  assert.deepEqual(
    await stored(),
    before,
    "keyboard preview must not persist before release",
  );
  assert.equal(
    Number(await rise.getAttribute("data-value")),
    before.modules[0].params.a + 2,
  );
  await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(150);
  assert.equal(
    (await stored()).modules[0].params.a,
    before.modules[0].params.a + 2,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(150);
  assert.deepEqual(
    await stored(),
    before,
    "one undo restores held keyboard edit",
  );
  const box = await rise.boundingBox(),
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 22, y - 30, { steps: 5 });
  await page.waitForTimeout(150);
  assert.deepEqual(
    await stored(),
    before,
    "drag preview must not persist before release",
  );
  const moved = Number(await rise.getAttribute("data-value"));
  assert.notEqual(moved, before.modules[0].params.a);
  await capture("direct-edit-preview");
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.notEqual(
    (await stored()).modules[0].params.a,
    before.modules[0].params.a,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(150);
  assert.deepEqual(await stored(), before, "one undo restores drag");
  const cancelBox = await rise.boundingBox(),
    cx = cancelBox.x + cancelBox.width / 2,
    cy = cancelBox.y + cancelBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 18, cy - 22, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.deepEqual(await stored(), before, "escape cancels drag");
  assert.equal(
    await page.locator(".paper-viewer").getAttribute("data-editing"),
    null,
  );
  const vpart = before.modules.find((m) => m.kind === "V");
  await page
    .locator(".parts-list")
    .getByRole("button", { name: new RegExp(vpart.label) })
    .click();
  const wing = page.locator('.paper-edit-handle[data-field="r"]');
  await wing.waitFor();
  const vr = vpart.params.r;
  await wing.press("ArrowDown");
  await page.waitForTimeout(150);
  assert.equal(
    (await stored()).modules.find((m) => m.id === vpart.id).params.r,
    vr - 1,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(100);
  if (touch) {
    const wb = await wing.boundingBox(),
      tx = wb.x + wb.width / 2,
      ty = wb.y + wb.height / 2;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: tx, y: ty, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: tx + 16, y: ty - 20, id: 1 }],
    });
    await page.waitForTimeout(180);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(180);
    assert.notEqual(
      (await stored()).modules.find((m) => m.id === vpart.id).params.r,
      vr,
      "touch drag changes actual parameter",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.waitForTimeout(100);
    assert.deepEqual(await stored(), before, "one undo restores touch edit");
  }
  await page
    .getByRole("combobox", { name: "Selected part profile", exact: true })
    .selectOption("lattice");
  await page.waitForTimeout(150);
  assert.equal(
    (await stored()).modules.find((m) => m.id === vpart.id).cutwork.pattern,
    "lattice",
  );
  const count = (await stored()).modules.length;
  await page.locator(".paper-canvas-add summary").click();
  await page
    .getByRole("button", { name: "Step structure", exact: true })
    .click();
  await page.waitForTimeout(150);
  assert.equal(
    (await stored()).modules.length,
    count + 1,
    "canvas add creates a real part",
  );
  await page
    .getByRole("button", { name: "Remove selected part", exact: true })
    .click();
  await page.waitForTimeout(150);
  assert.equal(
    (await stored()).modules.length,
    count,
    "canvas remove updates project",
  );
  const beforeV = (await stored()).modules.length;
  await page.locator(".paper-canvas-add summary").click();
  await page
    .getByRole("button", { name: "V-fold structure", exact: true })
    .click();
  await page.waitForTimeout(150);
  assert.equal(
    (await stored()).modules.length,
    beforeV + 1,
    "canvas Add V creates a real valid part",
  );
  assert.equal(
    await page.locator(".viewer-fallback").count(),
    0,
    "Add V must never blank the model",
  );
  assert.match(
    await page.locator(".status-chip").innerText(),
    /Geometry checked/,
  );
  await page
    .getByRole("button", { name: "Remove selected part", exact: true })
    .click();
  await page.waitForTimeout(150);
  const first = (await stored()).modules[0];
  await page
    .locator(".parts-list")
    .getByRole("button", { name: new RegExp(first.label) })
    .click();
  const baseline = await stored();
  const pin = page.getByRole("button", {
    name: "Pin Step height \u00b7 a",
    exact: true,
  });
  await pin.click();
  await page.waitForTimeout(100);
  const pinned = await stored();
  const h = page.locator('.paper-edit-handle[data-field="a"]');
  assert.equal(await h.getAttribute("aria-disabled"), "true");
  await h.press("ArrowUp");
  assert.deepEqual(
    await stored(),
    pinned,
    "pinned canvas parameter must remain unchanged",
  );
  assert.match(
    await page.locator(".paper-edit-feedback").innerText(),
    /pinned/,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(100);
  const hb = await h.boundingBox(),
    ax = Number(await h.getAttribute("data-axis-x")),
    ay = Number(await h.getAttribute("data-axis-y"));
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    hb.x + hb.width / 2 + ax * 1000,
    hb.y + hb.height / 2 + ay * 1000,
    { steps: 3 },
  );
  await page.waitForTimeout(150);
  assert.match(
    await page.locator(".paper-edit-feedback").innerText(),
    /safe fit limit/,
  );
  await capture("direct-edit-constrained");
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.equal(await page.locator(".viewer-fallback").count(), 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(100);
  assert.deepEqual(
    await stored(),
    baseline,
    "one Undo restores the entire constrained drag",
  );
  for (const theme of ["light", "dark"]) {
    const themeButton = page.getByRole("button", {
      name: theme === "dark" ? "Switch to dark theme" : "Switch to light theme",
      exact: true,
    });
    if (await themeButton.count()) await themeButton.click();
    await capture("direct-edit-" + theme);
  }
  const metrics = await page.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    doc: [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ],
    handles: [...document.querySelectorAll(".paper-edit-handle")].map((e) => ({
      field: e.dataset.field,
      rect: e.getBoundingClientRect().toJSON(),
    })),
  }));
  assert.deepEqual(metrics.doc, metrics.viewport);

  return {
    touch,
    checks: [
      "pointer preview and one undo",
      "held-key preview and one undo",
      "Escape rollback",
      "V-fold resize",
      "canvas profile/add/remove",
      ...(touch ? ["touch drag and one undo"] : []),
    ],
    metrics,
  };
}
