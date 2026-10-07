# Wasserwaage – Neigungsmesser für den Rabbit R1

Creation auf dem Branch `creation/bubble-level`, Dateien im Ordner `wasserwaage/`
(reines HTML/CSS/JS, alles inline, kein Build-Schritt). Referenz: `docs/r1-creations.md` auf `main`.

| Datei | Inhalt |
| --- | --- |
| `wasserwaage/index.html` | Die Creation (Entwicklungsstand) |
| `wasserwaage/index-v0.1.0.html` | Versionierte Kopie, auf die der QR-Code zeigt |
| `wasserwaage/install.html` | Install-Seite mit QR-Code, Bedienung und QR-Inhalt |
| `wasserwaage/qr.png`, `icon.png` | Install-QR (JSON-Payload) und Icon 96×96 (`make_icon.py`) |
| `creation.json` | Eintrag für die Übersichtsseite (`entry`: `wasserwaage/index-v0.1.0.html`) |

Nach dem Deploy: `https://luxx1993.github.io/r1-creations/bubble-level/wasserwaage/install.html`

## Modi

- **Linie** (Standard): R1 hochkant oder quer an Wand/Kante. Die Trennlinie (oben dunkel, unten grün) bleibt zur
  Schwerkraft ausgerichtet; Wert = Abweichung zum nächsten Vielfachen von 90°. Eben (< 0,3°): ganzer Bildschirm grün.
- **Libellen**: waagerecht (0°), senkrecht (90°) und 45°. Automatisch aktiv ist die Libelle mit der kleinsten
  Abweichung; Antippen wählt eine fest (weißer Rahmen, „●“), nochmal Antippen = automatisch.
- **3D**: R1 flach auflegen. Runde Libelle, Gesamtneigung groß, darunter X und Y.

## Bedienung

| Eingabe | Aktion | Desktop |
| --- | --- | --- |
| Seitentaste | Modus wechseln (Linie → Libellen → 3D) | Enter, Leertaste, ←/→ |
| Langer Druck | Kalibrieren | Taste gedrückt halten |
| Doppelklick | Kalibrierung zurücksetzen | zweimal schnell drücken |
| Scrollrad | Einheit °, % Gefälle, mm/m | ↑/↓ oder Mausrad |
| Große Zahl antippen | HOLD an/aus | Klick oder `H` |
| Neigung | – | Mausposition |

Gespeichert werden Modus, Einheit und Kalibrierung (`creationStorage.plain`, gespiegelt in `localStorage`,
Schlüssel `wasserwaage_state`). Achtung: Eine neue Install-URL (neue Version) ist auf dem R1 ein neues Plugin
mit leerem `creationStorage`; der `localStorage`-Spiegel trägt die Werte meist mit.

## Vorzeichen der Anzeige

Wie in der Vorschau: positive Werte = rechte (bzw. in 3D bei Y: untere) Seite liegt höher. Die Konstante `SHOW`
(Standard `-1`) dreht nur die Zahl, nicht die Blase.

## Achsen umdrehen

Oben im Skript von `index.html`: `INVERT_X`, `INVERT_Y` (wirken auf alle Modi) und `INVERT_THETA` (nur Linie und
Libellen). Danach `index.html` als neue Version kopieren (z. B. `index-v0.1.1.html`), QR neu erzeugen:

```bash
python3 tools/make_qr.py --title "Wasserwaage" --description "Neigung messen: Linie, Libellen, 3D" \
  --url https://luxx1993.github.io/r1-creations/bubble-level/wasserwaage/index-v0.1.1.html \
  --theme "#4cd964" --out wasserwaage/qr.png
```

## Testliste auf dem echten R1

1. **Achsenrichtung Linie/Libellen:** R1 hochkant halten und rechts absenken. Die Blase der waagerechten Libelle muss
   nach **links** (zur höheren Seite) wandern, die grüne Fläche im Modus Linie bleibt unten. Falsch herum →
   `INVERT_THETA = true`. Danach quer (90°) und schräg (45°) prüfen: senkrechte bzw. 45°-Libelle wird aktiv, Blase
   wandert zum höheren Ende.
2. **Achsenrichtung 3D:** flach auflegen, rechte Kante anheben → Blase nach rechts. Falsch → `INVERT_X`. Obere Kante
   anheben → Blase nach oben. Falsch → `INVERT_Y`. (Ein geänderter `INVERT_Y` betrifft auch Linie/Libellen, also
   Punkt 1 danach wiederholen.)
3. **Kalibrierung:** In Linie an einer bekannt geraden Kante langer Druck → „Kalibriert“, Anzeige 0.0°. Card
   schließen und neu öffnen → Kalibrierung ist noch da. Doppelklick → „Zurückgesetzt“, kein Moduswechsel.
   In 3D dasselbe flach auf dem Tisch. Langer Druck in falscher Lage zeigt nur den Lagehinweis.
4. **Touch-Ziele:** jede Libelle antippen (auch knapp neben dem Rand) → weißer Rahmen und „●“; nochmal → automatisch.
   Hintergrund antippen → nichts passiert.
5. **HOLD:** große Zahl antippen → „HOLD“ oben rechts, Wert und Blasen stehen still; nochmal tippen → frei.
   Seitentaste während HOLD → nächster Modus ohne HOLD.
6. **Lagehinweis:** R1 in Linie/Libellen flach hinlegen → „—“ und „Hochkant halten“. In 3D hochkant halten →
   „Flach auflegen“.
7. **Scrollrad:** Einheit wechselt (°, %, mm/m) und bleibt nach Neustart erhalten.
8. **Doppelklick-Erkennung:** Einzelklick wechselt den Modus erst nach ca. 0,35 s; zu träge oder zu schnell →
   `DBL_MS` anpassen.

## Lokal testen

```bash
cd wasserwaage && python3 -m http.server 8000
# Browser: http://localhost:8000/index.html (Fenster 240×282 reicht)
```
