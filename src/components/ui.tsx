// Shared UI primitives: avatar, logo, modal, toasts, card component.
import { createContext, memo, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CATEGORY_LABEL, defOf, PROPERTY_LABEL, type CardDef } from '../shared/cards';
import type { Category, Mode, Property } from '../shared/types';
import { CardArt } from './CardArt';
import { Icon } from './Icons';

// ───────── Avatar ─────────
export const AVATAR_COLORS = ['#4cc9f0', '#b18cff', '#ffc857', '#5ee6a0', '#ff7a8a', '#ff9ad5'];

export const Avatar = memo(function Avatar({ index, size = 40, name }: { index: number; size?: number; name?: string }) {
  const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const eyes = index % 3;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="avatar" aria-label={name} role="img">
      <circle cx="20" cy="20" r="19" fill="var(--surface-2)" />
      <path d="M20 5 C 23 10 30 16 30 23 a10 10 0 0 1 -20 0 C 10 16 17 10 20 5 Z" fill={c} />
      <path d="M14.5 21 q 0 -3 2.5 -5" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {eyes === 0 && (
        <g fill="#0b1a33">
          <circle cx="16.5" cy="23" r="1.6" />
          <circle cx="23.5" cy="23" r="1.6" />
        </g>
      )}
      {eyes === 1 && <path d="M15 23.5 q1.5 -2 3 0 M22 23.5 q1.5 -2 3 0" stroke="#0b1a33" strokeWidth="1.5" fill="none" strokeLinecap="round" />}
      {eyes === 2 && (
        <g fill="#0b1a33">
          <circle cx="16.5" cy="22.5" r="1.9" />
          <circle cx="23.5" cy="22.5" r="1.9" />
          <circle cx="17" cy="22" r=".6" fill="#fff" />
          <circle cx="24" cy="22" r=".6" fill="#fff" />
        </g>
      )}
      <path d="M17 27 q 3 2.4 6 0" stroke="#0b1a33" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
});

// ───────── Logo ─────────
export function Logo({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  return (
    <div className={`logo logo-${size}`}>
      <svg viewBox="0 0 64 64" className="logo-mark" aria-hidden="true">
        <path d="M32 6 C 38 16 50 26 50 39 a18 18 0 0 1 -36 0 C 14 26 26 16 32 6 Z" fill="url(#lg)" />
        <path d="M22 38 q 0 -6 5 -10" stroke="#fff" strokeOpacity=".7" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M18 44 q 7 -5 14 0 t 14 0" stroke="#0b1a33" strokeOpacity=".55" strokeWidth="3" fill="none" strokeLinecap="round" />
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7ef0d4" />
            <stop offset="1" stopColor="#2bb7e8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="logo-text">
        <span className="logo-water">WATER</span>
        <span className="logo-wars">WARS</span>
      </div>
    </div>
  );
}

// ───────── Modal ─────────
export function Modal({
  open, onClose, title, children, wide, className = '', dismissable = true,
}: {
  open: boolean; onClose?: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; className?: string; dismissable?: boolean;
}) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, dismissable]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={() => dismissable && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${className}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {(title || (dismissable && onClose)) && (
          <div className="modal-head">
            <h2>{title}</h2>
            {dismissable && onClose && (
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <Icon name="close" />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ───────── Toasts ─────────
interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'join';
}
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const id = useRef(0);
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const t = { id: ++id.current, text, kind };
    setToasts((ts) => [...ts.slice(-3), t]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ───────── Cards ─────────
export const CATEGORY_ICON: Record<Category, string> = {
  cohesion: 'drop',
  adhesion: 'link',
  surface: 'layers',
  challenge: 'help',
  action: 'bolt',
  realworld: 'sparkle',
  powerup: 'star',
};

export const PROP_CLASS: Record<Property, string> = { cohesion: 'cat-cohesion', adhesion: 'cat-adhesion', surface: 'cat-surface' };

export interface CardViewProps {
  id: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  mode?: Mode;
  selected?: boolean;
  dim?: boolean;
  glow?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function cardValue(def: CardDef, mode: Mode) {
  if (mode === 'battle') return def.power > 0 ? { v: def.power, label: 'DMG' } : null;
  return null; // Classic has no points: first to empty their hand wins
}

export const CardView = memo(function CardView({ id, size = 'md', mode = 'classic', selected, dim, glow, onClick, className = '', style }: CardViewProps) {
  const def = defOf(id);
  const value = cardValue(def, mode);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`card card-${size} cat-${def.category} ${selected ? 'is-selected' : ''} ${dim ? 'is-dim' : ''} ${glow ? 'is-glow' : ''} ${className}`}
      onClick={onClick}
      style={style}
      aria-label={`${def.name}, ${CATEGORY_LABEL[def.category]} card`}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      <div className="card-head">
        <span className="card-cat">
          <Icon name={CATEGORY_ICON[def.category]} size={12} strokeWidth={2.6} />
          <span>{CATEGORY_LABEL[def.category]}</span>
        </span>
        {value && (
          <span className="card-val" title={value.label}>
            {value.v}
          </span>
        )}
      </div>
      <div className="card-art">
        <CardArt art={def.art} />
      </div>
      <div className="card-name">{def.name}</div>
      {(size === 'md' || size === 'lg') && <div className="card-desc">{def.description}</div>}
      {def.properties.length > 0 && def.category !== 'cohesion' && def.category !== 'adhesion' && def.category !== 'surface' && !def.wild && (
        <div className="card-props">
          {def.properties.map((p) => (
            <span key={p} className={`prop-dot ${PROP_CLASS[p]}`} title={PROPERTY_LABEL[p]} />
          ))}
        </div>
      )}
    </Tag>
  );
});

export function CardBack({ size = 'md', count, className = '' }: { size?: 'xs' | 'sm' | 'md' | 'lg'; count?: number; className?: string }) {
  return (
    <div className={`card card-${size} card-back ${className}`}>
      <div className="card-back-inner">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 10 C 37 18 46 26 46 36 a14 14 0 0 1 -28 0 C 18 26 27 18 32 10 Z" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M24 36 q 0 -5 4 -8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
        <span>WATER WARS</span>
      </div>
      {count !== undefined && <span className="pile-count">{count}</span>}
    </div>
  );
}

/** Large card with full rules and science explanation. */
export function CardDetail({ id, mode }: { id: string; mode: Mode }) {
  const def = defOf(id);
  return (
    <div className="card-detail">
      <CardView id={id} size="lg" mode={mode} />
      <div className="card-detail-text">
        <div className={`chip cat-${def.category}`}>{CATEGORY_LABEL[def.category]}</div>
        <h3>{def.name}</h3>
        <p className="muted">{def.description}</p>
        <div className="rule-box">
          <div className="rule-title">{mode === 'classic' ? 'Classic' : 'Battle'} effect</div>
          <p>{mode === 'classic' ? def.classic : def.battle}</p>
        </div>
        <div className="rule-box science">
          <div className="rule-title">
            <Icon name="drop" size={14} /> The science
          </div>
          <p>{def.science}</p>
          {def.properties.length > 0 && (
            <div className="prop-tags">
              {def.properties.map((p) => (
                <span key={p} className={`chip chip-sm ${PROP_CLASS[p]}`}>
                  {PROPERTY_LABEL[p]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner">
        <span />
        <span />
        <span />
      </div>
      {label && <p className="muted">{label}</p>}
    </div>
  );
}
