import type {
  Edge3D,
  Panel3D,
  Project,
  Result,
  Scene,
  Vec2,
  Vec3,
  VModule,
} from "./types";
import { ALL, area2, diag, RAD, rect } from "./shared";
import { analyzeProject } from "./analysis";
import { baseFaces, insertPoint, pagePoint, vNet } from "./math";
export function poseProject(
  project: Project,
  openingDeg: number,
): Result<Scene> {
  const a = analyzeProject(project);
  if (!a.canPose) return { ok: false, diagnostics: a.diagnostics };
  if (!Number.isFinite(openingDeg) || openingDeg < 0 || openingDeg > 180)
    return {
      ok: false,
      diagnostics: [diag("INPUT_INVALID", [], {}, ALL, "opening-angle")],
    };
  const panels: Panel3D[] = [],
    edges: Edge3D[] = [];
  const panel = (
    id: string,
    pieceId: string,
    polygon: readonly Vec2[],
    map: (p: Vec2) => Vec3,
    role: Panel3D["role"],
    color: string,
    moduleId?: string,
  ) => {
    const pp = area2(polygon) < 0 ? [...polygon].reverse() : polygon;
    panels.push({
      id,
      pieceId,
      ...(moduleId ? { moduleId } : {}),
      role,
      color,
      vertices: pp.map(map),
      triangles:
        pp.length === 3
          ? [[0, 1, 2]]
          : [
              [0, 1, 2],
              [0, 2, 3],
            ],
    });
  };
  const edge = (
    id: string,
    points: readonly [Vec3, Vec3],
    role: Edge3D["role"],
    moduleId?: string,
    printEdgeId?: string,
  ) =>
    edges.push({
      id,
      endpoints: points,
      role,
      ...(moduleId ? { moduleId } : {}),
      ...(printEdgeId ? { printEdgeId } : {}),
    });
  const base = (p: Vec2) => pagePoint(p[0], p[1], openingDeg);
  for (const f of baseFaces(project))
    panel(f.id, "base", f.polygon, base, "base", project.card.color);
  const W = project.card.W,
    H = project.card.H;
  const outline = rect(-W, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const p = outline[i]!,
      q = outline[(i + 1) % 4]!;
    if (p[1] === q[1]) {
      const mid: Vec2 = [0, p[1]];
      edge(`base:border:${i}:left`, [base(p), base(mid)], "boundary");
      edge(`base:border:${i}:right`, [base(mid), base(q)], "boundary");
    } else edge(`base:border:${i}`, [base(p), base(q)], "boundary");
  }
  const steps = project.modules
    .filter((m) => m.kind === "P")
    .sort((x, y) => x.y - y.y);
  let y = 0;
  for (const m of steps) {
    if (m.y > y)
      edge(
        `base:gutter:${y}`,
        [base([0, y]), base([0, m.y])],
        "valley",
        undefined,
        `base:gutter:${y}`,
      );
    y = m.y + m.params.width;
  }
  if (y < H)
    edge(
      `base:gutter:${y}`,
      [base([0, y]), base([0, H])],
      "valley",
      undefined,
      `base:gutter:${y}`,
    );
  for (const m of project.modules) {
    if (m.kind === "P") {
      const { a, b, width: w } = m.params,
        y0 = m.y,
        y1 = y0 + w,
        q = (openingDeg * RAD) / 2;
      const u: Vec3 = [-Math.sin(q), 0, Math.cos(q)],
        v: Vec3 = [Math.sin(q), 0, Math.cos(q)];
      const p1 = ([x, yy]: Vec2): Vec3 => [
        a * u[0] + (x + a) * v[0],
        yy,
        a * u[2] + (x + a) * v[2],
      ];
      const p2 = ([x, yy]: Vec2): Vec3 => [
        (b - x) * u[0] + b * v[0],
        yy,
        (b - x) * u[2] + b * v[2],
      ];
      panel(
        `${m.id}:p1`,
        "base",
        rect(-a, y0, b - a, y1),
        p1,
        "moving",
        m.color,
        m.id,
      );
      panel(
        `${m.id}:p2`,
        "base",
        rect(b - a, y0, b, y1),
        p2,
        "moving",
        m.color,
        m.id,
      );
      for (const [i, yy] of [y0, y1].entries()) {
        edge(
          `${m.id}:slit:${i}:base-left`,
          [base([-a, yy]), base([0, yy])],
          "cut",
          m.id,
          `${m.id}:slit:${i}`,
        );
        edge(
          `${m.id}:slit:${i}:base-right`,
          [base([0, yy]), base([b, yy])],
          "cut",
          m.id,
          `${m.id}:slit:${i}`,
        );
        edge(
          `${m.id}:slit:${i}:p1`,
          [p1([-a, yy]), p1([b - a, yy])],
          "cut",
          m.id,
          `${m.id}:slit:${i}`,
        );
        edge(
          `${m.id}:slit:${i}:p2`,
          [p2([b - a, yy]), p2([b, yy])],
          "cut",
          m.id,
          `${m.id}:slit:${i}`,
        );
      }
      edge(
        `${m.id}:hinge:left`,
        [p1([-a, y0]), p1([-a, y1])],
        "valley",
        m.id,
        `${m.id}:hinge:left`,
      );
      edge(
        `${m.id}:ridge`,
        [p1([b - a, y0]), p1([b - a, y1])],
        "mountain",
        m.id,
        `${m.id}:ridge`,
      );
      edge(
        `${m.id}:hinge:right`,
        [p2([b, y0]), p2([b, y1])],
        "valley",
        m.id,
        `${m.id}:hinge:right`,
      );
    } else {
      const n = vNet(m),
        piece = `insert:${m.id}`;
      panel(
        `${m.id}:left`,
        piece,
        [n.o, n.l, n.c],
        (p) => insertPoint(m, p, "left", openingDeg),
        "moving",
        m.color,
        m.id,
      );
      panel(
        `${m.id}:right`,
        piece,
        [n.o, n.r, n.c],
        (p) => insertPoint(m, p, "right", openingDeg),
        "moving",
        m.color,
        m.id,
      );
      for (const side of ["left", "right"] as const) {
        const tab = side === "left" ? n.leftTab : n.rightTab;
        panel(
          `${m.id}:tab:${side}`,
          piece,
          tab,
          (p) => insertPoint(m, p, `tab-${side}`, openingDeg),
          "tab",
          m.color,
          m.id,
        );
        edge(
          `${m.id}:hinge:${side}`,
          [
            insertPoint(m, tab[0]!, side, openingDeg),
            insertPoint(m, tab[1]!, side, openingDeg),
          ],
          "valley",
          m.id,
          `${m.id}:hinge:${side}`,
        );
      }
      edge(
        `${m.id}:ridge`,
        [
          insertPoint(m, n.o, "left", openingDeg),
          insertPoint(m, n.c, "left", openingDeg),
        ],
        "mountain",
        m.id,
        `${m.id}:ridge`,
      );
      for (const seg of vPerimeter(m))
        edge(
          seg.id,
          [
            insertPoint(m, seg.points[0], seg.region, openingDeg),
            insertPoint(m, seg.points[1], seg.region, openingDeg),
          ],
          "cut",
          m.id,
          seg.id,
        );
    }
  }
  const pts = panels.flatMap((p) => p.vertices);
  if (pts.some((p) => p.some((x) => !Number.isFinite(x))))
    return {
      ok: false,
      diagnostics: [
        diag("POSE_UNAVAILABLE", [], {}, ALL, "nonfinite-derived-geometry"),
      ],
    };
  return {
    ok: true,
    value: {
      openingDeg,
      panels,
      edges,
      bounds: {
        min: [
          Math.min(...pts.map((p) => p[0])),
          Math.min(...pts.map((p) => p[1])),
          Math.min(...pts.map((p) => p[2])),
        ],
        max: [
          Math.max(...pts.map((p) => p[0])),
          Math.max(...pts.map((p) => p[1])),
          Math.max(...pts.map((p) => p[2])),
        ],
      },
      coincidentEndpoint: openingDeg === 0 || openingDeg === 180,
      geometricCertificate: a.certificate,
    },
    diagnostics: a.diagnostics,
  };
}
export function vPerimeter(m: VModule): {
  id: string;
  points: readonly [Vec2, Vec2];
  region: "left" | "right" | "tab-left" | "tab-right";
}[] {
  const n = vNet(m),
    l = n.leftTab,
    r = n.rightTab;
  const p: readonly [
    Vec2,
    Vec2,
    "left" | "right" | "tab-left" | "tab-right",
  ][] = [
    [n.o, l[0]!, "left"],
    [l[0]!, l[3]!, "tab-left"],
    [l[3]!, l[2]!, "tab-left"],
    [l[2]!, l[1]!, "tab-left"],
    [l[1]!, n.l, "left"],
    [n.l, n.c, "left"],
    [n.c, n.r, "right"],
    [n.r, r[1]!, "right"],
    [r[1]!, r[2]!, "tab-right"],
    [r[2]!, r[3]!, "tab-right"],
    [r[3]!, r[0]!, "tab-right"],
    [r[0]!, n.o, "right"],
  ];
  return p.map(([a, b, region], i) => ({
    id: `${m.id}:perimeter:${i}`,
    points: [a, b],
    region,
  }));
}
