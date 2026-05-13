-- Mark a user as admin so they can read every chat thread via the admin panel.
-- Promote yourself once (Supabase SQL editor) with:
--   update public.user_profiles set is_admin = true where user_id = auth.uid();
-- Or by email:
--   update public.user_profiles
--      set is_admin = true
--    where user_id = (select id from auth.users where email = 'you@example.com');

alter table public.user_profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists user_profiles_is_admin_idx
  on public.user_profiles (is_admin)
  where is_admin = true;
