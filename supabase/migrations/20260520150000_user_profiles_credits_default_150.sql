-- New signups: 150 starting credits. Existing balances unchanged.

alter table public.user_profiles
  alter column credits set default 150;
