"""Regenerate the declared-license inventory from the exact npm lockfile."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / "frontend/package-lock.json"
OUTPUT = ROOT / "docs/dependency-licenses.json"


def main() -> None:
    raw = LOCK.read_bytes()
    packages = json.loads(raw)["packages"]
    records = []
    for path, package in sorted(packages.items()):
        if not path:
            continue
        name = path.removeprefix("node_modules/")
        if "license" not in package:
            raise ValueError(f"Missing license declaration: {name}")
        records.append({
            "package": name,
            "version": package["version"],
            "license": package["license"],
            "developmentOnly": bool(package.get("dev", False)),
            "optional": bool(package.get("optional", False)),
            "integrity": package.get("integrity"),
        })
    output = {
        "schema": "plega-dependency-licenses/v1",
        "lockfileSha256": hashlib.sha256(raw).hexdigest(),
        "basis": "Exact npm lockfile declarations; bundled Fontkit component notices are additionally retained in THIRD_PARTY_NOTICES.md.",
        "packages": records,
    }
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Recorded {len(records)} packages from {LOCK.name}")


if __name__ == "__main__":
    main()
