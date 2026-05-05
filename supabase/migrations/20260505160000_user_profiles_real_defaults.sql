-- Real profile defaults: no implied age; stats start at zero for new users.

alter table public.user_profiles drop constraint if exists user_profiles_age_check;

alter table public.user_profiles alter column age drop not null;
alter table public.user_profiles alter column age drop default;
alter table public.user_profiles alter column age set default null;

alter table public.user_profiles add constraint user_profiles_age_check
  check (age is null or (age >= 18 and age <= 120));

alter table public.user_profiles
  add column if not exists stat_chats integer not null default 0 check (stat_chats >= 0);
alter table public.user_profiles
  add column if not exists stat_links integer not null default 0 check (stat_links >= 0);
alter table public.user_profiles
  add column if not exists stat_likes integer not null default 0 check (stat_likes >= 0);
