#!/usr/bin/env python3
"""Serve the exact staged Pages artifact locally under its real project prefix."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit

import release


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.route():
            super().do_GET()

    def do_HEAD(self):
        if self.route():
            super().do_HEAD()

    def route(self):
        parsed = urlsplit(self.path)
        if parsed.path == release.BASE.rstrip('/'):
            self.send_response(301)
            self.send_header('Location', release.BASE)
            self.end_headers()
            return False
        if not parsed.path.startswith(release.BASE):
            self.send_error(404)
            return False
        rel = unquote(parsed.path[len(release.BASE):])
        if '\\' in rel or '..' in Path(rel).parts:
            self.send_error(400)
            return False
        self.path = '/' + rel + ('?' + parsed.query if parsed.query else '')
        return True

    def send_error(self, code, message=None, explain=None):
        # GitHub Pages serves the generated application entry with a real 404 status.
        if code == 404 and hasattr(self, 'directory'):
            body = (Path(self.directory) / '404.html').read_bytes()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, format, *args):
        # Request paths can contain private project fragments/query strings: no access log by default.
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4903)
    options = parser.parse_args()
    release.verify()
    directory = release.safe_output('pages')
    factory = lambda *args, **kwargs: Handler(*args, directory=str(directory), **kwargs)
    server = ThreadingHTTPServer(('127.0.0.1', options.port), factory)
    print(f'PLEGA staged preview: http://127.0.0.1:{options.port}{release.BASE}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
