-- Standardise the starting balance for new accounts to 50 credits.
-- The previous default was 125 (legacy) — every fresh signup should now begin
-- with 50 credits. Existing rows are intentionally left untouched so we don't
-- retroactively rebalance accounts that already spent / earned credits.

alter table public.user_profiles
  alter column credits set default 50;

-- Re-affirm RLS so the credits column is owner-only. These policies already
-- exist in the base migration but we re-declare them here defensively to make
-- it explicit that nobody but the account owner can ever read or mutate this
-- column. (Postgres `drop policy if exists` is idempotent.)

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
  on public.user_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
  on public.user_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Explicitly forbid client-side deletes of profile rows (auth.users delete
-- cascade still works because it bypasses RLS via the cascading FK).
drop policy if exists "user_profiles_no_delete" on public.user_profiles;
create policy "user_profiles_no_delete"
  on public.user_profiles for delete to authenticated
  using (false);
