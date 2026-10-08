// Runs the same worker under Node 20+ (local testing, or a small always-on server with a fixed IP).
//   ACCESS_KEY=... PORT=8787 node server/node.mjs
// Behind an outbound proxy (Node 22.21+/24): NODE_USE_ENV_PROXY=1.
// Test-only: MOCK_API=<module path> replaces requests to api.redgifs.com with a mock handler.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import worker from '../src/worker.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pub = join(root, 'public');

// .dev.vars (KEY=value lines) like wrangler
const devVars = join(root, '.dev.vars');
if (existsSync(devVars)) {
  for (const line of readFileSync(devVars, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
if (!process.env.ACCESS_KEY) { console.error('ACCESS_KEY missing'); process.exit(1); }

if (process.env.MOCK_API) {
  const mock = (await import(pathToFileURL(process.env.MOCK_API).href)).default;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    return url.hostname === 'api.redgifs.com' ? mock(url, init) : realFetch(input, init);
  };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.json': 'application/json', '.css': 'text/css', '.txt': 'text/plain' };

// Minimal stand-in for the Workers static-assets binding (html_handling = auto-trailing-slash).
const ASSETS = {
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith('/')) path += 'index.html';
    else if (!extname(path)) path += '.html';
    const file = normalize(join(pub, path));
    if (!file.startsWith(pub) || !existsSync(file)) return new Response('Not found', { status: 404 });
    return new Response(await readFile(file), { headers: { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' } });
  },
};
const env = { ACCESS_KEY: process.env.ACCESS_KEY, ASSETS };   // no relay hub here: calls RedGifs directly

http.createServer(async (req, res) => {
  try {
    const url = `http://${req.headers.host || 'localhost'}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const r = await worker.fetch(new Request(url, { method: req.method, headers }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    if (r.body && req.method !== 'HEAD') Readable.fromWeb(r.body).pipe(res); else res.end();
  } catch (e) {
    res.writeHead(500); res.end('error');
  }
}).listen(+(process.env.PORT || 8787), () => console.log(`listening on http://localhost:${process.env.PORT || 8787}/?k=…`));
