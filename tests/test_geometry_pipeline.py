"""Independent fixture and deterministic-processing checks in isolated output roots."""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("plega_pipeline", ROOT/"data-pipeline/run.py")
assert SPEC and SPEC.loader
PIPE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PIPE)


class GeometryPipelineTests(unittest.TestCase):
    def setUp(self):
        parent = (ROOT/"build/test-sandboxes").resolve()
        parent.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="geometry-", dir=parent)
        self.root = Path(self.temp.name).resolve()
        assert self.root.is_relative_to(parent)
        self.addCleanup(self.temp.cleanup)
        for path in (*PIPE.SOURCES, "data-pipeline/run.py"):
            dest = self.root/path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT/path, dest)

    def catalog(self):
        return PIPE.read_json(self.root/PIPE.SOURCES[0])

    def test_rich_complete_projects_and_two_specific_diagnoses(self):
        data = self.catalog()
        PIPE.validate_catalog(data)
        self.assertGreaterEqual(len(data["starters"]), 24)
        self.assertGreaterEqual(sum(len(item["project"]["modules"]) >= 8 for item in data["starters"]), 12)
        for item in data["starters"]:
            self.assertFalse(PIPE.project_issues(item["project"]))
        self.assertIn("CLOSED_WIDTH", PIPE.project_issues(data["repairCases"][0]["project"]))
        self.assertIn("V_DOMAIN", PIPE.project_issues(data["repairCases"][1]["project"]))

    def test_tabulated_geometry_checks_against_distances(self):
        data = PIPE.read_json(self.root/PIPE.SOURCES[1])
        PIPE.validate_fixtures(data)
        wrong = copy.deepcopy(data)
        wrong["vPoses"][1]["ridge"][1] += 0.1
        with self.assertRaises(ValueError):
            PIPE.validate_fixtures(wrong)

    def test_cutwork_extensions_are_bounded_and_preserve_rich_designs(self):
        original = self.catalog()["starters"][6]["project"]
        self.assertFalse(PIPE.project_issues(original))
        for field, value in [("pattern", "remote-url"), ("detail", 2.5), ("detail", 7), ("detail", True), ("web", 0), ("web", 6)]:
            project = copy.deepcopy(original)
            project["modules"][0]["cutwork"][field] = value
            with self.assertRaises(ValueError):
                PIPE.project_issues(project)

    def test_compiler_is_deterministic(self):
        first = PIPE.generate(self.root)
        blobs = {p: (self.root/p).read_bytes() for p in (*PIPE.OUTPUTS, PIPE.MANIFEST)}
        self.assertEqual(PIPE.generate(self.root), first)
        self.assertEqual(blobs, {p: (self.root/p).read_bytes() for p in blobs})
        self.assertIn(b"STARTERS", blobs["frontend/src/core/starters.ts"])
        self.assertIn(b"REPAIR_CASES", blobs["frontend/src/core/starters.ts"])

    def test_verification_is_read_only(self):
        PIPE.generate(self.root)
        before = {p: ((self.root/p).stat().st_mtime_ns, (self.root/p).read_bytes()) for p in (*PIPE.SOURCES, *PIPE.OUTPUTS, PIPE.MANIFEST)}
        PIPE.verify(self.root)
        self.assertEqual(before, {p: ((self.root/p).stat().st_mtime_ns, (self.root/p).read_bytes()) for p in before})

    def test_tampered_derived_bytes_are_rejected(self):
        PIPE.generate(self.root)
        target = self.root/PIPE.OUTPUTS[0]
        target.write_bytes(target.read_bytes()+b" ")
        with self.assertRaises(ValueError):
            PIPE.verify(self.root)

    def test_changed_source_invalidates_manifest(self):
        PIPE.generate(self.root)
        target = self.root/PIPE.SOURCES[0]
        target.write_bytes(target.read_bytes()+b"\n")
        with self.assertRaises(ValueError):
            PIPE.verify(self.root)

    def test_compiler_hash_is_recorded_and_checked(self):
        manifest = PIPE.generate(self.root)
        self.assertEqual(manifest["compiler"]["sha256"], hashlib.sha256((self.root/"data-pipeline/run.py").read_bytes()).hexdigest())
        with (self.root/"data-pipeline/run.py").open("ab") as stream:
            stream.write(b"\n")
        with self.assertRaises(ValueError):
            PIPE.verify(self.root)

    def test_unknown_artifacts_and_duplicate_json_keys_rejected(self):
        PIPE.generate(self.root)
        (self.root/"data/artifacts/unknown.json").write_text("{}", encoding="utf-8")
        with self.assertRaises(ValueError):
            PIPE.verify(self.root)
        path = self.root/"duplicate.json"
        path.write_text('{"x":1,"x":2}', encoding="utf-8")
        with self.assertRaises(ValueError):
            PIPE.read_json(path)

    def test_nonfinite_oversize_and_missing_translation_rejected(self):
        path = self.root/"invalid.json"
        path.write_text('{"x":NaN}', encoding="utf-8")
        with self.assertRaises(ValueError):
            PIPE.read_json(path)
        path.write_text(" "*131073, encoding="utf-8")
        with self.assertRaises(ValueError):
            PIPE.read_json(path)
        data = self.catalog()
        del data["starters"][0]["description"]["es"]
        with self.assertRaises(ValueError):
            PIPE.validate_catalog(data)

    def test_canonical_verification_and_portable_lf_generation(self):
        PIPE.verify(ROOT)
        PIPE.generate(self.root)
        for path in PIPE.OUTPUTS:
            self.assertNotIn(b"\r\n", (self.root/path).read_bytes())
        self.assertEqual(PIPE.compile_outputs(ROOT), PIPE.compile_outputs(self.root))


if __name__ == "__main__":
    unittest.main()
