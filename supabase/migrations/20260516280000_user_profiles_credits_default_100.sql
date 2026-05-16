-- New signups: 100 starting credits (one base pack). Existing balances unchanged.

alter table public.user_profiles
  alter column credits set default 100;
