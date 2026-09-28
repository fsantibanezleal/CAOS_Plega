# ADR 0008: Guided origami library and rights-aware plan index

## Status

Accepted, 2026-09-27 for this user-directed redesign.

## Context

PLEGA's existing sections atlas is a study of eight geometric structures, not a broad origami instruction guide. The user wants categorized plans, animated step-by-step guidance, companion text and illustrations, and preservation of the previous app as a sub-area. Research in `docs/research/2026-09-27-origami-instruction-sources.md` found no verified open corpus containing thousands of redistributable plans with machine-readable fold sequences.

## Decision

The root becomes a guide. The sections atlas remains at `?sections=1`, the earlier kinetic paper workbench at `?mechanism=1`, and the historical workshop at `?legacy=1`. The guide uses three explicit catalog lanes:

1. Original guided plans with independently authored step states, text and motion.
2. Locally hosted, individually licensed printable diagram sheets with attribution.
3. External free-to-access plan links whose diagram bytes remain at source.

The index generator retains URL, short label, category and listing page. It does not fetch protected diagrams. Imported Commons media and individually reviewed Tavin PDFs carry machine-readable license manifests and pinned hashes. The UI must not give an external link a false step count, animation button, or local download promise.

## Consequences

The library can grow without conflating discoverability with rights or quality. A thousand indexed links would not be a thousand animated guides. The static GitHub Pages deployment stays appropriate; guided sequences, catalog and licensed illustrations are bundled, with no login, server or secret. The existing sections and workshop implementations remain intact.
