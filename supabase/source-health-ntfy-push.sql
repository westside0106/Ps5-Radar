-- Separate, private push-delivery state for source-health inbox incidents.
-- No extra PSN data and no public access to ntfy topic credentials.
alter table public.radar_source_health_events
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_lease_until timestamptz,
  add column if not exists push_lease_token uuid,
  add column if not exists push_attempts integer not null default 0
    check (push_attempts >= 0 and push_attempts <= 100000),
  add column if not exists push_last_error text
    check (push_last_error is null or char_length(push_last_error) <= 100);

create index if not exists radar_source_health_events_delivery_idx
  on public.radar_source_health_events(push_sent_at,created_at);

create table if not exists public.radar_source_push_control (
  id text primary key check (id = 'default'),
  last_test_at timestamptz not null default '1970-01-01T00:00:00Z'
);
insert into public.radar_source_push_control(id) values('default')
  on conflict (id) do nothing;

alter table public.radar_source_push_control enable row level security;
revoke all on table public.radar_source_push_control from public,anon,authenticated;
grant select,update on table public.radar_source_push_control to service_role;
comment on table public.radar_source_push_control is
  'Private server-side rate limit for one-user ntfy integration test requests.';

-- The parent inbox already has RLS and service-role-only rights.
alter table public.radar_source_health_events enable row level security;
revoke all on table public.radar_source_health_events from public,anon,authenticated;
grant select,insert,update on table public.radar_source_health_events to service_role;
