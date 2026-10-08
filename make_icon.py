#!/usr/bin/env python3
"""Draw icon.png (96x96) for the Wasserwaage creation: vial with bubble on #111."""
from PIL import Image, ImageDraw

S = 4                                   # supersampling
im = Image.new("RGBA", (96 * S, 96 * S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((0, 0, 96 * S - 1, 96 * S - 1), radius=20 * S, fill="#111111")
d.rounded_rectangle((10 * S, 34 * S, 86 * S, 62 * S), radius=14 * S, fill="#4cd964")
for x in (38, 58):
    d.line((x * S, 37 * S, x * S, 59 * S), fill="#1a7a30", width=3 * S)
d.ellipse((39 * S, 39 * S, 57 * S, 57 * S), fill="#d7f7de")
im.resize((96, 96), Image.LANCZOS).save("icon.png")
print("wrote icon.png")
