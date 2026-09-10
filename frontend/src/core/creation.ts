import type { Mechanism, Project } from "./types";
import { MAX_MODULES } from "./types";
import { analyzeProject } from "./analysis";
import { localLane, moduleBounds } from "./math";
import { readableModuleLabels } from "./print";
export type Creation =
  | { ok: true; project: Project; moduleId: string }
  | { ok: false; reason: "capacity" | "invalid-current" | "module-limit" };

/** Add only a fully checked part. Existing dimensions, origins and pins never move. */
export function createModule(
  project: Project,
  kind: "P" | "V",
  label: string,
  color: string,
): Creation {
  if (project.modules.length >= MAX_MODULES)
    return { ok: false, reason: "module-limit" };
  const current = analyzeProject(project);
  if (current.certificate !== "pass")
    return { ok: false, reason: "invalid-current" };
  let id = "m1";
  for (let i = 1; project.modules.some((m) => m.id === id); i++)
    id = "m" + (i + 1);
  const intervals = current.modules
    .map((m) => m.sweptY)
    .sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  let start = project.card.margin;
  for (const [lo, hi] of intervals) {
    if (lo - project.card.gap > start)
      free.push([start, lo - project.card.gap]);
    start = Math.max(start, hi + project.card.gap);
  }
  if (start < project.card.H - project.card.margin)
    free.push([start, project.card.H - project.card.margin]);
  for (const scale of [1, 0.8, 0.6, 0.45]) {
    const common = {
      id,
      kind,
      label,
      color,
      y: 0,
      pins: [],
      cutwork: {
        pattern: kind === "P" ? ("arcade" as const) : ("wing" as const),
        detail: 2,
        web: 1,
      },
    };
    const candidate: Mechanism =
      kind === "P"
        ? {
            ...common,
            kind,
            params: { a: 20 * scale, b: 20 * scale, width: 20 * scale },
          }
        : {
            ...common,
            kind,
            params: {
              r: 24 * scale,
              h: 26 * scale,
              betaDeg: 30,
              gammaDeg: 70,
              tabWidth: 5,
              tabInset: Math.max(3, 4 * scale),
            },
          };
    const [low, high] = localLane(candidate);
    for (const [a, b] of free) {
      if (high - low > b - a + 1e-9) continue;
      const added = { ...candidate, y: a - low };
      const next: Project = {
        ...project,
        modules: [...project.modules, added].sort(
          (a, b) => moduleBounds(a).sweptY[0] - moduleBounds(b).sweptY[0],
        ),
      };
      if (
        analyzeProject(next).certificate === "pass" &&
        readableModuleLabels(added)
      )
        return { ok: true, project: next, moduleId: id };
    }
  }
  return { ok: false, reason: "capacity" };
}
