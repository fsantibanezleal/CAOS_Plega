# Contributing

Explain a concrete failing workflow or invariant before changing behavior. Use a task branch and a pull request to `develop`; promote reviewed changes from `develop` to `main` separately. Preserve legitimate history and original project baselines. Keep code, derived data and documentation in the same review when their contract changes.

Run setup, then `scripts/test.*`, `scripts/build.*` and `scripts/verify-ui.*`. Install the locked browser explicitly with `scripts/install-browsers.*`. The [command reference](scripts/README.md) documents both supported shells. Format frontend changes with `npm --prefix frontend run format` and verify them with `npm --prefix frontend run format:check`.

For data changes, edit the original source JSON or compiler, intentionally run `.venv`'s Python with `data-pipeline/run.py generate`, review the generated diff, then run `verify`. Pipeline tests must use isolated sandboxes; normal CI verifies canonical data without regenerating it.

Geometry changes require an independent invariant or a meaningful counterexample, including endpoint behavior and exact print dimensions where relevant. A pose screenshot or dense angle sampling does not prove collision freedom. Preserve the difference between invalid, unsupported and uncertified results. Do not label a draft or repaired design physically validated without actual evidence.

UI changes preserve English/Spanish, both themes, keyboard operation, reduced motion, phone layouts, local recovery and the useful 2D output when WebGL is unavailable. Export regressions must inspect emitted coordinates or PDF dimensions, not merely successful function calls. Document supported input limits and invalid import behavior.

Use original designs or assets with explicit redistributable rights and provenance. Never commit secrets, machine-specific operator paths, private project samples or runtime credentials. See [SECURITY.md](SECURITY.md) before reporting a vulnerability. Include the checks run and any remaining limitation in the pull request; an unverified deployment is not delivered work.
