#!/usr/bin/env python3
"""Build the R1 install QR (JSON payload) for the Tally creation."""
import argparse, json
import qrcode
from qrcode.constants import ERROR_CORRECT_L

p = argparse.ArgumentParser()
p.add_argument("--url", required=True, help="Public HTTPS URL of index.html (or a versioned copy)")
p.add_argument("--icon-url", help="Icon URL (default: icon.png next to --url)")
p.add_argument("--out", default="qr.png")
a = p.parse_args()

icon = a.icon_url or a.url.rsplit("/", 1)[0] + "/icon.png"
payload = {"title": "Tally", "url": a.url, "description": "Einfacher Zähler",
           "iconUrl": icon, "themeColor": "#FE5000"}
text = json.dumps(payload, separators=(",", ":"))
print(text)

qr = qrcode.QRCode(error_correction=ERROR_CORRECT_L, box_size=8, border=4)
qr.add_data(text)
qr.make(fit=True)
qr.make_image(fill_color="black", back_color="white").save(a.out)
print("wrote", a.out)
