-- Per-user message rows + RLS. Run after the initial chat migration.
-- Clears shared demo messages; each user starts empty threads until they chat.

alter table public.chat_messages
  add column if not exists owner_user_id uuid references auth.users (id) on delete cascade;

delete from public.chat_messages;

alter table public.chat_messages
  alter column owner_user_id set not null;

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own"
  on public.chat_messages for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
  on public.chat_messages for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

-- Personas: only signed-in users can read the catalog (adjust if you need public marketing pages).
drop policy if exists "chat_profiles_select_all" on public.chat_profiles;
create policy "chat_profiles_select_authenticated"
  on public.chat_profiles for select to authenticated
  using (true);
