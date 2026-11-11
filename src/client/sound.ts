// Tiny synthesized sound effects (no audio files to download).
import { getSettings } from './settings';

let ctx: AudioContext | null = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  play: () => tone(520, 0, 0.12, 'triangle', 0.1, 780),
  draw: () => tone(300, 0, 0.14, 'sine', 0.08, 520),
  turn: () => {
    tone(660, 0, 0.14, 'sine', 0.1);
    tone(990, 0.1, 0.2, 'sine', 0.1);
  },
  correct: () => {
    tone(523, 0, 0.12, 'triangle', 0.12);
    tone(659, 0.09, 0.12, 'triangle', 0.12);
    tone(784, 0.18, 0.25, 'triangle', 0.12);
  },
  wrong: () => tone(220, 0, 0.32, 'sawtooth', 0.06, 150),
  join: () => tone(740, 0, 0.12, 'sine', 0.08, 880),
  hit: () => tone(180, 0, 0.18, 'square', 0.06, 90),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.12)),
  click: () => tone(880, 0, 0.04, 'sine', 0.04),
};

export type SoundName = keyof typeof SOUNDS;

export function sfx(name: SoundName) {
  if (!getSettings().sound) return;
  try {
    SOUNDS[name]();
  } catch {
    /* audio blocked: ignore */
  }
}
