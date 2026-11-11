// Local stand-in for Netlify Functions: serves the exact same handler on http://127.0.0.1:8787.
// If SUPABASE_* variables aren't set, it reads the keys of a local Supabase started with
// `npm run supabase:start` (see README) via `npx supabase status`.
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  try {
    const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    process.env.SUPABASE_URL ??= status.API_URL;
    process.env.SUPABASE_PUBLISHABLE_KEY ??= status.PUBLISHABLE_KEY ?? status.ANON_KEY;
    process.env.SUPABASE_SECRET_KEY ??= status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  } catch {
    console.warn('[dev-api] No SUPABASE_* env vars and no local Supabase found. Run `npm run supabase:start` first.');
  }
}

const { handleApi } = await import('../server/handler');
const port = Number(process.env.API_PORT ?? 8787);

createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
    const response = await handleApi(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500).end('dev api error');
  }
}).listen(port, '0.0.0.0', () => console.log(`[dev-api] listening on http://127.0.0.1:${port} (Supabase: ${process.env.SUPABASE_URL})`));
