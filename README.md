# PLEGA

A paper mechanism workshop: design moving cards, understand why they cannot close, compare geometric repairs and export actual-size cut, score and assembly sheets.

The complete workflow runs in the browser without an account or remote computation. Supported mechanisms are a one-sheet parallel step and a symmetric triangular V-fold, composed in up to six separated motion lanes. These are known paper mechanisms; the application provides an integrated design-to-print workflow, not a claim of newly invented folding mathematics.

The workshop combines a linked moving-paper view and cut-sheet view, dimension editing, pinned repair proposals, local project recovery, portable files and assembly progress. Six original starters and deliberate failure cases make the mathematical limits visible. English/Spanish and light/dark presentation are part of the application.

The publication target is [GitHub Pages](https://fsantibanezleal.github.io/CAOS_Plega/). Publication is complete only when that site's `release.json` matches a clean promoted main revision and the published files have been independently verified. Current development work and local previews are not a release receipt.

## Run locally

Use Python 3.13 and Node 24 (Node 22 is also supported). From the repository root:

```powershell
./scripts/setup.ps1
./scripts/dev.ps1
```

On Linux/macOS, use `bash scripts/setup.sh` and `bash scripts/dev.sh`. Setup creates `.venv`, installs the locked frontend dependencies, verifies existing canonical data and creates `.env` only when absent. Python processing uses the standard library and downloads no design data. Development opens at `http://127.0.0.1:5903/CAOS_Plega/`.

```powershell
./scripts/test.ps1
./scripts/build.ps1
./scripts/install-browsers.ps1
./scripts/verify-ui.ps1
```

The browser installation is explicit and uses the Playwright version in the lockfile. `scripts/preview.ps1` serves the exact staged artifact at `http://127.0.0.1:4903/CAOS_Plega/`. See the [command reference](scripts/README.md) for shell equivalents, browser caches and clean-release builds.

## Design, check and print

Start with a project, set the card size and opening angle, then edit a mechanism. A failed closed fit, unsupported configuration and uncertified lane overlap are different results. Pin dimensions that must stay fixed, inspect a repair's actual changes and apply or undo it. Save a project file before sharing or changing devices.

Exports include vector SVG/PDF at millimetre scale, A4/Letter layouts, explicit tiled transfer patterns, project JSON, bounded FOLD interchange and assembly instructions. Print at actual size and measure the calibration marks. Draft sheets are not approved fabrication sheets; oversized tiled patterns are transferred to one continuous blank. The [workshop guide](docs/guides/workshop.md) and [fabrication guide](docs/fabrication.md) explain the process.

Once a production installation has cached successfully, its same-origin assets support offline use. Updates wait for an explicit user action so work can be saved first. The public release identity always comes from the network; an offline session cannot attest the current deployed version. Local browser storage is not a backup. See [saving and offline use](docs/guides/saving-and-offline.md).

## Engineering and evidence

The [architecture](docs/architecture/README.md), [restricted geometry](docs/geometry.md), [source assumptions](docs/research/sources-and-assumptions.md), [fabrication validation](docs/fabrication-validation.md) and [deterministic pipeline](data-pipeline/README.md) separate mathematical claims, software verification and physical limitations. [Repository structure](STRUCTURE.md) maps their implementation.

The main/develop/PR workflow validates source and derived data, tests the engine and exporters, builds one artifact, runs the browser gate over that artifact, checks its bytes again and publishes it only from main. The Pages deployment uses GitHub's short-lived OIDC identity. It needs no runtime key, private package or server process.

Code is licensed under Apache-2.0. Original project data declares MIT licensing in its source manifest. Cited research supports the documented geometric model; third-party artwork and templates are not redistributed. Rigid panels and zero-thickness hinges do not predict paper stiffness, adhesive performance or printer calibration.

Developed by Felipe Santibanez-Leal.
