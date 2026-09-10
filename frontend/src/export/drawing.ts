import { analyzeProject, parseProject } from "../core/index";
import type {
  Box2,
  PrintPiece,
  PrintPlacement,
  PrintPlan,
  Project,
  Vec2,
} from "../core/types";
import { makeAssemblySteps } from "./assembly";
import { fail, validateGlyphs, wrapText, type FontTools } from "./font";
import type { ExportOptions } from "./types";

export interface PathInk {
  kind: "path";
  id: string;
  layer: string;
  points: readonly Vec2[];
  closed: boolean;
  stroke: string;
  fill?: string;
  width: number;
  dash?: readonly number[];
  clip?: Box2;
}
export interface TextInk {
  kind: "text";
  id: string;
  layer: string;
  text: string;
  position: Vec2;
  size: number;
  rotation: 0 | 90;
  clip?: Box2;
}
export type Ink = PathInk | TextInk;
export interface DrawingPage {
  id: string;
  kind: "overview" | "assembly" | "pattern";
  width: number;
  height: number;
  ink: Ink[];
  metadata: Readonly<Record<string, unknown>>;
}
const corners = (b: Box2): Vec2[] => [
  b.min,
  [b.max[0], b.min[1]],
  b.max,
  [b.min[0], b.max[1]],
];
export function placed(
  point: Vec2,
  p: Pick<PrintPlacement, "translation" | "rotationDeg">,
): Vec2 {
  return p.rotationDeg === 90
    ? [p.translation[0] - point[1], p.translation[1] + point[0]]
    : [p.translation[0] + point[0], p.translation[1] + point[1]];
}
const globalBox = (box: Box2, p: PrintPlacement): Box2 => {
  const points = corners(box).map((v) => placed(v, p));
  return {
    min: [
      Math.min(...points.map((v) => v[0])),
      Math.min(...points.map((v) => v[1])),
    ],
    max: [
      Math.max(...points.map((v) => v[0])),
      Math.max(...points.map((v) => v[1])),
    ],
  };
};
const finitePoint = (v: Vec2) =>
  Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
const boxValid = (b: Box2) =>
  b &&
  finitePoint(b.min) &&
  finitePoint(b.max) &&
  b.max[0] > b.min[0] &&
  b.max[1] > b.min[1];
const inside = (a: Box2, b: Box2) =>
  a.min[0] >= b.min[0] - 1e-7 &&
  a.min[1] >= b.min[1] - 1e-7 &&
  a.max[0] <= b.max[0] + 1e-7 &&
  a.max[1] <= b.max[1] + 1e-7;

/** Validate the export boundary; geometry remains entirely engine-authored. */
export function validatePlan(project: Project, plan: PrintPlan): void {
  const parsed = parseProject(project);
  if (!parsed.ok)
    fail(
      "PROJECT_INVALID",
      "The editable project is malformed. No pattern was exported.",
    );
  const analysis = analyzeProject(project);
  if (
    !plan ||
    plan.units !== "mm" ||
    !["draft", "fabrication"].includes(plan.purpose) ||
    !Array.isArray(plan.pages) ||
    !plan.pages.length ||
    plan.pages.length > 256
  )
    fail(
      "PRINT_PLAN_INVALID",
      "The print plan is missing valid millimetre pages.",
    );
  if (
    plan.purpose === "fabrication" &&
    (!analysis.canFinalPrint || plan.certificate !== "pass")
  )
    fail(
      "FABRICATION_BLOCKED",
      "Final fabrication is blocked by the geometric checks. Export a labelled draft or resolve the checks first.",
    );
  if (plan.certificate !== analysis.certificate)
    fail(
      "PRINT_CERTIFICATE_MISMATCH",
      "The print plan's certificate no longer matches the editable project. Rebuild the print plan before exporting.",
    );
  if (!analysis.canDraftPrint)
    fail("DRAFT_BLOCKED", "The project has no valid two-dimensional draft.");
  const ids = new Set(plan.pieces.map((p) => p.id));
  if (ids.size !== plan.pieces.length)
    fail("PRINT_PLAN_INVALID", "Duplicate piece identifiers.");
  for (const page of plan.pages) {
    if (
      ![page.width, page.height, page.margin, page.footerHeight].every(
        Number.isFinite,
      ) ||
      page.width < 130 ||
      page.height < 100 ||
      page.width > 2000 ||
      page.height > 2000 ||
      page.margin < 0 ||
      page.footerHeight < 14 ||
      !boxValid(page.contentBounds)
    )
      fail(
        "PRINT_PAGE_INVALID",
        "A page cannot carry a legible calibrated pattern footer at its declared size.",
      );
    if (
      !inside(page.contentBounds, {
        min: [page.margin, page.margin + page.footerHeight],
        max: [page.width - page.margin, page.height - page.margin],
      })
    )
      fail(
        "PRINT_MARGIN",
        "The content rectangle leaves the printable page margins.",
      );
  }
  for (const piece of plan.pieces) {
    if (
      !boxValid(piece.layoutBounds) ||
      !boxValid(piece.cutBounds) ||
      !inside(piece.cutBounds, piece.layoutBounds)
    )
      fail("PRINT_BOUNDS", "Piece or label bounds are invalid.", [piece.id]);
    for (const line of piece.lines)
      if (
        !["cut", "mountain", "valley"].includes(line.assignment) ||
        line.points.length !== 2 ||
        !line.points.every(finitePoint)
      )
        fail(
          "PRINT_LINE_INVALID",
          "An invalid cut or score line was rejected.",
          [line.id],
        );
    for (const face of piece.faces)
      if (
        face.polygon.length < 3 ||
        !face.polygon.every(finitePoint) ||
        (face.holes !== undefined &&
          (!Array.isArray(face.holes) ||
            face.holes.length > 80 ||
            face.holes.some(
              (hole) =>
                !Array.isArray(hole) ||
                hole.length < 3 ||
                hole.length > 32 ||
                !hole.every(finitePoint),
            ))) ||
        !/^#[a-f\d]{6}$/iu.test(face.fill)
      )
        fail("PRINT_FACE_INVALID", "An invalid printed face was rejected.", [
          face.id,
        ]);
    for (const glue of piece.glue)
      if (glue.polygon.length < 3 || !glue.polygon.every(finitePoint))
        fail("PRINT_GLUE_INVALID", "An invalid glue footprint was rejected.", [
          glue.id,
        ]);
    for (const label of piece.labels)
      if (
        typeof label.text !== "string" ||
        !boxValid(label.box) ||
        !inside(label.box, piece.layoutBounds)
      )
        fail(
          "PRINT_LABEL_INVALID",
          "A label leaves the declared layout bounds.",
          [label.id],
        );
    if (!plan.placements.some((p) => p.pieceId === piece.id))
      fail("PRINT_PIECE_MISSING", "A piece is absent from the page layout.", [
        piece.id,
      ]);
  }
  for (const p of plan.placements) {
    const piece = plan.pieces.find((x) => x.id === p.pieceId),
      page = plan.pages.find((x) => x.index === p.pageIndex);
    if (
      !piece ||
      !page ||
      ![0, 90].includes(p.rotationDeg) ||
      !finitePoint(p.translation)
    )
      return fail(
        "PRINT_PLACEMENT_INVALID",
        "A placement references a missing piece or page.",
      );
    if (p.clip && (!p.tile || !page.transferOnly || !boxValid(p.clip)))
      fail(
        "PRINT_CLIP_INVALID",
        "Cropping is only permitted for labelled transfer-pattern tiles.",
        [p.pieceId],
      );
    if (!inside(globalBox(p.clip ?? piece.layoutBounds, p), page.contentBounds))
      fail(
        "PRINT_CLIPPING",
        "A complete piece or transfer tile leaves the declared printable area.",
        [p.pieceId],
      );
  }
}

function path(
  page: DrawingPage,
  id: string,
  points: readonly Vec2[],
  layer: string,
  options: Partial<PathInk> = {},
) {
  page.ink.push({
    kind: "path",
    id,
    points,
    layer,
    closed: false,
    stroke: "#161616",
    width: 0.25,
    ...options,
  });
}
function text(
  page: DrawingPage,
  tools: FontTools,
  id: string,
  content: string,
  box: Box2,
  size = 3,
  min = size,
  transform?: PrintPlacement,
  layer = "annotations",
) {
  validateGlyphs(content, tools, id);
  const width = box.max[0] - box.min[0],
    height = box.max[1] - box.min[1];
  let lines: string[] = [];
  while (size >= min - 1e-7) {
    lines = wrapText(content, width, size, tools);
    if (
      lines.length * size * 1.45 <= height + 1e-7 &&
      lines.every((l) => tools.font.widthOfTextAtSize(l, size) <= width + 1e-7)
    )
      break;
    size = Number((size - 0.1).toFixed(3));
  }
  if (size < min - 1e-7)
    fail(
      "LABEL_OVERFLOW",
      `Text does not fit its declared box: ${id}. Shorten this label or enlarge the project.`,
      [id],
    );
  for (const [i, line] of lines.entries()) {
    const local: Vec2 = [
      box.min[0],
      box.max[1] - size * 1.12 - i * size * 1.45,
    ];
    page.ink.push({
      kind: "text",
      id: `${id}:${i}`,
      layer,
      text: line,
      position: transform ? placed(local, transform) : local,
      size,
      rotation: transform?.rotationDeg ?? 0,
      ...(transform?.clip
        ? { clip: globalBox(transform.clip, transform) }
        : {}),
    });
  }
}
function pieceInk(
  page: DrawingPage,
  piece: PrintPiece,
  placement: PrintPlacement,
  tools: FontTools,
  monochrome: boolean,
) {
  const clip = placement.clip
    ? globalBox(placement.clip, placement)
    : undefined;
  for (const face of piece.faces) {
    path(
      page,
      face.id,
      face.polygon.map((v) => placed(v, placement)),
      "artwork",
      {
        closed: true,
        stroke: "#ffffff",
        width: 0,
        fill: monochrome ? "#ffffff" : face.fill,
        clip,
      },
    );
    for (const [index, hole] of (face.holes ?? []).entries())
      path(
        page,
        `${face.id}:void:${index}`,
        hole.map((v) => placed(v, placement)),
        "artwork",
        { closed: true, stroke: "#ffffff", width: 0, fill: "#ffffff", clip },
      );
  }
  for (const glue of piece.glue) {
    const points = glue.polygon.map((v) => placed(v, placement));
    path(page, glue.id, points, "glue", {
      closed: true,
      fill: "#eeeeee",
      stroke: "#777777",
      width: 0.16,
      dash: [0.5, 0.8],
      clip,
    });
    // Crossed diagonals signal glue without converting the footprint into a cut.
    path(page, glue.id + ":glue-cross-a", [points[0], points[2]], "glue", {
      stroke: "#999999",
      width: 0.12,
      clip,
    });
    if (points.length === 4)
      path(page, glue.id + ":glue-cross-b", [points[1], points[3]], "glue", {
        stroke: "#999999",
        width: 0.12,
        clip,
      });
  }
  for (const line of piece.lines)
    path(
      page,
      line.id,
      line.points.map((v) => placed(v, placement)),
      line.assignment,
      {
        width: line.assignment === "cut" ? 0.3 : 0.22,
        dash:
          line.assignment === "valley"
            ? [2.4, 1.2]
            : line.assignment === "mountain"
              ? [4, 1, 0.6, 1]
              : undefined,
        clip,
      },
    );
  for (const label of piece.labels)
    text(
      page,
      tools,
      label.id,
      label.text,
      label.box,
      2.8,
      1.8,
      placement,
      label.role === "decoration" ? "artwork-labels" : "annotations",
    );
  for (const [i, point] of (placement.tile?.registration ?? []).entries()) {
    const [x, y] = placed(point, placement);
    path(
      page,
      `${piece.id}:registration:${i}:h`,
      [
        [x - 1.5, y],
        [x + 1.5, y],
      ],
      "registration",
      { width: 0.15, stroke: "#666666" },
    );
    path(
      page,
      `${piece.id}:registration:${i}:v`,
      [
        [x, y - 1.5],
        [x, y + 1.5],
      ],
      "registration",
      { width: 0.15, stroke: "#666666" },
    );
  }
}

export function buildDrawings(
  project: Project,
  plan: PrintPlan,
  options: ExportOptions,
  tools: FontTools,
): DrawingPage[] {
  validatePlan(project, plan);
  const say = (en: string, es: string) => (options.lang === "es" ? es : en);
  const paper = plan.pages[0];
  const create = (
    id: string,
    kind: DrawingPage["kind"],
    width = paper.width,
    height = paper.height,
  ): DrawingPage => ({
    id,
    kind,
    width,
    height,
    ink: [],
    metadata: {
      schema: "plega-print/v1",
      units: "mm",
      purpose: plan.purpose,
      certificate: plan.certificate,
      kind,
      projectTitle: project.title,
    },
  });
  const pages: DrawingPage[] = [];
  const title = (p: DrawingPage, subtitle: string) => {
    text(
      p,
      tools,
      p.id + ":brand",
      "PLEGA / " + subtitle,
      { min: [12, p.height - 24], max: [p.width - 12, p.height - 12] },
      5,
      3,
    );
    text(
      p,
      tools,
      p.id + ":title",
      project.title,
      { min: [12, p.height - 38], max: [p.width - 12, p.height - 25] },
      3.6,
      2.7,
    );
  };
  const overview = create("overview", "overview");
  title(overview, say("Fabrication overview", "Vista general de fabricación"));
  text(
    overview,
    tools,
    "overview:status",
    `${plan.purpose === "draft" ? say("DRAFT - NOT APPROVED FOR FABRICATION", "BORRADOR - NO APROBADO PARA FABRICACIÓN") : say("1:1 PATTERNS - GEOMETRIC CHECKS PASSED", "PATRONES 1:1 - COMPROBACIONES GEOMÉTRICAS SUPERADAS")}\n${say("One continuous base plus", "Una base continua más")} ${project.modules.filter((m) => m.kind === "V").length} ${say("separate inserts.", "insertos separados.")} ${plan.pages.length} ${say("pattern sheets.", "hojas de patrón.")}`,
    {
      min: [12, overview.height - 61],
      max: [overview.width - 12, overview.height - 40],
    },
    3.1,
  );
  const mapHeight = Math.min(65, overview.height * 0.22),
    mapTop = overview.height - 65,
    columnWidth = (overview.width - 24) / Math.min(4, plan.pieces.length || 1);
  for (const [index, piece] of plan.pieces.entries()) {
    const x = 12 + (index % 4) * columnWidth,
      y = mapTop - Math.floor(index / 4) * (mapHeight + 10);
    const bw = piece.layoutBounds.max[0] - piece.layoutBounds.min[0],
      bh = piece.layoutBounds.max[1] - piece.layoutBounds.min[1];
    const scale = Math.min((columnWidth - 8) / bw, (mapHeight - 8) / bh);
    for (const line of piece.lines)
      path(
        overview,
        "overview:" + line.id,
        line.points.map(
          (v) =>
            [
              x + 4 + (v[0] - piece.layoutBounds.min[0]) * scale,
              y - mapHeight + 4 + (v[1] - piece.layoutBounds.min[1]) * scale,
            ] as Vec2,
        ),
        "overview-map",
        { width: 0.18, dash: line.assignment === "cut" ? undefined : [1, 0.8] },
      );
    text(
      overview,
      tools,
      "map-label:" + piece.id,
      piece.id,
      {
        min: [x, y - mapHeight - 8],
        max: [x + columnWidth - 3, y - mapHeight],
      },
      2.5,
      1.8,
    );
  }
  const mapBottom =
    mapTop - Math.ceil(plan.pieces.length / 4) * (mapHeight + 10);
  text(
    overview,
    tools,
    "map-warning",
    say(
      "REDUCED MAP ONLY. Cut from the numbered pattern sheets, never this overview.",
      "SOLO MAPA REDUCIDO. Corta con las hojas de patrón numeradas, nunca con esta vista general.",
    ),
    { min: [12, mapBottom - 15], max: [overview.width - 12, mapBottom - 2] },
    2.8,
  );
  const legendY = mapBottom - 24;
  const legend = [
    ["cut", say("CUT - solid", "CORTE - continua"), []],
    ["valley", say("VALLEY - dashed", "VALLE - discontinua"), [2.4, 1.2]],
    [
      "mountain",
      say("MOUNTAIN - dash-dot", "MONTAÑA - raya y punto"),
      [4, 1, 0.6, 1],
    ],
    [
      "glue",
      say("GLUE - pale crossed region", "PEGADO - zona clara cruzada"),
      [0.5, 0.8],
    ],
  ] as const;
  for (const [i, item] of legend.entries()) {
    const y = legendY - i * 7;
    path(
      overview,
      "legend:" + item[0],
      [
        [12, y],
        [30, y],
      ],
      "legend",
      { dash: item[2] },
    );
    text(
      overview,
      tools,
      "legend-text:" + item[0],
      item[1],
      { min: [34, y - 3], max: [overview.width - 12, y + 3] },
      2.6,
    );
  }
  text(
    overview,
    tools,
    "overview:limits",
    say(
      "Printed/front face: mountain rises toward you; valley folds away. The certificate covers only the documented zero-thickness mechanism and separated lanes. Paper thickness, adhesive, printer error and physical assembly are unverified.",
      "Cara impresa: la montaña sobresale hacia ti; el valle se hunde. El certificado solo cubre el mecanismo documentado sin espesor y sus carriles separados. Espesor, adhesivo, error de impresión y montaje físico no están verificados.",
    ),
    { min: [12, 12], max: [overview.width - 12, Math.max(34, legendY - 29)] },
    2.8,
    2.4,
  );
  pages.push(overview);
  const diagnoses = [
    ...new Map(
      [...plan.diagnostics, ...analyzeProject(project).diagnostics]
        .filter((d) => d.severity !== "info")
        .map((d) => [d.id, d]),
    ).values(),
  ];
  const guide = makeAssemblySteps(project, plan, options.lang);
  const sections = [
    ...(diagnoses.length
      ? [
          {
            id: "checks",
            title: say(
              "Checks requiring attention",
              "Comprobaciones que requieren atención",
            ),
            body: diagnoses
              .map(
                (d) =>
                  `${d.code}: ${d.message[options.lang]} ${d.numbers.map((n) => `${n.key}=${Number(n.value.toFixed(3))} ${n.unit}`).join("; ")}`,
              )
              .join("\n"),
          },
        ]
      : []),
    ...guide.map((s) => ({
      id: s.id,
      title: `${s.number}. ${s.title}`,
      body: s.body,
    })),
  ];
  const measuredSections = sections.map((section) => {
    const bodyLines = wrapText(section.body, paper.width - 28, 3, tools),
      titleLines = wrapText(section.title, paper.width - 28, 3.8, tools);
    const needed = bodyLines.length * 4.35 + titleLines.length * 5.51 + 10;
    if (needed > paper.height - 59)
      fail(
        "GUIDE_OVERFLOW",
        "The diagnosis is too long for a readable assembly page. Resolve some checks before exporting.",
        [section.id],
      );
    return { section, bodyLines, titleLines, needed };
  });
  // Keep complete steps together and balance the minimum feasible page count.
  const capacity = paper.height - 59;
  let count = 1,
    used = 0;
  for (const section of measuredSections) {
    if (used + section.needed > capacity) {
      count++;
      used = 0;
    }
    used += section.needed;
  }
  const target =
    measuredSections.reduce((sum, section) => sum + section.needed, 0) / count;
  const memo = new Map<string, { cost: number; ends: number[] }>();
  const split = (
    start: number,
    remaining: number,
  ): { cost: number; ends: number[] } => {
    if (!remaining)
      return {
        cost: start === measuredSections.length ? 0 : Infinity,
        ends: [],
      };
    const key = `${start}:${remaining}`,
      cached = memo.get(key);
    if (cached) return cached;
    let best = { cost: Infinity, ends: [] as number[] },
      height = 0;
    for (let end = start + 1; end <= measuredSections.length; end++) {
      height += measuredSections[end - 1].needed;
      if (height > capacity) break;
      const rest = split(end, remaining - 1),
        cost = (height - target) ** 2 + rest.cost;
      if (cost < best.cost) best = { cost, ends: [end, ...rest.ends] };
    }
    memo.set(key, best);
    return best;
  };
  let start = 0;
  for (const end of split(0, count).ends) {
    const sheet = create(
      `assembly-${pages.filter((p) => p.kind === "assembly").length + 1}`,
      "assembly",
    );
    title(sheet, say("Numbered assembly guide", "Guía de montaje numerada"));
    pages.push(sheet);
    let cursor = paper.height - 43;
    for (const { section, titleLines, bodyLines } of measuredSections.slice(
      start,
      end,
    )) {
      const titleHeight = titleLines.length * 5.51;
      text(
        sheet,
        tools,
        section.id + ":title",
        section.title,
        { min: [14, cursor - titleHeight], max: [paper.width - 14, cursor] },
        3.8,
      );
      cursor -= titleHeight + 3;
      text(
        sheet,
        tools,
        section.id + ":body",
        section.body,
        {
          min: [14, cursor - bodyLines.length * 4.35],
          max: [paper.width - 14, cursor],
        },
        3,
      );
      cursor -= bodyLines.length * 4.35 + 7;
    }
    start = end;
  }
  for (const page of plan.pages) {
    const drawing = create(
      `pattern-${page.index + 1}`,
      "pattern",
      page.width,
      page.height,
    );
    drawing.metadata = {
      ...drawing.metadata,
      pageIndex: page.index,
      transferOnly: page.transferOnly,
      placements: plan.placements.filter((p) => p.pageIndex === page.index),
    };
    for (const p of plan.placements.filter((p) => p.pageIndex === page.index))
      pieceInk(
        drawing,
        plan.pieces.find((x) => x.id === p.pieceId)!,
        p,
        tools,
        options.monochrome !== false,
      );
    const m = page.margin;
    path(
      drawing,
      "calibration:100mm",
      [
        [m, m + 6],
        [m + 100, m + 6],
      ],
      "calibration",
      { width: 0.2 },
    );
    for (let i = 0; i <= 100; i += 10)
      path(
        drawing,
        `calibration:tick:${i}`,
        [
          [m + i, m + 4.5],
          [m + i, m + 7.5],
        ],
        "calibration",
        { width: 0.18 },
      );
    text(
      drawing,
      tools,
      "calibration:label",
      say(
        "100 mm - print actual size / 100%",
        "100 mm - imprime a tamaño real / 100%",
      ),
      { min: [m, m], max: [m + 100, m + 4] },
      2.3,
    );
    path(
      drawing,
      "calibration:10mm-square",
      [
        [m + 105, m + 1],
        [m + 115, m + 1],
        [m + 115, m + 11],
        [m + 105, m + 11],
      ],
      "calibration",
      { closed: true, width: 0.2 },
    );
    const tiles = plan.placements
      .filter((p) => p.pageIndex === page.index && p.tile)
      .map(
        (p) =>
          `${p.pieceId} ${say("R", "F")}${p.tile!.row + 1}/${p.tile!.rows} C${p.tile!.column + 1}/${p.tile!.columns}`,
      )
      .join(" / ");
    const status =
      plan.purpose === "draft"
        ? say("DRAFT - see check list", "BORRADOR - consulta los fallos")
        : say("FABRICATION 1:1", "FABRICACIÓN 1:1");
    text(
      drawing,
      tools,
      "sheet-status",
      `${status}\n${page.transferOnly ? say("TRANSFER ONLY", "SOLO TRANSFERENCIA") : say("Continuous pieces", "Piezas continuas")}\n${say("Sheet", "Hoja")} ${page.index + 1}/${plan.pages.length}${tiles ? " · " + tiles : ""}`,
      { min: [m + 120, m], max: [page.width - m, m + 13.8] },
      2.4,
      1.8,
    );
    pages.push(drawing);
  }
  for (const [index, page] of pages.entries())
    if (page.kind !== "pattern")
      text(
        page,
        tools,
        "document:page",
        `PLEGA${plan.purpose === "draft" ? say(" · DRAFT", " · BORRADOR") : ""} · ${say("Document page", "Página del documento")} ${index + 1}/${pages.length}`,
        { min: [12, 5], max: [page.width - 12, 10] },
        2.4,
      );
  return pages;
}
