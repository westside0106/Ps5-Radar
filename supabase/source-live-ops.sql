-- Manual live health checks share the existing private push-control row.
-- Keep separate cooldowns: a push test does not block a manual health scan.
alter table public.radar_source_push_control
  add column if not exists last_manual_scan_at timestamptz not null default '1970-01-01T00:00:00Z';

alter table public.radar_source_push_control enable row level security;
revoke all on public.radar_source_push_control from public, anon, authenticated;
grant select, update on public.radar_source_push_control to service_role;

comment on column public.radar_source_push_control.last_manual_scan_at is
  'Private 10-minute cross-instance throttling for manually triggered source-health checks.';
