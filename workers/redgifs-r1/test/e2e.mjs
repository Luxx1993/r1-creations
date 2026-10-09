// UI test at 240x282 against the Node server with the mock API. Media is routed to a local WebM clip
// (Playwright's Chromium has no H.264; the R1's Android WebView does). Screenshots go to test/out/.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'test', 'out');
mkdirSync(out, { recursive: true });

// test media
const clip = join(out, 'clip.webm'), still = join(out, 'still.jpg');
if (!existsSync(clip)) execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=270x480:rate=15:duration=2', '-c:v', 'libvpx', '-b:v', '300k', '-y', clip]);
if (!existsSync(still)) execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=270x480', '-frames:v', '1', '-y', still]);
const clipBuf = readFileSync(clip), stillBuf = readFileSync(still);

const PORT = 8799, KEY = 'e2e-key', BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server/node.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(PORT), ACCESS_KEY: KEY, MOCK_API: join(root, 'test', 'mock-api.mjs') }, stdio: ['ignore', 'pipe', 'inherit'],
});
process.on('exit', () => server.kill());
await new Promise((ok) => server.stdout.once('data', ok));

const browser = await playwright.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 240, height: 282 }, deviceScaleFactor: 2, hasTouch: false });
const mediaReqs = [];
await ctx.route(/https:\/\/(media|userpic)\.redgifs\.com\/.*/, (route) => {
  const req = route.request();
  mediaReqs.push({ url: req.url(), referer: req.headers()['referer'] || null });
  const isVideo = req.url().endsWith('.mp4');
  route.fulfill({ status: 200, contentType: isVideo ? 'video/webm' : 'image/jpeg', body: isVideo ? clipBuf : stillBuf });
});
const apiReqs = [];
ctx.on('request', (r) => { if (r.url().includes('/api/')) apiReqs.push(r.url()); });

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const fire = (...names) => page.evaluate((ns) => ns.forEach((n) => window.dispatchEvent(new CustomEvent(n))), names);
const shot = (name) => page.screenshot({ path: join(out, name + '.png') });
const wait = (ms) => page.waitForTimeout(ms);
const text = (sel) => page.locator(sel).textContent();
const step = (name) => console.log('  ✓', name);
// The icon bar fades out in the feed; a first touch reveals it, a second one picks the tab.
async function openTab(p, tab) {
  if (await p.locator('#nav.idle').count()) await p.mouse.click(120, 100);
  await p.locator(`#nav button[data-tab=${tab}]`).click();
}

// --- access protection
let r = await fetch(BASE + '/');
assert.equal(r.status, 404); step('page without key -> 404');
r = await fetch(BASE + '/robots.txt'); assert.match(await r.text(), /Disallow/); step('robots.txt');

// --- feed
await page.goto(`${BASE}/?k=${KEY}&v=1`);
await page.waitForFunction(() => document.querySelector('video.on')?.dataset.ok === '1', null, { timeout: 15000 });
const layout = await page.evaluate(() => ({
  sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth,
  stage: document.getElementById('stage').getBoundingClientRect().toJSON(), nav: document.getElementById('nav').getBoundingClientRect().toJSON(),
  vid: document.querySelector('video.on').getBoundingClientRect().toJSON(), videos: document.querySelectorAll('video').length,
}));
assert.ok(layout.sh <= 282 && layout.sw <= 240, 'no overflow');
assert.deepEqual([layout.stage.top, layout.stage.height, layout.nav.height], [0, 282, 44]);
assert.deepEqual([layout.vid.left, layout.vid.top, layout.vid.width, layout.vid.height], [0, 0, 240, 282]);
assert.equal(layout.videos, 2);
assert.deepEqual(await page.evaluate(() => vids.map((v) => getComputedStyle(v).display)).then((d) => d.sort()), ['block', 'none'],
  'only the active video is rendered (the R1 WebView ignores opacity on video)');
step('layout 240x282, clip uses the full 240x282, icon bar 44 px on top, two <video> elements');
await shot('01-feed');

let st = await page.evaluate(() => ({ src: active.src, other: vids.find((v) => v !== active), objectFit: getComputedStyle(active).objectFit, muted: active.muted, loop: active.loop }));
assert.match(st.src, /Trend1-mobile\.mp4$/); assert.equal(st.objectFit, 'contain'); assert.ok(st.muted && st.loop);
const pre = await page.evaluate(() => { const o = vids.find((v) => v !== active); return { src: o.src, preload: o.preload }; });
assert.match(pre.src, /Trend2-mobile\.mp4$/); assert.equal(pre.preload, 'metadata');
step('sd URL, contain, muted+loop, next clip preloaded with preload=metadata');

// one detent = one clip, burst inside the lock is ignored
await fire('scrollDown', 'scrollDown', 'scrollDown', 'scrollDown');
assert.match(await text('#ipos'), /^2\/18\+$/);
assert.equal(await page.evaluate(() => dbg.ignored), 3);
await wait(320); await fire('scrollDown');
assert.match(await text('#ipos'), /^3\//);
await wait(320); await fire('scrollUp');
assert.match(await text('#ipos'), /^2\//);
step('scroll lock: 4 events in a burst -> +1 clip, after 150 ms the next one counts');
await shot('02-info-overlay');

// double click = two sideClicks ~50 ms apart -> one toggle
await fire('sideClick'); await wait(50); await fire('sideClick');
assert.equal(await page.evaluate(() => paused && active.paused), true);
assert.equal(await page.evaluate(() => dbg.sideDbl), 1);
await shot('03-paused');
await wait(300); await fire('sideClick');
assert.equal(await page.evaluate(() => paused), false);
step('sideClick = play/pause, double click debounced');
await page.waitForFunction(() => document.getElementById('nav').classList.contains('idle'), null, { timeout: 4000 });
assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('nav')).pointerEvents), 'none');
// tap where the hidden bar is: reveals it, does not switch tabs or toggle sound
const soundBefore = await page.evaluate(() => soundOn);
await page.mouse.click(120, 270);
assert.equal(await page.evaluate(() => screen + ':' + document.getElementById('nav').classList.contains('idle')), 'feed:false');
assert.equal(await page.evaluate(() => soundOn), soundBefore, 'revealing the bar does not toggle sound');
step('icon bar hides when idle; a tap on the hidden bar only reveals it');
await page.waitForFunction(() => document.getElementById('nav').classList.contains('idle'), null, { timeout: 4000 });
await wait(200); await fire('scrollDown');
assert.equal(await page.evaluate(() => document.getElementById('nav').classList.contains('idle') && document.getElementById('info').classList.contains('show')), true);
await wait(200); await page.mouse.move(120, 200); await page.mouse.down(); await page.mouse.move(120, 120, { steps: 4 }); await page.mouse.up();
assert.equal(await page.evaluate(() => document.getElementById('nav').classList.contains('idle')), true, 'swipe does not show the bar');
step('wheel and swipe show creator/position but keep the icon bar hidden');

// tap toggles sound only on clips with audio (Trend1 has audio, Trend2 not)
await page.evaluate(() => { curFeed.idx = 0; showItem(); });
await page.mouse.click(120, 140);
assert.equal(await page.evaluate(() => soundOn && !active.muted), true);
await page.mouse.click(120, 140);
assert.equal(await page.evaluate(() => active.muted), true);
step('tap = sound on/off');

// referer must never reach the media CDN
assert.ok(mediaReqs.length > 0 && mediaReqs.every((m) => m.referer === null), 'no referer on media requests');
step(`${mediaReqs.length} media requests, none with a Referer header`);

// --- pagination with lock=0 (fresh page)
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/?k=${KEY}&lock=0`);
await p2.waitForFunction(() => curFeed.items.length > 0);
await p2.evaluate(() => { for (let i = 0; i < 14; i++) window.dispatchEvent(new CustomEvent('scrollDown')); });
await p2.waitForFunction(() => curFeed.items.length === 36);
assert.match(await p2.locator('#ipos').textContent(), /^15\/36\+$/);
await p2.waitForFunction(() => {   // one event every poll until the end of the 3-page feed
  window.dispatchEvent(new CustomEvent('scrollDown'));
  return curFeed.done && curFeed.idx === curFeed.items.length - 1;
}, null, { timeout: 10000, polling: 30 });
assert.equal(await p2.evaluate(() => curFeed.items.length), 54);
assert.equal(await p2.evaluate(() => document.querySelectorAll('video').length), 2);
step('next page loaded within the last 5 clips; end of feed reached; still two <video>');
await p2.close();

// --- Explore: tag tiles, wheel + sideClick, history back
await openTab(page, 'explore');
await page.waitForFunction(() => document.querySelectorAll('#linner .tile').length === 11);
assert.equal(await page.evaluate(() => vids.every((v) => v.paused)), true);
await fire('scrollDown'); await fire('scrollDown');
assert.equal(await page.locator('.tile.sel .t').textContent(), 'Blonde');
await shot('04-explore');
await fire('sideClick');
await page.waitForFunction(() => document.querySelector('video.on')?.src.includes('TagBlonde1-mobile.mp4'));
assert.equal(await text('#ctx'), '#Blonde');
await shot('05-tag-feed');
await page.goBack();
await page.waitForFunction(() => screen === 'list');
assert.equal(await page.locator('.tile.sel .t').textContent(), 'Blonde');
step('Explore: wheel selects, sideClick opens tag feed, back returns to the list');

// --- Niches: thumbnails, paging, open
await openTab(page, 'niches');
await page.waitForFunction(() => document.querySelectorAll('#linner .tile img').length === 20);
await shot('06-niches');
for (let i = 0; i < 16; i++) await fire('scrollDown');
await page.waitForFunction(() => document.querySelectorAll('#linner .tile').length === 40);
await wait(250);   // transform transition
const sel = await page.locator('.tile.sel').boundingBox();
assert.ok(sel.y >= 22 && sel.y + sel.height <= 238, 'selected tile visible');
await fire('sideClick');
await page.waitForFunction(() => document.querySelector('#ctx').textContent === 'Niche 17');
assert.ok(apiReqs.some((u) => u.includes('/api/niche?id=niche-1-16')));
step('Niches: thumbnails, next page while scrolling, selection stays visible, opens niche feed');

// --- text search via long press (no CreationVoiceHandler on desktop -> textarea)
await openTab(page, 'home');
await page.keyboard.down('Space'); await wait(100); await page.keyboard.up('Space');
await page.waitForFunction(() => screen === 'search' && document.activeElement.id === 'q');
await page.keyboard.type('blo');
await shot('07-search');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelector('#ctx').textContent === '#Blonde' && document.querySelector('video.on')?.dataset.ok === '1');
step('Space hold -> search field focused, "blo" -> #Blonde feed');
await openTab(page, 'home');

// --- voice search via CreationVoiceHandler stub, double delivery guarded
await page.evaluate(() => { window.__vh = []; window.CreationVoiceHandler = { postMessage: (m) => window.__vh.push(m) }; });
await fire('longPressStart');
assert.equal(await page.locator('#voice').isVisible(), true);
await shot('08-voice');
await fire('longPressEnd');
const before = apiReqs.filter((u) => u.includes('q=cosplay')).length;
await page.evaluate(() => { onPluginMessage({ type: 'sttEnded', transcript: 'cosplay' }); onPluginMessage({ type: 'sttEnded', transcript: 'cosplay' }); });
await page.waitForFunction(() => document.querySelector('#ctx').textContent === '#Cosplay');
assert.deepEqual(await page.evaluate(() => window.__vh), ['start', 'stop']);
assert.equal(apiReqs.filter((u) => u.includes('q=cosplay')).length - before, 1);
assert.equal(await page.locator('#voice').isVisible(), false);
step('voice: start/stop sent, transcript searched once despite double delivery');

// --- network error + retry with the side button, debug overlay
const p3 = await ctx.newPage();
await p3.route('**/api/trending*', (route) => route.abort());
await p3.goto(`${BASE}/?k=${KEY}&debug=1`);
await p3.waitForFunction(() => document.getElementById('status').classList.contains('err'));
assert.match(await p3.locator('#stxt').textContent(), /Netzwerkfehler/);
assert.match(await p3.locator('#dbg').textContent(), /lock 150ms/);
await p3.screenshot({ path: join(out, '09-error-debug.png') });
await p3.unroute('**/api/trending*');
await p3.evaluate(() => window.dispatchEvent(new CustomEvent('sideClick')));
await p3.waitForFunction(() => document.querySelector('video.on')?.dataset.ok === '1');
step('network error shown, side button retries, debug overlay visible');
await p3.close();

// --- install page
// qrcode.js comes from cdnjs; fetch it with curl (honours the outbound proxy) and hand it to the page.
// The <script> keeps its SRI hash, so a wrong file would still be rejected.
const qrUrl = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
let qrLib = null;
try { qrLib = execFileSync('curl', ['-sSf', '--max-time', '20', qrUrl]); } catch { /* offline: page shows its own error */ }
const p4 = await ctx.newPage();
await p4.setViewportSize({ width: 420, height: 800 });
await p4.route(qrUrl, (route) => qrLib ? route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: qrLib }) : route.abort());
await p4.goto(`${BASE}/install?k=${KEY}`);
const payload = JSON.parse(await p4.locator('#json').textContent());
assert.deepEqual(Object.keys(payload), ['title', 'url', 'description', 'iconUrl', 'themeColor']);
assert.equal(payload.url, `${BASE}/?k=${KEY}&v=6`);
assert.equal(payload.themeColor, '#FF2D20');
await p4.waitForSelector('#qr img, #qr canvas', { timeout: 10000 }).catch(() => {});
await p4.screenshot({ path: join(out, '10-install.png'), fullPage: true });
if (qrLib) assert.equal(await p4.locator('#qr canvas').count(), 1, 'QR rendered (SRI ok)');
step('install page payload ' + (await p4.locator('#qr canvas').count() ? '+ QR rendered' : '(QR lib not reachable)'));

assert.deepEqual(errors, []);
await browser.close();
server.kill();
console.log('e2e: all checks passed, screenshots in test/out/');
