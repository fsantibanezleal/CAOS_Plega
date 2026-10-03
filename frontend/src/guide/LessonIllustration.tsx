import { sampleDocument } from "../vendor/fold-viewer/geometry";
import type { FoldDocument, Vec3 } from "../vendor/fold-viewer/types";

/** Diagrams are generated from the same resolved geometry as playback. */
export default function LessonIllustration({
  document,
  stepIndex,
  language,
}: {
  document: FoldDocument;
  stepIndex: number;
  language: "en" | "es";
}) {
  const step = document.instructions.steps[stepIndex];
  const run = step?.runs[0];
  const operation = document.geometry?.operations.find(
    (op) => op.id === run?.operation,
  );
  const axis =
    operation && operation.kind !== "sampled" ? operation.axisMm : undefined;
  const state = sampleDocument(document, stepIndex, 0)[0];
  const movingFaces = new Set(
    operation?.kind === "hinge"
      ? operation.movingFaces
      : state?.mesh.faces.map((f) => f.id),
  );
  const xy = (p: Vec3) => [p[0], -p[1]];
  const both = [0, 1].map(
    (progress) => sampleDocument(document, stepIndex, progress)[0],
  );
  const positions = both.flatMap((sheet) =>
    sheet
      ? Array.from({ length: sheet.positions.length / 3 }, (_, i) => [
          sheet.positions[i * 3],
          -sheet.positions[i * 3 + 1],
        ])
      : [],
  );
  if (!state || !positions.length) return null;
  const bounds = [
    Math.min(...positions.map((p) => p[0])),
    Math.min(...positions.map((p) => p[1])),
    Math.max(...positions.map((p) => p[0])),
    Math.max(...positions.map((p) => p[1])),
  ];
  const size = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1], 40);
  const viewBox = `${(bounds[0] + bounds[2] - size * 1.3) / 2} ${(bounds[1] + bounds[3] - size * 1.3) / 2} ${size * 1.3} ${size * 1.3}`;
  return (
    <div
      className="plega-illustration"
      aria-label={
        language === "en" ? "Step illustrations" : "Ilustraciones del paso"
      }
    >
      {both.map(
        (sheet, index) =>
          sheet && (
            <figure key={index}>
              <svg
                viewBox={viewBox}
                role="img"
                aria-label={
                  language === "en"
                    ? index
                      ? "End position"
                      : "Starting position and moving region"
                    : index
                      ? "Posición final"
                      : "Posición inicial y zona móvil"
                }
              >
                {sheet.mesh.faces.map((face, i) => (
                  <polygon
                    key={face.id}
                    points={face.vertices
                      .map(
                        (v) =>
                          `${sheet.positions[v * 3]},${-sheet.positions[v * 3 + 1]}`,
                      )
                      .join(" ")}
                    fill={
                      index
                        ? document.sheets[0].front.color
                        : movingFaces.has(face.id)
                          ? "var(--accent)"
                          : "var(--line)"
                    }
                    fillOpacity={index ? 0.85 : 0.7}
                    stroke="var(--ink)"
                    strokeWidth={size * 0.002}
                    style={{
                      opacity:
                        sheet.layerHint?.ranks[i] === undefined ? 1 : 0.9,
                    }}
                  />
                ))}
                {!index && axis && (
                  <line
                    x1={xy(axis[0])[0]}
                    y1={xy(axis[0])[1]}
                    x2={xy(axis[1])[0]}
                    y2={xy(axis[1])[1]}
                    stroke="var(--ink)"
                    strokeWidth={size * 0.009}
                    strokeDasharray={`${size * 0.025} ${size * 0.018}`}
                  />
                )}
              </svg>
              <figcaption>
                {language === "en"
                  ? index
                    ? "After"
                    : "Before · highlighted paper moves"
                  : index
                    ? "Después"
                    : "Antes · se mueve la zona resaltada"}
              </figcaption>
            </figure>
          ),
      )}
    </div>
  );
}
