# Saving, sharing and offline use

Your project is edited in the browser. Local recovery is tied to the browser profile and site origin; it does not synchronize between devices. Private browsing, storage limits and clearing site data can remove it. Download a portable project file for a backup and before changing browser or device.

Import validates the project's schema and bounded dimensions before it replaces current work. Invalid input should leave the existing project intact. Project titles and labels can contain your own information: a share link or exported file discloses that content to its recipient. No server account is required.

The production application caches its own static assets after a successful visit. Allow the initial worker installation and reload once before depending on offline availability. It serves the cached entry when navigation cannot reach the network. Browser eviction can still remove the cache, and a first-ever visit cannot load offline.

The service worker is restricted to `/` and manages only caches named with the `plega-` prefix. Its same-origin restriction isolates it from apps on other subdomains. Release identity is always requested from the network, so offline operation does not claim to know the current deployed revision.

When a newer worker is ready, save or export the project before choosing the update action. New workers wait for that explicit activation. Reloading into an updated release is a separate step from saving; keeping a portable project file gives a recovery route if local storage fails.

Development does not register a worker. To test production behavior locally, build the final Pages artifact and use the staged preview, then exercise first install, offline navigation and an explicit update in the browser. See [scripts/README.md](../../scripts/README.md) for the exact commands.
