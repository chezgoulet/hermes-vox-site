# hermesvox.org

The project site for [Hermes Vox](https://github.com/chezgoulet/hermes-vox), the
open-source Android voice client for [Hermes Agent](https://hermes-agent.nousresearch.com).

Plain static HTML/CSS/JS — no framework — but **not hand-written**. The page is
generated from the app repository **at a release tag**: the version, the release
date, the APK's name, size and SHA-256, and the "shipped" bullets all come from
that tag and that release's GitHub metadata. A value the generator cannot find is
a failed build, not a stale number on a live page.

The look is the app's own: true OLED black, the night palette from
`android/app/src/main/res/values-night/colors.xml`, and the app's Rajdhani type
(subset to Latin, self-hosted).

## How it is built

```sh
git clone --depth 1 --branch v0.8.1 https://github.com/chezgoulet/hermes-vox /tmp/app
gh api repos/chezgoulet/hermes-vox/releases/tags/v0.8.1 > /tmp/release.json
python3 build/generate.py \
  --app-repo /tmp/app --ref v0.8.1 --release-json /tmp/release.json \
  --site-dir . --out /tmp/dist
python3 build/linkcheck.py /tmp/dist
python3 -m http.server 8000 --directory /tmp/dist
```

The generator refuses to run if a required token is missing from the template, if
the release note for that version does not exist, if the APK asset does not carry
the version, or if the asset has no sha256 digest. `linkcheck.py` fails on any
local asset or anchor the page references but does not ship.

## Layout

| Path | What |
|---|---|
| `template/index.html` | The page's source of truth, with `{{TOKENS}}` where release data goes. |
| `build/generate.py` | Reads the app tag + release JSON, renders the template, copies assets, writes `site-data.json` for audit. |
| `build/linkcheck.py` | Verifies every local href/src and same-page anchor resolves. |
| `content/release-<version>.md` | The bullets the page shows for that release — prose, curated. Falls back to a `<!-- site:begin -->` block in the release note, then to its section headings. |
| `index.html`, `site-data.json` | Generated output, committed so Pages can serve it from the branch. Do not edit by hand. |
| `assets/css/site.css` | Styles and design tokens. |
| `assets/js/site.js` | The hero's canvas being (reduced-motion aware, pauses off-screen). |
| `assets/img/` | Screenshots (WebP crops), shape tiles, Open Graph card, icons, Obtainium badge. |
| `assets/fonts/` | Rajdhani 500/600/700, WOFF2, Latin subset (OFL). |
| `CNAME`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `404.html` | Hosting and SEO plumbing. |

## Deploy

GitHub Pages serves `main` at `/` (Settings → Pages → *Deploy from a branch*).
`.github/workflows/site.yml` regenerates the page and commits it when:

- the app repo sends a `hermes-vox-release` `repository_dispatch`,
- someone runs the workflow manually (optionally with a tag),
- or the daily schedule finds a newer release than the committed page.

To ask for a rebuild from the app repo after a release:

```sh
gh api repos/chezgoulet/hermes-vox-site/dispatches \
  -f event_type=hermes-vox-release -F client_payload[tag]=v0.9.0
```

That needs a token with access to this repository; the app repo's
`scripts/notify-site.sh` wraps it.

## Updating screenshots

The screenshots in `assets/img/` are designed WebP crops at the page's aspect, not
the raw captures. They are refreshed by hand: capture in the app repo
(`docs/screenshots/`), then re-crop here. The page does not claim they came from
the current build.

## Copy rules

- No number appears in the template unless the generator supplies it.
- The "shipped" bullets are editorial: write `content/release-<version>.md` when
  cutting a release. A release note is written for engineers; its headings are a
  poor summary for visitors.
- External links are not fetched by the build; a dead external link is not a
  build failure.
- The page must not claim a status the app does not have. Distribution is
  GitHub + Obtainium, with F-Droid in preparation; Google Play is not a rail.

Hermes Vox is an independent community project, not affiliated with Nous Research.
