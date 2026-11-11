import { useSyncExternalStore } from 'react';

export interface Settings {
  name: string;
  sound: boolean;
  reduceMotion: boolean;
  scienceTips: boolean;
}

const KEY = 'ww:settings';
const defaults: Settings = {
  name: '',
  sound: true,
  reduceMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  scienceTips: true,
};

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function getSettings() {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: keep in memory */
  }
  applyDocumentSettings();
  listeners.forEach((l) => l());
}

export function applyDocumentSettings() {
  document.documentElement.toggleAttribute('data-reduce-motion', current.reduceMotion);
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

// Session: which room this browser was last in (for reconnecting after a reload).
const SESSION_KEY = 'ww:room';
export function saveRoom(code: string | null) {
  try {
    if (code) localStorage.setItem(SESSION_KEY, code);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
export function lastRoom(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
