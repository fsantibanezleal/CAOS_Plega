import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { makePrintPlan, projectPrintOptions, STARTERS } from "../core/index";
import type { PrintOptions, PrintPlan, Project } from "../core/types";
import {
  bundleFiles,
  makeAssemblySteps,
  serializeFold,
  serializePdf,
  serializeProject,
  serializeSvgPages,
} from "../export/index";
import type { ExportFile, ExportResult } from "../export/types";

const fontBytes = new Uint8Array(
  readFileSync(
    new URL("../export/assets/NotoSans-Regular.ttf", import.meta.url),
  ),
);
const options: PrintOptions = {
  purpose: "fabrication",
  sheet: { width: 210, height: 297, margin: 10 },
  cuttingGap: 5,
  allowQuarterTurn: true,
  oversize: "reject",
};
const step: Project = {
  schemaVersion: 1,
  title: "Café & paper",
  card: {
    W: 90,
    H: 140,
    margin: 5,
    gap: 5,
    blank: "uncreased",
    color: "#ffffff",
    pins: [],
  },
  modules: [
    {
      id: "step",
      kind: "P",
      label: "Hola",
      color: "#b96f40",
      y: 40,
      params: { a: 25, b: 30, width: 32 },
      pins: [],
    },
  ],
};
const mixed: Project = {
  ...step,
  modules: [
    {
      ...step.modules[0],
      y: 10,
      params: { a: 25, b: 30, width: 25 },
    } as Project["modules"][number],
    {
      id: "sail",
      kind: "V",
      label: "Luz",
      color: "#649887",
      y: 85,
      params: {
        r: 40,
        h: 50,
        betaDeg: 30,
        gammaDeg: 60,
        tabWidth: 5,
        tabInset: 3,
      },
      pins: [],
    },
  ],
};
const pass = <T>(r: ExportResult<T>): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};
const plan = (p: Project, o: PrintOptions = options): PrintPlan => {
  const r = makePrintPlan(p, o);
  if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  return r.value;
};
const chars = (f: ExportFile) => new TextDecoder().decode(f.bytes);
const save = (name: string, file: ExportFile) => {
  if (process.env.PLEGA_EXPORT_QA_DIR) {
    mkdirSync(process.env.PLEGA_EXPORT_QA_DIR, { recursive: true });
    writeFileSync(resolve(process.env.PLEGA_EXPORT_QA_DIR, name), file.bytes);
  }
};

describe("fabrication serialization from actual engine plans", () => {
  it("exports real sculpture apertures and trim contours with assembly instructions", async () => {
    const sculpture = STARTERS.find(
      (s) => s.id === "tideglass-pavilion",
    )!.project;
    const layout = plan(sculpture);
    const svg = pass(
      await serializeSvgPages(sculpture, layout, { lang: "en", fontBytes }),
    );
    const patterns = svg.filter((f) => f.name.includes("pattern"));
    expect(patterns.some((f) => chars(f).includes(":aperture:"))).toBe(true);
    expect(patterns.some((f) => chars(f).includes(":trim:"))).toBe(true);
    expect(patterns.some((f) => chars(f).includes(":void:"))).toBe(true);
    expect(svg.some((f) => chars(f).includes("Remove their centres"))).toBe(
      true,
    );
    save("tideglass-pattern.svg", patterns[0]);
    const pdf = pass(
      await serializePdf(sculpture, layout, { lang: "en", fontBytes }),
    );
    save("tideglass-complete.pdf", pdf);
    const decoded = await PDFDocument.load(pdf.bytes);
    expect(decoded.getPageCount()).toBeGreaterThan(layout.pages.length);
  });
  it("writes standalone SVG pages at millimetre scale with a real 100 mm ruler", async () => {
    const files = pass(
      await serializeSvgPages(step, plan(step), { lang: "en", fontBytes }),
    );
    const pattern = files.find((f) => f.name.endsWith("pattern-1.svg"))!;
    const svg = chars(pattern);
    expect(svg).toContain('width="210mm" height="297mm" viewBox="0 0 210 297"');
    expect(svg).toMatch(
      /data-entity="calibration:100mm"[^>]*d="M10 281 L110 281"/u,
    );
    expect(svg).toMatch(
      /data-entity="calibration:10mm-square"[^>]*d="M115 286 L125 286 L125 276 L115 276 Z"/u,
    );
    expect(svg).toContain("data:font/ttf;base64,");
    const notices = JSON.parse(
      execFileSync(
        "python",
        [
          "-c",
          'import sys,json,hashlib,xml.etree.ElementTree as E; print(json.dumps([hashlib.sha256(json.loads(E.fromstring(s).find("{http://www.w3.org/2000/svg}metadata").text)["embeddedFont"]["notice"].encode()).hexdigest() for s in json.load(sys.stdin)]))',
        ],
        { input: JSON.stringify(files.map(chars)), encoding: "utf8" },
      ),
    );
    const expectedLicenseHash = createHash("sha256")
      .update(
        readFileSync(new URL("../export/assets/OFL.txt", import.meta.url)),
      )
      .digest("hex");
    expect(notices).toEqual(files.map(() => expectedLicenseHash));
    save("a4-step-pattern.svg", pattern);
  });
  it("preserves the asymmetric step middle score and two OPEN slit segments", async () => {
    const files = pass(
      await serializeSvgPages(step, plan(step), { lang: "en", fontBytes }),
    );
    const svg = chars(files.find((f) => f.name.endsWith("pattern-1.svg"))!);
    expect(svg).toMatch(
      /data-entity="step:ridge" data-layer="mountain" d="M105 233 L105 201"/u,
    );
    expect(svg).toMatch(
      /data-entity="step:slit:0" data-layer="cut" d="M75 233 L130 233"/u,
    );
    expect(svg).toMatch(
      /data-entity="step:slit:1" data-layer="cut" d="M75 201 L130 201"/u,
    );
    expect(
      svg
        .match(/data-entity="step:slit:\d"[^>]+/gu)
        ?.every((p) => !p.includes(" Z")),
    ).toBe(true);
    expect(svg).toContain('stroke-dasharray="4 1 0.6 1"');
    expect(svg).toContain('stroke-dasharray="2.4 1.2"');
  });
  it("rotates a large complete piece by a quarter turn without changing dimensions", async () => {
    const p = { ...step, card: { ...step.card, W: 125, H: 100 } };
    const layout = plan(p);
    expect(layout.placements[0].rotationDeg).toBe(90);
    const files = pass(
      await serializeSvgPages(p, layout, { lang: "en", fontBytes }),
    );
    const svg = chars(files.find((f) => f.name.endsWith("pattern-1.svg"))!);
    expect(svg).toMatch(
      /data-entity="step:ridge" data-layer="mountain" d="M70 143 L38 143"/u,
    );
    expect(svg).toContain("rotate(-90)");
  });
  it("writes real A4 PDF MediaBoxes and calibration operators in points", async () => {
    const file = pass(
      await serializePdf(mixed, plan(mixed), { lang: "en", fontBytes }),
    );
    save("a4-mixed.pdf", file);
    const doc = await PDFDocument.load(file.bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    for (const p of doc.getPages()) {
      expect(p.getWidth()).toBeCloseTo(595.2755905511812, 8);
      expect(p.getHeight()).toBeCloseTo(841.8897637795277, 8);
    }
    expect(doc.catalog.getOrCreateViewerPreferences().getPrintScaling()).toBe(
      "None",
    );
    const page = doc
      .getPages()
      .find((p) =>
        p.node.get(PDFName.of("PlegaPageKind"))?.toString().includes("pattern"),
      )!;
    const content = page.node.Contents()! as PDFArray | PDFRawStream;
    const streams =
      content instanceof PDFArray
        ? content.asArray().map((x) => doc.context.lookup(x) as PDFRawStream)
        : [content as PDFRawStream];
    const operators = streams
      .map((s) => new TextDecoder().decode(decodePDFRawStream(s).decode()))
      .join("\n");
    const ruler =
      /28\.34645669291339[\d]* 45\.35433070866142[\d]* m\s+311\.8110236220473[\d]* 45\.35433070866142[\d]* l/u;
    expect(operators).toMatch(ruler);
    expect(doc.catalog.has(PDFName.of("OpenAction"))).toBe(false);
  });
  it("writes US Letter PDF pages as exactly 612 by 792 points", async () => {
    const layout = plan(step, {
      ...options,
      sheet: { width: 215.9, height: 279.4, margin: 10 },
    });
    const file = pass(
      await serializePdf(step, layout, { lang: "es", fontBytes }),
    );
    save("letter-es.pdf", file);
    const doc = await PDFDocument.load(file.bytes);
    doc.getPages().forEach((p) => {
      expect(p.getWidth()).toBeCloseTo(612, 8);
      expect(p.getHeight()).toBeCloseTo(792, 8);
    });
  });
  it("prints oversize pieces only as clipped and explicitly labelled transfer patterns", async () => {
    const p = { ...step, card: { ...step.card, W: 150, H: 350 } };
    const layout = plan(p, { ...options, oversize: "tile-transfer-pattern" });
    expect(layout.pages.every((p) => p.transferOnly)).toBe(true);
    expect(layout.pages.length).toBe(4);
    const files = pass(
      await serializeSvgPages(p, layout, { lang: "en", fontBytes }),
    );
    const patterns = files.filter((f) => f.name.includes("pattern-"));
    expect(patterns).toHaveLength(4);
    for (const f of patterns) {
      const svg = chars(f);
      expect(svg).toContain("TRANSFER ONLY");
      expect(svg).toContain("clipPath");
      expect(svg).toContain('data-layer="registration"');
      expect(svg).toContain('data-entity="calibration:100mm"');
    }
    const pdf = pass(await serializePdf(p, layout, { lang: "en", fontBytes }));
    save("tile-transfer.pdf", pdf);
    save("tile-first.svg", patterns[0]);
  });
  it("does not allow a fabricated certificate to bypass failed closed fit", async () => {
    const p = { ...step, card: { ...step.card, W: 50 } };
    const draft = plan(p, { ...options, purpose: "draft" });
    const result = await serializePdf(
      p,
      { ...draft, purpose: "fabrication", certificate: "pass" },
      { lang: "en", fontBytes },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe("FABRICATION_BLOCKED");
    const staleDraft = await serializePdf(
      p,
      { ...draft, certificate: "pass" },
      { lang: "es", fontBytes },
    );
    expect(staleDraft.ok).toBe(false);
    if (!staleDraft.ok) {
      expect(staleDraft.errors[0].code).toBe("PRINT_CERTIFICATE_MISMATCH");
      expect(staleDraft.errors[0].message).toContain(
        "Genera el patrón de nuevo",
      );
    }
  });
  it("labels drafts in visible ink and metadata, with actual failed-check explanations", async () => {
    const p = { ...step, card: { ...step.card, W: 50 } };
    const layout = plan(p, { ...options, purpose: "draft" });
    const files = pass(
      await serializeSvgPages(p, layout, { lang: "en", fontBytes }),
    );
    expect(chars(files[0])).toContain("DRAFT");
    expect(files.every((file) => chars(file).includes("DRAFT"))).toBe(true);
    expect(chars(files[0])).toContain("&quot;purpose&quot;:&quot;draft&quot;");
    expect(files.some((f) => chars(f).includes("CLOSED_WIDTH"))).toBe(true);
    const pdf = pass(await serializePdf(p, layout, { lang: "en", fontBytes }));
    save("draft-failed-fit.pdf", pdf);
  });
  it("rejects page cropping outside transfer mode instead of silently changing scale", async () => {
    const layout = plan(step),
      placement = layout.placements[0];
    const result = await serializeSvgPages(
      step,
      {
        ...layout,
        placements: [{ ...placement, clip: { min: [-25, 0], max: [25, 30] } }],
      },
      { lang: "en", fontBytes },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe("PRINT_CLIP_INVALID");
  });
  it("rejects a translated piece outside the printable page", async () => {
    const layout = plan(step);
    const result = await serializePdf(
      step,
      {
        ...layout,
        placements: [{ ...layout.placements[0], translation: [0, 0] }],
      },
      { lang: "en", fontBytes },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe("PRINT_CLIPPING");
  });
  it("escapes user XML characters without interpreting a label as markup", async () => {
    const p = {
      ...step,
      title: '<script>& "café"',
      modules: [{ ...step.modules[0], label: "<b>&" }],
    };
    const files = pass(
      await serializeSvgPages(p, plan(p), { lang: "en", fontBytes }),
    );
    expect(files.some((f) => chars(f).includes("&lt;script&gt;"))).toBe(true);
    expect(
      files.every(
        (f) =>
          !chars(f).includes("<script>") &&
          !chars(f).includes("<foreignObject"),
      ),
    ).toBe(true);
  });
  it("preserves unsupported Unicode in JSON and reports missing print glyphs explicitly", async () => {
    const p = { ...step, title: "Hello 🌺" };
    expect(chars(pass(serializeProject(p)))).toContain("🌺");
    const result = await serializePdf(p, plan(p), { lang: "en", fontBytes });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0].code).toBe("FONT_GLYPH_UNSUPPORTED");
  });
  it("fails an unreadable label instead of drawing over a crease", async () => {
    const layout = plan(step),
      piece = layout.pieces[0];
    const result = await serializePdf(
      step,
      {
        ...layout,
        pieces: [
          {
            ...piece,
            labels: [
              {
                id: "tiny",
                text: "An unreadably long label",
                role: "part",
                box: { min: [1, 1], max: [2, 2] },
              },
            ],
          },
        ],
      },
      { lang: "en", fontBytes },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe("LABEL_OVERFLOW");
  });
  it("assembly progress IDs refer to the same modules, ridges and paired printed tabs", () => {
    const layout = plan(mixed),
      en = makeAssemblySteps(mixed, layout, "en"),
      es = makeAssemblySteps(mixed, layout, "es");
    expect(en.map((s) => s.id)).toEqual(es.map((s) => s.id));
    expect(new Set(en.map((s) => s.id)).size).toBe(en.length);
    expect(en.find((s) => s.id === "close")?.openingDeg).toBe(0);
    expect(
      en.find((s) => s.moduleId === "step" && s.kind === "score")?.body,
    ).toContain("5 mm");
    const glue = en.find((s) => s.moduleId === "sail" && s.kind === "glue")!;
    expect(glue.body).toContain("2L");
    expect(glue.body).toContain("2R");
    expect(glue.entityIds).toContain("sail:glue:left");
    expect(glue.body).toContain("BACK");
    expect(
      en.filter((s) => s.moduleId === "step").every((s) => s.kind !== "glue"),
    ).toBe(true);
    expect(es.some((s) => s.body.includes("REVERSO"))).toBe(true);
  });
  it("provides JSON and FOLD downloads through their canonical engine validators", () => {
    expect(JSON.parse(chars(pass(serializeProject(mixed))))).toEqual(mixed);
    const fold = pass(serializeFold(mixed));
    expect(fold.length).toBeGreaterThanOrEqual(2);
    for (const file of fold) {
      expect(file.mime).toBe("application/json");
      const data = JSON.parse(chars(file));
      expect(JSON.stringify(data)).toContain("mm");
      expect(JSON.stringify(data)).not.toContain("NaN");
    }
    const bad = serializeProject({
      ...step,
      schemaVersion: 9,
    } as unknown as Project);
    expect(bad.ok).toBe(false);
  });
  it("exports every actual starter with readable font-backed labels", async () => {
    for (const starter of STARTERS) {
      const file = pass(
        await serializePdf(
          starter.project,
          plan(starter.project, projectPrintOptions(starter.project)),
          {
            lang: "en",
            fontBytes,
          },
        ),
      );
      expect(file.bytes.length).toBeGreaterThan(10000);
      if (starter.id === "mountain-greeting")
        save("starter-mountain.pdf", file);
    }
  }, 60000);
  it("keeps a valid blank project printable without inventing a mechanism", async () => {
    const p = { ...step, title: "Blank card", modules: [] };
    const file = pass(
      await serializePdf(p, plan(p), { lang: "en", fontBytes }),
    );
    expect(file.bytes.length).toBeGreaterThan(10000);
    expect(makeAssemblySteps(p, plan(p), "en").every((s) => !s.moduleId)).toBe(
      true,
    );
  });
  it("paginates all six inserts and assembly instructions without orphaned or overlapping text", async () => {
    const p: Project = {
      ...step,
      title: "Six lanterns",
      card: { ...step.card, W: 120, H: 600 },
      modules: Array.from({ length: 6 }, (_, i) => ({
        id: "v" + i,
        kind: "V" as const,
        label: String(i + 1),
        color: "#649887",
        y: 35 + i * 80,
        params: {
          r: 40,
          h: 50,
          betaDeg: 30,
          gammaDeg: 90,
          tabWidth: 5,
          tabInset: 3,
        },
        pins: [],
      })),
    };
    const layout = plan(p, { ...options, oversize: "tile-transfer-pattern" });
    const file = pass(await serializePdf(p, layout, { lang: "es", fontBytes }));
    save("six-inserts-es.pdf", file);
    expect(
      new Set(
        makeAssemblySteps(p, layout, "es")
          .filter((s) => s.kind === "glue")
          .map((s) => s.moduleId),
      ).size,
    ).toBe(6);
  });
  it("bundles Unicode filenames with correct ZIP checksums readable by Python zipfile", () => {
    const files = [
      {
        name: "café.json",
        mime: "application/json",
        bytes: new TextEncoder().encode('{"label":"🌺"}\n'),
      },
      {
        name: "piece.fold",
        mime: "application/json",
        bytes: new Uint8Array([1, 2, 3, 255]),
      },
    ];
    const file = pass(bundleFiles(files));
    const actual = JSON.parse(
      execFileSync(
        "python",
        [
          "-c",
          'import sys,zipfile,io,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(json.dumps({"bad":z.testzip(),"files":{n:z.read(n).hex() for n in z.namelist()}}))',
        ],
        { input: file.bytes, encoding: "utf8" },
      ),
    );
    expect(actual.bad).toBeNull();
    expect(actual.files["café.json"]).toBe(
      Buffer.from(files[0].bytes).toString("hex"),
    );
    expect(actual.files["piece.fold"]).toBe("010203ff");
    expect(pass(bundleFiles(files)).bytes).toEqual(file.bytes);
  });
  it("rejects duplicate and traversal archive names before any download", () => {
    const one = {
      name: "../unsafe.svg",
      mime: "image/svg+xml",
      bytes: new Uint8Array(),
    };
    expect(bundleFiles([one]).ok).toBe(false);
    expect(
      bundleFiles([
        { ...one, name: "same.svg" },
        { ...one, name: "same.svg" },
      ]).ok,
    ).toBe(false);
    expect(bundleFiles([{ ...one, name: "C:escape.svg" }]).ok).toBe(false);
    expect(bundleFiles([{ ...one, name: "\ud800.svg" }]).ok).toBe(false);
  });
});
