// HTTP handler for the game API. Used by the Netlify function and the local dev server.
// Clients never write game state: they send intents here, the engine validates them, and the result is
// committed with optimistic concurrency in Supabase.
import type { ApiRequest, ApiResponse, Mode, RoomSnapshot } from '../src/shared/types';
import {
  applyGameAction, claimHost, createState, GameError, joinRoom, kickPlayer, leaveRoom, rematch, renamePlayer,
  setMode, setReady, startGame, type GameState,
} from './engine';
import { newSession, verifySession } from './session';
import {
  cleanupOldRooms, clientConfig, createRoom, missingConfig, mutateRoom, offlinePlayers, readRoom, roomTopic, touch,
  type Mutator,
} from './store';
import { publicView } from './views';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-Z2-9]{5}$/;

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

/** The caller's personal view: public state + only their own hand. */
function snapshot(s: GameState | null, uid: string): RoomSnapshot | null {
  if (!s) return null;
  const me = s.players.find((p) => p.id === uid);
  if (!me || me.status === 'left') return null;
  return { version: s.version, public: publicView(s), hand: s.hands[uid] ?? [], topic: roomTopic(s.code) };
}

function authenticate(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? verifySession(h.slice(7)) : null;
}

const isMode = (m: unknown): m is Mode => m === 'classic' || m === 'battle';
const parseCode = (raw: unknown) => (typeof raw === 'string' ? raw.toUpperCase().trim() : '');

export async function handleApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  try {
    if (req.method === 'GET' && path.endsWith('/config')) return json(clientConfig());
    if (req.method === 'GET' && path.endsWith('/health')) {
      return json({ ok: true, configured: missingConfig().length === 0, serverNow: Date.now() });
    }
    if (missingConfig().length) return err('NOT_CONFIGURED', 'The game server is not configured yet.', 503);

    // GET /api/state?code=XXXXX : my current view of a room (also acts as a "still connected" heartbeat).
    if (req.method === 'GET' && path.endsWith('/state')) {
      const uid = authenticate(req);
      if (!uid) return err('UNAUTHENTICATED', 'Your session expired. Please reload the page.', 401);
      const code = parseCode(url.searchParams.get('code'));
      if (!CODE_RE.test(code)) return err('BAD_CODE', 'Room codes are 5 letters/numbers.');
      const s = await readRoom(code);
      const snap = snapshot(s, uid);
      if (!snap) return err('NOT_IN_ROOM', 'You are not in this room.');
      await touch(code, uid);
      return ok({ code, state: snap });
    }

    if (req.method !== 'POST') return err('METHOD', 'Use POST.', 405);
    const raw = await req.text();
    if (raw.length > 4000) return err('TOO_LARGE', 'Request too large.', 413);
    let body: ApiRequest;
    try {
      body = JSON.parse(raw);
    } catch {
      return err('BAD_JSON', 'Invalid request.', 400);
    }
    if (!body || typeof body !== 'object' || typeof body.op !== 'string') return err('BAD_REQUEST', 'Invalid request.', 400);

    if (body.op === 'session') return ok(newSession());

    const uid = authenticate(req);
    if (!uid) return err('UNAUTHENTICATED', 'Your session expired. Please reload the page.', 401);

    if (body.op === 'create') {
      const mode = isMode(body.mode) ? body.mode : 'classic';
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = genCode();
        const state = createState(code, uid, body.name, mode, Date.now()); // validates name (may throw)
        if (await createRoom(code, state)) {
          await Promise.all([touch(code, uid), cleanupOldRooms()]);
          return ok({ code, state: snapshot(state, uid) });
        }
      }
      return err('BUSY', 'Could not create a room. Please try again.');
    }

    const code = parseCode((body as { code?: unknown }).code);
    if (!CODE_RE.test(code)) return err('BAD_CODE', 'Room codes are 5 letters/numbers.');

    let fn: Mutator;
    let offline: Record<string, number> | undefined;
    switch (body.op) {
      case 'join':
        fn = (s, ctx) => joinRoom(s, ctx, uid, body.name);
        break;
      case 'leave':
        fn = (s, ctx) => leaveRoom(s, ctx, uid);
        break;
      case 'ready':
        fn = (s) => setReady(s, uid, !!body.ready);
        break;
      case 'rename':
        fn = (s, ctx) => renamePlayer(s, ctx, uid, body.name);
        break;
      case 'mode':
        if (!isMode(body.mode)) return err('BAD_MODE', 'Unknown mode.');
        fn = (s) => setMode(s, uid, body.mode);
        break;
      case 'start':
        fn = (s, ctx) => startGame(s, ctx, uid);
        break;
      case 'rematch':
        fn = (s, ctx) => rematch(s, ctx, uid);
        break;
      case 'kick':
        if (typeof body.playerId !== 'string') return err('BAD_REQUEST', 'Invalid player.');
        fn = (s, ctx) => kickPlayer(s, ctx, uid, body.playerId);
        break;
      case 'claimHost':
        offline = await offlinePlayers(code);
        fn = (s, ctx) => claimHost(s, ctx, uid);
        break;
      case 'action': {
        const action = body.action;
        if (!action || typeof action !== 'object' || typeof action.type !== 'string') return err('BAD_ACTION', 'Invalid action.');
        if (action.type === 'timeout') offline = await offlinePlayers(code);
        fn = (s, ctx) => applyGameAction(s, ctx, uid, action);
        break;
      }
      default:
        return err('BAD_OP', 'Unknown operation.', 400);
    }
    const next = await mutateRoom(code, fn, offline);
    if (body.op !== 'leave') await touch(code, uid);
    return ok({ code, state: snapshot(next, uid) });
  } catch (e) {
    if (e instanceof GameError) return err(e.code, e.message);
    console.error('API error', e);
    return err('SERVER', 'Something went wrong on the server. Please try again.', 500);
  }
}
