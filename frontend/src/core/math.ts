import type {
  Box2,
  Mechanism,
  ModuleBounds,
  Project,
  Vec2,
  Vec3,
  VModule,
} from "./types";
import { add2, add3, bounds2, mul2, mul3, RAD, rect } from "./shared";
export function vDomain(m: VModule): boolean {
  const p = m.params;
  return (
    p.betaDeg >= 20 &&
    p.betaDeg <= 45 &&
    p.gammaDeg >= p.betaDeg + 15 &&
    p.gammaDeg <= 90
  );
}
export function tabValid(m: VModule): boolean {
  return m.params.tabInset * 2 < m.params.r;
}
export function tabPolygon(
  angleDeg: number,
  r: number,
  g: number,
  t: number,
  side: "left" | "right",
): Vec2[] {
  const a = angleDeg * RAD,
    sign = side === "left" ? -1 : 1;
  const v: Vec2 = [sign * Math.sin(a), Math.cos(a)],
    n: Vec2 = [sign * Math.cos(a), -Math.sin(a)];
  return [
    mul2(v, g),
    mul2(v, r - g),
    add2(mul2(v, r - g), mul2(n, t)),
    add2(mul2(v, g), mul2(n, t)),
  ];
}
export function vNet(m: VModule) {
  const { r, h, gammaDeg, tabInset: g, tabWidth: t } = m.params,
    a = gammaDeg * RAD;
  return {
    o: [0, 0] as Vec2,
    l: [-r * Math.sin(a), r * Math.cos(a)] as Vec2,
    r: [r * Math.sin(a), r * Math.cos(a)] as Vec2,
    c: [0, h] as Vec2,
    leftTab: tabPolygon(gammaDeg, r, g, t, "left"),
    rightTab: tabPolygon(gammaDeg, r, g, t, "right"),
  };
}
export function localLane(m: Mechanism): readonly [number, number] {
  if (m.kind === "P") return [0, m.params.width];
  const p = m.params,
    b = p.betaDeg * RAD,
    g = p.gammaDeg * RAD;
  return [
    Math.min(
      0,
      p.h * Math.cos(b + g),
      p.tabInset * Math.cos(b) - p.tabWidth * Math.sin(b),
    ),
    Math.max(p.r * Math.cos(b), (p.h * Math.cos(g)) / Math.cos(b)),
  ];
}
export function moduleBounds(m: Mechanism): ModuleBounds {
  if (m.kind === "P") {
    const { a, b, width: w } = m.params;
    return {
      moduleId: m.id,
      sweptY: [m.y, m.y + w],
      closedAcrossMax: a + b,
      closedPanels: [
        { faceId: `${m.id}:p1`, polygon: rect(a, m.y, a + b, m.y + w) },
        { faceId: `${m.id}:p2`, polygon: rect(b, m.y, a + b, m.y + w) },
      ],
      tabFootprints: [],
    };
  }
  const p = m.params,
    b = p.betaDeg * RAD,
    g = p.gammaDeg * RAD,
    [lo, hi] = localLane(m);
  const triangle: Vec2[] = [
    [0, m.y],
    [p.r * Math.sin(b), m.y + p.r * Math.cos(b)],
    [p.h * Math.sin(b + g), m.y + p.h * Math.cos(b + g)],
  ];
  const tabs = (["left", "right"] as const).map((side) => ({
    id: `${m.id}:glue:${side}`,
    page: side,
    polygon: tabPolygon(p.betaDeg, p.r, p.tabInset, p.tabWidth, side).map(
      ([x, y]) => [Math.abs(x), y + m.y] as Vec2,
    ),
  }));
  return {
    moduleId: m.id,
    sweptY: [m.y + lo, m.y + hi],
    closedAcrossMax: Math.max(
      p.r * Math.sin(b),
      p.h * Math.sin(b + g),
      (p.r - p.tabInset) * Math.sin(b) + p.tabWidth * Math.cos(b),
    ),
    closedPanels: [
      { faceId: `${m.id}:left`, polygon: triangle },
      { faceId: `${m.id}:right`, polygon: triangle },
    ],
    tabFootprints: tabs,
  };
}
export function pagePoint(x: number, y: number, openingDeg: number): Vec3 {
  const q = (openingDeg * RAD) / 2;
  return [x * Math.sin(q), y, Math.abs(x) * Math.cos(q)];
}
export function vAxes(m: VModule, openingDeg: number) {
  const q = (openingDeg * RAD) / 2,
    p = m.params,
    s = Math.sin(p.betaDeg * RAD),
    A = Math.cos(p.betaDeg * RAD),
    B = s * Math.cos(q),
    K = Math.cos(p.gammaDeg * RAD),
    R = A * A + B * B,
    D = Math.sqrt(R - K * K);
  return {
    left: [-s * Math.sin(q), A, B] as Vec3,
    right: [s * Math.sin(q), A, B] as Vec3,
    ridge: [0, (A * K - B * D) / R, (B * K + A * D) / R] as Vec3,
  };
}
export function insertPoint(
  m: VModule,
  p: Vec2,
  region: "left" | "right" | "tab-left" | "tab-right",
  openingDeg: number,
): Vec3 {
  const a = m.params.gammaDeg * RAD;
  if (region === "tab-left" || region === "tab-right") {
    const side = region === "tab-left" ? -1 : 1,
      b = m.params.betaDeg * RAD;
    const along = p[0] * side * Math.sin(a) + p[1] * Math.cos(a),
      out = p[0] * side * Math.cos(a) - p[1] * Math.sin(a);
    return pagePoint(
      side * (along * Math.sin(b) + out * Math.cos(b)),
      m.y + along * Math.cos(b) - out * Math.sin(b),
      openingDeg,
    );
  }
  const ax = vAxes(m, openingDeg),
    along = (region === "left" ? -p[0] : p[0]) / Math.sin(a),
    ridge = p[1] - along * Math.cos(a);
  return add3(
    [0, m.y, 0],
    add3(mul3(ax[region], along), mul3(ax.ridge, ridge)),
  );
}
export function baseFaces(project: Project): { id: string; polygon: Vec2[] }[] {
  const steps = project.modules.filter((m) => m.kind === "P");
  const ys = [
    ...new Set([
      0,
      project.card.H,
      ...steps.flatMap((m) => [m.y, m.y + m.params.width]),
    ]),
  ].sort((a, b) => a - b);
  const faces: { id: string; polygon: Vec2[] }[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i]!,
      y1 = ys[i + 1]!;
    if (y1 - y0 < 1e-10) continue;
    const p = steps.find(
      (m) => m.y < (y0 + y1) / 2 && m.y + m.params.width > (y0 + y1) / 2,
    );
    faces.push(
      {
        id: `base:left:${i}`,
        polygon: rect(-project.card.W, y0, -(p?.params.a ?? 0), y1),
      },
      {
        id: `base:right:${i}`,
        polygon: rect(p?.params.b ?? 0, y0, project.card.W, y1),
      },
    );
  }
  return faces;
}
export function vPrintBounds(m: VModule): Box2 {
  const n = vNet(m);
  return bounds2([n.o, n.l, n.r, n.c, ...n.leftTab, ...n.rightTab]);
}
