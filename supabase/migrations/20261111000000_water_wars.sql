-- Water Wars database setup. Paste this whole file into Supabase → SQL Editor → Run. Safe to run twice.

-- One row per game room. `state` holds the complete game (deck order, every hand, answers in play),
-- so it must never be readable from the browser.
create table if not exists public.ww_rooms (
  code        text primary key,
  state       jsonb       not null,
  version     integer     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ww_rooms_created_at_idx on public.ww_rooms (created_at);

-- Last time each player's device checked in (used to skip the turns of disconnected players).
create table if not exists public.ww_presence (
  code       text        not null,
  uid        text        not null,
  last_seen  timestamptz not null default now(),
  primary key (code, uid)
);

-- Lock both tables down: row level security ON with no policies means the public (browser) keys
-- can neither read nor write. Only the Netlify Function, using the secret key, can access them.
alter table public.ww_rooms    enable row level security;
alter table public.ww_presence enable row level security;
revoke all on table public.ww_rooms    from anon, authenticated;
revoke all on table public.ww_presence from anon, authenticated;
