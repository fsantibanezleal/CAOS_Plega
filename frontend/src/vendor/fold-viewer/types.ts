import type { CSSProperties, HTMLAttributes } from 'react';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type LocalizedText = Record<string, string>;

export interface FoldAppearance {
  color: string;
  roughness?: number;
  texture?: unknown;
  pattern?: unknown;
}

export interface FoldSheet {
  id: string;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  front: FoldAppearance;
  back: FoldAppearance;
}

export interface FoldMeshVertex {
  id: string;
  uvMm: Vec2;
}
export interface FoldMeshFace {
  id: string;
  vertices: [number, number, number];
}
export interface FoldMesh {
  id: string;
  sheet: string;
  vertices: FoldMeshVertex[];
  faces: FoldMeshFace[];
}

export interface FoldLayerHint {
  axis: Vec3;
  ranks: number[];
}
export interface FoldCrease {
  id: string;
  sheet: string;
  segmentMm: [Vec2, Vec2];
  assignment: 'mountain' | 'valley' | 'unassigned' | 'reference';
  establishedAt: number;
}

interface OperationBase {
  id: string;
  sheet: string;
  mesh: string;
  durationMs: number;
  creases: FoldCrease[];
  layers: unknown[];
}

export interface SampledOperation extends OperationBase {
  kind: 'sampled';
  keys: Array<{ at: number; positionsMm: Vec3[]; layerHint?: FoldLayerHint }>;
  interpolation: 'linear';
  maxRelativeEdgeError: number;
}

export interface HingeOperation extends OperationBase {
  kind: 'hinge';
  startPositionsMm: Vec3[];
  axisMm: [Vec3, Vec3];
  movingFaces: string[];
  angleDeg: number;
  easing: 'linear' | 'smoothstep';
  startLayerHint?: FoldLayerHint;
  endLayerHint?: FoldLayerHint;
}

export interface RigidOperation extends OperationBase {
  kind: 'rigid';
  startPositionsMm: Vec3[];
  axisMm: [Vec3, Vec3];
  angleDeg: number;
  translationMm: Vec3;
  liftMm: number;
  easing: 'linear' | 'smoothstep';
  startLayerHint?: FoldLayerHint;
  endLayerHint?: FoldLayerHint;
}

export type FoldOperation = SampledOperation | HingeOperation | RigidOperation;

export interface FoldCamera {
  projection: 'orthographic' | 'perspective';
  positionMm: Vec3;
  targetMm: Vec3;
  up: Vec3;
  verticalSpanMm?: number;
  verticalFovDeg?: number;
  transitionMs: number;
}

export interface FoldStep {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  kind: string;
  animation: 'resolved' | 'not-authored' | 'not-applicable';
  runs: Array<{ operation: string; from: number; to: number }>;
  pauseAfterMs: number;
  tactile?: {
    orientation?: LocalizedText;
    locate?: LocalizedText[];
    check?: LocalizedText[];
    recovery?: LocalizedText[];
    landmarkIds?: string[];
  };
  camera?: FoldCamera;
}

export interface FoldDocument {
  format: 'fold-spec';
  specVersion: '1.0.0-draft.1';
  id: string;
  revision: number;
  defaultLocale: string;
  status: 'planned' | 'instructions' | 'partial' | 'resolved';
  metadata: {
    title: LocalizedText;
    summary?: LocalizedText;
    [key: string]: unknown;
  };
  sheets: FoldSheet[];
  accessibility: Record<string, unknown>;
  instructions: { steps: FoldStep[] };
  geometry?: {
    status: 'partial' | 'complete';
    meshes: FoldMesh[];
    operations: FoldOperation[];
    [key: string]: unknown;
  };
  assets: unknown[];
  narration: unknown[];
  history: unknown[];
  extensions: Array<{
    id: string;
    version: string;
    requiredFor: Array<
      'text' | 'authoring' | 'playback' | 'presentation' | 'print'
    >;
    data: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

export type FoldViewerSource =
  | { kind: 'document'; document: FoldDocument }
  | { kind: 'file'; file: File | Blob; name?: string }
  | { kind: 'url'; url: string; fetchOptions?: RequestInit };

export type ViewerStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ViewMode = 'animation' | 'text';
export type PlaybackRate = 0.5 | 1 | 1.5 | 2;

export interface ViewerPreferences {
  highContrast: boolean;
  plainBackground: boolean;
  reducedMotion: boolean;
  tactileDetails: boolean;
}

export interface FoldViewerTheme {
  accent: string;
  background: string;
  panel: string;
  foreground: string;
  muted: string;
  radius: string;
}

export interface FoldViewerError {
  code: string;
  message: string;
  path?: string;
}

export interface FoldViewerSnapshot {
  status: ViewerStatus;
  document: FoldDocument | null;
  error: FoldViewerError | null;
  stepIndex: number;
  step: FoldStep | null;
  progress: number;
  playing: boolean;
  playbackRate: PlaybackRate;
  viewMode: ViewMode;
  locale?: string;
  preferences: ViewerPreferences;
  canRenderAnimation: boolean;
  diagnostic: string | null;
}

export interface FoldViewerActions {
  play(): void;
  pause(): void;
  togglePlayback(): void;
  seek(progress: number): void;
  next(): void;
  previous(): void;
  reset(): void;
  setStep(stepId: string): void;
  setPlaybackRate(rate: PlaybackRate): void;
  setViewMode(mode: ViewMode): void;
  setPreferences(preferences: Partial<ViewerPreferences>): void;
}

export interface FoldViewerHandle extends FoldViewerActions {
  getSnapshot(): FoldViewerSnapshot;
}

export interface FoldViewerCallbacks {
  onError?: (error: FoldViewerError) => void;
  onLoad?: (document: FoldDocument) => void;
  onStepChange?: (step: FoldStep, index: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onProgressChange?: (progress: number) => void;
}

export interface FoldViewerProviderProps extends FoldViewerCallbacks {
  source: FoldViewerSource;
  children: React.ReactNode;
  locale?: string;
  stepId?: string;
  defaultStepId?: string;
  playing?: boolean;
  defaultPlaying?: boolean;
  playbackRate?: PlaybackRate;
  autoAdvance?: boolean;
  viewMode?: ViewMode;
  preferences?: Partial<ViewerPreferences>;
}

export interface FoldViewerProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, 'onError' | 'onLoad'>,
    FoldViewerCallbacks {
  source: FoldViewerSource;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  locale?: string;
  stepId?: string;
  defaultStepId?: string;
  playing?: boolean;
  defaultPlaying?: boolean;
  playbackRate?: PlaybackRate;
  autoAdvance?: boolean;
  viewMode?: ViewMode;
  preferences?: Partial<ViewerPreferences>;
  theme?: Partial<FoldViewerTheme>;
}
