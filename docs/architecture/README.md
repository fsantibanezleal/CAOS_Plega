# Architecture

PLEGA is a static application with a deterministic offline data compiler. Pure TypeScript functions own physical coordinates, validation, repairs and print plans. React coordinates editable projects and presentation; Three.js renders those coordinates. SVG and PDF exporters consume the same print plan. Browser state never changes the mathematical source of truth.

| Decision | Contract |
|---|---|
| [ADR 0001: restricted rigid-paper model](0001-restricted-paper-model.md) | Explicit supported mechanisms, millimetres and separate failure/uncertified states |
| [ADR 0002: exact static publication and offline use](0002-static-publication-and-offline.md) | One tested Pages artifact, source identity, scoped cache and explicit updates |
| [ADR 0003: cut-paper sculpture](0003-cut-paper-sculptures.md) | Profiled panels and direct editing retain parent hinges and print geometry |
| [ADR 0004: kinetic choreography](0004-kinetic-choreography.md) | Multi-part motion in a connected workbench |
| [ADR 0005: reachable workbench](0005-reachable-workbench.md) | Every part is framed and editable across desktop and phone layouts |
| [ADR 0006: original project gallery](0006-original-project-gallery.md) | Original projects remain reversible starting points with deterministic geometry previews |
| [ADR 0007: origami sections](0007-origami-sections.md) | Distinct origami topologies, named sections and multi-state fold exploration are the public entry |

The [geometry API](../geometry-api.md) defines core interfaces; [fabrication validation](../fabrication-validation.md) defines independent export checks. The [pipeline](../../data-pipeline/README.md) owns original source-to-generated data. There is no backend, training pipeline or installable internal package.

Dependency versions are pinned in `frontend/package-lock.json`. Python processing uses 3.13 and the standard library. Node 24 is the CI runtime, with Node 22 also supported locally. Changes to either runtime or the numerical model require the relevant fixtures, artifact verification and browser tests before release.
