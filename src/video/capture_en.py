import asyncio, os, datetime
from playwright.async_api import async_playwright
OUT='frames_en'; os.makedirs(OUT, exist_ok=True)
FPS=30; N=900
JS={}
def at(sec, js): JS.setdefault(round(sec*FPS), []).append(js)

# A 0-3s: hello
at(0, "S.look='original';S.scene='forest';S.tod=0;S.vol=0;S.hat=0;S.face=0;S.body=0;loadWorld();R.x=300;R.cam=180;R.target=300;R.sleeping=false;idle(99);R.greet=3;R.lastTouch=R.time;say('Hi, I\\'m Clawd!',2.8)")
# B 3-7s: steering through the endless world
for k in range(17): at(3.1+k*0.21, "R.wait=99;window.dispatchEvent(new Event('scrollUp'))")
at(6.4, "say('The world never ends!',1.6)")
# C 7-10s: petting, a tap
at(7.0, "R.target=R.x;idle(99);R.hold=true;R.lastTouch=R.time")
at(8.6, "R.hold=false;hearts(2);startAct('spin',1.2,'Wheee!')")
at(9.8, "idle(99)")
# D 10-14s: items rolodex
at(10.0, "openPanel('items');R.prow=0")
for i,t in enumerate([10.5,11.0,11.5]): at(t, "rollTo(0,1)")
at(12.0, "R.prow=1"); at(12.3, "rollTo(1,1)")
at(12.9, "R.prow=2"); at(13.2, "rollTo(2,1)")
at(13.8, "closePanel();idle(99);say('Looking sharp?',1.5)")
# E 14-20s: scenes and styles
at(14.0, "openPanel('world');R.prow=1")
seq=['S','O','S','O','S','O','S','O','S','O','S']
for k,w in enumerate(seq):
    t=14.4+k*0.48
    at(t, "R.prow=1;rollTo(1,1)" if w=='S' else "R.prow=0;rollTo(0,1)")
at(19.85, "closePanel();idle(99)")
# F 20-24s: ball, rope
at(20.0, "S.look='aero';S.scene='desert';loadWorld();R.say=null;setMode('play',{bounces:0,cx:R.x})")
at(22.25, "R.bn=null;setMode('rope',{jumps:0})")
# G 24-27s: night, sleep
at(24.0, "S.look='ukiyoe';S.scene='night';loadWorld();S.tod=1;R.tod='night';R.sleeping=true;setMode('sleep');say('Good night…',1.6)")
# H 27-30s: morning, whistle, dressed up
at(27.0, "S.tod=0;S.look='original';S.scene='forest';loadWorld();S.hat=3;S.face=1;S.body=1;R.sleeping=false;idle(99);R.lastTouch=R.time;whistle()")

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        ctx=await b.new_context(viewport={'width':240,'height':282}, device_scale_factor=2)
        pg=await ctx.new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.clock.install(time=datetime.datetime(2026,10,3,14,30))
        await pg.goto('file:///home/user/effective-funicular/index.html')
        await pg.clock.pause_at(datetime.datetime(2026,10,3,14,31))
        for _ in range(40): await pg.clock.run_for(50)
        await pg.wait_for_function("ready && R.bg && R.sheet")
        # no version tag in the video: skip just that one text
        await pg.evaluate("(() => { const t0 = txt; txt = (s, ...a) => { if (String(s).startsWith('v' + APP_VERSION)) return; t0(s, ...a); }; })()")
        prev=0
        for f in range(N):
            for js in JS.get(f, []):
                if "S.tod=1" in js: await pg.clock.set_system_time(datetime.datetime(2026,10,3,23,10))
                if "S.tod=0;S.look='original'" in js: await pg.clock.set_system_time(datetime.datetime(2026,10,3,9,0))
                await pg.evaluate(js)
                if 'loadWorld' in js:
                    await pg.wait_for_function("R.bgKey===S.look+'-'+S.scene && R.sheetKey===S.look", timeout=5000)
            cur=round((f+1)*1000/FPS); await pg.clock.run_for(cur-prev); prev=cur
            await pg.screenshot(path=f'{OUT}/{f:04d}.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
