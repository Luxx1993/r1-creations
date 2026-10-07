# Project context

This repo is a collection of Rabbit R1 creations. Read @docs/r1-creations.md before writing or changing a creation (240x282 screen, SDK channels, QR install JSON, constraints, device lessons in 11b).

## Repo layout

- `main`: hub page (generated), docs, `tools/`, `.github/workflows/pages.yml`. No creation code lives on main.
- `creation/<name>`: one branch per creation, files in the branch root (`index.html`, `icon.png`, `creation.json`, `qr.png`, versioned `index-v<ver>.html`).
- Pages is deployed by GitHub Actions: `tools/build_site.py` exports every `creation/*` branch to `/<name>/` and generates the hub page. Install URLs look like `https://luxx1993.github.io/r1-creations/<name>/index-v<ver>.html`.
- New creation: `git checkout -b creation/<name> main`, build it, run `tools/make_qr.py`, push. See README.md.
- Namespace `localStorage`/`creationStorage` keys per creation (shared origin).

## Todoist creation (branch `creation/todoist`)

- German (`/todoist/`) and English (`/todoist/en/`) are one app. `index.html` is the only source; every visible string goes into both `de` and `en` of the `I18N` table and is output via `tx()` or `data-t`/`data-tp`/`data-ta`. Never edit `en/index.html` or any `index-v*.html` by hand.
- After every change: `python3 release.py` (syncs `en/index.html`), then `node test/harness.mjs` (fails if the copies differ). New version: bump `APP_VERSION`, `python3 release.py --release`.
- Keep `README.md` (German) and `README.en.md` (English) in step for every user-facing change.
