# ADR 0002: publish one verified static artifact with scoped offline use

Status: accepted for version 0.01.000.

PLEGA needs anonymous access, portable local projects and predictable print exports without a private runtime service. Use GitHub Pages at the dedicated custom domain `https://plega.fasl-work.com/`, with root base path `/`. The DNS CNAME `plega` in the `fasl-work.com` zone points to `fsantibanezleal.github.io`; GitHub Pages is bound to that exact domain. This follows the user requirement that every app use a subdomain on their domains. No VPS, remote font, private package or runtime secret is required.

The build captures the exact Git revision, tree, cleanliness and current nonignored source bytes before Vite. After Vite it rejects any source drift, validates entry resource paths, injects an HTML meta CSP and writes the real 404 entry. It generates the worker before hashing the complete static payload. The manifest's tree digest covers the sorted file inventory, including HTML, worker, scripts, font and other assets; the manifest itself is excluded to avoid self-reference. A separate identity upload preserves its exact bytes.

The [GitHub Pages custom-workflow contract](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) separates artifact upload and OIDC deployment. PLEGA's single workflow tests and browser-checks the staged artifact, verifies it again, uploads that exact directory and deploys it only from main. The environment must restrict publication to main. All actions use full verified commit SHAs; npm uses its lockfile. Publication does not rebuild the tested artifact.

The CSP allows self-hosted scripts and workers, inline styles needed by dynamic layout, local/data fonts and local/blob/data image previews. It does not permit external runtime origins or script evaluation. GitHub Pages cannot supply custom security headers; an HTML meta policy cannot enforce `frame-ancestors` or establish response headers. Those unsupported protections are not claimed.

Production registers a worker at `/` on the dedicated Plega origin. It preloads the same-origin payload, uses network-first navigation and falls back to its cached entry when offline. `release.json` always uses the network. Cache names begin `plega-`, and cleanup is restricted to that prefix. Update installation never automatically activates; after saving work the user can explicitly activate the waiting worker and reload. Development has no service worker.

Local storage and caching may fail or be evicted, so portable file export remains the durable user-controlled route. Offline use cannot verify the latest public release. There is no continuous external monitoring or alert guarantee; post-publication integrity and browser receipts describe their actual observation times.
