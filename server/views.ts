// Projects the full server state into what each client may see.
import type { PrivateView, PublicPending, PublicView } from '../src/shared/types';
import { currentRoundInfo, type GameState } from './engine';

export function publicView(s: GameState): PublicView {
  const { round, maxRounds } = currentRoundInfo(s);
  let pending: PublicPending | null = null;
  if (s.pending?.kind === 'question') {
    const { answer: _a, explain: _e, purpose: _p, free: _f, ...rest } = s.pending;
    pending = rest;
  } else if (s.pending?.kind === 'trade') {
    pending = { ...s.pending };
  }
  return {
    code: s.code,
    version: s.version,
    phase: s.phase,
    mode: s.mode,
    hostId: s.hostId,
    players: s.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, ready: p.ready, status: p.status, score: p.score, hp: p.hp,
      shield: p.shield, boost: p.boost, sets: p.sets, handCount: s.hands[p.id]?.length ?? 0, stats: p.stats,
      placement: p.placement,
    })),
    round,
    maxRounds,
    turn: s.turn
      ? {
          playerId: s.players[s.turn.idx]?.id ?? '',
          number: s.turn.number,
          dir: s.turn.dir,
          stage: s.turn.stage,
          setDone: s.turn.setDone,
          tradeDone: s.turn.tradeDone,
          powerDone: s.turn.powerDone,
          deadline: s.turn.deadline,
        }
      : null,
    activeProperty: s.activeProperty,
    discardTop: s.discard.length ? s.discard[s.discard.length - 1] : null,
    discardCount: s.discard.length,
    deckCount: s.deck.length,
    pending,
    lastQuestion: s.lastQuestion,
    lastAction: s.lastAction,
    log: s.log,
    results: s.results,
    winnerIds: s.winnerIds,
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
  };
}

export function privateView(s: GameState, uid: string): PrivateView {
  return { version: s.version, hand: s.hands[uid] ?? [] };
}

/** The exact shape stored at /rooms/{code} in the Realtime Database. Values are JSON strings to avoid RTDB array quirks. */
export interface RoomRecord {
  secret: string;
  public: string;
  private: Record<string, string>;
  members: Record<string, true>;
}

export function serializeRoom(s: GameState): RoomRecord {
  const members: Record<string, true> = {};
  const priv: Record<string, string> = {};
  for (const p of s.players) {
    if (p.status === 'left') continue;
    members[p.id] = true;
    priv[p.id] = JSON.stringify(privateView(s, p.id));
  }
  return { secret: JSON.stringify(s), public: JSON.stringify(publicView(s)), private: priv, members };
}
