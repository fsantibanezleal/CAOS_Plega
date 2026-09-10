import { useId } from "react";
import type { PrintPlan, Scene } from "../core/types";

export function MiniPaper({ scene }: { scene: Scene | null }) {
  if (!scene)
    return (
      <svg viewBox="0 0 180 110" aria-hidden="true">
        <path d="m30 70 50-40 70 40-50 25z" fill="currentColor" opacity=".2" />
      </svg>
    );
  const project = (v: readonly number[]) => [
    v[0] * 0.8 + v[1] * 0.45,
    -v[2] - v[1] * 0.24 + v[0] * 0.2,
  ];
  const points = scene.panels.flatMap((panel) => panel.vertices.map(project));
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0])),
    minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.07;
  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      aria-hidden="true"
    >
      {[...scene.panels]
        .sort(
          (a, b) =>
            a.vertices.reduce(
              (s, v) => s + 0.45 * v[0] - 0.8 * v[1] + 0.282 * v[2],
              0,
            ) /
              a.vertices.length -
            b.vertices.reduce(
              (s, v) => s + 0.45 * v[0] - 0.8 * v[1] + 0.282 * v[2],
              0,
            ) /
              b.vertices.length,
        )
        .map((panel) => (
          <polygon
            key={panel.id}
            points={panel.vertices.map((p) => project(p).join(",")).join(" ")}
            fill={panel.color}
            stroke="#72687a"
            strokeWidth=".65"
            strokeLinejoin="round"
          />
        ))}
    </svg>
  );
}

export function PrintViewer({
  plan,
  pageIndex,
  selected,
  onSelect,
  lang,
}: {
  plan: PrintPlan | null;
  pageIndex: number;
  selected: string;
  onSelect: (id: string) => void;
  lang: "en" | "es";
}) {
  const prefix = useId().replaceAll(":", "");
  if (!plan || !plan.pages.length)
    return (
      <div className="print-empty">
        <strong>
          {lang === "es"
            ? "El patrón necesita una corrección"
            : "The pattern needs a correction"}
        </strong>
        <p>
          {lang === "es"
            ? "Revisa las dimensiones y las comprobaciones de la derecha."
            : "Review the dimensions and checks on the right."}
        </p>
      </div>
    );
  const page = plan.pages[Math.min(pageIndex, plan.pages.length - 1)];
  return (
    <svg
      className="print-page"
      viewBox={`0 0 ${page.width} ${page.height}`}
      role="img"
      aria-label={
        lang === "es"
          ? `Vista del patrón, hoja ${page.index + 1}`
          : `Pattern preview, sheet ${page.index + 1}`
      }
    >
      <rect width={page.width} height={page.height} fill="#fffdf7" />
      <rect
        x={page.margin}
        y={page.margin}
        width={page.width - page.margin * 2}
        height={page.height - page.margin * 2}
        fill="none"
        stroke="#d9d3c9"
        strokeWidth=".3"
        strokeDasharray="2 2"
      />
      {plan.placements
        .filter((item) => item.pageIndex === page.index)
        .map((placement, i) => {
          const piece = plan.pieces.find(
            (item) => item.id === placement.pieceId,
          );
          if (!piece) return null;
          const angle = (placement.rotationDeg * Math.PI) / 180;
          const point = (p: readonly number[]) => [
            placement.translation[0] +
              Math.cos(angle) * p[0] -
              Math.sin(angle) * p[1],
            page.height -
              (placement.translation[1] +
                Math.sin(angle) * p[0] +
                Math.cos(angle) * p[1]),
          ];
          const clip = placement.clip,
            id = `${prefix}-clip-${i}`;
          return (
            <g key={`${piece.id}-${i}`}>
              {clip && (
                <defs>
                  <clipPath id={id}>
                    <polygon
                      points={[
                        [clip.min[0], clip.min[1]],
                        [clip.max[0], clip.min[1]],
                        [clip.max[0], clip.max[1]],
                        [clip.min[0], clip.max[1]],
                      ]
                        .map((p) => point(p).join(","))
                        .join(" ")}
                    />
                  </clipPath>
                </defs>
              )}
              <g clipPath={clip ? `url(#${id})` : undefined}>
                {piece.faces.map((face) => (
                  <polygon
                    key={face.id}
                    data-face-id={face.id}
                    points={face.polygon
                      .map((p) => point(p).join(","))
                      .join(" ")}
                    fill={face.fill}
                    fillOpacity={face.moduleId === selected ? 0.75 : 0.33}
                    stroke={face.moduleId === selected ? "#664790" : "none"}
                    strokeWidth=".45"
                    onClick={() => face.moduleId && onSelect(face.moduleId)}
                    style={{ cursor: face.moduleId ? "pointer" : "default" }}
                  />
                ))}
                {piece.glue.map((glue) => (
                  <polygon
                    key={glue.id}
                    points={glue.polygon
                      .map((p) => point(p).join(","))
                      .join(" ")}
                    fill="#ad95cc"
                    fillOpacity=".2"
                    stroke="#795b9e"
                    strokeWidth=".3"
                    strokeDasharray=".6 .8"
                  />
                ))}
                {piece.lines.map((line) => (
                  <line
                    key={line.id}
                    x1={point(line.points[0])[0]}
                    y1={point(line.points[0])[1]}
                    x2={point(line.points[1])[0]}
                    y2={point(line.points[1])[1]}
                    stroke={
                      line.assignment === "cut"
                        ? "#333348"
                        : line.assignment === "mountain"
                          ? "#c26748"
                          : "#537eb0"
                    }
                    strokeWidth={line.assignment === "cut" ? 0.45 : 0.35}
                    strokeDasharray={
                      line.assignment === "cut"
                        ? undefined
                        : line.assignment === "mountain"
                          ? "3 1 .5 1"
                          : "2 1"
                    }
                  />
                ))}
                {piece.labels.map((label) => {
                  const x = (label.box.min[0] + label.box.max[0]) / 2,
                    y = (label.box.min[1] + label.box.max[1]) / 2,
                    p = point([x, y]);
                  return (
                    <text
                      key={label.id}
                      x={p[0]}
                      y={p[1]}
                      transform={`rotate(${-placement.rotationDeg} ${p[0]} ${p[1]})`}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#494052"
                      fontSize={
                        label.role === "decoration"
                          ? Math.min(
                              5,
                              (label.box.max[0] - label.box.min[0]) /
                                Math.max(label.text.length * 0.55, 1),
                            )
                          : 2.6
                      }
                    >
                      {label.text}
                    </text>
                  );
                })}
              </g>
              {placement.tile && (
                <text
                  x={page.margin + 2}
                  y={page.height - page.margin - 12}
                  fontSize="2.6"
                  fill="#5c5368"
                >
                  {lang === "es"
                    ? "Patrón de transferencia"
                    : "Transfer pattern"}{" "}
                  · {placement.tile.row + 1}/{placement.tile.rows} ·{" "}
                  {placement.tile.column + 1}/{placement.tile.columns}
                </text>
              )}
            </g>
          );
        })}
      <g
        transform={`translate(${page.margin + 2},${page.height - page.margin - 7})`}
        fill="#675a76"
      >
        <text fontSize="3" fontWeight="600">
          PLEGA
        </text>
        <text
          x={page.width - page.margin * 2 - 4}
          fontSize="2.6"
          textAnchor="end"
        >
          {page.index + 1} / {plan.pages.length} ·{" "}
          {lang === "es" ? "VISTA PREVIA" : "PREVIEW"}
        </text>
      </g>
      {plan.purpose === "draft" && (
        <text
          x={page.width / 2}
          y={page.height / 2}
          textAnchor="middle"
          fontSize="14"
          opacity=".24"
          fill="#9e473d"
          transform={`rotate(-30 ${page.width / 2} ${page.height / 2})`}
        >
          {lang === "es" ? "BORRADOR" : "DRAFT"}
        </text>
      )}
    </svg>
  );
}
