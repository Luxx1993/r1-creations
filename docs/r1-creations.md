# Rabbit R1 Creations — Reference for Claude Code

> Compiled 2026-10-01 from official rabbit sources and community creations.
> Use this file as project context (e.g. save as `CLAUDE.md` or `docs/r1-creations.md`) when building creations for the Rabbit R1.
> Sections are labelled **[official]**, **[community]** or **[unverified]**. Prefer official facts; treat community facts as field notes that may change with firmware updates.

---

## 1. What a creation is

**[official]** A creation is a small web mini-app (plain HTML/CSS/JS) that runs in the R1's WebView as its own card. It can use the push-to-talk (PTT) side button, scroll wheel, microphone, camera, speaker and accelerometer.

- No build step is required. Community creations are plain HTML with zero dependencies.
- Creations are hosted anywhere static (Netlify and GitHub Pages are the commonly used options) and installed on the device by scanning a QR code.
- Only one creation runs at a time.
- Creating a new creation by voice on the device uses "task credits" (every new account gets 3 free tasks). Installing and using existing creations costs nothing.

## 2. Hard constraints

**[official]** (rabbit support article "how to use r1 creations" and SDK docs)

| Constraint | Detail |
| --- | --- |
| Screen | Exactly **240 x 282 px**, portrait. Everything must fit without page scrolling. |
| Performance | Very limited CPU. Avoid heavy graphics and complex animations. |
| Optimisation tips | Use `transform` and `opacity` (hardware accelerated), minimise DOM operations, limit particle effects, prefer CSS transitions over JS animation. |
| Storage | Limited space; no large files or big datasets. |
| Multitasking | One creation at a time. |
| Backends / STT | Rabbit's support page states creations "cannot currently access speech-to-text (STT) or make anything with a hosted backend". See section 9 — community projects do talk to their own backends, so treat this as a documented limitation that may be outdated. Verify on a real device. |

**[community]** (ShayneP/rabbit-r1-livekit-skill, andr3w-hilton/rabbit-r1-creations-public)

- The WebView is Flutter-based. **No WebGL**, only Canvas 2D.
- **HTTPS is required for microphone access** (`getUserMedia` is undefined over HTTP).
- Touch quirks: attach `touchstart` handlers to `document.body` and call `e.preventDefault()`. Inline `onclick` attributes in dynamically inserted HTML did not fire.
- Minimum touch target of about 44 x 44 px is recommended by the official demo app.

## 3. Official SDK — JavaScript channels

**[official]** Source: `rabbit-hmi-oss/creations-sdk` -> `plugin-demo/reference/creation-triggers.md`. The repo README states more docs are coming; the repo was last updated Sep 2025, so check for newer behaviour.

The SDK is a set of globals injected into the WebView. There is nothing to install or import.

### 3.1 PluginMessageHandler — talk to the R1's LLM / server

The `pluginId` is injected by the system automatically (you cannot set or spoof it).

```javascript
// Plain structured message to the server
PluginMessageHandler.postMessage(JSON.stringify({
  message: "Hello from my r1 creation"
}));

// Ask the LLM that powers the r1 for an answer (arrives via window.onPluginMessage)
PluginMessageHandler.postMessage(JSON.stringify({
  message: 'Tell me 5 facts about cats. Respond ONLY with valid JSON: {"facts":["..."]}',
  useLLM: true
}));

// Have the LLM speak the answer through the r1 speaker
PluginMessageHandler.postMessage(JSON.stringify({
  message: "Hello, this is a test message",
  useLLM: true,
  wantsR1Response: true      // default false
}));

// Also write the exchange to the journal
PluginMessageHandler.postMessage(JSON.stringify({
  message: "...",
  useLLM: true,
  wantsR1Response: true,
  wantsJournalEntry: true    // default false
}));
```

Flags (only meaningful when `useLLM: true`):

- `wantsR1Response` — speak the response through the device speaker. Default `false`.
- `wantsJournalEntry` — log the request to the user's journal. Default `false`.

Important: this channel talks to **the R1's own LLM**, not to a model you choose. Which model sits behind it (and whether OS3 BYOK changes that) is **[unverified]**. To use Claude directly, call your own backend (section 9).

### 3.2 Receiving responses

```javascript
window.onPluginMessage = function (data) {
  // data = { message: string, pluginId: string, data?: string (JSON string) }
  // Responses can arrive in data.data (JSON string) or data.message (plain text) — check both.
  if (data.data) {
    try {
      const parsed = JSON.parse(data.data);
      // handle structured data
    } catch (e) {
      // data.data was plain text
    }
  }
  if (data.message) { /* handle text */ }
};
```

The official demo's `data.js` is defensive about the response shape: `data.data` may be a JSON **string or already an object** (`typeof data.data === 'string' ? JSON.parse(data.data) : data.data`), and `data.message` may itself contain JSON, so it tries `JSON.parse` on both and falls back to plain text. Do the same.

When you need structured data from the LLM, say so explicitly in the prompt ("Return ONLY valid JSON in this exact format ...") and use double quotes. The official demo does this for its cat-facts and paint-color examples.

### 3.3 closeWebView

```javascript
closeWebView.postMessage("");   // close the creation, return to home
```

### 3.4 TouchEventHandler — simulate touches

```javascript
TouchEventHandler.postMessage(JSON.stringify({ type: "tap", x: 100, y: 200 }));
// other types: "down", "up", "move", "cancel"
```

### 3.5 Storage — `window.creationStorage`

```javascript
// Plain storage (unencrypted). ALL values must be Base64 strings.
await window.creationStorage.plain.setItem('user_prefs', btoa(JSON.stringify({ theme: 'dark' })));
const prefs = JSON.parse(atob(await window.creationStorage.plain.getItem('user_prefs')));
await window.creationStorage.plain.removeItem('user_prefs');
await window.creationStorage.plain.clear();

// Secure storage (hardware-encrypted, requires Android M+). Same API.
await window.creationStorage.secure.setItem('key', btoa('value'));
```

- Isolated per plugin ID. Returns `null` for missing items.
- `btoa` fails on non-Latin1 characters (e.g. German umlauts or emoji). Encode first: `btoa(unescape(encodeURIComponent(str)))` and decode with `decodeURIComponent(escape(atob(b64)))`.
- Never store a long-lived API key in a creation, even in secure storage (see section 9).

### 3.6 Accelerometer — `window.creationSensors`

```javascript
const ok = await window.creationSensors.accelerometer.isAvailable();

window.creationSensors.accelerometer.start((d) => {
  // Two documented shapes — handle both:
  //  (a) reference doc (creation-triggers.md):  d = { x, y, z }  normalised to -1..1
  //  (b) official demo source (plugin-demo/js/hardware.js):
  //      d.tiltX, d.tiltY, d.tiltZ   -> tilt, normalised -1..1
  //      d.rawX,  d.rawY,  d.rawZ    -> raw values in m/s^2
  const tx = d.tiltX ?? d.x ?? 0;
  const ty = d.tiltY ?? d.y ?? 0;
  const tz = d.tiltZ ?? d.z ?? 0;
  // x: + tilt right / - tilt left
  // y: + tilt forward / - tilt back
  // z: + facing up / - facing down
}, { frequency: 60 });          // optional Hz; the demo offers 10, 30, 60 (default) and 100

window.creationSensors.accelerometer.stop();
```

**Why both shapes:** the reference doc says the callback receives `{ x, y, z }`, but the official demo app actually reads `tiltX/tiltY/tiltZ` and `rawX/rawY/rawZ`. The reference text itself says creations can read "the accelerometer raw values and a simplified version that measures tilt", which matches the demo. Log `d` on the device once (`console.log(JSON.stringify(d))`) to see which fields your firmware sends, and keep the fallback chain above. The demo also guards every call: check `typeof window.creationSensors !== 'undefined'`, then `window.creationSensors.accelerometer`, then `await isAvailable()` before `start()`, and wraps `start()`/`stop()` in try/catch.

### 3.7 Hardware buttons — window events

| Event | Trigger |
| --- | --- |
| `sideClick` | PTT single press (fires on release) |
| `longPressStart` | PTT held past the long-press threshold |
| `longPressEnd` | PTT released after a long press |
| `scrollUp` | Scroll wheel up, one event per detent |
| `scrollDown` | Scroll wheel down, one event per detent |

```javascript
window.addEventListener('sideClick', onClick);
window.addEventListener('longPressStart', onHold);
window.addEventListener('longPressEnd', onRelease);
window.addEventListener('scrollUp', onUp);
window.addEventListener('scrollDown', onDown);
```

A double click on PTT arrives as **two `sideClick` events about 50 ms apart**, not as a separate double-click event. Implement double-click detection yourself.

### 3.8 Other bridges seen in the wild

**[community]** The livekit skill lists `FlutterButtonHandler.postMessage()` (button events) alongside the channels above. It is not part of the official reference; do not rely on it without testing.

### 3.9 Camera, microphone, speaker

**[official]** The SDK doc says creations can use "standard mobile web technologies" for microphone, camera and speaker. **[community]** In practice, mic needs HTTPS and usually a user tap first (the livekit example requires a screen tap before mic access).

## 4. Installing a creation (QR code)

**[official]** Rabbit's flow: host the page, then use the QR generator from the SDK repo (`creations-sdk/qr`, a small self-hostable site) to fill in name and description and produce a scannable code. On the device: creations card -> "add via QR code" (create tab) -> scan. Public creations can also be installed from the "public" tab or from rabbit.tech/creations. Installed creations appear at the bottom of the card stack.

**[official, verified from source]** Rabbit's QR tool (`creations-sdk/qr`, entry `qr/index.html` redirects to `qr/final/index_fixed.html`; logic in `qr/final/js/app.js`) builds the install QR from exactly five form fields and encodes `JSON.stringify` of them:

```json
{"title":"My Creation","url":"https://<you>.github.io/<repo>/","description":"Short text","iconUrl":"https://<you>.github.io/<repo>/icon.png","themeColor":"#FE5000"}
```

- The QR must contain this **JSON object, not a bare URL** (community testing: a plain URL QR was rejected as "invalid").
- The tool's default `themeColor` is `#FE5000` (rabbit orange).
- It renders with the `qr-code-styling` library at **error correction level "L"** (lowest, to fit more data), 300 x 300 px, black on white. Keep the JSON short so the code stays scannable on the R1 camera; use short URLs and a small `iconUrl`.
- **[verified on device]** Size limit in practice: a 275-character payload (QR version 11 at level L) was **not recognised** by the R1; the same creation with a 254-character payload (version 10) installed at once. Working codes in this repo are 215–254 characters (versions 9–10). Aim for at most ~260 characters and show the code on install pages at an integer pixel scale (no blurry downscaling).
- The tool supports a **share link with prefilled fields**: `.../qr/final/index_fixed.html?jsondata=<url-safe-base64-of-the-JSON>` (base64 with `+` -> `-`, `/` -> `_`, `=` stripped). Handy for generating install links programmatically.
- Claude Code can also generate the QR itself: encode the same JSON string with any QR library (for example the Python `qrcode` package) at low error correction, with a white quiet zone.

**[verified from a real install QR]** A QR generated by rabbit's own intern agent for the community creation "Silksong Map" decodes to exactly this JSON shape (decoded 2026-10-01):

```json
{
  "title": "Silksong Map",
  "url": "https://<generated-name>.intern.rabbitos.app/apps/app/dist/index.html",
  "description": "Interactive map for Hollow Knight: Silksong game (German)",
  "iconUrl": "https://<generated-name>.intern.rabbitos.app/apps/app/dist/icon.png",
  "themeColor": "#A6D9E3"
}
```

So the five fields are `title`, `url`, `description`, `iconUrl` (a PNG hosted next to the app) and `themeColor` (hex). Intern-built creations are hosted by rabbit under `*.intern.rabbitos.app/apps/app/dist/`. When decoding such a QR image yourself, add a white border (quiet zone) first; the image decoded only after padding.

**[community]** Updating an installed creation is unreliable if you only change the file:

- CDNs such as GitHub Pages (Fastly) may ignore query strings, so `?v=2` cache-busting does not reliably work.
- Reliable approach: publish a copy under a new **filename** (`index-v1.4.2.html`), point the QR at that filename, **uninstall the old card on the R1 first**, then scan the new QR. Skipping the uninstall step left a stale card in testing.
- Another community repo notes the R1 caches the install URL and suggests bumping a `?v=` parameter in its `install.html`. Treat both as workarounds and test.

## 5. UI and interaction conventions

**[community]** Patterns from andr3w-hilton's creations (shopping list, todo, rep tracker, rep timer, spirit level, dice roller, notes, calendar, R1 Buddy) and the Claude usage monitor:

- Scroll wheel = move selection / change value. Side click = primary action, open or cycle. Hold (long press) = voice input or secondary action.
- Shake (via accelerometer) works as an input, e.g. dice roller.
- Dark theme, high contrast, large type; colour-code status (e.g. green < 50 %, yellow 50–80 %, red 80 %+).
- Persist state through `creationStorage` with a `localStorage` fallback so the page also runs in a desktop browser.
- Add a desktop preview shim: map arrow keys and Space/Enter to `scrollUp`, `scrollDown`, `sideClick` by dispatching `window.dispatchEvent(new Event('scrollUp'))`, and force a 240x282 container. This lets Claude Code test in a browser before scanning on the device.
- Show an on-screen version tag and keep an `APP_VERSION` constant; it makes stale-cache problems obvious.

## 6. Minimal starter template

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=240, initial-scale=1, user-scalable=no">
<title>My Creation</title>
<style>
  html, body { margin: 0; width: 240px; height: 282px; overflow: hidden;
               background: #000; color: #fff; font: 14px system-ui, sans-serif; }
  #app { box-sizing: border-box; width: 240px; height: 282px; padding: 8px; }
  #status { opacity: .7; font-size: 12px; }
</style>
</head>
<body>
<div id="app">
  <div id="out">Ready</div>
  <div id="status"></div>
</div>
<script>
const APP_VERSION = '0.1.0';
const $ = (id) => document.getElementById(id);
const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s))));

// Storage with desktop fallback
const store = {
  async get(k, fallback = null) {
    try {
      const raw = window.creationStorage
        ? await window.creationStorage.plain.getItem(k)
        : localStorage.getItem(k);
      return raw ? dec(raw) : fallback;
    } catch (e) { return fallback; }
  },
  async set(k, v) {
    try {
      if (window.creationStorage) await window.creationStorage.plain.setItem(k, enc(v));
      else localStorage.setItem(k, enc(v));
    } catch (e) {}
  }
};

// Hardware events
window.addEventListener('scrollUp',   () => { $('out').textContent = 'up'; });
window.addEventListener('scrollDown', () => { $('out').textContent = 'down'; });
window.addEventListener('sideClick',  () => { $('out').textContent = 'click'; });

// Messages from the R1 (LLM answers etc.)
window.onPluginMessage = (d) => {
  let payload = null;
  try { payload = d.data ? JSON.parse(d.data) : null; } catch (e) {}
  $('out').textContent = payload ? JSON.stringify(payload) : (d.message || '');
};

// Desktop preview shim (no-op on the device)
if (!window.PluginMessageHandler) {
  window.addEventListener('keydown', (e) => {
    const map = { ArrowUp: 'scrollUp', ArrowDown: 'scrollDown', Enter: 'sideClick' };
    if (map[e.key]) window.dispatchEvent(new Event(map[e.key]));
  });
}

$('status').textContent = 'v' + APP_VERSION;
</script>
</body>
</html>
```

## 7. Existing creations and reference projects

**[official]**

- `rabbit-hmi-oss/creations-sdk` — `plugin-demo` (hardware page, data/LLM page, speak/TTS page; single-page app with a hamburger menu) and `qr` (self-hostable QR generator). MIT licence.
- rabbit.tech/creations — gallery of installable creations.

**[community]**

| Project | What it shows |
| --- | --- |
| `andr3w-hilton/rabbit-r1-creations-public` (also forked as `Waseemilyas/...`) | Nine hosted apps (shopping list, todo, rep tracker, rep timer, spirit level, dice roller, notes with QR export, calendar, R1 Buddy). Contains `R1_CREATION_TIPS.md` / a Tips & Tricks page with voice input, keyboard handling, shake detection, storage and LLM notes. **Not retrieved for this file — the page loads its content dynamically. Have Claude Code read it from the repo.** Also contains a "gemma-chat" example that needs a self-hosted proxy to an LLM. |
| `dbclunie/claude-usage-r1` | Shows Claude.ai 5-hour and weekly usage. Architecture: Chrome extension reads usage inside a logged-in claude.ai tab -> small Express relay -> R1 polls the relay about every 5 minutes. Documents the QR JSON payload and the versioned-filename update trick. Uses unofficial claude.ai endpoints that can break. |
| `ShayneP/rabbit-r1-livekit-skill` | A Claude-Code-compatible skill that scaffolds a real-time voice agent (STT -> LLM -> TTS over LiveKit, model configurable, including Claude) with an R1 frontend and install page. Install: `npx skills add ShayneP/rabbit-r1-livekit-skill`. |
| `AnxAnd/apogee-r1-anti` | Task-orchestration creation. Uses a Base64 `creationStorage` adapter with `localStorage` fallback, `creationStorage.secure` for private data, wheel and PTT controls, and a `PluginMessageHandler` bridge for LLM-generated tasks. |
| `r1-create` (npm) | **Unofficial** community JS/TS wrapper around the channels above (storage with automatic Base64, LLM helpers, UI utilities). Not maintained by rabbit; audit before use. |
| `random-knights/r1-01` ("Rand0m Orac1es") | Open-source crystal-ball oracle creation: vanilla JS/HTML5/CSS with ES modules, no build step, uses shake (accelerometer), scroll wheel and side button. Deploys to GitHub Pages through a GitHub Actions workflow on every push; loaded on the R1 as a custom ("bring your own host") creation. Good template for CI-based hosting. |
| `RemyFevry/r1apps` | Monorepo of creations (e.g. "quickreader") built with Vite + TypeScript, one site per app plus an `install.html` QR companion, a shared kit package (R1 input events, storage seam, QR helper, theme), and CI that gates deploys to GitHub Pages. The gate builds for an Android-13-era WebView (Chrome 103 target) and runs a device simulation (Chromium at 240x282 with mocked `creationStorage`/`closeWebView` and R1 hardware events). Strong reference for testing and CI. |
| `JoeFTS/geometry-r1` | Geometry-Dash-style runner with chiptune music on a Canvas 2D renderer. Separates pure engine code from rendering, uses `creationStorage.plain` with a `localStorage` fallback, and tests with Chromium emulation at 240x282 including 4x CPU throttle. Reference for games and for performance testing. |
| `IrishJiminy/Rabbit-R1-Chess` | Chess; documents moving save/resume to `creationStorage.plain` (Base64) as the primary save with `localStorage` as desktop fallback; saves on hide/close. |
| `mattfinlayson/shakedown` | "Today in Grateful Dead history": calls an external public API (Relisten) from the creation, plays audio inline, supports side click and wheel; plain static files, GitHub Pages deploy via Actions, a `qr.html` that encodes the install metadata. Evidence that external HTTPS API calls and audio playback work from a creation. |
| `rabbit-hmi-oss/community-wiki` | Rabbit's own community wiki repo (CC-BY-4.0, last update May 2025); focused on device and community topics, not read for this file. |
| AlanK — **Maps app for R1** (forum thread, 2026-03-01) | Search places and categories (e.g. cafes), save favourites, add ratings and personal notes. Per the author it is global even though the app name says "UK"; rabbit does not let creators rename an installed app. Forum post has only a description and screenshot — **no source code was available**. https://forum.rabbitcommunity.tech/t/maps-app-for-r1/15730 |
| AlanK — **YouTube Player for Rabbit R1** (forum thread, 2026-02) | Second creation by the same author; listed in the forum's creations category. Only the thread title was seen; contents not retrieved. |
| "Notes App for the R1" (forum thread, June 2026) | Another community creation thread; author and contents not retrieved. https://forum.rabbitcommunity.tech/t/notes-app-for-the-r1/15810 |

**Creations built by rabbit's own intern agent** **[community: blog post by Rob Miles, 2025-09]**: after generation you get a QR code, a link to the hosted app, and a download link to the full code. The generated logic ends up bundled in a single long JavaScript line under `apps/app/dist/assets`. Practical consequence for Claude Code: you can fetch a hosted creation's URL and read or de-minify its bundle to learn how it uses the SDK, and `random-knights/r1-01` has the same `apps/app/dist/` layout.

### Worked example: "Silksong Map" (intern-built, analysed from its hosted files)

A Hollow Knight: Silksong interactive map (German), found via its install QR. It is a good minimal pattern for "big image on a tiny screen". Engadget's review of rabbitOS 2 also mentions an interactive Pharloom map creation, but it is not confirmed to be the same one.

Files (Vite build, about 4.5 KB of JS, 2.6 KB CSS, one 2496 x 1792 px PNG of about 1.7 MB):

```
index.html                       viewport: width=240, height=320, user-scalable=no
assets/main-<hash>.js            all logic (zoom, pan, storage, hardware events)
assets/main-<hash>.css           vw-based sizing, orange accent #FE5F00 on black
assets/optimized-silksong-map-<hash>.png
icon.png
```

Controls:

| Input | Action |
| --- | --- |
| `scrollUp` / `scrollDown` | Zoom in / out around the screen centre (step 0.15, range 0.3x to 4x) |
| Touch drag | Pan (`touchstart`/`touchmove`/`touchend` with `preventDefault()`, plus mouse events for desktop) |
| `sideClick` | Reset view to fit |
| `longPressStart` / `longPressEnd` | Registered but only logged |

Patterns worth copying:

- **Detect the R1 with** `typeof PluginMessageHandler !== "undefined"`; if absent, install a desktop shim that maps Space -> `sideClick`, ArrowUp -> `scrollUp`, ArrowDown -> `scrollDown` by dispatching `new CustomEvent(...)` on `window`.
- **Persist view state** (`{zoom, x, y}`) in `creationStorage.plain` as `btoa(JSON.stringify(state))`, with a plain `localStorage` fallback. State is saved after every transform.
- **Zoom about the centre:** with container size (W, H) and old/new scale ratio `k`: `x = W/2 - (W/2 - x) * k`, same for y.
- **Clamp panning** so the image can only overshoot the edges by 50 px; centre the image when it is smaller than the container.
- **Performance hints used:** only `transform: translate() scale()` is animated (0.1 s ease-out), `will-change: transform`, `pointer-events: none` on the image, `image-rendering` hints, no text selection or tap highlight.
- **Sizing in `vw` units** instead of fixed pixels, so the layout follows the 240 px width.
- A small zoom indicator (top right) and a one-line controls hint at the bottom; the hint is worth keeping because the R1 has no other UI to explain the wheel and side button.
- Weak points to improve: it does not use `longPressStart/End`, it saves storage on every pointer move (throttle it), the 1.7 MB image is heavy for the device's limited memory (consider tiled or smaller images), and the viewport meta declares height 320 although the screen is 282 px tall.

The community forum (https://forum.rabbitcommunity.tech, category "creations, LAM and more") is the best place to find further examples. The rabbit.tech/creations gallery loads its entries dynamically, so individual gallery creations could not be listed here.

## 8. Related, but not creations

- **rabbit OS3 (GA)** — rabbit's agent platform with BYOK (Anthropic, OpenAI, Gemini, OpenRouter, Ollama, own endpoint). The R1 is an optional way to reach it; R1 settings now live in OS3 under settings -> r1. Creations are a separate mechanism.
- **Claude Code on R1** — via the rabbit agent on a computer (rabbithole -> rabbit agents). Controls Claude Code sessions by voice; it does not run on the device.
- **Developer mode / bootloader unlock** — voids the warranty, enables custom firmware. Not needed for creations.

## 9. Using Claude from a creation

The built-in `PluginMessageHandler` goes to the R1's own LLM. To use Claude you need your own HTTPS backend.

**Rules**

1. **Never ship an Anthropic API key in the creation's HTML/JS.** Anything in the page is readable. Keep the key on a server and have the creation call that server.
2. Use a small proxy with its own shared secret (or per-device token) and rate limits. The Claude usage monitor repo uses exactly this shape (relay + shared secret).
3. Serve over **HTTPS** and enable CORS for the creation's origin.
4. Do **not** try to automate claude.ai itself from the server. The usage-monitor project found claude.ai sits behind Cloudflare bot protection; use the Anthropic API instead.
5. Keep responses short (the screen is 240 x 282). Ask the model for terse output or JSON and render it yourself.

**Proxy skeleton (Node, Express)** — verify package and model names against current Anthropic docs before use:

```javascript
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors({ origin: process.env.CREATION_ORIGIN }));
app.use(express.json({ limit: '16kb' }));

const client = new Anthropic();               // reads ANTHROPIC_API_KEY from the environment
const MODEL = process.env.CLAUDE_MODEL;       // set explicitly, e.g. a current Sonnet model

app.post('/chat', async (req, res) => {
  if (req.get('x-shared-secret') !== process.env.SHARED_SECRET) return res.sendStatus(401);
  const { text } = req.body ?? {};
  if (typeof text !== 'string' || !text) return res.sendStatus(400);
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: 'You answer on a tiny 240x282 screen. Be extremely concise.',
    messages: [{ role: 'user', content: text }]
  });
  res.json({ reply: msg.content.filter(b => b.type === 'text').map(b => b.text).join('') });
});

app.listen(process.env.PORT || 8080);
```

Creation side:

```javascript
async function askClaude(text) {
  const r = await fetch('https://YOUR-PROXY.example.com/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-shared-secret': '...' },
    body: JSON.stringify({ text })
  });
  return (await r.json()).reply;
}
```

Note: a shared secret inside the page is readable too. It is acceptable for a private personal tool with rate limits; rotate it if it leaks. For real separation use per-device tokens issued out of band.

Voice: for speech input the community uses either the PTT long-press flow (see tips repo) or a WebRTC pipeline such as the LiveKit example. The official support page says STT is not available to creations, so confirm on the device before designing around it.

## 10. Workflow for Claude Code

1. Build `index.html` as a single file (inline CSS/JS) at exactly 240 x 282 px, using the template above.
2. Test in a desktop browser with the preview shim (arrow keys = wheel, Enter = side click).
3. Host on GitHub Pages or Netlify (HTTPS).
4. Generate the install QR from the JSON payload (section 4) or with rabbit's `creations-sdk/qr` tool.
5. On the R1: creations card -> add via QR code -> scan.
6. For updates: copy to a new versioned filename, uninstall the old card, scan the new QR.

## 11. Checklist before calling it done

- [ ] Fits 240 x 282 px, no scrollbars, no layout overflow
- [ ] No WebGL; animations use `transform`/`opacity`
- [ ] Wheel, side click and long press all do something sensible (and double click is handled manually)
- [ ] State survives restart (`creationStorage`, Base64, UTF-8 safe)
- [ ] Works when `window.creationStorage`, `PluginMessageHandler` and `creationSensors` are missing (desktop preview)
- [ ] No API keys or secrets in the page; backend over HTTPS
- [ ] Version tag visible; versioned filename used for installs

## 11b. Lessons from the Tally creation (verified on a real R1)

**[verified on device]** These come from building and testing the Tally counter (`index.html`) on a real R1.

- **SDK objects arrive late.** `window.creationStorage` and `window.creationSensors` may not exist yet when the script first runs. Poll for them (e.g. every 100 ms for up to ~3 s) before choosing a fallback. A one-time check at startup silently used `localStorage` and the count was lost on close.
- **Storage works as documented.** `creationStorage.plain` with Base64 (UTF-8 safe) persists across closing the card. Write on every change (debounced ~300 ms), flush on `pagehide`/`visibilitychange`, and mirror to `localStorage` as a desktop/backup copy. Load from `creationStorage` first.
- **Storage is per installed URL.** A new URL (e.g. `index-v0.2.4.html`) is a new plugin with its own empty `creationStorage`. `localStorage` is shared per origin, so a mirrored copy can carry old state across versions.
- **Hardware events behave as documented:** `scrollUp`/`scrollDown`, `sideClick`, `longPressStart` and `touchstart` (on `document.body`, with `preventDefault`) all worked.
- **Accelerometer:** `creationSensors.accelerometer.start(cb)` delivers `{tiltX, tiltY, tiltZ}` normalised about -1..1 (the demo shape). Turning the device clockwise (top towards the right) gives x = +1, the opposite of the Android convention. Do not hardcode signs: calibrate on the first stable reading (treat it as upright) and compute the angle relative to it. Fallback if no data arrives: `devicemotion` with `accelerationIncludingGravity`.
- **Auto-rotation is done in the page.** The R1 screen stays 240x282 portrait and the OS bar (back, clock, battery) never rotates. Rotate your own container with CSS `transform: rotate()` and swap its width/height for 90/270. Use hysteresis (about 60 degrees) and a ~400 ms stability delay. Keep an unwrapped, accumulated angle and take the shortest signed step; wrapping to 0..359 makes the animation spin the long way round.
- **The OS draws a top bar** ("back", clock, battery) over the top of the page area. Keep important content clear of the top ~40 px.
- **A creation is a WebView, not a browser.** If the install URL returns a 404, the R1 simply renders the host's 404/docs page (GitHub Pages showed its docs). No address bar, tabs or free URL entry exist. An OS keyboard appears for text inputs.
- **Updating:** the R1 caches the install URL. Publish a new versioned file, uninstall the old card, scan the new QR. Pages must serve the branch containing that file, or the QR gives a 404.
- **Hosting layout:** this repo serves every `creation/<name>` branch under `/<name>/` via a GitHub Actions Pages deploy (see README.md). All creations share one origin, so namespace storage keys.
- **On-screen debug tag** (version plus storage/sensor status) was the fastest way to debug on the device; photograph the screen. Remove it for release.

## 11c. Notes from the Clawd creation (built in a desktop browser, **not yet verified on a real R1**)

- **Rolodex picker and rotation are plain canvas code.** Everything is drawn into one `<canvas>`; the Tally auto-rotation (CSS-rotated element, swapped size, hysteresis) works the same: the canvas becomes 282x240 sideways, touch points must be mapped back through the rotation, and the OS bar (always on the device's top edge) eats 40 px of whichever canvas edge that is.
- **Wheel plus side button as a two-level control.** The wheel does one job (steer the pet); a side click switches it to menu selection and a second click runs the item. Sliding `[ ]` brackets mark what the wheel is on.
- **Pre-rendered assets instead of live SVG.** Heavy art (scenery, character sprites) is baked once with Chromium into WebP images (scenery 800x320, sprite sheet per style). The device only does `drawImage`. Keep one scenery and one sheet in memory and load the next on demand. Sheets must be rendered with the style's SVG `<defs>` (gradients), otherwise shapes come out unfilled.
- **Accessories ride on baked anchors.** For every animation frame the generator also exports where head top, eyes and body are; hats and glasses are drawn at those points, mirrored with the sprite.
- **Keep the scenery exactly screen-high.** Cropping a strip leaves a gap at the bottom; scale the crop to fill the height instead of stretching its last row.
- **Fonts:** only generic families are safe on the device. Embedded WOFF2 (Monocraft, base64) works in canvas after `document.fonts.load`; style-specific fonts fall back to `serif`/`sans-serif`.
- **Sound without files (WebAudio, not yet verified on a real R1):** oscillators and noise bursts are enough for voice blips, snoring, a whistle, ball hits and a looping melody per style. An `AudioContext` starts suspended: create/resume it in a user gesture (touch, button event) and suspend it on `visibilitychange`.
- **Pixel art on canvas:** draw at low resolution, threshold the alpha channel to remove half-transparent edges, then scale up with smoothing off, otherwise it looks blurry.

## 11d. Lessons from the Wasserwaage creation (verified on a real R1)

**[verified on device]** From the bubble level (`creation/bubble-level`, files in the subfolder `wasserwaage/`).

- **Accelerometer axes are gravity in screen coordinates.** With `tiltX`/`tiltY`/`tiltZ` used unchanged, x points to the right and y to the bottom edge: holding the R1 upright gives `tiltY` ≈ +1; lowering the right side makes `tiltX` positive; lying flat, raising the right edge makes `tiltX` negative. So `atan2(tiltX, tiltY)` is the clockwise rotation of the device and a bubble moves by `-(X, Y)`. Matches the Tally finding (clockwise = x positive); no sign flips were needed.
- **The sensor is noisy at rest.** With a one-pole low pass (factor 0.2 at 60 Hz) a device lying still on a table showed readings jumping between 0.1° and 0.5°, and a "level" indicator flickered on and off. Fix (v0.1.1, desktop-tested with simulated noise, **device check pending**): two-stage adaptive filter (fast stage 0.2 detects movement; slow stage 0.02 at rest, switching to fast for 400 ms after a change of more than ~1.7°), a displayed value that only moves to a new tenth when the reading is more than 0.08° away from it, and hysteresis for the level state (on below 0.3°, off from 0.5°).
- **Double click and single click on the side button can coexist:** delay the single-click action by ~350 ms and treat a second `sideClick` within that window as a double click. Ignore a `sideClick` arriving right after `longPressStart`/`longPressEnd`. Worked on the device.
- **A creation can live in a subfolder of its branch.** `creation.json` `entry` may point to `wasserwaage/index-v0.1.1.html`; the site build exports the whole branch, so the install URL is `/<branch-name>/<folder>/…`. The hub page only embeds a QR found at the branch root.
- **Pages deploy:** pushes to `creation/*` started the Pages workflow but it failed within seconds (also for Todoist); running the workflow manually on `main` (workflow_dispatch) deployed every creation branch. Probably the `github-pages` environment only allows `main`.
- **SVG is fine for this kind of UI:** a few dozen SVG elements updated at 25 Hz (attributes only, no re-render) ran smoothly on the device.

## 12. Open questions and known gaps

**Still open**

- Exact behaviour of voice/STT inside creations (official page says unavailable; community apps report voice input working). Verify on device.
- Whether `fetch` to external HTTPS backends is allowed in all firmware versions (official page says "hosted backend" unsupported; community projects do it). Not yet tested with Tally; note that the WebView does render external pages (see 11b).
- Which model answers `useLLM: true` requests, and whether OS3 BYOK changes that.
- Official SDK docs were last updated Sep 2025 and may not cover newer rabbitOS / OS3 behaviour.
- `PluginMessageHandler` payload fields beyond `message`, `useLLM`, `wantsR1Response`, `wantsJournalEntry` are not documented. Not tested with Tally.
- Not tested on device yet: `longPressEnd`, `closeWebView`, `creationStorage.secure`, camera, microphone and speaker.
- The community Tips & Tricks content was not retrieved (dynamic page).
- A "Map Explorer" listing and a "Post-its" creation by a user "simonb" were mentioned but could not be located. The closest match found is AlanK's "Maps app for R1" (forum, no source). The forum user "simon" is a rabbit staff member. Open the rabbit.tech/creations gallery on a computer, scan or open the creation's link, and have Claude Code read the hosted bundle to learn from it.
- The author of the Silksong map creation (section 7) is not known.

**Resolved (verified on a real R1 with Tally, see 11b)**

- Accelerometer callback shape: the device sends `tiltX/tiltY/tiltZ` (about -1..1), as in the official demo. Keep the `x/y/z` and `rawX/rawY` fallbacks anyway. Axis signs differ from Android, so calibrate (see 11b).
- `creationStorage.plain` with Base64 works and persists across closing the card, even though the official demo's own JS never calls it. It may appear after the page has loaded, so wait for it.
- `scrollUp`, `scrollDown`, `sideClick`, `longPressStart` and `touchstart` on `document.body` work as documented.
- The QR JSON schema (five fields, low error correction) is confirmed from rabbit's own QR tool (`creations-sdk/qr`, read directly from the repo) and a QR generated with it installed correctly.
- Accelerometer axis signs relative to the screen (see 11d), and a practical QR payload limit of about 260 characters (see section 4).

## 13. Sources

Official:
- https://www.rabbit.tech/support/article/how-to-use-r1-creations
- https://github.com/rabbit-hmi-oss/creations-sdk (plugin-demo, qr, `plugin-demo/reference/creation-triggers.md`, `plugin-demo/README.md`)
- https://www.rabbit.tech/ (OS3 overview) and https://www.rabbit.tech/updates (release notes)

Community:
- https://github.com/andr3w-hilton/rabbit-r1-creations-public and https://andr3w-hilton.github.io/rabbit-r1-creations-public/
- https://github.com/Waseemilyas/rabbit-r1-creations-public
- https://github.com/dbclunie/claude-usage-r1
- https://github.com/ShayneP/rabbit-r1-livekit-skill
- https://github.com/AnxAnd/apogee-r1-anti
- https://socket.dev/npm/package/r1-create (unofficial SDK)
- https://deepwiki.com/rabbit-hmi-oss/creations-sdk (auto-generated summary of the official repo)
