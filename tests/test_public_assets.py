"""Check the public asset/license boundary without contacting a font service."""
from pathlib import Path
import hashlib
import json
import re
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PublicAssetTests(unittest.TestCase):
    def test_public_model_library_has_a_complete_resolved_lesson(self):
        source = (ROOT / "data/guide/foldspec/crane-source.fold.json").read_bytes()
        public = (ROOT / "frontend/public/lessons/crane/crane.fold.json").read_bytes()
        transform = runpy.run_path(str(ROOT / "scripts/import_foldspec_crane.py"))["viewing_copy"]
        self.assertEqual(public, transform(source))
        lesson = json.loads((ROOT / "frontend/public/lessons/crane/crane.fold.json").read_text(encoding="utf-8"))
        self.assertEqual(lesson["status"], "resolved")
        self.assertEqual(lesson["geometry"]["status"], "complete")
        self.assertEqual(len(lesson["instructions"]["steps"]), 44)
        self.assertEqual(len(lesson["geometry"]["operations"]), 40)
        for step in lesson["instructions"]["steps"]:
            if step["animation"] == "resolved":
                self.assertTrue(step["runs"], step["id"])
            else:
                self.assertEqual(step["animation"], "not-applicable")
                self.assertFalse(step["runs"])

    def test_viewer_pins_the_exact_public_lesson(self):
        lesson = (ROOT / "frontend/public/lessons/crane/crane.fold.json").read_bytes()
        viewer = (ROOT / "frontend/src/vendor/fold-viewer/validation.ts").read_text(encoding="utf-8")
        self.assertIn(hashlib.sha256(lesson).hexdigest(), viewer)
        self.assertIn("source.url !== LESSON_URL", viewer)
        self.assertIn("crypto.subtle.digest('SHA-256'", viewer)
        self.assertNotIn("new Function", viewer)
        self.assertEqual((ROOT / "frontend/src/vendor/fold-viewer/LICENSE").read_bytes(),
                         (ROOT / "frontend/public/licenses/fold-viewer.LICENSE").read_bytes())

    def test_external_file_links_have_a_reviewed_reachability_snapshot(self):
        index = json.loads((ROOT / "data/guide/origami-plan-index.json").read_text(encoding="utf-8"))
        health = json.loads((ROOT / "data/guide/origami-plan-health.json").read_text(encoding="utf-8"))
        urls = {entry["planUrl"] for entry in index["entries"]}
        checked = {record["url"] for record in health["records"]}
        self.assertEqual(urls, checked)
        self.assertGreater(sum(record["available"] for record in health["records"]), 200)
        for record in health["records"]:
            if record["available"]:
                self.assertEqual(record["status"], 200)
                self.assertIn(record["contentType"], {"application/pdf", "image/gif", "image/jpeg", "image/png", "image/svg+xml", "application/octet-stream"})

    def test_every_listed_asset_matches_its_license_inventory(self):
        manifest = json.loads((ROOT / "docs/asset-licenses.json").read_text(encoding="utf-8"))
        for item in manifest["assets"]:
            target = (ROOT / item["path"]).resolve()
            self.assertTrue(target.is_relative_to(ROOT))
            data = target.read_bytes()
            self.assertEqual(len(data), item["bytes"], item["path"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), item["sha256"], item["path"])
            self.assertIn(item["license"], {"MIT", "Apache-2.0", "OFL-1.1", "Public domain", "CC0", "CC BY 3.0", "CC BY-SA 3.0", "CC BY-SA 4.0"})
        commons = json.loads((ROOT / "data/guide/commons-diagrams.json").read_text(encoding="utf-8"))
        paths = {item["path"] for item in manifest["assets"]}
        for record in commons["records"]:
            self.assertIn("frontend/public" + record["asset"], paths)
            self.assertTrue(record["sourcePage"].startswith("https://commons.wikimedia.org/wiki/File:"))
            self.assertTrue(record["licenseUrl"].startswith("https://"))
        tavin = json.loads((ROOT / "data/guide/tavin-diagrams.json").read_text(encoding="utf-8"))
        for record in tavin["records"]:
            self.assertIn("frontend/public" + record["asset"], paths)
            self.assertIn("frontend/public" + record["download"], paths)
            self.assertTrue(record["sourceFile"].startswith("https://tavinsorigami.com/"))
            self.assertIn(record["license"], {"CC BY 3.0", "CC BY-SA 3.0"})

    def test_interface_fonts_retain_pinned_upstream_bytes_and_complete_licenses(self):
        folder = ROOT / "frontend/public/fonts"
        provenance = json.loads((folder / "provenance.json").read_text(encoding="utf-8"))
        self.assertRegex(provenance["revision"], r"^[a-f0-9]{40}$")
        self.assertFalse(provenance["modified"])
        for item in provenance["files"]:
            self.assertTrue(item["url"].startswith("https://raw.githubusercontent.com/google/fonts/" + provenance["revision"] + "/ofl/"))
            data = (folder / item["file"]).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), item["sha256"])
            self.assertEqual(len(data), item["bytes"])
            if item["file"].endswith(".txt"):
                self.assertIn(b"SIL OPEN FONT LICENSE Version 1.1", data)
                self.assertIn(b"DISCLAIMER", data)
        css = (ROOT / "frontend/src/style.css").read_text(encoding="utf-8")
        self.assertNotRegex(css, r"url\([\"']?https?://")
        self.assertIn('/fonts/SpaceGrotesk.ttf', css)
        self.assertIn('/fonts/IBMPlexSans.ttf', css)

    def test_dependency_license_inventory_matches_the_lockfile(self):
        inventory = json.loads((ROOT / "docs/dependency-licenses.json").read_text(encoding="utf-8"))
        lock = (ROOT / "frontend/package-lock.json").read_bytes()
        self.assertEqual(inventory["lockfileSha256"], hashlib.sha256(lock).hexdigest())
        self.assertTrue(all(item.get("license") for item in inventory["packages"]))


if __name__ == "__main__":
    unittest.main()
