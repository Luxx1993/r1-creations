# Diagnose: weißes Bild auf claude.ai im R1-Webview

Stand 2026-10-04. Kurzfassung: **Die Ursache ist nicht gefunden.** Die angemeldete Ansicht ließ sich nicht prüfen.

## Was getestet wurde

- Chromium **101.0.4951.0** (Snapshot-Build, nächster verfügbarer zu Chrome 101; Chrome for Testing bietet 101 nicht an), Puppeteer, Viewport 240 × 292, Pixeldichte 2, mobil mit Touch, User-Agent des R1 (Android 13, Chrome/101.0.4951.61 wv).
- Aufgerufen: `claude.ai/`, `claude.ai/login`, `claude.com`, `support.claude.com`, `clau.de`.

## Ergebnisse

| Seite | Ergebnis |
| --- | --- |
| `claude.ai/` | Weiterleitung auf `/login`, dort Antwort 403 mit Cloudflare-Prüfseite („Just a moment…“, `cf-mitigated: challenge`). |
| `claude.ai/login` | Ebenfalls 403, Cloudflare-Prüfseite. |
| `claude.com` | Lädt (200), Seite mit „Continue with Google“ ist bedienbar im Chrome-101-Profil. Keine unbehandelten JavaScript-Ausnahmen. |
| `support.claude.com` | Lädt (Hilfe-Center), keine JavaScript-Ausnahmen. |
| `clau.de` | In dieser Umgebung nicht erreichbar (Host vom Netzwerkfilter gesperrt, `host_not_allowed`). **Ziel unbekannt.** Lukas muss es am R1 ausprobieren (Eintrag in der Liste). |

Die in den Protokollen sichtbaren Ladefehler (`ERR_TUNNEL_CONNECTION_FAILED` für Bilder, Videos, Analytics, Turnstile-Skript) entstehen durch den Netzwerkfilter dieser Umgebung und sagen nichts über den R1 aus.

## Was nicht möglich war

- Der Cloudflare-Schutz blockiert den Test auf `claude.ai`. Er wurde **nicht umgangen**, wie im Auftrag verlangt.
- Es wurden **keine Zugangsdaten** verwendet oder erfragt. Die angemeldete Startseite („Hallo, <Name>…“), bei der das Bild weiß wurde, ließ sich deshalb nicht reproduzieren.
- Ob die Web-App von claude.ai im Chrome-101-WebView läuft, bleibt **unbekannt**. Eine fehlende Browserfunktion (z. B. `:has()`, Container Queries, `dvh`) als Auslöser ist eine Vermutung ohne Beleg.

## Offen / nächste Schritte am Gerät

1. In der Liste jeden Eintrag öffnen und nach der Rückkehr markieren (✓ läuft, ✗ weiß/schwarz/Fehler).
2. Hilfe (`support.claude.com`) und Startseite vergleichen: Läuft nur die angemeldete Web-App nicht, spricht das für ein Problem der App und nicht des Webviews allgemein.
3. Foto machen, falls das Bild weiß wird, und notieren, ob es nach dem Anmelden sofort oder erst nach einigen Sekunden passiert.

## Nachtrag 2026-10-04: Funktionstest

`features.html` prüft 33 Browser-Funktionen. In Chromium 101 fehlen 23, darunter `Promise.withResolvers`, `Object.groupBy`, `Array.toSorted`, `AbortSignal.timeout`, CSS-Nesting, `color-mix()`, `:has()`, Container Queries und `dvh`. Ob claude.ai eine davon ohne Ersatz nutzt, ist **nicht belegt** (Code nicht erreichbar). Ergebnis am echten R1 steht noch aus. Möglichkeiten siehe `docs/moeglichkeiten.md`.

## Ergebnis am echten R1 (2026-10-05, Fotos von Lukas)

- Funktionstest: **23 von 33 fehlen**, dieselben wie im Chromium-101-Test. Chrome **101.0.4951.61**.
- Speicher: **1020 MB** JS-Heap maximal, Gerät etwa **4 GB** RAM.
- Folgerung: Der Webview entspricht genau Chrome 101. Fehlende Funktionen bleiben die wahrscheinlichste Ursache für das weiße Bild, belegt ist sie weiterhin nicht. Speichermangel ist bei 1 GB Heap weniger wahrscheinlich, aber nicht ausgeschlossen.

## Beobachtung am R1 (2026-10-05, 00:37, Foto von Lukas)

- Die Startseite von claude.ai lädt im dunklen Design („Worüber wollen wir nachdenken?“), das Eingabefeld funktioniert, Text „hi“ ließ sich eingeben.
- Nach dem Absenden bewegt sich das Claude-Logo kurz (Antwort-Animation), dann wird der Bildschirm **schwarz**.
- Einordnung: Schwarz im dunklen Design und weiß im hellen Design passen beide zu „die App räumt ihre Ansicht ab und nur der Seitenhintergrund bleibt“. Das spricht eher für einen JavaScript-Fehler beim Anzeigen der Antwort als für einen Absturz des ganzen Webviews. **Nicht belegt.** Ob die Animation selbst oder das Anzeigen der Antwort den Fehler auslöst, ist offen.
- Nächster Test: nach dem schwarzen Bild zurück und „Letzte Chats“ öffnen. Steht die Antwort im Chat, hat der Server geantwortet und nur die Live-Anzeige scheitert.
