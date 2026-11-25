-- Private evidence ledger for explicitly requested regional store comparisons.
-- One sample per UTC day and region. Provider-reported only; NEVER use
-- these prices for the independent EUR deal-alert scanner.
create table if not exists public.psn_regional_price_history (
  game_key text not null check (game_key ~ '^reg-[0-9a-f]{64}$'),
  title text not null check (char_length(title) between 3 and 125),
  lookup_type text not null check (lookup_type in ('title','concept','product')),
  match_quality text not null check (match_quality in ('concept-id','title-review')),
  region text not null check (region in ('DE','GB','US','PL')),
  currency text not null check (currency in ('EUR','GBP','USD','PLN')),
  price numeric(10,2) not null check (price > 0 and price <= 50000),
  original_price numeric(10,2) check (original_price is null or original_price > price),
  discount_pct integer check (discount_pct is null or discount_pct between 1 and 99),
  store_url text not null check (
    char_length(store_url) <= 400 and
    store_url like 'https://store.playstation.com/%'
  ),
  source text not null default 'imbbloh/ps-prices'
    check (source = 'imbbloh/ps-prices'),
  source_type text not null default 'external-unverified'
    check (source_type = 'external-unverified'),
  observed_day date not null,
  observed_at timestamptz not null,
  provider_cached boolean not null default false,
  recorded_at timestamptz not null default now(),
  primary key (game_key, region, observed_day)
);
create index if not exists psn_region_history_latest
  on public.psn_regional_price_history (game_key, observed_at desc);
alter table public.psn_regional_price_history enable row level security;
revoke all on table public.psn_regional_price_history
  from public, anon, authenticated;
grant select, insert, update on table public.psn_regional_price_history
  to service_role;
comment on table public.psn_regional_price_history is
 'Private single-profile regional third-party observations. Not independently verified, not an EUR live-price feed, no anon/authenticated grants. UTC daily snapshots.';
