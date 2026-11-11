// Runtime config, player identity and the (lazy) Supabase Realtime connection.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApiResponse, ClientConfig } from '../shared/types';

let configPromise: Promise<ClientConfig> | null = null;
/** Public config comes from /api/config at runtime, so Netlify env vars are the only place to configure. */
export function loadConfig(): Promise<ClientConfig> {
  configPromise ??= fetch('/api/config', { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Config request failed (${r.status})`);
      return (await r.json()) as ClientConfig;
    })
    .catch((e) => {
      configPromise = null;
      throw e;
    });
  return configPromise;
}

export interface Session {
  uid: string;
  token: string;
}
const KEY = 'ww:session';
let sessionPromise: Promise<Session> | null = null;

/** Same browser = same player across reloads, so a refresh or dropped connection keeps your seat. */
export function ensureSession(): Promise<Session> {
  sessionPromise ??= (async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
      if (saved?.uid && saved.token) return saved;
    } catch {
      /* storage unavailable */
    }
    const res = await fetch('/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"op":"session"}' });
    const data = (await res.json()) as ApiResponse;
    if (!data.ok || !data.uid || !data.token) throw new Error(data.message ?? 'Could not start a session.');
    const s = { uid: data.uid, token: data.token };
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* in-memory only */
    }
    return s;
  })().catch((e) => {
    sessionPromise = null;
    throw e;
  });
  return sessionPromise;
}

/** Called when the server rejects our token (e.g. the server secret was rotated). */
export function resetSession() {
  sessionPromise = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

let rtPromise: Promise<SupabaseClient> | null = null;
export function realtime(): Promise<SupabaseClient> {
  rtPromise ??= (async () => {
    const cfg = await loadConfig();
    if (!cfg.supabase) throw new Error('NOT_CONFIGURED');
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(cfg.supabase.url, cfg.supabase.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  })().catch((e) => {
    rtPromise = null;
    throw e;
  });
  return rtPromise;
}
