import { analyzeProject } from "./analysis";
import { readableModuleLabels } from "./print";
import type { Mechanism, Project } from "./types";

export type DirectField = "y" | "a" | "b" | "width" | "r" | "h";
export interface DirectEdit {
  project: Project;
  limited: boolean;
  reason?: "pinned" | "geometry" | "unavailable";
}
/** A drag is a one-parameter path from its pointer-down project, never an
 * accumulated sequence of lossy deltas. The valid endpoint is found before it
 * reaches the scene or a saved file. Analytic motion checks remain authoritative. */
export function editMechanism(
  project: Project,
  id: string,
  field: DirectField,
  requested: number,
): DirectEdit {
  const module = project.modules.find((m) => m.id === id);
  if (
    !module ||
    !Number.isFinite(requested) ||
    (field !== "y" && !(field in module.params)) ||
    analyzeProject(project).certificate !== "pass"
  )
    return { project, limited: true, reason: "unavailable" };
  if ((module.pins as readonly string[]).includes(field))
    return { project, limited: true, reason: "pinned" };
  const before =
    field === "y"
      ? module.y
      : (module.params as unknown as Record<string, number>)[field]!;
  const target = Math.max(
    field === "y" ? -4000 : 0.1,
    Math.min(field === "y" ? 4000 : 2000, requested),
  );
  const at = (fraction: number): Project => {
    const value = before + (target - before) * fraction;
    const changed =
      field === "y"
        ? { ...module, y: value }
        : ({
            ...module,
            params: { ...module.params, [field]: value },
          } as Mechanism);
    return {
      ...project,
      modules: project.modules.map((m) => (m.id === id ? changed : m)),
    };
  };
  const valid = (candidate: Project) =>
    analyzeProject(candidate).certificate === "pass" &&
    readableModuleLabels(candidate.modules.find((m) => m.id === id)!);
  const full = at(1);
  if (valid(full))
    return {
      project: full,
      limited: requested !== target,
      ...(requested !== target ? { reason: "geometry" as const } : {}),
    };
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (valid(at(mid))) lo = mid;
    else hi = mid;
  }
  return {
    project: lo > 1e-7 ? at(lo) : project,
    limited: true,
    reason: "geometry",
  };
}
