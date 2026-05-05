alter table public.user_profiles
  add column if not exists credits integer not null default 125
  check (credits >= 0);
