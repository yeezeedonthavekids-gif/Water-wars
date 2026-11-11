import { useState } from 'react';
import { api, ApiError } from '../client/api';
import { serverNow } from '../client/api';
import { updateSettings } from '../client/settings';
import { sfx } from '../client/sound';
import type { RoomState } from '../client/useRoom';
import { Icon } from '../components/Icons';
import { Avatar, Modal, useToast } from '../components/ui';
import { MAX_PLAYERS, MIN_PLAYERS, type Mode, type PublicView } from '../shared/types';
import { RulesBattle, RulesClassic } from './HowToPlay';

export function isOnline(room: RoomState, id: string) {
  const p = room.presence[id];
  return !p || p.online; // no record yet = just joined
}

const MODES: { id: Mode; name: string; tag: string; desc: string; icon: string }[] = [
  { id: 'classic', name: 'Classic', tag: 'UNO style', desc: 'Match the color, use action cards, quiz your rivals. First to empty their hand wins.', icon: 'layers' },
  { id: 'battle', name: 'Battle', tag: 'Drop vs. drop', desc: 'Attack with science! Boost with questions, combo properties. Last drop standing.', icon: 'bolt' },
];

export function LobbyScreen({ room, view, onLeave }: { room: RoomState; view: PublicView; onLeave: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [rules, setRules] = useState<Mode | null>(null);
  const [renaming, setRenaming] = useState(false);
  const me = view.players.find((p) => p.id === room.uid)!;
  const isHost = view.hostId === room.uid;
  const host = view.players.find((p) => p.id === view.hostId);
  const hostPresence = room.presence[view.hostId];
  const hostAway = !isHost && hostPresence && !hostPresence.online && serverNow() - hostPresence.at > 20000;
  const notReady = view.players.filter((p) => p.id !== view.hostId && !p.ready);
  const canStart = view.players.length >= MIN_PLAYERS && notReady.length === 0;
  const link = `${location.origin}/join/${view.code}`;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
    } finally {
      setBusy('');
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied!`, 'good');
    } catch {
      toast(text, 'info');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Water Wars', text: `Join my Water Wars room: ${view.code}`, url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy(link, 'Invite link');
  };

  const slots = Array.from({ length: Math.min(MAX_PLAYERS, Math.max(view.players.length + 1, 2)) }, (_, i) => view.players[i]);

  return (
    <main className="screen lobby">
      <header className="screen-head">
        <button className="icon-btn" onClick={onLeave} aria-label="Leave room">
          <Icon name="logout" />
        </button>
        <h1>Lobby</h1>
      </header>

      <section className="panel code-panel">
        <div className="muted small">ROOM CODE</div>
        <button className="room-code" onClick={() => copy(view.code, 'Room code')} aria-label={`Room code ${view.code}, tap to copy`}>
          {view.code.split('').map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </button>
        <div className="code-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => copy(view.code, 'Room code')}>
            <Icon name="copy" size={16} /> Copy code
          </button>
          <button className="btn btn-secondary btn-sm" onClick={share}>
            <Icon name="link" size={16} /> Invite link
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>
            <Icon name="users" size={18} /> Players <span className="muted">{view.players.length}/{MAX_PLAYERS}</span>
          </h2>
        </div>
        <ul className="player-list">
          {slots.map((p, i) =>
            p ? (
              <li key={p.id} className={`player-row ${p.id === room.uid ? 'is-me' : ''}`}>
                <div className="avatar-wrap">
                  <Avatar index={p.avatar} size={40} name={p.name} />
                  <span className={`presence-dot ${isOnline(room, p.id) ? 'on' : 'off'}`} title={isOnline(room, p.id) ? 'Connected' : 'Disconnected'} />
                </div>
                <div className="player-main">
                  <div className="player-name">
                    {p.name}
                    {p.id === room.uid && <span className="you-tag">you</span>}
                    {p.id === view.hostId && (
                      <span className="host-tag" title="Host">
                        <Icon name="crown" size={14} /> Host
                      </span>
                    )}
                  </div>
                  <div className="muted small">{isOnline(room, p.id) ? 'Connected' : 'Disconnected'}</div>
                </div>
                {p.id === view.hostId ? (
                  <span className="ready-badge ready">Host</span>
                ) : (
                  <span className={`ready-badge ${p.ready ? 'ready' : ''}`}>{p.ready ? 'Ready' : 'Not ready'}</span>
                )}
                {isHost && p.id !== room.uid && (
                  <button className="icon-btn sm" aria-label={`Remove ${p.name}`} onClick={() => run('kick', () => api({ op: 'kick', code: view.code, playerId: p.id }))}>
                    <Icon name="close" size={16} />
                  </button>
                )}
                {p.id === room.uid && (
                  <button className="icon-btn sm" aria-label="Change name" onClick={() => setRenaming(true)}>
                    <Icon name="gear" size={16} />
                  </button>
                )}
              </li>
            ) : (
              <li key={`empty-${i}`} className="player-row empty">
                <div className="avatar-empty" />
                <span className="muted">Waiting for player…</span>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Game mode</h2>
          {!isHost && <span className="muted small">Host chooses</span>}
        </div>
        <div className="mode-grid">
          {MODES.map((m) => (
            <div key={m.id} className={`mode-card ${view.mode === m.id ? 'on' : ''} ${isHost ? 'clickable' : ''}`}>
              <button
                className="mode-select"
                disabled={!isHost || busy === 'mode'}
                onClick={() => view.mode !== m.id && run('mode', () => api({ op: 'mode', code: view.code, mode: m.id }))}
                aria-pressed={view.mode === m.id}
              >
                <div className="mode-icon">
                  <Icon name={m.icon} size={22} />
                </div>
                <div>
                  <div className="mode-name">
                    {m.name} <span className="mode-tag">{m.tag}</span>
                  </div>
                  <div className="mode-desc">{m.desc}</div>
                </div>
                {view.mode === m.id && <Icon name="check" className="mode-check" />}
              </button>
              <button className="link-btn" onClick={() => setRules(m.id)}>
                Rules
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="lobby-cta">
        {isHost ? (
          <>
            <button className="btn btn-primary btn-xl" disabled={!canStart || busy === 'start'} onClick={() => run('start', async () => { await api({ op: 'start', code: view.code }); sfx('turn'); })}>
              {busy === 'start' ? <span className="btn-spinner" /> : <Icon name="play" />} Start Game
            </button>
            <p className="muted small center-text">
              {view.players.length < MIN_PLAYERS
                ? 'Share the code. You need at least 2 players.'
                : notReady.length
                  ? `Waiting for ${notReady.map((p) => p.name).join(', ')} to get ready…`
                  : 'Everyone is ready!'}
            </p>
          </>
        ) : (
          <>
            <button className={`btn btn-xl ${me.ready ? 'btn-secondary' : 'btn-primary'}`} disabled={busy === 'ready'} onClick={() => run('ready', () => api({ op: 'ready', code: view.code, ready: !me.ready }))}>
              <Icon name={me.ready ? 'close' : 'check'} /> {me.ready ? 'Not ready' : "I'm ready!"}
            </button>
            <p className="muted small center-text">{me.ready ? `Waiting for ${host?.name ?? 'the host'} to start…` : 'Tap ready when you know the rules.'}</p>
            {hostAway && (
              <button className="btn btn-ghost btn-sm" onClick={() => run('claim', () => api({ op: 'claimHost', code: view.code }))}>
                <Icon name="crown" size={16} /> Host disconnected. Become host
              </button>
            )}
          </>
        )}
      </div>

      <Modal open={!!rules} onClose={() => setRules(null)} title={rules === 'battle' ? 'Battle rules' : 'Classic rules'} wide>
        {rules === 'battle' ? <RulesBattle /> : <RulesClassic />}
      </Modal>
      <RenameModal open={renaming} current={me.name} onClose={() => setRenaming(false)} onSave={(name) => run('rename', async () => { await api({ op: 'rename', code: view.code, name }); updateSettings({ name }); setRenaming(false); })} />
    </main>
  );
}

function RenameModal({ open, current, onClose, onSave }: { open: boolean; current: string; onClose: () => void; onSave: (n: string) => void }) {
  const [name, setName] = useState(current);
  return (
    <Modal open={open} onClose={onClose} title="Change your name">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <label className="field">
          <span>Name</span>
          <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          Save
        </button>
      </form>
    </Modal>
  );
}
