-- New signups: 1000 starting credits (10x rebase of the credit economy).
-- Existing balances are unchanged.

alter table public.user_profiles
  alter column credits set default 1000;
