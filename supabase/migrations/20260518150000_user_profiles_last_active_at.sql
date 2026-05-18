-- Presence column for the "online now" metric on /admin/metrics.
-- The signed-in client pings /api/me/heartbeat every ~30 seconds while
-- the app shell is visible; the API updates this column. The admin
-- dashboard counts profiles with last_active_at >= now() - 90s.

alter table public.user_profiles
  add column if not exists last_active_at timestamptz;

create index if not exists user_profiles_last_active_at_idx
  on public.user_profiles (last_active_at desc)
  where last_active_at is not null;
