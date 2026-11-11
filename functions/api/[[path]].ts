// Cloudflare Pages Function: serves the game API at /api/* (same handler as the Netlify function).
// Requires the nodejs_compat flag (set in wrangler.toml) for node:crypto and process.env.
import { handleApi } from '../../server/handler.js';

interface PagesContext {
  request: Request;
  env: Record<string, unknown>;
}

export const onRequest = async ({ request, env }: PagesContext): Promise<Response> => {
  // Cloudflare passes environment variables on `env`; the shared server code reads process.env.
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] ??= v;
  return handleApi(request);
};
