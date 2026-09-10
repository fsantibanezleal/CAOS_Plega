# Engine and fabrication API

`frontend/src/core/index.ts` exports readonly TypeScript data and pure functions. Cutwork triangulation uses Three.js's deterministic planar `ShapeUtils` without a renderer or GPU. The authoritative declarations are in `types.ts`. No renderer owns a second copy of the mathematical model.

| API | Result |
| --- | --- |
| `parseProject(unknown)` | Strict bounded project validation; structured failure without substituted defaults |
| `analyzeProject(project)` | Numeric diagnostics, actual closed/swept bounds and separate pose, print and FOLD gates |
| `poseProject(project, openingDeg)` | Common-frame material panels, physical edge roles and bounds; no fabricated unsupported pose |
| `makePrintPlan(project, options)` | Actual-size pieces, safe label boxes, sheet placements or explicit tiled-transfer clips |
| `proposeRepairs(project)` | Bilingual before/after proposals with exact numeric changes and remaining failures |
| `packLanes(project)` | Earliest feasible ordered packing that preserves pinned origins |
| `applyRepair(project, proposal)` | Stale, pin and declared-result validation followed by complete reanalysis |
| `makeFoldDocuments(project)` | Separate piece crease graphs and a multiframe collection, with compatibility/status metadata |
| `STARTERS`, `REPAIR_CASES` | Synchronous generated catalog with original English/Spanish metadata |
| `createModule(project, kind, label, color)` | Prevalidated printable part in an available motion lane, or unchanged-project capacity failure |
| `editMechanism(project, id, field, requested)` | Pin-preserving direct-edit endpoint clipped along its one-parameter geometric path |

Saved projects contain card W/H/margin/gap/blank/color/pins, and at most sixteen P or V mechanisms with IDs, labels, colors, gutter origins, parameters and field pins. Coordinates are millimetres. Opening angles are degrees in [0,180]. Resource limits include 128 KiB for JSON text, 80-character labels, 100-character titles, 48-character slug IDs, 0.1 to 2000 mm positive dimensions/gaps, and bounded origins. These are numerical/product limits, not measured material constraints.

Input parsing rejects unknown properties, duplicate identifiers, invalid colors, nonfinite values and incompatible pins. A failed closed fit can retain its real pose for diagnosis. Unsupported mechanics return no assembled mesh. A flat draft may remain possible if its own net is defined. Final fabrication is gated independently from a draft. Annotation and sheet checks run when constructing the print plan.

The page coordinate origin is bottom-left, +y upward. Each page reserves 14 mm for status and calibration inside its selected margins. Placements apply a 0 or 90 degree rotation followed by translation, always at scale one. Tile clips and registration marks are in the original piece's local coordinates; tiled layouts use rotation zero. They are transfer-only pages for a continuous material piece. Adapters must not silently shrink or crop a template.

Tab labels use centered axis-aligned boxes proven to lie inside their oblique convex tab polygons. Tiny annotation space returns a diagnostic; adapters separately verify glyph support and text fit. A physical slit has two material sides in 3D, so `printEdgeId` may map multiple visible edges to one flat cut instruction. Tessellation seams are not physical cuts/folds.

Repair proposals preserve pinned values and include a canonical before-state key. Applying a proposal checks both declared changes and the complete after-project. The key is a stale-state check, not a cryptographic signature. Lane packing uses complete y extrema including tabs, not sampled positions, and fails explicitly if fixed pins or capacity prevent placement.

Derived catalog bytes and compiler provenance are verified through the standard-library data pipeline. Generated `starters.ts` must not be manually edited. The FOLD output records independent flat patterns; optional consumer support for cuts and frames is not assumed.


The optional `cutwork` extension preserves schema-v1 imports. It holds a bounded profile, density and material web; see ADR0003. `PrintFace.holes` carries the exact aperture loops. A posed panel's vertices include the outline and hole loops and must be rendered through its triangle indices, never as one polygon. The same cut edges appear in the physical print plan. Cutwork labels never obscure voids. FOLD processing rejects graphs above5,000 cut/score segments per piece or12,000 total before pairwise intersection work; the dense project remains available for editing and PDF/SVG export.
