"""Import individually audited Creative Commons diagram sheets by Tavin.

The original PDF hash is pinned. A changed upstream file must be reviewed again
before it can enter the public build. Requires Poppler's pdftoppm for previews.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public" / "guide" / "tavin"
MANIFEST = ROOT / "data" / "guide" / "tavin-diagrams.json"
ASSET_INVENTORY = ROOT / "docs" / "asset-licenses.json"
LICENSE_SA = "https://creativecommons.org/licenses/by-sa/3.0/"
LICENSE_BY = "https://creativecommons.org/licenses/by/3.0/"
SOURCE_PAGE = "https://tavinsorigami.com/downloads/"

# Every PDF was opened and visually inspected on 2026-09-27; searchable license
# text was checked where extractable, otherwise the on-page notice was read.
# These are traditional models/bases with Tavin's original diagrams. Other
# downloads were excluded when design ownership or licensing was uncertain.
SOURCES = (
    (836, "Bird base", "Bases", "CC BY-SA 3.0", LICENSE_SA, "a6a33b6bf968cbfcccfefddef952fa5c679a5b7e259e09aa75bed725ae56438b"),
    (844, "Claws", "Animals", "CC BY-SA 3.0", LICENSE_SA, "01ca179af46a0fc131a1117e7af2331fd9fccf62337ecf105bf16a9256028951"),
    (846, "Crane", "Birds", "CC BY-SA 3.0", LICENSE_SA, "7bf6428c82f384b2ed0ed2651fcb676225d2b8e63b8f37c7d7726320832754fe"),
    (848, "Cup", "Useful folds", "CC BY-SA 3.0", LICENSE_SA, "2a09ade61e79383f86303d21dd961c5095702fd55c52aa5b7e1db9ae8c3af9c8"),
    (852, "Fish base", "Bases", "CC BY-SA 3.0", LICENSE_SA, "996d05a9559d456b2683ee5e019e49af3c212dcf4611413972299c95fa41ce39"),
    (854, "Flapping bird", "Birds", "CC BY-SA 3.0", LICENSE_SA, "c16ceaef79f208a1d42b149dcfe831c0987138a5faff5db7f2da156b039baaf6"),
    (856, "Fox", "Animals", "CC BY 3.0", LICENSE_BY, "fac864191489e6eacae0adf6e0e645595ecef8eb6e6f67431d9a1b6e6771a29f"),
    (860, "Mouse", "Animals", "CC BY-SA 3.0", LICENSE_SA, "619649e4afa82dd850546a5b5f33a52373e223b71e1d46842406dceeea4fb818"),
    (862, "Pig", "Animals", "CC BY-SA 3.0", LICENSE_SA, "841a0657e6c34cfd34339bee003ffc3582a5c9729e0d702f0213432c8385b5fc"),
    (864, "Rabbit", "Animals", "CC BY-SA 3.0", LICENSE_SA, "bcb7dfd57c7f6ab858deefde36bc821cbe4f9a18b44e2881b6e58412fda3d1b6"),
    (870, "Christmas star", "Decorations", "CC BY-SA 3.0", LICENSE_SA, "1ebafecd1595fb1effe6c2a04628e30d6c88c39c47895ce71a076097a9b30aae"),
    (872, "Jumping frog", "Animals", "CC BY-SA 3.0", LICENSE_SA, "3cc046b145d9471300f42ada7d9313dc631d53a95899b4ea3adc1a3f845f5784"),
    (874, "Steamer", "Vehicles", "CC BY-SA 3.0", LICENSE_SA, "d243a025c34657938a206a40da970e2d605109e4e2ec9bd68285aea80cc114fc"),
    (876, "Waterbomb base", "Bases", "CC BY-SA 3.0", LICENSE_SA, "4856529e7ec50536bc5e414644c9dbb3ad23a6693ff734009cfabe4925a9a7bb"),
    (880, "Sailboat", "Vehicles", "CC BY-SA 3.0", LICENSE_SA, "996373534e7ba96a3431de754e9b807feae6647e2dbe8cbd36de8b1c924b0364"),
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def records() -> list[dict]:
    output = []
    for identifier, title, category, license_name, license_url, pinned_hash in SOURCES:
        stem = str(identifier)
        pdf = PUBLIC / f"{stem}.pdf"
        png = PUBLIC / f"{stem}.png"
        if not pdf.is_file():
            raise FileNotFoundError(pdf)
        if not png.is_file():
            raise FileNotFoundError(png)
        pdf_bytes, png_bytes = pdf.read_bytes(), png.read_bytes()
        if not pdf_bytes.startswith(b"%PDF") or sha256(pdf_bytes) != pinned_hash:
            raise ValueError(f"PDF integrity or audit pin failed: {identifier}")
        if not png_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError(f"PNG preview invalid: {identifier}")
        output.append({
            "title": title,
            "category": category,
            "asset": f"/guide/tavin/{stem}.png",
            "download": f"/guide/tavin/{stem}.pdf",
            "sourcePage": SOURCE_PAGE,
            "sourceFile": f"https://tavinsorigami.com/?mdocs-file={identifier}",
            "author": "Traditional model; diagram by Tavin",
            "license": license_name,
            "licenseUrl": license_url,
            "changes": "First-page PNG rendering of Tavin's original one-page PDF for on-screen viewing; PDF unmodified",
            "pdfSha256": pinned_hash,
            "previewSha256": sha256(png_bytes),
            "pdfBytes": len(pdf_bytes),
            "previewBytes": len(png_bytes),
        })
    return output


def generate() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for identifier, _, _, _, _, pinned_hash in SOURCES:
        pdf = PUBLIC / f"{identifier}.pdf"
        if not pdf.exists():
            request = Request(f"https://tavinsorigami.com/?mdocs-file={identifier}", headers={"User-Agent": "PLEGA source audit/1.0"})
            with urlopen(request, timeout=30) as response:
                data = response.read(5_000_000)
            if not data.startswith(b"%PDF") or sha256(data) != pinned_hash:
                raise ValueError(f"Upstream PDF changed; review license and design before updating {identifier}")
            pdf.write_bytes(data)
        if sha256(pdf.read_bytes()) != pinned_hash:
            raise ValueError(f"Local PDF changed: {identifier}")
        preview = PUBLIC / f"{identifier}.png"
        if not preview.exists():
            subprocess.run(["pdftoppm", "-f", "1", "-l", "1", "-scale-to", "1600", "-png", "-singlefile", str(pdf), str(preview.with_suffix(""))], check=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    reviewed = records()
    MANIFEST.write_text(json.dumps({"schema": 1, "source": SOURCE_PAGE, "records": reviewed}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    inventory = json.loads(ASSET_INVENTORY.read_text(encoding="utf-8"))
    inventory["researchBoundary"] = "Only the individually licensed Commons and Tavin diagram assets inventoried below are redistributed; other third-party plans remain links at source."
    inventory["assets"] = [item for item in inventory["assets"] if not item["path"].startswith("frontend/public/guide/tavin/")]
    for record in reviewed:
        for key, sha_key, bytes_key in (("asset", "previewSha256", "previewBytes"), ("download", "pdfSha256", "pdfBytes")):
            inventory["assets"].append({
                "path": "frontend/public" + record[key],
                "bytes": record[bytes_key],
                "sha256": record[sha_key],
                "license": record["license"],
                "origin": record["sourceFile"],
                "author": record["author"],
                "licenseUrl": record["licenseUrl"],
                "changes": record["changes"] if key == "asset" else "Original unmodified PDF",
            })
    ASSET_INVENTORY.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(SOURCES)} reviewed sheets")


def verify() -> None:
    expected = {"schema": 1, "source": SOURCE_PAGE, "records": records()}
    if json.loads(MANIFEST.read_text(encoding="utf-8")) != expected:
        raise ValueError("Tavin manifest or bundled assets changed")
    print(f"Verified {len(SOURCES)} licensed PDFs and previews")


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("command", choices=("generate", "verify"))
    args = cli.parse_args()
    generate() if args.command == "generate" else verify()
