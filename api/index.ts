// Vercel Function: serves the game API at /api/* (vercel.json rewrites every /api path here).
import { handleApi } from '../server/handler.js';

/** Vercel hands us the rewritten URL; restore the original /api/... path from the rewrite parameter. */
function restore(request: Request): Request {
  const url = new URL(request.url);
  const original = url.searchParams.get('__path');
  if (original === null) return request;
  url.searchParams.delete('__path');
  url.pathname = `/api/${original}`.replace(/\/+$/, '') || '/api';
  return new Request(url, request);
}

export const GET = (request: Request) => handleApi(restore(request));
export const POST = (request: Request) => handleApi(restore(request));
