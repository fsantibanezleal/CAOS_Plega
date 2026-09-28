"""Build a link-only catalog from creator-run, free origami tutorial sites.

Only short titles and URLs are retained. Tutorials, media, and instructions
remain on their creators' sites. Run generate intentionally; verify is offline.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

OUTPUT = Path(__file__).resolve().parents[1] / "data" / "guide" / "community-tutorials.json"
NAMESPACE = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
PAPER = "https://www.paperkawaii.com/"
ME = "https://origami.me/"
PLUS = "https://origami.plus/"
WAY = "https://www.origamiway.com/sitemap/"


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "PLEGA tutorial index/1.0 (+https://github.com/fsantibanezleal/CAOS_Plega)"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=25) as response:
                return response.read(3_000_000)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))
    raise AssertionError("unreachable")


def sitemap(url: str) -> list[str]:
    root = ET.fromstring(fetch(url))
    return [node.find("s:loc", NAMESPACE).text for node in root.findall("s:url", NAMESPACE)]


class AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.items: list[tuple[str, str]] = []
        self.url = ""
        self.title = ""
        self.buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            info = dict(attrs)
            self.url = info.get("href") or ""
            self.title = info.get("title") or ""
            self.buffer = []

    def handle_data(self, data: str) -> None:
        if self.url:
            self.buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.url:
            title = self.title or " ".join(self.buffer)
            title = " ".join(title.split())
            if title:
                self.items.append((title[:100], self.url))
            self.url = ""


def links(url: str) -> list[tuple[str, str]]:
    parser = AnchorParser()
    parser.feed(fetch(url).decode("utf-8", errors="replace"))
    return parser.items


def category(title: str) -> str:
    lower = title.lower()
    for label, terms in (
        ("Animals", ("animal", "cat", "dog", "fox", "frog", "rabbit", "mouse", "elephant", "fish", "whale", "butterfly", "bug", "insect", "dinosaur", "bear")),
        ("Birds", ("bird", "crane", "swan", "owl", "penguin", "chicken", "duck", "dove")),
        ("Flowers & plants", ("flower", "rose", "lily", "tulip", "lotus", "plant", "leaf", "tree")),
        ("Boxes & containers", ("box", "bowl", "basket", "pot", "container", "vase")),
        ("Stars & decorations", ("star", "ornament", "christmas", "snowflake", "decoration", "garland")),
        ("Useful folds", ("envelope", "bookmark", "wallet", "letter", "holder", "folder", "cup")),
        ("Toys & vehicles", ("toy", "plane", "airplane", "boat", "car", "rocket", "spinner")),
    ):
        if any(word in lower for word in terms):
            return label
    return "More models"


def add(output: dict[str, dict], title: str, url: str, source: str, index_page: str) -> None:
    url = url.split("#", 1)[0]
    if url not in output:
        output[url] = {"title": title, "category": category(title), "planUrl": url, "source": source, "indexPage": index_page, "access": "free-to-access external tutorial page", "rights": "link only; creator retains tutorial and media rights"}


def build() -> dict:
    found: dict[str, dict] = {}
    paper_sitemaps = ("post-sitemap1.xml", "post-sitemap2.xml", "photo_tutorials-sitemap.xml")
    for listing in paper_sitemaps:
        page = urljoin(PAPER, listing)
        for url in sitemap(page):
            slug = urlparse(url).path.strip("/").split("/")[-1]
            lower = slug.lower()
            if "origami" not in url.lower() or any(term in lower for term in ("printable", "paper-review", "book-review", "ebook", "paper-shop", "giveaway")):
                continue
            if not any(term in url.lower() for term in ("tutorial", "instruction", "diagram", "how-to", "origami-photo-tutorials")):
                continue
            title = re.sub(r"[-_]+", " ", slug).title()
            add(found, title, url, "Paper Kawaii", page)

    for title, href in links(PLUS):
        url = urljoin(PLUS, href)
        parsed = urlparse(url)
        if parsed.netloc != "origami.plus" or not parsed.path.startswith("/origami-") or parsed.path.count("/") != 1:
            continue
        if title.lower().startswith("origami") and "cubes" not in title.lower() and not any(term in title.lower() for term in (" flyaway", " project", " links", " pictures", " patch", " map!")):
            add(found, title, url, "Origami Plus", PLUS)

    for title, href in links(WAY):
        url = urljoin(WAY, href)
        parsed = urlparse(url)
        if parsed.netloc != "www.origamiway.com" or parsed.path == "/sitemap/":
            continue
        if any(token in title.lower() for token in ("origami", "paper airplane", "paper balloon", "paper folding")) and not any(token in title.lower() for token in ("history", "privacy", "terms", "contact", "sitemap", "printable paper")):
            add(found, title, url, "Origami Way", WAY)

    # The public Origami.me post sitemap contains editorials as well as models.
    # Keep only pages with actual numbered fold steps in their current HTML.
    me_urls = sitemap(urljoin(ME, "post-sitemap1.xml")) + sitemap(urljoin(ME, "post-sitemap2.xml"))

    def inspect(url: str) -> tuple[str, bool]:
        try:
            body = fetch(url).decode("utf-8", errors="replace").lower()
            return url, "step 1" in body and "step 2" in body and "how to" in body
        except Exception:
            return url, False

    with ThreadPoolExecutor(max_workers=8) as pool:
        for url, eligible in pool.map(inspect, me_urls):
            if eligible:
                slug = urlparse(url).path.strip("/").split("/")[-1]
                add(found, "Origami " + slug.replace("-", " ").title(), url, "Origami.me", urljoin(ME, "origami-index/"))

    entries = sorted(found.values(), key=lambda x: (x["source"], x["category"], x["title"], x["planUrl"]))
    return {"schema": 1, "policy": "Link-only catalog; creator media and instructions are never mirrored or embedded", "sources": [PAPER, ME, PLUS, WAY], "entries": entries}


def verify(data: dict) -> None:
    entries = data["entries"]
    assert data["schema"] == 1 and len(entries) == len({item["planUrl"] for item in entries})
    assert all(item["planUrl"].startswith("https://") and item["source"] in {"Paper Kawaii", "Origami.me", "Origami Plus", "Origami Way"} for item in entries)
    print(f"Verified {len(entries)} creator-hosted tutorial links")


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("command", choices=("generate", "verify"))
    args = cli.parse_args()
    if args.command == "generate":
        data = build()
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    verify(data)
