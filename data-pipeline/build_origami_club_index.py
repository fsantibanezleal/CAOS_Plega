"""Build a link-only catalog of Origami Club's free guide pages.

Origami Club explicitly allows links to its site. Its diagrams and animations
remain there. We never download, embed, mirror or rewrite them.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = "https://en.origami-club.com/"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "guide" / "origami-club-index.json"
EXCLUDED = {"site", "technique", "anime", "shingu", "link", "color", "figured", "artist", "unknow"}


class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.hrefs.append(href)


def fetch(url: str) -> list[str]:
    request = Request(url, headers={"User-Agent": "PlegaCatalogResearch/1.0 (+https://github.com/fsantibanezleal/CAOS_Plega)"})
    with urlopen(request, timeout=25) as response:
        body = response.read(2_000_000).decode("utf-8", errors="replace")
    parser = Links()
    parser.feed(body)
    return parser.hrefs


def canonical(href: str, base: str) -> str | None:
    url = urljoin(base, href)
    parsed = urlparse(url)
    if parsed.hostname not in {"en.origami-club.com", "www.en.origami-club.com"} or not parsed.path.endswith("/index.html"):
        return None
    return "https://en.origami-club.com" + parsed.path


def main() -> None:
    home = fetch(ROOT)
    category_urls: set[str] = set()
    for href in home:
        url = canonical(href, ROOT)
        if url and len(urlparse(url).path.strip("/").split("/")) == 2:
            category = urlparse(url).path.strip("/").split("/")[0]
            if category not in EXCLUDED:
                category_urls.add(url)
    pages: dict[str, list[str]] = {ROOT: home}
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(fetch, url): url for url in sorted(category_urls)}
        for future in as_completed(futures):
            url = futures[future]
            try:
                pages[url] = future.result()
            except Exception:
                failures.append(url)
    models: dict[str, dict] = {}
    for page in sorted(pages):
        for href in pages[page]:
            url = canonical(href, page)
            if not url:
                continue
            parts = urlparse(url).path.strip("/").split("/")
            if len(parts) < 3 or parts[0] in EXCLUDED or parts[-2] in EXCLUDED:
                continue
            category = parts[0].replace("-", " ").title()
            title = parts[-2].replace("-", " ").replace("_", " ").title()
            if title.isdigit() or len(title) < 3:
                continue
            models.setdefault(url, {
                "title": title,
                "category": category,
                "planUrl": url,
                "indexPage": page,
                "access": "free-to-access external guide page",
                "rights": "external only; Origami Club retains diagram and animation rights",
            })
    output = {
        "schema": 1,
        "source": ROOT,
        "rightsPage": "https://en.origami-club.com/site/faq.html",
        "policy": "Links only. Origami Club's images, diagrams and animations are not bundled or embedded.",
        "categoryPages": len(pages) - 1,
        "failedCategoryPages": sorted(failures),
        "entries": sorted(models.values(), key=lambda x: (x["category"], x["title"], x["planUrl"])),
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Indexed {len(models)} Origami Club guide links from {len(pages) - 1} categories; failures: {len(failures)}")


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("command", choices=("generate", "verify"))
    args = cli.parse_args()
    if args.command == "generate":
        main()
    else:
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        assert data["schema"] == 1 and data["source"] == ROOT
        assert len(data["entries"]) == len({entry["planUrl"] for entry in data["entries"]})
        assert all(entry["planUrl"].startswith(ROOT) for entry in data["entries"])
        print(f"Verified {len(data['entries'])} Origami Club source links")
