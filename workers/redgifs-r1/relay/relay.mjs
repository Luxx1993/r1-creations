// Home relay for the RG Clips worker. It dials OUT to the worker over a WebSocket and keeps the line open;
// the worker sends RedGifs API requests down that line and this machine fetches them with its own IP.
// No inbound ports, no tunnel. Node 22+, no dependencies, no logging of content.
//   WORKER_URL=https://r1-rg.<you>.workers.dev RELAY_SECRET=... node relay.mjs
const WORKER_URL = (process.env.WORKER_URL || '').replace(/\/+$/, '');
const SECRET = process.env.RELAY_SECRET || '';
const UPSTREAM = process.env.UPSTREAM || 'https://api.redgifs.com';     // overridable for tests only
const PATH_OK = /^\/v[12]\/[A-Za-z0-9/_.-]{1,200}(\?[A-Za-z0-9%&=_.,+-]{0,500})?$/;
if (!/^https?:\/\//.test(WORKER_URL) || SECRET.length < 16) {
  console.error('WORKER_URL (https://…) and RELAY_SECRET (min. 16 chars) are required');
  process.exit(1);
}
const wsUrl = WORKER_URL.replace(/^http/, 'ws') + '/relay/connect';
const log = (...a) => console.log(new Date().toISOString(), ...a);

let delay = 2000;
function connect() {
  const ws = new WebSocket(wsUrl);
  let alive = Date.now(), timer = 0, done = false;
  // A failed connect may fire only 'error' (no 'close'), so both lead here, exactly once per socket.
  const retry = (why) => {
    if (done) return;
    done = true; clearInterval(timer); clearTimeout(openTimeout);
    if (why === 4001) log('worker rejected RELAY_SECRET (must match the worker secret)');
    else log('disconnected', why || '', '- retry in', delay / 1000, 's');
    try { ws.close(); } catch {}
    setTimeout(connect, delay);
    delay = Math.min(delay * 2, 60000);
  };
  const openTimeout = setTimeout(() => retry('connect timeout'), 20000);
  ws.addEventListener('open', () => {
    clearTimeout(openTimeout);
    ws.send(JSON.stringify({ type: 'hello', secret: SECRET }));
    timer = setInterval(() => {                       // keep NAT/proxies open, detect dead lines
      if (Date.now() - alive > 75000) { retry('no pong'); return; }
      try { ws.send('ping'); } catch {}
    }, 30000);
  });
  ws.addEventListener('message', async (ev) => {
    alive = Date.now();
    if (ev.data === 'pong') return;
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === 'welcome') { delay = 2000; log('connected to', WORKER_URL); return; }
    if (m.type !== 'req') return;
    const reply = (o) => { try { ws.send(JSON.stringify({ type: 'res', id: m.id, ...o })); } catch {} };
    if (typeof m.path !== 'string' || !PATH_OK.test(m.path)) return reply({ status: 400, body: '{"error":"bad_path"}' });
    try {
      const h = m.headers || {};
      const headers = { Accept: 'application/json', 'User-Agent': String(h['User-Agent'] || '') };
      if (h.Authorization) headers.Authorization = String(h.Authorization);
      const r = await fetch(UPSTREAM + m.path, { headers, signal: AbortSignal.timeout(12000) });
      reply({ status: r.status, ct: r.headers.get('content-type') || '', ra: r.headers.get('retry-after') || '', body: await r.text() });
    } catch {
      reply({ status: 502, body: '{"error":"relay_upstream_failed"}' });
    }
  });
  ws.addEventListener('close', (ev) => retry(ev.code));
  ws.addEventListener('error', () => retry('error'));
}
log('relay starting, worker', WORKER_URL);
connect();
