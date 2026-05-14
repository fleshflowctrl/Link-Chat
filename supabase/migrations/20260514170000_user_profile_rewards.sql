-- Per-user, per-milestone bookkeeping for one-time profile completion bonuses.
-- Used by the auto-claim flow in `PATCH /api/me/profile` to make sure each
-- user gets paid exactly once for each completeness field they fill in.
create table if not exists public.user_profile_rewards (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  milestone text not null,
  credits_paid integer not null default 0,
  awarded_at timestamptz not null default now(),
  primary key (owner_user_id, milestone)
);

alter table public.user_profile_rewards enable row level security;

drop policy if exists "user_profile_rewards_select_own" on public.user_profile_rewards;
create policy "user_profile_rewards_select_own"
  on public.user_profile_rewards
  for select
  using (auth.uid() = owner_user_id);

drop policy if exists "user_profile_rewards_insert_own" on public.user_profile_rewards;
create policy "user_profile_rewards_insert_own"
  on public.user_profile_rewards
  for insert
  with check (auth.uid() = owner_user_id);
