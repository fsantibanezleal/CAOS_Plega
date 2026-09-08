# Public repository security and license audit

Audit snapshot: 2026-09-07 UTC. This review covers the initial public repository and the locally implemented workshop before its first implementation release. It is a bounded inspection, not a claim that every possible vulnerability or license issue has been ruled out.

## Scope and results

The source/history scan inspected 101 current files, including original source data, derived data artifacts, frontend public data, application code, export adapters, delivery scripts, workflow files and public documentation. It also inspected every reachable blob in the initial Git history: one commit, `159675b1cea68d5f8c92b603bad9547205dbc7da`, containing five tracked files. Ignored dependency installations, local environments, browser reports and build outputs were excluded from that source count. The distribution artifact has a separate gate below.

No candidate private key, recognized provider credential, credential-bearing URL, long assigned secret, private operator path, private management-repository URL or private network address was found by the patterns checked. Manual review found no personal project notes, operator configuration, proprietary asset binary or copied research figure in the public source/data scope. No potential secret value is reproduced in this report. Hashes and filenames, rather than file contents, were recorded in the local audit receipt.

The project contract requires a static public app with no visitor accounts, backend or runtime credentials. Current source uses same-origin font delivery, local browser project storage and user-initiated portable downloads. Imported and shared project JSON passes bounded schema/numeric validation. Text remains React text or escaped export text; arbitrary HTML, SVG and foreign geometry imports are not accepted. Shared links contain the editable project in the URL fragment and exclude local notes and assembly progress. A project label itself can still contain personal information chosen by its author.

The ignore rules exclude runtime environment files, private-key containers, logs, dependencies and build outputs; the committed environment example contains comments only. CI uses pinned Action revisions, read-only default permissions, checkout without persisted credentials and a dedicated Pages deployment job using OIDC. The release script requires exact clean source for publication, checks base-path resource references and refuses hidden/key/source-map files in its static file map. These source observations still require actual built-browser and publication verification.

## Current GitHub protection readback

The repository was independently read back as **public**, with `main` as its default branch. Secret scanning and secret-scanning push protection were enabled, and the secret-scanning alert endpoint returned an empty list. Non-provider pattern scanning and validity checks were disabled at this snapshot.

Vulnerability alerts were initially disabled. After the coordinating implementation enabled them, an independent readback succeeded and the Dependabot alert list was empty. Automated Dependabot security-update pull requests remained disabled. No settings were changed by this audit. These are point-in-time configuration and alert observations, not an assurance about future dependencies or all unrecognized secrets.

## Dependency and asset licenses

`npm audit` reported **zero known vulnerabilities** across the locked dependency graph at the snapshot. The lockfile contains 178 package records and no unknown license declaration: MIT, Apache-2.0, BSD-3-Clause, ISC, 0BSD, a combined MIT/Zlib declaration and one development-data CC-BY-4.0 declaration. Eleven runtime package entries were reviewed separately. See [the exact dependency inventory](dependency-licenses.json).

Package declarations alone are insufficient for prebundled dependencies. Inspection also identified Apache-2.0 Brotli and MIT component notices inside Fontkit, Zlib notices inside pako, and Feather-derived MIT portions inside Lucide's ISC package. Those notices and the other runtime license texts are retained in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Fontkit's published package declares MIT in its manifest and README but omits a standalone license file; the notice documents that packaging limitation and preserves supplied attribution without inventing a copyright year.

Original application code uses Apache-2.0; the original design catalog and repair data are declared MIT. The [asset manifest](asset-licenses.json) records the original vector mark, source/derived design data and the pinned Noto Sans font with file hashes. The Noto font is distributed under OFL-1.1, with its complete upstream license and provenance retained. UI system-font lookup does not redistribute proprietary font binaries. Research papers are linked for context; their figures, templates and artwork are not copied into the app.

The audit corrected a standalone-export notice gap: each SVG now retains the complete font license in XML metadata alongside its embedded font. An independent XML parser checks the exact license-text hash in every exported sheet. This targeted check passed; the license addition does not change pattern geometry. PDF text embedding remains distinct from redistribution of editable font files.

## Distribution gate

At the source-audit snapshot, final `dist` and staged Pages inspection remain pending. The delivery owner has added an explicit notice allowlist to the staging process, so the static release carries code/license notices and font provenance in addition to the runtime assets. The final inspection must verify those actual bytes, the font hash, absence of private/development files or local paths, same-origin runtime references, restrictive HTML meta CSP and the exact release identity after the first complete build. A source review alone does not close this gate.

GitHub Pages cannot supply arbitrary custom response headers through an HTML meta policy. This audit does not claim server-enforced `frame-ancestors`, HSTS configuration, external monitoring, encrypted local storage or a physical paper build. Browser import/export/CSP tests, final clean-source CI, deployment integrity and future alert monitoring remain separate responsibilities.
