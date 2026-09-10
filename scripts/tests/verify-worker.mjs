// Exercise the generated worker with browser-shaped stubs; no network or browser installation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const handlers = {};
const deleted = [];
const fetches = [];
let skipCount = 0;
let offline = false;
let precache = [];
const cachedPage = { cached: 'entry' };
const cache = {
  addAll: async (requests) => { precache = requests; },
  match: async (request) => request === '/' ? cachedPage : undefined,
};
const self = {
  location: { origin: 'https://plega.fasl-work.com' },
  addEventListener: (name, callback) => { handlers[name] = callback; },
  skipWaiting: async () => { skipCount += 1; },
};
class RequestStub { constructor(url, options) { this.url = url; this.options = options; } }
vm.runInNewContext(fs.readFileSync(process.argv[2], 'utf8'), {
  self, URL, Request: RequestStub, Response,
  caches: {
    open: async () => cache,
    keys: async () => ['other-product-cache', 'plega-obsolete', 'plega-reserved-old'],
    delete: async (name) => { deleted.push(name); return true; },
  },
  fetch: async (request, options) => {
    fetches.push({ request, options });
    if (offline) throw new Error('simulated offline');
    return { network: request.url };
  },
});
async function lifecycle(name, extra = {}) {
  let pending;
  handlers[name]({ ...extra, waitUntil: (promise) => { pending = promise; } });
  await pending;
}
await lifecycle('install');
assert.equal(skipCount, 0, 'Installation must wait for user-approved activation.');
assert(precache.length > 1);
assert(precache.every(({ url }) => url.startsWith('/') && !url.endsWith('release.json') && !url.endsWith('sw.js')));
await lifecycle('activate');
assert(!deleted.includes('other-product-cache'), 'Other project caches must survive.');
assert.deepEqual(deleted, ['plega-obsolete', 'plega-reserved-old']);
await lifecycle('message', { data: { type: 'UNRELATED' } });
assert.equal(skipCount, 0);
await lifecycle('message', { data: { type: 'PLEGA_ACTIVATE_UPDATE' } });
assert.equal(skipCount, 1);
function request(path, mode = 'cors', method = 'GET', origin = self.location.origin) {
  let response;
  handlers.fetch({ request: { url: origin + path, mode, method }, respondWith: (promise) => { response = promise; } });
  return response;
}
assert.equal(request('/app.js', 'cors', 'GET', 'https://floraria.fasl-work.com'), undefined);
assert.equal(request('/app.js', 'cors', 'POST'), undefined);
assert.equal(request('/app.js', 'cors', 'GET', 'https://foreign.invalid'), undefined);
await request('/release.json');
assert.equal(fetches.at(-1).options.cache, 'no-store');
offline = true;
assert.equal(await request('/a-deep-link', 'navigate'), cachedPage);
await assert.rejects(request('/release.json'), /simulated offline/);
assert.equal(request('/sw.js'), undefined);
console.log('Worker lifecycle, cache isolation, offline navigation and network identity passed.');
