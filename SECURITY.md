# Security and privacy

PLEGA is a static browser application. It has no visitor authentication, backend, analytics, runtime credential or remote computation. Assets and the embedded export font are delivered from the same site. Local project storage and portable files can contain a person's own text; sharing a project discloses that content to anyone receiving the link or file.

Imports are untrusted inputs. They must pass bounded schema and numeric validation before replacing current work. Project text is rendered as text or escaped in generated documents. New URL, file, HTML, SVG, PDF or storage handling needs a specific test for rejection and state preservation. Do not add arbitrary HTML execution, dynamic script evaluation or foreign runtime origins.

The staged HTML carries a restrictive Content Security Policy. GitHub Pages does not provide custom response-header configuration: the HTML meta policy cannot establish `frame-ancestors`, HSTS, `X-Frame-Options` or other server-header guarantees. The worker is scoped to `/CAOS_Plega/` and deletes only obsolete caches beginning `plega-`. It does not intercept another project or cache `release.json`. Browser storage and same-origin caching are convenience features, not encrypted backups.

The public artifact identifies the exact source revision and records SHA-256 and size for every served static file except the self-referential `release.json`. Publication requires a clean exact main revision; local dirty previews use a distinct schema. Action revisions and npm dependencies are pinned. CI publication uses GitHub OIDC with environment and branch controls; no long-lived publishing secret is required.

Report a suspected vulnerability using the repository's **Security → Report a vulnerability** option if available. If private reporting is unavailable, open a minimal issue requesting a private reporting channel without exploit details, credentials or personal project files. Do not paste sensitive values into public issues. There is no promised response-time SLA.

The rigid zero-thickness model does not certify real materials, tool use, adhesive behavior, printer calibration or physical assembly. See the [fabrication boundaries](docs/fabrication.md) for the separate product safety limits.
