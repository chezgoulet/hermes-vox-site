#!/usr/bin/env python3
"""Generate hermesvox.org from the app repository at a release tag.

Every number on the page comes from the app repo at the tag or from that
release's GitHub metadata. There are no hand-typed versions, sizes or dates: a
missing source is a failed build, not a stale page.
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

# Tokens the page must show. The rest are written to site-data.json for audit.
TOKENS = [
    "VERSION", "RELEASE_DATE", "APK_NAME", "APK_SIZE_MB",
    "APK_SHA256_SHORT", "DOWNLOAD_URL",
]
BULLETS = "<!--SHIPPED_BULLETS-->"


def fail(msg: str) -> None:
    print(f"generate: {msg}", file=sys.stderr)
    sys.exit(1)


def read(path: Path) -> str:
    if not path.is_file():
        fail(f"missing source file: {path}")
    return path.read_text(encoding="utf-8")


def version_from_gradle(text: str) -> tuple[str, int]:
    name = re.search(r'versionName\s*=?\s*"([^"]+)"', text)
    code = re.search(r"versionCode\s*=?\s*(\d+)", text)
    if not name or not code:
        fail("android/app/build.gradle has no versionName/versionCode")
    return name.group(1), int(code.group(1))


MARK_BEGIN = "<!-- site:begin -->"
MARK_END = "<!-- site:end -->"


def bullets_from_notes(notes: str) -> list[str]:
    """Bullets explicitly marked for the site, if the release note has them."""
    if MARK_BEGIN not in notes or MARK_END not in notes:
        return []
    block = notes.split(MARK_BEGIN, 1)[1].split(MARK_END, 1)[0]
    items = []
    for line in block.splitlines():
        m = re.match(r"^\s*[-*]\s+(.+?)\s*$", line)
        if m:
            items.append(m.group(1))
    return items


def bullets_from_headings(notes: str, limit: int = 5) -> list[str]:
    """Fallback: section headings, minus the ones that are process, not product."""
    headings = [h.strip() for h in re.findall(r"^##\s+(.+)$", notes, re.M)]
    skip = re.compile(
        r"^(notes|what'?s next|known|appendix|contents|not in this release|"
        r"everything else|also|provenance|pipeline|release process|"
        r"the front page|docs?)\b", re.I)
    out = []
    for h in headings:
        if skip.match(h):
            continue
        h = re.sub(r"\s*\(#\d+\)\s*$", "", h).strip()
        if h and "[internal]" not in h.lower():
            out.append(h)
    return out[:limit]


def shipped_bullets(notes: str, curated: Path, limit: int = 5) -> list[str]:
    """What the page says shipped, in priority order.

    1. A curated list in the site repo (`content/release-<version>.md`) — prose is
       editorial, and a release note is written for engineers, not visitors.
    2. A `<!-- site:begin --> ... <!-- site:end -->` block inside the release note.
    3. Section headings, with process sections skipped as a last resort.
    """
    if curated.is_file():
        items = [m.group(1) for m in
                 (re.match(r"^\s*[-*]\s+(.+?)\s*$", l) for l in curated.read_text().splitlines()) if m]
        if items:
            return items[:limit]
    items = bullets_from_notes(notes)
    if items:
        return items[:limit]
    items = bullets_from_headings(notes, limit)
    if not items:
        fail("no site bullets: add content/release-<version>.md, or mark a block in the notes")
    print("warning: no curated bullets; falling back to release-note headings "
          "(add content/release-<version>.md to control the page)", file=sys.stderr)
    return items


def human_date(iso: str) -> str:
    # 2026-10-19T02:45:30Z -> 19 October 2026
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso)
    if not m:
        fail(f"unparseable release date: {iso}")
    y, mo, d = m.groups()
    months = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"]
    return f"{int(d)} {months[int(mo) - 1]} {y}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--app-repo", required=True)
    ap.add_argument("--ref", required=True, help="release tag, e.g. v0.8.1")
    ap.add_argument("--release-json", required=True)
    ap.add_argument("--site-dir", required=True, help="site repository root (template + assets)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    app = Path(args.app_repo)
    site = Path(args.site_dir)
    out = Path(args.out)

    version, code = version_from_gradle(read(app / "android/app/build.gradle"))
    release = json.loads(read(Path(args.release_json)))
    assets = release.get("assets") or []
    if not assets:
        fail("release JSON has no assets")
    asset = assets[0]
    name = asset.get("name", "")
    size = int(asset.get("size", 0))
    digest = (asset.get("digest") or "").removeprefix("sha256:")
    url = asset.get("url", "")
    if not name or size <= 0 or len(digest) != 64 or not url:
        fail("release asset is missing a name, size, sha256 digest or url")
    if version not in name:
        fail(f"asset {name} does not carry version {version}")

    notes_path = app / f"docs/RELEASE-{version}.md"
    notes = read(notes_path)
    bullets = shipped_bullets(notes, site / "content" / f"release-{version}.md")
    title = release.get("name") or f"Hermes Vox {version}"

    data = {
        "VERSION": version,
        "VERSION_CODE": str(code),
        "TAG": args.ref,
        "RELEASE_DATE": human_date(
            release.get("publishedAt") or release.get("published_at") or release.get("published") or ""
        ),
        "APK_NAME": name,
        "APK_SIZE_MB": f"{size / 1_000_000:.1f}",
        "APK_SHA256": digest,
        "APK_SHA256_SHORT": digest[:12],
        "DOWNLOAD_URL": url,
        "RELEASE_TITLE": title,
    }

    template = read(site / "template/index.html")
    for token in TOKENS:
        needle = "{{" + token + "}}"
        count = template.count(needle)
        if count < 1:
            fail(f"template is missing {needle}")
        template = template.replace(needle, data[token])

    if template.count(BULLETS) != 1:
        fail(f"template must contain {BULLETS} exactly once")
    rendered_bullets = "\n".join(f"          <li>{b}</li>" for b in bullets)
    template = template.replace(BULLETS, rendered_bullets)

    leftovers = re.findall(r"\{\{[A-Z0-9_]+\}\}", template)
    if leftovers:
        fail(f"unrendered placeholders: {sorted(set(leftovers))}")

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    # Static site assets travel with the template.
    for item in ("assets", "CNAME", ".nojekyll", "robots.txt", "sitemap.xml",
                 "404.html", "favicon.ico", "favicon-32.png", "apple-touch-icon.png",
                 "site.webmanifest", "LICENSE"):
        src = site / item
        if not src.exists():
            fail(f"site asset missing: {src}")
        if src.is_dir():
            shutil.copytree(src, out / item)
        else:
            shutil.copy2(src, out / item)

    # Screenshots are designed assets that live with the template (webp crops at the
    # page's aspect). They are not copied from the app tag: the raw captures are a
    # different size and composition. Refresh them by hand when the UI changes.
    for shot in ("call.webp", "speaking.webp", "settings.webp"):
        if not (out / "assets/img" / shot).is_file():
            fail(f"missing designed screenshot asset: assets/img/{shot}")

    (out / "index.html").write_text(template, encoding="utf-8")
    (out / "site-data.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"generated {out/'index.html'} for {version} ({code}) — {name}, "
          f"{data['APK_SIZE_MB']} MB, {len(bullets)} shipped bullets")


if __name__ == "__main__":
    main()
