// Server-authoritative Water Wars game engine.
// Pure functions that mutate a GameState. No I/O; randomness and time are injected.
import {
  buildDeckIds, classicPlayable, defOf, isPropertyCard, isStackable, needsTarget, PROPERTY_LABEL, type CardDef,
} from '../src/shared/cards';
import {
  BATTLE_HP, MAX_PLAYERS, MIN_PLAYERS,
  type GameAction, type LastAction, type LogEntry, type Mode, type Phase, type PlayerStats, type PlayerStatus,
  type Property, type QuestionResult, type ResultRow,
} from '../src/shared/types';
import { CHALLENGE_QUESTION, CLASSIFY_OPTIONS, QUESTION_MAP, QUESTIONS, REALWORLD, type Topic } from './answers';

export class GameError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
const fail = (code: string, message: string): never => {
  throw new GameError(code, message);
};

// ───────────────────────── Tunables ─────────────────────────
export const TURN_MS = 90_000;
export const QUESTION_MS = 45_000;
export const TRADE_MS = 30_000;
export const OFFLINE_GRACE_MS = 20_000;
export const FREE_ACTION_EXTEND_MS = 30_000;
export const CLASSIC_HAND = 7;
export const BATTLE_HAND = 5;
export const CLASSIC_ROUNDS = 20;
export const BATTLE_ROUNDS = 20;
export const DROUGHT_ROUND = 10;
/** Bigger Battle games start the drought sooner so they still fit in a class period. */
export function droughtRound(players: number) {
  return players <= 4 ? DROUGHT_ROUND : players <= 7 ? 8 : 6;
}
const droughtDamage = (s: { round: number; players: unknown[] }) => (s.round - droughtRound(s.players.length) > 3 ? 2 : 1);
export const BATTLE_HAND_LIMIT = 8;
export const SHIELD_CAP = 8;
export const SET_BONUS_CORRECT = 6;
export const SET_BONUS_WRONG = 2;
const LOG_LIMIT = 40;

export interface Ctx {
  now: number;
  rng: () => number;
  /** uid -> timestamp they went offline (only for players currently offline) */
  offline?: Record<string, number>;
}

export interface PlayerState {
  id: string;
  name: string;
  avatar: number;
  ready: boolean;
  status: PlayerStatus;
  score: number;
  hp: number;
  shield: number;
  boost: boolean;
  sets: number;
  stats: PlayerStats;
  placement?: number;
  joinedAt: number;
  called?: boolean;
}

type Purpose =
  | { type: 'challenge'; challengerId: string; targetId: string; cardId: string }
  | { type: 'set'; property: Property }
  | { type: 'realworld'; cardId: string; targetId?: string; property?: Property }
  | { type: 'boost'; cardId: string; targetId: string; base: number }
  | { type: 'combo'; cardIds: string[]; targetId: string; base: number }
  | { type: 'star'; cardId: string };

export interface PendingQuestion {
  kind: 'question';
  id: string;
  responderId: string;
  askerId: string;
  title: string;
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
  deadline: number;
  stakes: string;
  cardId?: string;
  /** free actions keep the turn going after the question resolves */
  free: boolean;
  purpose: Purpose;
}

export interface PendingTrade {
  kind: 'trade';
  id: string;
  fromId: string;
  toId: string;
  giveCardId: string;
  wantProperty: Property;
  deadline: number;
}

export interface TurnState {
  idx: number;
  number: number;
  dir: 1 | -1;
  stage: 'start' | 'afterDraw';
  setDone: boolean;
  tradeDone: boolean;
  powerDone: boolean;
  deadline: number;
}

export interface GameState {
  code: string;
  version: number;
  phase: Phase;
  mode: Mode;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  players: PlayerState[];
  deck: string[];
  discard: string[];
  hands: Record<string, string[]>;
  turn: TurnState | null;
  round: number;
  turnsInRound: number;
  activeProperty: Property | null;
  pending: PendingQuestion | PendingTrade | null;
  lastQuestion: QuestionResult | null;
  lastAction: LastAction | null;
  log: LogEntry[];
  seq: number;
  usedQuestions: string[];
  results: ResultRow[] | null;
  winnerIds: string[];
  /** Set while resolving a question that grants the asker another turn. */
  extraTurn?: boolean;
  /** Battle starting/maximum HP for this game. */
  maxHp?: number;
  /** Classic: pending draw total that the current player must take or stack. */
  drawStack?: number;
}

// ───────────────────────── Helpers ─────────────────────────
const freshStats = (): PlayerStats => ({ correct: 0, wrong: 0, damage: 0, kos: 0, played: 0 });

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') fail('BAD_NAME', 'Please enter a name.');
  const name = (raw as string).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!name) fail('BAD_NAME', 'Please enter a name.');
  return name;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const pickRandom = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

function log(s: GameState, ctx: Ctx, text: string, kind: LogEntry['kind'] = 'play', actorId?: string) {
  s.seq += 1;
  s.log.push({ seq: s.seq, at: ctx.now, text, kind, actorId });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

function setLast(s: GameState, ctx: Ctx, a: Omit<LastAction, 'seq' | 'at'>) {
  s.seq += 1;
  s.lastAction = { ...a, seq: s.seq, at: ctx.now };
}

export const getPlayer = (s: GameState, id: string) => s.players.find((p) => p.id === id);
function mustPlayer(s: GameState, id: string): PlayerState {
  const p = getPlayer(s, id);
  if (!p) fail('NOT_IN_ROOM', 'You are not in this room.');
  return p as PlayerState;
}
const activePlayers = (s: GameState) => s.players.filter((p) => p.status === 'active');
const currentPlayer = (s: GameState) => (s.turn ? s.players[s.turn.idx] : undefined);
const hand = (s: GameState, id: string) => (s.hands[id] ??= []);
const nameOf = (s: GameState, id: string) => getPlayer(s, id)?.name ?? 'Someone';

function removeFromHand(s: GameState, pid: string, cardId: string) {
  const h = hand(s, pid);
  const i = h.indexOf(cardId);
  if (i < 0) fail('NOT_IN_HAND', 'That card is not in your hand.');
  h.splice(i, 1);
}

/** Draw up to n cards, reshuffling the discard pile (except its top card) when the deck runs out. */
function drawCards(s: GameState, ctx: Ctx, pid: string, n: number): number {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length <= 1) break;
      const top = s.discard.pop()!;
      s.deck = shuffle(s.discard, ctx.rng);
      s.discard = [top];
      log(s, ctx, 'The discard pile was reshuffled into the deck.', 'system');
    }
    const c = s.deck.pop();
    if (!c) break;
    hand(s, pid).push(c);
    drawn++;
  }
  return drawn;
}

function pickQuestion(s: GameState, ctx: Ctx, topic: Topic, props?: Property[]) {
  let pool = QUESTIONS.filter((q) => q.topic === topic);
  if (topic === 'combo' && props && props.length === 2) {
    const exact = pool.filter((q) => q.props && props.every((p) => q.props!.includes(p)));
    if (exact.length) pool = exact;
  }
  let fresh = pool.filter((q) => !s.usedQuestions.includes(q.id));
  if (!fresh.length) {
    s.usedQuestions = s.usedQuestions.filter((id) => !pool.some((q) => q.id === id));
    fresh = pool;
  }
  const q = pickRandom(fresh, ctx.rng);
  s.usedQuestions.push(q.id);
  return q;
}

function askQuestion(
  s: GameState, ctx: Ctx,
  opts: {
    responderId: string; askerId: string; title: string; prompt: string; options: string[];
    answer: number; explain: string; stakes: string; cardId?: string; free?: boolean; purpose: Purpose;
  },
) {
  s.seq += 1;
  s.pending = {
    kind: 'question',
    id: `q${s.seq}`,
    deadline: ctx.now + QUESTION_MS,
    free: !!opts.free,
    ...opts,
  };
}

function askBankQuestion(
  s: GameState, ctx: Ctx, topic: Topic, props: Property[] | undefined,
  base: { responderId: string; askerId: string; title: string; stakes: string; cardId?: string; free?: boolean; purpose: Purpose },
) {
  const q = pickQuestion(s, ctx, topic, props);
  askQuestion(s, ctx, { ...base, prompt: q.prompt, options: q.options, answer: q.answer, explain: q.explain });
}

function nextIdx(s: GameState, from: number, steps = 1): number {
  const n = s.players.length;
  const dir = s.turn?.dir ?? 1;
  let idx = from;
  let moved = 0;
  if (activePlayers(s).length === 0) return from;
  while (moved < steps) {
    idx = (((idx + dir) % n) + n) % n;
    if (s.players[idx].status === 'active') moved++;
  }
  return idx;
}

/** Starting (and maximum) HP in Battle: lower in big rooms so games still fit in a class period. */
export function battleHp(players: number) {
  return players <= 6 ? BATTLE_HP : players <= 8 ? 16 : 14;
}

function heal(s: GameState, p: PlayerState, n: number) {
  p.hp = Math.min(s.maxHp ?? BATTLE_HP, p.hp + n);
}

/** Battle damage with shields and knockouts. Returns damage actually taken. */
function dealDamage(s: GameState, ctx: Ctx, attackerId: string | null, targetId: string, amount: number): number {
  const t = getPlayer(s, targetId);
  if (!t || t.status !== 'active' || amount <= 0) return 0;
  let dmg = amount;
  if (t.shield > 0) {
    const absorbed = Math.min(t.shield, dmg);
    t.shield -= absorbed;
    dmg -= absorbed;
    if (absorbed) log(s, ctx, `${t.name}'s shield absorbed ${absorbed} damage.`, 'system', t.id);
  }
  if (dmg <= 0) return 0;
  t.hp -= dmg;
  if (attackerId) {
    const a = getPlayer(s, attackerId);
    if (a) {
      a.stats.damage += dmg;
      a.score += dmg;
    }
  }
  if (t.hp <= 0) knockOut(s, ctx, t, attackerId);
  return dmg;
}

function knockOut(s: GameState, ctx: Ctx, t: PlayerState, attackerId: string | null) {
  t.hp = 0;
  t.status = 'out';
  t.shield = 0;
  t.placement = activePlayers(s).length + 1;
  s.discard.unshift(...hand(s, t.id));
  s.hands[t.id] = [];
  if (attackerId && attackerId !== t.id) {
    const a = getPlayer(s, attackerId);
    if (a) {
      a.stats.kos += 1;
      a.score += 5;
    }
    log(s, ctx, `💥 ${t.name}'s drop evaporated! Knocked out by ${nameOf(s, attackerId)}.`, 'bad', t.id);
  } else {
    log(s, ctx, `💥 ${t.name}'s drop evaporated!`, 'bad', t.id);
  }
}

/** Classic shield: blocks one targeted effect. Returns true if blocked. */
function classicShieldBlocks(s: GameState, ctx: Ctx, targetId: string, what: string): boolean {
  const t = getPlayer(s, targetId);
  if (t && t.shield > 0) {
    t.shield = 0;
    log(s, ctx, `🛡️ ${t.name}'s Surface Shield blocked ${what}!`, 'good', t.id);
    return true;
  }
  return false;
}

function requireTarget(s: GameState, actorId: string, targetId: string | undefined): PlayerState {
  if (!targetId) fail('NEED_TARGET', 'Choose an opponent to target.');
  if (targetId === actorId) fail('BAD_TARGET', 'You cannot target yourself.');
  const t = getPlayer(s, targetId!);
  if (!t || t.status !== 'active') fail('BAD_TARGET', 'That player cannot be targeted.');
  return t as PlayerState;
}

// ───────────────────────── Lobby ─────────────────────────
export function createState(code: string, hostId: string, rawName: string, mode: Mode, now: number): GameState {
  const name = sanitizeName(rawName);
  const s: GameState = {
    code, version: 1, phase: 'lobby', mode, hostId, createdAt: now, updatedAt: now, startedAt: null,
    players: [], deck: [], discard: [], hands: {}, turn: null, round: 1, turnsInRound: 0,
    activeProperty: null, pending: null, lastQuestion: null, lastAction: null, log: [], seq: 0,
    usedQuestions: [], results: null, winnerIds: [],
  };
  s.players.push(newPlayer(hostId, name, 0, now));
  s.players[0].ready = true;
  log(s, { now, rng: Math.random }, `${name} created the room.`, 'join', hostId);
  return s;
}

function newPlayer(id: string, name: string, avatar: number, now: number): PlayerState {
  return {
    id, name, avatar, ready: false, status: 'active', score: 0, hp: BATTLE_HP, shield: 0, boost: false, sets: 0,
    stats: freshStats(), joinedAt: now,
  };
}

export function joinRoom(s: GameState, ctx: Ctx, uid: string, rawName: string): 'joined' | 'rejoined' {
  const name = sanitizeName(rawName);
  const existing = getPlayer(s, uid);
  if (existing) {
    if (existing.status === 'left') fail('LEFT', 'You left this game. Wait for the rematch to rejoin.');
    if (s.phase === 'lobby' && existing.name !== name) existing.name = name;
    return 'rejoined';
  }
  if (s.phase !== 'lobby') fail('IN_PROGRESS', 'That game has already started. Ask the host for a rematch!');
  if (s.players.length >= MAX_PLAYERS) fail('ROOM_FULL', `This room is full (${MAX_PLAYERS} players max).`);
  const used = new Set(s.players.map((p) => p.avatar));
  let avatar = 0;
  while (used.has(avatar)) avatar++;
  s.players.push(newPlayer(uid, name, avatar, ctx.now));
  log(s, ctx, `${name} joined the room.`, 'join', uid);
  return 'joined';
}

export function leaveRoom(s: GameState, ctx: Ctx, uid: string): 'deleted' | 'ok' {
  const p = mustPlayer(s, uid);
  if (s.phase === 'playing' && p.status !== 'left') {
    const wasCurrent = currentPlayer(s)?.id === uid;
    const wasActive = p.status === 'active';
    p.status = 'left';
    s.discard.unshift(...hand(s, uid));
    s.hands[uid] = [];
    log(s, ctx, `${p.name} left the game.`, 'system', uid);
    // Resolve anything waiting on this player.
    let handled = false;
    if (s.pending) {
      if (s.pending.kind === 'question' && s.pending.responderId === uid) {
        resolveQuestion(s, ctx, -1);
        handled = true;
      } else if (s.pending.kind === 'trade' && (s.pending.toId === uid || s.pending.fromId === uid)) {
        s.pending = null;
        log(s, ctx, 'The trade was cancelled.', 'system');
      }
    }
    if (s.phase !== 'playing') return 'ok';
    if (activePlayers(s).length <= 1) {
      finishGame(s, ctx, 'Not enough players left.');
      return 'ok';
    }
    if (!handled && wasActive && wasCurrent && !(s.pending && s.pending.kind === 'question')) {
      s.pending = null;
      advanceTurn(s, ctx, 1);
    }
  } else if (s.phase !== 'playing') {
    s.players = s.players.filter((x) => x.id !== uid);
    delete s.hands[uid];
    log(s, ctx, `${p.name} left the room.`, 'system', uid);
  }
  const remaining = s.players.filter((x) => x.status !== 'left');
  if (remaining.length === 0) return 'deleted';
  if (s.hostId === uid) {
    s.hostId = remaining[0].id;
    remaining[0].ready = true;
    log(s, ctx, `${remaining[0].name} is now the host.`, 'system', remaining[0].id);
  }
  return 'ok';
}

export function kickPlayer(s: GameState, ctx: Ctx, uid: string, targetId: string) {
  if (s.hostId !== uid) fail('NOT_HOST', 'Only the host can remove players.');
  if (s.phase !== 'lobby') fail('BAD_PHASE', 'Players can only be removed in the lobby.');
  if (targetId === uid) fail('BAD_TARGET', 'You cannot remove yourself.');
  const t = mustPlayer(s, targetId);
  s.players = s.players.filter((x) => x.id !== targetId);
  log(s, ctx, `${t.name} was removed by the host.`, 'system');
}

export function setReady(s: GameState, uid: string, ready: boolean) {
  if (s.phase !== 'lobby') fail('BAD_PHASE', 'The game already started.');
  mustPlayer(s, uid).ready = !!ready;
}

export function renamePlayer(s: GameState, ctx: Ctx, uid: string, rawName: string) {
  if (s.phase !== 'lobby') fail('BAD_PHASE', 'Names can only change in the lobby.');
  const p = mustPlayer(s, uid);
  const name = sanitizeName(rawName);
  if (name !== p.name) log(s, ctx, `${p.name} is now ${name}.`, 'system', uid);
  p.name = name;
}

export function setMode(s: GameState, uid: string, mode: Mode) {
  if (s.hostId !== uid) fail('NOT_HOST', 'Only the host can choose the mode.');
  if (s.phase !== 'lobby') fail('BAD_PHASE', 'The game already started.');
  if (mode !== 'classic' && mode !== 'battle') fail('BAD_MODE', 'Unknown game mode.');
  s.mode = mode;
}

export function claimHost(s: GameState, ctx: Ctx, uid: string) {
  const me = mustPlayer(s, uid);
  if (s.hostId === uid) return;
  const host = getPlayer(s, s.hostId);
  const offlineSince = ctx.offline?.[s.hostId];
  const hostGone = !host || host.status === 'left' || (offlineSince !== undefined && ctx.now - offlineSince > OFFLINE_GRACE_MS);
  if (!hostGone) fail('HOST_ONLINE', 'The host is still connected.');
  s.hostId = uid;
  me.ready = true;
  log(s, ctx, `${me.name} is now the host.`, 'system', uid);
}

export function startGame(s: GameState, ctx: Ctx, uid: string) {
  if (s.hostId !== uid) fail('NOT_HOST', 'Only the host can start the game.');
  if (s.phase !== 'lobby') fail('BAD_PHASE', 'The game already started.');
  if (s.players.length < MIN_PLAYERS) fail('NOT_ENOUGH', `You need at least ${MIN_PLAYERS} players.`);
  const notReady = s.players.filter((p) => p.id !== s.hostId && !p.ready);
  if (notReady.length) fail('NOT_READY', `Waiting for ${notReady.map((p) => p.name).join(', ')} to be ready.`);

  s.phase = 'playing';
  s.startedAt = ctx.now;
  s.deck = shuffle(buildDeckIds(), ctx.rng);
  s.discard = [];
  s.hands = {};
  s.pending = null;
  s.lastQuestion = null;
  s.lastAction = null;
  s.results = null;
  s.winnerIds = [];
  s.usedQuestions = [];
  s.round = 1;
  s.turnsInRound = 0;
  s.activeProperty = null;
  s.drawStack = 0;
  shuffle(s.players, ctx.rng);
  s.maxHp = battleHp(s.players.length);
  for (const p of s.players) {
    Object.assign(p, { status: 'active', score: 0, hp: s.maxHp, shield: 0, boost: false, sets: 0, stats: freshStats(), called: false });
    delete p.placement;
    s.hands[p.id] = [];
    drawCards(s, ctx, p.id, s.mode === 'classic' ? CLASSIC_HAND : BATTLE_HAND);
  }
  if (s.mode === 'classic') {
    // Flip the first property card to start the pile.
    for (let i = s.deck.length - 1; i >= 0; i--) {
      if (isPropertyCard(defOf(s.deck[i]))) {
        const [c] = s.deck.splice(i, 1);
        s.discard.push(c);
        s.activeProperty = defOf(c).category as Property;
        break;
      }
    }
  }
  log(s, ctx, `Game on! ${s.mode === 'classic' ? 'Classic' : 'Battle'} mode with ${s.players.length} players.`, 'system');
  s.turn = { idx: 0, number: 0, dir: 1, stage: 'start', setDone: false, tradeDone: false, powerDone: false, deadline: 0 };
  beginTurn(s, ctx, 0);
}

export function rematch(s: GameState, ctx: Ctx, uid: string) {
  if (s.hostId !== uid) fail('NOT_HOST', 'Only the host can start a rematch.');
  if (s.phase !== 'finished') fail('BAD_PHASE', 'The game is not over yet.');
  s.players = s.players.filter((p) => p.status !== 'left');
  for (const p of s.players) {
    Object.assign(p, { status: 'active', score: 0, hp: BATTLE_HP, shield: 0, boost: false, sets: 0, stats: freshStats(), called: false, ready: p.id === s.hostId });
    delete p.placement;
  }
  Object.assign(s, {
    phase: 'lobby', deck: [], discard: [], hands: {}, turn: null, pending: null, lastQuestion: null,
    lastAction: null, results: null, winnerIds: [], activeProperty: null, round: 1, turnsInRound: 0, startedAt: null, drawStack: 0,
  });
  log(s, ctx, 'Rematch! Back to the lobby.', 'system');
}

// ───────────────────────── Turn flow ─────────────────────────
function maxRounds(s: GameState) {
  return s.mode === 'classic' ? CLASSIC_ROUNDS : BATTLE_ROUNDS;
}

function beginTurn(s: GameState, ctx: Ctx, idx: number, guard = 0) {
  const t = s.turn!;
  t.idx = idx;
  t.number += 1;
  t.stage = 'start';
  t.setDone = false;
  t.tradeDone = false;
  t.powerDone = false;
  t.deadline = ctx.now + TURN_MS;
  const p = s.players[idx];
  if (s.mode === 'battle') {
    if (s.round > droughtRound(s.players.length)) {
      const dmg = droughtDamage(s);
      log(s, ctx, `☀️ Drought! ${p.name} loses ${dmg} HP to evaporation.`, 'bad', p.id);
      dealDamage(s, ctx, null, p.id, dmg);
      if (p.status !== 'active') {
        if (checkGameEnd(s, ctx)) return;
        if (guard < s.players.length) return advanceTurn(s, ctx, 1, guard + 1);
        return;
      }
    }
    if (hand(s, p.id).length < BATTLE_HAND_LIMIT) drawCards(s, ctx, p.id, 1);
  }
}

function advanceTurn(s: GameState, ctx: Ctx, steps: number, guard = 0) {
  if (s.phase !== 'playing') return;
  s.turnsInRound += 1;
  if (s.turnsInRound >= activePlayers(s).length) {
    s.round += 1;
    s.turnsInRound = 0;
    if (s.round > maxRounds(s)) {
      finishGame(s, ctx, `Round limit reached.`);
      return;
    }
    if (s.mode === 'battle' && s.round === droughtRound(s.players.length) + 1) {
      log(s, ctx, '☀️ The drought begins: every drop loses HP at the start of its turn!', 'system');
    }
    if (s.mode === 'battle' && s.round === droughtRound(s.players.length) + 4) {
      log(s, ctx, '🔥 The drought gets worse: 2 HP per turn now!', 'system');
    }
  }
  const from = s.turn!.idx;
  beginTurn(s, ctx, nextIdx(s, from, steps), guard);
}

/** Ends the current player's turn (after their main action resolves). */
function finishTurn(s: GameState, ctx: Ctx, steps = 1) {
  if (s.phase !== 'playing') return;
  if (checkGameEnd(s, ctx)) return;
  advanceTurn(s, ctx, steps);
}

function checkGameEnd(s: GameState, ctx: Ctx): boolean {
  if (s.phase !== 'playing') return true;
  const active = activePlayers(s);
  if (s.mode === 'battle') {
    if (active.length <= 1) {
      finishGame(s, ctx, active.length === 1 ? `${active[0].name} is the last drop standing!` : 'Everyone evaporated!');
      return true;
    }
  } else {
    if (active.length <= 1) {
      finishGame(s, ctx, 'Not enough players left.');
      return true;
    }
    const out = active.find((p) => hand(s, p.id).length === 0);
    if (out) {
      log(s, ctx, `🏁 ${out.name} played their last card!`, 'good', out.id);
      finishGame(s, ctx, `${out.name} went out.`, out.id);
      return true;
    }
  }
  return false;
}

function finishGame(s: GameState, ctx: Ctx, reason: string, wentOutId?: string) {
  s.phase = 'finished';
  s.pending = null;
  s.turn = null;
  const rows: (ResultRow & { sortKey: number[] })[] = s.players.map((p) => {
    const handSize = hand(s, p.id).length;
    let sortKey: number[];
    if (s.mode === 'classic') {
      sortKey = [p.status === 'left' ? 1 : 0, handSize];
    } else {
      const alive = p.status === 'active' ? 0 : p.status === 'out' ? 1 : 2;
      sortKey = [alive, alive === 0 ? -p.hp : alive === 1 ? p.placement ?? 99 : 0, -p.score];
    }
    return {
      id: p.id, name: p.name, avatar: p.avatar, rank: 0, score: p.score, hp: Math.max(0, p.hp), sets: p.sets,
      status: p.status, stats: { ...p.stats }, wentOut: p.id === wentOutId, cardsLeft: handSize, sortKey,
    };
  });
  rows.sort((a, b) => {
    for (let i = 0; i < a.sortKey.length; i++) if (a.sortKey[i] !== b.sortKey[i]) return a.sortKey[i] - b.sortKey[i];
    return 0;
  });
  let rank = 0;
  rows.forEach((r, i) => {
    if (i === 0 || r.sortKey.join() !== rows[i - 1].sortKey.join()) rank = i + 1;
    r.rank = rank;
  });
  s.results = rows.map(({ sortKey: _k, ...r }) => r);
  s.winnerIds = s.results.filter((r) => r.rank === 1 && r.status !== 'left').map((r) => r.id);
  const names = s.winnerIds.map((id) => nameOf(s, id)).join(' & ');
  log(s, ctx, `🏆 Game over. ${reason} ${names ? `Winner: ${names}!` : ''}`.trim(), 'good');
}

function extendTurn(s: GameState, ctx: Ctx) {
  if (s.turn) s.turn.deadline = Math.max(s.turn.deadline, ctx.now + FREE_ACTION_EXTEND_MS);
}

// ───────────────────────── Questions ─────────────────────────
function resolveQuestion(s: GameState, ctx: Ctx, choice: number) {
  const q = s.pending;
  if (!q || q.kind !== 'question') return;
  s.pending = null;
  const correct = choice === q.answer;
  const responder = getPlayer(s, q.responderId);
  if (responder) {
    if (correct) responder.stats.correct += 1;
    else responder.stats.wrong += 1;
  }
  const rName = responder?.name ?? 'Someone';
  const outcome = applyPurpose(s, ctx, q, correct);
  s.lastQuestion = {
    id: q.id, responderId: q.responderId, title: q.title, prompt: q.prompt, options: q.options,
    chosen: choice, correctIndex: q.answer, correct, explain: q.explain, outcome, at: ctx.now,
  };
  log(s, ctx, `${correct ? '✅' : choice === -1 ? '⏱️' : '❌'} ${rName} ${correct ? 'answered correctly' : choice === -1 ? 'ran out of time' : 'missed it'}. ${outcome}`, correct ? 'good' : 'bad', q.responderId);
  if (s.phase !== 'playing') return;
  if (q.free) {
    if (checkGameEnd(s, ctx)) return;
    extendTurn(s, ctx);
    // If the turn player left meanwhile, move on.
    if (currentPlayer(s)?.status !== 'active') advanceTurn(s, ctx, 1);
  } else {
    const again = !!s.extraTurn;
    delete s.extraTurn;
    finishTurn(s, ctx, again ? 0 : 1);
  }
}

function applyPurpose(s: GameState, ctx: Ctx, q: PendingQuestion, correct: boolean): string {
  const pu = q.purpose;
  const asker = getPlayer(s, q.askerId);
  const classic = s.mode === 'classic';
  switch (pu.type) {
    case 'challenge': {
      const def = defOf(pu.cardId);
      const target = getPlayer(s, pu.targetId);
      if (classic) {
        if (correct) return `${target?.name} knew it! No penalty.`;
        if (target && target.status === 'active') drawCards(s, ctx, target.id, 2);
        return `${target?.name} draws 2 cards.`;
      }
      if (correct) {
        if (target) heal(s, target, 1);
        return `${target?.name} heals 1.`;
      }
      const dmg = dealDamage(s, ctx, pu.challengerId, pu.targetId, def.power);
      return `${target?.name} takes ${dmg} damage.`;
    }
    case 'set': {
      if (!asker) return '';
      const pts = correct ? SET_BONUS_CORRECT : SET_BONUS_WRONG;
      asker.score += pts;
      asker.sets += 1;
      return `${PROPERTY_LABEL[pu.property]} set banked for ${pts} points.`;
    }
    case 'realworld': {
      const rw = REALWORLD[defOf(pu.cardId).id];
      if (classic) {
        s.activeProperty = pu.property && rw.props.includes(pu.property) ? pu.property : rw.props[0];
        const color = `The color is now ${PROPERTY_LABEL[s.activeProperty]}.`;
        if (correct || !asker) return color;
        drawCards(s, ctx, asker.id, 1);
        return `${asker.name} draws 1. ${color}`;
      }
      if (!correct) return 'The attack fizzled.';
      const dmg = dealDamage(s, ctx, q.askerId, pu.targetId!, attackPower(asker, 3));
      return `${nameOf(s, pu.targetId!)} takes ${dmg} damage.`;
    }
    case 'boost': {
      if (!correct) return 'The boosted attack fizzled!';
      const dmg = dealDamage(s, ctx, q.askerId, pu.targetId, attackPower(asker, pu.base * 2));
      return `Double damage! ${nameOf(s, pu.targetId)} takes ${dmg}.`;
    }
    case 'combo': {
      const base = correct ? pu.base + 2 : Math.floor(pu.base / 2);
      const dmg = dealDamage(s, ctx, q.askerId, pu.targetId, attackPower(asker, base));
      return correct ? `Combo hits ${nameOf(s, pu.targetId)} for ${dmg}!` : `Weak combo: ${nameOf(s, pu.targetId)} takes ${dmg}.`;
    }
    case 'star': {
      if (classic) {
        if (!asker) return '';
        if (correct) {
          s.extraTurn = true;
          return `${asker.name} takes another turn!`;
        }
        drawCards(s, ctx, asker.id, 1);
        return `${asker.name} draws 1 card.`;
      }
      if (!correct || !asker) return 'No bonus this time.';
      heal(s, asker, 4);
      drawCards(s, ctx, asker.id, 1);
      return 'Heals 4 and draws 1.';
    }
  }
}

/** Applies (and consumes) H-Bond Boost for an attack. */
function attackPower(attacker: PlayerState | undefined, base: number): number {
  if (attacker?.boost && base > 0) {
    attacker.boost = false;
    return base * 2;
  }
  return base;
}

// ───────────────────────── Game actions ─────────────────────────
export function applyGameAction(s: GameState, ctx: Ctx, uid: string, action: GameAction) {
  applyGameActionInner(s, ctx, uid, action);
  // A SPLASH! call only protects you while you're down to your last cards.
  for (const p of s.players) if ((s.hands[p.id]?.length ?? 0) > 2) p.called = false;
}

function applyGameActionInner(s: GameState, ctx: Ctx, uid: string, action: GameAction) {
  if (s.phase !== 'playing') fail('BAD_PHASE', 'The game is not running.');
  const me = mustPlayer(s, uid);
  if (!action || typeof action !== 'object') fail('BAD_ACTION', 'Invalid action.');

  if (action.type === 'timeout') return handleTimeout(s, ctx);

  if (action.type === 'answer') {
    const q = s.pending;
    if (!q || q.kind !== 'question') fail('NO_QUESTION', 'There is no question to answer.');
    const pq = q as PendingQuestion;
    if (pq.responderId !== uid) fail('NOT_YOU', 'This question is for someone else.');
    const choice = Number(action.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= pq.options.length) fail('BAD_CHOICE', 'Pick one of the answers.');
    return resolveQuestion(s, ctx, choice);
  }

  if (action.type === 'tradeRespond') {
    const t = s.pending;
    if (!t || t.kind !== 'trade') fail('NO_TRADE', 'There is no trade offer.');
    const pt = t as PendingTrade;
    if (pt.toId !== uid) fail('NOT_YOU', 'This trade is for someone else.');
    return resolveTrade(s, ctx, !!action.accept, action.cardId);
  }

  if (action.type === 'splash' || action.type === 'catch') {
    if (s.mode !== 'classic') fail('BAD_ACTION', 'SPLASH! is only used in Classic mode.');
    if (me.status !== 'active') fail('NOT_ACTIVE', 'You are out of this game.');
    if (action.type === 'splash') {
      if (hand(s, uid).length > 2) fail('TOO_EARLY', 'Call SPLASH! when you are down to 2 cards or fewer.');
      if (me.called) fail('ALREADY_CALLED', 'You already called SPLASH!');
      me.called = true;
      log(s, ctx, `💦 ${me.name} called SPLASH!`, 'good', uid);
      return;
    }
    const t = getPlayer(s, action.targetId);
    if (!t || t.id === uid || t.status !== 'active' || hand(s, t.id).length !== 1 || t.called) {
      fail('NOT_CATCHABLE', t && t.id !== uid ? `${t.name} is safe.` : 'Nobody to catch.');
    }
    drawCards(s, ctx, t!.id, 2);
    t!.called = false;
    log(s, ctx, `🚨 ${t!.name} forgot to call SPLASH! Caught by ${me.name}: +2 cards!`, 'bad', t!.id);
    setLast(s, ctx, { type: 'draw', actorId: t!.id, amount: 2 });
    return;
  }

  if (me.status !== 'active') fail('NOT_ACTIVE', 'You are out of this game.');
  if (currentPlayer(s)?.id !== uid) fail('NOT_YOUR_TURN', "It's not your turn.");
  if (s.pending) fail('PENDING', 'Wait for the current question or trade to finish.');

  if (s.mode === 'classic') return classicAction(s, ctx, me, action);
  return battleAction(s, ctx, me, action);
}

function handleTimeout(s: GameState, ctx: Ctx) {
  const grace = (id: string) => {
    const since = ctx.offline?.[id];
    return since !== undefined && ctx.now - since > OFFLINE_GRACE_MS;
  };
  const p = s.pending;
  if (p?.kind === 'question') {
    if (ctx.now < p.deadline && !grace(p.responderId)) fail('NOT_EXPIRED', 'Still waiting for an answer.');
    return resolveQuestion(s, ctx, -1);
  }
  if (p?.kind === 'trade') {
    if (ctx.now < p.deadline && !grace(p.toId)) fail('NOT_EXPIRED', 'Still waiting for a trade response.');
    return resolveTrade(s, ctx, false);
  }
  const cur = currentPlayer(s);
  if (!cur || !s.turn) fail('BAD_PHASE', 'No active turn.');
  if (ctx.now < s.turn!.deadline && !grace(cur!.id)) fail('NOT_EXPIRED', 'The turn is still running.');
  log(s, ctx, `⏱️ ${cur!.name} ran out of time.`, 'system', cur!.id);
  setLast(s, ctx, { type: 'timeout', actorId: cur!.id });
  if (s.mode === 'classic' && (s.drawStack ?? 0) > 0) return takeStack(s, ctx, cur!);
  if (s.mode === 'classic' && s.turn!.stage === 'start') drawCards(s, ctx, cur!.id, 1);
  finishTurn(s, ctx);
}

function resolveTrade(s: GameState, ctx: Ctx, accept: boolean, cardId?: string) {
  const t = s.pending as PendingTrade;
  const from = getPlayer(s, t.fromId);
  const to = getPlayer(s, t.toId);
  if (accept) {
    if (!cardId) fail('NEED_CARD', 'Choose a card to give back.');
    const h = hand(s, t.toId);
    if (!h.includes(cardId!)) fail('NOT_IN_HAND', 'That card is not in your hand.');
    const def = defOf(cardId!);
    if (def.wild || !def.properties.includes(t.wantProperty)) {
      fail('BAD_CARD', `You must give a ${PROPERTY_LABEL[t.wantProperty]} card.`);
    }
    if (!hand(s, t.fromId).includes(t.giveCardId)) {
      s.pending = null;
      log(s, ctx, 'The trade was cancelled.', 'system');
      return;
    }
    removeFromHand(s, t.toId, cardId!);
    removeFromHand(s, t.fromId, t.giveCardId);
    hand(s, t.toId).push(t.giveCardId);
    hand(s, t.fromId).push(cardId!);
    log(s, ctx, `🤝 ${to?.name} accepted ${from?.name}'s trade.`, 'good', t.toId);
    setLast(s, ctx, { type: 'trade', actorId: t.fromId, targetId: t.toId });
  } else {
    log(s, ctx, `${to?.name} declined the trade.`, 'system', t.toId);
  }
  s.pending = null;
  extendTurn(s, ctx);
}

// ───── Classic ─────
function classicAction(s: GameState, ctx: Ctx, me: PlayerState, a: GameAction) {
  const turn = s.turn!;
  switch (a.type) {
    case 'draw': {
      if ((s.drawStack ?? 0) > 0) return takeStack(s, ctx, me);
      if (turn.stage !== 'start') fail('ALREADY_DREW', 'You already drew this turn.');
      const n = drawCards(s, ctx, me.id, 1);
      turn.stage = 'afterDraw';
      setLast(s, ctx, { type: 'draw', actorId: me.id, amount: n });
      log(s, ctx, n ? `${me.name} drew a card.` : `${me.name} tried to draw, but the deck is empty.`, 'play', me.id);
      return;
    }
    case 'endTurn': {
      if (turn.stage !== 'afterDraw') fail('MUST_ACT', 'Play a card or draw before ending your turn.');
      return finishTurn(s, ctx);
    }
    case 'play':
      return classicPlay(s, ctx, me, a);
    default:
      fail('BAD_ACTION', 'That move is not allowed in Classic mode.');
  }
}

/** Classic = UNO-style: match the active property, use action cards, first to empty their hand wins. */
function classicPlay(s: GameState, ctx: Ctx, me: PlayerState, a: Extract<GameAction, { type: 'play' }>) {
  if (!hand(s, me.id).includes(a.cardId)) fail('NOT_IN_HAND', 'That card is not in your hand.');
  const def = defOf(a.cardId);
  const top = s.discard.length ? s.discard[s.discard.length - 1] : null;
  const stacking = (s.drawStack ?? 0) > 0;
  if (stacking) {
    if (!isStackable(def) || (def.effect === 'waterPower' && a.choice !== 'draw')) {
      fail('MUST_STACK', `Stack a draw card (+2 or +4) or take the ${s.drawStack} cards.`);
    }
  } else if (!classicPlayable(def, s.activeProperty, top)) {
    fail('NO_MATCH', `That card doesn't match. Play ${PROPERTY_LABEL[s.activeProperty!]} or a wild card.`);
  }
  // Validate everything before mutating.
  let target: PlayerState | undefined;
  if (needsTarget(def, 'classic')) target = requireTarget(s, me.id, a.targetId);
  if (def.effect === 'swap' || def.effect === 'grab') {
    if (!a.giveCardId || a.giveCardId === a.cardId || !hand(s, me.id).includes(a.giveCardId)) fail('NEED_CARD', 'Choose a card to give away.');
  }
  if (def.effect === 'swap' && target && hand(s, target.id).length < 1) fail('BAD_TARGET', `${target.name} has no cards.`);
  if ((def.effect === 'wildBond' || def.effect === 'storm') && !['cohesion', 'adhesion', 'surface'].includes(a.property as string)) fail('NEED_PROPERTY', 'Choose a property.');
  if (def.effect === 'waterPower' && !['draw', 'points', 'shield'].includes(a.choice as string)) fail('NEED_CHOICE', 'Choose a Water Power.');

  removeFromHand(s, me.id, a.cardId);
  s.discard.push(a.cardId);
  me.stats.played += 1;
  setLast(s, ctx, { type: 'play', actorId: me.id, cardId: a.cardId, targetId: target?.id });
  const nextId = () => s.players[nextIdx(s, s.turn!.idx, 1)].id;
  // Draw cards don't hit right away: they pile up until someone can't stack.
  const nextDraws = (n: number) => {
    s.drawStack = (s.drawStack ?? 0) + n;
    log(s, ctx, `➕ ${nameOf(s, nextId())} must draw ${s.drawStack}… or stack a draw card!`, 'bad', nextId());
  };

  if (isPropertyCard(def)) {
    s.activeProperty = def.category as Property;
    log(s, ctx, `${me.name} played ${def.name}.`, 'play', me.id);
    return finishTurn(s, ctx);
  }

  if (def.category === 'challenge') {
    s.activeProperty = a.property && def.properties.includes(a.property) ? a.property : def.properties[0];
    log(s, ctx, `⚡ ${me.name} challenges ${target!.name} with ${def.name}!`, 'science', me.id);
    if (classicShieldBlocks(s, ctx, target!.id, 'the challenge')) return finishTurn(s, ctx);
    const q = QUESTION_MAP[CHALLENGE_QUESTION[def.id]];
    askQuestion(s, ctx, {
      responderId: target!.id, askerId: me.id, title: def.name, prompt: q.prompt, options: q.options, answer: q.answer,
      explain: q.explain, cardId: a.cardId,
      stakes: `Wrong answer: ${target!.name} draws 2 cards.`,
      purpose: { type: 'challenge', challengerId: me.id, targetId: target!.id, cardId: a.cardId },
    });
    return;
  }

  if (def.category === 'action') {
    if (def.wild) {
      if (a.property && ['cohesion', 'adhesion', 'surface'].includes(a.property)) s.activeProperty = a.property;
    } else s.activeProperty = def.properties[0];
    let steps = 1;
    switch (def.effect) {
      case 'soap': {
        const nid = nextId();
        log(s, ctx, `🧼 ${me.name} played Soap Disruptor on ${nameOf(s, nid)}.`, 'play', me.id);
        if (!classicShieldBlocks(s, ctx, nid, 'the skip')) {
          log(s, ctx, `${nameOf(s, nid)} is skipped!`, 'play', nid);
          steps = 2;
        }
        break;
      }
      case 'evaporation': {
        s.turn!.dir = (s.turn!.dir * -1) as 1 | -1;
        log(s, ctx, `☀️ ${me.name} played Evaporation: turn order reversed!`, 'play', me.id);
        if (activePlayers(s).length === 2) steps = 2;
        break;
      }
      case 'capillary':
        log(s, ctx, `🧪 ${me.name} played Capillary Pull.`, 'play', me.id);
        nextDraws(2);
        break;
      case 'grab': {
        log(s, ctx, `💧 ${me.name} played Droplet Grab on ${target!.name}.`, 'play', me.id);
        if (!classicShieldBlocks(s, ctx, target!.id, 'Droplet Grab')) {
          removeFromHand(s, me.id, a.giveCardId!);
          hand(s, target!.id).push(a.giveCardId!);
          log(s, ctx, `${me.name} pushed a card into ${target!.name}'s hand.`, 'play', me.id);
        }
        break;
      }
      case 'swap': {
        log(s, ctx, `🔄 ${me.name} played Property Swap with ${target!.name}.`, 'play', me.id);
        if (!classicShieldBlocks(s, ctx, target!.id, 'Property Swap')) doSwap(s, ctx, me.id, target!.id, a.giveCardId!);
        break;
      }
      case 'storm':
        log(s, ctx, `🌊 ${me.name} played Storm Surge! The color is now ${PROPERTY_LABEL[s.activeProperty!]}.`, 'play', me.id);
        nextDraws(4);
        break;
      case 'whirlpool':
        log(s, ctx, `🌀 ${me.name} played Whirlpool on ${target!.name}!`, 'play', me.id);
        // Played as your last card? You go out instead of handing over an empty hand.
        if (hand(s, me.id).length && !classicShieldBlocks(s, ctx, target!.id, 'the Whirlpool')) swapHands(s, ctx, me.id, target!.id);
        break;
      case 'current':
        log(s, ctx, `🔄 ${me.name} played Ocean Current! Everyone passes their hand along.`, 'play', me.id);
        if (hand(s, me.id).length) rotateHands(s, ctx);
        break;
      case 'splash': {
        log(s, ctx, `🌊 ${me.name} played Surfactant Splash! Everyone else draws 1.`, 'play', me.id);
        for (const p of activePlayers(s)) {
          if (p.id === me.id) continue;
          if (!classicShieldBlocks(s, ctx, p.id, 'the splash')) drawCards(s, ctx, p.id, 1);
        }
        break;
      }
    }
    return finishTurn(s, ctx, steps);
  }

  if (def.category === 'realworld') {
    const rw = REALWORLD[def.id];
    log(s, ctx, `🌍 ${me.name} played ${def.name}. Which property is it?`, 'science', me.id);
    askQuestion(s, ctx, {
      responderId: me.id, askerId: me.id, title: def.name,
      prompt: `${def.description} Which property explains this best?`, options: CLASSIFY_OPTIONS,
      answer: rw.answer, explain: rw.explain, cardId: a.cardId, stakes: 'Wrong answer: you draw 1 card.',
      purpose: { type: 'realworld', cardId: a.cardId, property: a.property },
    });
    return;
  }

  // Power-ups (all wild)
  let steps = 1;
  switch (def.effect) {
    case 'waterPower':
      if (a.choice === 'draw') {
        log(s, ctx, `⭐ ${me.name} used Water Power: next player draws 2.`, 'play', me.id);
        nextDraws(2);
      } else if (a.choice === 'points') {
        const nid = nextId();
        log(s, ctx, `⭐ ${me.name} used Water Power: skip ${nameOf(s, nid)}.`, 'play', me.id);
        if (!classicShieldBlocks(s, ctx, nid, 'the skip')) steps = 2;
      } else {
        me.shield = 1;
        log(s, ctx, `⭐ ${me.name} used Water Power: gained a Shield.`, 'play', me.id);
      }
      break;
    case 'wildBond':
      s.activeProperty = a.property!;
      log(s, ctx, `🔗 ${me.name} played Wild Bond: the color is now ${PROPERTY_LABEL[a.property!]}.`, 'play', me.id);
      break;
    case 'hbond':
      log(s, ctx, `⚡ ${me.name} played H-Bond Boost and takes another turn!`, 'play', me.id);
      steps = 0;
      break;
    case 'shield':
      me.shield = 1;
      log(s, ctx, `🛡️ ${me.name} raised a Surface Shield.`, 'play', me.id);
      break;
    case 'rain':
      log(s, ctx, `🌧️ ${me.name} played Rain Refill.`, 'play', me.id);
      nextDraws(2);
      break;
    case 'star': {
      log(s, ctx, `🌟 ${me.name} played Science Star. Bonus question!`, 'science', me.id);
      const topic = pickRandom<Topic>(['cohesion', 'adhesion', 'surface', 'combo'], ctx.rng);
      askBankQuestion(s, ctx, topic, undefined, {
        responderId: me.id, askerId: me.id, title: 'Science Star', cardId: a.cardId,
        stakes: 'Correct: take another turn. Wrong: draw 1 card.',
        purpose: { type: 'star', cardId: a.cardId },
      });
      return;
    }
  }
  return finishTurn(s, ctx, steps);
}

/** Classic: take the whole pending draw stack (a Shield blocks it all) and end the turn. */
function takeStack(s: GameState, ctx: Ctx, p: PlayerState) {
  const n = s.drawStack ?? 0;
  s.drawStack = 0;
  if (p.shield > 0) {
    p.shield = 0;
    log(s, ctx, `🛡️ ${p.name}'s Shield blocked all ${n} cards!`, 'good', p.id);
  } else {
    drawCards(s, ctx, p.id, n);
    log(s, ctx, `😱 ${p.name} draws ${n} cards!`, 'bad', p.id);
  }
  setLast(s, ctx, { type: 'draw', actorId: p.id, amount: n });
  finishTurn(s, ctx);
}

function swapHands(s: GameState, ctx: Ctx, a: string, b: string) {
  [s.hands[a], s.hands[b]] = [hand(s, b), hand(s, a)];
  log(s, ctx, `${nameOf(s, a)} and ${nameOf(s, b)} swapped their whole hands!`, 'play', a);
}

/** Every active player passes their hand to the next player in turn order. */
function rotateHands(s: GameState, ctx: Ctx) {
  const active = activePlayers(s);
  if (active.length < 2) return;
  const ordered = s.turn!.dir === 1 ? active : [...active].reverse();
  const hands = ordered.map((p) => hand(s, p.id));
  ordered.forEach((p, i) => {
    s.hands[p.id] = hands[(i - 1 + ordered.length) % ordered.length];
  });
  log(s, ctx, 'Every hand moved to the next player!', 'play');
}

function doSwap(s: GameState, ctx: Ctx, meId: string, targetId: string, giveCardId: string) {
  const th = hand(s, targetId);
  if (!th.length || !hand(s, meId).includes(giveCardId)) return;
  const take = pickRandom(th, ctx.rng);
  removeFromHand(s, targetId, take);
  removeFromHand(s, meId, giveCardId);
  th.push(giveCardId);
  hand(s, meId).push(take);
  log(s, ctx, `${nameOf(s, meId)} and ${nameOf(s, targetId)} swapped cards.`, 'play', meId);
}

// ───── Battle ─────
function battleAction(s: GameState, ctx: Ctx, me: PlayerState, a: GameAction) {
  switch (a.type) {
    case 'rest': {
      drawCards(s, ctx, me.id, 1);
      heal(s, me, 1);
      log(s, ctx, `💤 ${me.name} rested: drew 1 and healed 1.`, 'play', me.id);
      setLast(s, ctx, { type: 'draw', actorId: me.id, amount: 1 });
      return finishTurn(s, ctx);
    }
    case 'play':
      return battlePlay(s, ctx, me, a);
    default:
      fail('BAD_ACTION', 'That move is not allowed in Battle mode.');
  }
}

function battlePlay(s: GameState, ctx: Ctx, me: PlayerState, a: Extract<GameAction, { type: 'play' }>) {
  if (!hand(s, me.id).includes(a.cardId)) fail('NOT_IN_HAND', 'That card is not in your hand.');
  const def: CardDef = defOf(a.cardId);
  const isPower = def.category === 'powerup';
  if (isPower && s.turn!.powerDone) fail('POWER_DONE', 'You can use one Power-Up per turn.');

  let target: PlayerState | undefined;
  if (needsTarget(def, 'battle')) target = requireTarget(s, me.id, a.targetId);
  let combo: CardDef | undefined;
  if (a.comboCardId) {
    if (!isPropertyCard(def)) fail('BAD_COMBO', 'Combos need two property cards.');
    if (a.comboCardId === a.cardId || !hand(s, me.id).includes(a.comboCardId)) fail('BAD_COMBO', 'Choose a second card for the combo.');
    combo = defOf(a.comboCardId);
    if (!isPropertyCard(combo) || combo.category === def.category) fail('BAD_COMBO', 'A combo needs two DIFFERENT properties.');
  }
  if (def.effect === 'swap') {
    if (!a.giveCardId || a.giveCardId === a.cardId || !hand(s, me.id).includes(a.giveCardId)) fail('NEED_CARD', 'Choose a card to give away.');
    if (target && hand(s, target.id).length < 1) fail('BAD_TARGET', `${target.name} has no cards.`);
  }
  if (def.effect === 'grab' && target && hand(s, target.id).length < 1) fail('BAD_TARGET', `${target.name} has no cards.`);
  if (def.effect === 'waterPower' && !['draw', 'points', 'shield'].includes(a.choice as string)) fail('NEED_CHOICE', 'Choose a Water Power.');

  removeFromHand(s, me.id, a.cardId);
  s.discard.push(a.cardId);
  me.stats.played += 1;
  setLast(s, ctx, { type: 'play', actorId: me.id, cardId: a.cardId, targetId: target?.id });

  if (isPropertyCard(def)) {
    if (combo) {
      removeFromHand(s, me.id, a.comboCardId!);
      s.discard.push(a.comboCardId!);
      me.stats.played += 1;
      const base = def.power + combo.power;
      const props = [def.category, combo.category] as Property[];
      log(s, ctx, `💥 ${me.name} launches a ${PROPERTY_LABEL[props[0]]} + ${PROPERTY_LABEL[props[1]]} combo at ${target!.name}!`, 'science', me.id);
      askBankQuestion(s, ctx, 'combo', props, {
        responderId: me.id, askerId: me.id, title: 'Combo Attack', cardId: a.cardId,
        stakes: `Correct: ${base + 2} damage. Wrong: ${Math.floor(base / 2)}.`,
        purpose: { type: 'combo', cardIds: [a.cardId, a.comboCardId!], targetId: target!.id, base },
      });
      return;
    }
    if (a.boost) {
      log(s, ctx, `🔬 ${me.name} boosts ${def.name} against ${target!.name}. Science check!`, 'science', me.id);
      askBankQuestion(s, ctx, def.category as Property, undefined, {
        responderId: me.id, askerId: me.id, title: `Boosted ${def.name}`, cardId: a.cardId,
        stakes: `Correct: ${def.power * 2} damage. Wrong: the attack fizzles.`,
        purpose: { type: 'boost', cardId: a.cardId, targetId: target!.id, base: def.power },
      });
      return;
    }
    const dmg = dealDamage(s, ctx, me.id, target!.id, attackPower(me, def.power));
    log(s, ctx, `${me.name} hit ${target!.name} with ${def.name} for ${dmg}.`, 'play', me.id);
    return finishTurn(s, ctx);
  }

  if (def.category === 'challenge') {
    log(s, ctx, `⚡ ${me.name} challenges ${target!.name} with ${def.name}!`, 'science', me.id);
    const q = QUESTION_MAP[CHALLENGE_QUESTION[def.id]];
    askQuestion(s, ctx, {
      responderId: target!.id, askerId: me.id, title: def.name, prompt: q.prompt, options: q.options, answer: q.answer,
      explain: q.explain, cardId: a.cardId, stakes: `Wrong: ${target!.name} takes ${def.power} damage. Correct: heal 1.`,
      purpose: { type: 'challenge', challengerId: me.id, targetId: target!.id, cardId: a.cardId },
    });
    return;
  }

  if (def.category === 'realworld') {
    const rw = REALWORLD[def.id];
    log(s, ctx, `🌍 ${me.name} played ${def.name} at ${target!.name}. Which property is it?`, 'science', me.id);
    askQuestion(s, ctx, {
      responderId: me.id, askerId: me.id, title: def.name, prompt: `${def.description} Which property explains this best?`,
      options: CLASSIFY_OPTIONS, answer: rw.answer, explain: rw.explain, cardId: a.cardId,
      stakes: `Correct: ${target!.name} takes 3 damage.`,
      purpose: { type: 'realworld', cardId: a.cardId, targetId: target!.id },
    });
    return;
  }

  if (def.category === 'action') {
    switch (def.effect) {
      case 'soap': {
        if (target!.shield > 0) {
          target!.shield = 0;
          log(s, ctx, `🧼 ${me.name} popped ${target!.name}'s shield!`, 'play', me.id);
        }
        const dmg = dealDamage(s, ctx, me.id, target!.id, 2);
        log(s, ctx, `🧼 Soap Disruptor hits ${target!.name} for ${dmg}.`, 'play', me.id);
        break;
      }
      case 'evaporation': {
        const th = hand(s, target!.id);
        if (th.length) {
          const c = pickRandom(th, ctx.rng);
          removeFromHand(s, target!.id, c);
          s.discard.unshift(c);
        }
        const dmg = dealDamage(s, ctx, me.id, target!.id, 1);
        log(s, ctx, `☀️ ${me.name} evaporated one of ${target!.name}'s cards (${dmg} damage).`, 'play', me.id);
        break;
      }
      case 'capillary':
        drawCards(s, ctx, me.id, 2);
        log(s, ctx, `🧪 ${me.name} played Capillary Pull and drew 2.`, 'play', me.id);
        break;
      case 'grab': {
        const c = pickRandom(hand(s, target!.id), ctx.rng);
        removeFromHand(s, target!.id, c);
        hand(s, me.id).push(c);
        log(s, ctx, `💧 ${me.name} grabbed a card from ${target!.name}.`, 'play', me.id);
        break;
      }
      case 'swap':
        log(s, ctx, `🔄 ${me.name} played Property Swap with ${target!.name}.`, 'play', me.id);
        doSwap(s, ctx, me.id, target!.id, a.giveCardId!);
        break;
      case 'storm': {
        const dmg = dealDamage(s, ctx, me.id, target!.id, 4);
        log(s, ctx, `🌊 ${me.name}'s Storm Surge hits ${target!.name} for ${dmg}!`, 'play', me.id);
        break;
      }
      case 'whirlpool':
        log(s, ctx, `🌀 ${me.name} played Whirlpool on ${target!.name}!`, 'play', me.id);
        swapHands(s, ctx, me.id, target!.id);
        break;
      case 'current':
        log(s, ctx, `🔄 ${me.name} played Ocean Current!`, 'play', me.id);
        rotateHands(s, ctx);
        break;
      case 'splash': {
        log(s, ctx, `🌊 ${me.name} unleashed a Surfactant Splash!`, 'play', me.id);
        for (const p of activePlayers(s)) if (p.id !== me.id) dealDamage(s, ctx, me.id, p.id, 2);
        break;
      }
    }
    return finishTurn(s, ctx);
  }

  // Power-ups are a free action in Battle mode.
  s.turn!.powerDone = true;
  switch (def.effect) {
    case 'waterPower':
      if (a.choice === 'draw') drawCards(s, ctx, me.id, 2);
      else if (a.choice === 'points') heal(s, me, 3);
      else me.shield = Math.min(SHIELD_CAP, me.shield + 3);
      log(s, ctx, `⭐ ${me.name} used Water Power: ${a.choice === 'draw' ? 'drew 2 cards' : a.choice === 'points' ? 'healed 3' : '+3 shield'}.`, 'play', me.id);
      break;
    case 'wildBond':
      drawCards(s, ctx, me.id, 1);
      heal(s, me, 2);
      log(s, ctx, `🔗 ${me.name} played Wild Bond: drew 1 and healed 2.`, 'play', me.id);
      break;
    case 'hbond':
      me.boost = true;
      log(s, ctx, `⚡ ${me.name} charged an H-Bond Boost: next attack deals double!`, 'play', me.id);
      break;
    case 'shield':
      me.shield = Math.min(SHIELD_CAP, me.shield + 5);
      log(s, ctx, `🛡️ ${me.name} raised a Surface Shield (+5).`, 'play', me.id);
      break;
    case 'rain':
      heal(s, me, 5);
      log(s, ctx, `🌧️ ${me.name} played Rain Refill: healed 5.`, 'play', me.id);
      break;
    case 'star': {
      log(s, ctx, `🌟 ${me.name} played Science Star. Bonus question!`, 'science', me.id);
      const topic = pickRandom<Topic>(['cohesion', 'adhesion', 'surface', 'combo'], ctx.rng);
      askBankQuestion(s, ctx, topic, undefined, {
        responderId: me.id, askerId: me.id, title: 'Science Star', cardId: a.cardId, free: true,
        stakes: 'Correct: heal 4 and draw 1.', purpose: { type: 'star', cardId: a.cardId },
      });
      return;
    }
  }
  extendTurn(s, ctx);
}

export function currentRoundInfo(s: GameState) {
  return { round: Math.min(s.round, maxRounds(s)), maxRounds: maxRounds(s) };
}
