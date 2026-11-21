-- Preserve the immutable first UTC-day probe; maintain the most recent saved probe separately.
-- Backward-compatible nullable latest_* fields allow rollback to older app versions.
alter table public.radar_source_health_checks
  add column if not exists latest_status text
    check (latest_status is null or latest_status in ('healthy','degraded','error','unconfigured')),
  add column if not exists latest_checked_at timestamptz,
  add column if not exists latest_detail text
    check (latest_detail is null or char_length(latest_detail) <= 250),
  add column if not exists latest_last_data_at timestamptz;

update public.radar_source_health_checks
set latest_status=status,latest_checked_at=checked_at,
    latest_detail=detail,latest_last_data_at=last_data_at
where latest_checked_at is null;

create table if not exists public.radar_source_health_transitions (
  id bigint generated always as identity primary key,
  source_id text not null check (source_id in ('psn','igdb','rawg','steamgriddb','profile','monitor')),
  run_day date not null,
  checked_at timestamptz not null,
  previous_checked_at timestamptz,
  previous_status text not null check (previous_status in ('healthy','degraded','error','unconfigured')),
  status text not null check (status in ('healthy','degraded','error','unconfigured')),
  detail text not null default '' check (char_length(detail) <= 250),
  unique (source_id,checked_at)
);
create index if not exists radar_source_health_transitions_recent_idx
  on public.radar_source_health_transitions(checked_at desc,id desc);

alter table public.radar_source_health_transitions enable row level security;
revoke all on table public.radar_source_health_transitions from public,anon,authenticated;
grant select,insert on table public.radar_source_health_transitions to service_role;
grant update on table public.radar_source_health_checks to service_role;

create schema if not exists radar_internal;
revoke all on schema radar_internal from public,anon,authenticated;
grant usage on schema radar_internal to service_role;

create or replace function radar_internal.capture_source_health_transition()
returns trigger language plpgsql security invoker
set search_path=pg_catalog
as $$
begin
  if new.latest_status is distinct from old.latest_status
     and old.latest_status is not null
     and new.latest_status is not null then
    insert into public.radar_source_health_transitions
      (source_id,run_day,checked_at,previous_checked_at,previous_status,status,detail)
    values
      (new.source_id,new.run_day,new.latest_checked_at,
       old.latest_checked_at,old.latest_status,new.latest_status,coalesce(new.latest_detail,''))
    on conflict (source_id,checked_at) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function radar_internal.capture_source_health_transition() from public,anon,authenticated;
grant execute on function radar_internal.capture_source_health_transition() to service_role;

drop trigger if exists trg_capture_source_health_transition on public.radar_source_health_checks;
create trigger trg_capture_source_health_transition
after update of latest_status on public.radar_source_health_checks
for each row
when (old.latest_status is distinct from new.latest_status)
execute function radar_internal.capture_source_health_transition();

comment on table public.radar_source_health_transitions is
  'Private immutable saved status switches only; not outage notifications or personal data.';
comment on column public.radar_source_health_checks.status is
  'Immutable first source status of UTC day; used for two-day alarm semantics.';
comment on column public.radar_source_health_checks.latest_status is
  'Last persisted source status for the UTC day, not the current live provider probe.';
