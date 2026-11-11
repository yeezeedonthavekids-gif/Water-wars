// Building blocks for the gameplay screen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { serverNow } from '../client/api';
import { sfx } from '../client/sound';
import type { RoomState } from '../client/useRoom';
import { CATEGORY_LABEL, defOf, isPropertyCard, needsTarget, PROPERTY_LABEL } from '../shared/cards';
import type { GameAction, LogEntry, Mode, Property, PublicPending, PublicPlayer, PublicView, QuestionResult, WaterPowerChoice } from '../shared/types';
import { BATTLE_HP } from '../shared/types';
import { Icon } from '../components/Icons';
import { Avatar, CardView, Modal, PROP_CLASS } from '../components/ui';
import { isOnline } from './LobbyScreen';

const PROPS: Property[] = ['cohesion', 'adhesion', 'surface'];

/** Re-render every `ms` milliseconds. */
export function useTick(ms = 500) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** Tracks numeric changes for floating +N / -N indicators. */
export function useDelta(value: number) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null);
  useEffect(() => {
    if (value !== prev.current) {
      const d = value - prev.current;
      prev.current = value;
      setDelta({ v: d, k: Date.now() });
      const t = setTimeout(() => setDelta(null), 1400);
      return () => clearTimeout(t);
    }
  }, [value]);
  return delta;
}

export function Countdown({ deadline, total, compact }: { deadline: number; total: number; compact?: boolean }) {
  useTick(250);
  const left = Math.max(0, deadline - serverNow());
  const secs = Math.ceil(left / 1000);
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  const urgent = secs <= 10;
  return (
    <span className={`countdown ${urgent ? 'urgent' : ''} ${compact ? 'compact' : ''}`}>
      <Icon name="timer" size={14} />
      <span className="countdown-num">{secs}s</span>
      {!compact && (
        <span className="countdown-bar">
          <span style={{ width: `${pct}%` }} />
        </span>
      )}
    </span>
  );
}

export function HpBar({ hp, shield }: { hp: number; shield: number }) {
  const pct = Math.max(0, (hp / BATTLE_HP) * 100);
  return (
    <div className="hp">
      <div className={`hp-bar ${pct <= 30 ? 'low' : ''}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="hp-num">
        <Icon name="heart" size={12} /> {Math.max(0, hp)}
      </span>
      {shield > 0 && (
        <span className="hp-shield" title="Shield">
          <Icon name="shield" size={12} /> {shield}
        </span>
      )}
    </div>
  );
}

export function OpponentChip({
  p, view, room, onClick,
}: { p: PublicPlayer; view: PublicView; room: RoomState; onClick?: () => void }) {
  const battle = view.mode === 'battle';
  const isTurn = view.turn?.playerId === p.id;
  const answering = view.pending?.kind === 'question' && view.pending.responderId === p.id;
  const trading = view.pending?.kind === 'trade' && view.pending.toId === p.id;
  const online = isOnline(room, p.id);
  const cardDelta = useDelta(p.handCount);
  const hpDelta = useDelta(p.hp);
  const prevHp = useRef(p.hp);
  const [hit, setHit] = useState(false);
  useEffect(() => {
    if (p.hp < prevHp.current) {
      setHit(true);
      sfx('hit');
      const t = setTimeout(() => setHit(false), 500);
      prevHp.current = p.hp;
      return () => clearTimeout(t);
    }
    prevHp.current = p.hp;
  }, [p.hp]);

  return (
    <button
      type="button"
      className={`opp ${isTurn ? 'is-turn' : ''} ${p.status !== 'active' ? `is-${p.status}` : ''} ${hit ? 'is-hit' : ''}`}
      onClick={onClick}
      data-player={p.id}
    >
      <div className="avatar-wrap">
        <Avatar index={p.avatar} size={38} name={p.name} />
        <span className={`presence-dot ${online ? 'on' : 'off'}`} />
        {isTurn && <span className="turn-ring" />}
      </div>
      <div className="opp-info">
        <div className="opp-name">
          {p.id === view.hostId && <Icon name="crown" size={11} className="crown" />}
          {p.name}
        </div>
        {battle ? (
          p.status === 'out' ? <div className="ko-tag">KO</div> : <HpBar hp={p.hp} shield={p.shield} />
        ) : (
          <div className="opp-score">
            <b>{p.handCount}</b> {p.handCount === 1 ? 'card left!' : 'cards'}
            {p.shield > 0 && <Icon name="shield" size={12} className="shield-ico" />}
          </div>
        )}
        <div className="opp-meta">
          {battle && (
            <span className="hand-count">
              <Icon name="deck" size={12} /> {p.handCount}
            </span>
          )}
          {p.boost && <span className="boost-tag" title="H-Bond Boost ready"><Icon name="bolt" size={11} /></span>}
          {answering && <span className="status-tag">answering…</span>}
          {trading && <span className="status-tag">trading…</span>}
          {!online && p.status === 'active' && <span className="status-tag off">offline</span>}
          {p.status === 'left' && <span className="status-tag off">left</span>}
        </div>
      </div>
      {cardDelta && !battle && cardDelta.v !== 0 && (
        <span key={cardDelta.k} className={`float-delta ${cardDelta.v < 0 ? 'up' : 'down'}`}>
          {cardDelta.v > 0 ? `+${cardDelta.v} 🃏` : `${cardDelta.v} 🃏`}
        </span>
      )}
      {hpDelta && battle && hpDelta.v !== 0 && (
        <span key={hpDelta.k} className={`float-delta ${hpDelta.v > 0 ? 'heal' : 'down'}`}>
          {hpDelta.v > 0 ? `+${hpDelta.v}` : hpDelta.v}
        </span>
      )}
    </button>
  );
}

export function logIcon(kind: LogEntry['kind']) {
  return { play: '•', join: '👋', science: '🔬', turn: '↻', system: '•', score: '★', good: '✓', bad: '✗' }[kind] ?? '•';
}

export function EventFeed({ log }: { log: LogEntry[] }) {
  const items = log.slice(-3).reverse();
  return (
    <ul className="feed" aria-live="polite">
      {items.map((e, i) => (
        <li key={e.seq} className={`feed-item k-${e.kind} ${i === 0 ? 'newest' : ''}`}>
          {e.text}
        </li>
      ))}
    </ul>
  );
}

export function Scoreboard({ view, uid }: { view: PublicView; uid: string }) {
  const battle = view.mode === 'battle';
  const sorted = [...view.players].sort((a, b) =>
    battle ? (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || b.hp - a.hp || b.score - a.score : a.handCount - b.handCount,
  );
  return (
    <ol className="scoreboard">
      {sorted.map((p, i) => (
        <li key={p.id} className={`${p.id === uid ? 'is-me' : ''} ${view.turn?.playerId === p.id ? 'is-turn' : ''} ${p.status !== 'active' ? 'is-out' : ''}`}>
          <span className="sb-rank">{i + 1}</span>
          <Avatar index={p.avatar} size={24} name={p.name} />
          <span className="sb-name">{p.name}{p.id === uid ? ' (you)' : ''}</span>
          <span className="sb-val">{battle ? (p.status === 'out' ? 'KO' : `${p.hp} HP`) : `${p.handCount} 🃏`}</span>
        </li>
      ))}
    </ol>
  );
}

export function LogList({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log.length]);
  return (
    <ol className="log-list" ref={ref}>
      {log.map((e) => (
        <li key={e.seq} className={`k-${e.kind}`}>
          <span className="log-ico">{logIcon(e.kind)}</span>
          <span>{e.text}</span>
        </li>
      ))}
    </ol>
  );
}

// ───────── Questions ─────────
export function QuestionModal({
  pending, view, uid, onAnswer, busy,
}: { pending: Extract<PublicPending, { kind: 'question' }>; view: PublicView; uid: string; onAnswer: (i: number) => void; busy: boolean }) {
  const mine = pending.responderId === uid;
  const responder = view.players.find((p) => p.id === pending.responderId);
  const [minimized, setMinimized] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    setPicked(null);
    setMinimized(false);
  }, [pending.id]);

  if (minimized && !mine) {
    return (
      <button className="question-pill" onClick={() => setMinimized(false)}>
        <Icon name="help" size={16} /> {responder?.name} is answering… <Countdown deadline={pending.deadline} total={45000} compact />
      </button>
    );
  }
  return (
    <Modal open dismissable={!mine} onClose={() => setMinimized(true)} className="question-modal">
      <div className="q-head">
        <div className="q-kicker">
          <Icon name="sparkle" size={16} /> {pending.title}
        </div>
        <Countdown deadline={pending.deadline} total={45000} />
      </div>
      {pending.cardId && (
        <div className="q-card">
          <CardView id={pending.cardId} size="sm" mode={view.mode} />
        </div>
      )}
      <p className="q-who">
        {mine ? <b>Your science check!</b> : <><b>{responder?.name}</b> is answering. Think along!</>}
      </p>
      <h2 className="q-prompt">{pending.prompt}</h2>
      <div className="q-options">
        {pending.options.map((o, i) => (
          <button
            key={i}
            className={`q-opt ${picked === i ? 'picked' : ''}`}
            disabled={!mine || busy || picked !== null}
            onClick={() => {
              setPicked(i);
              onAnswer(i);
            }}
          >
            <span className="q-letter">{String.fromCharCode(65 + i)}</span>
            <span>{o}</span>
          </button>
        ))}
      </div>
      <div className="q-stakes">
        <Icon name="star" size={14} /> {pending.stakes}
      </div>
    </Modal>
  );
}

export function QuestionResultModal({ result, view, uid, onClose }: { result: QuestionResult; view: PublicView; uid: string; onClose: () => void }) {
  const mine = result.responderId === uid;
  const who = view.players.find((p) => p.id === result.responderId)?.name ?? 'Someone';
  useEffect(() => {
    sfx(result.correct ? 'correct' : 'wrong');
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [result.id, result.correct, onClose]);
  return (
    <Modal open onClose={onClose} className={`result-modal ${result.correct ? 'good' : 'bad'}`}>
      <div className="result-badge">
        <Icon name={result.correct ? 'check' : 'close'} size={34} strokeWidth={3} />
      </div>
      <h2 className="result-title">
        {result.correct ? (mine ? 'Correct!' : `${who} got it!`) : result.chosen === -1 ? (mine ? "Time's up!" : `${who} ran out of time`) : mine ? 'Not quite!' : `${who} missed it`}
      </h2>
      <p className="result-outcome">{result.outcome}</p>
      <div className="result-q">
        <p className="muted small">{result.prompt}</p>
        <div className="result-answer">
          <Icon name="check" size={16} /> {result.options[result.correctIndex]}
        </div>
        {!result.correct && result.chosen >= 0 && (
          <div className="result-wrong">
            <Icon name="close" size={16} /> {result.options[result.chosen]}
          </div>
        )}
      </div>
      <div className="rule-box science">
        <div className="rule-title">
          <Icon name="drop" size={14} /> Why?
        </div>
        <p>{result.explain}</p>
      </div>
      <button className="btn btn-primary" onClick={onClose}>
        Continue
      </button>
    </Modal>
  );
}

// ───────── Pickers ─────────
function TargetPicker({
  view, uid, value, onChange, filter,
}: { view: PublicView; uid: string; value: string | null; onChange: (id: string) => void; filter?: (p: PublicPlayer) => string | null }) {
  const opps = view.players.filter((p) => p.id !== uid && p.status === 'active');
  const valid = opps.filter((p) => !filter?.(p));
  useEffect(() => {
    if (!value && valid.length === 1) onChange(valid[0].id);
  }, [value, valid.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="target-grid">
      {opps.map((p) => {
        const reason = filter?.(p) ?? null;
        return (
          <button key={p.id} type="button" className={`target ${value === p.id ? 'on' : ''}`} disabled={!!reason} onClick={() => onChange(p.id)} title={reason ?? ''}>
            <Avatar index={p.avatar} size={32} name={p.name} />
            <span className="target-name">{p.name}</span>
            <span className="muted small">
              {view.mode === 'battle' ? `${p.hp} HP${p.shield ? ` · 🛡${p.shield}` : ''}` : `${p.score} pts`} · {p.handCount} cards
            </span>
            {reason && <span className="target-why">{reason}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PropertyPicker({ value, onChange }: { value: Property | null; onChange: (p: Property) => void }) {
  return (
    <div className="prop-picker">
      {PROPS.map((p) => (
        <button key={p} type="button" className={`prop-btn ${PROP_CLASS[p]} ${value === p ? 'on' : ''}`} onClick={() => onChange(p)}>
          <span className="prop-swatch" />
          {PROPERTY_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

function CardPicker({ cards, value, onChange, mode }: { cards: string[]; value: string | null; onChange: (c: string) => void; mode: Mode }) {
  if (!cards.length) return <p className="muted small">No eligible cards.</p>;
  return (
    <div className="pick-cards">
      {cards.map((c) => (
        <CardView key={c} id={c} size="sm" mode={mode} selected={value === c} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

/** Collects whatever extra input a card needs (target, options) before playing it. */
export function PlayDialog({
  cardId, view, uid, hand, onPlay, onClose, busy,
}: { cardId: string; view: PublicView; uid: string; hand: string[]; onPlay: (a: GameAction) => void; onClose: () => void; busy: boolean }) {
  const def = defOf(cardId);
  const mode = view.mode;
  const battle = mode === 'battle';
  const [target, setTarget] = useState<string | null>(null);
  const [style, setStyle] = useState<'attack' | 'boost' | 'combo'>('attack');
  const [combo, setCombo] = useState<string | null>(null);
  const [give, setGive] = useState<string | null>(null);
  const [prop, setProp] = useState<Property | null>(null);
  const [choice, setChoice] = useState<WaterPowerChoice | null>(null);

  const others = hand.filter((c) => c !== cardId);
  const comboCards = useMemo(
    () => others.filter((c) => isPropertyCard(defOf(c)) && defOf(c).category !== def.category),
    [others, def.category],
  );
  const wantTarget = needsTarget(def, mode);
  const isAttack = battle && isPropertyCard(def);
  const wantGive = def.effect === 'swap' || (!battle && def.effect === 'grab');
  const wantProp = !battle && def.effect === 'wildBond';
  const wantChoice = def.effect === 'waterPower';
  const targetFilter = (p: PublicPlayer) => {
    if ((battle && def.effect === 'grab') || def.effect === 'swap') return p.handCount < 1 ? 'no cards' : null;
    return null;
  };

  const ready =
    (!wantTarget || !!target) && (!wantGive || !!give) && (!wantProp || !!prop) && (!wantChoice || !!choice) && (style !== 'combo' || !!combo);

  const submit = () => {
    const a: GameAction = { type: 'play', cardId };
    if (target) a.targetId = target;
    if (isAttack && style === 'boost') a.boost = true;
    if (isAttack && style === 'combo' && combo) a.comboCardId = combo;
    if (give) a.giveCardId = give;
    if (prop) a.property = prop;
    if (choice) a.choice = choice;
    onPlay(a);
  };

  const choiceLabels: Record<WaterPowerChoice, [string, string]> = battle
    ? { draw: ['Draw 2', 'Two more cards'], points: ['Heal 3', 'Restore HP'], shield: ['Shield 3', 'Absorb damage'] }
    : { draw: ['Next draws 2', 'Next player draws 2 cards'], points: ['Skip next', 'Next player loses a turn'], shield: ['Shield', 'Block the next attack on you'] };

  return (
    <Modal open onClose={onClose} title={`Play ${def.name}`} className="play-dialog" wide>
      <div className="play-layout">
        <div className="play-card">
          <CardView id={cardId} size="md" mode={mode} />
          <p className="small muted">{battle ? def.battle : def.classic}</p>
        </div>
        <div className="play-options">
          {isAttack && (
            <section>
              <h3>Attack style</h3>
              <div className="style-grid">
                <button type="button" className={`style-btn ${style === 'attack' ? 'on' : ''}`} onClick={() => setStyle('attack')}>
                  <b>Attack</b>
                  <span>{def.power} damage, guaranteed</span>
                </button>
                <button type="button" className={`style-btn ${style === 'boost' ? 'on' : ''}`} onClick={() => setStyle('boost')}>
                  <b>🔬 Science Boost</b>
                  <span>Answer right: {def.power * 2}. Wrong: 0</span>
                </button>
                <button type="button" className={`style-btn ${style === 'combo' ? 'on' : ''}`} disabled={!comboCards.length} onClick={() => setStyle('combo')}>
                  <b>💥 Combo</b>
                  <span>{comboCards.length ? '+ a different property, combo question' : 'Needs a 2nd property card'}</span>
                </button>
              </div>
              {style === 'combo' && (
                <>
                  <h3>Combo partner</h3>
                  <CardPicker cards={comboCards} value={combo} onChange={setCombo} mode={mode} />
                </>
              )}
            </section>
          )}
          {wantTarget && (
            <section>
              <h3>{def.category === 'challenge' ? 'Who do you challenge?' : 'Target'}</h3>
              <TargetPicker view={view} uid={uid} value={target} onChange={setTarget} filter={targetFilter} />
            </section>
          )}
          {wantGive && (
            <section>
              <h3>{def.effect === 'grab' ? 'Card to push into their hand' : 'Card to give away'}</h3>
              <CardPicker cards={others} value={give} onChange={setGive} mode={mode} />
            </section>
          )}
          {wantProp && (
            <section>
              <h3>New active property</h3>
              <PropertyPicker value={prop} onChange={setProp} />
            </section>
          )}
          {wantChoice && (
            <section>
              <h3>Choose your Water Power</h3>
              <div className="style-grid">
                {(['draw', 'points', 'shield'] as WaterPowerChoice[]).map((c) => (
                  <button key={c} type="button" className={`style-btn ${choice === c ? 'on' : ''}`} onClick={() => setChoice(c)}>
                    <b>{choiceLabels[c][0]}</b>
                    <span>{choiceLabels[c][1]}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {def.category === 'realworld' && (
            <p className="hint-box">
              <Icon name="sparkle" size={16} /> After you play it, you'll name the property this example shows.
            </p>
          )}
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={!ready || busy} onClick={submit}>
              {busy ? <span className="btn-spinner" /> : <Icon name="play" size={16} />} Play card
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function categoryHint(id: string) {
  const d = defOf(id);
  return `${CATEGORY_LABEL[d.category]} card`;
}
