# RG Clips – privater RedGifs-Client für den Rabbit R1

Eigene Creation für das R1-Display (240×282): ein Clip pro Bildschirm, eine Scrollrad-Rastung = genau ein Clip.
Nur für die persönliche Nutzung. Kein Download, kein Speichern, kein Re-Hosting, keine Werbung, kein Login.

Liegt bewusst **nicht** auf einem `creation/*`-Branch: Die GitHub-Pages-Übersicht dieses Repos veröffentlicht jeden
solchen Branch. Diese Creation läuft ausschließlich auf einem eigenen Cloudflare Worker mit Zugriffsschlüssel.

```
src/worker.js        Worker: API-Proxy, Token-Cache, /media-Stream-Proxy, Zugriffsschutz, Header
public/index.html    App (eine Datei, kein Build)
public/install.html  Install-Seite mit QR (qrcode.js von cdnjs, SRI-geprüft)
public/version.js    APP_VERSION und INSTALL_V
server/node.mjs      Gleicher Worker unter Node (lokal testen oder eigener Server mit fester IP)
test/                unit.mjs (Worker-Logik), e2e.mjs (Playwright 240×282), mock-api.mjs
```

## API-Tests (curl, 2026-10-07)

| Was | Ergebnis |
| --- | --- |
| `GET /v2/auth/temporary` | 200, `{token, addr, agent, session, rtfm}`. JWT gültig 24 h (`exp − iat = 86400`), Claims `valid_addr` **und** `valid_agent`: Das Token gilt nur für die IP und den User-Agent, mit denen es geholt wurde. Keine Rate-Limit-Header. |
| Token von anderer IP | 401 `WrongSender` („This token belongs to a different device“). In der Test-Sandbox wechselte die Ausgangs-IP pro Verbindung, deshalb lief der Test über *eine* gehaltene Verbindung. |
| `/v2/gifs/search?type=g&order=…&count=…&page=…&tags=…` | 200. `order` trending/top7/latest getestet. `tags` ist **case-sensitiv** (`Big Tits` → Treffer, `big tits` → 0). `search_text=` wird ignoriert (gleiches Ergebnis wie ohne Filter). `count=40` liefert ~26 Clips (Server filtert). Antwort enthält zusätzlich `boosted_gifs` (Werbung) – wird verworfen. |
| `/v2/search/suggest?query=` | 200, `[{type:'tag', text, gifs}]` → damit wird Freitext/Sprache auf den korrekt geschriebenen Tag abgebildet. |
| `/v2/niches/search?query=&order=subscribers&count=&page=` | 200 (1829 Niches). |
| `/v2/niches/<id>/gifs?order=…` | `hot`, `best`, `latest` → 200. `trending` → 400 `BadOrder` (obwohl die Fehlermeldung es auflistet). Verwendet: `hot`. |
| `/v2/gifs/<id>` | 200, `{gif, user, niches}` (in der App nicht nötig). |
| `/v1/tags` | 200, auch ohne Token, 7542 Tags mit `count` → Explore zeigt die Top 80. |
| `/v2/explore/trending-gifs`, `/v2/search/trending` | **404** – existieren nicht mehr, nicht verwendet. „Trending“ = `search?order=trending`. |
| CORS der API | Nur `Access-Control-Allow-Origin: https://www.redgifs.com` → Proxy nötig. |
| Medien `media.redgifs.com/<Name>-mobile.mp4` | URLs ohne Signatur/IP. Kein Token nötig, kein User-Agent nötig, nicht IP-gebunden, Range → 206. **Fremder Referer → 403**, kein Referer oder redgifs.com → 206/200. Gleiches für Thumbnails und `userpic.redgifs.com`. |
| Größen (Beispiel 6,5 s) | `sd` 1,2 MB (~1,5 Mbit/s), `hd` 6,8 MB (~8 Mbit/s, 1080p). |
| Feldnamen | `id, width, height, duration (kann null sein), hasAudio, userName, verified, tags, urls{sd,hd,poster,thumbnail,silent,html}, type (1=Video)`. **Nicht** `has_audio`/`username`/`vthumbnail`/`web_url`. |

Die Wiki-Seite mit den API-Bedingungen (`github.com/Redgifs/api/wiki`) war aus der Testumgebung nicht abrufbar (404/403).
Umgesetzt sind die Vorgaben aus der Aufgabe: nur persönliche Nutzung, Creator-Name sichtbar, kein Download, Caching statt Massenabfragen.

## Entscheidungen

- **Medien direkt statt über den Proxy.** Die App lädt `sd`-MP4s und Poster direkt vom RedGifs-CDN und sendet dank
  `<meta name="referrer" content="no-referrer">` (plus Header `Referrer-Policy: no-referrer`) keinen Referer. Geprüft mit
  echtem Chromium gegen den echten CDN: mit der Meta 200/206, ohne 403 (`ERR_BLOCKED_BY_ORB`). Vorteil: keine Video-Bandbreite
  über den Worker, weniger Latenz. **Fallback:** Schlägt ein Video fehl, lädt die App es über `/media` (Stream-Proxy mit
  Range-Support); nach zwei Fehlschlägen bleibt sie für die Sitzung im Proxy-Modus. Erzwingen mit `&media=proxy`.
- **`sd` als Standard**, `hd` nur mit `&hd=1` (Faktor ~5 mehr Daten, auf 240 px kein sichtbarer Gewinn).
- **Cloudflare Workers statt Vercel.** Das Token ist an die Absender-IP gebunden. Vercel-Funktionen laufen auf wechselnden
  AWS-IPs → ständig `WrongSender`. Bei Workers sieht eine andere Cloudflare-Zone (api.redgifs.com läuft hinter Cloudflare)
  nach meinem Stand der Cloudflare-Doku eine feste Worker-Absenderadresse (`2a06:98c0:3600::103`). Das Token bliebe dann
  gültig; der Haken: Diese Adresse teilen sich alle Worker, ein IP-basiertes Token-Limit bei RedGifs also auch.
  **Beides ist ungetestet**, weil kein Cloudflare-Konto verfügbar war.
  Der Worker ist dagegen abgesichert: max. 3 Token-Abrufe pro Stunde (danach 503 statt Sperre), bei 401/403 genau ein
  neues Token, bei 429 Backoff (Retry-After bzw. 30 s → 15 min), Zähler unter `/api/status`.
  Falls `wrong_sender` dort stetig steigt: Plan B ist `server/node.mjs` auf einem kleinen Server mit fester IP
  (Raspberry Pi zu Hause, kleiner VPS) hinter HTTPS (z. B. Caddy oder Cloudflare Tunnel).
- **Zugriffsschutz:** Alles außer `robots.txt`, `icon.png`, `version.js` verlangt den Schlüssel (`?k=` bzw. Header
  `X-Access-Key`, konstante Zeit). Falscher Schlüssel → 404. `/media` nur für `media|userpic|thumbs*.redgifs.com`, nur
  https, nur Dateinamen `[A-Za-z0-9_-].mp4/jpg/…`, keine Query/Ports/Userinfo (SSRF). Keine CORS-Header (alles same-origin),
  CSP auf den Seiten, `X-Robots-Tag: noindex`, `robots.txt` mit `Disallow: /`, Worker-Logs (`observability`) aus.

## Deploy (Cloudflare Workers, kostenloser Plan reicht)

```bash
cd workers/redgifs-r1
npm install
npx wrangler login                       # Browser-Login bei Cloudflare
openssl rand -hex 16                     # Zugriffsschlüssel erzeugen, notieren
npx wrangler secret put ACCESS_KEY       # Schlüssel einfügen (landet nie im Repo)
# optional, empfohlen: globaler Token-Cache
npx wrangler kv namespace create TOKEN_KV   # id in wrangler.toml eintragen, Block einkommentieren
npx wrangler deploy                      # gibt https://r1-rg.<dein-subdomain>.workers.dev aus
```

Danach am Rechner `https://r1-rg.<subdomain>.workers.dev/install?k=<SCHLÜSSEL>` öffnen. Die Seite zeigt den Install-QR.
Kontrolle: `…/api/status?k=<SCHLÜSSEL>` zeigt Token-Alter, Abrufe pro Stunde und `wrong_sender`.

### Alternative: nur im Cloudflare-Dashboard (ohne Rechner)

1. dash.cloudflare.com → Workers & Pages → Create → Import a repository → GitHub verbinden, `Luxx1993/r1-creations` wählen.
2. Name **`r1-rg`** (muss zu `wrangler.toml` passen), Build command leer, Deploy command `npx wrangler deploy`,
   Path/Root directory **`/workers/redgifs-r1`**, API token automatisch anlegen lassen.
3. Worker → Settings → Build → Branch control: Production branch = der Branch, auf dem dieser Ordner liegt
   (solange PR #3 nicht gemergt ist: `ccr-218661c5-52xyn7`). „Retry build“ baut den alten Branch erneut,
   ein neuer Commit auf dem Branch startet den richtigen Build.
4. Worker → Settings → Variables and Secrets → Add → Secret `ACCESS_KEY` (nur Buchstaben/Ziffern) → Deploy.
   Alternativ den Schlüssel als **Build**-Secret `ACCESS_KEY` anlegen und als Deploy command `npm run deploy` setzen:
   `scripts/sync-secret.mjs` überträgt ihn dann bei jedem Build als Laufzeit-Secret (Wert wird nie ausgegeben).
   Prüfen: `/health` zeigt `keyConfigured: true`.
5. `https://r1-rg.<subdomain>.workers.dev/install?k=<SCHLÜSSEL>` öffnen und den QR mit dem R1 scannen.

Ohne `wrangler login` (z. B. CI): Umgebungsvariablen `CLOUDFLARE_API_TOKEN` (Vorlage „Edit Cloudflare Workers“) und
`CLOUDFLARE_ACCOUNT_ID` setzen.

### Auf dem R1 installieren

1. Alte Version dieser Creation auf dem R1 löschen (falls vorhanden).
2. Creations-Karte → „add via QR code“.
3. QR von der Install-Seite scannen.

### Neue Version

1. Änderungen machen, `APP_VERSION` **und** `INSTALL_V` in `public/version.js` hochzählen.
2. `npx wrangler deploy`.
3. Install-Seite neu laden (QR enthält jetzt `&v=<neu>`), alte Karte löschen, neu scannen. Die R1 cached die Install-URL.

Schlüssel wechseln: `npx wrangler secret put ACCESS_KEY`, dann neu installieren.

## Relay auf dem NAS (nötig, weil RedGifs Cloudflare drosselt)

Getestet am 2026-10-08: Vom Worker aus klappt der Token-Abruf, aber `/v2/gifs/search` antwortet sofort mit
`429 RateLimited`. Alle Cloudflare Worker teilen sich gegenüber RedGifs eine Absenderadresse. Deshalb holt ein
kleiner Container zu Hause (`relay/`) die Clip-Listen mit der Heim-IP.

Das Relay verbindet sich **von sich aus** per WebSocket mit dem Worker (`/relay/connect`) und hält die Leitung
offen. Ein Durable Object (`RelayHub`) reicht jede RedGifs-Anfrage darüber weiter. Es braucht keine Port-Freigabe,
keinen Tunnel und keinen öffentlichen DNS-Namen. Videos lädt der R1 weiterhin direkt vom CDN.

```
R1 ──► Worker (Schlüssel, App, Cache) ──► RelayHub ◄══ WebSocket ══ Relay auf dem NAS ──► api.redgifs.com
R1 ──────────────────────────── Videos direkt ──────────────────────────────────────────► media.redgifs.com
```

1. **Worker** → Settings → Runtime variables and secrets: Secret `RELAY_SECRET` (32 Buchstaben/Ziffern).
   Ohne `RELAY_SECRET` fragt der Worker RedGifs direkt.
2. **NAS**: `relay/docker-compose.yml` als Compose-Projekt anlegen (UGREEN UGOS Pro: Docker → Projekt → Erstellen)
   und `WORKER_URL` sowie `RELAY_SECRET` (derselbe Wert) eintragen. Weitere Dateien sind nicht nötig: Der Container
   lädt `relay.mjs` von GitHub, festgelegt auf einen Commit und per SHA-256 geprüft. Wird `relay.mjs` geändert,
   müssen Commit und Hash in der Compose-Datei mitgezogen werden.
3. `/health` am Worker zeigt `"relay": {"connected": 1, …}`. Das Container-Log zeigt `connected to https://…`.

Das Relay nimmt nur Anfragen an `/v1/…` und `/v2/…` von `api.redgifs.com` an, verbindet sich bei Abbruch selbst neu
(2 s bis 60 s Abstand) und protokolliert keine Inhalte. Ist es nicht verbunden, zeigt die App
„NAS-Relay nicht verbunden“.

## Bedienung

| Eingabe | Feed | Explore / Niches | Suche |
| --- | --- | --- | --- |
| Scrollrad | ±1 Clip, danach 300 ms Sperre | Auswahl ±1 | – |
| Seitentaste kurz | Play/Pause + Overlay (Creator, Position) | Öffnen | Suchen |
| Seitentaste halten | Sprachsuche (`CreationVoiceHandler`), ohne Handler: Textfeld | gleich | – |
| Tippen | Ton an/aus (nur Clips mit Ton) | Kachel öffnen | Feld/Taste |
| Wischen hoch/runter | nächster/vorheriger Clip | Liste blättern | – |

Untere Leiste: Home (Trending), Explore (Suche + Top-Tags), Niches. Zurück-Leiste der R1 führt aus Tag-/Niche-/Such-Feeds
zur Liste zurück (`history`). Ab 5 verbleibenden Clips wird die nächste Seite geladen; maximal zwei `<video>` im DOM
(aktiv + nächster mit `preload="metadata"`).

URL-Parameter (bei Bedarf in die Install-URL; die Install-Seite hat Felder für Debug und Sperrzeit):
`debug=1` (Event-Zähler, Abstand zwischen Scroll-Events, Sperrzeit), `lock=<ms>` (Sperrzeit Feed), `listlock=<ms>`,
`top=<px>` (von der R1-Leiste verdeckter Bereich, Standard 40), `hd=1`, `media=proxy`.

Sperrzeit einstellen: mit `debug=1` installieren, am Rad drehen und „gap“/„min“ ablesen (Abstand der Events einer Rastung).
Die Sperrzeit sollte knapp über dem größten Abstand liegen, den *eine* Rastung erzeugt.

## Lokal testen

```bash
npm install
node test/unit.mjs                      # Worker-Logik gegen Mock-API
node test/e2e.mjs                       # Playwright, 240×282, Screenshots in test/out/
echo 'ACCESS_KEY=dev' > .dev.vars && node server/node.mjs   # http://localhost:8787/?k=dev (echte API)
```

Tastatur am Desktop: ↑/↓ = Scrollrad, Esc = Seitentaste, Leertaste halten = langer Druck.
Playwrights Chromium kann kein H.264, der Test liefert daher einen WebM-Clip aus. Die R1-WebView spielt die MP4s.

## Noch nicht auf dem R1 geprüft

- Token-Stabilität auf Cloudflare (siehe oben, `/api/status`).
- `CreationVoiceHandler` (`start`/`stop`, `sttEnded`) – nach Vorgabe umgesetzt, nur mit Stub getestet.
- Ob die R1-WebView `no-referrer` für Video-Requests einhält (Chromium tut es). Wenn nicht, greift der `/media`-Fallback automatisch.
- Flüssigkeit von `sd` auf dem Gerät, tatsächliche Sperrzeit, Höhe der OS-Leiste (`top`).
