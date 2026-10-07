# Rabbit R1 Creations

Sammlung kleiner Web-Apps („Creations“) für den Rabbit R1 (Bildschirm 240×282 px).

## Aufbau

| Wo | Was |
| --- | --- |
| `main` | Übersichtsseite, Doku (`docs/r1-creations.md`), Werkzeuge (`tools/`), Deploy-Workflow |
| `creation/<name>` | Eine Creation pro Branch (Dateien im Branch-Root) |

Die Seite `https://luxx1993.github.io/r1-creations/` listet alle Creations. Jede liegt unter
`/<name>/`, z. B. `/tally/`.

## Creations

| Name | Branch | Beschreibung |
| --- | --- | --- |
| Tally | `creation/tally` | Strichlisten-Zähler mit Auto-Rotation |
| Marble Maze | `creation/marble-maze` | Murmel-Labyrinth: 15 Level, Neigung per Beschleunigungssensor, Drehregler = Tempo (10 Stufen) |
| Clawd | `creation/clawd` | Clawd als Haustier im Diorama: 7 Szenen und 11 Stile aus dem Claude-Fables-Plugin, Hüte, Brillen und Schleifen, Auto-Rotation |
| Todoist | `creation/todoist` | Todoist-Aufgaben mit Sync: Heute, Eingang, Projekte, Suche, Sprach-Eingabe per PTT, Offline-Queue, Vorlesen. Deutsch und Englisch |

### Tally installieren

Auf dem R1: Creations-Karte → „add via QR code“ → diesen Code scannen.

[![Install-QR für Tally – Klick öffnet den Branch](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/tally/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/tally)

(Ein Klick auf das Bild öffnet den Branch `creation/tally` mit Screenshots und Beschreibung. Das Bild ist immer der aktuelle Code der Creation.)

### Marble Maze installieren

Auf dem R1: Creations-Karte → „add via QR code“ → diesen Code scannen.

[![Install-QR für Marble Maze – Klick öffnet den Branch](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/marble-maze/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/marble-maze)

Bedienung: Neigen = Kugel rollt, Drehregler = Tempo (1–10), Seitentaste = Neutrallage kalibrieren (Doppelklick = Y-Achse umkehren), langer Druck = Levelmenü.

### Clawd installieren

Auf dem R1: Creations-Karte → „add via QR code“ → diesen Code scannen.

[![Install-QR für Clawd – Klick öffnet den Branch](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/clawd/qr.png)](https://github.com/Luxx1993/r1-creations/tree/creation/clawd)

Demo-Video (30 s): [clawd-demo.mp4](https://luxx1993.github.io/r1-creations/clawd/demo/clawd-demo.mp4)

Clawd ist ein Haustier ohne Pflege und ohne Level in einer endlosen Welt (keine Begrenzung nach links oder rechts): Er läuft von selbst durch die Szene, reagiert auf Berührung und schläft ein, wenn niemand da ist.

- Drehregler: lenkt Clawd nach links/rechts (nach oben drehen = nach rechts). Nach einem Druck auf die Seitentaste wählt er stattdessen einen Menüpunkt (Spiel, Schlaf, Items, Welt, Optionen), ein zweiter Druck führt ihn aus. Spiel öffnet eine Auswahl: Ball (Clawd jongliert, mit Ton bei jedem Aufprall), Seilspringen oder Pfeifen; Clawd pfeift und springt Seil auch von selbst.
- Seitentaste lang halten oder Clawd gedrückt halten: streicheln. Kurz antippen: er reagiert. Viermal schnell antippen oder schütteln: ihm wird schwindlig. Ein Tipp auf die Szene schickt ihn dorthin.
- Welt: Ort (Wald, Weltraum, Stadt, Wüste, Vulkan, Labor, Dorf) und Stil (Original, Pixel Art, Höhle, Blaupause, Mosaik, Frutiger Aero, Kupferstich, Wandteppich, Golden Age, Ukiyo-e, Kamon) als Rolodex-Auswahl. Items: Kopf, Gesicht und Körper (Hüte, Brillen, Schnurrbart, Schleife, Schal), jeweils im Stil gezeichnet.
- Ton (alles per WebAudio erzeugt, ohne Dateien; in Welt unter „Ton“ abschaltbar): Clawd „spricht“ in Blips, schnarcht beim Schlafen, pfeift, der Ball klackt, und je nach Stil läuft eine eigene leise Hintergrundmelodie. Auf dem R1 muss die Karte einmal berührt werden, damit der Ton starten darf.
- Optionen: Klang (Stil, Retro, Glocken, Minimal), Lautstärke (Aus bis 100 %), Ruhezeiten (Töne nachts stumm: 22–07, 23–08, 00–06) und Bewegung (Normal/Ruhig). In „Welt“ lässt sich die Tageszeit-Reaktion („Zeit“) abschalten.
- Tageszeit: Nach der echten Uhrzeit tönt sich die Szene (Morgenrot, Abendrot, Nacht), Clawd begrüßt dich passend, ist morgens munterer, abends ruhiger mit mehr Pfeifen, nachts langsamer und schläft schneller ein (manchmal findest du ihn schlafend), und die Musik wird nachts leiser und langsamer.
- Szenen, Stile und Animationen stammen aus dem Claude-Fables-Plugin und sind vorgerendert (`src/` im Branch enthält Generator und Anleitung). Noch nicht auf dem echten Gerät getestet: Sensorfunktionen, Auto-Rotation und die Ladezeit der rund 4 MB Bilder.

### Clawd am Desktop ausprobieren

Clawd ist eine statische Seite (HTML, JavaScript und Bilder) und läuft in jedem normalen Browser, ohne Server und ohne den R1.

- Online: `https://luxx1993.github.io/r1-creations/clawd/index.html` (setzt voraus, dass GitHub Pages öffentlich erreichbar ist).
- Lokal: `git clone -b creation/clawd --single-branch https://github.com/Luxx1993/r1-creations.git clawd`, dann `index.html` im Browser öffnen (der Ordner `assets/` muss daneben liegen). Alternativ im Ordner `python3 -m http.server` starten und `http://localhost:8000/` öffnen.
- Bedienung: Pfeiltasten = Drehregler (hoch/links und runter/rechts sind die beiden Drehrichtungen), Enter oder Leertaste = Seitentaste, `H` = streicheln, `O` = Ansicht in 90°-Schritten drehen, Maus = Touch (Klicken und Wischen).
- Am Desktop fehlen die Sensoren (kein Schütteln, keine automatische Drehung), die Ansicht bleibt 240×282 px groß (Browser-Zoom hilft), der Spielstand liegt im `localStorage` des Browsers, und der Ton startet erst nach dem ersten Klick oder Tastendruck.
- Weiterentwickeln: `index.html` ist generiert. Der Quelltext liegt in `src/index.src.html`, `python3 src/build.py` baut `index.html` und die versionierte Datei neu. Die Bilder entstehen mit dem Generator in `src/` aus dem Claude-Fables-Plugin (siehe `src/README.md`). Beim Weitergeben die Lizenzen beachten: Claudes 3D-Modell von ChetasLua (MIT) und die Schrift Monocraft (OFL).

### Todoist installieren

Synchronisiert direkt mit deinem eigenen Todoist-Konto (Optik der Todoist-Android-App im Dark Mode). Nach dem Scannen im Setup den API-Token eingeben (Todoist → Einstellungen → Integrationen → Entwickler); er bleibt auf dem R1. Ohne Token gibt es einen Demo-Modus.

| Deutsch | English |
| --- | --- |
| [![Install-QR für Todoist (Deutsch) – Klick öffnet die Anleitung](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/todoist/qr.png)](https://github.com/Luxx1993/r1-creations/blob/creation/todoist/README.md) | [![Install QR for Todoist (English) – click for the guide](https://raw.githubusercontent.com/Luxx1993/r1-creations/creation/todoist/en/qr.png)](https://github.com/Luxx1993/r1-creations/blob/creation/todoist/README.en.md) |
| `/todoist/` · [Anleitung](https://github.com/Luxx1993/r1-creations/blob/creation/todoist/README.md) | `/todoist/en/` · [Guide](https://github.com/Luxx1993/r1-creations/blob/creation/todoist/README.en.md) |

Bedienung: Scrollrad = Aufgabe wählen, Seitentaste = erledigen (5 s Rückgängig), PTT halten = Aufgabe diktieren → Review → Senden, Plus = Texteingabe, Lautsprecher = Liste vorlesen, Bildschirm 1 s halten = Setup. Beide Sprachen kommen aus derselben Quelldatei (`index.html` im Branch, `release.py` hält `en/` synchron).

## Neue Creation anlegen

```bash
git checkout -b creation/<name> main
# index.html, icon.png (96x96), creation.json anlegen
pip install pillow qrcode
python3 tools/make_qr.py --title "<Titel>" --description "<Text>" \
  --url https://luxx1993.github.io/r1-creations/<name>/index.html
git add -A && git commit -m "Add <name>" && git push -u origin creation/<name>
```

`creation.json`: `{"title":"…","description":"…","version":"0.1.0","entry":"index.html"}`.
Der Workflow `.github/workflows/pages.yml` baut bei jedem Push auf `main` oder `creation/**` die
Seite neu (Übersicht + ein Ordner pro Creation).

## Einmalig einrichten

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Hinweise

- Neue Version einer Creation = neue Datei `index-v<version>.html`, alte Karte auf dem R1
  deinstallieren, neuen QR scannen (die R1 cached die Install-URL).
- Alle Creations teilen sich den Origin `luxx1993.github.io`: `localStorage`-Schlüssel mit
  Creation-Namen versehen (z. B. `tally_state`).
- Details, SDK und Erfahrungen vom echten Gerät: `docs/r1-creations.md`.
