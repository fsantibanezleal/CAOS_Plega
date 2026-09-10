# Repository structure

| Path | Responsibility |
|---|---|
| `frontend/src/core/` | Typed projects, rigid geometry, diagnostics, pinned repairs, print plans and bounded FOLD documents |
| `frontend/src/render/` | Linked paper and print views; rendering consumes millimetre coordinates |
| `frontend/src/export/` | SVG/PDF, portable project/assembly exports and licensed embedded print font |
| `frontend/src/workspace.ts` | Project state, local recovery and share/import boundaries |
| `frontend/src/test/` | Independent numerical, safety, print and export regressions |
| `frontend/verify-workshop.mjs` | Actual built-application browser acceptance |
| `data/sources/` | Original bilingual project definitions and independent numeric fixtures |
| `data-pipeline/` | Plain Python deterministic compiler and verification CLI |
| `data/artifacts/` | Canonical generated JSON and source/compiler/artifact integrity metadata |
| `tests/` | Independent Python fixture and pipeline regressions |
| `scripts/` | Paired local commands, release identity, Pages staging and isolated delivery tests |
| `.github/workflows/` | Pinned quality, browser and exact-artifact Pages publication |
| `docs/geometry.md`, `docs/research/` | Restricted mathematical model and primary sources |
| `docs/fabrication*.md` | Print/export contract, checks and practical boundaries |
| `docs/architecture/`, `docs/guides/` | Decisions, maintainers' contracts and visitor workflow |
| `build/` | Ignored previews, staging receipts and test sandboxes |

Source JSON and the compiler produce the canonical artifacts and `frontend/src/core/starters.ts`. Never edit those generated files independently. `frontend/dist` is Vite output; `build/pages` is the final artifact after base-path validation, policy injection, offline-worker creation and hashing. Only the latter is eligible for Pages publication.

There is no Python package to install, model to train, network backend, account database or deployment key in this repository.
