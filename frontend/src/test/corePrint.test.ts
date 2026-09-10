import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRINT_OPTIONS,
  makeFoldDocuments,
  makePrintPlan,
  REPAIR_CASES,
  STARTERS,
  type Project,
  type Vec2,
} from "../core";
const transform = (p: Vec2, rotation: number, t: Vec2): Vec2 =>
  rotation === 90 ? [-p[1] + t[0], p[0] + t[1]] : [p[0] + t[0], p[1] + t[1]];
describe("physical fabrication coordinates", () => {
  it.each(STARTERS.map((s) => [s.id, s.project] as const))(
    "%s fits actual-size pieces and keeps labels inside their faces",
    (_, project) => {
      const r = makePrintPlan(project);
      expect(r.ok, JSON.stringify(r.diagnostics)).toBe(true);
      if (!r.ok) return;
      for (const pl of r.value.placements) {
        const p = r.value.pieces.find((p) => p.id === pl.pieceId)!,
          page = r.value.pages[pl.pageIndex]!;
        for (const x of [p.layoutBounds.min[0], p.layoutBounds.max[0]])
          for (const y of [p.layoutBounds.min[1], p.layoutBounds.max[1]]) {
            const q = transform([x, y], pl.rotationDeg, pl.translation);
            expect(q[0]).toBeGreaterThanOrEqual(
              page.contentBounds.min[0] - 1e-8,
            );
            expect(q[0]).toBeLessThanOrEqual(page.contentBounds.max[0] + 1e-8);
            expect(q[1]).toBeGreaterThanOrEqual(
              page.contentBounds.min[1] - 1e-8,
            );
            expect(q[1]).toBeLessThanOrEqual(page.contentBounds.max[1] + 1e-8);
          }
      }
      for (const piece of r.value.pieces)
        for (const label of piece.labels.filter((l) => l.role === "glue")) {
          const glue = piece.glue.find((g) => label.id.startsWith(g.pairId))!;
          const polygon = glue.polygon;
          const sign = Math.sign(
            polygon.reduce((s, p, i) => {
              const n = polygon[(i + 1) % polygon.length]!;
              return s + p[0] * n[1] - p[1] * n[0];
            }, 0),
          );
          for (const x of [label.box.min[0], label.box.max[0]])
            for (const y of [label.box.min[1], label.box.max[1]])
              for (let i = 0; i < polygon.length; i++) {
                const a = polygon[i]!,
                  b = polygon[(i + 1) % polygon.length]!;
                expect(
                  sign *
                    ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])),
                ).toBeGreaterThanOrEqual(-1e-8);
              }
        }
    },
  );
  it("prints two open slits and the actual asymmetric middle crease", () => {
    const r = makePrintPlan(STARTERS[0]!.project);
    if (!r.ok) throw Error("plan");
    const p = r.value.pieces[0]!;
    expect(p.lines.filter((l) => l.id.includes("slit"))).toHaveLength(2);
    expect(p.lines.find((l) => l.id === "stage:ridge")!.points).toEqual([
      [5, 40],
      [5, 72],
    ]);
    expect(
      p.lines
        .filter((l) => l.id.startsWith("base:gutter"))
        .some((l) => l.points[0][1] < 60 && l.points[1][1] > 50),
    ).toBe(false);
  });
  it("blocks final failed-fit output and offers an explicitly labelled draft", () => {
    expect(makePrintPlan(REPAIR_CASES[0]!.project).ok).toBe(false);
    const r = makePrintPlan(REPAIR_CASES[0]!.project, {
      ...DEFAULT_PRINT_OPTIONS,
      purpose: "draft",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.purpose).toBe("draft");
      expect(r.value.certificate).toBe("fail");
      expect(r.value.diagnostics.some((d) => d.code === "CLOSED_WIDTH")).toBe(
        true,
      );
    }
  });
  it("tiles oversize continuous pieces without scaling or missing coverage", () => {
    const original = STARTERS[0]!.project,
      p: Project = { ...original, card: { ...original.card, W: 160, H: 350 } };
    expect(makePrintPlan(p).ok).toBe(false);
    const r = makePrintPlan(p, {
      ...DEFAULT_PRINT_OPTIONS,
      oversize: "tile-transfer-pattern",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pp = r.value.placements.filter((p) => p.pieceId === "base");
    expect(pp.length).toBeGreaterThan(1);
    for (const x of [-160, -80, 0, 80, 160])
      for (const y of [0, 70, 175, 300, 350])
        expect(
          pp.some(
            (p) =>
              p.clip &&
              x >= p.clip.min[0] - 1e-8 &&
              x <= p.clip.max[0] + 1e-8 &&
              y >= p.clip.min[1] - 1e-8 &&
              y <= p.clip.max[1] + 1e-8,
          ),
        ).toBe(true);
    for (const pl of pp) {
      expect(pl.rotationDeg).toBe(0);
      expect(pl.tile?.overlapMm).toBe(10);
      expect(r.value.pages[pl.pageIndex]!.transferOnly).toBe(true);
    }
  });
  it("exports optional cut graphs with separated pieces and correct score assignments", () => {
    const r = makeFoldDocuments(STARTERS[5]!.project);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((d) => d.fileName)).toEqual([
      "base.fold",
      "insert-peak.fold",
      "workshop.fold",
    ]);
    const base = r.value[0]!.data;
    expect(base.frame_unit).toBe("mm");
    expect((base.edges_assignment as string[]).includes("C")).toBe(true);
    expect(base.faces_vertices).toBeUndefined();
    for (const d of r.value) {
      const vertices = d.data.vertices_coords as Vec2[],
        edges = d.data.edges_vertices as number[][];
      expect(
        edges.every(
          (e) =>
            e.length === 2 &&
            e[0] !== e[1] &&
            e.every((i) => i >= 0 && i < vertices.length),
        ),
      ).toBe(true);
    }
    expect((r.value[2]!.data.file_frames as unknown[]).length).toBe(1);
  });
  it("prints the split greeting on both V faces and marks failed-fit FOLD drafts", () => {
    const plan = makePrintPlan(STARTERS[4]!.project);
    if (!plan.ok) throw Error("plan");
    expect(
      plan.value.pieces[1]!.labels.filter((l) => l.role === "decoration").map(
        (l) => l.text,
      ),
    ).toEqual(["THANK", "YOU"]);
    const fold = makeFoldDocuments(REPAIR_CASES[0]!.project);
    if (!fold.ok) throw Error("fold");
    expect(fold.value[0]!.data["plega:status"]).toBe("draft-pattern");
    expect(fold.value[0]!.data["plega:certificate"]).toBe("fail");
  });
});
