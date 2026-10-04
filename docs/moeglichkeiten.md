# Möglichkeiten: claude.ai auf dem R1 nutzen

Stand 2026-10-04. Ziel ist die echte Web-Version von claude.ai mit deinen Chats, Projekten und Konnektoren.

## Was neu herausgefunden wurde

- **Der Webview kann viele neue Browser-Funktionen nicht.** In Chromium 101 (gleiche Version wie der R1) fehlen 23 von 33 geprüften Funktionen, die moderne Web-Apps oft ohne Ersatz verwenden. Beispiele sind `Promise.withResolvers` (ab Chrome 119), `Object.groupBy` (117), `Array.toSorted` (110), `AbortSignal.timeout` (103), CSS-Nesting (112), `color-mix()` (111) und `:has()` (105).
- **Das passt zum Bild „lädt erst, wird dann weiß“.** So sieht es typischerweise aus, wenn eine React-App beim Start eine Funktion aufruft, die es nicht gibt: Die erste Ansicht erscheint, dann bricht ein Fehler alles ab und die Seite wird leer. **Belegt ist das nicht.** Den Code von claude.ai konnte ich nicht prüfen, weil Cloudflare und das Netz dieser Umgebung ihn sperren.
- **Andere mögliche Ursache:** zu wenig Speicher auf dem R1 für eine so große App. Die neue Seite „Funktionstest“ zeigt dazu den verfügbaren Speicher an.
- claude.ai verweist Android-Geräte per `assetlinks.json` auf die Claude-App (`com.anthropic.claude`). Der R1 hat keinen Play Store, deshalb hilft das nicht.

Wenn die erste Ursache stimmt, kann eine Creation sie **nicht** beheben. Sie kann in die fremde Seite keinen Ersatzcode einschleusen, und der Webview lässt sich nicht aktualisieren.

## Möglichkeiten, nach Aufwand sortiert

| # | Weg | Bringt echtes claude.ai? | Aufwand | Einschätzung |
| --- | --- | --- | --- | --- |
| 1 | **Funktionstest am R1** (neu in der Liste) | – | 1 Minute | Zeigt, ob dem echten R1 dieselben Funktionen fehlen wie im Test. Bitte fotografieren. |
| 2 | **PC-Fernzugriff** (Chrome Remote Desktop, neu in der Liste) | Ja, im Chrome deines PCs | PC muss laufen, Fernzugriff einmal am PC einrichten | Bester Kandidat. claude.ai läuft im aktuellen Chrome am PC, der R1 zeigt nur das Bild. Ungetestet, ob die Web-Version von Remote Desktop im Chrome-101-Webview startet. Der Bildschirm ist sehr klein. |
| 3 | **Eigener Fernbrowser** auf deinem PC oder Server (z. B. Kasm oder Neko mit Chromium, Zugriff übers Netz) | Ja | Hoch (Docker, Netzwerk, Absicherung) | Nur wenn 2 nicht läuft. Du meldest dich dort selbst an. Fremde Fernbrowser-Dienste nicht nutzen, sonst liegt dein Claude-Login bei Dritten. |
| 4 | **Einzelne Seiten testen** (Hilfe, Anmelden, Share-Link) | Teilweise | Gering | Die Markierungen in der Liste zeigen, was geht. |
| 5 | **rabbit OS3 mit eigenem Anthropic-Schlüssel (BYOK)** | Nein, nur das Claude-Modell, ohne deine Chats und Projekte | Mittel, kostet API-Guthaben | Claude per Sprache direkt am R1, aber nicht claude.ai. |
| 6 | Anthropic um Unterstützung älterer Webviews bitten (Feedback in claude.ai) | Vielleicht, irgendwann | Gering | Nicht in deiner Hand. |

Nicht machbar oder nicht erlaubt: ein Proxy, der claude.ai umschreibt; Ersatzcode in claude.ai einschleusen; Entwicklermodus oder andere Firmware am R1; die Claude-App auf dem R1 installieren.

## Was ich nicht prüfen konnte

- Die Netzwerkregeln dieser Umgebung sperren `assets.claude.ai`, `web.archive.org` und `remotedesktop.google.com`. Deshalb fehlt die Prüfung des JavaScript-Codes von claude.ai und der Remote-Desktop-Seite im Chrome-101-Test.
- Die angemeldete Ansicht (ohne Zugangsdaten nicht möglich).
