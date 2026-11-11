// Supabase-backed room storage + realtime notifications.
//  • State lives in Postgres (table ww_rooms), readable/writable ONLY with the secret key (RLS on, no policies).
//  • Writes use optimistic concurrency (update … where version = expected), so simultaneous moves are serialised.
//  • After each write the server broadcasts a tiny "version changed" ping on the room's Realtime channel.
//    Clients then fetch their own view from the API; broadcast payloads are never trusted.
import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ClientConfig } from '../src/shared/types';
import { GameError, type Ctx, type GameState } from './engine';

export type Mutator = (s: GameState, ctx: Ctx) => 'deleted' | unknown;

export const ROOM_TTL_MS = 8 * 60 * 60 * 1000;
/** A player whose device hasn't checked in for this long counts as offline (clients check in every 10s). */
export const PRESENCE_STALE_MS = 25_000;

const env = (...keys: string[]) => {
  for (const k of keys) {
    const v = (process.env[k] ?? '').trim();
    if (v) return v;
  }
  return '';
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function rng() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

function supabaseUrl() {
  const direct = env('SUPABASE_URL');
  if (direct) return direct.replace(/\/+$/, '');
  // Netlify's Supabase extension sets SUPABASE_DATABASE_URL to the project URL.
  const alt = env('SUPABASE_DATABASE_URL');
  return alt.startsWith('http') ? alt.replace(/\/+$/, '') : '';
}
const secretKey = () => env('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
const publishableKey = () => env('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');

export function missingConfig(): string[] {
  const missing: string[] = [];
  if (!supabaseUrl()) missing.push('SUPABASE_URL');
  if (!publishableKey()) missing.push('SUPABASE_PUBLISHABLE_KEY');
  if (!secretKey()) missing.push('SUPABASE_SECRET_KEY');
  return missing;
}

export function clientConfig(): ClientConfig {
  const missing = missingConfig();
  if (missing.length) return { configured: false, missing };
  return { configured: true, supabase: { url: supabaseUrl(), publishableKey: publishableKey() } };
}

/** HMAC with a server-only secret (WW_SESSION_SECRET, or derived from the Supabase secret key). */
export function sign(data: string): string {
  const secret = env('WW_SESSION_SECRET') || `ww:${secretKey()}`;
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** Unguessable Realtime channel name for a room: only members are told it. */
export const roomTopic = (code: string) => `ww-${code}-${sign(`topic:${code}`).slice(0, 22)}`;

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  client ??= createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function dbError(e: { message?: string; code?: string } | null, what: string): never {
  console.error(`Supabase ${what} failed`, e);
  if (e?.code === '42P01' || /relation .* does not exist|schema cache/i.test(e?.message ?? '')) {
    throw new GameError('NOT_CONFIGURED', 'The database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor.');
  }
  throw new GameError('DB', 'The database could not be reached. Please try again.');
}

export async function createRoom(code: string, state: GameState): Promise<boolean> {
  const { error } = await db().from('ww_rooms').insert({ code, state, version: state.version });
  if (!error) return true;
  if (error.code === '23505') return false; // code already taken
  dbError(error, 'insert');
}

export async function readRoom(code: string): Promise<GameState | null> {
  const { data, error } = await db().from('ww_rooms').select('state').eq('code', code).maybeSingle();
  if (error) dbError(error, 'read');
  return (data?.state as GameState) ?? null;
}

export async function mutateRoom(code: string, fn: Mutator, offline?: Record<string, number>): Promise<GameState | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const s = await readRoom(code);
    if (!s) throw new GameError('ROOM_NOT_FOUND', 'That room does not exist. Check the code!');
    const expected = s.version;
    const ctx: Ctx = { now: Date.now(), rng, offline };
    if (fn(s, ctx) === 'deleted') {
      const { data: gone, error: delErr } = await db().from('ww_rooms').delete().eq('code', code).eq('version', expected).select('code');
      if (delErr) dbError(delErr, 'delete');
      if (gone && gone.length) {
        await db().from('ww_presence').delete().eq('code', code);
        await notify(code, -1);
        return null;
      }
      await sleep(15 + Math.random() * 50 * (attempt + 1)); // room changed meanwhile (e.g. someone joined): retry
      continue;
    }
    s.version = expected + 1;
    s.updatedAt = ctx.now;
    const { data, error } = await db()
      .from('ww_rooms')
      .update({ state: s, version: s.version, updated_at: new Date(ctx.now).toISOString() })
      .eq('code', code)
      .eq('version', expected)
      .select('version');
    if (error) dbError(error, 'update');
    if (data && data.length) {
      await notify(code, s.version);
      return s;
    }
    await sleep(15 + Math.random() * 50 * (attempt + 1)); // someone else wrote first: retry on fresh state
  }
  throw new GameError('BUSY', 'The server is busy. Please try again.');
}

/** Broadcast "room changed" so every device refreshes immediately. Best-effort. */
export async function notify(code: string, version: number) {
  try {
    const res = await fetch(`${supabaseUrl()}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: secretKey(), 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: roomTopic(code), event: 'changed', payload: { v: version } }] }),
    });
    if (!res.ok) console.warn('broadcast failed', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.warn('broadcast failed', e);
  }
}

export async function touch(code: string, uid: string) {
  const { error } = await db()
    .from('ww_presence')
    .upsert({ code, uid, last_seen: new Date().toISOString() }, { onConflict: 'code,uid' });
  if (error) console.warn('presence update failed', error.message);
}

/** uid -> last check-in time, for players who haven't checked in recently. */
export async function offlinePlayers(code: string, s?: GameState | null): Promise<Record<string, number>> {
  const state = s ?? (await readRoom(code));
  if (!state) return {};
  const { data } = await db().from('ww_presence').select('uid,last_seen').eq('code', code);
  const seen = new Map((data ?? []).map((r) => [r.uid as string, Date.parse(r.last_seen as string)]));
  const now = Date.now();
  const out: Record<string, number> = {};
  for (const p of state.players) {
    const t = seen.get(p.id) ?? state.updatedAt;
    if (now - t > PRESENCE_STALE_MS) out[p.id] = t;
  }
  return out;
}

/** Free-tier hygiene: delete rooms older than ROOM_TTL_MS. Best-effort. */
export async function cleanupOldRooms() {
  try {
    const cutoff = new Date(Date.now() - ROOM_TTL_MS).toISOString();
    const { data } = await db().from('ww_rooms').delete().lt('created_at', cutoff).select('code');
    const codes = (data ?? []).map((r) => r.code as string);
    if (codes.length) await db().from('ww_presence').delete().in('code', codes);
  } catch (e) {
    console.warn('cleanup failed', e);
  }
}
