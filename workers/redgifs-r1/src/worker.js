// RedGifs proxy for a Rabbit R1 creation (Cloudflare Worker, also runs under Node, see server/node.mjs).
// Only endpoints verified with curl on 2026-10-07 are used (see README.md, "API-Tests").

const API = 'https://api.redgifs.com';
// The guest token is bound to the IP *and* the User-Agent that requested it (JWT claims
// valid_addr / valid_agent), so every API call must send exactly this UA.
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

const MAX_TOKEN_FETCHES_PER_HOUR = 3;   // hard cap, RedGifs bans clients that request too many tokens
const TOKEN_EARLY_REFRESH_S = 600;      // treat the token as expired 10 min before exp
const PAGE_SIZE = 20;
const MEDIA_HOST = /^(media|userpic|thumbs\d*)\.redgifs\.com$/;
const MEDIA_PATH = /^\/[A-Za-z0-9_-]{1,120}\.(mp4|jpg|jpeg|webp|png)$/;
const PUBLIC_PATHS = new Set(['/robots.txt', '/icon.png', '/version.js']);

const CACHE_TTL = { trending: 300, search: 600, niches: 3600, niche: 600, tags: 86400, suggest: 3600 };

// Per-isolate state. Survives between requests on the same isolate; KV (optional) makes it global.
const mem = { token: null, kv: new Map(), cache: new Map(), pendingToken: null };

class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}

// ---------- small KV wrapper (KV binding TOKEN_KV is optional) ----------
async function kvGet(env, key) {
  if (env.TOKEN_KV) return env.TOKEN_KV.get(key, 'json');
  return mem.kv.get(key) ?? null;
}
async function kvPut(env, key, value, ttlS) {
  if (env.TOKEN_KV) return env.TOKEN_KV.put(key, JSON.stringify(value), ttlS ? { expirationTtl: Math.max(60, Math.ceil(ttlS)) } : undefined);
  mem.kv.set(key, value);
}

// RedGifs throttles the address shared by all Cloudflare Workers, so API calls can go through a
// relay with its own IP (relay/ in this repo). Media still loads directly on the device.
function upstream(env, path, headers) {
  if (env.RELAY_URL) {
    return fetch(env.RELAY_URL.replace(/\/+$/, '') + path, { headers: { ...headers, 'X-Relay-Secret': env.RELAY_SECRET || '' } });
  }
  return fetch(API + path, { headers });
}

const now = () => Date.now();
const sec = () => Math.floor(Date.now() / 1000);

function jwtPayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64 + '==='.slice((b64.length + 3) % 4)));
  } catch { return {}; }
}

// ---------- token handling ----------
function tokenUsable(t) { return t && t.exp - TOKEN_EARLY_REFRESH_S > sec(); }

async function getToken(env, { force = false, bad = null } = {}) {
  if (!force && tokenUsable(mem.token)) return mem.token.token;
  const stored = await kvGet(env, 'token');
  if (tokenUsable(stored) && (!force || stored.token !== bad)) { mem.token = stored; return stored.token; }
  if (!mem.pendingToken) mem.pendingToken = fetchToken(env).finally(() => { mem.pendingToken = null; });
  return mem.pendingToken;
}

async function fetchToken(env) {
  await checkBackoff(env);
  const log = ((await kvGet(env, 'token_log')) || []).filter((t) => t > now() - 3600e3);
  if (log.length >= MAX_TOKEN_FETCHES_PER_HOUR) {
    throw new HttpError(503, 'token_limit', { retryAfter: Math.ceil((log[0] + 3600e3 - now()) / 1000) });
  }
  log.push(now());
  await kvPut(env, 'token_log', log, 3600);
  const r = await upstream(env, '/v2/auth/temporary', { 'User-Agent': UA, Accept: 'application/json' });
  if (r.status === 429) throw new HttpError(429, 'rate_limited', await setBackoff(env, r, 'token'));
  if (!r.ok) throw new HttpError(502, 'token_failed', { upstream: r.status });
  const body = await r.json();
  const p = jwtPayload(body.token);
  const t = { token: body.token, exp: p.exp || sec() + 23 * 3600, addr: body.addr || p.valid_addr || '', at: now() };
  mem.token = t;
  await kvPut(env, 'token', t, t.exp - sec());
  return t.token;
}

// ---------- 429 backoff ----------
async function checkBackoff(env) {
  const b = await kvGet(env, 'backoff');
  if (b && b.until > now()) throw new HttpError(429, 'rate_limited', { retryAfter: Math.ceil((b.until - now()) / 1000), cause: b.reason || null });
}
// Remembers why RedGifs throttled us (token request or API call, its error code) for diagnosis.
async function setBackoff(env, r, source) {
  const prev = await kvGet(env, 'backoff');
  const ra = parseInt(r.headers.get('retry-after') || '', 10);
  const step = Number.isFinite(ra) && ra > 0 ? ra : Math.min(900, prev && prev.until > now() - 600e3 ? prev.step * 2 : 30);
  const body = await r.text().catch(() => '');
  let code = '';
  try { const e = JSON.parse(body).error || {}; code = String(e.code || e.message || '').slice(0, 80); } catch { code = body.slice(0, 80); }
  const reason = { source, status: r.status, code, retryAfterHeader: r.headers.get('retry-after') || null, at: new Date().toISOString() };
  await kvPut(env, 'backoff', { until: now() + step * 1000, step, reason }, step + 60);
  await kvPut(env, 'last_429', reason);
  return { retryAfter: step, cause: reason };
}

async function bumpStat(env, key) {
  const s = (await kvGet(env, 'stats')) || {};
  s[key] = (s[key] || 0) + 1; s[key + '_at'] = now();
  await kvPut(env, 'stats', s);
}

// ---------- upstream API ----------
async function api(env, path, { auth = true } = {}) {
  await checkBackoff(env);
  const call = async (tok) => upstream(env, path,
    { 'User-Agent': UA, Accept: 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
  let tok = auth ? await getToken(env) : null;
  let r = await call(tok);
  if (auth && (r.status === 401 || r.status === 403)) {
    // Exactly one fresh token per failed call. WrongSender = the token was issued to another IP.
    const code = await r.json().then((b) => b?.error?.code, () => '');
    await bumpStat(env, code === 'WrongSender' ? 'wrong_sender' : 'auth_' + r.status);
    tok = await getToken(env, { force: true, bad: tok });
    r = await call(tok);
  }
  if (r.status === 429) throw new HttpError(429, 'rate_limited', await setBackoff(env, r, 'api ' + path.split('?')[0]));
  if (r.status === 401 || r.status === 403) throw new HttpError(502, 'auth_failed', { upstream: r.status });
  if (!r.ok) throw new HttpError(r.status === 404 ? 404 : 502, 'upstream', { upstream: r.status });
  return r.json();
}

async function cached(kind, key, fn) {
  const k = kind + ':' + key, hit = mem.cache.get(k);
  if (hit && hit.until > now()) return hit.value;
  const value = await fn();
  mem.cache.set(k, { value, until: now() + CACHE_TTL[kind] * 1000 });
  if (mem.cache.size > 200) mem.cache.delete(mem.cache.keys().next().value);
  return value;
}

// Strip ads, images and fields the device does not need.
function slimGifs(body) {
  const items = (body.gifs || [])
    .filter((g) => g && g.type === 1 && !g.cta && !g.promoted && g.urls && (g.urls.sd || g.urls.hd))
    .map((g) => ({
      id: g.id, w: g.width, h: g.height, d: g.duration, a: !!g.hasAudio,
      u: g.userName || '', v: !!g.verified, t: (g.tags || []).slice(0, 4),
      sd: g.urls.sd || g.urls.hd, hd: g.urls.hd || g.urls.sd, p: g.urls.thumbnail || g.urls.poster || '',
    }));
  return { items, page: body.page || 1, pages: body.pages || 1, total: body.total || items.length };
}

const pageParam = (url) => Math.min(1000, Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1));
const ORDERS = new Set(['trending', 'latest', 'top7', 'top28', 'top']);

async function resolveTag(env, q) {
  // Tags are case-sensitive ("big tits" finds nothing, "Big Tits" does), so map free text to a real tag.
  const list = await cached('suggest', q.toLowerCase(), () => api(env, '/v2/search/suggest?query=' + encodeURIComponent(q)));
  const tags = (Array.isArray(list) ? list : []).filter((s) => s.type === 'tag' && s.text);
  const exact = tags.find((s) => s.text.toLowerCase() === q.toLowerCase());
  return (exact || tags[0] || {}).text || null;
}

const routes = {
  async '/api/trending'(env, url) {
    const page = pageParam(url);
    return cached('trending', page, async () =>
      slimGifs(await api(env, `/v2/gifs/search?type=g&order=trending&count=${PAGE_SIZE}&page=${page}`)));
  },
  async '/api/search'(env, url) {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    if (!q) throw new HttpError(400, 'missing_q');
    const page = pageParam(url);
    const order = ORDERS.has(url.searchParams.get('order')) ? url.searchParams.get('order') : 'trending';
    const tag = url.searchParams.get('exact') === '1' ? q : await resolveTag(env, q);
    if (!tag) return { items: [], page: 1, pages: 0, total: 0, tag: null, q };
    const res = await cached('search', `${tag}|${order}|${page}`, async () =>
      slimGifs(await api(env, `/v2/gifs/search?type=g&order=${order}&count=${PAGE_SIZE}&page=${page}&tags=${encodeURIComponent(tag)}`)));
    return { ...res, tag, q };
  },
  async '/api/tags'(env) {
    return cached('tags', 'top', async () => {
      const body = await api(env, '/v1/tags', { auth: false });
      return { tags: (body.tags || []).slice(0, 80).map((t) => ({ n: t.name, c: t.count })) };
    });
  },
  async '/api/niches'(env, url) {
    const page = pageParam(url);
    return cached('niches', page, async () => {
      const body = await api(env, `/v2/niches/search?query=&order=subscribers&count=${PAGE_SIZE}&page=${page}`);
      return {
        niches: (body.niches || []).map((n) => ({ id: n.id, n: n.name, s: +n.subscribers || 0, g: +n.gifs || 0, p: n.thumbnail || '' })),
        page: body.page || page, pages: body.pages || 1,
      };
    });
  },
  async '/api/niche'(env, url) {
    const id = url.searchParams.get('id') || '';
    if (!/^[a-z0-9-]{1,80}$/.test(id)) throw new HttpError(400, 'bad_id');
    const page = pageParam(url);
    // "trending" is rejected here (400 BadOrder), "hot" works.
    return cached('niche', `${id}|${page}`, async () =>
      slimGifs(await api(env, `/v2/niches/${id}/gifs?order=hot&count=${PAGE_SIZE}&page=${page}`)));
  },
  async '/api/status'(env) {
    const t = (await kvGet(env, 'token')) || mem.token;
    const log = ((await kvGet(env, 'token_log')) || []).filter((x) => x > now() - 3600e3);
    return {
      token: t ? { addr: t.addr, ageMin: Math.round((now() - t.at) / 60000), expiresInMin: Math.round((t.exp - sec()) / 60) } : null,
      tokenFetchesLastHour: log.length, maxPerHour: MAX_TOKEN_FETCHES_PER_HOUR,
      backoff: await kvGet(env, 'backoff'), last429: await kvGet(env, 'last_429'), stats: (await kvGet(env, 'stats')) || {}, kv: !!env.TOKEN_KV, relay: env.RELAY_URL ? new URL(env.RELAY_URL).hostname : null,
    };
  },
};

// ---------- media stream proxy (fallback; the app loads media directly by default) ----------
async function media(req, url) {
  let target;
  try { target = new URL(url.searchParams.get('u') || ''); } catch { throw new HttpError(400, 'bad_url'); }
  if (target.protocol !== 'https:' || !MEDIA_HOST.test(target.hostname) || !MEDIA_PATH.test(target.pathname) ||
      target.search || target.username || target.port) throw new HttpError(400, 'bad_url');
  const h = { 'User-Agent': UA };      // no Referer: the CDN answers 403 to foreign referers
  const range = req.headers.get('range');
  if (range && /^bytes=\d*-\d*$/.test(range)) h.Range = range;
  const r = await fetch(target.toString(), { method: req.method, headers: h, cf: { cacheTtl: 86400, cacheEverything: true } });
  const out = new Headers();
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = r.headers.get(k); if (v) out.set(k, v);
  }
  out.set('Cache-Control', 'private, max-age=86400');
  return new Response(req.method === 'HEAD' ? null : r.body, { status: r.status, headers: out });
}

// ---------- access control & headers ----------
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0, n = Math.max(a.length, b.length); i < n; i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}

const CSP = [
  "default-src 'none'", "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com", "style-src 'unsafe-inline'",
  "img-src 'self' data: https://*.redgifs.com", "media-src 'self' https://*.redgifs.com", "connect-src 'self'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

function finish(res, { html = false } = {}) {
  const r = new Response(res.body, res);
  r.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  r.headers.set('Referrer-Policy', 'no-referrer');
  r.headers.set('X-Content-Type-Options', 'nosniff');
  if (html) { r.headers.set('Content-Security-Policy', CSP); r.headers.set('Cache-Control', 'no-cache'); }
  return r;
}

const json = (obj, status = 200, maxAge = 0) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? `private, max-age=${maxAge}` : 'no-store' },
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return finish(new Response('Method not allowed', { status: 405 }));
    if (url.pathname === '/robots.txt') return finish(new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } }));
    // Public setup check: says only whether a key is configured, never which.
    if (url.pathname === '/health') {
      const given = url.searchParams.get('k');
      return finish(json({ ok: true, keyConfigured: !!env.ACCESS_KEY, keyLength: (env.ACCESS_KEY || '').length, relay: !!env.RELAY_URL,
        ...(given !== null ? { givenLength: given.length, keyMatches: safeEqual(given, env.ACCESS_KEY) } : {}) }));
    }
    if (!PUBLIC_PATHS.has(url.pathname)) {
      const key = req.headers.get('x-access-key') || url.searchParams.get('k') || '';
      if (!safeEqual(key, env.ACCESS_KEY)) return finish(new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } }));
    }
    try {
      if (url.pathname === '/media') return finish(await media(req, url));
      const route = routes[url.pathname];
      if (route) {
        const kind = url.pathname.slice(5);
        return finish(json(await route(env, url), 200, kind === 'status' ? 0 : Math.min(CACHE_TTL[kind] || 0, 300)));
      }
      if (url.pathname.startsWith('/api/')) return finish(json({ error: 'not_found' }, 404));
      const res = await env.ASSETS.fetch(req);
      return finish(res, { html: (res.headers.get('content-type') || '').includes('text/html') });
    } catch (e) {
      if (e instanceof HttpError) {
        const res = json({ error: e.code, ...e.extra }, e.status);
        if (e.extra.retryAfter) res.headers.set('Retry-After', String(e.extra.retryAfter));
        return finish(res);
      }
      return finish(json({ error: 'internal' }, 500));
    }
  },
};
