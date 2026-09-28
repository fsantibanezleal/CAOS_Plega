# PLEGA

PLEGA is a no-login origami folding guide with a searchable, categorized catalog. The root experience combines original animated elementary lessons with locally downloadable, license-reviewed illustrated sheets and external links to free origami guides. The distinction is explicit: an indexed link is not a hosted plan or an on-site animation.

The original folding lessons animate paper geometry step by step, with bilingual instructions, alignment checks, playback and saved place. Thirty-two individually licensed illustrated sheets can be enlarged and downloaded; fifteen include the original PDF. Source, author and license remain visible. The catalog contains 2,042 entries, including 2,006 external tutorial pages or file links that broaden discovery without republishing creators' work. Entries are source pages, not 2,042 unique designs or animations. The [source audit](docs/research/2026-09-27-origami-instruction-sources.md) and [guide decision](docs/architecture/0008-guided-origami-library.md) document rights and limits.

The earlier Origami Sections atlas remains at `?sections=1`, with eight fold-topology studies and synchronized 3D, crease-map and sequence views. Kinetic Studio remains at `?mechanism=1`, with its 24 editable cut-paper projects, direct handles, geometric checks and fabrication files. The first workshop remains at `?legacy=1`; saved projects and the deterministic print pipeline are preserved.

Kinetic Studio fills the viewport with a live object, a part navigator, and an inspector. Select any part from the object, the cast, or its true card position to frame it; drag projected 3D handles to change dimensions. Edit card size, part identity, color, aperture density, and protected paper web while the same project drives continuous motion and its cut plan. The prominent gallery offers 24 original projects with geometry-based previews; each can be loaded and undone. The previous workshop remains available at `?legacy=1`; existing projects and geometry remain intact. See the [workbench decision record](docs/architecture/0005-reachable-workbench.md), [Kinetic Studio decision record](docs/architecture/0004-kinetic-choreography.md), and [sculpture and editing contract](docs/architecture/0003-cut-paper-sculptures.md).

[Open PLEGA](https://plega.fasl-work.com/) or download a [versioned release](https://github.com/fsantibanezleal/CAOS_Plega/releases). GitHub Pages serves the exact artifact tested in CI. Each release includes the deployed file hashes, clean source revision and publication evidence; the live `release.json` identifies the running version.

## Run locally

Use Python 3.13 and Node 24 (Node 22 is also supported). From the repository root:

```powershell
./scripts/setup.ps1
./scripts/dev.ps1
```

On Linux/macOS, use `bash scripts/setup.sh` and `bash scripts/dev.sh`. Setup creates `.venv`, installs the locked frontend dependencies, verifies existing canonical data and creates `.env` only when absent. Python processing uses the standard library and downloads no design data. Development opens at `http://127.0.0.1:5903/`.

```powershell
./scripts/test.ps1
./scripts/build.ps1
./scripts/install-browsers.ps1
./scripts/verify-ui.ps1
```

The browser installation is explicit and uses the Playwright version in the lockfile. `scripts/preview.ps1` serves the exact staged artifact at `http://127.0.0.1:4903/`. See the [command reference](scripts/README.md) for shell equivalents, browser caches and clean-release builds.

## Design, check and print

Start with a project, set the card size and opening angle, then edit a mechanism. A failed closed fit, unsupported configuration and uncertified lane overlap are different results. Pin dimensions that must stay fixed, inspect a repair's actual changes and apply or undo it. Save a project file before sharing or changing devices.

Exports include vector SVG/PDF at millimetre scale, A4/Letter layouts, explicit tiled transfer patterns, project JSON, bounded FOLD interchange and assembly instructions. Print at actual size and measure the calibration marks. Draft sheets are not approved fabrication sheets; oversized tiled patterns are transferred to one continuous blank. The [workshop guide](docs/guides/workshop.md) and [fabrication guide](docs/fabrication.md) explain the process.

Once a production installation has cached successfully, its same-origin assets support offline use. Updates wait for an explicit user action so work can be saved first. The public release identity always comes from the network; an offline session cannot attest the current deployed version. Local browser storage is not a backup. See [saving and offline use](docs/guides/saving-and-offline.md).

## Engineering and evidence

The [architecture](docs/architecture/README.md), [restricted geometry](docs/geometry.md), [source assumptions](docs/research/sources-and-assumptions.md), [fabrication validation](docs/fabrication-validation.md) and [deterministic pipeline](data-pipeline/README.md) separate mathematical claims, software verification and physical limitations. [Repository structure](STRUCTURE.md) maps their implementation.

The main/develop/PR workflow validates source and derived data, tests the engine and exporters, builds one artifact, runs the browser gate over that artifact, checks its bytes again and publishes it only from main. The Pages deployment uses GitHub's short-lived OIDC identity. It needs no runtime key, private package or server process. The link catalogs can be regenerated deliberately by the documented research pipeline; routine builds use committed snapshots and need no network access beyond dependencies.

Code is licensed under Apache-2.0. Original project data declares MIT licensing in its source manifest. Selected third-party diagram assets are redistributed under their own recorded Creative Commons or public-domain terms; all other third-party plans stay at their source sites. Rigid panels and zero-thickness hinges do not predict paper stiffness, adhesive performance or printer calibration.

Developed by Felipe Santibanez-Leal.
