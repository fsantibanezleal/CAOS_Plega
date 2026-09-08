import { describe, expect, it } from "vitest";
import {
  analyzeProject,
  applyRepair,
  packLanes,
  parseProject,
  poseProject,
  proposeRepairs,
  REPAIR_CASES,
  STARTERS,
  type Project,
} from "../core";
describe("bounded data and constrained repairs", () => {
  it("strictly rejects malformed data without geometry", () => {
    const source = STARTERS[0]!.project;
    const bad: unknown[] = [
      null,
      {},
      "{oops",
      JSON.stringify(source) + "x",
      { ...source, other: 1 },
      { ...source, schemaVersion: 2 },
      { ...source, modules: Array(7).fill(source.modules[0]) },
      { ...source, modules: [source.modules[0], source.modules[0]] },
      { ...source, card: { ...source.card, W: Infinity } },
      { ...source, card: { ...source.card, W: 1e-300 } },
      { ...source, modules: [{ ...source.modules[0], pins: ["gammaDeg"] }] },
      { ...source, title: "x".repeat(101) },
    ];
    for (const v of bad) {
      expect(parseProject(v).ok).toBe(false);
      expect(poseProject(v as Project, 90).ok).toBe(false);
    }
    expect(parseProject(" ".repeat(131073)).ok).toBe(false);
    expect(
      parseProject(
        JSON.stringify(source).replace(
          '"schemaVersion":1',
          '"schemaVersion":1,"schemaVersion":1',
        ),
      ).ok,
    ).toBe(false);
    expect(
      parseProject(
        JSON.stringify(source).replace(
          '"title":',
          '"tit\\u006ce":"duplicate","title":',
        ),
      ).ok,
    ).toBe(false);
  });
  it("never mutates a parsed project or accepts an invalid opening", () => {
    const p = STARTERS[0]!.project,
      before = JSON.stringify(p);
    analyzeProject(p);
    proposeRepairs(p);
    packLanes(p);
    expect(JSON.stringify(p)).toBe(before);
    for (const t of [-1, 181, NaN, Infinity])
      expect(poseProject(p, t).ok).toBe(false);
    expect(Object.isFrozen(p.modules)).toBe(true);
  });
  it("repairs the actual overhang while preserving pinned height", () => {
    const p = REPAIR_CASES[0]!.project;
    const options = proposeRepairs(p),
      r = options.find((r) =>
        r.changes.some(
          (c) => c.scope === "module" && c.field === "b" && c.after === 20,
        ),
      );
    expect(r).toBeDefined();
    if (!r) return;
    const applied = applyRepair(p, r);
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(analyzeProject(applied.value).certificate).toBe("pass");
      const m = applied.value.modules[0]!;
      if (m.kind !== "P") throw Error("kind");
      expect(m.params.a).toBe(25);
      expect(m.params.b).toBe(20);
    }
  });
  it("repairs impossible V angles without changing the pinned beta", () => {
    const p = REPAIR_CASES[1]!.project,
      r = proposeRepairs(p).find(
        (r) => analyzeProject(r.after).certificate === "pass",
      );
    expect(r).toBeDefined();
    if (!r) return;
    expect(
      r.changes.every((c) => c.scope !== "module" || c.field !== "betaDeg"),
    ).toBe(true);
    expect(poseProject(r.after, 180).ok).toBe(true);
  });
  it("rejects stale, fabricated and pin-breaking proposals", () => {
    const p = REPAIR_CASES[0]!.project,
      r = proposeRepairs(p)[0]!;
    expect(applyRepair({ ...p, title: "Changed" }, r).ok).toBe(false);
    expect(
      applyRepair(p, { ...r, after: { ...r.after, title: "Undeclared" } }).ok,
    ).toBe(false);
    expect(
      applyRepair(p, {
        ...r,
        changes: [
          {
            scope: "module",
            moduleId: "overhang",
            field: "a",
            before: 25,
            after: 20,
          },
        ],
      }).ok,
    ).toBe(false);
  });
  it("packs continuous slabs in order and respects fixed origins", () => {
    const original = STARTERS[5]!.project;
    const p: Project = {
      ...original,
      modules: original.modules.map((m, i) => ({
        ...m,
        y: i === 0 ? 15 : 55,
        pins: i === 0 ? ["y"] : [],
      })),
    };
    expect(analyzeProject(p).certificate).toBe("fail");
    const r = packLanes(p);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.after.modules[0]!.y).toBe(15);
      expect(analyzeProject(r.value.after).certificate).toBe("pass");
      const b = analyzeProject(r.value.after).modules;
      expect(b[1]!.sweptY[0] - b[0]!.sweptY[1]).toBeCloseTo(6, 10);
    }
    const conflict: Project = {
      ...p,
      modules: p.modules.map((m) => ({ ...m, pins: ["y"] })),
    };
    expect(packLanes(conflict).ok).toBe(false);
  });
  it("rejects overlapping actual step cut slots and insufficient six-lane capacity", () => {
    const p = STARTERS[0]!.project,
      m = p.modules[0]!;
    const overlaps: Project = {
      ...p,
      modules: [m, { ...m, id: "second", y: 50 }],
    };
    expect(poseProject(overlaps, 90).ok).toBe(false);
    expect(analyzeProject(overlaps).canDraftPrint).toBe(false);
    const v = STARTERS[2]!.project;
    const six: Project = {
      ...v,
      modules: Array.from({ length: 6 }, (_, i) => ({
        ...v.modules[0]!,
        id: `v-${i}`,
      })),
    };
    expect(packLanes(six).ok).toBe(false);
    expect(
      analyzeProject(six).diagnostics.some((d) => d.code === "LANE_CAPACITY"),
    ).toBe(true);
  });
  it("refuses to glue a V attachment to material removed by a step slot", () => {
    const p = STARTERS[5]!.project;
    const bad: Project = {
      ...p,
      modules: p.modules.map((m) => (m.kind === "V" ? { ...m, y: 40 } : m)),
    };
    const a = analyzeProject(bad);
    expect(
      a.diagnostics.some(
        (d) => d.reason === "glue-footprint-overlaps-step-cut",
      ),
    ).toBe(true);
    expect(a.canPose).toBe(false);
    const repaired = packLanes(bad);
    expect(repaired.ok).toBe(true);
    if (repaired.ok)
      expect(analyzeProject(repaired.value.after).canPose).toBe(true);
  });
});
