-- A/B variant tagging: v1 (default) vs v2 (swinger theme + separate bot pool).

alter table public.chat_profiles
  add column if not exists app_variant text not null default 'v1'
  check (app_variant in ('v1', 'v2'));

create index if not exists chat_profiles_app_variant_home_sort_idx
  on public.chat_profiles (app_variant, home_sort);

alter table public.site_visits
  add column if not exists app_variant text not null default 'v1'
  check (app_variant in ('v1', 'v2'));

create index if not exists site_visits_app_variant_first_visit_idx
  on public.site_visits (app_variant, first_visit_at desc);

alter table public.funnel_step_views
  add column if not exists app_variant text not null default 'v1'
  check (app_variant in ('v1', 'v2'));

alter table public.credit_checkout_clicks
  add column if not exists app_variant text not null default 'v1'
  check (app_variant in ('v1', 'v2'));

alter table public.user_profiles
  add column if not exists app_variant text not null default 'v1'
  check (app_variant in ('v1', 'v2'));

create index if not exists user_profiles_app_variant_idx
  on public.user_profiles (app_variant);

alter table public.admin_metrics_settings
  add column if not exists metrics_since_v2 timestamptz;

comment on column public.chat_profiles.app_variant is
  'v1 = production pool; v2 = alternate A/B pool for /v2/* traffic.';
comment on column public.user_profiles.app_variant is
  'Set on signup from the visitor''s first-touch variant (cookie / URL).';
