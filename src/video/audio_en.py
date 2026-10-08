import asyncio, base64, wave
from playwright.async_api import async_playwright
JS = r"""
async () => {
  const SR = 44100, LEN = 30;
  const off = new OfflineAudioContext(1, SR * LEN, SR);
  let fakeT = 0;
  AC = new Proxy(off, { get(t, p) { if (p === 'currentTime') return fakeT; const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } });
  master = off.createGain(); master.connect(off.destination);
  master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(.75, .4);
  master.gain.setValueAtTime(.75, 29); master.gain.linearRampToValueAtTime(0, 30);
  musicG = off.createGain(); musicG.gain.value = .32; musicG.connect(master);
  S.pack = 0; S.tod = 0;
  // music: which style plays when
  const segs = [[0, 14.4, 'original'], [14.4, 15.36, 'cave'], [15.36, 16.32, 'blueprint'], [16.32, 17.28, 'mosaic'], [17.28, 18.24, 'aero'], [18.24, 19.2, 'engraving'], [19.2, 20, 'tapestry'], [20, 24, 'aero'], [24, 27, 'ukiyoe'], [27, 30, 'original']];
  for (const [a, b, look] of segs) {
    const m = MUS[look], night = look === 'ukiyoe', eighth = 60 / (m.bpm * (night ? .8 : 1)) / 2;
    let i = 0;
    for (let t = a; t < b; t += eighth, i++) {
      const g = night ? .6 : 1;
      const mm = { ...m, g: m.g * g };
      musicStep(mm, i, t);
    }
  }
  const ev = (t, name, arg) => { fakeT = t; SFX[name](arg); };
  ev(.1, 'babble', "Hi, I'm Clawd!");
  ev(6.4, 'babble', 'The world never ends!');
  ev(8.6, 'babble', 'Wheee!');
  for (const t of [10.5, 11, 11.5, 12.3, 13.2]) ev(t, 'tick');
  for (let k = 0; k < 11; k++) ev(14.4 + k * .48, 'tick');
  ev(13.8, 'babble', 'Looking sharp?');
  for (let k = 0; k < 4; k++) ev(20.02 + k * .7, 'bounce');
  for (let k = 0; k < 3; k++) ev(22.27 + k * .7, 'land');
  ev(24.0, 'babble', 'Good night…');
  ev(24.5, 'snore');
  ev(27.0, 'whistle');
  const buf = await off.startRendering();
  const d = buf.getChannelData(0), out = new Int16Array(d.length);
  for (let i = 0; i < d.length; i++) out[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
  let s = '', u8 = new Uint8Array(out.buffer);
  for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(s);
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        pg = await b.new_page(viewport={'width':240,'height':282})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/user/effective-funicular/index.html')
        await pg.wait_for_function("ready")
        data = base64.b64decode(await pg.evaluate(JS))
        with wave.open('audio_en.wav','wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100); w.writeframes(data)
        print('ok', len(data), errs)
        await b.close()
asyncio.run(main())
