-- Per-user history of which profiles they've already seen on /discover
-- and which they've opened a chat with. Used to:
--   * push recently-seen profiles to the back of the next hourly pack
--     so the feed never shows the same person twice in a row
--   * exclude profiles the user already opened a chat with — they live
--     in /messages, no need to keep recommending them on /discover
--
-- One row per (user_id, profile_id). `last_seen_at` is bumped on every
-- discover impression; `opened_chat` flips true the first time the user
-- opens /messages/<profile_id> and stays true thereafter.

create table if not exists public.user_profile_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  last_seen_at timestamptz not null default now(),
  opened_chat boolean not null default false,
  opened_chat_at timestamptz,
  primary key (user_id, profile_id)
);

create index if not exists user_profile_views_user_seen_idx
  on public.user_profile_views (user_id, last_seen_at desc);

create index if not exists user_profile_views_user_opened_idx
  on public.user_profile_views (user_id)
  where opened_chat = true;

alter table public.user_profile_views enable row level security;

drop policy if exists "user_profile_views_select_own" on public.user_profile_views;
create policy "user_profile_views_select_own"
  on public.user_profile_views
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_profile_views_insert_own" on public.user_profile_views;
create policy "user_profile_views_insert_own"
  on public.user_profile_views
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_profile_views_update_own" on public.user_profile_views;
create policy "user_profile_views_update_own"
  on public.user_profile_views
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
