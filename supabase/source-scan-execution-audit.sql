-- Immutable execution identity; mutable completion receipt.
-- Stores only operational counts, never PSN account data or secrets.
create table if not exists public.radar_source_scan_runs (
 id uuid primary key,
 run_kind text not null check (run_kind in ('scheduled','manual')),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 result text not null default 'running'
   check (result in ('running','success','failed')),
 duration_ms integer check (duration_ms is null or duration_ms between 0 and 600000),
 healthy_count smallint check (healthy_count is null or healthy_count between 0 and 6),
 degraded_count smallint check (degraded_count is null or degraded_count between 0 and 6),
 error_count smallint check (error_count is null or error_count between 0 and 6),
 unconfigured_count smallint check (unconfigured_count is null or unconfigured_count between 0 and 6),
 daily_inserted smallint check (daily_inserted is null or daily_inserted between 0 and 6),
 latest_updated smallint check (latest_updated is null or latest_updated between 0 and 6),
 push_accepted smallint check (push_accepted is null or push_accepted between 0 and 10),
 push_failed smallint check (push_failed is null or push_failed between 0 and 10),
 failure_code text check (failure_code is null or failure_code in ('scan_failed')),
 constraint scan_run_finished_consistency check (
   (result='running' and finished_at is null) or
   (result in ('success','failed') and finished_at is not null)
 )
);
create index if not exists radar_source_scan_runs_recent_idx
 on public.radar_source_scan_runs (started_at desc);
alter table public.radar_source_scan_runs enable row level security;
revoke all on public.radar_source_scan_runs from public,anon,authenticated;
grant select,insert,update on public.radar_source_scan_runs to service_role;
comment on table public.radar_source_scan_runs is
 'Server-only execution receipts for scheduled and manual provider scans; no PSN content or raw errors.';
