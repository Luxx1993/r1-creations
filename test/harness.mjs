/**
 * Todoist creation - functional harness
 *
 * Drives the real index.html in headless Chrome against a mock Todoist API v1:
 * setup and connection test, reading (Heute, Eingang, Browsen, Projekt, Suchen),
 * the R1 button map, voice -> review -> send, text add, edit, complete + undo,
 * read aloud, the offline queue, rejected writes and token hygiene. Also takes
 * 240x282 screenshots into screenshots/ and checks the optional Vercel proxy.
 *
 *   node test/harness.mjs            (Node 22+, Chrome/Chromium; set CHROME=... if needed)
 *
 * No npm packages, no network: Node's http plus CDP over the global WebSocket.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'screenshots');
const STATIC_PORT = 8121;
const MOCK_PORT = 8788;
const PROXY_PORT = 8789;
const CDP_PORT = 9231;
const BASE = `http://127.0.0.1:${MOCK_PORT}/api/v1`;
const TOKEN = 'test0123456789abcdef0123456789abcdef0123';

// ── Mock Todoist API v1 ─────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

let mode = 'ok';           // ok | down | nocors | reject401 | reject400
const log = [];            // every request the app made
let nextId = 1000;
const projects = [
  { id: '100', name: 'Inbox', color: 'charcoal', inbox_project: true, child_order: 0, is_archived: false, is_deleted: false, parent_id: null },
  { id: '200', name: 'Arbeit', color: 'blue', inbox_project: false, child_order: 1, is_archived: false, is_deleted: false, parent_id: null },
  { id: '300', name: 'Privat', color: 'green', inbox_project: false, child_order: 2, is_archived: false, is_deleted: false, parent_id: null },
  { id: '310', name: 'Garten', color: 'lime_green', inbox_project: false, child_order: 0, is_archived: false, is_deleted: false, parent_id: '300' }
];
const T = (content, project_id, off, priority = 1, extra = {}) => ({
  id: String(++nextId), content, project_id, priority, child_order: nextId, day_order: 0, parent_id: null, checked: false,
  due: off == null ? null : { date: day(off), is_recurring: false, string: '', lang: 'de' }, ...extra
});
let tasks = [
  T('Bosch Angebote DDC Austausch beauftragen', '200', -12),
  T('Auftrag Bruch Graben fertig machen', '200', -12),
  T('Angebot Rlt-Anlage PPELT Lagrange beauftragten.', '200', -9),
  T('Vergabe bosch ugm gfa', '200', -12),
  T('WIKO Eintragungen machen', '200', null),
  T('Türen GFA beauftragen', '200', -12),
  T('Ausweichküche Böls beauftragen', '200', null),
  T('Rückruf Elektriker wegen Zählerschrank', '100', 0, 4),
  T('Reifenwechsel Termin machen', '100', 1, 3),
  T('Steuerunterlagen sortieren', '100', 5, 2),
  T('Idee: R1 Creation für Einkaufsliste', '100', null),
  T('Laufschuhe zurückschicken', '300', 0, 1, { due: { date: day(0) + 'T17:30:00', is_recurring: false, string: 'heute 17:30' } }),
  T('Rasen mähen', '310', 2, 1, { due: { date: day(2), is_recurring: true, string: 'jeden Samstag' } })
];
const closed = [];

function send(res, status, body, cors = true) {
  const h = { 'Content-Type': 'application/json' };
  if (cors) Object.assign(h, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  res.writeHead(status, h);
  res.end(body == null ? '' : JSON.stringify(body));
}
function page(rows, url) {
  // deliberately tiny pages so the app's cursor loop is exercised
  const size = 4, start = Number(url.searchParams.get('cursor') || 0);
  const next = start + size < rows.length ? String(start + size) : null;
  return { results: rows.slice(start, start + size), next_cursor: next };
}

const mock = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  const nocors = mode === 'nocors';
  if (req.method === 'OPTIONS') { if (mode === 'down') return req.socket.destroy(); return send(res, 204, null, !nocors); }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const p = url.pathname.replace(/^\/api\/v1\//, '');
    let json = null; try { json = body ? JSON.parse(body) : null; } catch { json = null; }
    log.push({ method: req.method, path: p, url: req.url, body: json, auth: req.headers.authorization || '' });
    if (mode === 'down') return req.socket.destroy();
    if (req.headers.authorization !== `Bearer ${TOKEN}` || mode === 'reject401') return send(res, 401, { error: 'Unauthorized' }, !nocors);
    if (mode === 'reject400' && req.method === 'POST') return send(res, 400, { error: 'Bad request' }, !nocors);
    const ok = (s, b) => send(res, s, b, !nocors);
    if (req.method === 'GET' && p === 'projects') return ok(200, page(projects, url));
    if (req.method === 'GET' && p === 'tasks') {
      const pid = url.searchParams.get('project_id');
      return ok(200, page(tasks.filter((t) => !pid || t.project_id === pid), url));
    }
    if (req.method === 'GET' && p === 'tasks/filter') {
      if (url.searchParams.get('query') !== 'today | overdue') return ok(400, { error: 'unexpected filter' });
      return ok(200, page(tasks.filter((t) => t.due && t.due.date.slice(0, 10) <= day(0)), url));
    }
    if (req.method === 'POST' && p === 'tasks/quick') {
      let text = String(json && json.text || '');
      let project_id = '100', due = null;
      const m = text.match(/(^|\s)#(\S+)/);
      if (m) { const pr = projects.find((x) => x.name.toLowerCase() === m[2].toLowerCase()); if (pr) project_id = pr.id; text = text.replace(m[0], ' '); }
      if (/\bmorgen\b/i.test(text)) { due = { date: day(1), is_recurring: false, string: 'morgen' }; text = text.replace(/\bmorgen\b/i, ' '); }
      const t = T(text.replace(/\s+/g, ' ').trim(), project_id, null);
      t.due = due; tasks.push(t);
      return ok(200, t);
    }
    let mm;
    if (req.method === 'POST' && (mm = p.match(/^tasks\/(\w+)\/(close|reopen|move)$/))) {
      const [, id, act] = mm;
      if (act === 'close') { const i = tasks.findIndex((t) => t.id === id); if (i < 0) return ok(404, { error: 'not found' }); closed.push(tasks.splice(i, 1)[0]); return ok(204, null); }
      if (act === 'reopen') { const i = closed.findIndex((t) => t.id === id); if (i >= 0) tasks.push(closed.splice(i, 1)[0]); return ok(204, null); }
      const t = tasks.find((x) => x.id === id); if (!t) return ok(404, { error: 'not found' });
      t.project_id = json.project_id; return ok(200, t);
    }
    if (req.method === 'POST' && (mm = p.match(/^tasks\/(\w+)$/))) {
      const t = tasks.find((x) => x.id === mm[1]); if (!t) return ok(404, { error: 'not found' });
      if (json && json.content) t.content = json.content; return ok(200, t);
    }
    ok(404, { error: 'no route ' + p });
  });
});

// ── static files ────────────────────────────────────────────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png' };
const statics = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

// ── CDP ─────────────────────────────────────────────────────────────────────
const CHROME = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  .find((p) => p && fs.existsSync(p));
let msgId = 0;
function rpc(ws, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== id) return;
      ws.removeEventListener('message', onMsg);
      m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
let WS, chrome = null;
process.on('exit', () => { try { chrome && chrome.kill(); } catch {} });
async function ev(expr) {
  const r = await rpc(WS, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expr, label, timeout = 6000) {
  const t0 = Date.now();
  for (;;) {
    if (await ev(`!!(${expr})`)) return;
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for ${label}: ${expr}`);
    await sleep(50);
  }
}
// real mouse input -> real pointer events (no synthetic PointerEvent objects)
async function rect(sel) {
  const r = await ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; var b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2};})()`);
  if (!r) throw new Error('no element ' + sel);
  return r;
}
async function press(sel, holdMs = 0) {
  const { x, y } = await rect(sel);
  await rpc(WS, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  if (holdMs) await sleep(holdMs);
  await rpc(WS, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(60);
}
const tap = (sel) => press(sel, 0);
async function type(text) { await rpc(WS, 'Input.insertText', { text }); await sleep(30); }
async function shot(name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  try { await until(`!document.getElementById('toast').classList.contains('on')`, 'toast gone', 4000); } catch {}
  await sleep(300);
  const r = await rpc(WS, 'Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 240, height: 282, scale: 1 } });
  fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
  if (process.env.SHOTS_2X) {
    const r2 = await rpc(WS, 'Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 240, height: 282, scale: 3 } });
    fs.writeFileSync(path.join(process.env.SHOTS_2X, name + '@3x.png'), Buffer.from(r2.data, 'base64'));
  }
}

// ── R1 stubs, backed by localStorage so a reload is an honest restart ───────
const STUBS = `
window.__r1 = { voice: [], llm: [] };
window.CreationVoiceHandler = { postMessage: function (m) { window.__r1.voice.push(m); } };
window.PluginMessageHandler = { postMessage: function (m) { try { window.__r1.llm.push(JSON.parse(m)); } catch (e) {} } };
function mk(prefix) { return {
  setItem: function (k, v) { localStorage.setItem(prefix + k, v); return Promise.resolve(); },
  getItem: function (k) { return Promise.resolve(localStorage.getItem(prefix + k)); },
  removeItem: function (k) { localStorage.removeItem(prefix + k); return Promise.resolve(); },
  clear: function () { return Promise.resolve(); } }; }
window.creationStorage = { secure: mk('__sec_'), plain: mk('__pln_') };
window.__fire = function (n) { window.dispatchEvent(new Event(n)); };
window.__scr = function () { var e = document.querySelector('.scr.vis'); return e ? e.id.slice(2) : 'main'; };
window.__titles = function () { return [].map.call(document.querySelectorAll('#list .card .ttl'), function (e) { return e.textContent; }); };
window.__sel = function () { var e = document.querySelector('#list .card.sel .ttl'); return e ? e.textContent : null; };
window.__q = function () { var r = localStorage.getItem('__pln_todoist_queue'); if (!r) return []; return JSON.parse(decodeURIComponent(escape(atob(r)))).ops; };
`;

// ── assertions ──────────────────────────────────────────────────────────────
let pass = 0; const fails = [];
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); } else { fails.push(label); console.log(`  FAIL  ${label}${detail ? ' -> ' + detail : ''}`); }
}
const eq = (label, a, b) => check(label, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const since = (n) => log.slice(n).map((r) => r.method + ' ' + r.path);

// ── run ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!CHROME) throw new Error('No Chrome/Chromium found (set CHROME=/path/to/chrome).');
  await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));
  await new Promise((r) => statics.listen(STATIC_PORT, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'r1todo-'));
  chrome = spawn(CHROME, [`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--disable-extensions', '--no-sandbox', '--hide-scrollbars', '--window-size=240,282', 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json(); const pg = l.find((t) => t.type === 'page'); if (pg) wsUrl = pg.webSocketDebuggerUrl; } catch {}
    if (!wsUrl) await sleep(150);
  }
  if (!wsUrl) throw new Error('Chrome debugger never came up.');
  WS = new WebSocket(wsUrl);
  await new Promise((r, j) => { WS.onopen = r; WS.onerror = j; });
  await rpc(WS, 'Runtime.enable'); await rpc(WS, 'Page.enable');
  await rpc(WS, 'Emulation.setDeviceMetricsOverride', { width: 240, height: 282, deviceScaleFactor: 1, mobile: false });
  await rpc(WS, 'Page.addScriptToEvaluateOnNewDocument', { source: STUBS });
  let nav = 0;
  const open = async () => {
    await rpc(WS, 'Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/index.html?n=${++nav}` });
    await sleep(400);
    await until(`document.readyState === 'complete' && window.__scr`, 'load');
    await sleep(200);
  };

  // 1 ── first run
  console.log('\n[1] First run: setup, connection test');
  await open();
  eq('opens on the setup screen', await ev('__scr()'), 'setup');
  check('demo data is visible behind setup', (await ev('__titles()')).length > 0);
  await ev(`document.getElementById('st-base').value = 'http://example.com/api/v1'; document.getElementById('st-token').value = 'x'`);
  await tap('#st-test');
  check('refuses a non-https API URL', (await ev(`document.getElementById('st-msg').textContent`)).includes('https://'));
  await ev(`document.getElementById('st-base').value = ${JSON.stringify(BASE)}; document.getElementById('st-token').value = 'wrong-token'`);
  await tap('#st-test');
  await until(`document.getElementById('st-msg').textContent.indexOf('401') >= 0`, '401 message');
  check('test shows 401 for a bad token', true);
  mode = 'nocors';
  await ev(`document.getElementById('st-token').value = ${JSON.stringify(TOKEN)}`);
  await tap('#st-test');
  await until(`document.getElementById('st-msg').textContent.indexOf('CORS') >= 0`, 'CORS message');
  check('test reports Netz/CORS when the API sends no CORS headers', true);
  mode = 'ok';
  await tap('#st-test');
  await until(`document.getElementById('st-msg').textContent.indexOf('OK') === 0`, 'OK message');
  check('test shows OK with a good token', (await ev(`document.getElementById('st-msg').textContent`)).includes('4 Projekte'));
  await shot('setup');
  await ev(`window.__fire('sideClick')`);   // side button saves on setup
  await until(`__scr() === 'main'`, 'main after save');
  eq('side button saves and closes setup', await ev('__scr()'), 'main');

  // 2 ── Heute
  console.log('\n[2] Heute (filter "today | overdue")');
  await until(`document.getElementById('title').textContent === 'Heute' && __titles().length === 7`, 'today list', 8000);
  const today = await ev('__titles()');
  eq('overdue first, oldest date first', today.slice(0, 3), ['Bosch Angebote DDC Austausch beauftragen', 'Auftrag Bruch Graben fertig machen', 'Vergabe bosch ugm gfa']);
  check('today tasks after overdue, P1 first', today[5] === 'Rückruf Elektriker wegen Zählerschrank', JSON.stringify(today));
  check('used the filter endpoint', log.some((r) => r.path === 'tasks/filter' && r.url.includes('query=today+%7C+overdue')));
  check('followed next_cursor pages', log.filter((r) => r.path === 'tasks/filter').length >= 2);
  const meta = await ev(`[].map.call(document.querySelectorAll('#list .meta .d'), function(e){return e.className + '|' + e.textContent;})`);
  check('overdue date in coral, German short form', meta.some((m) => m.startsWith('d over|') && /\d+ (Sept|Okt|Aug|Nov)/.test(m)), JSON.stringify(meta));
  check('today label green with time', meta.includes('d today|Heute 17:30'), JSON.stringify(meta));
  const prio = await ev(`getComputedStyle(document.querySelectorAll('#list .chk')[5]).borderTopColor`);
  eq('P1 circle is red', prio, 'rgb(255, 112, 102)');
  check('project name shown on the right', (await ev(`document.querySelector('#list .proj').textContent`)) === 'Arbeit');
  check('auth only in the header, never in a URL', log.every((r) => !r.url.includes(TOKEN)) && log.some((r) => r.auth === `Bearer ${TOKEN}`));
  await shot('heute');

  // 3 ── Eingang
  console.log('\n[3] Eingang');
  await tap('.tab[data-view="inbox"]');
  await until(`document.getElementById('title').textContent === 'Eingang' && __titles().length === 4`, 'inbox');
  eq('inbox tasks in order', await ev('__titles()'), ['Rückruf Elektriker wegen Zählerschrank', 'Reifenwechsel Termin machen', 'Steuerunterlagen sortieren', 'Idee: R1 Creation für Einkaufsliste']);
  check('Eingang tab active', await ev(`document.querySelector('.tab[data-view="inbox"]').classList.contains('on')`));
  check('inbox read via project_id', log.some((r) => r.path === 'tasks' && r.url.includes('project_id=100')));
  await shot('eingang');

  // 4 ── Browsen + Projekt
  console.log('\n[4] Browsen -> Projekt');
  await tap('.tab[data-view="browse"]');
  await until(`document.querySelectorAll('#list .prow').length === 3`, 'projects');
  eq('projects without the inbox, subprojects nested', await ev('__titles()'), ['Arbeit', 'Privat', 'Garten']);
  await until(`document.querySelector('#list .prow .cnt') && document.querySelector('#list .prow .cnt').textContent === '7'`, 'counts');
  check('open task count per project', true);
  await shot('browsen');
  await ev(`__fire('scrollDown')`);
  eq('wheel selects the first project', await ev('__sel()'), 'Arbeit');
  await ev(`__fire('sideClick')`);
  await until(`document.getElementById('title').textContent === 'Arbeit' && __titles().length === 7`, 'project view');
  check('side button opens the project', true);
  check('back arrow shown in project view', await ev(`document.getElementById('back').classList.contains('on')`));
  check('Browsen tab stays active', await ev(`document.querySelector('.tab[data-view="browse"]').classList.contains('on')`));
  eq('project tasks in Todoist order', (await ev('__titles()'))[0], 'Bosch Angebote DDC Austausch beauftragen');
  await shot('projekt');

  // 5 ── wheel + side button complete, undo
  console.log('\n[5] Complete with the side button, undo');
  await ev(`__fire('scrollDown')`); await ev(`__fire('scrollDown')`);
  eq('wheel moves the selection', await ev('__sel()'), 'Auftrag Bruch Graben fertig machen');
  let n0 = log.length;
  await ev(`__fire('sideClick'); setTimeout(function(){ __fire('sideClick'); }, 50)`);
  await sleep(120);
  check('strike-through animation runs', await ev(`!!document.querySelector('#list .card.done')`));
  check('undo bar visible', await ev(`document.getElementById('undo').classList.contains('on')`));
  await until(`__titles().length === 6`, 'card removed');
  await sleep(300);
  eq('a PTT double click completes only one task', since(n0).filter((s) => s.endsWith('/close')).length, 1);
  eq('selection moved to the next task', await ev('__sel()'), 'Angebot Rlt-Anlage PPELT Lagrange beauftragten.');
  n0 = log.length;
  await tap('#undo-btn');
  await until(`__titles().length === 7`, 'task back');
  await sleep(300);
  check('undo sends reopen', since(n0).some((s) => /tasks\/\d+\/reopen/.test(s)), JSON.stringify(since(n0)));
  check('undo bar hidden again', !(await ev(`document.getElementById('undo').classList.contains('on')`)));
  // tap the circle
  n0 = log.length;
  await tap('#list .card:nth-child(3) .hit');
  await until(`__titles().length === 6`, 'tap complete');
  check('tapping the circle completes', since(n0).some((s) => s.endsWith('/close')));
  eq('the right task left the list', (await ev('__titles()')).includes('Angebot Rlt-Anlage PPELT Lagrange beauftragten.'), false);
  await sleep(UNDO());

  // 6 ── voice add in the project
  console.log('\n[6] PTT -> review -> send');
  await ev(`__r1.voice = []; __fire('longPressStart')`);
  eq('hold shows the listening screen', await ev('__scr()'), 'listen');
  eq('voice bridge started', await ev('__r1.voice'), ['start']);
  await ev(`__fire('longPressEnd')`);
  eq('release stops the bridge', await ev('__r1.voice'), ['start', 'stop']);
  await ev(`onPluginMessage({ type: 'sttEnded', transcript: 'Angebot Heizung prüfen morgen' })`);
  await until(`__scr() === 'review'`, 'review');
  eq('transcript in the review box', await ev(`document.getElementById('rv-text').value`), 'Angebot Heizung prüfen morgen');
  check('SENDEN preselected', await ev(`document.getElementById('ch-send').classList.contains('sel')`));
  check('target is the project', (await ev(`document.getElementById('rv-target').textContent`)).includes('#Arbeit'));
  await shot('review');
  await ev(`__fire('scrollDown'); __fire('scrollDown'); __fire('scrollDown')`);
  check('wheel clamps at VERWERFEN', await ev(`document.getElementById('ch-discard').classList.contains('sel')`));
  await ev(`__fire('scrollUp'); __fire('scrollUp')`);
  n0 = log.length;
  await ev(`__fire('sideClick')`);
  await until(`__scr() === 'main'`, 'main after send');
  await until(`__titles().indexOf('Angebot Heizung prüfen') >= 0`, 'new task synced', 6000);
  const qa = log.slice(n0).find((r) => r.path === 'tasks/quick');
  eq('Quick Add got the spoken text', qa && qa.body, { text: 'Angebot Heizung prüfen morgen' });
  check('moved into the open project', log.slice(n0).some((r) => /\/move$/.test(r.path) && r.body && r.body.project_id === '200'));
  check('date parsed by Todoist shows as Morgen', (await ev(`document.querySelector('#list .card.sel .meta').textContent`)).includes('Morgen'));
  // discard path
  await ev(`__fire('longPressStart'); __fire('longPressEnd'); onPluginMessage({ type: 'sttEnded', transcript: 'Wegwerfen' })`);
  await until(`__scr() === 'review'`, 'review 2');
  await tap('#ch-discard');
  eq('VERWERFEN returns without sending', await ev('__scr()'), 'main');
  check('nothing queued after discard', !(await ev(`__q().some(function(o){return o.text === 'Wegwerfen';})`)));
  await ev(`__fire('longPressStart'); __fire('longPressEnd'); onPluginMessage({ type: 'sttEnded', transcript: '' })`);
  await until(`__scr() === 'main'`, 'empty transcript');
  check('empty transcript goes back to the list', true);

  // 7 ── text add via plus, edit via second tap
  console.log('\n[7] Plus = text, second tap = edit');
  await tap('.tab[data-view="inbox"]');
  await until(`document.getElementById('title').textContent === 'Eingang'`, 'inbox');
  await tap('#plus');
  eq('plus opens the text editor', await ev('__scr()'), 'edit');
  check('textarea focused (keyboard opens)', await ev(`document.activeElement === document.getElementById('ed-text')`));
  await type('Paket abholen');
  n0 = log.length;
  await tap('#ed-save');
  await until(`__titles().indexOf('Paket abholen') >= 0 && __q().length === 0`, 'text add synced');
  check('typed task sent through Quick Add', log.slice(n0).some((r) => r.path === 'tasks/quick' && r.body.text === 'Paket abholen'));
  check('no move in the inbox', !log.slice(n0).some((r) => /\/move$/.test(r.path)));
  await tap('#list .card:nth-child(2) .ttl');
  eq('first tap selects', await ev('__sel()'), 'Reifenwechsel Termin machen');
  await tap('#list .card:nth-child(2) .ttl');
  eq('second tap opens the editor', await ev('__scr()'), 'edit');
  eq('editor holds the task text', await ev(`document.getElementById('ed-text').value`), 'Reifenwechsel Termin machen');
  await ev(`document.getElementById('ed-text').value = 'Reifenwechsel Termin machen (Winter)'`);
  n0 = log.length;
  await ev(`__fire('sideClick')`);
  await until(`__titles().indexOf('Reifenwechsel Termin machen (Winter)') >= 0`, 'edited');
  await until(`__q().length === 0`, 'edit synced');
  check('edit sent as content update', log.slice(n0).some((r) => /^tasks\/\d+$/.test(r.path) && r.body.content === 'Reifenwechsel Termin machen (Winter)'));
  await tap('#plus');
  await tap('#ed-cancel');
  eq('Abbrechen closes the editor', await ev('__scr()'), 'main');
  // hold plus = voice
  await ev(`__r1.voice = []`);
  const pr = await rect('#plus');
  await rpc(WS, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: pr.x, y: pr.y, button: 'left', clickCount: 1 });
  await sleep(700);
  eq('holding plus starts voice', await ev('__scr()'), 'listen');
  await rpc(WS, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: pr.x, y: pr.y, button: 'left', clickCount: 1 });
  await sleep(80);
  eq('releasing plus stops voice', await ev('__r1.voice'), ['start', 'stop']);
  await ev(`onPluginMessage({ type: 'sttEnded', transcript: 'Plus Diktat' })`);
  await until(`__scr() === 'review'`, 'review from plus');
  await tap('#ch-discard');

  // 8 ── read aloud
  console.log('\n[8] Vorlesen');
  await ev(`__r1.llm = []`);
  await tap('#speak');
  const llm = await ev('__r1.llm');
  eq('one LLM request', llm.length, 1);
  check('useLLM + wantsR1Response', llm[0] && llm[0].useLLM === true && llm[0].wantsR1Response === true);
  check('prompt pins the wording', llm[0] && llm[0].message.startsWith('Sprich genau diesen Text, ohne Zusätze'), llm[0] && llm[0].message);
  check('reads list title and tasks', llm[0] && llm[0].message.includes('Eingang, 5 Aufgaben. Eins: Rückruf Elektriker'), llm[0] && llm[0].message);
  await tap('.tab[data-view="today"]');
  await until(`document.getElementById('title').textContent === 'Heute'`, 'today');
  for (let i = 0; i < 3; i++) tasks.push(T('Extra ' + i, '100', 0));
  await ev(`__r1.llm = []`); await tap('#sync');
  await until(`__titles().length >= 9`, 'extras');
  await tap('#speak');
  const said = (await ev('__r1.llm'))[0].message;
  check('at most 8 tasks are read', said.includes('Acht:') && !said.includes('Neun'), said);

  // 9 ── search
  console.log('\n[9] Suchen');
  await tap('.tab[data-view="search"]');
  check('search field focused', await ev(`document.activeElement === document.getElementById('q')`));
  await type('bosch');
  await until(`__titles().length === 2`, 'search results');
  eq('local search over all open tasks', (await ev('__titles()')).sort(), ['Bosch Angebote DDC Austausch beauftragen', 'Vergabe bosch ugm gfa']);
  await shot('suchen');
  await ev(`document.getElementById('q').blur(); __fire('longPressStart'); __fire('longPressEnd'); onPluginMessage({ type: 'sttEnded', transcript: 'Rasen' })`);
  await until(`document.getElementById('q').value === 'Rasen' && __titles().length === 1`, 'dictated search');
  check('PTT dictates the search term', (await ev('__titles()'))[0] === 'Rasen mähen');
  await tap('#back');
  eq('back leaves search', await ev(`document.getElementById('title').textContent`), 'Heute');

  // 10 ── offline queue
  console.log('\n[10] Offline queue');
  mode = 'down';
  await until(`__titles().length > 0`, 'list');
  const victim = (await ev('__titles()'))[0];
  await ev(`__fire('scrollDown')`); await sleep(450); await ev(`__fire('sideClick')`);
  await sleep(UNDO());
  await tap('.tab[data-view="inbox"]');
  await tap('#plus'); await type('Offline Aufgabe'); await tap('#ed-save');
  await until(`__q().length === 2`, 'two queued', 8000);
  await until(`document.getElementById('qcount').textContent === '2'`, 'badge');
  check('badge shows 2 waiting', true);
  check('pending add visible with marker', await ev(`[].some.call(document.querySelectorAll('#list .card'), function(c){ return c.textContent.indexOf('Offline Aufgabe') >= 0 && c.textContent.indexOf('wartet') >= 0; })`));
  await open();
  eq('queue survives a restart', (await ev('__q()')).map((o) => o.type), ['close', 'add']);
  await until(`document.getElementById('qcount').textContent === '2'`, 'badge after restart');
  check('badge restored after restart', true);
  check('completed task stays hidden after restart', !(await ev('__titles()')).includes(victim) || (await ev(`document.getElementById('title').textContent`)) !== 'Heute');
  mode = 'ok';
  n0 = log.length;
  await ev(`window.dispatchEvent(new Event('online'))`);
  await until(`__q().length === 0`, 'queue drained', 8000);
  const drained = since(n0).filter((s) => s.startsWith('POST'));
  check('drained in order: close, then add', drained[0].endsWith('/close') && drained[1] === 'POST tasks/quick', JSON.stringify(drained));
  eq('no duplicate adds', tasks.filter((t) => t.content === 'Offline Aufgabe').length, 1);
  check('badge cleared', !(await ev(`document.getElementById('qcount').classList.contains('on')`)));

  // 11 ── rejected
  console.log('\n[11] Rejected writes stay queued');
  mode = 'reject401';
  await tap('#plus'); await type('Abgelehnt'); await tap('#ed-save');
  await until(`document.getElementById('sync').className === 'bad'`, 'error dot');
  eq('401 keeps the task in the queue', (await ev('__q()')).length, 1);
  mode = 'reject400';
  await tap('#sync');
  await sleep(500);
  eq('400 keeps it too', (await ev('__q()')).length, 1);
  check('error is shown', (await ev(`document.getElementById('toast').textContent`)).length > 0);
  mode = 'ok';
  await tap('#sync');
  await until(`__q().length === 0`, 'sent after fix');
  check('sent once the API accepts it', tasks.some((t) => t.content === 'Abgelehnt'));

  // 12 ── token hygiene, hold for setup
  console.log('\n[12] Token storage, hold for setup');
  const secure = await ev(`localStorage.getItem('__sec_todoist_cfg')`);
  check('token lives in creationStorage.secure', !!secure && JSON.parse(Buffer.from(secure, 'base64').toString('utf8')).token === TOKEN);
  const plainDump = await ev(`Object.keys(localStorage).filter(function(k){return k.indexOf('__sec_')!==0;}).map(function(k){var v=localStorage.getItem(k); try{return k+'='+decodeURIComponent(escape(atob(v)));}catch(e){return k+'='+v;}}).join('\\n')`);
  check('token nowhere in plain storage', !plainDump.includes(TOKEN));
  check('token never in a request URL', log.every((r) => !r.url.includes(TOKEN)));
  await press('#title', 1150);
  eq('holding the screen ~1 s opens setup', await ev('__scr()'), 'setup');
  check('setup prefilled with the saved API URL', (await ev(`document.getElementById('st-base').value`)) === BASE);
  await tap('#st-close');

  // 13 ── layout
  console.log('\n[13] Layout');
  const fit = await ev(`(function(){ return { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }; })()`);
  eq('page fits 240x282 without scrolling', fit, { w: 240, h: 282 });
  const hdrTop = await ev(`document.getElementById('hdr').getBoundingClientRect().top`);
  check('282 px webview (R1 bar above it): header at the very top', hdrTop <= 2, String(hdrTop));
  // a taller webview means the OS bar lies over the page: keep that strip free
  await rpc(WS, 'Emulation.setDeviceMetricsOverride', { width: 240, height: 320, deviceScaleFactor: 1, mobile: false });
  await sleep(200);
  const tall = await ev(`({ hdr: document.getElementById('hdr').getBoundingClientRect().top, nav: document.getElementById('nav').getBoundingClientRect().bottom })`);
  eq('320 px webview: 38 px kept free on top, nav at the bottom', tall, { hdr: 40, nav: 320 });
  await rpc(WS, 'Emulation.setDeviceMetricsOverride', { width: 240, height: 282, deviceScaleFactor: 1, mobile: false });
  await sleep(200);

  // 14 ── demo mode
  console.log('\n[14] Demo mode');
  await ev('localStorage.clear()');
  await open();
  await tap('#st-demo');
  await until(`__scr() === 'main' && document.getElementById('demo-tag').classList.contains('on')`, 'demo');
  await tap('.tab[data-view="browse"]');
  await until(`__titles().indexOf('Arbeit') >= 0`, 'demo projects');
  await tap('#list .card:nth-child(1)');
  await until(`document.getElementById('title').textContent === 'Arbeit' && __titles().length === 7`, 'demo project');
  check('demo shows the tasks from the design reference', (await ev('__titles()'))[6] === 'Ausweichküche Böls beauftragen');
  await shot('demo-projekt');
  const before = log.length;
  await ev(`__fire('scrollDown')`); await ev(`__fire('sideClick')`);
  await until(`__titles().length === 6`, 'demo complete');
  eq('demo never calls the API', log.length, before);

  // 15 ── proxy
  console.log('\n[15] Vercel proxy (optional)');
  await testProxy();

  WS.close(); chrome.kill(); mock.close(); statics.close();
  console.log(`\n${'='.repeat(52)}\n  ${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log('  Failures:'); fails.forEach((f) => console.log('    - ' + f)); }
  console.log('='.repeat(52));
  process.exit(fails.length ? 1 : 0);
}
function UNDO() { return 5300; }

async function testProxy() {
  process.env.TODOIST_UPSTREAM = BASE + '/';
  process.env.ALLOWED_ORIGINS = 'https://luxx1993.github.io';
  const { default: handler } = await import(path.join(ROOT, 'proxy/api/todoist.js'));
  // minimal Vercel-style req/res adapter
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const m = url.pathname.match(/^\/api\/v1\/(.*)$/);
    const query = Object.fromEntries(url.searchParams); if (m) query.path = m[1];
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => {
      req.query = query; req.body = body ? JSON.parse(body) : undefined;
      res.status = (s) => { res.statusCode = s; return res; };
      res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      res.send = (t) => res.end(t);
      handler(req, res);
    });
  });
  await new Promise((r) => server.listen(PROXY_PORT, '127.0.0.1', r));
  const P = `http://127.0.0.1:${PROXY_PORT}/api/v1`;
  const pre = await fetch(P + '/tasks', { method: 'OPTIONS', headers: { Origin: 'https://luxx1993.github.io' } });
  check('proxy answers the preflight with CORS headers', pre.status === 204 && pre.headers.get('access-control-allow-origin') === 'https://luxx1993.github.io'
    && /Authorization/.test(pre.headers.get('access-control-allow-headers')));
  const r1 = await fetch(P + '/tasks/filter?query=' + encodeURIComponent('today | overdue'), { headers: { Authorization: 'Bearer ' + TOKEN, Origin: 'https://luxx1993.github.io' } });
  const j1 = await r1.json();
  check('proxy forwards GET with token and query', r1.status === 200 && Array.isArray(j1.results));
  const r2 = await fetch(P + '/tasks/quick', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Über Proxy' }) });
  check('proxy forwards POST bodies', r2.status === 200 && tasks.some((t) => t.content === 'Über Proxy'));
  const r3 = await fetch(P + '/tasks', { headers: { Authorization: 'Bearer nope' } });
  eq('proxy passes upstream 401 through', r3.status, 401);
  const r4 = await fetch(P + '/sync', { headers: { Authorization: 'Bearer ' + TOKEN } });
  eq('proxy refuses other endpoints', r4.status, 404);
  const r5 = await fetch(P + '/tasks', { headers: { Origin: 'https://evil.example', Authorization: 'Bearer ' + TOKEN } });
  check('no CORS header for foreign origins', !r5.headers.get('access-control-allow-origin'));
  server.close();
}

main().catch((e) => { console.error('\nHARNESS ERROR:', e.message); process.exit(2); });
