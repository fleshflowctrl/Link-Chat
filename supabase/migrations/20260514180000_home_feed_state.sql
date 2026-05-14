-- Per-user state for the hourly home feed rotation on /discover.
--
-- Every wall-clock hour the home grid rotates to a fresh deterministic slice
-- of 10 profiles. Users can pay 25 credits to skip ahead to the next slot
-- without waiting; that pay-to-refresh action increments `refresh_offset`,
-- which is added to the natural hour bucket when the active slot is computed.
create table if not exists public.home_feed_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_offset integer not null default 0,
  last_paid_refresh_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.home_feed_state enable row level security;

drop policy if exists "home_feed_state_select_own" on public.home_feed_state;
create policy "home_feed_state_select_own"
  on public.home_feed_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "home_feed_state_insert_own" on public.home_feed_state;
create policy "home_feed_state_insert_own"
  on public.home_feed_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "home_feed_state_update_own" on public.home_feed_state;
create policy "home_feed_state_update_own"
  on public.home_feed_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
