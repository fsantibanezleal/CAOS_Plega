import type {
  Box2,
  PrintFace,
  PrintLabel,
  PrintLine,
  PrintOptions,
  PrintPiece,
  PrintPlacement,
  PrintPlan,
  Project,
  Result,
  Vec2,
  Cutwork,
  Mechanism,
} from "./types";
import { analyzeProject } from "./analysis";
import { baseFaces, tabPolygon, vNet } from "./math";
import { vPerimeter } from "./pose";
import { area2, bounds2, diag, EPS, rect, rotate2 } from "./shared";
import { cutPanel } from "./cutwork";
export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  purpose: "fabrication",
  sheet: { width: 210, height: 297, margin: 10 },
  cuttingGap: 5,
  allowQuarterTurn: true,
  oversize: "reject",
};
/** Large complete compositions use registered, actual-size A4 transfer tiles. */
export function projectPrintOptions(
  project: Project,
  purpose: PrintOptions["purpose"] = "fabrication",
): PrintOptions {
  const sheet = DEFAULT_PRINT_OPTIONS.sheet;
  const contentWidth = sheet.width - 2 * sheet.margin;
  const contentHeight = sheet.height - 2 * sheet.margin - 14;
  return {
    ...DEFAULT_PRINT_OPTIONS,
    purpose,
    oversize:
      2 * project.card.W > contentWidth || project.card.H > contentHeight
        ? "tile-transfer-pattern"
        : "reject",
  };
}
const face = (
  id: string,
  polygon: readonly Vec2[],
  fill: string,
  moduleId?: string,
): PrintFace => ({
  id,
  polygon: area2(polygon) < 0 ? [...polygon].reverse() : polygon,
  fill,
  ...(moduleId ? { moduleId } : {}),
});
const label = (
  id: string,
  text: string,
  b: Box2,
  role: PrintLabel["role"] = "decoration",
): PrintLabel => ({ id, text, box: b, role });
function sculptFace(
  id: string,
  polygon: readonly Vec2[],
  fill: string,
  moduleId: string,
  lines: PrintLine[],
  cutwork?: Cutwork,
): PrintFace {
  if (!cutwork) return face(id, polygon, fill, moduleId);
  const p = cutPanel(polygon, cutwork);
  lines.push(
    ...p.cuts.map((c) => ({
      id: `${id}:${c.id}`,
      assignment: "cut" as const,
      points: c.points,
      moduleId,
    })),
  );
  return { id, polygon: p.polygon, holes: p.holes, fill, moduleId };
}
function insideBox(poly: readonly Vec2[], maxHeight = 12): Box2 {
  const p = area2(poly) < 0 ? [...poly].reverse() : poly,
    c: Vec2 = [
      p.reduce((s, v) => s + v[0], 0) / p.length,
      p.reduce((s, v) => s + v[1], 0) / p.length,
    ];
  let half = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!,
      b = p[(i + 1) % p.length]!,
      nx = -(b[1] - a[1]),
      ny = b[0] - a[0],
      den = Math.abs(nx) + Math.abs(ny);
    if (den > 0)
      half = Math.min(
        half,
        (nx * (c[0] - a[0]) + ny * (c[1] - a[1]) - 0.25 * Math.hypot(nx, ny)) /
          den,
      );
  }
  half = Math.max(0, half);
  return {
    min: [c[0] - half, c[1] - Math.min(half, maxHeight / 2)],
    max: [c[0] + half, c[1] + Math.min(half, maxHeight / 2)],
  };
}
/** Label feasibility without generating cutout meshes during a pointer gesture. */
export function readableModuleLabels(m: Mechanism): boolean {
  const polygons: (readonly Vec2[])[] = [];
  if (m.kind === "P") {
    if (!m.cutwork) polygons.push(rect(0, 0, m.params.a, m.params.width));
  } else {
    const n = vNet(m),
      p = m.params;
    polygons.push(
      n.leftTab,
      n.rightTab,
      tabPolygon(p.betaDeg, p.r, p.tabInset, p.tabWidth, "left"),
      tabPolygon(p.betaDeg, p.r, p.tabInset, p.tabWidth, "right"),
    );
    if (!m.cutwork) polygons.push([n.o, n.l, n.c], [n.o, n.r, n.c]);
  }
  return polygons.every((p) => {
    const b = insideBox(p);
    return b.max[0] - b.min[0] >= 2.7 && b.max[1] - b.min[1] >= 2.7;
  });
}
export function makePieces(project: Project): PrintPiece[] {
  const W = project.card.W,
    H = project.card.H;
  const faces: PrintFace[] = baseFaces(project).map((f) =>
    face(f.id, f.polygon, project.card.color),
  );
  const lines: PrintLine[] = rect(-W, 0, W, H).map((p, i, arr) => ({
    id: `base:border:${i}`,
    assignment: "cut",
    points: [p, arr[(i + 1) % 4]!],
  }));
  const glue: PrintPiece["glue"][number][] = [],
    labels: PrintLabel[] = [],
    inserts: PrintPiece[] = [];
  let y = 0;
  for (const m of project.modules
    .filter((m) => m.kind === "P")
    .sort((a, b) => a.y - b.y)) {
    if (m.y > y)
      lines.push({
        id: `base:gutter:${y}`,
        assignment: "valley",
        points: [
          [0, y],
          [0, m.y],
        ],
      });
    y = m.y + m.params.width;
  }
  if (y < H)
    lines.push({
      id: `base:gutter:${y}`,
      assignment: "valley",
      points: [
        [0, y],
        [0, H],
      ],
    });
  for (const m of project.modules) {
    if (m.kind === "P") {
      const { a, b, width: w } = m.params,
        mid = b - a;
      faces.push(
        sculptFace(
          `${m.id}:p1`,
          rect(-a, m.y, mid, m.y + w),
          m.color,
          m.id,
          lines,
          m.cutwork,
        ),
        sculptFace(
          `${m.id}:p2`,
          rect(mid, m.y, b, m.y + w),
          m.color,
          m.id,
          lines,
          m.cutwork,
        ),
      );
      for (const [i, yy] of [m.y, m.y + w].entries())
        lines.push({
          id: `${m.id}:slit:${i}`,
          assignment: "cut",
          points: [
            [-a, yy],
            [b, yy],
          ],
          moduleId: m.id,
        });
      lines.push(
        {
          id: `${m.id}:hinge:left`,
          assignment: "valley",
          points: [
            [-a, m.y],
            [-a, m.y + w],
          ],
          moduleId: m.id,
        },
        {
          id: `${m.id}:ridge`,
          assignment: "mountain",
          points: [
            [mid, m.y],
            [mid, m.y + w],
          ],
          moduleId: m.id,
        },
        {
          id: `${m.id}:hinge:right`,
          assignment: "valley",
          points: [
            [b, m.y],
            [b, m.y + w],
          ],
          moduleId: m.id,
        },
      );
      if (!m.cutwork)
        labels.push(
          label(
            `${m.id}:label`,
            m.label,
            insideBox(rect(mid, m.y, b, m.y + w)),
          ),
        );
    } else {
      const sculptLines: PrintLine[] = [];
      const p = m.params,
        n = vNet(m),
        insertFaces: PrintFace[] = [
          sculptFace(
            `${m.id}:left`,
            [n.o, n.l, n.c],
            m.color,
            m.id,
            sculptLines,
            m.cutwork,
          ),
          sculptFace(
            `${m.id}:right`,
            [n.o, n.r, n.c],
            m.color,
            m.id,
            sculptLines,
            m.cutwork,
          ),
        ];
      const insertLines: PrintLine[] = vPerimeter(m).map((s) => ({
        id: s.id,
        assignment: "cut",
        points: s.points,
        moduleId: m.id,
      }));
      insertLines.push(...sculptLines);
      insertLines.push({
        id: `${m.id}:ridge`,
        assignment: "mountain",
        points: [n.o, n.c],
        moduleId: m.id,
      });
      const insertGlue: PrintPiece["glue"][number][] = [],
        insertLabels: PrintLabel[] = [];
      for (const side of ["left", "right"] as const) {
        const tab = side === "left" ? n.leftTab : n.rightTab,
          pairId = `${m.id}:glue:${side}`;
        insertFaces.push(face(`${m.id}:tab:${side}`, tab, m.color, m.id));
        insertLines.push({
          id: `${m.id}:hinge:${side}`,
          assignment: "valley",
          points: [tab[0]!, tab[1]!],
          moduleId: m.id,
        });
        const outline = tabPolygon(
          p.betaDeg,
          p.r,
          p.tabInset,
          p.tabWidth,
          side,
        ).map(([x, yy]) => [x, yy + m.y] as Vec2);
        glue.push({
          id: `${pairId}:base`,
          polygon: outline,
          pairId,
          side: "front-of-base",
        });
        insertGlue.push({
          id: `${pairId}:tab`,
          polygon: tab,
          pairId,
          side: "back-of-tab",
        });
        const short = `${project.modules.indexOf(m) + 1}${side === "left" ? "L" : "R"}`;
        insertLabels.push(
          label(`${pairId}:label:tab`, short, insideBox(tab), "glue"),
        );
        labels.push(
          label(`${pairId}:label:base`, short, insideBox(outline), "glue"),
        );
      }
      const words = m.label.trim().split(/\s+/),
        mid = Math.ceil(words.length / 2);
      if (!m.cutwork && words.length > 1) {
        insertLabels.push(
          label(
            `${m.id}:label:left`,
            words.slice(0, mid).join(" "),
            insideBox([n.o, n.l, n.c]),
          ),
          label(
            `${m.id}:label:right`,
            words.slice(mid).join(" "),
            insideBox([n.o, n.r, n.c]),
          ),
        );
      } else if (!m.cutwork)
        insertLabels.push(
          label(`${m.id}:label:right`, m.label, insideBox([n.o, n.r, n.c])),
        );
      const all = insertFaces.flatMap((f) => f.polygon),
        ib = bounds2(all);
      inserts.push({
        id: `insert:${m.id}`,
        faces: insertFaces,
        lines: insertLines,
        glue: insertGlue,
        labels: insertLabels,
        cutBounds: ib,
        layoutBounds: ib,
      });
    }
  }
  const cutBounds: Box2 = { min: [-W, 0], max: [W, H] };
  const layoutBounds = bounds2([
    ...rect(-W, 0, W, H),
    ...glue.flatMap((g) => g.polygon),
  ]);
  return [
    { id: "base", faces, lines, glue, labels, cutBounds, layoutBounds },
    ...inserts,
  ];
}
export function makePrintPlan(
  project: Project,
  options: PrintOptions = DEFAULT_PRINT_OPTIONS,
): Result<PrintPlan> {
  const analysis = analyzeProject(project);
  if (
    !analysis.canDraftPrint ||
    (!analysis.canPose &&
      analysis.diagnostics.some((d) =>
        ["INPUT_INVALID", "LIMIT_EXCEEDED"].includes(d.code),
      ))
  )
    return { ok: false, diagnostics: analysis.diagnostics };
  if (
    !options ||
    !["draft", "fabrication"].includes(options.purpose) ||
    !options.sheet ||
    ![
      options.sheet.width,
      options.sheet.height,
      options.sheet.margin,
      options.cuttingGap,
    ].every(Number.isFinite) ||
    options.sheet.width > 2000 ||
    options.sheet.height > 2000 ||
    options.sheet.width < 120 ||
    options.sheet.height < 70 ||
    options.sheet.margin < 0 ||
    options.cuttingGap <= 0 ||
    options.cuttingGap > 100 ||
    typeof options.allowQuarterTurn !== "boolean" ||
    !["reject", "tile-transfer-pattern"].includes(options.oversize)
  )
    return { ok: false, diagnostics: [diag("PRINT_SCALE")] };
  if (options.purpose === "fabrication" && !analysis.canFinalPrint)
    return {
      ok: false,
      diagnostics: [...analysis.diagnostics, diag("PRINT_BLOCKED")],
    };
  const { width, height, margin } = options.sheet,
    footerHeight = 14;
  const content: Box2 = {
    min: [margin, margin + footerHeight],
    max: [width - margin, height - margin],
  };
  const cw = content.max[0] - content.min[0],
    ch = content.max[1] - content.min[1];
  if (cw < 100 || ch < 20)
    return {
      ok: false,
      diagnostics: [
        diag("PRINT_SCALE", [], { usableWidth: cw, usableHeight: ch }),
      ],
    };
  const pieces = makePieces(project),
    pages: PrintPlan["pages"][number][] = [],
    placements: PrintPlacement[] = [];
  const tooSmall = pieces
    .flatMap((p) => p.labels)
    .find(
      (l) =>
        l.box.max[0] - l.box.min[0] < 2.7 || l.box.max[1] - l.box.min[1] < 2.7,
    );
  if (tooSmall)
    return {
      ok: false,
      diagnostics: [
        ...analysis.diagnostics,
        diag(
          "PRINT_LABEL_SPACE",
          [],
          {
            labelWidth: tooSmall.box.max[0] - tooSmall.box.min[0],
            labelHeight: tooSmall.box.max[1] - tooSmall.box.min[1],
          },
          ["final-print"],
          "label-" + tooSmall.id,
        ),
      ],
    };
  let pageIndex = -1,
    x = content.min[0],
    y = content.min[1],
    rowHeight = 0;
  const page = (transferOnly = false) => {
    pageIndex = pages.length;
    pages.push({
      index: pageIndex,
      width,
      height,
      margin,
      contentBounds: content,
      footerHeight,
      transferOnly,
    });
    x = content.min[0];
    y = content.min[1];
    rowHeight = 0;
  };
  for (const piece of pieces) {
    const available = [0, ...(options.allowQuarterTurn ? [90] : [])] as (
      | 0
      | 90
    )[];
    const candidates = available.map((rotation) => {
      const b = bounds2(
        rect(
          piece.layoutBounds.min[0],
          piece.layoutBounds.min[1],
          piece.layoutBounds.max[0],
          piece.layoutBounds.max[1],
        ).map((p) => rotate2(p, rotation)),
      );
      return { rotation, b, w: b.max[0] - b.min[0], h: b.max[1] - b.min[1] };
    });
    const orientation = candidates.find(
      (c) => c.w <= cw + EPS && c.h <= ch + EPS,
    );
    if (!orientation) {
      if (options.oversize === "reject")
        return {
          ok: false,
          diagnostics: [
            ...analysis.diagnostics,
            diag(
              "PRINT_PIECE_TOO_LARGE",
              [],
              {
                pieceWidth:
                  piece.layoutBounds.max[0] - piece.layoutBounds.min[0],
                pieceHeight:
                  piece.layoutBounds.max[1] - piece.layoutBounds.min[1],
                availableWidth: cw,
                availableHeight: ch,
              },
              ["final-print"],
              "piece-" + piece.id,
            ),
          ],
        };
      const overlap = 10,
        b = piece.layoutBounds,
        ww = b.max[0] - b.min[0],
        hh = b.max[1] - b.min[1],
        cols = Math.max(1, Math.ceil((ww - overlap) / (cw - overlap))),
        rows = Math.max(1, Math.ceil((hh - overlap) / (ch - overlap)));
      if (
        cw <= overlap ||
        ch <= overlap ||
        cols * rows > 64 ||
        pages.length + cols * rows > 128
      )
        return {
          ok: false,
          diagnostics: [
            diag(
              "LIMIT_EXCEEDED",
              [],
              { pageCount: cols * rows },
              ["final-print"],
              "tile-count",
            ),
          ],
        };
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          page(true);
          const sx = b.min[0] + col * (cw - overlap),
            sy = b.min[1] + row * (ch - overlap);
          const clip: Box2 = {
            min: [sx, sy],
            max: [Math.min(sx + cw, b.max[0]), Math.min(sy + ch, b.max[1])],
          };
          const registration: Vec2[] = [];
          if (col > 0) {
            registration.push([
              sx + overlap / 2,
              sy + Math.min(8, (clip.max[1] - sy) / 3),
            ]);
            registration.push([
              sx + overlap / 2,
              clip.max[1] - Math.min(8, (clip.max[1] - sy) / 3),
            ]);
          }
          if (col < cols - 1) {
            registration.push([
              sx + cw - overlap / 2,
              sy + Math.min(8, (clip.max[1] - sy) / 3),
            ]);
            registration.push([
              sx + cw - overlap / 2,
              clip.max[1] - Math.min(8, (clip.max[1] - sy) / 3),
            ]);
          }
          if (row > 0) {
            registration.push([
              sx + Math.min(8, (clip.max[0] - sx) / 3),
              sy + overlap / 2,
            ]);
            registration.push([
              clip.max[0] - Math.min(8, (clip.max[0] - sx) / 3),
              sy + overlap / 2,
            ]);
          }
          if (row < rows - 1) {
            registration.push([
              sx + Math.min(8, (clip.max[0] - sx) / 3),
              sy + ch - overlap / 2,
            ]);
            registration.push([
              clip.max[0] - Math.min(8, (clip.max[0] - sx) / 3),
              sy + ch - overlap / 2,
            ]);
          }
          placements.push({
            pieceId: piece.id,
            pageIndex,
            rotationDeg: 0,
            translation: [content.min[0] - sx, content.min[1] - sy],
            clip,
            tile: {
              row,
              column: col,
              rows,
              columns: cols,
              overlapMm: overlap,
              registration,
            },
          });
        }
      pageIndex = -1;
      continue;
    }
    if (pageIndex < 0) page();
    if (x + orientation.w > content.max[0] + EPS) {
      x = content.min[0];
      y += rowHeight + options.cuttingGap;
      rowHeight = 0;
    }
    if (y + orientation.h > content.max[1] + EPS) page();
    placements.push({
      pieceId: piece.id,
      pageIndex,
      rotationDeg: orientation.rotation,
      translation: [x - orientation.b.min[0], y - orientation.b.min[1]],
    });
    x += orientation.w + options.cuttingGap;
    rowHeight = Math.max(rowHeight, orientation.h);
  }
  const assembly: PrintPlan["assembly"][number][] = [
    { id: "calibrate", messageKey: "print.calibrate", entityIds: ["base"] },
    { id: "base-cut", messageKey: "base.cut", entityIds: ["base"] },
    { id: "base-score", messageKey: "base.score", entityIds: ["base"] },
  ];
  for (const m of project.modules) {
    const keys =
      m.kind === "P" ? ["p.cut", "p.score"] : ["v.cut", "v.score", "v.glue"];
    for (const key of keys)
      assembly.push({
        id: `${m.id}:${key}`,
        messageKey: key,
        entityIds: [
          m.id,
          `${m.id}:ridge`,
          ...(m.kind === "P"
            ? [`${m.id}:slit:0`, `${m.id}:slit:1`]
            : [
                `${m.id}:tab:left`,
                `${m.id}:tab:right`,
                `${m.id}:glue:left`,
                `${m.id}:glue:right`,
              ]),
        ],
      });
  }
  assembly.push(
    {
      id: "close",
      messageKey: "assembly.close",
      entityIds: project.modules.map((m) => m.id),
    },
    {
      id: "test",
      messageKey: "assembly.test",
      entityIds: project.modules.map((m) => m.id),
    },
  );
  return {
    ok: true,
    value: {
      units: "mm",
      purpose: options.purpose,
      pieces,
      placements,
      pages,
      assembly,
      certificate: analysis.certificate,
      diagnostics: analysis.diagnostics,
    },
    diagnostics: analysis.diagnostics,
  };
}
