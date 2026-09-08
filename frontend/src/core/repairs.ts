import type {
  Change,
  Localized,
  Project,
  RepairProposal,
  Result,
} from "./types";
import { analyzeProject } from "./analysis";
import { localLane, moduleBounds, tabValid, vDomain } from "./math";
import { parseProject } from "./validation";
import { ALL, canonical, diag, EPS, RAD } from "./shared";
type Mutable = {
  card: Record<string, unknown>;
  modules: {
    id: string;
    y: number;
    params: Record<string, number>;
    pins: string[];
  }[];
};
function edit(project: Project, changes: readonly Change[]): Result<Project> {
  const cloned = JSON.parse(JSON.stringify(project)) as Mutable;
  for (const c of changes) {
    if (!c || !Number.isFinite(c.before) || !Number.isFinite(c.after))
      return { ok: false, diagnostics: [diag("REPAIR_INVALID", [], {}, ALL)] };
    if (c.scope === "card") {
      if (
        !["W", "H", "margin", "gap"].includes(c.field) ||
        project.card.pins.includes(c.field) ||
        cloned.card[c.field] !== c.before
      )
        return { ok: false, diagnostics: [diag("PIN_CONFLICT", [], {}, ALL)] };
      cloned.card[c.field] = c.after;
    } else if (c.scope === "module") {
      const original = project.modules.find((m) => m.id === c.moduleId),
        m = cloned.modules.find((m) => m.id === c.moduleId);
      if (
        !m ||
        !original ||
        (original.pins as readonly string[]).includes(c.field)
      )
        return {
          ok: false,
          diagnostics: [diag("PIN_CONFLICT", [c.moduleId], {}, ALL)],
        };
      const allowed =
        original.kind === "P"
          ? ["y", "a", "b", "width"]
          : ["y", "r", "h", "betaDeg", "gammaDeg", "tabWidth", "tabInset"];
      if (!allowed.includes(c.field))
        return {
          ok: false,
          diagnostics: [diag("REPAIR_INVALID", [c.moduleId], {}, ALL)],
        };
      if (c.field === "y") {
        if (m.y !== c.before)
          return {
            ok: false,
            diagnostics: [diag("REPAIR_STALE", [c.moduleId], {}, ALL)],
          };
        m.y = c.after;
      } else {
        if (m.params[c.field] !== c.before)
          return {
            ok: false,
            diagnostics: [diag("REPAIR_STALE", [c.moduleId], {}, ALL)],
          };
        m.params[c.field] = c.after;
      }
    } else
      return { ok: false, diagnostics: [diag("REPAIR_INVALID", [], {}, ALL)] };
  }
  return parseProject(cloned);
}
function proposal(
  project: Project,
  changes: readonly Change[],
  id: string,
  label: Localized,
): RepairProposal | null {
  if (!changes.length) return null;
  const result = edit(project, changes);
  if (!result.ok) return null;
  const before = analyzeProject(project),
    after = analyzeProject(result.value),
    beforeIds = before.diagnostics
      .filter((d) => d.blocks.length)
      .map((d) => d.id),
    afterIds = new Set(after.diagnostics.map((d) => d.id));
  return {
    id,
    labelKey: id,
    label,
    reasonDiagnosticIds: beforeIds,
    changes,
    beforeKey: canonical(project),
    after: result.value,
    beforeDiagnostics: before.diagnostics,
    afterDiagnostics: after.diagnostics,
    resolves: beforeIds.filter((id) => !afterIds.has(id)),
    remaining: after.diagnostics
      .filter((d) => d.blocks.length)
      .map((d) => d.id),
  };
}
export function applyRepair(
  project: Project,
  p: RepairProposal,
): Result<Project> {
  const parsed = parseProject(project);
  if (!parsed.ok) return parsed;
  if (
    !p ||
    typeof p !== "object" ||
    p.beforeKey !== canonical(parsed.value) ||
    !Array.isArray(p.changes) ||
    p.changes.length > 48
  )
    return { ok: false, diagnostics: [diag("REPAIR_STALE", [], {}, ALL)] };
  const result = edit(parsed.value, p.changes);
  if (!result.ok) return result;
  const target = parseProject(p.after);
  if (!target.ok || canonical(result.value) !== canonical(target.value))
    return { ok: false, diagnostics: [diag("REPAIR_INVALID", [], {}, ALL)] };
  return {
    ok: true,
    value: result.value,
    diagnostics: analyzeProject(result.value).diagnostics,
  };
}
export function packLanes(project: Project): Result<RepairProposal> {
  const parsed = parseProject(project);
  if (!parsed.ok) return parsed;
  const p = parsed.value,
    a = analyzeProject(p);
  if (a.modules.length !== p.modules.length)
    return { ok: false, diagnostics: a.diagnostics };
  let cursor = p.card.margin;
  const changes: Change[] = [];
  for (const m of p.modules) {
    const [lo, hi] = localLane(m),
      pinned = m.pins.includes("y");
    let y = cursor - lo;
    if (pinned) {
      if (m.y + lo < cursor - EPS)
        return {
          ok: false,
          diagnostics: [
            diag(
              "PIN_CONFLICT",
              [m.id],
              { requiredStart: cursor, pinnedStart: m.y + lo },
              ["final-print"],
              "lane-origin",
            ),
          ],
        };
      y = m.y;
    }
    if (Math.abs(y - m.y) > EPS)
      changes.push({
        scope: "module",
        moduleId: m.id,
        field: "y",
        before: m.y,
        after: y,
      });
    cursor = y + hi + p.card.gap;
  }
  const end = p.modules.length ? cursor - p.card.gap : p.card.margin;
  if (end > p.card.H - p.card.margin + EPS)
    return {
      ok: false,
      diagnostics: [
        diag("LANE_CAPACITY", [], {
          required: end + p.card.margin,
          available: p.card.H,
        }),
      ],
    };
  const candidate = proposal(p, changes, "pack-lanes", {
    en: "Place mechanisms in separated lanes",
    es: "Colocar los mecanismos en bandas separadas",
  });
  if (candidate)
    return {
      ok: true,
      value: candidate,
      diagnostics: candidate.afterDiagnostics,
    };
  return {
    ok: true,
    value: {
      id: "pack-lanes",
      labelKey: "pack-lanes",
      label: {
        en: "Lanes are already packed",
        es: "Las bandas ya están ordenadas",
      },
      reasonDiagnosticIds: [],
      changes: [],
      beforeKey: canonical(p),
      after: p,
      beforeDiagnostics: a.diagnostics,
      afterDiagnostics: a.diagnostics,
      resolves: [],
      remaining: a.diagnostics.filter((d) => d.blocks.length).map((d) => d.id),
    },
    diagnostics: a.diagnostics,
  };
}
export function proposeRepairs(project: Project): readonly RepairProposal[] {
  const parsed = parseProject(project);
  if (!parsed.ok) return [];
  const p = parsed.value,
    a = analyzeProject(p),
    out: RepairProposal[] = [];
  const push = (changes: Change[], id: string, en: string, es: string) => {
    const r = proposal(p, changes, id, { en, es });
    if (r && !out.some((x) => canonical(x.after) === canonical(r.after)))
      out.push(r);
  };
  const change = (
    id: string,
    field: Change extends never ? never : string,
    value: number,
  ): Change | null => {
    const m = p.modules.find((m) => m.id === id);
    if (
      !m ||
      (m.pins as readonly string[]).includes(field) ||
      !Number.isFinite(value) ||
      Math.abs(
        value -
          (field === "y"
            ? m.y
            : (m.params as unknown as Record<string, number>)[field]!),
      ) < EPS
    )
      return null;
    return {
      scope: "module",
      moduleId: id,
      field: field as "y",
      before:
        field === "y"
          ? m.y
          : (m.params as unknown as Record<string, number>)[field]!,
      after: value,
    };
  };
  const single = (
    id: string,
    field: string,
    value: number,
    en: string,
    es: string,
  ) => {
    const c = change(id, field, value);
    if (c) push([c], `${id}-${field}-${value.toFixed(4)}`, en, es);
  };
  const card = (field: "W" | "H", value: number, en: string, es: string) => {
    if (
      !p.card.pins.includes(field) &&
      value <= 2000 &&
      value > p.card[field] + EPS
    )
      push(
        [{ scope: "card", field, before: p.card[field], after: value }],
        `card-${field}-${value.toFixed(4)}`,
        en,
        es,
      );
  };
  for (const m of p.modules) {
    const codes = new Set(
      a.diagnostics
        .filter((d) => d.moduleIds.includes(m.id))
        .map((d) => d.code),
    );
    if (m.kind === "P") {
      if (codes.has("P_PREFOLD_MISMATCH")) {
        single(
          m.id,
          "a",
          m.params.b,
          "Match the left attachment to the right",
          "Igualar la unión izquierda a la derecha",
        );
        single(
          m.id,
          "b",
          m.params.a,
          "Match the right attachment to the left",
          "Igualar la unión derecha a la izquierda",
        );
      }
      if (codes.has("CLOSED_WIDTH")) {
        const available = p.card.W - p.card.margin;
        single(
          m.id,
          "a",
          available - m.params.b,
          "Reduce step height to fit the closed card",
          "Reducir la altura del escalón para cerrar la tarjeta",
        );
        single(
          m.id,
          "b",
          available - m.params.a,
          "Reduce step depth to fit the closed card",
          "Reducir la profundidad del escalón para cerrar la tarjeta",
        );
      }
    } else {
      if (codes.has("V_DOMAIN")) {
        const beta = Math.min(45, Math.max(20, m.params.betaDeg)),
          gamma = Math.min(90, Math.max(beta + 15, m.params.gammaDeg));
        const cs = [
          change(m.id, "betaDeg", beta),
          change(m.id, "gammaDeg", gamma),
        ].filter((x): x is Change => !!x);
        push(
          cs,
          `${m.id}-supported-angles`,
          "Use angles in the supported V-fold domain",
          "Usar ángulos del dominio V admitido",
        );
      }
      if (codes.has("V_TAB_INVALID"))
        single(
          m.id,
          "tabInset",
          m.params.r / 4,
          "Restore a usable tab hinge",
          "Restaurar una bisagra útil en la pestaña",
        );
      if (codes.has("CLOSED_WIDTH") && vDomain(m)) {
        const sin = Math.sin((m.params.betaDeg + m.params.gammaDeg) * RAD);
        single(
          m.id,
          "h",
          (p.card.W - p.card.margin) / sin,
          "Shorten the ridge for the closed width",
          "Acortar la arista para el ancho cerrado",
        );
      }
    }
    if (m.kind === "P" || (vDomain(m) && tabValid(m))) {
      const b = moduleBounds(m),
        [lo, hi] = localLane(m),
        low = p.card.margin - lo,
        high = p.card.H - p.card.margin - hi;
      if (
        codes.has("PAGE_Y_BOUNDS") ||
        codes.has("P_ATTACHMENT_OUTSIDE") ||
        codes.has("V_ATTACHMENT_OUTSIDE")
      ) {
        if (low <= high)
          single(
            m.id,
            "y",
            Math.max(low, Math.min(high, m.y)),
            "Move the motion zone inside the card",
            "Mover la zona de movimiento al interior de la tarjeta",
          );
        card(
          "H",
          Math.max(p.card.H, b.sweptY[1] + p.card.margin),
          "Increase the card height",
          "Aumentar la altura de la tarjeta",
        );
      }
      if (
        codes.has("CLOSED_WIDTH") ||
        codes.has("P_ATTACHMENT_OUTSIDE") ||
        codes.has("V_ATTACHMENT_OUTSIDE")
      )
        card(
          "W",
          b.closedAcrossMax + p.card.margin,
          "Increase the card width",
          "Aumentar el ancho de la tarjeta",
        );
    }
  }
  if (
    a.diagnostics.some((d) =>
      ["LANE_UNCERTIFIED", "PAGE_Y_BOUNDS", "P_SLOT_OVERLAP"].includes(d.code),
    )
  ) {
    const packed = packLanes(p);
    if (packed.ok && packed.value.changes.length) out.push(packed.value);
  }
  if (
    a.modules.length === p.modules.length &&
    a.diagnostics.some((d) => d.code === "LANE_CAPACITY")
  ) {
    const height =
      2 * p.card.margin +
      p.modules.reduce((s, m) => {
        const [lo, hi] = localLane(m);
        return s + hi - lo;
      }, 0) +
      Math.max(0, p.modules.length - 1) * p.card.gap;
    card(
      "H",
      height,
      "Increase height to fit all motion zones",
      "Aumentar la altura para todas las zonas de movimiento",
    );
  }
  return out.slice(0, 24);
}
