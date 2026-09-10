# Original design processing

This standard-library Python script validates the original bilingual workshop designs and independent numeric fixtures, then exports canonical JSON and the synchronous TypeScript starter catalog. It downloads nothing and needs no API keys.

Run `python data-pipeline/run.py generate` after intentionally changing source data or the compiler. Run `python data-pipeline/run.py verify` for read-only verification. Existing canonical artifacts are verified rather than silently regenerated during routine setup or CI.

For an isolated output tree, pass `--root <sandbox-directory>` to `generate`; only the public source JSON and compiler are copied when absent. Repeating generation is deterministic. `verify --root <sandbox-directory>` verifies that tree. Unit tests use separate temporary directories under `build/test-sandboxes` and preserve canonical data.

Inputs are `data/sources/projects.json` and `fixtures.json`. Outputs are `data/artifacts/projects.json`, `fixtures.json`, `integrity.json`, and `frontend/src/core/starters.ts`. Integrity metadata records byte counts and SHA-256 for the inputs, compiler and derived artifacts. UTF-8/LF is part of the deterministic byte contract. Do not manually edit generated files.

The fixture verifier checks tabulated positions using fixed lengths and angle dot products, along with conservation of sheet area, closed width, lane capacity and physical print conversion. These checks complement the TypeScript engine tests; neither is a physical assembly test. The six starters must pass the stated geometric checks, while two repair cases must retain their documented failure.
