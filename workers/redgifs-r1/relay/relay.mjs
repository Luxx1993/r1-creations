// Tiny relay for the RG Clips worker: forwards GET requests to api.redgifs.com from this machine's IP.
// Only the worker may use it (shared secret). No dependencies, no logging of content.
//   RELAY_SECRET=... PORT=8080 node relay.mjs
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const SECRET = process.env.RELAY_SECRET || '';
const PORT = +(process.env.PORT || 8080);
const UPSTREAM = 'https://api.redgifs.com';
const PATH_OK = /^\/v[12]\/[A-Za-z0-9/_.-]{1,200}$/;
if (SECRET.length < 16) { console.error('RELAY_SECRET (min. 16 chars) missing'); process.exit(1); }

const eq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://relay');
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (!eq(String(req.headers['x-relay-secret'] || ''), SECRET)) return send(res, 404, { error: 'not_found' });
    if (req.method !== 'GET' || !PATH_OK.test(url.pathname)) return send(res, 400, { error: 'bad_request' });
    const headers = { Accept: 'application/json', 'User-Agent': String(req.headers['user-agent'] || '') };
    if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
    const r = await fetch(UPSTREAM + url.pathname + url.search, { headers, signal: AbortSignal.timeout(20000) });
    const out = { 'content-type': r.headers.get('content-type') || 'application/json' };
    if (r.headers.get('retry-after')) out['retry-after'] = r.headers.get('retry-after');
    res.writeHead(r.status, out);
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    send(res, 502, { error: 'relay_upstream_failed' });
  }
}).listen(PORT, () => console.log(`relay listening on :${PORT}`));
