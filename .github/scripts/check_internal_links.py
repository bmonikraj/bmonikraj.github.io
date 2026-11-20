"""Fail if any page in the built site links to a local file that doesn't exist.

Usage: python3 check_internal_links.py <public-dir> <base-url>
Checks href/src attributes that point at the site itself (relative paths or
<base-url>/...). External links are checked separately by lychee.
"""
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

public, base = Path(sys.argv[1]), sys.argv[2].rstrip("/")


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ("href", "src") and value:
                self.urls.append(value)


def target(page, url):
    if url.startswith(base):
        url = url[len(base):] or "/"
    elif urlsplit(url).scheme or url.startswith(("//", "#")):
        return None  # external, mailto:, or in-page anchor
    path = unquote(urlsplit(url).path)
    if not path:
        return None
    p = public / path.lstrip("/") if path.startswith("/") else page.parent / path
    return p / "index.html" if path.endswith("/") or p.is_dir() else p


broken = []
for page in public.rglob("*.html"):
    parser = Links()
    parser.feed(page.read_text(encoding="utf-8"))
    for url in parser.urls:
        t = target(page, url)
        if t is not None and not t.exists():
            broken.append(f"{page.relative_to(public)}: {url}")

print("\n".join(broken) or "All internal links resolve.")
sys.exit(1 if broken else 0)
