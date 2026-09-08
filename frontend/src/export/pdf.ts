import {
  clip,
  closePath,
  degrees,
  endPath,
  fill,
  fillAndStroke,
  lineTo,
  moveTo,
  PDFHexString,
  PDFName,
  popGraphicsState,
  PrintScaling,
  pushGraphicsState,
  rectangle,
  rgb,
  setDashPattern,
  setFillingRgbColor,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  type PDFOperator,
} from "pdf-lib";
import type { DrawingPage } from "./drawing";
import type { FontTools } from "./font";
import type { ExportLanguage } from "./types";

export const POINTS_PER_MM = 72 / 25.4;
const mm = (v: number) => v * POINTS_PER_MM;
const color = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];
export async function drawingsPdf(
  drawings: readonly DrawingPage[],
  tools: FontTools,
  title: string,
  lang: ExportLanguage,
): Promise<Uint8Array> {
  const { doc, font } = tools;
  doc.setTitle(title);
  doc.setCreator("PLEGA - calibrated paper mechanism workshop");
  doc.setProducer("PLEGA / pdf-lib");
  doc.setLanguage(lang);
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  // No active content, remote links, attachments or imported SVG enter the PDF.
  doc.catalog.set(
    PDFName.of("PlegaPrintSchema"),
    doc.context.obj("plega-print/v1"),
  );
  for (const drawing of drawings) {
    const page = doc.addPage([mm(drawing.width), mm(drawing.height)]);
    page.node.set(PDFName.of("PlegaPageKind"), doc.context.obj(drawing.kind));
    page.node.set(
      PDFName.of("PlegaPrintMetadata"),
      PDFHexString.fromText(JSON.stringify(drawing.metadata)),
    );
    for (const ink of drawing.ink) {
      page.pushOperators(pushGraphicsState());
      if (ink.clip)
        page.pushOperators(
          rectangle(
            mm(ink.clip.min[0]),
            mm(ink.clip.min[1]),
            mm(ink.clip.max[0] - ink.clip.min[0]),
            mm(ink.clip.max[1] - ink.clip.min[1]),
          ),
          clip(),
          endPath(),
        );
      if (ink.kind === "text")
        page.drawText(ink.text, {
          x: mm(ink.position[0]),
          y: mm(ink.position[1]),
          size: mm(ink.size),
          font,
          color: rgb(0.086, 0.086, 0.086),
          rotate: degrees(ink.rotation),
        });
      else if (ink.points.length) {
        const operators: PDFOperator[] = [
          setStrokingRgbColor(...color(ink.stroke)),
          setLineWidth(mm(ink.width)),
          setDashPattern((ink.dash ?? []).map(mm), 0),
          moveTo(mm(ink.points[0][0]), mm(ink.points[0][1])),
        ];
        for (const point of ink.points.slice(1))
          operators.push(lineTo(mm(point[0]), mm(point[1])));
        if (ink.closed) operators.push(closePath());
        if (ink.fill)
          operators.push(
            setFillingRgbColor(...color(ink.fill)),
            ink.width > 0 ? fillAndStroke() : fill(),
          );
        else operators.push(stroke());
        page.pushOperators(...operators);
      }
      page.pushOperators(popGraphicsState());
    }
  }
  return doc.save({ useObjectStreams: false, addDefaultPage: false });
}
