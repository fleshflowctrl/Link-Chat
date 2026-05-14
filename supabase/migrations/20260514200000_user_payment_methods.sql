-- Per-user saved payment methods. Only "safe to store" card fields are kept:
-- brand, last 4 digits, expiry, holder name. The full PAN and CVC are never
-- persisted (they're collected client-side, validated, and discarded).
--
-- This is a demo schema — in production these would be Stripe payment-method
-- IDs (`pm_xxx`) instead of card details.
create table if not exists public.user_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null,
  last4 text not null check (char_length(last4) = 4),
  exp_month smallint not null check (exp_month between 1 and 12),
  exp_year smallint not null check (exp_year between 2020 and 2100),
  holder_name text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_payment_methods_user_id_idx
  on public.user_payment_methods (user_id, created_at desc);

-- A user can have at most one default card.
create unique index if not exists user_payment_methods_user_default_idx
  on public.user_payment_methods (user_id)
  where is_default = true;

alter table public.user_payment_methods enable row level security;

drop policy if exists "user_payment_methods_select_own" on public.user_payment_methods;
create policy "user_payment_methods_select_own"
  on public.user_payment_methods
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_payment_methods_insert_own" on public.user_payment_methods;
create policy "user_payment_methods_insert_own"
  on public.user_payment_methods
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_payment_methods_update_own" on public.user_payment_methods;
create policy "user_payment_methods_update_own"
  on public.user_payment_methods
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_payment_methods_delete_own" on public.user_payment_methods;
create policy "user_payment_methods_delete_own"
  on public.user_payment_methods
  for delete
  using (auth.uid() = user_id);
