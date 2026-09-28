# ADR 0009: An origami model requires a complete animated construction

Status: accepted for the public guide. Date: 2026-09-28.

## Context

The prior guide counted 2,042 catalog entries: four elementary animations, 32 static sheets, and 2,006 external links. This was a useful source index but not the product the user requested. In particular, opening a static sheet or a remote page cannot provide on-site motion from flat paper to finished model.

## Decision

The public model library admits only a lesson with an identified finished form, a complete ordered construction, executable motion for every movement, and step instructions. Pure locating/check steps may hold a pose. Each admitted lesson must be browser-tested at its first, intermediate and completed poses, through whole-sequence playback, direct step selection, phone layout and source/license presentation. The displayed count is the number of admitted lessons, never the number of links, diagrams, color variants or isolated fold exercises.

The current admitted lesson is the [Fold Spec crane](https://github.com/FoldLab/fold-spec/tree/0ee55e1b748e46101b9bb20e7b285fcaaa07e30f/examples/crane), under MIT, with 44 teaching steps and 40 resolved operations. Its exact source bytes and license are committed and hashed in the asset inventory. `scripts/import_foldspec_crane.py` produces and checks a public viewing copy that changes late-step camera framing only; the source geometry, operation order, timing and instructions are retained. The player vendors [Fold Viewer 0.1.0](https://github.com/FoldLab/fold-viewer/tree/v0.1.0) source under its MIT license, with the changes documented in `frontend/src/vendor/fold-viewer/PROVENANCE.md`. The npm package compiled an AJV schema with dynamic JavaScript, which the production CSP blocks. PLEGA replaces that runtime validation path with an exact-byte SHA-256 check for its pinned same-origin lesson and structural checks; it does not relax the CSP. Vendoring also avoids the package's narrow Three.js peer range while retaining Three.js 0.185.1. The crane player and other Three.js areas must pass built-browser acceptance together before release.

The four original elementary sequences live under Fold basics and are not counted as complete models. Static diagrams may appear as clearly marked optional companion references. The historical source manifests remain in the repository for rights/provenance research but do not populate the model library. Old diagram deep links open the model experience instead of a static sheet.

## Consequences and limits

The release honestly shows one complete animated model, not a thousand. The crane is authored geometric motion with documented approximations; the software does not certify real-paper foldability, zero collisions, accessibility-user testing or a general solver. The source license is preserved. A future lesson requires its own rights review, full motion data, completed-form review and browser acceptance before inclusion. Automated extraction from PDFs, videos or crease patterns can assist authoring, but it cannot silently turn unverified intermediate states into a complete lesson or inflate the count.

The page scrolls normally through every step. On desktop the player remains alongside the step list, and on phones selecting a step returns to its animation. Browser acceptance checks actual document scroll and reachability at laptop and phone viewport sizes.
