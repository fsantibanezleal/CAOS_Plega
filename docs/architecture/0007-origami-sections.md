# ADR 0007: Origami sections as the primary PLEGA experience

## Status

Accepted — 2026-09-12

## Context

The previous Kinetic Studio presented many projects through the same two mechanism primitives. Changing a color, texture or panel label could not make those projects meaningfully different. A public showcase needs the structure of the paper to change as the visitor explores it.

Origami research distinguishes crease families and their kinematics. Miura-ori is a repeating parallelogram tessellation; waterbomb is an alternating radial vertex; polyhedral nets, radial sculptures and saddle tessellations expose different relationships between facets, vertices, layers and creases. The [FOLD 1.2 specification](https://github.com/edemaine/fold/blob/main/doc/spec.md) provides a public interchange vocabulary, while the waterbomb study documents the alternating-crease base and its tessellations ([Symmetric waterbomb origami](https://pmc.ncbi.nlm.nih.gov/articles/PMC4950188/)).

## Decision

PLEGA's public root is now **Origami Sections**, an atlas and lab built around eight original parameterized studies. The atlas is a genuine entry surface with filters and pattern previews. The lab keeps a selected construction in a full viewport with:

- a Three.js mesh made from the study's actual facet topology;
- a crease-map state, a continuously folded state, and an exploded-layer state;
- named sections (vertex, crease, facet, unit and layer) that can be selected from the 3D surface or the synchronized inspector;
- a four-step fold sequence and a continuous fold-progress control;
- field notes that state what changes at the selected depth and what the model does not claim.

The former mechanism workbench remains available at `?mechanism=1`; the original workshop remains at `?legacy=1`. This preserves saved projects and the checked print pipeline while making the public entry a different, richer concept.

## Consequences

The origami catalog is authored educational geometry, not a scan, stress solver or physical assembly certificate. Each study deliberately exposes a different topology and interaction path; no project is represented as a recolored rectangle. The browser acceptance suite checks the atlas count, lab transition, facet count, fold motion, mode changes, section selection and phone layout. Future studies should add a distinct topology and section vocabulary rather than another skin over the same mechanism.
