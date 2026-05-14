-- Per-user record of which exclusive content sets the user has unlocked.
-- Lets us scope unlocks to the signed-in account so different users (or
-- different signups in the same browser) don't share each other's content.
create table if not exists public.user_content_unlocks (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  set_id text not null,
  credits_paid integer not null default 0,
  unlocked_at timestamptz not null default now(),
  primary key (owner_user_id, set_id)
);

alter table public.user_content_unlocks enable row level security;

drop policy if exists "user_content_unlocks_select_own" on public.user_content_unlocks;
create policy "user_content_unlocks_select_own"
  on public.user_content_unlocks
  for select
  using (auth.uid() = owner_user_id);

drop policy if exists "user_content_unlocks_insert_own" on public.user_content_unlocks;
create policy "user_content_unlocks_insert_own"
  on public.user_content_unlocks
  for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "user_content_unlocks_update_own" on public.user_content_unlocks;
create policy "user_content_unlocks_update_own"
  on public.user_content_unlocks
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);
