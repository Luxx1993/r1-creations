Demo video (30 s, 1920x1080): `demo/clawd-demo.mp4`.

1. `capture.py` runs the real creation in headless Chromium with a paused, stepped clock and saves 900 frames (30 fps) of a scripted session.
2. `audio.py` renders the soundtrack offline with Clawd's own synthesiser (style music, voice blips, ball, rope, snoring, whistle) into `audio.wav`.
3. `compose.py` puts the frames into an R1-style device frame with captions (needs `monocraft-bold.ttf`, converted from `src/mono.b64.json` with fontTools) and encodes the MP4 with ffmpeg.

English version: `capture_en.py`, `audio_en.py`, `compose_en.py` make `demo/clawd-demo-en.mp4` the same way.
