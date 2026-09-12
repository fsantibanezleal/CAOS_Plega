import { describe, expect, it } from "vitest";
import {
  analyzeProject,
  createModule,
  editMechanism,
  makeFoldDocuments,
  makePrintPlan,
  projectPrintOptions,
  parseProject,
  poseProject,
  REPAIR_CASES,
  STARTERS,
  type Project,
  type Vec2,
} from "../core";
import { cutPanel, pointInPolygon, segmentDistance } from "../core/cutwork";
import { area2, rect } from "../core/shared";
import { makePieces } from "../core/print";
import { defaultProject } from "../workspace";

describe("material removal with shared physical geometry", () => {
  it("bounds dense FOLD graphs before intersection processing", () => {
    const p: Project = {
      ...STARTERS[0].project,
      card: { ...STARTERS[0].project.card, W: 1900, H: 2000 },
      modules: Array.from({ length: 16 }, (_, i) => ({
        id: "screen-" + i,
        label: "Screen",
        color: "#234fdf",
        kind: "P",
        y: 10 + i * 110,
        params: { a: 500, b: 500, width: 100 },
        pins: [],
        cutwork: { pattern: "arcade", detail: 6, web: 1 },
      })),
    };
    expect(analyzeProject(p).certificate).toBe("pass");
    const fold = makeFoldDocuments(p);
    expect(fold.ok).toBe(false);
    expect(fold.diagnostics[0].code).toBe("FOLD_DENSITY");
    expect(poseProject(p, 90).ok).toBe(true);
  });
  it.each(["arcade", "leaf", "wing", "lattice"] as const)(
    "%s retains hinge geometry and exact material area",
    (pattern) => {
      for (const original of [
        rect(0, 0, 60, 40),
        [
          [0, 0],
          [-48, 22],
          [0, 75],
        ] as Vec2[],
      ])
        for (const detail of [1, 3, 6])
          for (const web of [1, 2.5, 5]) {
            const p = cutPanel(original, { pattern, detail, web });
            for (const vertex of p.polygon) {
              // Convex-parent halfplanes independently certify the material subset.
              const sign = Math.sign(area2(original));
              original.forEach((a, i) => {
                const b = original[(i + 1) % original.length]!;
                expect(
                  sign *
                    ((b[0] - a[0]) * (vertex[1] - a[1]) -
                      (b[1] - a[1]) * (vertex[0] - a[0])),
                ).toBeGreaterThanOrEqual(-1e-7);
              });
            }
            for (const hole of p.holes)
              hole.forEach((v, i) => {
                expect(pointInPolygon(v, p.polygon)).toBe(true);
                p.polygon.forEach((a, j) =>
                  expect(
                    segmentDistance(
                      v,
                      hole[(i + 1) % hole.length]!,
                      a,
                      p.polygon[(j + 1) % p.polygon.length]!,
                    ),
                  ).toBeGreaterThanOrEqual(web - 1e-7),
                );
              });
            const area = p.triangles.reduce(
              (sum, tri) =>
                sum + Math.abs(area2(tri.map((i) => p.vertices[i]!))) / 2,
              0,
            );
            expect(area).toBeCloseTo(
              (Math.abs(area2(p.polygon)) -
                p.holes.reduce((n, hole) => n + Math.abs(area2(hole)), 0)) /
                2,
              6,
            );
            expect(area).toBeGreaterThan(0);
            for (const endpoint of original)
              expect(p.polygon).toContainEqual(endpoint);
          }
    },
  );
  it.each(STARTERS.slice(6))(
    "$id has meaningful actual apertures and matching posed/printed cuts",
    ({ project }) => {
      const pieces = makePieces(project),
        holes = pieces.flatMap((p) => p.faces).flatMap((f) => f.holes ?? []);
      expect(holes.length).toBeGreaterThanOrEqual(24);
      const posed = poseProject(project, 83);
      if (!posed.ok) throw Error("pose");
      const cuts = pieces
        .flatMap((p) => p.lines)
        .filter((l) => l.id.includes(":aperture:") || l.id.includes(":trim:"));
      expect(cuts.length).toBeGreaterThan(150);
      expect(
        posed.value.edges
          .filter((e) => e.id.includes(":aperture:") || e.id.includes(":trim:"))
          .map((e) => e.printEdgeId)
          .sort(),
      ).toEqual(cuts.map((c) => c.id).sort());
      for (const cut of cuts) {
        const e = posed.value.edges.find((e) => e.printEdgeId === cut.id)!;
        expect(
          Math.hypot(...e.endpoints[0].map((v, i) => v - e.endpoints[1][i])),
        ).toBeCloseTo(
          Math.hypot(
            cut.points[0][0] - cut.points[1][0],
            cut.points[0][1] - cut.points[1][1],
          ),
          7,
        );
      }
      expect(makePrintPlan(project, projectPrintOptions(project)).ok).toBe(
        true,
      );
      expect(makeFoldDocuments(project).ok).toBe(true);
    },
  );
  it("preserves legacy imports and rejects unsafe profile extensions", () => {
    const original = STARTERS[0].project;
    expect(parseProject(JSON.stringify(original))).toMatchObject({
      ok: true,
      value: original,
    });
    for (const cutwork of [
      { pattern: "url(https://invalid)", detail: 2, web: 1 },
      { pattern: "leaf", detail: 2.2, web: 1 },
      { pattern: "wing", detail: 7, web: 1 },
      { pattern: "arcade", detail: 3, web: 0 },
      { pattern: "lattice", detail: 3, web: 2, extra: true },
    ])
      expect(
        parseProject({
          ...original,
          modules: [{ ...original.modules[0], cutwork }],
        }).ok,
      ).toBe(false);
    expect(
      parseProject({
        ...original,
        modules: Array.from({ length: 17 }, (_, i) => ({
          ...original.modules[0],
          id: "m" + i,
        })),
      }).ok,
    ).toBe(false);
  });
});

describe("creation and direct edits preserve a usable project", () => {
  it.each(STARTERS)(
    "adds a valid printable V-fold to $id without moving existing work",
    ({ project }) => {
      const snapshot = JSON.stringify(project),
        r = createModule(project, "V", "New wing", "#234fdf");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(analyzeProject(r.project).certificate).toBe("pass");
      expect(makePrintPlan(r.project, projectPrintOptions(r.project)).ok).toBe(
        true,
      );
      expect(r.project.modules.filter((m) => m.id !== r.moduleId)).toEqual(
        project.modules,
      );
      expect(JSON.stringify(project)).toBe(snapshot);
    },
  );
  it("refuses exhausted capacity and invalid current geometry before mutation", () => {
    const p = STARTERS[0].project;
    const full: Project = {
      ...p,
      card: { ...p.card, H: 42, margin: 5 },
      modules: [{ ...p.modules[0], y: 5 }],
    };
    expect(analyzeProject(full).certificate).toBe("pass");
    expect(createModule(full, "V", "New", "#234fdf")).toEqual({
      ok: false,
      reason: "capacity",
    });
    expect(
      createModule(REPAIR_CASES[0].project, "P", "New", "#234fdf"),
    ).toEqual({ ok: false, reason: "invalid-current" });
  });
  it("moves and resizes from a fixed gesture origin; clips at lanes and closed width", () => {
    const p = defaultProject(),
      m = p.modules[0];
    const moved = editMechanism(p, m.id, "y", 100);
    expect(moved.limited).toBe(true);
    expect(analyzeProject(moved.project).certificate).toBe("pass");
    const resized = editMechanism(p, m.id, "a", 200);
    expect(resized.limited).toBe(true);
    expect(analyzeProject(resized.project).certificate).toBe("pass");
    const small = editMechanism(p, m.id, "a", 29);
    expect(small.limited).toBe(false);
    expect(small.project.modules[0].params).toMatchObject({ a: 29 });
    const pinned: Project = {
      ...p,
      modules: [{ ...m, pins: ["a"] } as typeof m, ...p.modules.slice(1)],
    };
    expect(editMechanism(pinned, m.id, "a", 30)).toEqual({
      project: pinned,
      limited: true,
      reason: "pinned",
    });
    expect(JSON.stringify(p)).toBe(JSON.stringify(defaultProject()));
  });
});
