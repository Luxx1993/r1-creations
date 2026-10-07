// Synthetic stand-in for api.redgifs.com (shapes copied from real responses, content made up).
export const calls = { token: 0, api: [] };
export const opts = { wrongSender: 0, status429: false };

const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...headers } });
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const TAGS = ['Amateur', 'Blonde', 'Cosplay', 'Outdoor', 'Asian', 'Redhead', 'Petite', 'Latina', 'Teasing', 'Solo'];

function gifs(prefix, page, pages) {
  const list = [];
  for (let i = 0; i < 20; i++) {
    const n = (page - 1) * 20 + i + 1, name = `${prefix}${n}`;
    list.push({ id: name.toLowerCase(), type: 1, width: i % 2 ? 1080 : 1920, height: i % 2 ? 1920 : 1080, duration: 8.5, hasAudio: i % 3 === 0,
      userName: 'creator' + n, verified: i % 4 === 0, tags: TAGS.slice(i % 5, i % 5 + 3), cta: null,
      urls: { sd: `https://media.redgifs.com/${name}-mobile.mp4`, hd: `https://media.redgifs.com/${name}.mp4`,
              thumbnail: `https://media.redgifs.com/${name}-mobile.jpg`, poster: `https://media.redgifs.com/${name}-poster.jpg` } });
  }
  list[5] = { ...list[5], cta: { text: 'ad', link: 'x' } };   // ad -> must be filtered
  list[6] = { ...list[6], type: 2 };                          // image -> must be filtered
  return { gifs: list, boosted_gifs: [list[0]], page, pages, total: pages * 20, users: [], niches: [], tags: [] };
}

export default async function mock(url, init = {}) {
  const p = url.pathname, q = url.searchParams;
  if (p === '/v2/auth/temporary') {
    calls.token++;
    const now = Math.floor(Date.now() / 1000);
    return json({ token: `x.${b64({ exp: now + 86400, valid_addr: '127.0.0.1' })}.y`, addr: '127.0.0.1' });
  }
  calls.api.push(p + url.search);
  if (opts.status429) return json({ error: { code: 'TooManyRequests' } }, 429, { 'retry-after': '120' });
  if (p === '/v1/tags') return json({ tags: TAGS.map((name, i) => ({ name, count: 9e6 / (i + 1) })) });
  const auth = (init.headers || {}).Authorization || '';
  if (!auth.startsWith('Bearer x.')) return json({ error: { code: 'BadTokenFormat', status: 401 } }, 401);
  if (opts.wrongSender > 0) { opts.wrongSender--; return json({ error: { code: 'WrongSender', status: 401 } }, 401); }
  const page = +q.get('page') || 1;
  if (p === '/v2/gifs/search') {
    const tag = q.get('tags');
    if (tag && !TAGS.includes(tag)) return json({ gifs: [], page: 1, pages: 0, total: 0 });   // tags are case-sensitive
    return json(gifs(tag ? 'Tag' + tag : 'Trend', page, 3));
  }
  if (p === '/v2/search/suggest') {
    const s = (q.get('query') || '').toLowerCase();
    return json(TAGS.filter((t) => t.toLowerCase().includes(s)).map((text) => ({ type: 'tag', text, gifs: 1000 })));
  }
  if (p === '/v2/niches/search') {
    return json({ page, pages: 2, total: 40, niches: Array.from({ length: 20 }, (_, i) => ({ id: `niche-${page}-${i}`, name: `Niche ${(page - 1) * 20 + i + 1}`,
      gifs: '1234', subscribers: String(50000 - i * 1000), thumbnail: 'https://userpic.redgifs.com/niches/thumbnails/test.jpg' })) });
  }
  const m = p.match(/^\/v2\/niches\/([a-z0-9-]+)\/gifs$/);
  if (m) {
    if (q.get('order') === 'trending') return json({ error: { code: 'BadOrder', status: 400 } }, 400);
    return json(gifs('Niche' + m[1].replace(/-/g, ''), page, 2));
  }
  return json({ error: { code: 'HttpNotFoundException' } }, 404);
}
