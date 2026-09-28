"""Build an attributed, link-only index of free-to-access origami plans.

The source site's diagrams are not relicensed by this program. We retain only
short link labels, their URLs, and the category page that listed them. No
third-party plan, image, description, or instruction text is downloaded.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import Request, urlopen

ROOT = "https://origami-resource-center.com"
INDEX = ROOT + "/free-origami-instructions/"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "guide" / "origami-plan-index.json"
PLAN_EXTENSIONS = {".pdf", ".svg", ".png", ".jpg", ".jpeg", ".gif"}
EXCLUDED_CATEGORIES = {"fabric-folding", "golden-venture-folding", "star-wars", "toilet-paper-origami"}
SKIP_WORDS = {"pg 1", "pg 2", "pg 3", "pg 4", "page 1", "page 2", "page 3", "page 4", "here", "download", "long", "short"}


class ContentLinks(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.current_url: str | None = None
        self.current_text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if not self.depth and a.get("id") == "content":
            self.depth = 1
        elif self.depth and tag not in {"br", "hr", "img", "input", "meta", "link", "source"}:
            self.depth += 1
        if tag == "a" and self.depth and a.get("href"):
            self.current_url = a["href"]
            self.current_text = []
        elif tag == "img" and self.current_url and a.get("alt"):
            self.current_text.append(a["alt"] or "")

    def handle_data(self, data: str) -> None:
        if self.current_url:
            self.current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.current_url:
            label = " ".join(" ".join(self.current_text).split())
            if label:
                self.links.append((label, self.current_url))
            self.current_url = None
        if self.depth and tag not in {"br", "hr", "img", "input", "meta", "link", "source"}:
            self.depth -= 1


def fetch_links(url: str) -> list[tuple[str, str]]:
    request = Request(url, headers={"User-Agent": "PlegaCatalogResearch/1.0 (+https://github.com/fsantibanezleal/CAOS_Plega)"})
    with urlopen(request, timeout=25) as response:
        body = response.read(2_500_000).decode("utf-8", errors="replace")
    parser = ContentLinks()
    parser.feed(body)
    return parser.links


def clean_label(label: str) -> str:
    return re.sub(r"\s+", " ", label).strip(" •·,;:–- ")[:100]


def build() -> dict:
    top_links = fetch_links(INDEX)
    categories: dict[str, str] = {}
    for label, url in top_links:
        parsed = urlparse(url)
        slug = parsed.path.strip("/")
        if parsed.netloc in {"origami-resource-center.com", "www.origami-resource-center.com"} and slug not in {"", "free-origami-instructions", *EXCLUDED_CATEGORIES}:
            categories.setdefault(parsed.scheme + "://" + parsed.netloc + parsed.path, slug.replace("-", " ").title())

    entries: dict[str, dict] = {}
    failures: list[dict] = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(fetch_links, url): (url, category) for url, category in categories.items()}
        for future in as_completed(futures):
            page, category = futures[future]
            try:
                links = future.result()
            except Exception as error:  # a failure is recorded, never converted to an empty successful category
                failures.append({"categoryPage": page, "error": type(error).__name__})
                continue
            for label, url in links:
                parsed = urlparse(url)
                ext = Path(unquote(parsed.path)).suffix.lower()
                query_keys = {key.lower() for key in parse_qs(parsed.query)}
                if parsed.scheme not in {"http", "https"} or ext not in PLAN_EXTENSIONS or parsed.netloc.lower().endswith("archive.org") or query_keys.intersection({"token", "auth", "signature", "key", "expires", "access_token"}):
                    continue
                label = clean_label(label)
                if len(label) < 3 or label.lower() in SKIP_WORDS or label.lower().startswith(("page ", "pg ", "click here", "download here")):
                    continue
                canonical = parsed._replace(fragment="").geturl()
                if canonical not in entries:
                    entries[canonical] = {
                        "title": label,
                        "category": category,
                        "planUrl": canonical,
                        "indexPage": page,
                        "access": "external file link listed as a free instruction",
                        "rights": "external only; creator and diagrammer retain their rights",
                    }
    return {
        "schema": 1,
        "source": INDEX,
        "policy": "Link-only index. Do not mirror or animate third-party plans without an explicit per-plan license or permission.",
        "categoryPages": len(categories),
        "failedCategoryPages": sorted(failures, key=lambda x: x["categoryPage"]),
        "entries": sorted(entries.values(), key=lambda x: (x["category"].casefold(), x["title"].casefold(), x["planUrl"])),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["generate", "verify"])
    args = parser.parse_args()
    if args.command == "generate":
        data = build()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Indexed {len(data['entries'])} external plan links from {data['categoryPages']} pages; failures: {len(data['failedCategoryPages'])}")
    else:
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        assert data["schema"] == 1
        assert len(data["entries"]) == len({x["planUrl"] for x in data["entries"]})
        assert all(x["planUrl"].startswith(("http://", "https://")) for x in data["entries"])
        print(f"Verified {len(data['entries'])} external plan links")


if __name__ == "__main__":
    main()
