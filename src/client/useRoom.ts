// Realtime subscription to a room: public state, my private hand, and everyone's connection status.
import { useEffect, useState } from 'react';
import type { PresenceEntry, PrivateView, PublicView } from '../shared/types';
import { setServerOffset } from './api';
import { ensureUser, firebase } from './firebase';

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

export function useRoom(code: string | null): RoomState {
  const [state, setState] = useState<RoomState>(initial);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const unsubs: (() => void)[] = [];
    setState(initial);

    (async () => {
      try {
        const [user, fb] = await Promise.all([ensureUser(), firebase()]);
        if (cancelled) return;
        const { db, dbMod } = fb;
        const { ref, onValue, onDisconnect, set, serverTimestamp } = dbMod;
        const uid = user.uid;
        setState((s) => ({ ...s, uid }));

        let lastVersion = 0;
        unsubs.push(
          onValue(
            ref(db, `rooms/${code}/public`),
            (snap) => {
              const raw = snap.val();
              if (typeof raw !== 'string') {
                setState((s) => ({ ...s, status: 'gone' }));
                return;
              }
              const view = JSON.parse(raw) as PublicView;
              if (view.version < lastVersion) return;
              lastVersion = view.version;
              const me = view.players.find((p) => p.id === uid);
              if (!me || me.status === 'left') {
                setState((s) => ({ ...s, status: 'gone', view }));
                return;
              }
              setState((s) => ({ ...s, status: 'ready', view }));
            },
            () => setState((s) => ({ ...s, status: 'gone' })),
          ),
        );

        let handVersion = 0;
        unsubs.push(
          onValue(
            ref(db, `rooms/${code}/private/${uid}`),
            (snap) => {
              const raw = snap.val();
              if (typeof raw !== 'string') return;
              const pv = JSON.parse(raw) as PrivateView;
              if (pv.version < handVersion) return;
              handVersion = pv.version;
              setState((s) => ({ ...s, hand: pv.hand }));
            },
            () => {},
          ),
        );

        unsubs.push(
          onValue(
            ref(db, `presence/${code}`),
            (snap) => setState((s) => ({ ...s, presence: (snap.val() ?? {}) as Record<string, PresenceEntry> })),
            () => {},
          ),
        );

        unsubs.push(onValue(ref(db, '.info/serverTimeOffset'), (snap) => setServerOffset(Number(snap.val() ?? 0))));

        const myPresence = ref(db, `presence/${code}/${uid}`);
        unsubs.push(
          onValue(ref(db, '.info/connected'), (snap) => {
            const connected = snap.val() === true;
            setState((s) => ({ ...s, connected }));
            if (!connected) return;
            onDisconnect(myPresence)
              .set({ online: false, at: serverTimestamp() })
              .then(() => set(myPresence, { online: true, at: serverTimestamp() }))
              .catch(() => {
                /* not a member (yet): ignore */
              });
          }),
        );
        unsubs.push(() => {
          // Leaving the room screen: mark offline now rather than waiting for disconnect.
          set(myPresence, { online: false, at: serverTimestamp() }).catch(() => {});
          onDisconnect(myPresence).cancel().catch(() => {});
        });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: (e as Error).message }));
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [code]);

  return state;
}
