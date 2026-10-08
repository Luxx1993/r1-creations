import subprocess, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H, FPS, N = 1920, 1080, 30, 900
MB = 'monocraft-bold.ttf'; MR = 'monocraft-regular.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; SANSB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
F = lambda p, s: ImageFont.truetype(p, s)
ORANGE, CLAUDE = (254, 80, 0), (217, 119, 87)

# ---- static layer: background, glow, device
bg = Image.new('RGB', (W, H))
d = ImageDraw.Draw(bg)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(20 + 14 * t), int(16 + 8 * t), int(20 + 2 * t)))
glow = Image.new('L', (W, H), 0); ImageDraw.Draw(glow).ellipse([60, 40, 1100, 1040], fill=110)
glow = glow.filter(ImageFilter.GaussianBlur(160))
bg = Image.composite(Image.new('RGB', (W, H), (120, 52, 28)), bg, glow)
SCALE = 3.0; SW, SH = int(240 * SCALE), int(282 * SCALE)            # 720 x 846
BX, BY = 110, (H - (SH + 2 * 64)) // 2                               # device body
BW, BH = SW + 64 + 200, SH + 2 * 64
SX, SY = BX + 48, BY + 64                                            # screen origin
dev = ImageDraw.Draw(bg)
shadow = Image.new('L', (W, H), 0); ImageDraw.Draw(shadow).rounded_rectangle([BX + 18, BY + 30, BX + BW + 18, BY + BH + 30], 90, fill=150)
bg = Image.composite(Image.new('RGB', (W, H), (8, 6, 6)), bg, shadow.filter(ImageFilter.GaussianBlur(28)))
dev = ImageDraw.Draw(bg)
dev.rounded_rectangle([BX, BY, BX + BW, BY + BH], 90, fill=ORANGE)
dev.rounded_rectangle([BX + 3, BY + 3, BX + BW - 3, BY + BH - 3], 87, outline=(255, 120, 60), width=3)   # a soft rim of light
dev.rounded_rectangle([SX - 22, SY - 22, SX + SW + 22, SY + SH + 22], 40, fill=(12, 12, 14))   # bezel
# scroll wheel and camera on the right
wx = SX + SW + 22 + 70
dev.rounded_rectangle([wx - 34, SY + 240, wx + 34, SY + SH - 140], 34, fill=(205, 62, 0))
for k in range(16):
    y = SY + 262 + k * ((SH - 420) / 15)
    dev.line([(wx - 26, y), (wx + 26, y)], fill=(170, 50, 0), width=4)
dev.ellipse([wx - 30, SY + 40, wx + 30, SY + 100], fill=(20, 20, 24)); dev.ellipse([wx - 14, SY + 56, wx + 14, SY + 84], fill=(40, 46, 70))
mask = Image.new('L', (SW, SH), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, SW - 1, SH - 1], 28, fill=255)

# ---- the OS bar the R1 draws over the top 40 px
bar = Image.new('RGBA', (SW, int(40 * SCALE)), (0, 0, 0, 255))
bd = ImageDraw.Draw(bar); fb = F(SANSB, 46)
bd.text((24, 30), '← back', font=fb, fill='white'); bd.text((SW // 2 - 40, 30), '14:30', font=fb, fill='white')
bd.rounded_rectangle([SW - 96, 46, SW - 36, 80], 8, outline='white', width=4); bd.rectangle([SW - 34, 56, SW - 28, 70], fill='white'); bd.rectangle([SW - 88, 54, SW - 58, 72], fill='white')

# ---- captions
TX = BX + BW + 110; TW = W - TX - 90
SEGS = [
    (0, 3, "Hi, I'm Clawd!", 'A tiny pet diorama for your Rabbit R1.'),
    (3, 7, 'Endless world', 'The scroll wheel walks Clawd left and right, and the world never ends.'),
    (7, 10, 'Pet & tap', 'Hold for hearts. Tap and Clawd reacts.'),
    (10, 14, 'Items', 'Hats, glasses and bows roll by like a rolodex.'),
    (14, 20, '7 places, 11 styles', 'Scenes and art styles from the Claude Fables plugin, from pixel art to ukiyo-e.'),
    (20, 24, 'Games', 'Juggling, skipping rope and whistling, with sound.'),
    (24, 27, 'Day, night & sleep', 'At night it gets dark, Clawd falls asleep and snores softly.'),
    (27, 30, 'Install now', 'Scan the QR code with your R1.'),
]
def wrap(text, font, width, draw):
    out, line = [], ''
    for w_ in text.split():
        test = (line + ' ' + w_).strip()
        if draw.textlength(test, font=font) <= width: line = test
        else: out.append(line); line = w_
    out.append(line); return out
qr = Image.open('/home/user/effective-funicular/qr.png').convert('RGB').resize((260, 260), Image.NEAREST)
fT, fS, fH, fB, fSm = F(MB, 120), F(SANS, 38), F(MB, 64), F(SANS, 36), F(SANS, 26)
ease = lambda x: 0 if x <= 0 else 1 if x >= 1 else x * x * (3 - 2 * x)

def text_layer(t):
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(L)
    # title, always there
    dr.text((TX, 150), 'Clawd', font=fT, fill=CLAUDE + (255,))
    dr.text((TX + 4, 300), 'a pet for the Rabbit R1', font=fS, fill=(235, 228, 220, 255))
    for i, (a, b, head, sub) in enumerate(SEGS):
        if not (a - .01 <= t < b + .35): continue
        fin, fout = ease((t - a) / .35), 1 - ease((t - b) / .35)
        al = int(255 * min(fin, fout)); dy = int(26 * (1 - fin))
        y = 470 + dy
        dr.text((TX, y - 4), f'{i + 1:02d}', font=F(MB, 30), fill=ORANGE + (al,))
        fh = fH; sz = 64
        while dr.textlength(head, font=fh) > TW and sz > 30: sz -= 2; fh = F(MB, sz)
        dr.text((TX, y + 40 + (64 - sz) // 2), head, font=fh, fill=(255, 255, 255, al))
        for k, line in enumerate(wrap(sub, fB, TW, dr)):
            dr.text((TX, y + 140 + k * 50), line, font=fB, fill=(205, 198, 190, al))
        if i == len(SEGS) - 1:
            L.paste(Image.merge('RGBA', (*qr.split(), Image.new('L', qr.size, al))), (TX, y + 210))
            dr.text((TX + 290, y + 290), 'Also runs in a browser:', font=fSm, fill=(150, 144, 138, al))
            dr.text((TX + 290, y + 326), 'luxx1993.github.io/', font=fSm, fill=(205, 198, 190, al))
            dr.text((TX + 290, y + 362), 'r1-creations/clawd-en', font=fSm, fill=(205, 198, 190, al))
    # progress (it gives way to the QR code at the end)
    pa = int(255 * (1 - ease((t - 26.8) / .4)))
    if pa <= 0: return L
    dr.rounded_rectangle([TX, H - 120, TX + TW, H - 112], 4, fill=(255, 255, 255, int(40 * pa / 255)))
    dr.rounded_rectangle([TX, H - 120, TX + int(TW * t / 30), H - 112], 4, fill=ORANGE + (pa,))
    dr.text((TX, H - 96), 'Scenes, styles and animations: Claude Fables plugin', font=fSm, fill=(150, 144, 138, pa))
    return L

ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-i', 'audio_en.wav', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                       '-af', 'loudnorm=I=-16:TP=-1.5', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', '-movflags', '+faststart', 'clawd-demo-en.mp4'],
                      stdin=subprocess.PIPE)
for f in range(N):
    t = f / FPS
    fr = bg.copy()
    scr = Image.open(f'frames_en/{f:04d}.png').convert('RGB').resize((SW, SH), Image.LANCZOS)
    scr.paste(bar, (0, 0), bar)
    fr.paste(scr, (SX, SY), mask)
    fr.paste(tl := text_layer(t), (0, 0), tl)
    if t < .5:  # fade in from black
        fr = Image.blend(Image.new('RGB', (W, H)), fr, t / .5)
    if f in (45, 250, 480, 880): fr.save(f'still_en_{f}.png')
    ff.stdin.write(fr.tobytes())
ff.stdin.close(); ff.wait(); print('done', ff.returncode)
