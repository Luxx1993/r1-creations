# Claude Start

Startseite für den Rabbit R1 (240 × 282 px) mit Links zur Web-Version von claude.ai. Es ist kein eigener Chat und nutzt keine API: Die Links öffnen die echten Seiten im Webview des R1.

Wichtig: Ob claude.ai im Webview (Android, Chrome 101) funktioniert, ist **nicht bewiesen**. Die Startseite zeigt deshalb pro Eintrag eine Markierung, damit du es selbst testen kannst. Hintergrund siehe `docs/diagnose.md`, Wege zu claude.ai in `docs/moeglichkeiten.md`.

## Bedienung

- **Drehregler:** Eintrag wählen. **Seitentaste:** öffnen. **Antippen:** öffnen.
- **Seitentaste lang halten** oder einen Eintrag lang antippen: Markierung weiterschalten ○ ungetestet → ✓ läuft → ✗ weiß/schwarz/Fehler → ○. Sie bleibt nach „← zurück“ erhalten.
- Zuletzt geöffnete Einträge stehen oben.
- Am Computer: Pfeiltasten, Enter (öffnen) und `m` (markieren).

## Links ändern

Die Datei `links.js` enthält die Liste. Eine Zeile kopieren und `title`, `url`, `note` anpassen, oder eine Zeile löschen. Für einen eigenen Chat die Adresse `https://claude.ai/chat/<id>` bei „Eigener Chat“ eintragen. Danach eine neue Version ausliefern (siehe Update).

## Hosting

Dieses Repo liefert den Branch automatisch über GitHub Pages aus: `https://luxx1993.github.io/r1-creations/clau.de/`. Kostenlos, nichts zu tun außer Pushen.

Alternativen für eine eigene Domain: **Netlify Drop** (Ordner oder ZIP auf app.netlify.com/drop ziehen, danach die Seite „claimen“, sonst läuft sie ab) oder **Cloudflare Pages**. Wenn sich die Adresse ändert, den QR neu erzeugen (`python3 tools/make_qr.py …`).

## Installation

Auf dem R1: Creations-Karte → „add via QR code“ → `qr.png` (oder `install.html`) scannen. Der Code enthält ein JSON-Objekt, kein bloßer Link.

## Update

Der R1 merkt sich die Installationsadresse. Darum:

1. Datei als neue Version kopieren (z. B. `index-v1.7.0.html`) und `APP_VERSION`, den `?v=` bei `links.js`, `creation.json` und den QR darauf anpassen.
2. Die alte Karte auf dem R1 löschen.
3. Den neuen QR scannen.

Geräte-Speicher (Markierungen) gehört zur Installationsadresse: Nach einem Update fangen die Markierungen neu an.

## Dateien

`index.html` (aktuelle Version als `index-v<Version>.html`), `links.js`, `install.html`, `browser.html`, `voice.html`, `features.html` (Funktionstest), `docs/diagnose.md`, `docs/moeglichkeiten.md`.
