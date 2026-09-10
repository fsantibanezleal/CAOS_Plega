"""Compile and verify PLEGA's original designs and independent numeric fixtures."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
import shutil
import sys

REPO = Path(__file__).resolve().parents[1]
SOURCES = ("data/sources/projects.json", "data/sources/fixtures.json")
OUTPUTS = ("data/artifacts/projects.json", "data/artifacts/fixtures.json", "frontend/src/core/starters.ts")
MANIFEST = "data/artifacts/integrity.json"
MAX_BYTES = 131072


def encode(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def read_json(path: Path) -> dict:
    if path.stat().st_size > MAX_BYTES:
        raise ValueError(f"Input exceeds bounded size: {path.name}")
    def pairs(items: list[tuple[str, object]]) -> dict:
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result
    value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite number")))
    if not isinstance(value, dict):
        raise ValueError("Object required")
    return value


def number(value: object, low: float = 0, high: float = 2000) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError("Invalid finite bounded number")
    return value


def bilingual(value: object) -> None:
    if not isinstance(value, dict) or set(value) != {"en", "es"} or not all(isinstance(s, str) and 0 < len(s) <= 600 for s in value.values()):
        raise ValueError("Original English and Spanish text required")


def project_issues(project: dict) -> set[str]:
    if set(project) != {"schemaVersion", "title", "card", "modules"} or project["schemaVersion"] != 1:
        raise ValueError("Unsupported project shape")
    if not isinstance(project["title"], str) or not 0 < len(project["title"]) <= 100:
        raise ValueError("Invalid project title")
    card = project["card"]
    if set(card) != {"W", "H", "margin", "gap", "blank", "color", "pins"}:
        raise ValueError("Unsupported card shape")
    w, height = number(card["W"], 0.1), number(card["H"], 0.1)
    margin, gap = number(card["margin"]), number(card["gap"], 0.1)
    if card["blank"] not in ("uncreased", "prefolded") or len(project["modules"]) > 6:
        raise ValueError("Unsupported card or module count")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", card["color"]) or len(set(card["pins"])) != len(card["pins"]) or not set(card["pins"]) <= {"W", "H", "margin", "gap"}:
        raise ValueError("Invalid card color or pins")
    issues, intervals, ids = set(), [], set()
    for module in project["modules"]:
        if set(module) != {"id", "kind", "label", "color", "y", "params", "pins"} or module["id"] in ids:
            raise ValueError("Unsupported or duplicate module")
        ids.add(module["id"])
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,47}", module["id"]) or not isinstance(module["label"], str) or not 0 < len(module["label"]) <= 80 or not re.fullmatch(r"#[0-9a-fA-F]{6}", module["color"]):
            raise ValueError("Invalid module text or color")
        y, p = number(module["y"], -4000, 4000), module["params"]
        allowed_pins = {"y", *p.keys()}
        if len(set(module["pins"])) != len(module["pins"]) or not set(module["pins"]) <= allowed_pins:
            raise ValueError("Invalid module pins")
        if module["kind"] == "P":
            if set(p) != {"a", "b", "width"}:
                raise ValueError("Unsupported step parameters")
            a, b, width = (number(p[key], 0.1) for key in ("a", "b", "width"))
            if a >= w or b >= w or y <= 0 or y + width >= height:
                issues.add("P_ATTACHMENT_OUTSIDE")
            if card["blank"] == "prefolded" and abs(a-b) > 1e-8:
                issues.add("P_PREFOLD_MISMATCH")
            lo, hi, reach = y, y+width, a+b
        elif module["kind"] == "V":
            if set(p) != {"r", "h", "betaDeg", "gammaDeg", "tabWidth", "tabInset"}:
                raise ValueError("Unsupported V parameters")
            r, h, t, inset = (number(p[key], 0.1) for key in ("r", "h", "tabWidth", "tabInset"))
            beta, gamma = number(p["betaDeg"], 0, 180), number(p["gammaDeg"], 0, 180)
            if not 20 <= beta <= 45 or not beta+15 <= gamma <= 90:
                issues.add("V_DOMAIN")
                continue
            if 2*inset >= r:
                issues.add("V_TAB_INVALID")
                continue
            b, g = math.radians(beta), math.radians(gamma)
            lo = y + min(0, h*math.cos(b+g), inset*math.cos(b)-t*math.sin(b))
            hi = y + max(r*math.cos(b), h*math.cos(g)/math.cos(b))
            reach = max(r*math.sin(b), h*math.sin(b+g), (r-inset)*math.sin(b)+t*math.cos(b))
            tab_y = [y+inset*math.cos(b)-t*math.sin(b), y+(r-inset)*math.cos(b)]
            if min(tab_y) < 0 or max(tab_y) > height or (r-inset)*math.sin(b)+t*math.cos(b) > w:
                issues.add("V_ATTACHMENT_OUTSIDE")
        else:
            raise ValueError("Unsupported mechanism family")
        if reach > w-margin+1e-8:
            issues.add("CLOSED_WIDTH")
        if lo < margin-1e-8 or hi > height-margin+1e-8:
            issues.add("PAGE_Y_BOUNDS")
        intervals.append((lo, hi))
    for left, right in zip(intervals, intervals[1:]):
        if right[0]-left[1] < gap-1e-8:
            issues.add("LANE_UNCERTIFIED")
    return issues


def validate_catalog(data: dict) -> None:
    if set(data) != {"schemaVersion", "license", "provenance", "sources", "starters", "repairCases"} or data["schemaVersion"] != 1:
        raise ValueError("Unsupported catalog")
    if len(data["starters"]) != 6 or len(data["repairCases"]) < 2:
        raise ValueError("Six original starters and two repair cases required")
    ids = set()
    for source in data["sources"]:
        if set(source) != {"id", "label", "url", "citation"} or not source["url"].startswith("https://"):
            raise ValueError("Explicit primary source attribution required")
    for kind in ("starters", "repairCases"):
        for item in data[kind]:
            if set(item) != {"id", "title", "description", "learning", "project"} or item["id"] in ids:
                raise ValueError("Invalid or duplicate starter")
            ids.add(item["id"])
            for key in ("title", "description", "learning"):
                bilingual(item[key])
            issues = project_issues(item["project"])
            if (kind == "starters" and issues) or (kind == "repairCases" and not issues):
                raise ValueError(f"Unexpected design verdict: {item['id']}: {sorted(issues)}")
    expected = {"repair-closed-width": "CLOSED_WIDTH", "repair-v-opening": "V_DOMAIN"}
    for item in data["repairCases"]:
        if item["id"] in expected and expected[item["id"]] not in project_issues(item["project"]):
            raise ValueError("Repair case no longer demonstrates its documented problem")


def close(actual: float, expected: float, tolerance: float = 1e-7) -> None:
    if not math.isclose(actual, expected, abs_tol=tolerance, rel_tol=0):
        raise ValueError(f"Independent fixture mismatch: {actual} versus {expected}")


def validate_fixtures(data: dict) -> None:
    if data["schemaVersion"] != 1 or data["units"] != "mm" or len(data["vPoses"]) < 5:
        raise ValueError("Independent fixture schema")
    # Check tabulated ridge coordinates through fixed distances and dot products,
    # rather than generating the ridge with the renderer's line-circle formula.
    for case in data["vPoses"]:
        beta, gamma, q = map(math.radians, (case["betaDeg"], case["gammaDeg"], case["openingDeg"]/2))
        c = [case["ridge"][0], case["ridge"][1]-case["y"], case["ridge"][2]]
        close(math.hypot(*c), case["h"])
        for sign in (-1, 1):
            attachment = [sign*math.sin(beta)*math.sin(q), math.cos(beta), math.sin(beta)*math.cos(q)]
            close(sum(a*b for a,b in zip(attachment, c)), case["h"]*math.cos(gamma))
            distance = math.sqrt(sum((case["r"]*a-b)**2 for a,b in zip(attachment, c)))
            close(distance, math.sqrt(case["r"]**2+case["h"]**2-2*case["r"]*case["h"]*math.cos(gamma)))
        if c[2] <= 0:
            raise ValueError("Fixture chose the exterior branch")
    s = data["step"]
    close(s["middleCrease"], s["b"]-s["a"])
    close(s["closedReach"], s["a"]+s["b"])
    close(s["movingArea"], (s["a"]+s["b"])*s["width"])
    close(s["stationaryArea"]+s["movingArea"], 2*s["W"]*s["H"])
    a = data["invalidAngles"]
    close(a["fullOpenDiscriminant"], math.cos(math.radians(a["betaDeg"]))**2-math.cos(math.radians(a["gammaDeg"]))**2)
    if a["fullOpenDiscriminant"] >= 0:
        raise ValueError("Invalid fixture no longer has an impossible opening")
    lane = data["lanes"]
    close(lane["lo"], -25)
    close(lane["hi"], 20*math.sqrt(3))
    close(lane["sixSpanGap5"], 6*(25+20*math.sqrt(3))+25)
    close(data["print"]["rulerPt"], data["print"]["rulerMm"]*72/25.4)


def compile_outputs(root: Path) -> dict[str, bytes]:
    data, fixtures = (read_json(root/path) for path in SOURCES)
    validate_catalog(data)
    validate_fixtures(fixtures)
    compact = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    ts = ('// Generated from data/sources/projects.json. Do not edit.\n'
          'import { freeze } from "./shared";\nimport type { Starter } from "./types";\n\n'
          '// prettier-ignore\nexport const STARTERS = freeze<readonly Starter[]>(' + compact(data["starters"]) + ');\n\n'
          '// prettier-ignore\nexport const REPAIR_CASES = freeze<readonly Starter[]>(' + compact(data["repairCases"]) + ');\n')
    return {OUTPUTS[0]: encode(data), OUTPUTS[1]: encode(fixtures), OUTPUTS[2]: ts.encode("utf-8")}


def record(path: str, content: bytes) -> dict:
    return {"path": path, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}


def manifest(root: Path, outputs: dict[str, bytes]) -> dict:
    compiler = root/"data-pipeline/run.py"
    return {"schemaVersion": 1, "method": "deterministic-original-design-compiler-v1", "compiler": record("data-pipeline/run.py", compiler.read_bytes()), "sources": [record(p, (root/p).read_bytes()) for p in SOURCES], "artifacts": [record(p, outputs[p]) for p in OUTPUTS], "claims": ["Restricted zero-thickness geometry", "Independent numerical fixtures", "No physical assembly validation"]}


def generate(root: Path) -> dict:
    outputs = compile_outputs(root)
    for path, content in outputs.items():
        target = root/path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    result = manifest(root, outputs)
    (root/MANIFEST).write_bytes(encode(result))
    return result


def verify(root: Path) -> dict:
    expected = compile_outputs(root)
    expected_manifest = manifest(root, expected)
    if (root/MANIFEST).read_bytes() != encode(expected_manifest):
        raise ValueError("Integrity metadata differs from the current source bytes")
    for path, content in expected.items():
        if (root/path).read_bytes() != content:
            raise ValueError(f"Derived content differs: {path}")
    actual = {p.name for p in (root/"data/artifacts").iterdir()}
    if actual != {"projects.json", "fixtures.json", "integrity.json"}:
        raise ValueError("Unexpected canonical artifact")
    return expected_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("generate", "verify"))
    parser.add_argument("--root", type=Path, default=REPO)
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        if args.command == "generate" and root != REPO:
            # Explicit sandbox acquisition copies only the two public source files.
            for name in (*SOURCES, "data-pipeline/run.py"):
                target = root/name
                if not target.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(REPO/name, target)
        result = generate(root) if args.command == "generate" else verify(root)
        print(json.dumps({"status": "pass", "command": args.command, "artifactCount": len(result["artifacts"])}))
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"PLEGA data check failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
