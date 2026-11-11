// Integration security test against a running API + Supabase.
// Run with the dev API up (npm run dev):  npm run test:security
// Env: API (default http://127.0.0.1:8787/api), SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (public key, to prove it can't touch game data).
import { createClient } from '@supabase/supabase-js';

const API = process.env.API ?? 'http://127.0.0.1:8787/api';
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };

async function call(method, path, body, token) {
  const r = await fetch(API + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
}
async function player() {
  const s = await call('POST', '', { op: 'session' });
  return {
    uid: s.uid, token: s.token,
    post: (b) => call('POST', '', b, s.token),
    state: (code) => call('GET', `/state?code=${code}`, null, s.token),
  };
}

const cfg = await (await fetch(API + '/config')).json();
const host = await player(), guest = await player(), stranger = await player();

// ── Identity ──
check('session issues uid + signed token', !!host.uid && host.token.startsWith(host.uid + '.'));
check('unauthenticated request rejected (401)', (await call('POST', '', { op: 'create', name: 'X' })).status === 401);
check('forged token rejected (401)', (await call('POST', '', { op: 'create', name: 'X' }, 'abcdefghijkl.fake')).status === 401);
check('impersonation (other uid + my signature) rejected', (await call('POST', '', { op: 'create', name: 'X' }, `${guest.uid}.${host.token.split('.')[1]}`)).status === 401);
check('oversized request rejected', (await call('POST', '', 'x'.repeat(5000), host.token)).status === 413);

// ── Lobby rules ──
const created = await host.post({ op: 'create', name: 'Host' });
const code = created.code;
check('room created', /^[A-Z2-9]{5}$/.test(code));
check('bad code rejected', (await guest.post({ op: 'join', code: 'ZZ', name: 'G' })).error === 'BAD_CODE');
check('missing room rejected', (await guest.post({ op: 'join', code: 'ZZZZZ', name: 'G' })).error === 'ROOM_NOT_FOUND');
check('empty name rejected', (await guest.post({ op: 'join', code, name: '   ' })).error === 'BAD_NAME');
check('stranger cannot read room state', (await stranger.state(code)).error === 'NOT_IN_ROOM');
check('guest joins', (await guest.post({ op: 'join', code, name: 'Guest' })).ok);
check('non-host cannot start', (await guest.post({ op: 'start', code })).error === 'NOT_HOST');
check('non-host cannot change mode', (await guest.post({ op: 'mode', code, mode: 'battle' })).error === 'NOT_HOST');
check('start blocked until everyone is ready', (await host.post({ op: 'start', code })).error === 'NOT_READY');
await guest.post({ op: 'ready', code, ready: true });
check('host starts', (await host.post({ op: 'start', code })).ok);
check('late joiner rejected', (await stranger.post({ op: 'join', code, name: 'Late' })).error === 'IN_PROGRESS');

// ── What a member can see ──
const hs = (await host.state(code)).state, gs = (await guest.state(code)).state;
check('member sees public state + own hand', hs.hand.length > 0 && hs.public.code === code);
const raw = JSON.stringify(hs);
check('state response has no other hands, deck order or answer key', !/"hands"|"deck"\s*:|"answer"|"explain"|"usedQuestions"/.test(raw));
check('other players see only hand counts', hs.public.players.find((p) => p.id === guest.uid).handCount === gs.hand.length);
check('realtime channel name is unguessable (not just the room code)', hs.topic !== code && hs.topic.length > 20);

// ── Database locked against the public browser key ──
if (cfg.supabase) {
  const pub = createClient(cfg.supabase.url, cfg.supabase.publishableKey, { auth: { persistSession: false } });
  const r1 = await pub.from('ww_rooms').select('*');
  check('public key CANNOT read rooms table', !!r1.error || (r1.data ?? []).length === 0);
  const r2 = await pub.from('ww_rooms').insert({ code: 'HACKD', state: {}, version: 1 });
  check('public key CANNOT insert rooms', !!r2.error);
  const r3 = await pub.from('ww_rooms').update({ version: 999 }).eq('code', code).select();
  check('public key CANNOT modify a room', !!r3.error || (r3.data ?? []).length === 0);
  const r4 = await pub.from('ww_presence').select('*');
  check('public key CANNOT read presence table', !!r4.error || (r4.data ?? []).length === 0);
  const r5 = await pub.from('ww_rooms').delete().eq('code', code).select();
  check('public key CANNOT delete a room', !!r5.error || (r5.data ?? []).length === 0);
  check('room still intact after attacks', (await host.state(code)).ok);
}

// ── Turn enforcement ──
const curId = hs.public.turn.playerId;
const [cur, other] = curId === host.uid ? [host, guest] : [guest, host];
const otherHand = (await other.state(code)).state.hand;
check('out-of-turn play rejected', (await other.post({ op: 'action', code, action: { type: 'play', cardId: otherHand[0] } })).error === 'NOT_YOUR_TURN');
check("playing someone else's card rejected", (await cur.post({ op: 'action', code, action: { type: 'play', cardId: otherHand[0] } })).error === 'NOT_IN_HAND');
check('early timeout rejected', (await other.post({ op: 'action', code, action: { type: 'timeout' } })).error === 'NOT_EXPIRED');
check('ending turn before acting rejected', (await cur.post({ op: 'action', code, action: { type: 'endTurn' } })).error === 'MUST_ACT');
check('made-up action rejected', (await cur.post({ op: 'action', code, action: { type: 'win', score: 999 } })).error === 'BAD_ACTION');
check('answering a question that does not exist rejected', (await cur.post({ op: 'action', code, action: { type: 'answer', choice: 0 } })).error === 'NO_QUESTION');
check('stranger action rejected', (await stranger.post({ op: 'action', code, action: { type: 'draw' } })).error === 'NOT_IN_ROOM');
check('valid draw accepted', (await cur.post({ op: 'action', code, action: { type: 'draw' } })).ok);
check('second draw in same turn rejected', (await cur.post({ op: 'action', code, action: { type: 'draw' } })).error === 'ALREADY_DREW');

// ── Concurrency: 6 identical requests at once must apply exactly once ──
const results = await Promise.all(Array.from({ length: 6 }, () => cur.post({ op: 'action', code, action: { type: 'endTurn' } })));
const after = (await host.state(code)).state.public;
check(`concurrent duplicates serialised (${results.filter((r) => r.ok).length} of 6 applied)`, results.filter((r) => r.ok).length === 1 && after.turn.playerId === other.uid);

// ── Leaving ──
check('player can leave', (await guest.post({ op: 'leave', code })).ok);
check('player who left can no longer read the room', (await guest.state(code)).error === 'NOT_IN_ROOM');

// ── Lobby races & host handover ──
const h2 = await player();
const code2 = (await h2.post({ op: 'create', name: 'Host2' })).code;
const crowd = await Promise.all(Array.from({ length: 8 }, () => player()));
const joins = await Promise.all(crowd.map((p, i) => p.post({ op: 'join', code: code2, name: `P${i}` })));
const lobby = (await h2.state(code2)).state.public;
check(`8 simultaneous joins into a 6-seat room: ${joins.filter((j) => j.ok).length} admitted, room has ${lobby.players.length}`, joins.filter((j) => j.ok).length === 5 && lobby.players.length === 6 && joins.filter((j) => j.error === 'ROOM_FULL').length === 3);
await h2.post({ op: 'leave', code: code2 });
const lobby2 = (await crowd.find((_, i) => joins[i].ok).state(code2)).state.public;
check('host leaving hands host to another player', lobby2.hostId !== h2.uid && lobby2.players.some((p) => p.id === lobby2.hostId));
const members = crowd.filter((_, i) => joins[i].ok);
await Promise.all(members.map((p) => p.post({ op: 'leave', code: code2 })));
check('room is deleted when the last player leaves', (await members[0].post({ op: 'join', code: code2, name: 'Back' })).error === 'ROOM_NOT_FOUND');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
