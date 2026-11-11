// Projects the full server state into what each client may see.
import type { PublicPending, PublicView } from '../src/shared/types.js';
import { BATTLE_HP } from '../src/shared/types.js';
import { currentRoundInfo, type GameState } from './engine.js';

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
      called: !!p.called,
    })),
    round,
    maxRounds,
    maxHp: s.maxHp ?? BATTLE_HP,
    drawStack: s.drawStack ?? 0,
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
    discardRecent: s.discard.slice(-5),
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
