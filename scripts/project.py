#!/usr/bin/env python3
"""Cross-platform local tools and explicit Pages dispatch; no installable package."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import venv

import release

ROOT = release.ROOT
FRONTEND = ROOT / 'frontend'
PYTHON = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def run(arguments, *, cwd=ROOT, env=None):
    return subprocess.run([str(value) for value in arguments], cwd=cwd, env=env, check=True)


def npm(*args, env=None):
    binary = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not binary:
        raise RuntimeError('Install Node24 (recommended) or Node22, then run setup.')
    return run([binary, *args], cwd=FRONTEND, env=env)


def python():
    if not PYTHON.is_file():
        raise RuntimeError('Run scripts/setup first to create the isolated Python environment.')
    return PYTHON


def runtime():
    if sys.version_info[:2] != (3, 13):
        raise RuntimeError('Python3.13 is required for reproducible processing and delivery.')
    major = int(subprocess.check_output(['node', '-p', 'process.versions.node.split(".")[0]']).decode().strip())
    if major not in {22, 24}:
        raise RuntimeError('Use supported Node22 or Node24.')


def setup():
    runtime()
    path = ROOT / '.venv'
    if path.is_symlink() or path.resolve() != ROOT.resolve() / '.venv':
        raise RuntimeError('Python environment must remain inside the real repository directory.')
    if not PYTHON.exists():
        venv.EnvBuilder(with_pip=True).create(path)
    run([python(), '-m', 'pip', 'install', '--disable-pip-version-check', '-r', ROOT / 'requirements-dev.txt'])
    marker = ROOT / 'data/artifacts/integrity.json'
    run([python(), ROOT / 'data-pipeline/run.py', 'verify' if marker.exists() else 'generate'])
    npm('ci')
    target = ROOT / '.env'
    if not target.exists():
        with target.open('xb') as output:
            output.write((ROOT / '.env.example').read_bytes())
    print('Setup complete. Existing environment settings and canonical data were preserved.')


def verify_data():
    run([python(), ROOT / 'data-pipeline/run.py', 'verify'])


def test():
    verify_data()
    run([python(), '-m', 'unittest', 'discover', '-s', 'tests', '-v'])
    run([python(), '-m', 'unittest', 'discover', '-s', 'scripts/tests', '-v'])
    npm('run', 'test')
    npm('run', 'check')


def build(revision=None, require_clean=False):
    runtime()
    verify_data()
    release.capture()
    env = os.environ.copy()
    env['PLEGA_BASE_PATH'] = release.BASE
    npm('run', 'build', env=env)
    value = release.prepare(revision, require_clean)
    release.verify()
    print(json.dumps(value, indent=2))


def verify_ui():
    release.verify()
    existing = os.environ.get('PLEGA_QA_URL')
    if existing:
        npm('run', 'test:browser')
        return
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1', 4903))
        except OSError as error:
            raise RuntimeError('Preview port4903 is occupied. Stop that server or explicitly set PLEGA_QA_URL.') from error
    server = subprocess.Popen([str(python()), str(ROOT / 'scripts/serve_pages.py')], cwd=ROOT,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    env = os.environ.copy()
    env['PLEGA_QA_URL'] = 'http://127.0.0.1:4903' + release.BASE
    try:
        for _ in range(50):
            if server.poll() is not None:
                raise RuntimeError('Staged preview failed to start.')
            try:
                with urllib.request.urlopen(env['PLEGA_QA_URL'] + 'release.json', timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError('Staged preview startup timed out.')
        npm('run', 'test:browser', env=env)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)


def deploy(revision):
    if revision is None or not re.fullmatch(r'[a-f0-9]{40}', revision):
        raise RuntimeError('Pass --revision with the exact reviewed current main SHA.')
    result = subprocess.check_output(['gh', 'api', '--method', 'GET', 'repos/fsantibanezleal/CAOS_Plega/git/ref/heads/main'])
    remote = json.loads(result)['object']['sha']
    if remote != revision:
        raise RuntimeError('Requested revision differs from current remote main; review it before publishing.')
    run(['gh', 'workflow', 'run', 'deploy-pages.yml', '--repo', 'fsantibanezleal/CAOS_Plega', '--ref', 'main', '-f', 'revision=' + revision])
    print('Pages workflow dispatched for the exact reviewed main SHA. Verify its run and public artifact before claiming delivery.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['setup','dev','test','build','preview','verify-ui','install-browsers','deploy','verify-data'])
    parser.add_argument('--revision')
    parser.add_argument('--require-clean', action='store_true')
    options = parser.parse_args()
    if options.command == 'setup': setup()
    elif options.command == 'dev': verify_data(); npm('run','dev')
    elif options.command == 'test': test()
    elif options.command == 'build': build(options.revision, options.require_clean)
    elif options.command == 'preview': run([python(),ROOT/'scripts/serve_pages.py'])
    elif options.command == 'verify-ui': verify_ui()
    elif options.command == 'verify-data': verify_data()
    elif options.command == 'install-browsers': npm('exec','--no','--','playwright','install','chromium')
    elif options.command == 'deploy': deploy(options.revision)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'PLEGA command failed: {error}', file=sys.stderr)
        raise SystemExit(1)
