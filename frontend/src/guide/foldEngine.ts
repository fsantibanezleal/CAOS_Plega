export type Point = readonly [number, number];
export type Crease = readonly [Point, Point];
export type FoldStep = {
  crease: Crease;
  movingSide: 1 | -1;
  title: readonly [string, string];
  instruction: readonly [string, string];
  check: readonly [string, string];
};
export type FoldRecipe = {
  id: string;
  name: readonly [string, string];
  category: string;
  summary: readonly [string, string];
  paper: readonly [number, number];
  steps: readonly FoldStep[];
  source: string;
};
export type Facet = {
  points: Point[];
  face: 0 | 1;
  layer: number;
  moving?: boolean;
};

const EPS = 1e-7;
const cross = (p: Point, line: Crease) => {
  const [[ax, ay], [bx, by]] = line;
  return (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
};
const interpolate = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

function clip(points: readonly Point[], line: Crease, side: 1 | -1): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const da = cross(a, line) * side,
      db = cross(b, line) * side;
    const insideA = da >= -EPS,
      insideB = db >= -EPS;
    if (insideA) result.push(a);
    if (insideA !== insideB) result.push(interpolate(a, b, da / (da - db)));
  }
  return result.filter(
    (p, i) =>
      i === 0 ||
      Math.hypot(p[0] - result[i - 1][0], p[1] - result[i - 1][1]) > EPS,
  );
}

export function polygonArea(points: readonly Point[]): number {
  return (
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2
  );
}

function rotateFold(point: Point, line: Crease, progress: number): Point {
  const [[ax, ay], [bx, by]] = line;
  const dx = bx - ax,
    dy = by - ay,
    lengthSquared = dx * dx + dy * dy;
  const along = ((point[0] - ax) * dx + (point[1] - ay) * dy) / lengthSquared;
  const footX = ax + along * dx,
    footY = ay + along * dy;
  const perpendicularX = point[0] - footX,
    perpendicularY = point[1] - footY;
  const angle = Math.PI * progress;
  const lift =
    Math.hypot(perpendicularX, perpendicularY) * Math.sin(angle) * 0.17;
  return [
    footX + perpendicularX * Math.cos(angle),
    footY + perpendicularY * Math.cos(angle) - lift,
  ];
}

function split(facet: Facet, step: FoldStep): [Facet | null, Facet | null] {
  const stationary = clip(
    facet.points,
    step.crease,
    step.movingSide === 1 ? -1 : 1,
  );
  const moving = clip(facet.points, step.crease, step.movingSide);
  return [
    polygonArea(stationary) > EPS
      ? { ...facet, points: stationary, moving: false }
      : null,
    polygonArea(moving) > EPS
      ? { ...facet, points: moving, moving: true }
      : null,
  ];
}

export function foldFrame(
  recipe: FoldRecipe,
  stepIndex: number,
  progress: number,
): Facet[] {
  const [width, height] = recipe.paper;
  let facets: Facet[] = [
    {
      points: [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ],
      face: 0,
      layer: 0,
    },
  ];
  for (
    let index = 0;
    index <= Math.min(stepIndex, recipe.steps.length - 1);
    index++
  ) {
    const step = recipe.steps[index];
    const amount = index === stepIndex ? Math.max(0, Math.min(1, progress)) : 1;
    const next: Facet[] = [];
    for (const facet of facets) {
      const [stationary, moving] = split(facet, step);
      if (stationary) next.push(stationary);
      if (moving)
        next.push({
          ...moving,
          points: moving.points.map((point) =>
            rotateFold(point, step.crease, amount),
          ),
          face: amount === 1 ? (facet.face === 0 ? 1 : 0) : facet.face,
          layer: facet.layer + (amount > 0 ? 1 : 0),
        });
    }
    facets = next;
  }
  return facets.sort((a, b) => a.layer - b.layer);
}
