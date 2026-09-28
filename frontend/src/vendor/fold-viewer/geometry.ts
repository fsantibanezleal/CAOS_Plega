import type {
  FoldDocument,
  FoldLayerHint,
  FoldMesh,
  FoldOperation,
  FoldStep,
  Vec3,
} from './types';

export interface SampledSheet {
  sheetId: string;
  mesh: FoldMesh;
  positions: Float64Array;
  layerHint?: FoldLayerHint;
  hasUnsupportedLayers: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function eased(progress: number, easing: 'linear' | 'smoothstep'): number {
  const t = clamp01(progress);
  return easing === 'smoothstep' ? t * t * (3 - 2 * t) : t;
}

function rotate(point: Vec3, start: Vec3, end: Vec3, radians: number): Vec3 {
  const [x, y, z] = [
    point[0] - start[0],
    point[1] - start[1],
    point[2] - start[2],
  ];
  const axis: Vec3 = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
  const length = Math.hypot(...axis);
  if (length === 0) return [...point];
  const [u, v, w] = axis.map((component) => component / length) as Vec3;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dot = u * x + v * y + w * z;
  return [
    start[0] + x * cos + (v * z - w * y) * sin + u * dot * (1 - cos),
    start[1] + y * cos + (w * x - u * z) * sin + v * dot * (1 - cos),
    start[2] + z * cos + (u * y - v * x) * sin + w * dot * (1 - cos),
  ];
}

function flatten(positions: Vec3[]): Float64Array {
  const output = new Float64Array(positions.length * 3);
  positions.forEach((position, index) => output.set(position, index * 3));
  return output;
}

export function sampleOperation(
  operation: FoldOperation,
  mesh: FoldMesh,
  rawProgress: number,
): Float64Array {
  const progress = clamp01(rawProgress);
  if (operation.kind === 'sampled') {
    let upper = operation.keys.findIndex((key) => key.at >= progress);
    if (upper < 0) upper = operation.keys.length - 1;
    if (upper === 0) return flatten(operation.keys[0].positionsMm);
    const before = operation.keys[upper - 1];
    const after = operation.keys[upper];
    const local =
      after.at === before.at
        ? 0
        : (progress - before.at) / (after.at - before.at);
    return flatten(
      before.positionsMm.map((position, index) => [
        mix(position[0], after.positionsMm[index][0], local),
        mix(position[1], after.positionsMm[index][1], local),
        mix(position[2], after.positionsMm[index][2], local),
      ]),
    );
  }

  const amount = eased(progress, operation.easing);
  const radians = (operation.angleDeg * Math.PI * amount) / 180;
  if (operation.kind === 'rigid') {
    return flatten(
      operation.startPositionsMm.map((position) => {
        const rotated = rotate(
          position,
          operation.axisMm[0],
          operation.axisMm[1],
          radians,
        );
        return [
          rotated[0] + operation.translationMm[0] * amount,
          rotated[1] + operation.translationMm[1] * amount,
          rotated[2] +
            operation.translationMm[2] * amount +
            operation.liftMm * Math.sin(Math.PI * amount),
        ];
      }),
    );
  }

  const moving = new Set<number>();
  const movingFaces = new Set(operation.movingFaces);
  for (const face of mesh.faces)
    if (movingFaces.has(face.id)) {
      for (const index of face.vertices) moving.add(index);
    }
  return flatten(
    operation.startPositionsMm.map((position, index) =>
      moving.has(index)
        ? rotate(position, operation.axisMm[0], operation.axisMm[1], radians)
        : [...position],
    ),
  );
}

function layerHintAt(
  operation: FoldOperation,
  progress: number,
): FoldLayerHint | undefined {
  if (operation.kind === 'sampled') {
    let closest = operation.keys[0];
    for (const key of operation.keys)
      if (Math.abs(key.at - progress) < Math.abs(closest.at - progress))
        closest = key;
    return closest.layerHint;
  }
  return progress < 0.5 ? operation.startLayerHint : operation.endLayerHint;
}

function stepRunsAt(
  step: FoldStep,
  progress: number,
  operations: Map<string, FoldOperation>,
): Map<string, { operation: FoldOperation; at: number }> {
  const result = new Map<string, { operation: FoldOperation; at: number }>();
  const runs = step.runs
    .map((run) => {
      const operation = operations.get(run.operation);
      return {
        run,
        operation,
        weight: operation
          ? operation.durationMs * Math.abs(run.to - run.from)
          : 0,
      };
    })
    .filter((item): item is typeof item & { operation: FoldOperation } =>
      Boolean(item.operation),
    );
  const duration = runs.reduce((sum, item) => sum + item.weight, 0);
  let cursor = clamp01(progress) * duration;
  for (const item of runs) {
    const local = item.weight === 0 ? 1 : clamp01(cursor / item.weight);
    result.set(item.operation.sheet, {
      operation: item.operation,
      at: mix(item.run.from, item.run.to, local),
    });
    cursor -= item.weight;
    if (cursor < 0) break;
  }
  return result;
}

export function sampleDocument(
  document: FoldDocument,
  stepIndex: number,
  progress: number,
): SampledSheet[] {
  if (!document.geometry) return [];
  const operations = new Map(
    document.geometry.operations.map((operation) => [operation.id, operation]),
  );
  const meshes = new Map(
    document.geometry.meshes.map((mesh) => [mesh.id, mesh]),
  );
  const states = new Map<string, { operation: FoldOperation; at: number }>();
  for (let index = 0; index <= stepIndex; index++) {
    const step = document.instructions.steps[index];
    if (!step) break;
    const updates = stepRunsAt(
      step,
      index === stepIndex ? progress : 1,
      operations,
    );
    for (const [sheet, state] of updates) states.set(sheet, state);
  }

  return document.sheets.flatMap<SampledSheet>((sheet) => {
    const state = states.get(sheet.id);
    if (state) {
      const mesh = meshes.get(state.operation.mesh);
      if (!mesh) return [];
      return [
        {
          sheetId: sheet.id,
          mesh,
          positions: sampleOperation(state.operation, mesh, state.at),
          layerHint: layerHintAt(state.operation, state.at),
          hasUnsupportedLayers: state.operation.layers.length > 0,
        },
      ];
    }
    const mesh = document.geometry?.meshes.find(
      (candidate) => candidate.sheet === sheet.id,
    );
    if (!mesh) return [];
    return [
      {
        sheetId: sheet.id,
        mesh,
        positions: flatten(
          mesh.vertices.map(({ uvMm }) => [uvMm[0], uvMm[1], 0]),
        ),
        layerHint: undefined,
        hasUnsupportedLayers: false,
      },
    ];
  });
}

export function getStepDuration(
  document: FoldDocument,
  stepIndex: number,
): number {
  const operations = new Map(
    document.geometry?.operations.map((operation) => [
      operation.id,
      operation,
    ]) ?? [],
  );
  return (
    document.instructions.steps[stepIndex]?.runs.reduce((duration, run) => {
      const operation = operations.get(run.operation);
      return (
        duration + (operation?.durationMs ?? 0) * Math.abs(run.to - run.from)
      );
    }, 0) || 1000
  );
}
