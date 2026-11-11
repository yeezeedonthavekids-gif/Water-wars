import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../client/api';
import { sfx } from '../client/sound';
import type { RoomState } from '../client/useRoom';
import { Icon } from '../components/Icons';
import { Avatar, useToast } from '../components/ui';
import type { PublicView } from '../shared/types';

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.4 + Math.random() * 1.6,
        color: ['#4cc9f0', '#b18cff', '#ffc857', '#5ee6a0', '#ff7a8a', '#2dd4bf'][i % 6],
        rot: Math.random() * 360,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: p.color, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}

export function ResultsScreen({ room, view, onLeave }: { room: RoomState; view: PublicView; onLeave: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isHost = view.hostId === room.uid;
  const results = view.results ?? [];
  const winners = results.filter((r) => view.winnerIds.includes(r.id));
  const iWon = view.winnerIds.includes(room.uid);
  const battle = view.mode === 'battle';

  useEffect(() => {
    sfx(iWon ? 'win' : 'correct');
  }, [iWon]);

  const rematch = async () => {
    setBusy(true);
    try {
      await api({ op: 'rematch', code: view.code });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not start a rematch.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen results">
      <Confetti />
      <div className="winner-hero">
        <div className="trophy">
          <Icon name="trophy" size={34} />
        </div>
        <div className="winner-avatars">
          {winners.map((w) => (
            <Avatar key={w.id} index={w.avatar} size={84} name={w.name} />
          ))}
        </div>
        <h1 className="winner-title">
          {winners.length === 0 ? 'Game over' : winners.length === 1 ? `${winners[0].name} wins!` : `${winners.map((w) => w.name).join(' & ')} tie!`}
        </h1>
        <p className="muted">{iWon ? 'Your science skills made a splash. 🌊' : battle ? 'The last drop standing takes it all.' : 'Great game, scientists!'}</p>
      </div>

      <section className="panel ranking">
        <h2>Final rankings</h2>
        <ol className="rank-list">
          {results.map((r, i) => (
            <li key={r.id} className={`rank-row ${r.rank === 1 ? 'first' : ''} ${r.id === room.uid ? 'is-me' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>
              <span className={`rank-num r${r.rank}`}>{r.rank}</span>
              <Avatar index={r.avatar} size={38} name={r.name} />
              <div className="rank-main">
                <div className="player-name">
                  {r.name} {r.id === room.uid && <span className="you-tag">you</span>}
                  {r.status === 'left' && <span className="muted small"> (left)</span>}
                  {r.wentOut && <span className="chip chip-sm cat-realworld">Emptied hand!</span>}
                </div>
                <div className="rank-stats">
                  <span title="Correct answers">✅ {r.stats.correct}/{r.stats.correct + r.stats.wrong} answers</span>
                  {battle ? (
                    <>
                      <span>💥 {r.stats.damage} dmg</span>
                      <span>🎯 {r.stats.kos} KO</span>
                    </>
                  ) : (
                    <>
                      <span>🃏 {r.stats.played} played</span>
                    </>
                  )}
                </div>
              </div>
              <div className="rank-score">
                {battle ? (
                  <>
                    <b>{r.status === 'active' ? `${r.hp} HP` : 'KO'}</b>
                    <span className="muted small">{r.score} pts</span>
                  </>
                ) : (
                  <>
                    <b>{r.cardsLeft ?? 0}</b>
                    <span className="muted small">{r.cardsLeft === 1 ? 'card left' : 'cards left'}</span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="results-cta">
        {isHost ? (
          <button className="btn btn-primary btn-xl" onClick={rematch} disabled={busy}>
            {busy ? <span className="btn-spinner" /> : <Icon name="refresh" />} Rematch
          </button>
        ) : (
          <div className="waiting-note">
            <span className="pulse-dot" /> Waiting for the host to start a rematch…
          </div>
        )}
        <button className="btn btn-secondary" onClick={onLeave}>
          <Icon name="logout" /> Return to menu
        </button>
      </div>
    </main>
  );
}
