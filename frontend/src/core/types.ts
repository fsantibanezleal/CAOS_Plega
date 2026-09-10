export type Localized = Readonly<{ en: string; es: string }>;
export const MAX_MODULES = 16;
export type Cutwork = Readonly<{
  pattern: "arcade" | "leaf" | "wing" | "lattice";
  detail: number;
  web: number;
}>;
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Tri = readonly [number, number, number];
export type Box2 = Readonly<{ min: Vec2; max: Vec2 }>;
export type Box3 = Readonly<{ min: Vec3; max: Vec3 }>;
export type PField = "a" | "b" | "width";
export type VField =
  | "r"
  | "h"
  | "betaDeg"
  | "gammaDeg"
  | "tabWidth"
  | "tabInset";
export interface ModuleCommon {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly y: number;
  readonly cutwork?: Cutwork;
}
export interface StepModule extends ModuleCommon {
  readonly kind: "P";
  readonly params: Readonly<{ a: number; b: number; width: number }>;
  readonly pins: readonly ("y" | PField)[];
}
export interface VModule extends ModuleCommon {
  readonly kind: "V";
  readonly params: Readonly<{
    r: number;
    h: number;
    betaDeg: number;
    gammaDeg: number;
    tabWidth: number;
    tabInset: number;
  }>;
  readonly pins: readonly ("y" | VField)[];
}
export type Mechanism = StepModule | VModule;
export interface Project {
  readonly schemaVersion: 1;
  readonly title: string;
  readonly card: Readonly<{
    W: number;
    H: number;
    margin: number;
    gap: number;
    blank: "uncreased" | "prefolded";
    color: string;
    pins: readonly ("W" | "H" | "margin" | "gap")[];
  }>;
  readonly modules: readonly Mechanism[];
}
export type Capability = "pose" | "final-print" | "certificate" | "fold-export";
export interface Diagnostic {
  readonly id: string;
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly moduleIds: readonly string[];
  readonly messageKey: string;
  readonly message: Localized;
  readonly reason: string;
  readonly numbers: readonly Readonly<{
    key: string;
    value: number;
    unit: "mm" | "deg" | "count" | "unitless";
  }>[];
  readonly highlights: readonly Readonly<{
    kind: "module" | "face" | "edge" | "dimension" | "card";
    id: string;
  }>[];
  readonly blocks: readonly Capability[];
}
export type Result<T> =
  | Readonly<{ ok: true; value: T; diagnostics: readonly Diagnostic[] }>
  | Readonly<{ ok: false; diagnostics: readonly Diagnostic[] }>;
export interface Check {
  readonly id: string;
  readonly state: "pass" | "fail" | "unverified" | "not-applicable";
  readonly method: "analytic" | "structural" | "product-domain";
  readonly diagnosticIds: readonly string[];
}
export interface ModuleBounds {
  readonly moduleId: string;
  readonly sweptY: readonly [number, number];
  readonly closedAcrossMax: number;
  readonly closedPanels: readonly Readonly<{
    faceId: string;
    polygon: readonly Vec2[];
  }>[];
  readonly tabFootprints: readonly Readonly<{
    id: string;
    page: "left" | "right";
    polygon: readonly Vec2[];
  }>[];
}
export interface Analysis {
  readonly diagnostics: readonly Diagnostic[];
  readonly checks: readonly Check[];
  readonly modules: readonly ModuleBounds[];
  readonly canPose: boolean;
  readonly canDraftPrint: boolean;
  readonly canFinalPrint: boolean;
  readonly canFoldExport: boolean;
  readonly certificate: "pass" | "fail" | "unavailable";
}
export interface Panel3D {
  readonly id: string;
  readonly pieceId: string;
  readonly moduleId?: string;
  readonly role: "base" | "moving" | "tab";
  readonly color: string;
  readonly vertices: readonly Vec3[];
  readonly triangles: readonly Tri[];
}
export interface Edge3D {
  readonly id: string;
  readonly printEdgeId?: string;
  readonly moduleId?: string;
  readonly role: "boundary" | "cut" | "mountain" | "valley";
  readonly endpoints: readonly [Vec3, Vec3];
}
export interface Scene {
  readonly openingDeg: number;
  readonly panels: readonly Panel3D[];
  readonly edges: readonly Edge3D[];
  readonly bounds: Box3;
  readonly coincidentEndpoint: boolean;
  readonly geometricCertificate: Analysis["certificate"];
}
export interface PrintLine {
  readonly id: string;
  readonly assignment: "cut" | "mountain" | "valley";
  readonly points: readonly [Vec2, Vec2];
  readonly moduleId?: string;
}
export interface PrintFace {
  readonly id: string;
  readonly polygon: readonly Vec2[];
  readonly holes?: readonly (readonly Vec2[])[];
  readonly fill: string;
  readonly moduleId?: string;
}
export interface PrintLabel {
  readonly id: string;
  readonly text: string;
  readonly box: Box2;
  readonly role: "part" | "glue" | "instruction" | "calibration" | "decoration";
}
export interface PrintPiece {
  readonly id: string;
  readonly faces: readonly PrintFace[];
  readonly lines: readonly PrintLine[];
  readonly glue: readonly Readonly<{
    id: string;
    polygon: readonly Vec2[];
    pairId: string;
    side: "back-of-tab" | "front-of-base";
  }>[];
  readonly labels: readonly PrintLabel[];
  readonly cutBounds: Box2;
  readonly layoutBounds: Box2;
}
export interface PrintOptions {
  readonly purpose: "draft" | "fabrication";
  readonly sheet: Readonly<{ width: number; height: number; margin: number }>;
  readonly cuttingGap: number;
  readonly allowQuarterTurn: boolean;
  readonly oversize: "reject" | "tile-transfer-pattern";
}
export interface PrintPlacement {
  readonly pieceId: string;
  readonly pageIndex: number;
  readonly rotationDeg: 0 | 90;
  readonly translation: Vec2;
  /** Coordinates of the clipped region in the unrotated piece's local mm. */
  readonly clip?: Box2;
  readonly tile?: Readonly<{
    row: number;
    column: number;
    rows: number;
    columns: number;
    overlapMm: number;
    registration: readonly Vec2[];
  }>;
}
export interface PrintPage {
  readonly index: number;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly contentBounds: Box2;
  readonly footerHeight: number;
  readonly transferOnly: boolean;
}
export interface PrintPlan {
  readonly units: "mm";
  readonly purpose: PrintOptions["purpose"];
  readonly pieces: readonly PrintPiece[];
  readonly placements: readonly PrintPlacement[];
  readonly pages: readonly PrintPage[];
  readonly assembly: readonly Readonly<{
    id: string;
    messageKey: string;
    entityIds: readonly string[];
  }>[];
  readonly certificate: Analysis["certificate"];
  readonly diagnostics: readonly Diagnostic[];
}
export type Change =
  | Readonly<{
      scope: "card";
      field: "W" | "H" | "margin" | "gap";
      before: number;
      after: number;
    }>
  | Readonly<{
      scope: "module";
      moduleId: string;
      field: "y" | PField | VField;
      before: number;
      after: number;
    }>;
export interface RepairProposal {
  readonly id: string;
  readonly labelKey: string;
  readonly label: Localized;
  readonly reasonDiagnosticIds: readonly string[];
  readonly changes: readonly Change[];
  readonly beforeKey: string;
  readonly after: Project;
  readonly beforeDiagnostics: readonly Diagnostic[];
  readonly afterDiagnostics: readonly Diagnostic[];
  readonly resolves: readonly string[];
  readonly remaining: readonly string[];
}
export interface FoldDocument {
  readonly fileName: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly pieceIds: readonly string[];
  readonly compatibility: readonly string[];
}
export interface Starter {
  readonly id: string;
  readonly title: Localized;
  readonly description: Localized;
  readonly learning: Localized;
  readonly project: Project;
}
