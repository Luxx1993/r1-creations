// Used by Cloudflare Workers Builds (deploy command `npm run deploy`): if ACCESS_KEY is set as a
// *build* secret, copy it into the Worker's runtime secrets. The value is piped, never printed.
import { execFileSync } from 'node:child_process';

const key = process.env.ACCESS_KEY;
if (!key) {
  console.log('sync-secret: no ACCESS_KEY build secret, runtime secret left unchanged');
  process.exit(0);
}
if (!/^[A-Za-z0-9]{16,128}$/.test(key)) {
  console.error('sync-secret: ACCESS_KEY must be 16-128 letters/digits (no spaces or symbols)');
  process.exit(1);
}
execFileSync('npx', ['wrangler', 'secret', 'put', 'ACCESS_KEY'], { input: key, stdio: ['pipe', 'inherit', 'inherit'] });
console.log(`sync-secret: runtime secret ACCESS_KEY updated (${key.length} chars)`);
