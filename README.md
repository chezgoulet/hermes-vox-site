# hermesvox.org

The project site for [Hermes Vox](https://github.com/chezgoulet/hermes-vox), the
open-source Android voice client for [Hermes Agent](https://hermes-agent.nousresearch.com).

Plain static HTML/CSS/JS — no framework, no build step, no third-party requests.
The look is the app's own: true OLED black, the night palette from
`android/app/src/main/res/values-night/colors.xml`, and the app's Rajdhani type
(subset to Latin, self-hosted).

## Layout

| Path | What |
|---|---|
| `index.html` | The whole site: hero, why, screenshots, features, the being, roadmap, install, thanks, FAQ. SEO meta, Open Graph and JSON-LD live in its `<head>`. |
| `assets/css/site.css` | Styles and design tokens. |
| `assets/js/site.js` | The hero's canvas being (reduced-motion aware, pauses off-screen). |
| `assets/img/` | Screenshots (WebP), state and shape tiles, the Open Graph card, icons, the Obtainium badge. |
| `assets/fonts/` | Rajdhani 500/600/700, WOFF2, Latin subset (OFL). |
| `CNAME`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `404.html` | Hosting and SEO plumbing. |

## Preview

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy (GitHub Pages)

Settings → Pages → *Deploy from a branch* → `main` / `(root)`. `CNAME` sets the
custom domain; point `hermesvox.org` at GitHub Pages (apex `A`/`AAAA` records to
GitHub's Pages IPs, or an `ALIAS`), then enable *Enforce HTTPS*.

## Updating screenshots

The images are captured from the app on an emulator. The source captures and
the README images live in the app repo (`docs/screenshots/`). When the UI
changes, recapture there, then regenerate the WebP files here.

Hermes Vox is an independent community project, not affiliated with Nous Research.
