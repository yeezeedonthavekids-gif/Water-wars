// Player identity without any sign-up: the server hands each browser a random id plus an HMAC signature.
// Clients can't forge another player's token without the server-only secret.
import { timingSafeEqual } from 'node:crypto';
import { sign } from './store';

export function newSession() {
  const uid = Buffer.from(crypto.getRandomValues(new Uint8Array(15))).toString('base64url');
  return { uid, token: `${uid}.${sign(`uid:${uid}`)}` };
}

export function verifySession(token: string): string | null {
  const [uid, sig] = token.split('.');
  if (!uid || !sig || !/^[A-Za-z0-9_-]{10,40}$/.test(uid)) return null;
  const expected = Buffer.from(sign(`uid:${uid}`));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got) ? uid : null;
}
