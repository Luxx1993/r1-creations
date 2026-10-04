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
