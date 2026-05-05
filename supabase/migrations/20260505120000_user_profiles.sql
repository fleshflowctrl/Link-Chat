-- Real user profile (one row per auth user). Catalog AI personas stay in chat_profiles.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  age smallint not null default 25 check (age >= 18 and age <= 120),
  location text not null default '',
  pronouns text not null default 'they/them',
  custom_pronouns text not null default '',
  bio text not null default '',
  looking_for text not null default '',
  interests text[] not null default '{}',
  main_photo_url text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{
    "showDistance": true,
    "showOnlineStatus": true,
    "allowNewChatRequests": true,
    "pushNotifications": true
  }'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_updated_idx on public.user_profiles (updated_at desc);

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

-- Auto-create an empty row when a user signs up (app still tolerates missing row).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing accounts (created before this migration) do not fire the trigger retroactively.
insert into public.user_profiles (user_id)
select u.id from auth.users u
where not exists (
  select 1 from public.user_profiles p where p.user_id = u.id
);
