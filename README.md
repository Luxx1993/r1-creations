# Rabbit R1 Creations

A collection of small web apps ("creations") for the Rabbit R1 (240×282 px screen). Every creation
comes in English and German.

**Hub page with all install QR codes: https://luxx1993.github.io/r1-creations/**

## Layout

| Where | What |
| --- | --- |
| `main` | Hub page (generated), docs (`docs/r1-creations.md`), tools (`tools/`), deploy workflow |
| `creation/<name>` | One creation per branch, files in the branch root |
| `creation/<name>-en`, `creation/<name>-de` | The other language version of a creation |

Each branch is published under `/<name>/`, for example `/tally/` or `/tally-de/`. The language
versions are separate creations on the R1: each has its own install QR code and its own save.

## Creations

| Creation | English | German | What it does |
| --- | --- | --- | --- |
| Tally | `creation/tally` | `creation/tally-de` | Tally counter with auto-rotation |
| Marble Maze | `creation/marble-maze` | `creation/marble-maze-de` | Marble maze: 15 levels, tilt with the accelerometer, wheel = speed (10 steps) |
| Clawd | `creation/clawd-en` | `creation/clawd` | Clawd as a pet in a diorama: 7 scenes and 11 art styles from the Claude Fables plugin, hats, glasses and bows, games, sound, time of day, auto-rotation |
| Bubble Level | `creation/bubble-level-en` | `creation/bubble-level` | Inclinometer and spirit level with three modes: line, vials and 3D |
| Claude Start | `creation/clau.de-en` | `creation/clau.de` | Quick links to claude.ai, plus browser, feature and voice tests for the R1 WebView |
| Todoist | `creation/todoist` (`/todoist/en/`) | `creation/todoist` | Todoist tasks with sync: today, inbox, projects, search, voice input via PTT, offline queue, read aloud |

## Install

On the R1: creations card → "add via QR code" → scan the code. All codes are on the
[hub page](https://luxx1993.github.io/r1-creations/); they are also below. A click on a code opens
its branch.

To update a creation, delete the old card on the R1 first and scan the new code (the R1 caches the
install address).

### Tally

| English | German |
| --- | --- |
| [![Install QR for Tally (English)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/tally/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/tally) | [![Install QR for Tally (German)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/tally-de/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/tally-de) |

Wheel up = +1, wheel down = −1, side button = +1, long press = reset. The display rotates with the device.

### Marble Maze

| English | German |
| --- | --- |
| [![Install QR for Marble Maze (English)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/marble-maze/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/marble-maze) | [![Install QR for Marble Maze (German)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/marble-maze-de/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/marble-maze-de) |

Tilt = the marble rolls, wheel = speed (1–10), side button = calibrate the neutral position (double
click = flip the Y axis), long press = level menu.

### Clawd

| English | German |
| --- | --- |
| [![Install QR for Clawd (English)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/clawd-en/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/clawd-en) | [![Install QR for Clawd (German)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/clawd/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/clawd) |

Demo videos (30 s): [English](https://luxx1993.github.io/r1-creations/clawd-en/demo/clawd-demo-en.mp4) ·
[German](https://luxx1993.github.io/r1-creations/clawd/demo/clawd-demo.mp4)

Clawd is a pet without feeding and without levels, living in an endless world: he wanders through
the scene on his own, reacts to touch and dozes off when nobody is around.

- **Wheel:** walks Clawd left and right (wheel up = right). After a press of the side button it picks
  a menu item instead (Play, Sleep, Items, World, Options); a second press runs it. Play opens a
  choice of ball (Clawd juggles, with a sound on every bounce), skipping rope or whistling. Clawd
  also whistles and skips rope on his own.
- **Touch:** hold the side button or hold Clawd to pet him. Tap him and he reacts. Poke him four
  times quickly or shake the R1 and he gets dizzy. A tap on the scene sends him there.
- **World:** place (forest, moon, city, desert, volcano, lab, village) and style (original, pixel
  art, cave, blueprint, mosaic, Frutiger Aero, copperplate, tapestry, golden age, ukiyo-e, kamon) as
  a rolodex picker. **Items:** head, face and body (hats, glasses, moustache, bow, scarf), each drawn
  in the current style.
- **Sound** (all made with WebAudio, no audio files): Clawd "speaks" in blips, snores while he
  sleeps, whistles, the ball clacks, and each style has its own quiet background tune. On the R1 the
  card has to be touched once before sound may start.
- **Options:** sound pack (style, retro, bells, minimal), volume (off to 100 %), quiet hours (no sound
  at night) and motion (normal/calm). The time-of-day behaviour can be switched off under World → Time.
- **Time of day:** the scene is tinted by the real clock (dawn, dusk, night). Clawd greets you to
  match, is perkier in the morning, calmer and whistling more in the evening, slower at night and
  falls asleep sooner (sometimes you find him asleep), and the music gets quieter and slower at night.
- Scenes, styles and animations come from the Claude Fables plugin and are pre-rendered (`src/` in
  the branch holds the generator and instructions).

#### Try Clawd on the desktop

Clawd is a static page (HTML, JavaScript and images) and runs in any normal browser, without a
server and without the R1.

- Online: `https://luxx1993.github.io/r1-creations/clawd-en/index.html` (German: `/clawd/index.html`).
- Locally: `git clone -b creation/clawd-en --single-branch https://github.com/Luxx1993/r1-creations.git clawd`,
  then open `index.html` in the browser (the `assets/` folder has to sit next to it). Or run
  `python3 -m http.server` in the folder and open `http://localhost:8000/`.
- Controls: arrow keys = wheel (up/left and down/right are the two directions), Enter or Space = side
  button, `H` = pet, `O` = rotate the view in 90° steps, mouse = touch (click and swipe).
- On the desktop there are no sensors (no shaking, no auto-rotation), the view stays 240×282 px
  (browser zoom helps), the save lives in the browser's `localStorage`, and sound only starts after
  the first click or key press.
- Development: `index.html` is generated. The source is `src/index.src.html`; `python3 src/build.py`
  rebuilds `index.html` and the versioned file. The images are made from the Claude Fables plugin
  with the generator in `src/` (see `src/README.md`). When sharing, mind the licences: Clawd's 3D
  model by ChetasLua (MIT) and the Monocraft font (OFL).

### Bubble Level

| English | German |
| --- | --- |
| [![Install QR for Bubble Level (English)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/bubble-level-en/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/bubble-level-en) | [![Install QR for Bubble Level (German)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/bubble-level/wasserwaage/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/bubble-level) |

Side button = switch mode (line → vials → 3D), long press = calibrate, double click = reset the
calibration, wheel = unit (degrees, % slope, mm/m), tap the big number = HOLD, tap a vial = lock it.

### Claude Start

| English | German |
| --- | --- |
| [![Install QR for Claude Start (English)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/clau.de-en/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/clau.de-en) | [![Install QR for Claude Start (German)](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/clau.de/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/clau.de) |

A list of links into claude.ai (new chat, recent chats, projects, settings …) and test pages for the
R1 WebView (browser version, missing features, voice). Wheel = pick, side button = open, hold =
mark a link as working or broken. The list lives in `links.js`.

### Todoist

Syncs directly with your own Todoist account (looks like the Todoist Android app in dark mode).
After scanning, enter your API token in the setup (Todoist → Settings → Integrations → Developer); it
stays on your R1. Without a token there is a demo mode.

| English | German |
| --- | --- |
| [![Install QR for Todoist (English) – click for the guide](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/todoist/en/qr.png)](https://github.com/Luxx1993/r1-creations/blob/creation/todoist/README.en.md) | [![Install QR for Todoist (German) – click for the guide](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/todoist/qr.png)](https://github.com/Luxx1993/r1-creations/blob/creation/todoist/README.md) |
| `/todoist/en/` · [Guide](https://github.com/Luxx1993/r1-creations/blob/creation/todoist/README.en.md) | `/todoist/` · [Guide (German)](https://github.com/Luxx1993/r1-creations/blob/creation/todoist/README.md) |

Wheel = pick a task, side button = complete (5 s undo), hold PTT = dictate a task → review → send,
plus = type a task, speaker = read the list aloud, hold the screen for 1 s = setup. Both languages
come from the same source file (`index.html` in the branch; `release.py` keeps `en/` in sync).

## Add a new creation

```bash
git checkout -b creation/<name> main
# add index.html, icon.png (96x96) and creation.json
pip install pillow qrcode
python3 tools/make_qr.py --title "<Title>" --description "<Text>" \
  --url https://luxx1993.github.io/r1-creations/<name>/index.html
git add -A && git commit -m "Add <name>" && git push -u origin creation/<name>
```

`creation.json`: `{"title":"…","lang":"en","description":"…","version":"0.1.0","entry":"index.html"}`.
`lang` is `en` or `de` and shows as a badge on the hub page; versions with the same title are listed
next to each other. Write `description` in English (the hub page is English); optional `also` adds
extra links to a card, e.g. `[{"label":"English version","href":"en/index.html"}]`.

For the other language, copy the branch to `creation/<name>-de` (or `-en`), translate all texts,
use its own storage key, and make its own QR code with the new URL.

The workflow `.github/workflows/pages.yml` rebuilds the site (hub page plus one folder per creation)
on every push to `main`. A push to a `creation/**` branch starts that same build on `main`, because
the `github-pages` environment only lets `main` deploy.

## One-time setup

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Notes

- A new version of a creation = a new file `index-v<version>.html`: uninstall the old card on the
  R1 and scan the new QR code (the R1 caches the install URL).
- All creations share the origin `luxx1993.github.io`: prefix `localStorage` keys with the creation
  name (e.g. `tally_state`, `tally_de_state`).
- Details, the SDK and lessons from the real device: `docs/r1-creations.md`.
