// Local stand-in for Netlify Functions: serves the exact same handler on http://127.0.0.1:8787.
// Pair it with the Firebase emulators (npm run emulators) — see README.
import { createServer } from 'node:http';

process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ??= 'demo-water-wars';
process.env.FIREBASE_DATABASE_URL ??= 'https://demo-water-wars-default-rtdb.firebaseio.com';

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
}).listen(port, '0.0.0.0', () => console.log(`[dev-api] listening on http://127.0.0.1:${port}`));
