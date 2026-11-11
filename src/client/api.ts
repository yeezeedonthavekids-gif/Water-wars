import type { ApiRequest, ApiResponse, GameAction } from '../shared/types';
import { ensureUser } from './firebase';

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Server clock offset (serverNow - Date.now()), refreshed on every response. */
export let serverOffset = 0;
export const serverNow = () => Date.now() + serverOffset;
export function setServerOffset(v: number) {
  serverOffset = v;
}

export async function api(req: ApiRequest): Promise<ApiResponse> {
  const user = await ensureUser();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const token = await user.getIdToken(attempt > 0);
      const started = Date.now();
      const res = await fetch('/api', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(req),
      });
      const data = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!data) throw new ApiError('NETWORK', 'Could not reach the game server.');
      if (data.serverNow) serverOffset = data.serverNow - (started + Date.now()) / 2;
      if (res.status === 401 && attempt === 0) continue; // refresh token once
      if (!data.ok) throw new ApiError(data.error ?? 'ERROR', data.message ?? 'Something went wrong.');
      return data;
    } catch (e) {
      lastErr = e;
      if (e instanceof ApiError) throw e;
    }
  }
  throw lastErr instanceof ApiError ? lastErr : new ApiError('NETWORK', 'Could not reach the game server. Check your connection.');
}

export const act = (code: string, action: GameAction) => api({ op: 'action', code, action });
