#!/usr/bin/env python3
"""Keep the German and English Todoist creation in sync, and cut releases.

index.html is the only source. It holds both languages (I18N table) and picks
English when it is served from /en/. This script copies it byte for byte:

  python3 release.py            sync en/index.html from index.html (run after every change)
  python3 release.py --release  also write index-v<ver>.html and en/index-v<ver>.html,
                                update creation.json and both install pages, and
                                render qr.png and en/qr.png (version = APP_VERSION)

Forks: --base https://<user>.github.io/<repo>/todoist/
"""
import argparse, json, re, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LANGS = {
    "de": {"dir": ROOT, "description": "Todoist-Aufgaben auf dem R1"},
    "en": {"dir": ROOT / "en", "description": "Todoist tasks on the R1"},
}

p = argparse.ArgumentParser()
p.add_argument("--release", action="store_true")
p.add_argument("--base", default="https://luxx1993.github.io/r1-creations/todoist/")
a = p.parse_args()
base = a.base.rstrip("/") + "/"

src = ROOT / "index.html"
ver = re.search(r"const APP_VERSION = '([\d.]+)'", src.read_text(encoding="utf-8")).group(1)
(ROOT / "en").mkdir(exist_ok=True)
shutil.copyfile(src, ROOT / "en" / "index.html")
print("synced en/index.html from index.html (v%s)" % ver)
if not a.release:
    raise SystemExit(0)

import qrcode
from qrcode.constants import ERROR_CORRECT_L

entry = "index-v%s.html" % ver
for lang, cfg in LANGS.items():
    d = cfg["dir"]
    shutil.copyfile(src, d / entry)
    inst = d / "install.html"
    inst.write_text(re.sub(r"var ENTRY = '[^']*';", "var ENTRY = '%s';" % entry, inst.read_text(encoding="utf-8")), encoding="utf-8")
    url = base + ("" if lang == "de" else lang + "/") + entry + "?v=1"
    payload = {"title": "Todoist", "url": url, "description": cfg["description"],
               "iconUrl": base + "icon.png", "themeColor": "#C24B4B"}
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_L, box_size=8, border=4)
    qr.add_data(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(d / "qr.png")
    print(lang, json.dumps(payload, ensure_ascii=False))

meta = json.loads((ROOT / "creation.json").read_text(encoding="utf-8"))
meta.update(version=ver, entry=entry)
(ROOT / "creation.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print("release", ver, "->", entry, "and en/" + entry)
