// Realtime room connection.
//  1. Fetch my view from the API (public state + my own hand).
//  2. Subscribe to the room's Supabase Realtime channel: a "changed" ping triggers a re-fetch,
//     and Supabase Presence shows who is connected.
//  3. Re-sync every 10s and whenever the tab becomes visible (heals missed pings; doubles as a heartbeat).
import { useEffect, useState } from 'react';
import type { PresenceEntry, PublicView, RoomSnapshot } from '../shared/types';
import { ApiError, fetchRoom, onSnapshot, serverNow } from './api';
import { ensureSession, realtime } from './session';

export interface RoomState {
  status: 'connecting' | 'ready' | 'gone' | 'error';
  uid: string;
  view: PublicView | null;
  hand: string[];
  presence: Record<string, PresenceEntry>;
  connected: boolean;
  error?: string;
}

const initial: RoomState = { status: 'connecting', uid: '', view: null, hand: [], presence: {}, connected: true };
const RESYNC_MS = 10_000;

export function useRoom(code: string | null): RoomState {
  const [state, setState] = useState<RoomState>(initial);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let version = 0;
    let topic = '';
    let inflight = false;
    let again = false;
    let failures = 0;
    const cleanups: (() => void)[] = [];
    setState(initial);

    const apply = (snap: RoomSnapshot | null) => {
      if (cancelled) return;
      if (!snap) {
        setState((s) => ({ ...s, status: 'gone' }));
        return;
      }
      if (snap.version < version) return;
      version = snap.version;
      setState((s) => ({ ...s, status: 'ready', view: snap.public, hand: snap.hand, connected: true }));
      if (snap.topic && snap.topic !== topic) {
        topic = snap.topic;
        void subscribe(snap.topic);
      }
    };

    // Coalesces bursts of pings into at most one request in flight (+ one queued).
    const sync = async () => {
      if (inflight) {
        again = true;
        return;
      }
      inflight = true;
      try {
        const res = await fetchRoom(code);
        failures = 0;
        apply(res.state ?? null);
      } catch (e) {
        if (e instanceof ApiError && (e.code === 'NOT_IN_ROOM' || e.code === 'ROOM_NOT_FOUND' || e.code === 'BAD_CODE')) apply(null);
        else if (++failures >= 2 && !cancelled) setState((s) => ({ ...s, connected: false }));
        if (!cancelled && version === 0 && !(e instanceof ApiError && e.code === 'NETWORK')) {
          setState((s) => (s.status === 'connecting' ? { ...s, status: 'error', error: (e as Error).message } : s));
        }
      } finally {
        inflight = false;
        if (again && !cancelled) {
          again = false;
          void sync();
        }
      }
    };

    const subscribe = async (name: string) => {
      try {
        const [rt, { uid }] = await Promise.all([realtime(), ensureSession()]);
        if (cancelled) return;
        const offlineSince: Record<string, number> = {};
        const channel = rt.channel(name, { config: { broadcast: { self: true }, presence: { key: uid } } });
        channel
          .on('broadcast', { event: 'changed' }, ({ payload }) => {
            const v = Number((payload as { v?: number })?.v);
            if (v === -1 || !(v <= version)) void sync();
          })
          .on('presence', { event: 'sync' }, () => {
            const online = new Set(Object.keys(channel.presenceState()));
            setState((s) => {
              const ids = new Set([...(s.view?.players.map((p) => p.id) ?? []), ...Object.keys(s.presence)]);
              const presence: Record<string, PresenceEntry> = {};
              for (const id of ids) {
                if (online.has(id)) {
                  delete offlineSince[id];
                  presence[id] = { online: true, at: serverNow() };
                } else {
                  offlineSince[id] ??= serverNow();
                  presence[id] = { online: false, at: offlineSince[id] };
                }
              }
              return { ...s, presence };
            });
          })
          .subscribe((status) => {
            if (cancelled) return;
            // The "Reconnecting" banner tracks whether the game server is reachable (see sync);
            // if Realtime itself is unavailable the 10s re-sync keeps the game going.
            if (status === 'SUBSCRIBED') {
              void channel.track({ at: Date.now() });
              void sync(); // catch anything that happened while (re)connecting
            }
          });
        cleanups.push(() => {
          void channel.untrack();
          void rt.removeChannel(channel);
        });
      } catch {
        /* realtime unavailable: the periodic re-sync still keeps the game moving */
      }
    };

    void ensureSession()
      .then(({ uid }) => {
        if (!cancelled) setState((s) => ({ ...s, uid }));
        return sync();
      })
      .catch((e) => !cancelled && setState((s) => ({ ...s, status: 'error', error: (e as Error).message })));

    cleanups.push(onSnapshot((c, snap) => c === code && apply(snap)));
    const timer = setInterval(() => void sync(), RESYNC_MS);
    cleanups.push(() => clearInterval(timer));
    const onVisible = () => document.visibilityState === 'visible' && void sync();
    document.addEventListener('visibilitychange', onVisible);
    const onOffline = () => setState((s) => ({ ...s, connected: false }));
    window.addEventListener('online', onVisible);
    window.addEventListener('offline', onOffline);
    cleanups.push(() => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener('offline', onOffline);
    });

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [code]);

  return state;
}
