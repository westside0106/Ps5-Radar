-- A separate, private once-per-day watchdog checks the scheduled source-health cron.
-- Never include PSN content, account IDs, secrets or provider response bodies.
create table if not exists public.radar_source_cron_watchdog (
 run_day date primary key,
 checked_at timestamptz not null default now(),
 status text not null check(status in ('ok','failed','unfinished','missing','unconfirmed')),
 scheduled_runs smallint not null check(scheduled_runs between 0 and 100),
 daily_sources smallint not null check(daily_sources between 0 and 6),
 push_sent_at timestamptz,
 push_lease_until timestamptz,
 push_lease_token uuid,
 push_attempts integer not null default 0 check(push_attempts between 0 and 100000),
 push_last_error text check(push_last_error is null or push_last_error in ('http_rejection','transport_or_ack_failed'))
);
create index if not exists radar_source_cron_watchdog_pending_idx
  on public.radar_source_cron_watchdog(run_day)
  where status <> 'ok' and push_sent_at is null;
alter table public.radar_source_cron_watchdog enable row level security;
revoke all on public.radar_source_cron_watchdog from public, anon, authenticated;
grant select,insert,update on public.radar_source_cron_watchdog to service_role;
comment on table public.radar_source_cron_watchdog is
  'Private once-daily watchdog conclusions and generic ntfy delivery receipts; no account or provider data.';
