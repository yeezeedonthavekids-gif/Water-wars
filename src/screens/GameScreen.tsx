import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { act, ApiError, serverNow } from '../client/api';
import { useSettings } from '../client/settings';
import { sfx } from '../client/sound';
import type { RoomState } from '../client/useRoom';
import { classicPlayable, defOf, isPropertyCard, isStackable, needsTarget, PROPERTY_LABEL } from '../shared/cards';
import type { GameAction, PublicView } from '../shared/types';
import { Icon } from '../components/Icons';
import { Avatar, CardBack, CardDetail, CardView, Modal, useToast } from '../components/ui';
import {
  Countdown, EventFeed, HpBar, LogList, OpponentChip, PlayDialog, QuestionModal, QuestionResultModal,
  Scoreboard, useDelta, useTick,
} from './GameParts';
import { RulesBattle, RulesClassic } from './HowToPlay';

type Dialog =
  | { kind: 'play'; cardId: string }
  | { kind: 'detail'; cardId: string }
  | { kind: 'log' }
  | { kind: 'leave' }
  | { kind: 'rules' }
  | null;

const QUIET_ERRORS = new Set(['NOT_EXPIRED']);

/** Stable pseudo-random tilt per card so the pile looks naturally messy. */
function tilt(id: string, range = 10) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % (range * 20)) / 10 - range);
}

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
  }, [hand, selected]);
  useEffect(() => {
    if (!myTurn) {
      setDialog((d) => (d && d.kind === 'play' ? null : d));
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

  // ── Big pop-up callouts (SKIP!, +4!, CAUGHT!…) and screen shake ──
  const [callout, setCallout] = useState<{ text: string; tone: string; k: number } | null>(null);
  const [shake, setShake] = useState(0);
  const pop = useCallback((text: string, tone: string, rumble = false) => {
    setCallout({ text, tone, k: Date.now() + Math.random() });
    if (rumble) setShake(Date.now());
  }, []);
  useEffect(() => {
    if (!callout) return;
    const t = setTimeout(() => setCallout(null), 1300);
    return () => clearTimeout(t);
  }, [callout]);
  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(0), 500);
    return () => clearTimeout(t);
  }, [shake]);

  const prevTop = useRef(view.discardTop);
  useEffect(() => {
    if (view.discardTop !== prevTop.current) {
      prevTop.current = view.discardTop;
      sfx('play');
      if (!view.discardTop || battle) return;
      const fx = defOf(view.discardTop).effect;
      const map: Record<string, [string, string, boolean?]> = {
        soap: ['SKIP!', 'red'],
        evaporation: ['REVERSE!', 'gold'],
        capillary: ['+2!', 'red'],
        rain: ['+2!', 'red'],
        storm: ['+4!', 'red', true],
        whirlpool: ['SWAP!', 'purple', true],
        current: ['PASS IT ON!', 'blue', true],
        hbond: ['AGAIN!', 'green'],
        splash: ['SPLASH ATTACK!', 'blue'],
        grab: ['GOTCHA!', 'purple'],
      };
      const hit = fx ? map[fx] : undefined;
      if (hit) pop(hit[0], hit[1], !!hit[2]);
      else if (defOf(view.discardTop).category === 'challenge') pop('CHALLENGE!', 'gold');
    }
  }, [view.discardTop, battle, pop]);

  // Callouts from game events in the log.
  const lastSeq = useRef(view.log.length ? view.log[view.log.length - 1].seq : 0);
  useEffect(() => {
    const fresh = view.log.filter((e) => e.seq > lastSeq.current);
    if (!fresh.length) return;
    lastSeq.current = fresh[fresh.length - 1].seq;
    for (const e of fresh) {
      const took = e.text.match(/draws (\d+) cards!/);
      if (e.text.includes('Caught by')) {
        pop('CAUGHT! +2', 'red', true);
        sfx('wrong');
      } else if (e.text.includes('called SPLASH')) {
        pop('SPLASH!', 'blue');
      } else if (took && e.text.includes('😱')) {
        pop(`+${took[1]} 😱`, 'red', Number(took[1]) >= 4);
      } else if (e.text.includes('blocked all')) {
        pop('BLOCKED!', 'green');
      } else if (e.text.includes('💥')) {
        pop('KO!', 'red', true);
      }
    }
  }, [view.log, pop]);

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
    const key = `${deadline}:${responsible}:${offlineLong ? `off${Math.floor(serverNow() / 5000)}` : 'exp'}`;
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
    if (view.drawStack > 0) return isStackable(d);
    return classicPlayable(d, view.activeProperty, top);
  };

  const onCardTap = (c: string) => {
    sfx('click');
    setSelected((s) => (s === c ? null : c));
  };

  const playSelected = async () => {
    if (!selected) return;
    const d = defOf(selected);
    const needsDialog = needsTarget(d, mode) || d.effect === 'swap' || (!battle && (d.effect === 'grab' || d.effect === 'storm')) || d.effect === 'waterPower' || (!battle && d.effect === 'wildBond') || (battle && isPropertyCard(d));
    if (needsDialog) return setDialog({ kind: 'play', cardId: selected });
    if (await send({ type: 'play', cardId: selected })) setSelected(null);
  };

  const myScoreDelta = useDelta(battle ? me.hp : 0);
  const anyPlayable = hand.some((c) => playable(c));
  const turnTotal = 90000;
  const activeColor = view.activeProperty ? `cat-${view.activeProperty}` : '';

  // Help text for the current situation.
  let hint = '';
  if (me.status === 'out') hint = 'Your drop evaporated. Watch and cheer!';
  else if (!myTurn) hint = current ? `Waiting for ${current.name}…` : '';
  else if (pending) hint = '';
  else if (battle) hint = view.turn?.powerDone ? 'Play one card, or Rest.' : 'Use a Power-Up (free), then play one card or Rest.';
  else if (!battle && view.drawStack > 0) hint = anyPlayable ? `Stack a draw card to pass it on, or take ${view.drawStack} cards!` : `No draw card to stack. Take ${view.drawStack} cards!`;
  else if (stage === 'afterDraw') hint = anyPlayable ? 'You can play a glowing card now, or end your turn.' : 'Still no match. Tap End turn.';
  else hint = anyPlayable ? 'Tap a glowing card, then tap Play.' : 'No card matches. Tap Draw.';

  const selDef = selected ? defOf(selected) : null;

  return (
    <div className={`game ${battle ? 'mode-battle' : 'mode-classic'} ${myTurn ? 'my-turn' : ''} ${shake ? 'shake-screen' : ''}`}>
      <header className="game-top">
        <button className="icon-btn" onClick={() => setDialog({ kind: 'leave' })} aria-label="Leave game">
          <Icon name="logout" />
        </button>
        <div className="game-title">
          <span className="gt-mode">{battle ? 'Battle' : 'Classic'}</span>
          <span className="gt-sep">·</span>
          <span>Round {view.round}/{view.maxRounds}</span>
          <span className="gt-sep gt-sep-code">·</span>
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
          <OpponentChip
            key={p.id}
            p={p}
            view={view}
            room={room}
            onCatch={me.status === 'active' ? () => void send({ type: 'catch', targetId: p.id }).then((ok) => ok && sfx('hit')) : undefined}
          />
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
            <div className="deck-stack">
              {view.deckCount > 30 && <div className="deck-layer l3" />}
              {view.deckCount > 12 && <div className="deck-layer l2" />}
              {view.deckCount > 1 && <div className="deck-layer l1" />}
              {view.deckCount > 0 ? <CardBack size="md" count={view.deckCount} className="deck-card" /> : <div className="card card-md card-empty">Empty</div>}
            </div>
            <span className="pile-label">Deck</span>
          </div>
          <div className={`pile discard ${activeColor}`}>
            {!battle && view.drawStack > 0 && <div key={`stack-${view.drawStack}`} className="stack-badge">+{view.drawStack}</div>}
            {view.discardRecent.slice(0, -1).map((c, i, arr) => (
              <div key={c} className="discard-under" style={{ transform: `rotate(${tilt(c)}deg) translate(${tilt(c, 7)}px, ${(arr.length - i) * 2}px)` }}>
                <CardView id={c} size="md" mode={mode} />
              </div>
            ))}
            {top ? (
              <div key={top} className={`discard-wrap ${lastActorIsMe ? 'from-me' : 'from-opp'}`} style={{ ['--tilt' as string]: `${tilt(top)}deg` }}>
                <CardView id={top} size="md" mode={mode} onClick={() => setDialog({ kind: 'detail', cardId: top })} />
                <span className="ripple" />
                <span className="ripple r2" />
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
              me.status === 'out' ? <div className="ko-tag">KO</div> : <HpBar hp={me.hp} shield={me.shield} max={view.maxHp} />
            ) : (
              <div className="me-score">
                <b>{hand.length}</b> {hand.length === 1 ? 'card left!' : 'cards left'}
                {me.shield > 0 && <span className="chip chip-sm"><Icon name="shield" size={12} /> Shield</span>}
              </div>
            )}
          </div>
          {me.boost && <span className="chip chip-sm boost-chip"><Icon name="bolt" size={12} /> Boost</span>}
          {!battle && me.status === 'active' && hand.length <= 2 && hand.length > 0 && (
            me.called ? (
              <span className="splash-tag big">💦 Called!</span>
            ) : (
              <button className="splash-btn" onClick={() => void send({ type: 'splash' }).then((ok) => ok && sfx('correct'))}>
                SPLASH!
              </button>
            )
          )}
          {myScoreDelta && myScoreDelta.v !== 0 && (
            <span key={myScoreDelta.k} className={`float-delta ${myScoreDelta.v > 0 ? (battle ? 'heal' : 'up') : 'down'}`}>
              {myScoreDelta.v > 0 ? `+${myScoreDelta.v}` : myScoreDelta.v}
            </span>
          )}
        </div>
        <div className="hint">{hint}</div>
      </section>

      <section className="actions">
        {selected && selDef ? (
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
            <button className={`btn btn-primary btn-sm ${anyPlayable ? '' : 'glow-btn'}`} disabled={!canAct} onClick={() => send({ type: 'endTurn' })}>
              <Icon name="next" size={16} /> End turn
            </button>
          ) : (
            view.drawStack > 0 ? (
              <button className={`btn btn-sm btn-danger ${anyPlayable ? '' : 'glow-btn'}`} disabled={!canAct} onClick={() => send({ type: 'draw' })}>
                <Icon name="deck" size={16} /> Take {view.drawStack} cards
              </button>
            ) : (
              <button className={`btn btn-sm ${anyPlayable ? 'btn-secondary' : 'btn-primary glow-btn'}`} disabled={!canAct} onClick={() => send({ type: 'draw' })}>
                <Icon name="deck" size={16} /> Draw a card
              </button>
            )
          )
        ) : null}
      </section>

      <section className={`hand ${hand.length > 7 ? 'crowded' : ''}`} aria-label="Your hand">
        {hand.length === 0 && <div className="hand-empty muted">{me.status === 'active' ? 'No cards' : ''}</div>}
        {hand.map((c, i) => {
          const can = playable(c);
          return (
            <div key={c} className={`hand-slot ${fresh.has(c) ? 'is-new' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <CardView
                id={c}
                size="sm"
                mode={mode}
                selected={selected === c}
                glow={can}
                dim={myTurn && !pending && !can}
                onClick={() => onCardTap(c)}
              />
            </div>
          );
        })}
      </section>

      {banner && <div className="your-turn-banner">{banner}</div>}
      {callout && (
        <div key={callout.k} className={`callout tone-${callout.tone}`} aria-live="polite">
          <span className="callout-text">{callout.text}</span>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="callout-drop" style={{ ['--a' as string]: `${i * 36}deg` }} />
          ))}
        </div>
      )}

      {pending?.kind === 'question' && (
        <QuestionModal pending={pending} view={view} uid={uid} busy={busy} onAnswer={(i) => send({ type: 'answer', choice: i })} />
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
