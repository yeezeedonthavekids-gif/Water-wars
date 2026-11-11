import { describe, expect, it } from 'vitest';
import { buildDeckIds, CARDS, defOf, isPropertyCard } from '../src/shared/cards';
import type { GameAction, Mode, Property } from '../src/shared/types';
import { QUESTIONS, CHALLENGE_QUESTION, REALWORLD } from '../server/answers';
import {
  applyGameAction, createState, GameError, joinRoom, leaveRoom, rematch, setReady, startGame, type Ctx, type GameState,
} from '../server/engine';
import { publicView, serializeRoom } from '../server/views';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const TOTAL = buildDeckIds().length;
const PROPS: Property[] = ['cohesion', 'adhesion', 'surface'];

function setup(n: number, mode: Mode, rng: () => number, now = 1_000_000) {
  const ctx: Ctx = { now, rng };
  const s = createState('ABCDE', 'p0', 'Player 0', mode, now);
  for (let i = 1; i < n; i++) {
    joinRoom(s, ctx, `p${i}`, `Player ${i}`);
    setReady(s, `p${i}`, true);
  }
  startGame(s, ctx, 'p0');
  return { s, ctx };
}

function cardCount(s: GameState) {
  return s.deck.length + s.discard.length + Object.values(s.hands).reduce((a, h) => a + h.length, 0);
}

function candidateActions(s: GameState, uid: string, rng: () => number): GameAction[] {
  const h = s.hands[uid] ?? [];
  const others = s.players.filter((p) => p.id !== uid && p.status === 'active').map((p) => p.id);
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const acts: GameAction[] = [];
  for (const c of h) {
    acts.push({
      type: 'play', cardId: c, targetId: pick(others), boost: rng() < 0.5,
      comboCardId: rng() < 0.3 ? pick(h) : undefined, giveCardId: pick(h.filter((x) => x !== c)),
      property: pick(PROPS), choice: pick(['draw', 'points', 'shield'] as const),
    });
  }
  if (s.mode === 'classic') {
    acts.push({ type: 'draw' }, { type: 'endTurn' }, { type: 'ask', targetId: pick(others), property: pick(PROPS) });
    const byProp: Record<string, string[]> = {};
    for (const c of h) {
      const d = defOf(c);
      if (isPropertyCard(d)) (byProp[d.category] ??= []).push(c);
    }
    for (const cs of Object.values(byProp)) if (cs.length >= 3) acts.push({ type: 'set', cardIds: cs.slice(0, 3) });
    if (h.length) acts.push({ type: 'trade', targetId: pick(others), giveCardId: pick(h), wantProperty: pick(PROPS) });
  } else {
    acts.push({ type: 'rest' });
  }
  // shuffle
  for (let i = acts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [acts[i], acts[j]] = [acts[j], acts[i]];
  }
  return acts;
}

function step(s: GameState, ctx: Ctx, rng: () => number) {
  ctx.now += 1000;
  if (s.pending?.kind === 'question') {
    const choice = rng() < 0.1 ? 99 : Math.floor(rng() * s.pending.options.length);
    try {
      applyGameAction(s, ctx, s.pending.responderId, { type: 'answer', choice });
    } catch (e) {
      expect(e).toBeInstanceOf(GameError);
      applyGameAction(s, ctx, s.pending!.responderId, { type: 'answer', choice: 0 });
    }
    return;
  }
  if (s.pending?.kind === 'trade') {
    const to = s.pending.toId;
    const want = s.pending.wantProperty;
    const card = (s.hands[to] ?? []).find((c) => !defOf(c).wild && defOf(c).properties.includes(want));
    applyGameAction(s, ctx, to, card && rng() < 0.7 ? { type: 'tradeRespond', accept: true, cardId: card } : { type: 'tradeRespond', accept: false });
    return;
  }
  const cur = s.players[s.turn!.idx];
  // Occasionally let the turn time out.
  if (rng() < 0.03) {
    ctx.now += 200_000;
    applyGameAction(s, ctx, cur.id, { type: 'timeout' });
    return;
  }
  for (const a of candidateActions(s, cur.id, rng)) {
    const snapshot = JSON.stringify(s);
    try {
      applyGameAction(s, ctx, cur.id, a);
      return;
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
      // Rejected moves must not change state.
      expect(JSON.stringify(s)).toBe(snapshot);
    }
  }
  // Nothing legal: time out.
  ctx.now += 200_000;
  applyGameAction(s, ctx, cur.id, { type: 'timeout' });
}

describe('card database', () => {
  it('has 30+ unique cards across all 7 categories with unique names', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(30);
    const cats = new Set(CARDS.map((c) => c.category));
    expect(cats.size).toBe(7);
    expect(new Set(CARDS.map((c) => c.name)).size).toBe(CARDS.length);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
  it('every card connects to a property and has science text', () => {
    for (const c of CARDS) {
      expect(c.science.length).toBeGreaterThan(20);
      expect(c.description.length).toBeGreaterThan(5);
      if (c.category !== 'realworld') expect(c.properties.length).toBeGreaterThan(0);
      else expect(REALWORLD[c.id]).toBeTruthy();
    }
  });
  it('questions are well formed and challenge cards map to questions', () => {
    for (const q of QUESTIONS) {
      expect(q.options.length).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
    }
    for (const c of CARDS.filter((c) => c.category === 'challenge')) {
      expect(QUESTIONS.find((q) => q.id === CHALLENGE_QUESTION[c.id])).toBeTruthy();
    }
    expect(QUESTIONS.filter((q) => q.topic === 'combo').length).toBeGreaterThanOrEqual(3);
  });
});

describe('rules enforcement', () => {
  it('rejects moves from the wrong player and unknown cards', () => {
    const { s, ctx } = setup(3, 'classic', seeded(1));
    const cur = s.players[s.turn!.idx].id;
    const other = s.players.find((p) => p.id !== cur)!.id;
    expect(() => applyGameAction(s, ctx, other, { type: 'draw' })).toThrow(/not your turn/i);
    expect(() => applyGameAction(s, ctx, cur, { type: 'play', cardId: 'coh-merge~9' })).toThrow();
    expect(() => applyGameAction(s, ctx, 'stranger', { type: 'draw' })).toThrow(/not in this room/i);
    expect(() => applyGameAction(s, ctx, cur, { type: 'endTurn' })).toThrow();
  });

  it('rejects a non-matching card in classic', () => {
    const { s, ctx } = setup(2, 'classic', seeded(2));
    const cur = s.players[s.turn!.idx].id;
    const other = (['cohesion', 'adhesion', 'surface'] as const).find((p) => p !== s.activeProperty)!;
    const bad = buildDeckIds().find((c) => defOf(c).category === other && !s.hands[cur].includes(c))!;
    // Put the card in hand so only the matching rule rejects it.
    const owner = Object.keys(s.hands).find((k) => s.hands[k].includes(bad));
    if (owner) s.hands[owner].splice(s.hands[owner].indexOf(bad), 1);
    else if (s.deck.includes(bad)) s.deck.splice(s.deck.indexOf(bad), 1);
    else s.discard.splice(s.discard.indexOf(bad), 1);
    s.hands[cur].push(bad);
    expect(() => applyGameAction(s, ctx, cur, { type: 'play', cardId: bad })).toThrow(/match/i);
  });

  it('only the targeted player may answer a challenge, and answers are hidden from the public view', () => {
    const { s, ctx } = setup(3, 'classic', seeded(3));
    const cur = s.players[s.turn!.idx].id;
    const target = s.players.find((p) => p.id !== cur)!.id;
    const card = 'chl-strider~1';
    for (const k of Object.keys(s.hands)) s.hands[k] = s.hands[k].filter((c) => c !== card);
    s.deck = s.deck.filter((c) => c !== card);
    s.discard = s.discard.filter((c) => c !== card);
    s.hands[cur].push(card);
    s.activeProperty = 'surface';
    applyGameAction(s, ctx, cur, { type: 'play', cardId: card, targetId: target });
    expect(s.pending?.kind).toBe('question');
    const pv = publicView(s);
    expect(JSON.stringify(pv.pending)).not.toMatch(/"answer"|"explain"|"purpose"/);
    expect(serializeRoom(s).public).not.toContain('"answer"');
    expect(() => applyGameAction(s, ctx, cur, { type: 'answer', choice: 1 })).toThrow(/someone else/i);
    const before = s.players.find((p) => p.id === target)!.score;
    applyGameAction(s, ctx, target, { type: 'answer', choice: 1 }); // s1 answer is index 1
    expect(s.players.find((p) => p.id === target)!.score).toBe(before + 3);
    expect(s.lastQuestion?.correct).toBe(true);
  });

  it('private views never include other hands', () => {
    const { s } = setup(4, 'battle', seeded(4));
    const rec = serializeRoom(s);
    for (const [uid, json] of Object.entries(rec.private)) {
      const v = JSON.parse(json);
      expect(v.hand).toEqual(s.hands[uid]);
    }
    expect(rec.public).not.toContain(s.hands.p1[0] + '"'); // public shows counts only (cards may coincide with discardTop rarely)
  });

  it('leaving mid-game keeps the game consistent', () => {
    const rng = seeded(5);
    const { s, ctx } = setup(3, 'classic', rng);
    const cur = s.players[s.turn!.idx].id;
    leaveRoom(s, ctx, cur);
    expect(s.players[s.turn!.idx].id).not.toBe(cur);
    expect(cardCount(s)).toBe(TOTAL);
    const next = s.players[s.turn!.idx].id;
    leaveRoom(s, ctx, next);
    expect(s.phase).toBe('finished');
    expect(s.results?.length).toBe(3);
  });
});

describe('fuzz: full random games terminate and conserve cards', () => {
  for (const mode of ['classic', 'battle'] as Mode[]) {
    it(`${mode}: 300 random games`, () => {
      let finished = 0;
      for (let g = 0; g < 300; g++) {
        const rng = seeded(1000 + g);
        const n = 2 + (g % 5);
        const { s, ctx } = setup(n, mode, rng);
        let steps = 0;
        while (s.phase === 'playing' && steps < 3000) {
          step(s, ctx, rng);
          steps++;
          expect(cardCount(s)).toBe(TOTAL);
          for (const p of s.players) {
            expect(p.hp).toBeLessThanOrEqual(20);
            expect(Number.isFinite(p.score)).toBe(true);
          }
          if (s.phase === 'playing') {
            expect(s.players[s.turn!.idx].status).toBe('active');
          }
          // Randomly have someone leave in a few games.
          if (g % 37 === 0 && steps === 25) leaveRoom(s, ctx, s.players[1].id);
        }
        expect(s.phase).toBe('finished');
        expect(s.results!.length).toBe(n);
        expect(s.winnerIds.length).toBeGreaterThan(0);
        finished++;
        if (g % 50 === 0) {
          rematch(s, ctx, s.hostId);
          expect(s.phase).toBe('lobby');
        }
      }
      expect(finished).toBe(300);
    });
  }
});
