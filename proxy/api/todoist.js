// Optional CORS proxy for the Todoist creation (Vercel serverless function).
// Only needed if the R1 WebView cannot call api.todoist.com directly.
//
// The creation keeps sending its own token in the Authorization header; this
// function forwards it unchanged and stores or logs nothing. It only forwards
// the task and project endpoints the creation uses.
//
// Env (Vercel → Project → Settings → Environment Variables):
//   ALLOWED_ORIGINS  comma-separated origins, default https://luxx1993.github.io
//   TODOIST_UPSTREAM default https://api.todoist.com/api/v1/

const PATH_OK = /^(projects|tasks|tasks\/filter|tasks\/quick|tasks\/[A-Za-z0-9_-]+(\/(close|reopen|move))?)$/;

export default async function handler(req, res) {
  const upstream = (process.env.TODOIST_UPSTREAM || 'https://api.todoist.com/api/v1/').replace(/\/?$/, '/');
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://luxx1993.github.io').split(',').map((s) => s.trim());
  const origin = req.headers.origin || '';
  if (allowed.includes('*') || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const query = Object.assign({}, req.query);
  const path = String(Array.isArray(query.path) ? query.path.join('/') : query.path || '');
  delete query.path;
  if (!PATH_OK.test(path)) return res.status(404).json({ error: 'path not allowed' });

  const auth = req.headers.authorization || '';
  if (!/^Bearer \S+$/.test(auth)) return res.status(401).json({ error: 'missing token' });

  const qs = new URLSearchParams(query).toString();
  const init = { method: req.method, headers: { Authorization: auth } };
  if (req.method === 'POST') {
    init.headers['Content-Type'] = 'application/json';
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  }
  let up;
  try {
    up = await fetch(upstream + path + (qs ? '?' + qs : ''), init);
  } catch (e) {
    return res.status(502).json({ error: 'upstream unreachable' });
  }
  const text = await up.text();
  res.status(up.status);
  res.setHeader('Content-Type', up.headers.get('content-type') || 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(text);
}
