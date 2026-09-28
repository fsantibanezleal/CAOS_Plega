"""Snapshot reachability of third-party file links without downloading plans.

Network checks are intentional research maintenance, not part of normal CI.
Only links returning a successful image/PDF response enter the public index.
The snapshot is dated because third-party availability can later change.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "data" / "guide" / "origami-plan-index.json"
OUTPUT = ROOT / "data" / "guide" / "origami-plan-health.json"
ACCEPTED = ("application/pdf", "image/png", "image/jpeg", "image/gif", "image/svg+xml", "application/octet-stream")


def check(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "PLEGA link audit/1.0 (+https://github.com/fsantibanezleal/CAOS_Plega)"})
    try:
        with urlopen(request, timeout=10) as response:
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
            final = urlparse(response.geturl())
            signed = {key.lower() for key in parse_qs(final.query)}.intersection({"token", "auth", "signature", "key", "expires", "access_token"})
            status = response.status
            # Some legacy hosts do not provide a type; retain only a direct
            # image/PDF URL then, not an arbitrary HTML response.
            extension = Path(final.path).suffix.lower()
            valid_type = content_type in ACCEPTED or (not content_type and extension in {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg"})
            return {"url": url, "available": status == 200 and valid_type and not signed, "status": status, "contentType": content_type, "resolvedHost": final.netloc, "reason": "signed redirect excluded" if signed else ""}
    except Exception as error:
        return {"url": url, "available": False, "error": type(error).__name__}


def verify(index: dict, health: dict) -> None:
    indexed = {item["planUrl"] for item in index["entries"]}
    records = health["records"]
    assert health["schema"] == 1 and len(records) == len(indexed)
    assert {item["url"] for item in records} == indexed
    assert all(item["url"].startswith(("http://", "https://")) for item in records)
    print(f"Verified {sum(item['available'] for item in records)}/{len(records)} reachable file-link snapshots")


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("command", choices=("generate", "verify"))
    args = cli.parse_args()
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    if args.command == "generate":
        urls = sorted(item["planUrl"] for item in index["entries"])
        with ThreadPoolExecutor(max_workers=16) as pool:
            records = list(pool.map(check, urls))
        health = {"schema": 1, "checkedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"), "method": "HTTP GET headers; a 200 image/PDF response is eligible for display, not a permanent availability guarantee", "records": records}
        OUTPUT.write_text(json.dumps(health, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        health = json.loads(OUTPUT.read_text(encoding="utf-8"))
    verify(index, health)
