import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { act, ApiError, serverNow } from '../client/api';
import { useSettings } from '../client/settings';
import { sfx } from '../client/sound';
import type { RoomState } from '../client/useRoom';
import { classicPlayable, defOf, isPropertyCard, needsTarget, PROPERTY_LABEL } from '../shared/cards';
import type { GameAction, PublicView } from '../shared/types';
import { Icon } from '../components/Icons';
import { Avatar, CardBack, CardDetail, CardView, Modal, useToast } from '../components/ui';
import {
  AskDialog, Countdown, EventFeed, HpBar, LogList, OpponentChip, PlayDialog, QuestionModal, QuestionResultModal,
  Scoreboard, TradeDialog, TradeResponseModal, useDelta, useTick,
} from './GameParts';
import { RulesBattle, RulesClassic } from './HowToPlay';

type Dialog =
  | { kind: 'play'; cardId: string }
  | { kind: 'detail'; cardId: string }
  | { kind: 'ask' }
  | { kind: 'trade' }
  | { kind: 'log' }
  | { kind: 'leave' }
  | { kind: 'rules' }
  | null;

const QUIET_ERRORS = new Set(['NOT_EXPIRED']);

export function GameScreen({ room, view, onLeave }: { room: RoomState; view: PublicView; onLeave: () => void }) {
  const toast = useToast();
  const settings = useSettings();
  const uid = room.uid;
  const mode = view.mode;
  const battle = mode === 'battle';
  const me = view.players.find((p) => p.id === uid)!;
  const myTurn = view.turn?.playerId === uid && me.status === 'active';
  const current = view.players.find((p) => p.id === view.turn?.playerId);
  const pending = view.pending;
  const hand = room.hand;

  const [selected, setSelected] = useState<string | null>(null);
  const [setPick, setSetPick] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [resultShown, setResultShown] = useState<string | null>(view.lastQuestion?.id ?? null);
  const [banner, setBanner] = useState<string | null>(null);

  const send = useCallback(
    async (action: GameAction, opts: { quiet?: boolean } = {}) => {
      if (!opts.quiet) setBusy(true);
      try {
        await act(view.code, action);
        return true;
      } catch (e) {
        const code = e instanceof ApiError ? e.code : '';
        if (!opts.quiet && !QUIET_ERRORS.has(code)) {
          toast(e instanceof Error ? e.message : 'Move failed.', 'bad');
          sfx('wrong');
        }
        return false;
      } finally {
        if (!opts.quiet) setBusy(false);
      }
    },
    [view.code, toast],
  );

  // Clear selections when the turn changes or cards leave the hand.
  useEffect(() => {
    if (selected && !hand.includes(selected)) setSelected(null);
    if (setPick && setPick.some((c) => !hand.includes(c))) setSetPick(null);
  }, [hand, selected, setPick]);
  useEffect(() => {
    if (!myTurn) {
      setSetPick(null);
      setDialog((d) => (d && (d.kind === 'play' || d.kind === 'ask' || d.kind === 'trade') ? null : d));
    }
  }, [myTurn]);

  // "Your turn!" banner + sounds.
  const prevTurn = useRef(view.turn?.number);
  useEffect(() => {
    if (view.turn && view.turn.number !== prevTurn.current) {
      prevTurn.current = view.turn.number;
      if (view.turn.playerId === uid) {
        setBanner('Your turn!');
        sfx('turn');
        const t = setTimeout(() => setBanner(null), 1300);
        return () => clearTimeout(t);
      }
    }
  }, [view.turn, uid]);

  const prevTop = useRef(view.discardTop);
  useEffect(() => {
    if (view.discardTop !== prevTop.current) {
      prevTop.current = view.discardTop;
      sfx('play');
    }
  }, [view.discardTop]);

  // Hand: animate newly received cards.
  const known = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set(hand));
  useEffect(() => {
    const incoming = hand.filter((c) => !known.current.has(c));
    known.current = new Set(hand);
    if (incoming.length) {
      setFresh(new Set(incoming));
      if (incoming.length < hand.length) sfx('draw');
      const t = setTimeout(() => setFresh(new Set()), 900);
      return () => clearTimeout(t);
    }
  }, [hand]);

  // Automatic timeouts (turn / question / trade), so disconnected players never stall the game.
  const timeoutKey = useRef('');
  useTick(1000);
  useEffect(() => {
    const responsible = pending?.kind === 'question' ? pending.responderId : pending?.kind === 'trade' ? pending.toId : view.turn?.playerId;
    const deadline = pending?.deadline ?? view.turn?.deadline;
    if (!responsible || !deadline) return;
    const seat = Math.max(0, view.players.findIndex((p) => p.id === uid));
    const stagger = 1500 + seat * 1200;
    const pres = room.presence[responsible];
    const offlineLong = pres && !pres.online && serverNow() - pres.at > 20000 + stagger;
    const expired = serverNow() > deadline + stagger;
    if (!expired && !offlineLong) return;
    const key = `${deadline}:${responsible}:${offlineLong ? 'off' : 'exp'}`;
    if (timeoutKey.current === key) return;
    timeoutKey.current = key;
    void send({ type: 'timeout' }, { quiet: true });
  });

  // Show the result of each answered question once.
  const lq = view.lastQuestion;
  const showResult = lq && lq.id !== resultShown && serverNow() - lq.at < 20000 ? lq : null;
  const closeResult = useCallback(() => setResultShown(lq?.id ?? null), [lq?.id]);

  const opponents = useMemo(() => {
    const idx = view.players.findIndex((p) => p.id === uid);
    return [...view.players.slice(idx + 1), ...view.players.slice(0, idx)];
  }, [view.players, uid]);

  const top = view.discardTop;
  const lastActorIsMe = view.lastAction?.actorId === uid;
  const canAct = myTurn && !pending && !busy;
  const stage = view.turn?.stage;

  const playable = (c: string) => {
    if (!canAct) return false;
    const d = defOf(c);
    if (battle) return !(d.category === 'powerup' && view.turn?.powerDone);
    return classicPlayable(d, view.activeProperty, top);
  };

  const possibleSets = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const c of hand) {
      const d = defOf(c);
      if (isPropertyCard(d)) (groups[d.category] ??= []).push(c);
    }
    return Object.values(groups).filter((g) => g.length >= 3);
  }, [hand]);

  const onCardTap = (c: string) => {
    if (setPick) {
      const d = defOf(c);
      if (!isPropertyCard(d)) return toast('Sets use property cards only.', 'info');
      setSetPick((s) => {
        if (!s) return s;
        if (s.includes(c)) return s.filter((x) => x !== c);
        if (s.length && defOf(s[0]).category !== d.category) return [c];
        return s.length >= 3 ? s : [...s, c];
      });
      return;
    }
    sfx('click');
    setSelected((s) => (s === c ? null : c));
  };

  const playSelected = async () => {
    if (!selected) return;
    const d = defOf(selected);
    const needsDialog = needsTarget(d, mode) || d.effect === 'swap' || d.effect === 'waterPower' || (!battle && d.effect === 'wildBond') || (battle && isPropertyCard(d));
    if (needsDialog) return setDialog({ kind: 'play', cardId: selected });
    if (await send({ type: 'play', cardId: selected })) setSelected(null);
  };

  const confirmSet = async () => {
    if (!setPick || setPick.length !== 3) return;
    if (await send({ type: 'set', cardIds: setPick })) setSetPick(null);
  };

  const startSet = () => {
    setSelected(null);
    setSetPick(possibleSets.length === 1 ? possibleSets[0].slice(0, 3) : []);
  };

  const myScoreDelta = useDelta(battle ? me.hp : me.score);
  const turnTotal = 90000;
  const activeColor = view.activeProperty ? `cat-${view.activeProperty}` : '';

  // Help text for the current situation.
  let hint = '';
  if (me.status === 'out') hint = 'Your drop evaporated. Watch and cheer!';
  else if (!myTurn) hint = current ? `Waiting for ${current.name}…` : '';
  else if (pending?.kind === 'trade') hint = 'Waiting for the trade response…';
  else if (pending) hint = '';
  else if (setPick) hint = `Pick 3 matching property cards (${setPick.length}/3)`;
  else if (battle) hint = view.turn?.powerDone ? 'Play one card, or Rest.' : 'Use a Power-Up (free), then play one card or Rest.';
  else if (stage === 'afterDraw') hint = 'Play a matching card, or end your turn.';
  else hint = `Match ${view.activeProperty ? PROPERTY_LABEL[view.activeProperty] : 'any property'}, draw, or Go Fish.`;

  const selDef = selected ? defOf(selected) : null;

  return (
    <div className={`game ${battle ? 'mode-battle' : 'mode-classic'} ${myTurn ? 'my-turn' : ''}`}>
      <header className="game-top">
        <button className="icon-btn" onClick={() => setDialog({ kind: 'leave' })} aria-label="Leave game">
          <Icon name="logout" />
        </button>
        <div className="game-title">
          <span className="gt-mode">{battle ? 'Battle' : 'Classic'}</span>
          <span className="gt-sep">·</span>
          <span>Round {view.round}/{view.maxRounds}</span>
          <span className="gt-sep">·</span>
          <span className="gt-code">{view.code}</span>
        </div>
        <button className="icon-btn" onClick={() => setDialog({ kind: 'rules' })} aria-label="Rules">
          <Icon name="help" />
        </button>
        <button className="icon-btn log-btn" onClick={() => setDialog({ kind: 'log' })} aria-label="Game log and scores">
          <Icon name="list" />
        </button>
      </header>

      <section className="opponents" aria-label="Opponents">
        {opponents.map((p) => (
          <OpponentChip key={p.id} p={p} view={view} room={room} />
        ))}
      </section>

      <section className="table">
        <div className={`turn-banner ${myTurn ? 'mine' : ''}`}>
          {current && <Avatar index={current.avatar} size={22} name={current.name} />}
          <span>{myTurn ? 'Your turn' : `${current?.name ?? '…'}'s turn`}</span>
          {view.turn && !pending && <Countdown deadline={view.turn.deadline} total={turnTotal} compact />}
          {!battle && view.turn && (
            <span className="dir" title="Turn direction">
              {view.turn.dir === 1 ? '↻' : '↺'}
            </span>
          )}
        </div>

        <div className="piles">
          <div className="pile">
            <CardBack size="md" count={view.deckCount} className="deck-card" />
            <span className="pile-label">Deck</span>
          </div>
          <div className={`pile discard ${activeColor}`}>
            {top ? (
              <div key={top} className={`discard-wrap ${lastActorIsMe ? 'from-me' : 'from-opp'}`}>
                <CardView id={top} size="md" mode={mode} onClick={() => setDialog({ kind: 'detail', cardId: top })} />
              </div>
            ) : (
              <div className="card card-md card-empty">Discard</div>
            )}
            <span className="pile-label">
              {!battle && view.activeProperty ? (
                <span className={`active-chip cat-${view.activeProperty}`}>
                  <span className="prop-swatch" /> {PROPERTY_LABEL[view.activeProperty]}
                </span>
              ) : (
                `Discard · ${view.discardCount}`
              )}
            </span>
          </div>
        </div>

        {settings.scienceTips && top && defOf(top).category !== 'realworld' && (
          <div key={`tip-${top}`} className="science-tip">
            <Icon name="drop" size={14} />
            <span>
              <b>{defOf(top).name}:</b> {defOf(top).science}
            </span>
          </div>
        )}
        <EventFeed log={view.log} />
      </section>

      <aside className="side">
        <div className="panel side-panel">
          <h3>Scoreboard</h3>
          <Scoreboard view={view} uid={uid} />
        </div>
        <div className="panel side-panel grow">
          <h3>Game log</h3>
          <LogList log={view.log} />
        </div>
      </aside>

      <section className="me-bar">
        <div className="me-id">
          <div className="avatar-wrap">
            <Avatar index={me.avatar} size={40} name={me.name} />
            {myTurn && <span className="turn-ring" />}
          </div>
          <div>
            <div className="me-name">{me.name} <span className="you-tag">you</span></div>
            {battle ? (
              me.status === 'out' ? <div className="ko-tag">KO</div> : <HpBar hp={me.hp} shield={me.shield} />
            ) : (
              <div className="me-score">
                <b>{me.score}</b> pts
                {me.shield > 0 && <span className="chip chip-sm"><Icon name="shield" size={12} /> Shield</span>}
                {me.sets > 0 && <span className="sets-tag">{me.sets}× set</span>}
              </div>
            )}
          </div>
          {me.boost && <span className="chip chip-sm boost-chip"><Icon name="bolt" size={12} /> Boost</span>}
          {myScoreDelta && myScoreDelta.v !== 0 && (
            <span key={myScoreDelta.k} className={`float-delta ${myScoreDelta.v > 0 ? (battle ? 'heal' : 'up') : 'down'}`}>
              {myScoreDelta.v > 0 ? `+${myScoreDelta.v}` : myScoreDelta.v}
            </span>
          )}
        </div>
        <div className="hint">{hint}</div>
      </section>

      <section className="actions">
        {setPick ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setSetPick(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={setPick.length !== 3 || busy} onClick={confirmSet}>
              <Icon name="layers" size={16} /> Bank set ({setPick.length}/3)
            </button>
          </>
        ) : selected && selDef ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setDialog({ kind: 'detail', cardId: selected })}>
              <Icon name="info" size={16} /> Details
            </button>
            {myTurn && (
              <button className="btn btn-primary btn-sm" disabled={!playable(selected)} onClick={playSelected}>
                <Icon name="play" size={16} /> Play {selDef.name}
              </button>
            )}
          </>
        ) : myTurn && me.status === 'active' ? (
          battle ? (
            <button className="btn btn-secondary btn-sm" disabled={!canAct} onClick={() => send({ type: 'rest' })}>
              <Icon name="rest" size={16} /> Rest (draw 1, heal 1)
            </button>
          ) : stage === 'afterDraw' ? (
            <button className="btn btn-primary btn-sm" disabled={!canAct} onClick={() => send({ type: 'endTurn' })}>
              <Icon name="next" size={16} /> End turn
            </button>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" disabled={!canAct} onClick={() => send({ type: 'draw' })}>
                <Icon name="deck" size={16} /> Draw
              </button>
              <button className="btn btn-secondary btn-sm" disabled={!canAct} onClick={() => setDialog({ kind: 'ask' })}>
                <Icon name="fish" size={16} /> Go Fish
              </button>
              {!view.turn?.setDone && possibleSets.length > 0 && (
                <button className="btn btn-secondary btn-sm glow-btn" disabled={!canAct} onClick={startSet}>
                  <Icon name="layers" size={16} /> Bank set
                </button>
              )}
              {!view.turn?.tradeDone && (
                <button className="btn btn-secondary btn-sm" disabled={!canAct || !hand.length} onClick={() => setDialog({ kind: 'trade' })}>
                  <Icon name="swap" size={16} /> Trade
                </button>
              )}
            </>
          )
        ) : null}
      </section>

      <section className={`hand ${hand.length > 7 ? 'crowded' : ''}`} aria-label="Your hand">
        {hand.length === 0 && <div className="hand-empty muted">{me.status === 'active' ? 'No cards' : ''}</div>}
        {hand.map((c, i) => {
          const can = playable(c);
          const inSet = setPick?.includes(c);
          return (
            <div key={c} className={`hand-slot ${fresh.has(c) ? 'is-new' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <CardView
                id={c}
                size="sm"
                mode={mode}
                selected={selected === c || inSet}
                glow={can && !setPick}
                dim={myTurn && !pending && !can && !setPick}
                onClick={() => onCardTap(c)}
              />
            </div>
          );
        })}
      </section>

      {banner && <div className="your-turn-banner">{banner}</div>}

      {pending?.kind === 'question' && (
        <QuestionModal pending={pending} view={view} uid={uid} busy={busy} onAnswer={(i) => send({ type: 'answer', choice: i })} />
      )}
      {pending?.kind === 'trade' && pending.toId === uid && (
        <TradeResponseModal pending={pending} view={view} hand={hand} busy={busy} onRespond={(accept, cardId) => send({ type: 'tradeRespond', accept, cardId })} />
      )}
      {pending?.kind === 'trade' && pending.toId !== uid && (
        <div className="question-pill static">
          <Icon name="swap" size={16} /> Waiting for {view.players.find((p) => p.id === pending.toId)?.name} to answer the trade…
          <Countdown deadline={pending.deadline} total={30000} compact />
        </div>
      )}
      {!pending && showResult && <QuestionResultModal result={showResult} view={view} uid={uid} onClose={closeResult} />}

      {dialog?.kind === 'play' && (
        <PlayDialog
          cardId={dialog.cardId}
          view={view}
          uid={uid}
          hand={hand}
          busy={busy}
          onClose={() => setDialog(null)}
          onPlay={async (a) => {
            if (await send(a)) {
              setDialog(null);
              setSelected(null);
            }
          }}
        />
      )}
      {dialog?.kind === 'ask' && (
        <AskDialog view={view} uid={uid} busy={busy} onClose={() => setDialog(null)} onAsk={async (t, p) => { if (await send({ type: 'ask', targetId: t, property: p })) setDialog(null); }} />
      )}
      {dialog?.kind === 'trade' && (
        <TradeDialog view={view} uid={uid} hand={hand} busy={busy} onClose={() => setDialog(null)} onTrade={async (t, g, w) => { if (await send({ type: 'trade', targetId: t, giveCardId: g, wantProperty: w })) setDialog(null); }} />
      )}
      <Modal open={dialog?.kind === 'detail'} onClose={() => setDialog(null)} wide>
        {dialog?.kind === 'detail' && <CardDetail id={dialog.cardId} mode={mode} />}
      </Modal>
      <Modal open={dialog?.kind === 'log'} onClose={() => setDialog(null)} title="Scores & log">
        <Scoreboard view={view} uid={uid} />
        <h3 className="mt">Game log</h3>
        <LogList log={view.log} />
      </Modal>
      <Modal open={dialog?.kind === 'rules'} onClose={() => setDialog(null)} title={battle ? 'Battle rules' : 'Classic rules'} wide>
        {battle ? <RulesBattle /> : <RulesClassic />}
      </Modal>
      <Modal open={dialog?.kind === 'leave'} onClose={() => setDialog(null)} title="Leave the game?">
        <p className="muted">You won't be able to rejoin this match. Your cards go to the discard pile and the game continues without you.</p>
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={() => setDialog(null)}>Stay</button>
          <button className="btn btn-danger" onClick={onLeave}>Leave game</button>
        </div>
      </Modal>
    </div>
  );
}
