import { describe, expect, it } from "vitest";
import {
  analyzeProject,
  poseProject,
  STARTERS,
  REPAIR_CASES,
  type Project,
  type Vec3,
} from "../core";
const length = (a: Vec3, b: Vec3) => Math.hypot(...a.map((x, i) => x - b[i]!));
const area = (v: readonly Vec3[]) =>
  Math.abs(
    v.reduce((s, p, i) => {
      const q = v[(i + 1) % v.length]!;
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  ) / 2;
describe("independent rigid geometry checks", () => {
  it.each(STARTERS.map((s) => [s.id, s.project] as const))(
    "%s passes checks at all sampled openings",
    (_, p) => {
      expect(analyzeProject(p).certificate).toBe("pass");
      for (const theta of [0, 1, 30, 60, 90, 135, 179, 180]) {
        const r = poseProject(p, theta);
        expect(r.ok).toBe(true);
        if (!r.ok) continue;
        expect(
          r.value.panels
            .flatMap((f) => f.vertices)
            .every((v) => v.every(Number.isFinite)),
        ).toBe(true);
        for (const f of r.value.panels) {
          expect(
            f.triangles.every((t) =>
              t.every((i) => i >= 0 && i < f.vertices.length),
            ),
          ).toBe(true);
          const other = poseProject(p, 90);
          if (!other.ok) throw Error("reference unavailable");
          const g = other.value.panels.find((g) => g.id === f.id)!;
          for (let i = 0; i < f.vertices.length; i++)
            for (let j = i + 1; j < f.vertices.length; j++)
              expect(length(f.vertices[i]!, f.vertices[j]!)).toBeCloseTo(
                length(g.vertices[i]!, g.vertices[j]!),
                7,
              );
        }
      }
    },
  );
  it("covers the complete blank once at 180 degrees and removes the real stationary strip", () => {
    const p = STARTERS[0]!.project,
      r = poseProject(p, 180);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(
      r.value.panels.reduce((s, f) => s + area(f.vertices), 0),
    ).toBeCloseTo(2 * 90 * 140, 8);
    expect(
      r.value.panels
        .filter((f) => f.role === "base")
        .reduce((s, f) => s + area(f.vertices), 0),
    ).toBeCloseTo(2 * 90 * 140 - 55 * 32, 8);
    const hit = r.value.panels
      .filter((f) => f.role === "base")
      .some((f) => {
        const xs = f.vertices.map((v) => v[0]),
          ys = f.vertices.map((v) => v[1]);
        return (
          Math.min(...xs) < 0 &&
          Math.max(...xs) > -25 &&
          Math.min(...ys) < 60 &&
          Math.max(...ys) > 50
        );
      });
    expect(hit).toBe(false);
    const mid = poseProject(p, 90);
    if (!mid.ok) throw Error("pose");
    expect(
      mid.value.panels
        .filter((f) => f.role === "base")
        .every((f) => !f.id.includes("p1")),
    ).toBe(true);
  });
  it("matches independently tabulated V-fold ridge positions", () => {
    const base = STARTERS[3]!.project;
    const p: Project = {
      ...base,
      modules: base.modules.map((m) => ({ ...m, y: 55 })),
    };
    const expected: Record<number, Vec3> = {
      0: [0, 55, 50],
      90: [0, 63.77166884027, 49.22456526732],
      180: [0, 83.86751345948, 40.82482904639],
    };
    for (const theta of [0, 90, 180]) {
      const r = poseProject(p, theta);
      if (!r.ok) throw Error("pose");
      const ridge = r.value.edges.find((e) => e.id === "pennant:ridge")!;
      ridge.endpoints[1].forEach((v, i) =>
        expect(v).toBeCloseTo(expected[theta]![i]!, 7),
      );
    }
  });
  it("uses one common book frame for step and V attachments", () => {
    const p = STARTERS[5]!.project,
      r = poseProject(p, 60);
    if (!r.ok) throw Error("pose");
    const a = r.value.edges.find((e) => e.id === "step:hinge:left")!
      .endpoints[0];
    expect(a[0]).toBeCloseTo(-11, 10);
    expect(a[1]).toBe(15);
    expect(a[2]).toBeCloseTo((22 * Math.sqrt(3)) / 2, 10);
    const v = r.value.edges.find((e) => e.id === "peak:hinge:right")!
      .endpoints[0];
    expect(v[2]).toBeCloseTo(Math.sqrt(3) * v[0], 9);
  });
  it("bounds include tab footprints, not just the moving triangles", () => {
    const original = STARTERS[2]!.project,
      m = original.modules[0]!;
    if (m.kind !== "V") throw Error("fixture");
    const p: Project = {
      ...original,
      card: { ...original.card, W: 150, H: 200 },
      modules: [{ ...m, y: 80, params: { ...m.params, tabWidth: 80 } }],
    };
    const a = analyzeProject(p),
      b = a.modules[0]!;
    expect(a.canPose).toBe(true);
    expect(b.sweptY[0]).toBeCloseTo(80 + (3 * Math.sqrt(3)) / 2 - 40, 9);
    for (const theta of [0, 25, 90, 170, 180]) {
      const r = poseProject(p, theta);
      if (!r.ok) throw Error("pose");
      for (const v of r.value.panels
        .filter((f) => f.moduleId === m.id)
        .flatMap((f) => f.vertices)) {
        expect(v[1]).toBeGreaterThanOrEqual(b.sweptY[0] - 1e-8);
        expect(v[1]).toBeLessThanOrEqual(b.sweptY[1] + 1e-8);
      }
    }
  });
  it("keeps real failed-fit geometry but refuses an impossible angle pose", () => {
    const fit = analyzeProject(REPAIR_CASES[0]!.project);
    expect(fit.canPose).toBe(true);
    expect(fit.canFinalPrint).toBe(false);
    expect(
      fit.diagnostics
        .find((d) => d.code === "CLOSED_WIDTH")!
        .numbers.find((n) => n.key === "overhang")!.value,
    ).toBe(10);
    const p = REPAIR_CASES[1]!.project;
    expect(poseProject(p, 90).ok).toBe(false);
    expect(
      analyzeProject(p).diagnostics.some(
        (d) => d.reason === "no-real-full-opening",
      ),
    ).toBe(true);
  });
});
