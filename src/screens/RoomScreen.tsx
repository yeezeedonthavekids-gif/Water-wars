import { useEffect, useRef } from 'react';
import type { Route } from '../App';
import { api } from '../client/api';
import { saveRoom } from '../client/settings';
import { sfx } from '../client/sound';
import { useRoom } from '../client/useRoom';
import { Icon } from '../components/Icons';
import { Spinner, useToast } from '../components/ui';
import { GameScreen } from './GameScreen';
import { LobbyScreen } from './LobbyScreen';
import { ResultsScreen } from './ResultsScreen';

export default function RoomScreen({ code, navigate }: { code: string; navigate: (r: Route) => void }) {
  const room = useRoom(code);
  const toast = useToast();
  const prevPlayers = useRef<Map<string, string> | null>(null);
  const leaving = useRef(false);

  // Player join / leave notifications.
  useEffect(() => {
    const v = room.view;
    if (!v) return;
    const now = new Map(v.players.filter((p) => p.status !== 'left').map((p) => [p.id, p.name]));
    const prev = prevPlayers.current;
    if (prev) {
      for (const [id, name] of now) if (!prev.has(id) && id !== room.uid) {
        toast(`${name} joined the room`, 'join');
        sfx('join');
      }
      for (const [id, name] of prev) if (!now.has(id) && id !== room.uid) toast(`${name} left`, 'info');
    }
    prevPlayers.current = now;
  }, [room.view, room.uid, toast]);

  useEffect(() => {
    if (room.status === 'gone' && !leaving.current) {
      saveRoom(null);
      toast('You are no longer in that room.', 'info');
      navigate({ name: 'menu', joinCode: room.view?.phase === 'lobby' ? code : undefined });
    }
  }, [room.status, navigate, toast, code, room.view?.phase]);

  const leave = async () => {
    leaving.current = true;
    saveRoom(null);
    try {
      await api({ op: 'leave', code });
    } catch {
      /* leaving anyway */
    }
    navigate({ name: 'menu' });
  };

  if (room.status === 'error') {
    return (
      <main className="screen center">
        <div className="panel">
          <h2>Connection problem</h2>
          <p className="muted">{room.error}</p>
          <button className="btn btn-primary" onClick={() => location.reload()}>Retry</button>
          <button className="btn btn-ghost" onClick={() => navigate({ name: 'menu' })}>Main menu</button>
        </div>
      </main>
    );
  }
  if (room.status !== 'ready' || !room.view) return <Spinner label={`Connecting to room ${code}…`} />;

  const v = room.view;
  return (
    <>
      {!room.connected && (
        <div className="conn-banner">
          <Icon name="wifiOff" size={16} /> Reconnecting… your seat is saved.
        </div>
      )}
      {v.phase === 'lobby' && <LobbyScreen room={room} view={v} onLeave={leave} />}
      {v.phase === 'playing' && <GameScreen room={room} view={v} onLeave={leave} />}
      {v.phase === 'finished' && <ResultsScreen room={room} view={v} onLeave={leave} />}
    </>
  );
}
