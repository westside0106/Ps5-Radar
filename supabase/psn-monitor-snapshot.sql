-- Separate server-only single-profile PSN monitor data.
-- Do not put this data in psn_private_profile: cron writes must not conflict
-- with the user's personal game plans, covers, purchases or cloud revisions.
create table if not exists public.psn_monitor_snapshot (
  id text primary key check (id = 'default'),
  sessions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sessions) = 'array'),
  revision bigint not null default 1 check (revision >= 1),
  received_at timestamptz not null default now(),
  time_zone text not null,
  row_count integer not null default 0 check (row_count >= 0 and row_count <= 20000),
  warning_counts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(warning_counts) = 'object'),
  constraint psn_monitor_sessions_size check (pg_column_size(sessions) < 950000)
);
alter table public.psn_monitor_snapshot enable row level security;
revoke all on table public.psn_monitor_snapshot from anon, authenticated, public;
-- Deliberately no RLS policies for anon or authenticated.
-- Only a server-side Supabase secret may read/write the monitor snapshot.
comment on table public.psn_monitor_snapshot is
 'Server-only observational PSN monitor session imports, independent of the personal profile.';
