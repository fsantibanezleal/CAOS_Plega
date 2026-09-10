import type { FoldDocument, Project, Result, Vec2 } from "./types";
import { analyzeProject } from "./analysis";
import { makePieces } from "./print";
import { diag, EPS } from "./shared";
type Segment = { a: Vec2; b: Vec2; assignment: string; ts: number[] };
const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
function pointT(p: Vec2, s: Segment): number | null {
  const d = sub(s.b, s.a),
    v = sub(p, s.a),
    dd = d[0] ** 2 + d[1] ** 2;
  if (dd === 0) return null;
  const t = (v[0] * d[0] + v[1] * d[1]) / dd;
  return Math.abs(cross(v, d)) <= EPS * Math.sqrt(dd) &&
    t >= -EPS &&
    t <= 1 + EPS
    ? Math.max(0, Math.min(1, t))
    : null;
}
function splitCrossings(segments: Segment[]) {
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!,
        b = segments[j]!,
        r = sub(a.b, a.a),
        s = sub(b.b, b.a),
        den = cross(r, s),
        q = sub(b.a, a.a);
      if (
        Math.max(a.a[0], a.b[0]) < Math.min(b.a[0], b.b[0]) - EPS ||
        Math.max(b.a[0], b.b[0]) < Math.min(a.a[0], a.b[0]) - EPS ||
        Math.max(a.a[1], a.b[1]) < Math.min(b.a[1], b.b[1]) - EPS ||
        Math.max(b.a[1], b.b[1]) < Math.min(a.a[1], a.b[1]) - EPS
      )
        continue;
      if (Math.abs(den) > EPS) {
        const t = cross(q, s) / den,
          u = cross(q, r) / den;
        if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) {
          a.ts.push(Math.max(0, Math.min(1, t)));
          b.ts.push(Math.max(0, Math.min(1, u)));
        }
      } else {
        for (const p of [a.a, a.b]) {
          const t = pointT(p, b);
          if (t !== null) b.ts.push(t);
        }
        for (const p of [b.a, b.b]) {
          const t = pointT(p, a);
          if (t !== null) a.ts.push(t);
        }
      }
    }
}
export function makeFoldDocuments(
  project: Project,
): Result<readonly FoldDocument[]> {
  const analysis = analyzeProject(project);
  if (!analysis.canFoldExport)
    return {
      ok: false,
      diagnostics: [...analysis.diagnostics, diag("FOLD_UNSUPPORTED")],
    };
  const pieces = makePieces(project),
    docs: FoldDocument[] = [],
    frames: Record<string, unknown>[] = [];
  if (
    pieces.some((p) => p.lines.length > 5000) ||
    pieces.reduce((n, p) => n + p.lines.length, 0) > 12000
  )
    return {
      ok: false,
      diagnostics: [
        diag("FOLD_DENSITY", [], {}, ["fold-export"], "cut-graph-budget"),
      ],
    };
  for (const p of pieces) {
    const segments: Segment[] = p.lines.map((l) => ({
      a: l.points[0],
      b: l.points[1],
      assignment:
        l.assignment === "mountain"
          ? "M"
          : l.assignment === "valley"
            ? "V"
            : p.id === "base" && !l.id.startsWith("base:border")
              ? "C"
              : "B",
      ts: [0, 1],
    }));
    splitCrossings(segments);
    const vertices: Vec2[] = [],
      edges: number[][] = [],
      assignments: string[] = [],
      vertexMap = new Map<string, number>(),
      edgeMap = new Map<string, string>();
    const vertex = (v: Vec2) => {
      const key = v.map((x) => Math.round(x * 1e8)).join(",");
      const old = vertexMap.get(key);
      if (old !== undefined) return old;
      const i = vertices.length;
      vertices.push(v);
      vertexMap.set(key, i);
      return i;
    };
    for (const s of segments) {
      const ts = [
        ...new Set(s.ts.map((t) => Math.round(t * 1e12) / 1e12)),
      ].sort((a, b) => a - b);
      for (let i = 0; i < ts.length - 1; i++) {
        const t = ts[i]!,
          u = ts[i + 1]!;
        if (u - t <= 1e-12) continue;
        const a = vertex([
            s.a[0] + t * (s.b[0] - s.a[0]),
            s.a[1] + t * (s.b[1] - s.a[1]),
          ]),
          b = vertex([
            s.a[0] + u * (s.b[0] - s.a[0]),
            s.a[1] + u * (s.b[1] - s.a[1]),
          ]);
        if (a === b)
          return {
            ok: false,
            diagnostics: [
              diag(
                "FOLD_UNSUPPORTED",
                [],
                {},
                ["fold-export"],
                "collapsed-edge",
              ),
            ],
          };
        const key = [Math.min(a, b), Math.max(a, b)].join(",");
        const old = edgeMap.get(key);
        if (old && old !== s.assignment)
          return {
            ok: false,
            diagnostics: [
              diag(
                "FOLD_UNSUPPORTED",
                [],
                {},
                ["fold-export"],
                "assignment-conflict",
              ),
            ],
          };
        if (!old) {
          edges.push([a, b]);
          assignments.push(s.assignment);
          edgeMap.set(key, s.assignment);
        }
      }
    }
    if (
      vertices.some((v) => v.some((x) => !Number.isFinite(x))) ||
      edges.some(
        (e) => e.length !== 2 || e.some((i) => i < 0 || i >= vertices.length),
      )
    )
      return {
        ok: false,
        diagnostics: [
          diag("FOLD_UNSUPPORTED", [], {}, ["fold-export"], "invalid-graph"),
        ],
      };
    const frame = {
      frame_title: p.id,
      frame_classes: ["creasePattern"],
      frame_attributes: ["2D", ...(assignments.includes("C") ? ["cuts"] : [])],
      frame_unit: "mm",
      vertices_coords: vertices,
      edges_vertices: edges,
      edges_assignment: assignments,
      "plega:pieceId": p.id,
      "plega:certificate": analysis.certificate,
      "plega:status": analysis.canFinalPrint
        ? "checked-pattern"
        : "draft-pattern",
      "plega:diagnostics": analysis.diagnostics
        .filter((d) => d.blocks.length)
        .map((d) => ({
          code: d.code,
          moduleIds: d.moduleIds,
          reason: d.reason,
          numbers: d.numbers,
        })),
    };
    frames.push(frame);
    docs.push({
      fileName: `${p.id.replace(":", "-")}.fold`,
      data: {
        file_spec: 1.2,
        file_creator: "PLEGA",
        file_title: project.title,
        file_description:
          "Independent flat piece. Glue assembly is described in the project and fabrication instructions.",
        ...frame,
      },
      pieceIds: [p.id],
      compatibility: [
        "Cuts (C) require optional FOLD 1.2 consumer support.",
        "No material faces, layer order or glued-assembly topology is asserted.",
      ],
    });
  }
  docs.push({
    fileName: "workshop.fold",
    data: {
      file_spec: 1.2,
      file_creator: "PLEGA",
      file_title: project.title,
      file_classes: ["multiModel"],
      ...frames[0],
      file_frames: frames.slice(1),
    },
    pieceIds: pieces.map((p) => p.id),
    compatibility: [
      "Frames are independent fabrication pieces, not animation or solved glue assembly.",
      "Some consumers display only the first frame or do not implement cut/slit edges.",
    ],
  });
  return { ok: true, value: docs, diagnostics: analysis.diagnostics };
}
