import { PDFDocument, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fontUrl from "./assets/NotoSans-Regular.ttf?url";
import type { ExportError } from "./types";

export class ExportFailure extends Error {
  constructor(readonly errors: readonly ExportError[]) {
    super(errors.map((e) => e.message).join("\n"));
  }
}
export const fail = (
  code: string,
  message: string,
  entityIds: readonly string[] = [],
): never => {
  throw new ExportFailure([{ code, message, entityIds }]);
};
export interface FontTools {
  doc: PDFDocument;
  font: PDFFont;
  bytes: Uint8Array;
  characters: ReadonlySet<number>;
}
export async function loadFont(provided?: Uint8Array): Promise<FontTools> {
  let bytes = provided;
  if (!bytes) {
    const response = await fetch(fontUrl);
    if (!response.ok)
      return fail(
        "FONT_UNAVAILABLE",
        "The bundled print font could not be loaded. Retry when the app files are available.",
      );
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(bytes, { subset: true });
  return { doc, font, bytes, characters: new Set(font.getCharacterSet()) };
}
export function validateGlyphs(
  text: string,
  tools: FontTools,
  entityId: string,
): void {
  const missing = [
    ...new Set(
      [...text].filter(
        (c) => !/\s/u.test(c) && !tools.characters.has(c.codePointAt(0)!),
      ),
    ),
  ];
  if (missing.length)
    fail(
      "FONT_GLYPH_UNSUPPORTED",
      `The print font cannot represent ${missing.map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`).join(", ")} in ${entityId}. Use supported text for this printed label; editable JSON preserves the original Unicode.`,
      [entityId],
    );
}
export function wrapText(
  text: string,
  width: number,
  size: number,
  tools: FontTools,
): string[] {
  const measure = (t: string) => tools.font.widthOfTextAtSize(t, size);
  const result: string[] = [];
  for (const paragraph of text.split(/\r?\n/u)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/u).filter(Boolean)) {
      if (measure(word) > width) {
        if (line) {
          result.push(line);
          line = "";
        }
        for (const char of word) {
          if (line && measure(line + char) > width) {
            result.push(line);
            line = "";
          }
          line += char;
        }
      } else if (line && measure(line + " " + word) > width) {
        result.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    result.push(line);
  }
  return result;
}
