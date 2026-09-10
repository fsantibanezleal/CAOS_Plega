#!/usr/bin/env python3
"""Exact source/build identity and self-contained GitHub Pages staging."""
from __future__ import annotations

import argparse
from html import escape
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
BASE = '/'
PUBLIC_URL = 'https://plega.fasl-work.com/'
CUSTOM_DOMAIN = 'plega.fasl-work.com'
POLICY = ("default-src 'self'; script-src 'self'; worker-src 'self' blob:; "
          "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
          "font-src 'self' data:; connect-src 'self' blob:; "
          "object-src 'none'; base-uri 'self'; form-action 'none'")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8').strip()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode('utf-8')


def digest(files):
    return sha(json.dumps(files, sort_keys=True, separators=(',', ':')).encode())


def source():
    names = subprocess.check_output(['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=ROOT).decode().split('\0')
    files = {}
    for name in sorted(set(names) - {''}):
        path = ROOT / name
        require(not path.is_symlink(), 'Source symlinks are unsupported.')
        if path.is_file():
            files[name] = sha(path.read_bytes())
    return {'revision': git('rev-parse', 'HEAD'), 'source_tree': git('rev-parse', 'HEAD^{tree}'),
            'source_clean': not bool(git('status', '--porcelain')), 'working_source_sha256': digest(files)}


def safe_output(name):
    path = ROOT / 'build' / name
    require(not (ROOT / 'build').is_symlink() and not path.is_symlink() and path.resolve() == ROOT.resolve() / 'build' / name,
            'Build output must stay in its real repository directory.')
    return path


def capture():
    value = source()
    path = safe_output('source-receipt.json')
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(json_bytes(value))
    return value


def file_map(directory):
    require(directory.is_dir() and not directory.is_symlink(), 'Static build directory is unavailable.')
    result = {}
    for path in sorted(directory.rglob('*')):
        require(not path.is_symlink(), 'Static artifact cannot contain symlinks.')
        if not path.is_file():
            continue
        rel = path.relative_to(directory).as_posix()
        require(not any(part.startswith('.') for part in Path(rel).parts), 'Hidden file in static artifact.')
        require(path.suffix.lower() not in {'.pem', '.key', '.p12', '.map'}, 'Private/development file in static artifact.')
        if rel == 'release.json':
            continue
        data = path.read_bytes()
        result[rel] = {'bytes': len(data), 'sha256': sha(data)}
    require('index.html' in result and any(name.endswith('.js') for name in result), 'Static entry or JavaScript is missing.')
    return result


class EntryCheck(HTMLParser):
    def __init__(self, directory):
        super().__init__()
        self.directory = directory

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        require(tag != 'base' and not any(name.startswith('on') for name in attrs), 'Base elements/inline handlers are forbidden.')
        require(not (tag == 'script' and not attrs.get('src')), 'Inline scripts are forbidden.')
        require(not (tag == 'meta' and attrs.get('http-equiv', '').lower() == 'content-security-policy'), 'Duplicate entry policy.')
        key = 'src' if tag in {'script', 'img', 'iframe', 'source'} else 'href' if tag == 'link' else None
        if key and attrs.get(key):
            value = attrs[key]
            parsed = urlsplit(value)
            require(not parsed.scheme and not parsed.netloc and parsed.path.startswith(BASE), 'Built resources must use the project base path.')
            rel = unquote(parsed.path[len(BASE):])
            require('\\' not in rel and '..' not in Path(rel).parts and rel and not rel.startswith('/'), 'Invalid built-resource path.')
            require((self.directory / rel).is_file(), 'Entry references a missing resource.')


def prepare(revision=None, require_clean=False):
    before = json.loads(safe_output('source-receipt.json').read_text(encoding='utf-8'))
    current = source()
    require(current == before, 'Source changed during the build. Rebuild using scripts/build.')
    require(revision is None or re.fullmatch(r'[a-f0-9]{40}', revision) and revision == current['revision'], 'Requested revision differs from build source.')
    require(not require_clean or revision is not None and current['source_clean'], 'Publishing requires explicit exact revision and clean source.')
    version = (ROOT / 'VERSION').read_text(encoding='utf-8').strip()
    require(re.fullmatch(r'[0-9]+\.[0-9]{2}\.[0-9]{3}', version), 'Invalid release version.')
    dist = ROOT / 'frontend/dist'
    require(dist.resolve() == ROOT.resolve() / 'frontend/dist' and not dist.is_symlink(), 'Invalid build input directory.')
    file_map(dist)
    html = (dist / 'index.html').read_text(encoding='utf-8')
    EntryCheck(dist).feed(html)
    tag = re.search(r'<head\b[^>]*>', html, re.I)
    require(tag is not None, 'Built entry has no head.')
    policy = '\n<meta http-equiv="Content-Security-Policy" content="' + escape(POLICY, quote=True) + '" />\n<meta name="referrer" content="strict-origin-when-cross-origin" />'
    html = html[:tag.end()] + policy + html[tag.end():]
    output = safe_output('pages')
    if output.exists():
        shutil.rmtree(output)
    shutil.copytree(dist, output)
    (output / 'index.html').write_text(html, encoding='utf-8', newline='\n')
    (output / '404.html').write_text(html, encoding='utf-8', newline='\n')
    (output / 'CNAME').write_text(CUSTOM_DOMAIN + '\n', encoding='ascii', newline='\n')
    notices = {
        'LICENSE': 'LICENSE',
        'data/LICENSE': 'data/LICENSE',
        'THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.md',
        'docs/asset-licenses.json': 'docs/asset-licenses.json',
        'docs/dependency-licenses.json': 'docs/dependency-licenses.json',
        'frontend/src/export/assets/OFL.txt': 'frontend/src/export/assets/OFL.txt',
        'frontend/src/export/assets/provenance.json': 'frontend/src/export/assets/provenance.json',
    }
    (output / 'notices').mkdir(exist_ok=True)
    for source_name, target_name in notices.items():
        asset = ROOT / source_name
        require(asset.is_file() and not asset.is_symlink(), 'Required public license notice is missing or linked: ' + source_name)
        target = output / 'notices' / target_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(asset.read_bytes())
    files = file_map(output)
    for path in output.rglob('*.css'):
        css = path.read_text(encoding='utf-8')
        for value in re.findall(r'url\(\s*[\"\']?([^\s\"\')]+)', css):
            require(not value.startswith('//') and urlsplit(value).scheme in {'', 'data'}, 'Stylesheet loads an external resource.')
        require(not re.search(r'@import\s+[\"\']', css), 'Unbundled stylesheet import.')
    # Cache identity is based on immutable content before adding SW/metadata, avoiding a hash cycle.
    cache_name = 'plega-' + current['revision'][:12] + '-' + digest(files)[:12]
    precache = [BASE] + [BASE + name for name in files if name not in {'index.html', 'sw.js', 'release.json'}]
    worker = '''// Generated from verified static content. No runtime origins or private project state.
const BASE = __BASE__;
const CACHE = __CACHE__;
const PRECACHE = __PRECACHE__;
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, {cache: 'reload'})))));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('plega-') && key !== CACHE).map((key) => caches.delete(key)))));
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PLEGA_ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname === BASE + 'release.json') {
    event.respondWith(fetch(request, {cache: 'no-store'}));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      const fallback = await cache.match(BASE);
      return fallback || new Response('PLEGA is not available offline yet.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    }));
    return;
  }
  if (url.pathname === BASE + 'sw.js') return;
  event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(request, {ignoreSearch: true})) || fetch(request)));
});
'''.replace('__BASE__', json.dumps(BASE)).replace('__CACHE__', json.dumps(cache_name)).replace('__PRECACHE__', json.dumps(precache))
    (output / 'sw.js').write_text(worker, encoding='utf-8', newline='\n')
    files = file_map(output)
    tree = digest(files)
    value = {'schema': 'plega-release/v1' if current['source_clean'] else 'plega-preview/v1', 'product': 'PLEGA',
             'version': version, **current, 'release_id': f'v{version}-{current["revision"][:12]}-{tree[:12]}',
             'artifact_tree_sha256': tree, 'hosting': {'provider': 'github-pages', 'base_path': BASE, 'url': PUBLIC_URL,
                                                    'csp_delivery': 'html-meta'}, 'files': files}
    (output / 'release.json').write_bytes(json_bytes(value))
    receipt = {key: value[key] for key in value if key != 'files'}
    safe_output('pages-build-receipt.json').write_bytes(json_bytes(receipt))
    return receipt


def verify(directory=None):
    output = directory or safe_output('pages')
    metadata = json.loads((output / 'release.json').read_text(encoding='utf-8'))
    files = file_map(output)
    require(files == metadata['files'] and digest(files) == metadata['artifact_tree_sha256'], 'Staged artifact bytes changed.')
    require(metadata['product'] == 'PLEGA' and metadata['hosting']['base_path'] == BASE, 'Wrong staged product/base path.')
    require(re.fullmatch(r'[a-f0-9]{40}', metadata['revision']) is not None, 'Invalid staged source revision.')
    require(type(metadata['source_clean']) is bool, 'Invalid clean-source flag.')
    require(metadata['schema'] == ('plega-release/v1' if metadata['source_clean'] else 'plega-preview/v1'), 'Invalid release schema.')
    expected = f'v{metadata["version"]}-{metadata["revision"][:12]}-{digest(files)[:12]}'
    require(metadata['release_id'] == expected, 'Staged release identity does not match its source and bytes.')
    require(metadata['hosting']['url'] == PUBLIC_URL and metadata['hosting']['provider'] == 'github-pages', 'Wrong public hosting identity.')
    require((output / 'CNAME').read_text(encoding='ascii').strip() == CUSTOM_DOMAIN, 'Wrong custom domain.')
    return {'passed': True, 'release_id': metadata['release_id'], 'files': len(files), 'artifact_tree_sha256': digest(files)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['capture', 'prepare', 'verify'])
    parser.add_argument('--revision')
    parser.add_argument('--require-clean', action='store_true')
    args = parser.parse_args()
    value = capture() if args.command == 'capture' else prepare(args.revision, args.require_clean) if args.command == 'prepare' else verify()
    print(json.dumps(value, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Release validation failed: {error}', file=sys.stderr)
        raise SystemExit(1)
