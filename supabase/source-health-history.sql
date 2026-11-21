-- Private source-health history for the PS5-Radar daily diagnostics.
-- Exposed via server-only routes; no anon/authenticated table access.
create table if not exists public.radar_source_health_checks (
  source_id text not null check (source_id in ('psn','igdb','rawg','steamgriddb','profile','monitor')),
  run_day date not null,
  checked_at timestamptz not null,
  status text not null check (status in ('healthy','degraded','error','unconfigured')),
  detail text not null default '' check (char_length(detail) <= 250),
  last_data_at timestamptz,
  primary key (source_id, run_day)
);
create index if not exists radar_source_health_checks_recent_idx
  on public.radar_source_health_checks (run_day desc, source_id);

create table if not exists public.radar_source_health_events (
  id text primary key check (char_length(id) between 5 and 110),
  source_id text not null check (source_id in ('psn','igdb','rawg','steamgriddb','profile','monitor')),
  event text not null check (event in ('outage','recovered')),
  status text not null check (status in ('healthy','degraded','error')),
  detail text not null default '' check (char_length(detail) <= 250),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint read_after_created check (read_at is null or read_at >= created_at)
);
create index if not exists radar_source_health_events_recent_idx
  on public.radar_source_health_events (created_at desc);

alter table public.radar_source_health_checks enable row level security;
alter table public.radar_source_health_events enable row level security;
revoke all on table public.radar_source_health_checks from public, anon, authenticated;
revoke all on table public.radar_source_health_events from public, anon, authenticated;
grant select, insert on table public.radar_source_health_checks to service_role;
grant select, insert, update on table public.radar_source_health_events to service_role;
comment on table public.radar_source_health_checks is
  'Daily private provider probes; no personal game content, no browser writes.';
comment on table public.radar_source_health_events is
  'Private idempotent source-health alerts after repeat failures and recovery.';
