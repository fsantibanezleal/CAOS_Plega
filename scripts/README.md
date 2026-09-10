# Local commands and release delivery

Use Python 3.13 and Node 24 (22 also supported), with Git available. Every command below has `.ps1` and `.sh` launchers. On Windows use `./scripts/setup.ps1`; on Linux/macOS use `bash scripts/setup.sh`. Both call the same plain Python dispatcher. Dependencies stay in `.venv` and `frontend/node_modules`; no internal package is installed globally.

| Command | Behavior |
|---|---|
| `setup` | Create/reuse `.venv`, install declared Python requirements and exact npm lock, verify existing canonical data or generate it only if absent, create `.env` only if absent |
| `dev` | Read-only data verification, then Vite at `127.0.0.1:5903/`; no service worker |
| `verify-data` | Strict source/compiler/generated-byte verification; no mutation |
| `test` | Data verification, Python numeric/pipeline/delivery tests, frontend unit tests and TypeScript checks |
| `build` | Capture source before Vite, stage `build/pages`, add policy/404/offline worker, reject source drift and hash the final artifact |
| `preview` | Verify and serve `build/pages` at `127.0.0.1:4903/` |
| `install-browsers` | Explicitly install Chromium for the lockfile's Playwright version |
| `verify-ui` | Verify the artifact, start an owned preview server, run the actual browser harness, then stop that server |
| `deploy --revision <40-character-main-sha>` | Check current remote main, then explicitly dispatch the Pages workflow for that SHA; does not upload a local preview |

Set `PLAYWRIGHT_BROWSERS_PATH` before installation and verification to use a chosen local browser cache. Otherwise Playwright uses its standard per-user cache. On Linux CI the pinned browser is installed with its required system libraries using `npm exec --no -- playwright install --with-deps chromium` from `frontend/`.

The browser harness accepts `PLEGA_QA_URL` for an explicitly selected existing server and `PLEGA_QA_OUTPUT` for evidence outside the tracked source. Without a URL, the wrapper refuses an occupied port 4903 and starts its own verified artifact. It never silently reuses another application's listener. The build itself has no test-server dependency.

Local `build` permits a dirty preview and marks it `plega-preview/v1`. For a publishable build:

```powershell
./scripts/test.ps1
./scripts/build.ps1 --require-clean --revision <exact-40-character-sha>
./scripts/verify-ui.ps1
```

`scripts/release.py verify` rechecks every served file against `build/pages/release.json`. That manifest excludes itself to avoid a hash cycle; the uploaded identity artifact also preserves the manifest and build receipt. The source receipt compares all nonignored source bytes before and after Vite. Generated assets and browser reports must stay in ignored directories or outside the repository.

The single **Quality and Pages** workflow runs for PRs to main/develop and pushes to those branches; task pushes do not duplicate the PR gate. Its verify job tests, builds, stages and browser-checks one artifact. Main publication consumes that exact upload through OIDC without rebuilding. Configure Pages to use workflows and restrict the `github-pages` environment to `main` before the initial publication. The workflow requires host `plega.fasl-work.com` and an empty GitHub Pages base path (the app serves at `/`). The generated `CNAME` records the binding in the artifact; Pages settings remain authoritative for workflow publication.

The generated worker preloads same-origin release assets, uses network-first navigation with the cached entry as an offline fallback, and never caches `release.json`. Cache names begin `plega-`; activation removes only older caches with that prefix. New workers wait. The UI must save work before explicitly messaging `{type: 'PLEGA_ACTIVATE_UPDATE'}` and reloading after activation. No `skipWaiting` runs during installation, and development registers no worker.

After publication, verify the default-TLS public URL, expected revision/clean identity, all manifest file hashes, project-prefix resources, representative desktop/phone flows, local save/export and offline/update behavior. Archive the original Pages artifact and identity for a versioned release; do not rebuild historical source and call it the original artifact. A Pages workflow dispatch alone is not publication evidence.
