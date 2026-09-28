"""Import explicitly free-licensed Commons model diagrams with attribution.

Only PNG thumbnails rendered by Wikimedia are stored. The original file page
and its license are kept in a public manifest. This list is intentionally
curated: a Commons category alone is not sufficient licensing evidence.
"""

from __future__ import annotations

import argparse
from html import unescape
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "frontend" / "public" / "guide" / "commons"
MANIFEST = ROOT / "data" / "guide" / "commons-diagrams.json"
ASSET_INVENTORY = ROOT / "docs" / "asset-licenses.json"
TITLES = [
    "Origami boat.svg",
    "Origami box.svg",
    "Origami box type1.svg",
    "Origami chicken.svg",
    "Origami cube.svg",
    "Origami flower.svg",
    "Origami helmet.svg",
    "Origami paper popper type1.svg",
    "Origami paper popper type3.svg",
    "Origami paper popper type4.svg",
    "Origami shell.svg",
    "Origami snail.svg",
    "Origami star.svg",
    "Origami windmill.svg",
    "Origami Dog Face Instructions.png",
    "Origami Diagrams of Origami Rooster.jpg",
    "Tsuru wiki.svg",
]


class StripTags(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.words: list[str] = []

    def handle_data(self, data: str) -> None:
        self.words.append(data)


def plain(value: str) -> str:
    parser = StripTags()
    parser.feed(unescape(value))
    return " ".join(" ".join(parser.words).split())


def get(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "PlegaCommonsImport/1.0 (+https://github.com/fsantibanezleal/CAOS_Plega)"})
    with urlopen(request, timeout=40) as response:
        return response.read(8_000_000)


def main() -> None:
    query = urlencode({
        "action": "query", "format": "json", "titles": "|".join("File:" + x for x in TITLES),
        "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": "1200",
    })
    data = json.loads(get("https://commons.wikimedia.org/w/api.php?" + query))
    DEST.mkdir(parents=True, exist_ok=True)
    records = []
    for page in sorted(data["query"]["pages"].values(), key=lambda x: x["title"]):
        if "imageinfo" not in page:
            raise ValueError(f"Missing image: {page['title']}")
        info = page["imageinfo"][0]
        meta = info["extmetadata"]
        short = plain(meta.get("LicenseShortName", {}).get("value", ""))
        license_url = plain(meta.get("LicenseUrl", {}).get("value", ""))
        public_domain = short == "Public domain" and meta.get("Copyrighted", {}).get("value") == "False"
        licensed = short.startswith(("CC BY", "CC0")) and license_url.startswith(("http://creativecommons.org/", "https://creativecommons.org/"))
        if not (public_domain or licensed):
            raise ValueError(f"Unaccepted license {short!r}: {page['title']}")
        if public_domain:
            license_url = info["descriptionurl"]
        else:
            license_url = license_url.replace("http://creativecommons.org/", "https://creativecommons.org/", 1)
        media_url = info.get("thumburl", info["url"])
        extension = ".png" if "image/png" in info.get("thumbmime", "") or page["title"].lower().endswith(".svg") else Path(media_url.split("?", 1)[0]).suffix.lower()
        if extension not in {".png", ".jpg", ".jpeg"}:
            raise ValueError(f"Unexpected thumbnail format: {media_url}")
        name = page["title"][5:].rsplit(".", 1)[0].lower().replace(" ", "-") + extension
        payload = get(media_url)
        if len(payload) > 8_000_000:
            raise ValueError(f"Image too large: {page['title']}")
        (DEST / name).write_bytes(payload)
        records.append({
            "title": page["title"][5:].rsplit(".", 1)[0],
            "asset": "/guide/commons/" + name,
            "sourcePage": info["descriptionurl"],
            "sourceFile": info["url"].split("?", 1)[0],
            "author": plain(meta.get("Artist", {}).get("value", "Unknown")),
            "license": short,
            "licenseUrl": license_url,
            "changes": "Wikimedia-rendered thumbnail of the original diagram; no diagram edits",
            "sha256": hashlib.sha256(payload).hexdigest(),
            "bytes": len(payload),
        })
    MANIFEST.write_text(json.dumps({"schema": 1, "records": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    inventory = json.loads(ASSET_INVENTORY.read_text(encoding="utf-8"))
    inventory["researchBoundary"] = "Only the individually licensed Commons and Tavin diagram assets inventoried below are redistributed; other third-party plans remain links at source."
    inventory["assets"] = [item for item in inventory["assets"] if not item["path"].startswith("frontend/public/guide/commons/")]
    for record in records:
        inventory["assets"].append({
            "path": "frontend/public" + record["asset"],
            "bytes": record["bytes"],
            "sha256": record["sha256"],
            "license": record["license"],
            "origin": record["sourcePage"],
            "author": record["author"],
            "licenseUrl": record["licenseUrl"],
            "changes": record["changes"],
        })
    ASSET_INVENTORY.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(records)} licensed diagram thumbnails")


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("command", choices=("generate", "verify"))
    args = cli.parse_args()
    if args.command == "generate":
        main()
    else:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        inventory = json.loads(ASSET_INVENTORY.read_text(encoding="utf-8"))
        listed = {item["path"]: item for item in inventory["assets"]}
        assert data["schema"] == 1 and len(data["records"]) == len(TITLES)
        for record in data["records"]:
            path = "frontend/public" + record["asset"]
            payload = (ROOT / path).read_bytes()
            assert hashlib.sha256(payload).hexdigest() == record["sha256"]
            assert len(payload) == record["bytes"]
            assert listed[path]["sha256"] == record["sha256"]
            assert record["license"] in {"Public domain", "CC0", "CC BY 3.0", "CC BY-SA 4.0"}
        print(f"Verified {len(data['records'])} Commons licensed diagrams")
