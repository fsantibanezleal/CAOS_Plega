import { ShapeUtils, Vector2 } from "three";
import type { Cutwork, Tri, Vec2 } from "./types";
import { area2, freeze } from "./shared";
const cache = new Map<string, CutPanel>();

export interface CutPanel {
  polygon: readonly Vec2[];
  holes: readonly (readonly Vec2[])[];
  vertices: readonly Vec2[];
  triangles: readonly Tri[];
  /** Additional physical cuts. The untrimmed outer edge is an offcut boundary. */
  cuts: readonly { id: string; points: readonly [Vec2, Vec2] }[];
}
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
export function pointInPolygon(p: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!,
      b = polygon[j]!;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function distanceToBoundary(p: Vec2, polygon: readonly Vec2[]): number {
  return Math.min(
    ...polygon.map((a, i) => {
      const b = polygon[(i + 1) % polygon.length]!,
        dx = b[0] - a[0],
        dy = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy),
        ),
      );
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }),
  );
}
export function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  const cross = (p: Vec2, q: Vec2, r: Vec2) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  if (
    cross(a, b, c) * cross(a, b, d) <= 0 &&
    cross(c, d, a) * cross(c, d, b) <= 0 &&
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
      Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
  )
    return 0;
  return Math.min(
    distanceToBoundary(a, [c, d]),
    distanceToBoundary(b, [c, d]),
    distanceToBoundary(c, [a, b]),
    distanceToBoundary(d, [a, b]),
  );
}
/** Original, bounded material-removal profiles. Parent hinges and poses stay authoritative. */
export function cutPanel(
  original: readonly Vec2[],
  cutwork?: Cutwork,
): CutPanel {
  const key = cutwork ? JSON.stringify([original, cutwork]) : "";
  if (key && cache.has(key)) return cache.get(key)!;
  let polygon = [...original];
  const holes: Vec2[][] = [],
    cuts: { id: string; points: readonly [Vec2, Vec2] }[] = [];
  if (cutwork) {
    const { pattern, detail, web } = cutwork;
    // The only trimmed edge is the free edge of a triangular insert. Both hinge
    // segments remain exact. Every new point is a convex combination in its parent.
    if (original.length === 3 && (pattern === "leaf" || pattern === "wing")) {
      const [o, a, b] = original as readonly [Vec2, Vec2, Vec2];
      const edge: Vec2[] = [a];
      const segments = 24;
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const depth =
          Math.sin(Math.PI * t) *
          (pattern === "leaf"
            ? 0.24 + 0.06 * Math.sin(t * Math.PI * detail * 2) ** 2
            : 0.14 + 0.2 * Math.sin(t * Math.PI * (detail + 1)) ** 2);
        edge.push(lerp(lerp(a, b, t), o, depth));
      }
      edge.push(b);
      polygon = [o, ...edge];
      edge
        .slice(0, -1)
        .forEach((p, i) =>
          cuts.push({ id: `trim:${i}`, points: [p, edge[i + 1]!] }),
        );
    }
    const xs = polygon.map((p) => p[0]),
      ys = polygon.map((p) => p[1]);
    const x0 = Math.min(...xs),
      y0 = Math.min(...ys),
      width = Math.max(...xs) - x0,
      height = Math.max(...ys) - y0;
    // Grid cells are disjoint, with at least 2*web between their cutout boxes.
    // Detail increases density; impossible apertures are omitted, never clipped
    // across a hinge. Narrow faces correctly retain their full material.
    const cols = Math.min(8, detail + 1),
      rows = Math.min(
        10,
        Math.max(2, Math.round((cols * height) / Math.max(width, 1))),
      );
    const cw = width / cols,
      ch = height / rows;
    if (cw > 2 * web + 2 && ch > 2 * web + 2) {
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const cx = x0 + (col + 0.5) * cw,
            cy = y0 + (row + 0.5) * ch;
          const rx = (cw - 2 * web) / 2,
            ry = (ch - 2 * web) / 2;
          let hole: Vec2[];
          if (pattern === "arcade") {
            hole = [
              [cx - rx, cy + ry],
              [cx + rx, cy + ry],
              [cx + rx, cy],
            ];
            for (let i = 1; i <= 12; i++)
              hole.push([
                cx + rx * Math.cos((i * Math.PI) / 12),
                cy - ry * Math.sin((i * Math.PI) / 12),
              ]);
          } else if (pattern === "lattice") {
            hole = [
              [cx, cy - ry],
              [cx + rx, cy],
              [cx, cy + ry],
              [cx - rx, cy],
            ];
          } else {
            const skew = pattern === "leaf" ? rx * 0.25 : 0;
            hole = Array.from({ length: 16 }, (_, i) => {
              const a = (2 * Math.PI * i) / 16;
              return [
                cx + rx * 0.75 * Math.cos(a) + skew * Math.sin(a),
                cy + ry * Math.sin(a),
              ] as Vec2;
            });
          }
          // Exact segment distances protect the web along every edge, including
          // concave wing notches. Disjoint boxes protect the web between holes.
          if (
            hole.every(
              (p, i) =>
                pointInPolygon(p, polygon) &&
                polygon.every(
                  (a, j) =>
                    segmentDistance(
                      p,
                      hole[(i + 1) % hole.length]!,
                      a,
                      polygon[(j + 1) % polygon.length]!,
                    ) >=
                    web - 1e-8,
                ),
            )
          )
            holes.push(hole);
        }
    }
    holes.forEach((hole, j) =>
      hole.forEach((p, i) =>
        cuts.push({
          id: `aperture:${j}:${i}`,
          points: [p, hole[(i + 1) % hole.length]!],
        }),
      ),
    );
  }
  if (area2(polygon) < 0) polygon.reverse();
  const vertices = [...polygon, ...holes.flat()];
  const triangles = ShapeUtils.triangulateShape(
    polygon.map((p) => new Vector2(...p)),
    holes.map((h) => h.map((p) => new Vector2(...p))),
  ) as unknown as Tri[];
  const result = freeze({ polygon, holes, vertices, triangles, cuts });
  if (key) {
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
  }
  return result;
}

export function cutworkStats(panels: readonly CutPanel[]) {
  const area = (p: readonly Vec2[]) => Math.abs(area2(p)) / 2;
  return {
    apertures: panels.reduce((n, p) => n + p.holes.length, 0),
    removedArea: panels.reduce(
      (n, p) => n + p.holes.reduce((s, h) => s + area(h), 0),
      0,
    ),
  };
}
