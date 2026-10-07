# Builds icon.png (96x96): red rounded square with a white check mark.
from PIL import Image, ImageDraw
S, K = 96, 4                      # draw 4x and downsample for smooth edges
img = Image.new("RGBA", (S * K, S * K), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, S * K - 1, S * K - 1), radius=22 * K, fill="#C24B4B")
d.line([(27 * K, 50 * K), (42 * K, 64 * K), (70 * K, 34 * K)], fill="white", width=10 * K, joint="curve")
for x, y in [(27, 50), (70, 34)]:
    d.ellipse(((x - 5) * K, (y - 5) * K, (x + 5) * K, (y + 5) * K), fill="white")
img.resize((S, S), Image.LANCZOS).save("icon.png")
