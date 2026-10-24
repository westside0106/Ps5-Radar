-- PS5 Radar's password-gated private, single-profile cloud storage.
-- No anonymous / authenticated Data API permissions; only server-side Supabase
-- secret/service credentials may access this table. Never ship the key to browsers.
create table if not exists public.psn_private_profile (
  id text primary key check (id = 'default'),
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint psn_private_profile_size check (pg_column_size(payload) < 1048576)
);
alter table public.psn_private_profile enable row level security;
revoke all on table public.psn_private_profile from anon, authenticated, public;
-- No policies for anonymous or authenticated roles. Server routes access
-- via a privileged secret and MUST validate the existing Radar session.
comment on table public.psn_private_profile is
 'Server-only single-profile PSN Radar preferences; do not grant anon/authenticated access.';
