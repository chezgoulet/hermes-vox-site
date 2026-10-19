#!/usr/bin/env python3
"""Fail the build if the generated site links to something it does not ship.

Checks local href/src targets and same-page anchors. External links are not
fetched (the build has no network guarantee and a dead external link is not a
build failure).
"""
import re
import sys
from pathlib import Path

SKIP_SCHEMES = ("http://", "https://", "mailto:", "tel:", "data:", "javascript:")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: linkcheck.py <dist-dir>", file=sys.stderr)
        return 2
    dist = Path(sys.argv[1])
    index = dist / "index.html"
    if not index.is_file():
        print(f"linkcheck: {index} missing", file=sys.stderr)
        return 1

    html = index.read_text(encoding="utf-8")
    ids = set(re.findall(r'\bid="([^"]+)"', html))
    problems: list[str] = []

    for attr, target in re.findall(r'\b(href|src)="([^"]+)"', html):
        if target.startswith(SKIP_SCHEMES) or target.startswith("//"):
            continue
        if target.startswith("#"):
            if target[1:] and target[1:] not in ids:
                problems.append(f"missing anchor: {target}")
            continue
        path = target.split("#", 1)[0].split("?", 1)[0]
        if not path:
            continue
        if path.startswith("/"):
            candidate = dist / path.lstrip("/")
        else:
            candidate = index.parent / path
        if not candidate.exists():
            problems.append(f"{attr} -> {target} (no such file: {candidate})")

    # Every screenshot the page references must have been copied from the app tag.
    shots = [t for t in re.findall(r'src="([^"]+)"', html)
             if t.endswith((".webp", ".jpg", ".jpeg", ".png")) and "/badge" not in t]
    if len(shots) < 3:
        problems.append(f"only {len(shots)} images referenced; expected at least 3")

    if problems:
        print("linkcheck: FAILED", file=sys.stderr)
        for p in problems:
            print("  -", p, file=sys.stderr)
        return 1

    print(f"linkcheck: OK — {len(ids)} anchors, {len(shots)} screenshots, all local targets exist")
    return 0


if __name__ == "__main__":
    sys.exit(main())
