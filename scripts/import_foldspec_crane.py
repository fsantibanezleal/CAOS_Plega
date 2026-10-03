"""Verify or refresh a pinned crane source and its deterministic viewing copy."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE_TARGET = ROOT / "data/guide/foldspec/crane-source.fold.json"
PUBLIC_TARGET = ROOT / "frontend/public/lessons/crane/crane.fold.json"
LICENSE_TARGET = ROOT / "frontend/public/lessons/crane/LICENSE"
REVISION = "0ee55e1b748e46101b9bb20e7b285fcaaa07e30f"
SOURCE_HASH = "a929fd12bac4d89bd050f643d66408cb8421d94842cf13dbc1e4bdde215c9995"
LICENSE_HASH = "19208ee3fa17ecdf6bef52577084b37f14e5e8b3de1cae90b90bb7c4ccfb3915"


def validate(name: str, data: bytes, expected: str) -> None:
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected:
        raise ValueError(f"{name}: SHA-256 {digest} does not match pinned source")


def viewing_copy(data: bytes) -> bytes:
    lesson = json.loads(data)
    if lesson["status"] != "resolved" or lesson["geometry"]["status"] != "complete":
        raise ValueError("Crane lesson is not fully resolved")
    steps = lesson["instructions"]["steps"]
    if len(steps) != 44 or len(lesson["geometry"]["operations"]) != 40:
        raise ValueError("Crane lesson no longer has 44 steps and 40 operations")
    # Geometry and English instructions remain the pinned upstream content.
    # PLEGA adds a separately authored Spanish translation and camera framing.
    translation = json.loads((ROOT / 'data/guide/foldspec/crane-es.json').read_bytes())
    lesson['metadata']['title']['es'] = 'Grulla de papel'
    for index, step in enumerate(steps):
        step['title']['es'] = translation[step['id']]['title']
        step['body']['es'] = translation[step['id']]['body']
        if index < 30:
            continue
        fraction = (index - 29) / 14
        offset = round(45 * fraction, 6)
        camera = step["camera"]
        camera["verticalSpanMm"] = round(230 - 125 * fraction, 6)
        camera["positionMm"] = [150, round(-200 + offset, 6), 230]
        camera["targetMm"] = [0, offset, 0]
    return (json.dumps(lesson, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--update", action="store_true", help="download only the pinned upstream revision")
    args = parser.parse_args()
    if args.update:
        with urlopen(f"https://raw.githubusercontent.com/FoldLab/fold-spec/{REVISION}/examples/crane/crane.fold.json", timeout=30) as response:
            source = response.read()
        with urlopen(f"https://raw.githubusercontent.com/FoldLab/fold-spec/{REVISION}/LICENSE", timeout=30) as response:
            license_text = response.read()
    else:
        source = SOURCE_TARGET.read_bytes()
        license_text = LICENSE_TARGET.read_bytes()
    validate("crane source", source, SOURCE_HASH)
    validate("license", license_text, LICENSE_HASH)
    if b"MIT License" not in license_text:
        raise ValueError("Upstream MIT license text missing")
    derived = viewing_copy(source)
    if args.update:
        SOURCE_TARGET.parent.mkdir(parents=True, exist_ok=True)
        PUBLIC_TARGET.parent.mkdir(parents=True, exist_ok=True)
        SOURCE_TARGET.write_bytes(source)
        PUBLIC_TARGET.write_bytes(derived)
        LICENSE_TARGET.write_bytes(license_text)
    elif PUBLIC_TARGET.read_bytes() != derived:
        raise ValueError("Public viewing copy differs from deterministic source transformation")
    print("Pinned crane source, viewing copy and license verified")


if __name__ == "__main__":
    main()
