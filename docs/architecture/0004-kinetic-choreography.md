# ADR 0004: Kinetic Studio as the primary Plega surface

- Status: accepted
- Date: 2026-09-10

## Context

The earlier editor exposed the paper engine through a starter picker and two mechanism types. That made the geometric work correct but made the public experience feel like a static catalogue: the object, motion and fabrication output were separated by navigation and a single zoom did not communicate what changed.

## Decision

Make Kinetic Studio the default route. The surface is a fixed workbench with three connected areas:

1. **The cast** lists every active part, maps its motion lane, and offers six cutwork voices (Arcade, Rib, Wing, Lattice, Leaf and Panel).
2. **The stage** renders the shared Three.js scene, camera presets, direct handles, a continuous 0–180° opening scrubber and the actual print plan from the same `Project` state.
3. **The director's desk** exposes the selected part's role, dimensions and cutwork language, with actions that move the same project into motion or fabrication.

The old editor remains source-complete and can be opened with `?legacy=1` so previous projects and release history stay reviewable. No third-party runtime service, account, private asset or server process is introduced.

## Consequences

The default route now communicates cause and effect in one viewport and has a meaningful phone layout. The core model, validation, exporters, data pipeline and original starters remain unchanged. The add-part action still uses `createModule`, so a part is only committed when a checked motion lane exists; a full card reports that constraint instead of silently corrupting geometry. Physical paper strength, adhesive behaviour and printer calibration remain outside the analytic certificate.
