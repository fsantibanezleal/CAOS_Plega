"""Check the public asset/license boundary without contacting a font service."""
from pathlib import Path
import hashlib
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PublicAssetTests(unittest.TestCase):
    def test_every_listed_asset_matches_its_license_inventory(self):
        manifest = json.loads((ROOT / "docs/asset-licenses.json").read_text(encoding="utf-8"))
        for item in manifest["assets"]:
            target = (ROOT / item["path"]).resolve()
            self.assertTrue(target.is_relative_to(ROOT))
            data = target.read_bytes()
            self.assertEqual(len(data), item["bytes"], item["path"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), item["sha256"], item["path"])
            self.assertIn(item["license"], {"MIT", "Apache-2.0", "OFL-1.1"})

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
