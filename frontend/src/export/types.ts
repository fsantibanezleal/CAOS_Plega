export type ExportLanguage = "en" | "es";
export interface ExportFile {
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
}
export interface ExportError {
  readonly code: string;
  readonly message: string;
  readonly entityIds: readonly string[];
}
export type ExportResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; errors: readonly ExportError[] }>;
export interface ExportOptions {
  readonly lang: ExportLanguage;
  readonly monochrome?: boolean;
  readonly fontBytes?: Uint8Array;
}
export interface AssemblyStep {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly kind: "prepare" | "cut" | "score" | "glue" | "test";
  readonly entityIds: readonly string[];
  readonly moduleId?: string;
  readonly openingDeg?: number;
}
