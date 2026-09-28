# Fold Viewer source provenance

- Upstream: https://github.com/FoldLab/fold-viewer
- Tag: `v0.1.0`; commit: `0dbda54af4b0b3d1f46b5e7f01f6e20451c869ca`
- License: MIT, retained in `LICENSE` here and in the published license notices.
- Included source: the runtime TypeScript, TSX and stylesheet files from `src`; upstream tests, build configuration and package metadata are excluded.
- Local integration: `validation.ts` replaces AJV's schema compilation, which requires dynamic JavaScript execution, with a strict JSON parser, structural cross-reference checks and SHA-256 verification of the one pinned same-origin lesson. Only `/lessons/crane/crane.fold.json` may be loaded. `GuideExperience.tsx` imports this source directly.

The authored crane geometry and instructions are separate Fold Spec assets with their own pinned source and MIT license. The PLEGA release checks verify the exact public lesson bytes before deployment.
