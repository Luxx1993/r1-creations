// Worker logic against the mock API: token reuse, WrongSender, token cap, 429 backoff, access key, media allowlist.
import assert from 'node:assert/strict';
import mock, { calls, opts } from './mock-api.mjs';

let fresh = 0;
async function load(fetchImpl) {
  globalThis.fetch = fetchImpl;
  return (await import('../src/worker.js?i=' + fresh++)).default;   // new module = new isolate state
}
const apiFetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.hostname === 'api.redgifs.com') return mock(url, init);
  return Promise.resolve(new Response('media', { status: 206, headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-4/5' } }));
};
const env = { ACCESS_KEY: 'secret-key', ASSETS: { fetch: async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }) } };
const get = (w, path, key = 'secret-key', headers = {}) =>
  w.fetch(new Request('https://w.test' + path, { headers: key ? { 'x-access-key': key, ...headers } : headers }), env);
const reset = () => { calls.token = 0; calls.api.length = 0; opts.wrongSender = 0; opts.status429 = false; };

let w = await load(apiFetch); reset();
// access control
assert.equal((await get(w, '/api/trending', null)).status, 404);
assert.equal((await get(w, '/api/trending', 'wrong')).status, 404);
assert.equal((await get(w, '/', null)).status, 404);
assert.equal((await get(w, '/robots.txt', null)).status, 200);
assert.deepEqual(await (await get(w, '/health', null)).json(), { ok: true, keyConfigured: true, keyLength: 10 });
assert.deepEqual(await (await get(w, '/health?k=secret-key', null)).json(), { ok: true, keyConfigured: true, keyLength: 10, givenLength: 10, keyMatches: true });
assert.equal((await (await get(w, '/health?k=nope', null)).json()).keyMatches, false);
assert.equal((await get(w, '/', null)).headers.get('cache-control'), 'no-store');
assert.match(await (await get(w, '/robots.txt', null)).text(), /Disallow: \//);
assert.equal((await get(w, '/icon.png', null)).headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
const page = await get(w, '/?k=secret-key', null);
assert.equal(page.status, 200);
assert.match(page.headers.get('content-security-policy'), /media-src 'self' https:\/\/\*\.redgifs\.com/);

// token fetched once and reused, ads/images filtered, slim shape
let r = await (await get(w, '/api/trending')).json();
assert.equal(r.items.length, 18);
assert.deepEqual(Object.keys(r.items[0]).sort(), ['a', 'd', 'h', 'hd', 'id', 'p', 'sd', 't', 'u', 'v', 'w']);
await get(w, '/api/trending?page=2'); await get(w, '/api/niches');
assert.equal(calls.token, 1, 'token reused');

// search: free text -> case-correct tag via suggest
r = await (await get(w, '/api/search?q=blonde')).json();
assert.equal(r.tag, 'Blonde'); assert.ok(r.items.length > 0);
r = await (await get(w, '/api/search?q=zzzz')).json();
assert.equal(r.tag, null); assert.equal(r.items.length, 0);
assert.ok(calls.api.some((c) => c.startsWith('/v2/niches/search')));
r = await (await get(w, '/api/niche?id=niche-1-1')).json();
assert.ok(calls.api.some((c) => c.includes('/v2/niches/niche-1-1/gifs?order=hot')));
assert.equal((await get(w, '/api/niche?id=../../x')).status, 400);
r = await (await get(w, '/api/tags')).json();
assert.equal(r.tags[0].n, 'Amateur');

// WrongSender: exactly one new token, then success
opts.wrongSender = 1;
assert.equal((await get(w, '/api/trending?page=3')).status, 200);
assert.equal(calls.token, 2);
// persistent WrongSender: one more token, then 502, no loop
opts.wrongSender = 5;
let res = await get(w, '/api/search?q=Amateur&exact=1&page=2');
assert.equal(res.status, 502); assert.equal((await res.json()).error, 'auth_failed');
assert.equal(calls.token, 3);
// token cap (3/h): the next forced refresh is refused with 503 instead of hammering auth
res = await get(w, '/api/search?q=Amateur&exact=1&page=3');
assert.equal(res.status, 503); assert.ok(+res.headers.get('retry-after') > 0);
assert.equal(calls.token, 3);
const st = await (await get(w, '/api/status')).json();
assert.equal(st.tokenFetchesLastHour, 3); assert.ok(st.stats.wrong_sender >= 2);

// 429 -> backoff, no further upstream calls during backoff
w = await load(apiFetch); reset();
await get(w, '/api/trending');
opts.status429 = true;
res = await get(w, '/api/search?q=Amateur&exact=1');
assert.equal(res.status, 429);
const n = calls.api.length;
res = await get(w, '/api/search?q=Amateur&exact=1&page=2');
assert.equal(res.status, 429); assert.equal(+res.headers.get('retry-after') > 60, true);
assert.equal(calls.api.length, n, 'no upstream call during backoff');

// media proxy: allowlist + range passthrough, no referer sent upstream
let seen = null;
w = await load((input, init) => { seen = { url: String(input), init }; return apiFetch(input, init); });
const m = (u) => get(w, '/media?u=' + encodeURIComponent(u), 'secret-key', { range: 'bytes=0-4' });
res = await m('https://media.redgifs.com/AbcDef-mobile.mp4');
assert.equal(res.status, 206); assert.equal(seen.init.headers.Range, 'bytes=0-4'); assert.equal(seen.init.headers.Referer, undefined);
for (const bad of ['http://media.redgifs.com/a.mp4', 'https://evil.com/a.mp4', 'https://media.redgifs.com.evil.com/a.mp4',
  'https://media.redgifs.com/../etc/passwd', 'https://media.redgifs.com/a.mp4?x=1', 'https://user@media.redgifs.com/a.mp4',
  'https://169.254.169.254/latest', 'https://media.redgifs.com:8443/a.mp4', 'https://media.redgifs.com/a.html']) {
  assert.equal((await m(bad)).status, 400, bad);
}
assert.equal((await get(w, '/media?u=' + encodeURIComponent('https://media.redgifs.com/a.mp4'), null)).status, 404);
console.log('unit: all assertions passed');
