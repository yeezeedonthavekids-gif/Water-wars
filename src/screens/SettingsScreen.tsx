import { useState } from 'react';
import type { Route } from '../App';
import { updateSettings, useSettings } from '../client/settings';
import { sfx } from '../client/sound';
import { Icon } from '../components/Icons';

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        <div className="muted small">{hint}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
        <span />
      </button>
    </label>
  );
}

export default function SettingsScreen({ navigate }: { navigate: (r: Route) => void }) {
  const s = useSettings();
  const [name, setName] = useState(s.name);
  return (
    <main className="screen narrow">
      <header className="screen-head">
        <button className="icon-btn" onClick={() => navigate({ name: 'menu' })} aria-label="Back">
          <Icon name="back" />
        </button>
        <h1>Settings</h1>
      </header>
      <div className="panel settings">
        <label className="field">
          <span>Default player name</span>
          <input
            value={name}
            maxLength={16}
            placeholder="e.g. Hydro Hero"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => updateSettings({ name: name.trim() })}
          />
        </label>
        <Toggle
          on={s.sound}
          label="Sound effects"
          hint="Little blips for plays, turns and answers."
          onChange={(v) => {
            updateSettings({ sound: v });
            if (v) sfx('correct');
          }}
        />
        <Toggle on={s.reduceMotion} label="Reduce motion" hint="Turns off card flights and other animations." onChange={(v) => updateSettings({ reduceMotion: v })} />
        <Toggle on={s.scienceTips} label="Science tips" hint="Show the science behind each card as it is played." onChange={(v) => updateSettings({ scienceTips: v })} />
      </div>
      <button className="btn btn-primary" onClick={() => { updateSettings({ name: name.trim() }); navigate({ name: 'menu' }); }}>
        Done
      </button>
    </main>
  );
}
