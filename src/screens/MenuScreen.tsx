import { useEffect, useRef, useState } from 'react';
import type { Route } from '../App';
import { api, ApiError } from '../client/api';
import { ensureUser } from '../client/firebase';
import { lastRoom, saveRoom, updateSettings, useSettings } from '../client/settings';
import { sfx } from '../client/sound';
import { Icon } from '../components/Icons';
import { CardView, Logo, useToast } from '../components/ui';

export function MenuScreen({ navigate, joinCode }: { navigate: (r: Route) => void; joinCode?: string }) {
  const settings = useSettings();
  const toast = useToast();
  const [panel, setPanel] = useState<'none' | 'play' | 'join'>(joinCode ? 'join' : 'none');
  const [name, setName] = useState(settings.name);
  const [code, setCode] = useState(joinCode ?? '');
  const [busy, setBusy] = useState<'' | 'create' | 'join'>('');
  const [error, setError] = useState('');
  const [resume, setResume] = useState(() => lastRoom());
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Warm up auth in the background so Create/Join feel instant.
    ensureUser().catch(() => {});
  }, []);

  useEffect(() => {
    if (panel !== 'none' && !name) nameRef.current?.focus();
  }, [panel, name]);

  const cleanName = name.trim();
  const saveName = () => cleanName && cleanName !== settings.name && updateSettings({ name: cleanName });

  async function create() {
    if (!cleanName) return setError('Enter your name first.');
    setError('');
    setBusy('create');
    saveName();
    try {
      const res = await api({ op: 'create', name: cleanName });
      sfx('join');
      navigate({ name: 'room', code: res.code! });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create a room.');
    } finally {
      setBusy('');
    }
  }

  async function join() {
    const c = code.trim().toUpperCase();
    if (!cleanName) return setError('Enter your name first.');
    if (!/^[A-Z2-9]{5}$/.test(c)) return setError('Room codes are 5 characters, like K7QX2.');
    setError('');
    setBusy('join');
    saveName();
    try {
      await api({ op: 'join', code: c, name: cleanName });
      sfx('join');
      navigate({ name: 'room', code: c });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not join that room.');
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="menu screen">
      <div className="menu-hero">
        <div className="hero-cards" aria-hidden="true">
          <CardView id="coh-merge" size="md" className="hero-card hc1" />
          <CardView id="sur-strider" size="md" className="hero-card hc2" />
          <CardView id="adh-window" size="md" className="hero-card hc3" />
        </div>
        <Logo />
        <p className="tagline">The multiplayer science card game of <b className="t-coh">Cohesion</b>, <b className="t-adh">Adhesion</b> &amp; <b className="t-sur">Surface Tension</b></p>
      </div>

      <div className="menu-panel panel">
        {resume && panel === 'none' && (
          <button className="resume-btn" onClick={() => navigate({ name: 'room', code: resume })}>
            <Icon name="refresh" size={18} />
            <span>
              Rejoin room <b>{resume}</b>
            </span>
            <span
              className="resume-x"
              role="button"
              aria-label="Forget this room"
              onClick={(e) => {
                e.stopPropagation();
                saveRoom(null);
                setResume(null);
                toast('Room forgotten');
              }}
            >
              <Icon name="close" size={16} />
            </span>
          </button>
        )}

        {panel === 'none' ? (
          <>
            <button className="btn btn-primary btn-xl" onClick={() => { sfx('click'); setPanel('play'); }}>
              <Icon name="play" size={22} /> Play
            </button>
            <div className="menu-row">
              <button className="btn btn-secondary" onClick={() => setPanel('play')}>
                <Icon name="plus" /> Create Room
              </button>
              <button className="btn btn-secondary" onClick={() => setPanel('join')}>
                <Icon name="enter" /> Join Room
              </button>
            </div>
            <div className="menu-row">
              <button className="btn btn-ghost" onClick={() => navigate({ name: 'howto' })}>
                <Icon name="book" /> How to Play
              </button>
              <button className="btn btn-ghost" onClick={() => navigate({ name: 'settings' })}>
                <Icon name="gear" /> Settings
              </button>
            </div>
          </>
        ) : (
          <form
            className="play-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (panel === 'join') join();
              else create();
            }}
          >
            <div className="seg">
              <button type="button" className={panel === 'play' ? 'on' : ''} onClick={() => { setPanel('play'); setError(''); }}>
                Create Room
              </button>
              <button type="button" className={panel === 'join' ? 'on' : ''} onClick={() => { setPanel('join'); setError(''); }}>
                Join Room
              </button>
            </div>
            <label className="field">
              <span>Your name</span>
              <input
                ref={nameRef}
                value={name}
                maxLength={16}
                autoComplete="nickname"
                placeholder="e.g. Hydro Hero"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {panel === 'join' && (
              <label className="field">
                <span>Room code</span>
                <input
                  className="code-input"
                  value={code}
                  maxLength={5}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="K7QX2"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                />
              </label>
            )}
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={!!busy}>
              {busy ? <span className="btn-spinner" /> : <Icon name={panel === 'join' ? 'enter' : 'plus'} />}
              {panel === 'join' ? (busy ? 'Joining…' : 'Join Room') : busy ? 'Creating…' : 'Create Room'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPanel('none'); setError(''); }}>
              <Icon name="back" size={16} /> Back
            </button>
          </form>
        )}
      </div>
      <footer className="menu-foot">2–6 players · phones, tablets &amp; computers</footer>
    </main>
  );
}
