# Original design processing

This standard-library Python script validates the original bilingual workshop designs and independent numeric fixtures, then exports canonical JSON and the synchronous TypeScript starter catalog. It downloads nothing and needs no API keys.

Run `python data-pipeline/run.py generate` after intentionally changing source data or the compiler. Run `python data-pipeline/run.py verify` for read-only verification. Existing canonical artifacts are verified rather than silently regenerated during routine setup or CI.

For an isolated output tree, pass `--root <sandbox-directory>` to `generate`; only the public source JSON and compiler are copied when absent. Repeating generation is deterministic. `verify --root <sandbox-directory>` verifies that tree. Unit tests use separate temporary directories under `build/test-sandboxes` and preserve canonical data.

Inputs are `data/sources/projects.json` and `fixtures.json`. Outputs are `data/artifacts/projects.json`, `fixtures.json`, `integrity.json`, and `frontend/src/core/starters.ts`. Integrity metadata records byte counts and SHA-256 for the inputs, compiler and derived artifacts. UTF-8/LF is part of the deterministic byte contract. Do not manually edit generated files.

`python data-pipeline/author_gallery.py` deterministically refreshes only the twelve signature projects from documented original recipes. It preserves the twelve earlier projects and repair cases, independently checks every authored project's geometry, and writes the reviewable source catalog. Run `python data-pipeline/run.py generate` afterward and update the three changed data entries in `docs/asset-licenses.json` with their new byte counts and SHA-256 hashes. The catalog validator requires at least 24 original projects.

The fixture verifier checks tabulated positions using fixed lengths and angle dot products, along with conservation of sheet area, closed width, lane capacity and physical print conversion. These checks complement the TypeScript engine tests; neither is a physical assembly test. The twelve starters must pass the stated geometric checks, while two repair cases must retain their documented failure.

## Folding guide source indexes

`python data-pipeline/build_origami_club_index.py generate` and `python data-pipeline/build_origami_index.py generate` refresh **link-only** catalog indexes from Origami Club and Origami Resource Center. `verify` checks the committed index shape offline. `python data-pipeline/check_origami_plan_links.py generate` takes a dated reachability snapshot for every Resource Center file link; only HTTP 200 image/PDF responses without signed redirects enter the UI. The snapshot stores the resolved host but not expiring token-bearing URLs. Its `verify` command checks snapshot alignment with the committed index without network access. Source sites and destination links may change, so generation is an intentional research task, not part of a normal build. None of these pipelines downloads or republishes third-party diagrams.

`python data-pipeline/import_commons_diagrams.py verify` checks the selected Commons media and their per-file license metadata. `python data-pipeline/import_tavin_diagrams.py verify` checks fifteen licensed original PDFs, PNG previews, pinned PDF SHA-256 values and the manifest. Refreshing a Tavin PDF whose hash has changed requires a new file-level rights review; the importer refuses an unreviewed replacement. Generating previews requires Poppler `pdftoppm`. Attribution and content hashes are also recorded in `docs/asset-licenses.json`. See the [source audit](../docs/research/2026-09-27-origami-instruction-sources.md).

`python data-pipeline/build_community_tutorials.py generate` adds only short link labels and URLs for public creator-hosted tutorials at Paper Kawaii, Origami.me, Origami Plus and Origami Way. The Origami.me scan requires numbered folding steps on the live page to exclude editorial posts. Run `verify` for a read-only offline structural check. This index cannot be used to claim that external tutorials are bundled, animated or permanently available.
