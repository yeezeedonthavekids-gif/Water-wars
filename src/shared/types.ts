// Types shared by the browser client and the server (Netlify function).
// The server owns the full GameState; clients only ever receive the public view + their own hand.

export type Property = 'cohesion' | 'adhesion' | 'surface';
export type Category = 'cohesion' | 'adhesion' | 'surface' | 'challenge' | 'action' | 'realworld' | 'powerup';
export type Mode = 'classic' | 'battle';
export type Phase = 'lobby' | 'playing' | 'finished';

export type EffectId =
  | 'soap' | 'evaporation' | 'swap' | 'capillary' | 'grab' | 'splash'
  | 'waterPower' | 'wildBond' | 'hbond' | 'shield' | 'rain' | 'star';

export type PlayerStatus = 'active' | 'left' | 'out';

export interface PlayerStats {
  correct: number;
  wrong: number;
  damage: number;
  kos: number;
  played: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: number;
  ready: boolean;
  status: PlayerStatus;
  score: number;
  hp: number;
  shield: number;
  boost: boolean;
  sets: number;
  handCount: number;
  stats: PlayerStats;
  placement?: number;
}

export type WaterPowerChoice = 'draw' | 'points' | 'shield';

/** What a client can send for an in-game move. Everything is validated server-side. */
export type GameAction =
  | { type: 'draw' }
  | {
      type: 'play';
      cardId: string;
      targetId?: string;
      /** Battle: answer a science question for double damage */
      boost?: boolean;
      /** Battle: second property card for a combo attack */
      comboCardId?: string;
      /** Property Swap: which of your cards to give */
      giveCardId?: string;
      /** Wild Bond (classic) / multi-property cards: new active property */
      property?: Property;
      /** Water Power choice */
      choice?: WaterPowerChoice;
    }
  | { type: 'ask'; targetId: string; property: Property }
  | { type: 'set'; cardIds: string[] }
  | { type: 'trade'; targetId: string; giveCardId: string; wantProperty: Property }
  | { type: 'tradeRespond'; accept: boolean; cardId?: string }
  | { type: 'answer'; choice: number }
  | { type: 'endTurn' }
  | { type: 'rest' }
  | { type: 'timeout' };

export interface LogEntry {
  seq: number;
  at: number;
  text: string;
  kind: 'play' | 'join' | 'science' | 'turn' | 'system' | 'score' | 'good' | 'bad';
  actorId?: string;
}

export type PublicPending =
  | {
      kind: 'question';
      id: string;
      responderId: string;
      askerId: string;
      title: string;
      prompt: string;
      options: string[];
      deadline: number;
      stakes: string;
      cardId?: string;
    }
  | {
      kind: 'trade';
      id: string;
      fromId: string;
      toId: string;
      giveCardId: string;
      wantProperty: Property;
      deadline: number;
    };

export interface QuestionResult {
  id: string;
  responderId: string;
  title: string;
  prompt: string;
  options: string[];
  chosen: number; // -1 = timed out
  correctIndex: number;
  correct: boolean;
  explain: string;
  outcome: string;
  at: number;
}

export interface LastAction {
  seq: number;
  type: 'play' | 'draw' | 'ask' | 'set' | 'trade' | 'damage' | 'turn' | 'timeout';
  actorId: string;
  cardId?: string;
  targetId?: string;
  amount?: number;
  at: number;
}

export interface PublicTurn {
  playerId: string;
  number: number;
  dir: 1 | -1;
  stage: 'start' | 'afterDraw';
  setDone: boolean;
  tradeDone: boolean;
  powerDone: boolean;
  deadline: number;
}

export interface ResultRow {
  id: string;
  name: string;
  avatar: number;
  rank: number;
  score: number;
  hp: number;
  sets: number;
  status: PlayerStatus;
  stats: PlayerStats;
  wentOut?: boolean;
  cardsLeft?: number;
}

export interface PublicView {
  code: string;
  version: number;
  phase: Phase;
  mode: Mode;
  hostId: string;
  players: PublicPlayer[];
  round: number;
  maxRounds: number;
  turn: PublicTurn | null;
  activeProperty: Property | null;
  discardTop: string | null;
  discardCount: number;
  deckCount: number;
  pending: PublicPending | null;
  lastQuestion: QuestionResult | null;
  lastAction: LastAction | null;
  log: LogEntry[];
  results: ResultRow[] | null;
  winnerIds: string[];
  startedAt: number | null;
  updatedAt: number;
}

export interface PresenceEntry {
  online: boolean;
  at: number;
}

/** Requests the client sends to POST /api */
export type ApiRequest =
  | { op: 'session' }
  | { op: 'create'; name: string; mode?: Mode }
  | { op: 'join'; code: string; name: string }
  | { op: 'leave'; code: string }
  | { op: 'ready'; code: string; ready: boolean }
  | { op: 'mode'; code: string; mode: Mode }
  | { op: 'rename'; code: string; name: string }
  | { op: 'start'; code: string }
  | { op: 'rematch'; code: string }
  | { op: 'claimHost'; code: string }
  | { op: 'kick'; code: string; playerId: string }
  | { op: 'action'; code: string; action: GameAction };

/** What GET /api/state (and every successful action) returns: the caller's view of the room. */
export interface RoomSnapshot {
  version: number;
  public: PublicView;
  hand: string[];
  /** Realtime channel that pings when the room changes. */
  topic: string;
}

export interface ApiResponse {
  ok: boolean;
  code?: string;
  uid?: string;
  token?: string;
  state?: RoomSnapshot | null;
  error?: string;
  message?: string;
  serverNow: number;
}

export interface ClientConfig {
  configured: boolean;
  missing?: string[];
  supabase?: { url: string; publishableKey: string };
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const BATTLE_HP = 20;
