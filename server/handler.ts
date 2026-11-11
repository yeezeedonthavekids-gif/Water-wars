// HTTP handler for the game API. Used by the Netlify function and the local dev server.
// Every state change runs inside a Realtime Database transaction on /rooms/{code}, so concurrent
// actions are serialised and no client can write game state directly.
import type { ApiRequest, ApiResponse, Mode, PresenceEntry } from '../src/shared/types';
import {
  applyGameAction, claimHost, createState, GameError, joinRoom, kickPlayer, leaveRoom, rematch, renamePlayer,
  setMode, setReady, startGame, type Ctx, type GameState,
} from './engine';
import { admin, clientConfig, missingConfig } from './firebase';
import { serializeRoom, type RoomRecord } from './views';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-Z2-9]{5}$/;
const ROOM_TTL_MS = 8 * 60 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const ok = (extra: Partial<ApiResponse> = {}) => json({ ok: true, serverNow: Date.now(), ...extra });
const err = (error: string, message: string, status = 200) => json({ ok: false, error, message, serverNow: Date.now() }, status);

function genCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function rng() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

async function readOffline(code: string): Promise<Record<string, number>> {
  const snap = await admin().db.ref(`presence/${code}`).get();
  const out: Record<string, number> = {};
  const val = (snap.val() ?? {}) as Record<string, PresenceEntry>;
  for (const [uid, p] of Object.entries(val)) if (p && p.online === false) out[uid] = p.at;
  return out;
}

type Mutator = (s: GameState, ctx: Ctx) => 'deleted' | unknown;

async function mutateRoom(code: string, fn: Mutator, offline?: Record<string, number>) {
  const { db } = admin();
  const ref = db.ref(`rooms/${code}`);
  let gameErr: GameError | null = null;
  let deleted = false;
  const result = await ref.transaction(
    (cur: RoomRecord | null) => {
      gameErr = null;
      deleted = false;
      if (cur === null || typeof cur.secret !== 'string') return null; // not cached yet / missing
      const s = JSON.parse(cur.secret) as GameState;
      const ctx: Ctx = { now: Date.now(), rng, offline };
      try {
        if (fn(s, ctx) === 'deleted') {
          deleted = true;
          return null;
        }
      } catch (e) {
        if (e instanceof GameError) {
          gameErr = e;
          return cur; // unchanged write: verified against the server copy, so errors are never based on stale data
        }
        throw e;
      }
      s.version += 1;
      s.updatedAt = ctx.now;
      return serializeRoom(s);
    },
    undefined,
    false,
  );
  if (gameErr) throw gameErr;
  if (deleted) {
    await Promise.all([db.ref(`presence/${code}`).remove(), db.ref(`roomIndex/${code}`).remove()]);
    return;
  }
  if (!result.snapshot.exists()) throw new GameError('ROOM_NOT_FOUND', 'That room does not exist. Check the code!');
}

async function createRoom(uid: string, name: string, mode: Mode): Promise<string> {
  const { db } = admin();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = genCode();
    let created = false;
    const now = Date.now();
    const state = createState(code, uid, name, mode, now); // validates name (may throw)
    await db.ref(`rooms/${code}`).transaction(
      (cur) => {
        if (cur !== null) {
          created = false;
          return undefined; // code taken: abort and try another
        }
        created = true;
        return serializeRoom(state);
      },
      undefined,
      false,
    );
    if (created) {
      await db.ref(`roomIndex/${code}`).set(now);
      return code;
    }
  }
  throw new GameError('BUSY', 'Could not create a room. Please try again.');
}

/** Free-tier hygiene: remove rooms older than ROOM_TTL_MS. Best-effort. */
async function cleanupOldRooms() {
  try {
    const { db } = admin();
    const snap = await db.ref('roomIndex').orderByValue().endAt(Date.now() - ROOM_TTL_MS).limitToFirst(25).get();
    const updates: Record<string, null> = {};
    snap.forEach((child) => {
      updates[`rooms/${child.key}`] = null;
      updates[`presence/${child.key}`] = null;
      updates[`roomIndex/${child.key}`] = null;
    });
    if (Object.keys(updates).length) await db.ref().update(updates);
  } catch (e) {
    console.warn('cleanup failed', e);
  }
}

async function authenticate(req: Request): Promise<string | null> {
  const h = req.headers.get('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await admin().auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

const isMode = (m: unknown): m is Mode => m === 'classic' || m === 'battle';

export async function handleApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname.endsWith('/config')) {
    return json(clientConfig());
  }
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    return json({ ok: true, configured: missingConfig().length === 0, serverNow: Date.now() });
  }
  if (req.method !== 'POST') return err('METHOD', 'Use POST.', 405);
  if (missingConfig().length) return err('NOT_CONFIGURED', 'The game server is not configured yet.', 503);

  const raw = await req.text();
  if (raw.length > 4000) return err('TOO_LARGE', 'Request too large.', 413);
  let body: ApiRequest;
  try {
    body = JSON.parse(raw);
  } catch {
    return err('BAD_JSON', 'Invalid request.', 400);
  }
  if (!body || typeof body !== 'object' || typeof body.op !== 'string') return err('BAD_REQUEST', 'Invalid request.', 400);

  const uid = await authenticate(req);
  if (!uid) return err('UNAUTHENTICATED', 'Your session expired. Please reload the page.', 401);

  try {
    if (body.op === 'create') {
      const code = await createRoom(uid, body.name, isMode(body.mode) ? body.mode : 'classic');
      await cleanupOldRooms();
      return ok({ code });
    }

    const code = typeof (body as { code?: unknown }).code === 'string' ? (body as { code: string }).code.toUpperCase().trim() : '';
    if (!CODE_RE.test(code)) return err('BAD_CODE', 'Room codes are 5 letters/numbers.');

    switch (body.op) {
      case 'join':
        await mutateRoom(code, (s, ctx) => joinRoom(s, ctx, uid, body.name));
        break;
      case 'leave':
        await mutateRoom(code, (s, ctx) => leaveRoom(s, ctx, uid));
        break;
      case 'ready':
        await mutateRoom(code, (s) => setReady(s, uid, !!body.ready));
        break;
      case 'rename':
        await mutateRoom(code, (s, ctx) => renamePlayer(s, ctx, uid, body.name));
        break;
      case 'mode':
        if (!isMode(body.mode)) return err('BAD_MODE', 'Unknown mode.');
        await mutateRoom(code, (s) => setMode(s, uid, body.mode));
        break;
      case 'start':
        await mutateRoom(code, (s, ctx) => startGame(s, ctx, uid));
        break;
      case 'rematch':
        await mutateRoom(code, (s, ctx) => rematch(s, ctx, uid));
        break;
      case 'kick':
        if (typeof body.playerId !== 'string') return err('BAD_REQUEST', 'Invalid player.');
        await mutateRoom(code, (s, ctx) => kickPlayer(s, ctx, uid, body.playerId));
        break;
      case 'claimHost': {
        const offline = await readOffline(code);
        await mutateRoom(code, (s, ctx) => claimHost(s, ctx, uid), offline);
        break;
      }
      case 'action': {
        const action = body.action;
        if (!action || typeof action !== 'object' || typeof action.type !== 'string') return err('BAD_ACTION', 'Invalid action.');
        const offline = action.type === 'timeout' ? await readOffline(code) : undefined;
        await mutateRoom(code, (s, ctx) => applyGameAction(s, ctx, uid, action), offline);
        break;
      }
      default:
        return err('BAD_OP', 'Unknown operation.', 400);
    }
    return ok({ code });
  } catch (e) {
    if (e instanceof GameError) return err(e.code, e.message);
    console.error('API error', e);
    return err('SERVER', 'Something went wrong on the server. Please try again.', 500);
  }
}
