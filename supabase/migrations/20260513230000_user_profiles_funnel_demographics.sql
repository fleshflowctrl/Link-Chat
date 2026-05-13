-- Add demographics + age range captured during onboarding funnel (steps 3-5).

alter table public.user_profiles
  add column if not exists gender text not null default '',
  add column if not exists seeking_gender text not null default '',
  add column if not exists age_range_min smallint not null default 18 check (age_range_min >= 18 and age_range_min <= 99),
  add column if not exists age_range_max smallint not null default 35 check (age_range_max >= 18 and age_range_max <= 99),
  add column if not exists age_range_any boolean not null default false;

-- Loose enum-style constraints (text columns; allow empty for legacy rows).
alter table public.user_profiles
  drop constraint if exists user_profiles_gender_check;
alter table public.user_profiles
  add constraint user_profiles_gender_check
  check (gender in ('', 'man', 'woman'));

alter table public.user_profiles
  drop constraint if exists user_profiles_seeking_gender_check;
alter table public.user_profiles
  add constraint user_profiles_seeking_gender_check
  check (seeking_gender in ('', 'men', 'women', 'both'));

alter table public.user_profiles
  drop constraint if exists user_profiles_age_range_order_check;
alter table public.user_profiles
  add constraint user_profiles_age_range_order_check
  check (age_range_min <= age_range_max);
