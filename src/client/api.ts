import type { ApiRequest, ApiResponse, GameAction, RoomSnapshot } from '../shared/types';
import { ensureSession, resetSession } from './session';

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Server clock offset (serverNow - Date.now()), refreshed on every response. */
let serverOffset = 0;
export const serverNow = () => Date.now() + serverOffset;

// Every response that carries a room snapshot is published here, so the screen updates
// instantly after your own move without waiting for the realtime ping.
type Listener = (code: string, snap: RoomSnapshot | null) => void;
const listeners = new Set<Listener>();
export function onSnapshot(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResponse> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { token } = await ensureSession();
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(path, {
        method,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new ApiError('NETWORK', 'Could not reach the game server. Check your connection.');
    }
    const data = (await res.json().catch(() => null)) as ApiResponse | null;
    if (!data) throw new ApiError('NETWORK', 'Could not reach the game server.');
    if (data.serverNow) serverOffset = data.serverNow - (started + Date.now()) / 2;
    if (res.status === 401 && attempt === 0) {
      resetSession();
      continue;
    }
    if (!data.ok) throw new ApiError(data.error ?? 'ERROR', data.message ?? 'Something went wrong.');
    if (data.code && 'state' in data) listeners.forEach((l) => l(data.code!, data.state ?? null));
    return data;
  }
  throw new ApiError('UNAUTHENTICATED', 'Your session expired. Please reload the page.');
}

export const api = (req: ApiRequest) => request('POST', '/api', req);
export const fetchRoom = (code: string) => request('GET', `/api/state?code=${encodeURIComponent(code)}`);
export const act = (code: string, action: GameAction) => api({ op: 'action', code, action });
