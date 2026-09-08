"""Delivery regressions use isolated fixtures, never canonical data or a network."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
import release
import project


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='plega-delivery-')
        self.root = Path(self.temp.name)
        self.root_patch = patch.object(release, 'ROOT', self.root)
        self.root_patch.start()
        self.identity = {'revision': 'a' * 40, 'source_tree': 'b' * 40, 'source_clean': True,
                         'working_source_sha256': 'c' * 64}
        self.source_patch = patch.object(release, 'source', return_value=self.identity.copy())
        self.source_patch.start()
        (self.root / 'frontend/dist/assets').mkdir(parents=True)
        (self.root / 'frontend/dist/assets/app.js').write_bytes(b'console.info("fixture");\n')
        (self.root / 'frontend/dist/index.html').write_text(
            '<!doctype html><html><head><script type="module" src="/CAOS_Plega/assets/app.js"></script></head><body>PLEGA</body></html>',
            encoding='utf-8')
        (self.root / 'VERSION').write_text('0.01.000\n', encoding='utf-8')
        for name in ['LICENSE', 'data/LICENSE', 'THIRD_PARTY_NOTICES.md', 'docs/asset-licenses.json', 'docs/dependency-licenses.json',
                     'frontend/src/export/assets/OFL.txt', 'frontend/src/export/assets/provenance.json']:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b'Public fixture notice\n')
        release.capture()

    def tearDown(self):
        self.source_patch.stop()
        self.root_patch.stop()
        self.temp.cleanup()

    def stage(self):
        return release.prepare('a' * 40, require_clean=True)

    def test_complete_identity_binds_worker_and_all_static_bytes(self):
        receipt = self.stage()
        result = release.verify()
        self.assertTrue(result['passed'])
        metadata = json.loads((self.root / 'build/pages/release.json').read_bytes())
        self.assertIn('sw.js', metadata['files'])
        self.assertIn('notices/frontend/src/export/assets/OFL.txt', metadata['files'])
        self.assertNotIn('release.json', metadata['files'])
        self.assertEqual(metadata['artifact_tree_sha256'], receipt['artifact_tree_sha256'])
        self.assertEqual((self.root / 'build/pages/index.html').read_bytes(), (self.root / 'build/pages/404.html').read_bytes())
        self.assertIn('Content-Security-Policy', (self.root / 'build/pages/index.html').read_text())

    def test_changed_source_is_rejected_before_replacing_artifact(self):
        self.stage()
        before = (self.root / 'build/pages/release.json').read_bytes()
        with patch.object(release, 'source', return_value={**self.identity, 'working_source_sha256': 'd' * 64}):
            with self.assertRaisesRegex(RuntimeError, 'Source changed'):
                self.stage()
        self.assertEqual(before, (self.root / 'build/pages/release.json').read_bytes())

    def test_dirty_source_is_preview_only(self):
        with patch.object(release, 'source', return_value={**self.identity, 'source_clean': False}):
            release.capture()
            with self.assertRaisesRegex(RuntimeError, 'clean source'):
                self.stage()
            release.prepare()
            self.assertEqual(json.loads((self.root / 'build/pages/release.json').read_bytes())['schema'], 'plega-preview/v1')

    def test_wrong_requested_revision_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'Requested revision'):
            release.prepare('d' * 40, require_clean=True)

    def test_foreign_or_wrong_base_resources_are_rejected(self):
        for address in ['https://external.invalid/a.js', '/assets/app.js', '//external.invalid/a.js']:
            with self.subTest(address=address):
                (self.root / 'frontend/dist/index.html').write_text(f'<head><script src="{address}"></script></head>')
                with self.assertRaisesRegex(RuntimeError, 'project base'):
                    self.stage()

    def test_inline_scripts_and_handlers_are_rejected(self):
        for html in ['<head><script>alert(1)</script></head>', '<head></head><body onload="alert(1)">']:
            (self.root / 'frontend/dist/index.html').write_text(html)
            with self.assertRaises(RuntimeError):
                self.stage()

    def test_tampered_asset_or_release_identity_fails(self):
        self.stage()
        asset = self.root / 'build/pages/assets/app.js'
        asset.write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError, 'bytes changed'):
            release.verify()
        self.stage()
        metadata_path = self.root / 'build/pages/release.json'
        metadata = json.loads(metadata_path.read_bytes())
        metadata['release_id'] = 'forged'
        metadata_path.write_bytes(release.json_bytes(metadata))
        with self.assertRaisesRegex(RuntimeError, 'identity'):
            release.verify()

    def test_sensitive_extension_is_rejected(self):
        (self.root / 'frontend/dist/private.key').write_bytes(b'not-a-real-key')
        with self.assertRaisesRegex(RuntimeError, 'Private/development'):
            self.stage()

    def test_worker_behavior_waiting_scope_offline_and_identity(self):
        self.stage()
        result = subprocess.run(['node', str(SCRIPTS / 'tests/verify-worker.mjs'),
                                 str(self.root / 'build/pages/sw.js')], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class SetupTests(unittest.TestCase):
    def test_existing_environment_and_data_are_preserved(self):
        with tempfile.TemporaryDirectory(prefix='plega-setup-') as directory:
            root = Path(directory)
            (root / '.venv').mkdir()
            executable = root / '.venv/python'
            executable.write_bytes(b'fixture')
            (root / '.env').write_bytes(b'CUSTOM=existing\n')
            (root / '.env.example').write_bytes(b'CUSTOM=example\n')
            (root / 'data/artifacts').mkdir(parents=True)
            (root / 'data/artifacts/integrity.json').write_bytes(b'{}')
            with patch.object(project, 'ROOT', root), patch.object(project, 'PYTHON', executable), \
                 patch.object(project, 'runtime'), patch.object(project, 'run') as run, patch.object(project, 'npm'), \
                 patch.object(project.venv, 'EnvBuilder') as builder:
                project.setup()
                builder.assert_not_called()
                self.assertEqual((root / '.env').read_bytes(), b'CUSTOM=existing\n')
                self.assertEqual(run.call_args_list[-1].args[0][-1], 'verify')


if __name__ == '__main__':
    unittest.main()
