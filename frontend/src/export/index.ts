import { makeFoldDocuments, parseProject } from "../core/index";
import type { PrintPlan, Project } from "../core/types";
import { buildDrawings } from "./drawing";
import { ExportFailure, loadFont } from "./font";
import { drawingsPdf } from "./pdf";
import { drawingSvg } from "./svg";
import type {
  ExportFile,
  ExportLanguage,
  ExportOptions,
  ExportResult,
} from "./types";
export { makeAssemblySteps } from "./assembly";
export { bundleFiles } from "./archive";
export { POINTS_PER_MM } from "./pdf";
export type {
  AssemblyStep,
  ExportError,
  ExportFile,
  ExportLanguage,
  ExportOptions,
  ExportResult,
} from "./types";

const encode = (text: string) => new TextEncoder().encode(text);
const filename = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64) || "plega-project";
const failure = (error: unknown, lang: ExportLanguage): ExportResult<never> => {
  const errors =
    error instanceof ExportFailure
      ? error.errors
      : [
          {
            code: "EXPORT_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "The export could not be completed.",
            entityIds: [],
          },
        ];
  const spanish: Record<string, string> = {
    FONT_UNAVAILABLE:
      "No se pudo cargar la fuente de impresión incluida. Vuelve a intentarlo cuando estén disponibles los archivos de la aplicación.",
    FONT_GLYPH_UNSUPPORTED:
      "La fuente de impresión no contiene todos los caracteres de esta etiqueta. Usa texto admitido para imprimir; el JSON editable conserva el Unicode original.",
    LABEL_OVERFLOW:
      "El texto no cabe de forma legible en su espacio. Acorta la etiqueta o amplía el proyecto.",
    FABRICATION_BLOCKED:
      "Las comprobaciones geométricas bloquean la fabricación final. Resuelve los fallos o exporta un borrador identificado.",
    DRAFT_BLOCKED: "El proyecto no tiene un borrador bidimensional válido.",
    PRINT_CERTIFICATE_MISMATCH:
      "El certificado del patrón ya no coincide con el proyecto editable. Genera el patrón de nuevo antes de exportar.",
    PRINT_CLIPPING:
      "Una pieza o mosaico de transferencia sale del área imprimible.",
    PRINT_CLIP_INVALID:
      "Solo se permite recortar gráficos en mosaicos identificados como patrones de transferencia.",
    GUIDE_OVERFLOW:
      "El diagnóstico no cabe en una página de guía legible. Resuelve algunas comprobaciones antes de exportar.",
  };
  return {
    ok: false,
    errors: errors.map((e) =>
      lang === "es"
        ? {
            ...e,
            message:
              (spanish[e.code] ??
                "No se pudo exportar un patrón válido con estos datos.") +
              (e.entityIds.length ? " [" + e.entityIds.join(", ") + "]" : "") +
              (e.code === "FONT_GLYPH_UNSUPPORTED"
                ? " " + (e.message.match(/U\+[A-F\d]+/gu) ?? []).join(", ")
                : ""),
          }
        : e,
    ),
  };
};

export async function serializeSvgPages(
  project: Project,
  plan: PrintPlan,
  options: ExportOptions,
): Promise<ExportResult<readonly ExportFile[]>> {
  try {
    const font = await loadFont(options.fontBytes),
      drawings = buildDrawings(project, plan, options, font),
      prefix = filename(project.title);
    return {
      ok: true,
      value: drawings.map((d) => ({
        name: `${prefix}-${d.id}.svg`,
        mime: "image/svg+xml",
        bytes: encode(drawingSvg(d, font.bytes)),
      })),
    };
  } catch (error) {
    return failure(error, options.lang);
  }
}
export async function serializePdf(
  project: Project,
  plan: PrintPlan,
  options: ExportOptions,
): Promise<ExportResult<ExportFile>> {
  try {
    const font = await loadFont(options.fontBytes),
      drawings = buildDrawings(project, plan, options, font);
    return {
      ok: true,
      value: {
        name: `${filename(project.title)}-${plan.purpose}.pdf`,
        mime: "application/pdf",
        bytes: await drawingsPdf(drawings, font, project.title, options.lang),
      },
    };
  } catch (error) {
    return failure(error, options.lang);
  }
}
export function serializeProject(
  project: Project,
  lang: ExportLanguage = "en",
): ExportResult<ExportFile> {
  const parsed = parseProject(project);
  if (!parsed.ok)
    return {
      ok: false,
      errors: parsed.diagnostics.map((d) => ({
        code: d.code,
        message: d.message[lang],
        entityIds: d.moduleIds,
      })),
    };
  return {
    ok: true,
    value: {
      name: filename(project.title) + ".plega.json",
      mime: "application/json",
      bytes: encode(JSON.stringify(parsed.value, null, 2) + "\n"),
    },
  };
}
export function serializeFold(
  project: Project,
  lang: ExportLanguage = "en",
): ExportResult<readonly ExportFile[]> {
  const result = makeFoldDocuments(project);
  if (!result.ok)
    return {
      ok: false,
      errors: result.diagnostics.map((d) => ({
        code: d.code,
        message: d.message[lang],
        entityIds: d.moduleIds,
      })),
    };
  return {
    ok: true,
    value: result.value.map((file) => ({
      name: filename(project.title) + "-" + file.fileName,
      mime: "application/json",
      bytes: encode(JSON.stringify(file.data, null, 2) + "\n"),
    })),
  };
}
/** Invoke from a user action. One named file is offered; no navigation or upload. */
export function downloadFile(file: ExportFile): void {
  const bytes = new Uint8Array(file.bytes);
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
