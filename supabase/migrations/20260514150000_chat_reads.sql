-- Track per-user "last read" time per chat thread so we can compute the
-- bottom-nav unread badge from the server (not just from client overrides).
create table if not exists public.chat_reads (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  peer_id text not null,
  last_read_at timestamptz not null default now(),
  primary key (owner_user_id, peer_id)
);

alter table public.chat_reads enable row level security;

drop policy if exists "chat_reads_select_own" on public.chat_reads;
create policy "chat_reads_select_own"
  on public.chat_reads
  for select
  using (auth.uid() = owner_user_id);

drop policy if exists "chat_reads_insert_own" on public.chat_reads;
create policy "chat_reads_insert_own"
  on public.chat_reads
  for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "chat_reads_update_own" on public.chat_reads;
create policy "chat_reads_update_own"
  on public.chat_reads
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);
