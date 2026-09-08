import type { Analysis, Diagnostic, Project } from "./types";
import { ALL, diag, EPS, RAD, polygonsOverlap, rect } from "./shared";
import { localLane, moduleBounds, tabValid, vDomain } from "./math";
import { parseProject } from "./validation";
export function analyzeProject(input: Project): Analysis {
  const parsed = parseProject(input);
  if (!parsed.ok)
    return {
      diagnostics: parsed.diagnostics,
      checks: [
        {
          id: "input",
          state: "fail",
          method: "structural",
          diagnosticIds: parsed.diagnostics.map((d) => d.id),
        },
      ],
      modules: [],
      canPose: false,
      canDraftPrint: false,
      canFinalPrint: false,
      canFoldExport: false,
      certificate: "unavailable",
    };
  const p = parsed.value,
    c = p.card,
    ds: Diagnostic[] = [],
    bounds: Analysis["modules"][number][] = [];
  let draft = true;
  if (c.margin >= c.W || 2 * c.margin >= c.H)
    ds.push(
      diag("CARD_MARGIN_EMPTY", [], {
        width: c.W,
        height: c.H,
        margin: c.margin,
      }),
    );
  if (!p.modules.length)
    ds.push(diag("NO_MODULES", [], {}, [], undefined, "info"));
  for (const m of p.modules) {
    if (m.kind === "P") {
      const v = m.params;
      if (c.blank === "prefolded" && Math.abs(v.a - v.b) > EPS)
        ds.push(
          diag(
            "P_PREFOLD_MISMATCH",
            [m.id],
            { a: v.a, b: v.b, creaseOffset: v.b - v.a },
            ALL,
          ),
        );
      if (v.a >= c.W || v.b >= c.W || m.y <= 0 || m.y + v.width >= c.H) {
        ds.push(
          diag(
            "P_ATTACHMENT_OUTSIDE",
            [m.id],
            {
              a: v.a,
              b: v.b,
              width: c.W,
              start: m.y,
              end: m.y + v.width,
              height: c.H,
            },
            ALL,
          ),
        );
        draft = false;
      }
    } else {
      const v = m.params;
      if (!vDomain(m)) {
        const disc =
          Math.cos(v.betaDeg * RAD) ** 2 - Math.cos(v.gammaDeg * RAD) ** 2;
        ds.push(
          diag(
            "V_DOMAIN",
            [m.id],
            { betaDeg: v.betaDeg, gammaDeg: v.gammaDeg, discriminant: disc },
            ALL,
            disc < 0 ? "no-real-full-opening" : "outside-supported-domain",
          ),
        );
      }
      if (!tabValid(m)) {
        ds.push(
          diag(
            "V_TAB_INVALID",
            [m.id],
            { length: v.r, inset: v.tabInset, usable: v.r - 2 * v.tabInset },
            ALL,
          ),
        );
        draft = false;
      }
      if (v.gammaDeg <= 0 || v.gammaDeg >= 180) draft = false;
    }
    if (m.kind === "V" && (!vDomain(m) || !tabValid(m))) continue;
    const b = moduleBounds(m);
    bounds.push(b);
    if (m.kind === "V") {
      const a = m.params.betaDeg * RAD;
      const points = [
        ...b.tabFootprints.flatMap((t) => t.polygon),
        [0, m.y],
        [m.params.r * Math.sin(a), m.y + m.params.r * Math.cos(a)],
      ];
      if (
        points.some(
          (v) =>
            v[0]! < -EPS ||
            v[0]! > c.W + EPS ||
            v[1]! < -EPS ||
            v[1]! > c.H + EPS,
        )
      )
        ds.push(
          diag(
            "V_ATTACHMENT_OUTSIDE",
            [m.id],
            { width: c.W, height: c.H },
            ALL,
          ),
        );
    }
    if (b.closedAcrossMax > c.W - c.margin + EPS)
      ds.push(
        diag("CLOSED_WIDTH", [m.id], {
          required: b.closedAcrossMax,
          available: c.W - c.margin,
          overhang: b.closedAcrossMax - (c.W - c.margin),
        }),
      );
    if (b.sweptY[0] < c.margin - EPS || b.sweptY[1] > c.H - c.margin + EPS)
      ds.push(
        diag("PAGE_Y_BOUNDS", [m.id], {
          lower: b.sweptY[0],
          upper: b.sweptY[1],
          minimum: c.margin,
          maximum: c.H - c.margin,
        }),
      );
  }
  const steps = p.modules.filter((m) => m.kind === "P");
  for (let i = 0; i < steps.length; i++)
    for (let j = i + 1; j < steps.length; j++) {
      const a = steps[i]!,
        b = steps[j]!;
      if (
        Math.min(a.y + a.params.width, b.y + b.params.width) -
          Math.max(a.y, b.y) >
        EPS
      ) {
        ds.push(diag("P_SLOT_OVERLAP", [a.id, b.id], {}, ALL));
        draft = false;
      }
    }
  for (const bound of bounds)
    for (const tab of bound.tabFootprints)
      for (const step of steps) {
        const slot = rect(
          0,
          step.y,
          tab.page === "left" ? step.params.a : step.params.b,
          step.y + step.params.width,
        );
        if (polygonsOverlap(tab.polygon, slot))
          ds.push(
            diag(
              "V_ATTACHMENT_OUTSIDE",
              [bound.moduleId, step.id],
              {},
              ALL,
              "glue-footprint-overlaps-step-cut",
            ),
          );
      }
  for (let i = 0; i < bounds.length; i++)
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i]!,
        b = bounds[j]!;
      const gap = b.sweptY[0] - a.sweptY[1];
      if (gap < c.gap - EPS)
        ds.push(
          diag(
            "LANE_UNCERTIFIED",
            [a.moduleId, b.moduleId],
            { actualGap: gap, requiredGap: c.gap },
            ["final-print", "certificate"],
            "ordered-swept-slabs",
            "warning",
          ),
        );
    }
  if (bounds.length === p.modules.length && bounds.length) {
    const span =
      p.modules.reduce((s, m) => {
        const [lo, hi] = localLane(m);
        return s + hi - lo;
      }, 0) +
      (p.modules.length - 1) * c.gap;
    if (span > c.H - 2 * c.margin + EPS)
      ds.push(
        diag("LANE_CAPACITY", [], {
          required: span,
          available: c.H - 2 * c.margin,
        }),
      );
  }
  const canPose = !ds.some((d) => d.blocks.includes("pose"));
  const certificate = ds.some((d) => d.blocks.includes("certificate"))
    ? canPose
      ? "fail"
      : "unavailable"
    : "pass";
  const checks = ds
    .filter((d) => d.severity !== "info")
    .map((d) => ({
      id: d.id,
      state:
        d.code === "LANE_UNCERTIFIED"
          ? ("unverified" as const)
          : ("fail" as const),
      method:
        d.code === "V_DOMAIN"
          ? ("product-domain" as const)
          : d.code.startsWith("INPUT")
            ? ("structural" as const)
            : ("analytic" as const),
      diagnosticIds: [d.id],
    }));
  if (!checks.length)
    checks.push({
      id: "supported-model-fit-and-lanes",
      state: "pass" as never,
      method: "analytic",
      diagnosticIds: [],
    });
  return {
    diagnostics: ds,
    checks,
    modules: bounds,
    canPose,
    canDraftPrint: draft,
    canFinalPrint: draft && !ds.some((d) => d.blocks.includes("final-print")),
    canFoldExport: draft && !ds.some((d) => d.blocks.includes("fold-export")),
    certificate,
  };
}
