export type FoldFamily =
  | "tessellation"
  | "base"
  | "sculpture"
  | "polyhedron"
  | "radial";

export type OrigamiSection = {
  id: string;
  label: string;
  role: "vertex" | "crease" | "facet" | "layer" | "unit";
  description: string;
};

export type OrigamiProject = {
  id: string;
  title: string;
  subtitle: string;
  family: FoldFamily;
  familyLabel: string;
  description: string;
  principle: string;
  palette: [string, string, string];
  sections: OrigamiSection[];
  steps: { label: string; detail: string; amount: number }[];
  rows: number;
  columns: number;
  difficulty: "entry" | "study" | "advanced";
};

/** Original parameterized studies. The geometry is an educational model of
 * fold relationships; it is not a scan or a claim of a canonical finished
 * figure. Names identify the construction family shown in the atlas. */
export const ORIGAMI_PROJECTS: readonly OrigamiProject[] = [
  {
    id: "miura-field",
    title: "Miura field",
    subtitle: "compressible tessellation",
    family: "tessellation",
    familyLabel: "Tessellation",
    description:
      "A repeating parallelogram field turns one sheet into a synchronized surface.",
    principle:
      "Every unit shares its hinges. Change one fold and the whole field answers.",
    palette: ["#e4c7a5", "#d36e54", "#2f6673"],
    rows: 4,
    columns: 8,
    difficulty: "study",
    sections: [
      {
        id: "cell",
        label: "Unit cell",
        role: "unit",
        description: "One repeat sets the rhythm for the sheet.",
      },
      {
        id: "ridge",
        label: "Ridge chain",
        role: "crease",
        description: "Mountain creases carry the diagonal load.",
      },
      {
        id: "valley",
        label: "Valley field",
        role: "crease",
        description: "Valleys reverse the slope and preserve continuity.",
      },
      {
        id: "edge",
        label: "Boundary lock",
        role: "layer",
        description: "The perimeter closes the repeating field.",
      },
    ],
    steps: [
      {
        label: "Grid",
        detail: "Lay out the alternating parallelograms.",
        amount: 0,
      },
      {
        label: "Score",
        detail: "Mark mountain and valley chains.",
        amount: 24,
      },
      {
        label: "Compress",
        detail: "Fold the field as one mechanism.",
        amount: 58,
      },
      {
        label: "Deploy",
        detail: "Open the sheet into its full span.",
        amount: 100,
      },
    ],
  },
  {
    id: "waterbomb-orbit",
    title: "Waterbomb orbit",
    subtitle: "alternating vertex base",
    family: "base",
    familyLabel: "Base",
    description:
      "Six crease rays turn a square into a breathing ring of triangular facets.",
    principle:
      "The center is the hinge: mountains and valleys alternate around a single vertex.",
    palette: ["#dfe8df", "#d68b5a", "#3e687a"],
    rows: 3,
    columns: 8,
    difficulty: "entry",
    sections: [
      {
        id: "vertex",
        label: "Central vertex",
        role: "vertex",
        description: "Six rays meet at the moving center.",
      },
      {
        id: "mountains",
        label: "Mountain rays",
        role: "crease",
        description: "The warm creases fold toward the viewer.",
      },
      {
        id: "valleys",
        label: "Valley rays",
        role: "crease",
        description: "Cool creases recede between the peaks.",
      },
      {
        id: "pocket",
        label: "Pocket layer",
        role: "layer",
        description: "Adjacent flaps form a continuous pocket.",
      },
    ],
    steps: [
      {
        label: "Square",
        detail: "Start with the diagonal and cross axes.",
        amount: 0,
      },
      { label: "Star", detail: "Gather the six radial creases.", amount: 34 },
      {
        label: "Pocket",
        detail: "Invert alternating triangular flaps.",
        amount: 66,
      },
      {
        label: "Orbit",
        detail: "Open the ring without breaking its vertex.",
        amount: 100,
      },
    ],
  },
  {
    id: "bird-base",
    title: "Bird base",
    subtitle: "four-flap articulation",
    family: "base",
    familyLabel: "Base",
    description:
      "A diamond body and four long flaps make a navigable preform for a flying figure.",
    principle:
      "The long flaps share a compact center, so a small motion creates a large silhouette.",
    palette: ["#e8d6be", "#b2676f", "#405b78"],
    rows: 2,
    columns: 4,
    difficulty: "study",
    sections: [
      {
        id: "body",
        label: "Body diamond",
        role: "facet",
        description: "The central diamond stabilizes the preform.",
      },
      {
        id: "wing",
        label: "Wing flaps",
        role: "layer",
        description: "Two flaps sweep apart as the model opens.",
      },
      {
        id: "tail",
        label: "Tail flap",
        role: "facet",
        description: "The rear flap counterbalances the head.",
      },
      {
        id: "head",
        label: "Head flap",
        role: "facet",
        description: "A short fold changes the profile at the tip.",
      },
    ],
    steps: [
      {
        label: "Precrease",
        detail: "Set the diagonal square grid.",
        amount: 0,
      },
      {
        label: "Collapse",
        detail: "Bring four flaps into one diamond.",
        amount: 42,
      },
      {
        label: "Spread",
        detail: "Lift the wing pair from the body.",
        amount: 72,
      },
      {
        label: "Balance",
        detail: "Tune head and tail as a silhouette.",
        amount: 100,
      },
    ],
  },
  {
    id: "modular-cube",
    title: "Modular cube",
    subtitle: "six-panel net",
    family: "polyhedron",
    familyLabel: "Polyhedron",
    description:
      "A connected net folds into a cube while its six panels remain traceable.",
    principle:
      "The same flat pattern can be inspected as a net, a hinge sequence, or a solid.",
    palette: ["#e9e1ce", "#cf775c", "#3f7775"],
    rows: 2,
    columns: 3,
    difficulty: "entry",
    sections: [
      {
        id: "net",
        label: "Cross net",
        role: "unit",
        description: "Five faces surround a sixth closure panel.",
      },
      {
        id: "hinges",
        label: "Hinge chain",
        role: "crease",
        description: "Four folds lift the walls in sequence.",
      },
      {
        id: "lid",
        label: "Top face",
        role: "facet",
        description: "The final face closes the volume.",
      },
      {
        id: "layers",
        label: "Layer order",
        role: "layer",
        description: "Visible seams explain which face passes over another.",
      },
    ],
    steps: [
      {
        label: "Net",
        detail: "Trace six square faces on one sheet.",
        amount: 0,
      },
      { label: "Walls", detail: "Raise the four side hinges.", amount: 48 },
      {
        label: "Corner",
        detail: "Align the diagonal corner seams.",
        amount: 78,
      },
      {
        label: "Lock",
        detail: "Close the top face into a volume.",
        amount: 100,
      },
    ],
  },
  {
    id: "lotus-radial",
    title: "Lotus radial",
    subtitle: "petal fan",
    family: "radial",
    familyLabel: "Radial sculpture",
    description:
      "Eight tapered petals rise from a shared center and can be opened as a flower-like canopy.",
    principle:
      "Radial symmetry makes every petal a chapter of the same continuous motion.",
    palette: ["#f0decf", "#cf6a8b", "#75547b"],
    rows: 2,
    columns: 8,
    difficulty: "study",
    sections: [
      {
        id: "core",
        label: "Core rosette",
        role: "vertex",
        description: "The center distributes the eight petal hinges.",
      },
      {
        id: "petal",
        label: "Petal fan",
        role: "facet",
        description: "Tapered facets flare outward as the fold opens.",
      },
      {
        id: "back",
        label: "Back valleys",
        role: "crease",
        description: "Reverse creases keep the fan from twisting.",
      },
      {
        id: "rim",
        label: "Outer rim",
        role: "layer",
        description: "The perimeter shows the final silhouette.",
      },
    ],
    steps: [
      {
        label: "Rays",
        detail: "Divide the sheet into eight sectors.",
        amount: 0,
      },
      { label: "Pleat", detail: "Alternate the petal valleys.", amount: 36 },
      { label: "Lift", detail: "Raise the petal shoulders.", amount: 70 },
      { label: "Bloom", detail: "Open the radial canopy.", amount: 100 },
    ],
  },
  {
    id: "twist-tower",
    title: "Twist tower",
    subtitle: "stacked pleat",
    family: "tessellation",
    familyLabel: "Tessellation",
    description:
      "Rotating pleated bands climb from a square footprint into a faceted tower.",
    principle:
      "A repeated turn converts a flat strip into height while each band stays measurable.",
    palette: ["#e4e4d9", "#c78d53", "#3d627d"],
    rows: 6,
    columns: 6,
    difficulty: "advanced",
    sections: [
      {
        id: "base",
        label: "Footprint",
        role: "unit",
        description: "The first band anchors the tower.",
      },
      {
        id: "turn",
        label: "Turn sequence",
        role: "crease",
        description: "Each band rotates by the same signed angle.",
      },
      {
        id: "spine",
        label: "Central spine",
        role: "layer",
        description: "The inside edges remain connected as height grows.",
      },
      {
        id: "cap",
        label: "Cap fold",
        role: "facet",
        description: "The final band closes the silhouette.",
      },
    ],
    steps: [
      {
        label: "Bands",
        detail: "Divide the strip into six repeats.",
        amount: 0,
      },
      { label: "Pleat", detail: "Score alternating diagonals.", amount: 30 },
      {
        label: "Turn",
        detail: "Rotate each band around its spine.",
        amount: 68,
      },
      { label: "Rise", detail: "Set the tower at full height.", amount: 100 },
    ],
  },
  {
    id: "star-lantern",
    title: "Star lantern",
    subtitle: "radial perforation",
    family: "radial",
    familyLabel: "Radial sculpture",
    description:
      "Concentric points and alternating folds turn a flat disc into a self-supporting lantern.",
    principle:
      "The ring spacing controls the silhouette; the center and rim are two different layers.",
    palette: ["#e8e2d2", "#d47a4b", "#426d80"],
    rows: 3,
    columns: 12,
    difficulty: "advanced",
    sections: [
      {
        id: "hub",
        label: "Central hub",
        role: "vertex",
        description: "The hub keeps every ray synchronized.",
      },
      {
        id: "ring",
        label: "Accordion ring",
        role: "unit",
        description: "The middle ring repeats a zigzag module.",
      },
      {
        id: "rays",
        label: "Star rays",
        role: "facet",
        description: "Long triangles catch the light as they rise.",
      },
      {
        id: "rim",
        label: "Hanging rim",
        role: "layer",
        description: "The outside edge closes the lantern volume.",
      },
    ],
    steps: [
      { label: "Circle", detail: "Mark three concentric rings.", amount: 0 },
      { label: "Ray", detail: "Connect alternating star points.", amount: 38 },
      { label: "Gather", detail: "Bring the inner ring upward.", amount: 72 },
      {
        label: "Glow",
        detail: "Open the lantern to its final volume.",
        amount: 100,
      },
    ],
  },
  {
    id: "hypar-surface",
    title: "Hypar surface",
    subtitle: "saddle tessellation",
    family: "sculpture",
    familyLabel: "Sculpture",
    description:
      "A checkerboard of lifted triangles becomes a saddle-like surface with a readable crease field.",
    principle:
      "Opposite corners move together: the surface gains curvature without adding material.",
    palette: ["#e1e6e3", "#c85e58", "#356d70"],
    rows: 5,
    columns: 5,
    difficulty: "advanced",
    sections: [
      {
        id: "saddle",
        label: "Saddle cell",
        role: "unit",
        description: "One four-triangle cell carries the curvature.",
      },
      {
        id: "cross",
        label: "Cross creases",
        role: "crease",
        description: "The diagonals alternate mountain and valley.",
      },
      {
        id: "high",
        label: "High corners",
        role: "vertex",
        description: "Opposite corners rise together.",
      },
      {
        id: "low",
        label: "Low corners",
        role: "layer",
        description: "The remaining corners recede below the sheet.",
      },
    ],
    steps: [
      { label: "Mesh", detail: "Tile the sheet with square cells.", amount: 0 },
      { label: "Cross", detail: "Add the diagonal crease pairs.", amount: 28 },
      { label: "Saddle", detail: "Lift alternating corners.", amount: 64 },
      {
        label: "Surface",
        detail: "Balance the whole field as one skin.",
        amount: 100,
      },
    ],
  },
];

export const familyLabels: Record<FoldFamily | "all", string> = {
  all: "All studies",
  tessellation: "Tessellation",
  base: "Bases",
  sculpture: "Sculpture",
  polyhedron: "Polyhedra",
  radial: "Radial",
};
