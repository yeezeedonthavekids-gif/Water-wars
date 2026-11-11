// Integration security test against the local emulators + dev API (run: node tests/security.mjs).
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, ref, set } from 'firebase/database';

const API = process.env.API ?? 'http://127.0.0.1:8787/api';
const cfg = { apiKey: 'demo-api-key', projectId: 'demo-water-wars', databaseURL: 'https://demo-water-wars-default-rtdb.firebaseio.com' };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };

async function client(name) {
  const app = initializeApp(cfg, name);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const { user } = await signInAnonymously(auth);
  const call = async (body, token) => {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', ...(token !== null ? { authorization: `Bearer ${token ?? await user.getIdToken()}` } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, ...(await r.json()) };
  };
  return { user, db, call };
}
const denied = async (p) => { try { await p; return false; } catch (e) { return /permission/i.test(String(e)); } };

const host = await client('host'), guest = await client('guest'), stranger = await client('stranger');
const noAuth = await host.call({ op: 'create', name: 'X' }, null);
check('unauthenticated request rejected (401)', noAuth.status === 401);
const forged = await host.call({ op: 'create', name: 'X' }, 'not-a-real-token');
check('forged token rejected (401)', forged.status === 401);

const { code } = await host.call({ op: 'create', name: 'Host' });
check('room created', /^[A-Z2-9]{5}$/.test(code));
check('bad code rejected', (await guest.call({ op: 'join', code: 'ZZ', name: 'G' })).error === 'BAD_CODE');
check('missing room rejected', (await guest.call({ op: 'join', code: 'ZZZZZ', name: 'G' })).error === 'ROOM_NOT_FOUND');
check('empty name rejected', (await guest.call({ op: 'join', code, name: '   ' })).error === 'BAD_NAME');
check('guest joins', (await guest.call({ op: 'join', code, name: 'Guest' })).ok);
check('non-host cannot start', (await guest.call({ op: 'start', code })).error === 'NOT_HOST');
check('start blocked until ready', (await host.call({ op: 'start', code })).error === 'NOT_READY');
await guest.call({ op: 'ready', code, ready: true });
check('host starts', (await host.call({ op: 'start', code })).ok);
check('late joiner rejected', (await stranger.call({ op: 'join', code, name: 'Late' })).error === 'IN_PROGRESS');

// Read rules
check('member can read public state', typeof (await get(ref(guest.db, `rooms/${code}/public`))).val() === 'string');
check('member can read own hand', typeof (await get(ref(guest.db, `rooms/${code}/private/${guest.user.uid}`))).val() === 'string');
check('member CANNOT read another hand', await denied(get(ref(guest.db, `rooms/${code}/private/${host.user.uid}`))));
check('member CANNOT read server secret state', await denied(get(ref(guest.db, `rooms/${code}/secret`))));
check('stranger CANNOT read room', await denied(get(ref(stranger.db, `rooms/${code}/public`))));
// Write rules
check('member CANNOT write public state', await denied(set(ref(guest.db, `rooms/${code}/public`), '{}')));
check('member CANNOT write own hand', await denied(set(ref(guest.db, `rooms/${code}/private/${guest.user.uid}`), '{"hand":[]}')));
check('member CANNOT add members', await denied(set(ref(stranger.db, `rooms/${code}/members/${stranger.user.uid}`), true)));
check('member can write own presence', !(await denied(set(ref(guest.db, `presence/${code}/${guest.user.uid}`), { online: true, at: 1 }))));
check('member CANNOT write others presence', await denied(set(ref(guest.db, `presence/${code}/${host.user.uid}`), { online: false, at: 1 })));
check('presence shape validated', await denied(set(ref(guest.db, `presence/${code}/${guest.user.uid}`), { online: 'yes', at: 1, hack: 1 })));

// Turn enforcement
const pub = JSON.parse((await get(ref(host.db, `rooms/${code}/public`))).val());
const curId = pub.turn.playerId;
const [cur, other] = curId === host.user.uid ? [host, guest] : [guest, host];
const otherHand = JSON.parse((await get(ref(other.db, `rooms/${code}/private/${other.user.uid}`))).val()).hand;
check('out-of-turn play rejected', (await other.call({ op: 'action', code, action: { type: 'play', cardId: otherHand[0] } })).error === 'NOT_YOUR_TURN');
check('playing a card you do not hold rejected', (await cur.call({ op: 'action', code, action: { type: 'play', cardId: otherHand[0] } })).error === 'NOT_IN_HAND');
check('early timeout rejected', (await other.call({ op: 'action', code, action: { type: 'timeout' } })).error === 'NOT_EXPIRED');
check('end turn before acting rejected', (await cur.call({ op: 'action', code, action: { type: 'endTurn' } })).error === 'MUST_ACT');
check('garbage action rejected', (await cur.call({ op: 'action', code, action: { type: 'win', score: 999 } })).error === 'BAD_ACTION');
check('stranger action rejected', (await stranger.call({ op: 'action', code, action: { type: 'draw' } })).error === 'NOT_IN_ROOM');
check('valid draw accepted', (await cur.call({ op: 'action', code, action: { type: 'draw' } })).ok);
check('double draw rejected', (await cur.call({ op: 'action', code, action: { type: 'draw' } })).error === 'ALREADY_DREW');

// Concurrency: fire many simultaneous end-turns; exactly one turn change must happen.
const results = await Promise.all(Array.from({ length: 6 }, () => cur.call({ op: 'action', code, action: { type: 'endTurn' } })));
const pub2 = JSON.parse((await get(ref(host.db, `rooms/${code}/public`))).val());
check(`concurrent duplicate actions serialised (${results.filter(r => r.ok).length} ok)`, results.filter(r => r.ok).length === 1 && pub2.turn.playerId === other.user.uid);
const pubText = (await get(ref(host.db, `rooms/${code}/public`))).val();
check('public state never contains answers or deck order', !/"answer"|"explain"|"deck"\s*:\s*\[/.test(pubText));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
